/**
 * ==========================================================================
 * STATE STORE - QUẢN LÝ TRẠNG THÁI TOÀN CỤC QUA BACKEND API (TÌM & THAY THẾ)
 * ==========================================================================
 */

window.AppStore = {
    // Trạng thái cục bộ được đồng bộ từ Backend
    state: {
        profiles: [],
        activeProfileId: null
    },

    // Đường dẫn cơ sở kết nối đến Express API Server
    // Đường dẫn cơ sở kết nối đến Express API Server (tự động nhận diện môi trường localhost vs cloud deploy)
    API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? "http://127.0.0.1:5000/api"
        : "https://payment-records-okxr.onrender.com/api",

    /**
     * Khởi tạo Store và tải dữ liệu từ Backend API
     */
    async init() {
        try {
            const response = await fetch(`${this.API_BASE}/profiles`);
            if (!response.ok) throw new Error("Không thể kết nối đến máy chủ API Backend.");
            const data = await response.json();
            this.state.profiles = data.profiles || [];
            this.state.activeProfileId = data.activeProfileId || null;
        } catch (error) {
            console.error("Lỗi khi khởi tạo Store từ API:", error);
            this.state = { profiles: [], activeProfileId: null };
            throw error;
        }
    },

    /**
     * Đồng bộ lại thông tin một hồ sơ cụ thể từ Backend
     */
    async refreshProfile(profileId) {
        try {
            const response = await fetch(`${this.API_BASE}/profiles`);
            if (response.ok) {
                const data = await response.json();
                this.state.profiles = data.profiles || [];
                this.state.activeProfileId = data.activeProfileId || null;
            }
        } catch (error) {
            console.error("Lỗi khi đồng bộ lại hồ sơ:", error);
        }
    },

    /**
     * Trả về toàn bộ danh sách hồ sơ
     */
    getProfiles() {
        return this.state.profiles || [];
    },

    /**
     * Lấy hồ sơ đang được chọn active
     */
    getActiveProfile() {
        if (!this.state.activeProfileId) return null;
        return this.state.profiles.find(p => p.id === this.state.activeProfileId) || null;
    },

    /**
     * Đặt hồ sơ tích cực theo ID
     */
    async setActiveProfile(profileId) {
        try {
            this.state.activeProfileId = profileId;
            await fetch(`${this.API_BASE}/profiles/active`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId })
            });
        } catch (error) {
            console.error("Lỗi khi cập nhật hồ sơ hoạt động lên server:", error);
        }
    },

    /**
     * Tạo hồ sơ thanh toán mới
     */
    async createProfile(name, type = 'edited', originalProfileId = null) {
        if (!name || name.trim() === "") {
            throw new Error("Tên hồ sơ không được để trống.");
        }
        
        const response = await fetch(`${this.API_BASE}/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), type, originalProfileId })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể tạo hồ sơ mới.");
        }

        const newProfile = await response.json();
        
        this.state.profiles.unshift(newProfile);
        this.state.activeProfileId = newProfile.id;
        
        return newProfile;
    },

    /**
     * Xóa hồ sơ thanh toán
     */
    async deleteProfile(profileId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error("Không thể xóa hồ sơ.");
        }

        this.state.profiles = this.state.profiles.filter(p => p.id !== profileId);
        if (this.state.activeProfileId === profileId) {
            this.state.activeProfileId = null;
        }
    },

    /**
     * Thêm một file vào hồ sơ
     */
    async addFileToProfile(profileId, fileObj) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: fileObj.name,
                size: fileObj.size || 0,
                content: fileObj.content || ""
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể tải tài liệu lên hồ sơ.");
        }

        const newFile = await response.json();
        
        // Cập nhật local state trực tiếp để tối ưu hóa tốc độ, tránh gửi fetch profiles dư thừa
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                const updatedFiles = p.files ? [...p.files] : [];
                if (!updatedFiles.some(f => f.id === newFile.id)) {
                    updatedFiles.push(newFile);
                }
                return {
                    ...p,
                    status: 'new',
                    files: updatedFiles
                };
            }
            return p;
        });

        return newFile;
    },

    /**
     * Sao chép toàn bộ tài liệu từ một hồ sơ gốc sang hồ sơ hiện tại
     */
    async copyFilesFromOriginal(profileId, sourceId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/copy-from/${sourceId}`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể sao chép tài liệu từ hồ sơ gốc.");
        }

        const data = await response.json();
        
        // Cập nhật local state trực tiếp
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                return {
                    ...p,
                    originalProfileId: data.profile.originalProfileId,
                    variables: data.profile.variables,
                    files: data.profile.files,
                    status: 'new'
                };
            }
            return p;
        });

        return data.profile;
    },


    /**
     * Xóa một file khỏi hồ sơ
     */
    async removeFileFromProfile(profileId, fileId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/files/${fileId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error("Không thể xóa tài liệu.");
        }

        const data = await response.json();
        
        // Cập nhật local state trực tiếp sử dụng danh sách file mới từ backend trả về
        if (data && data.files) {
            this.state.profiles = this.state.profiles.map(p => {
                if (p.id === profileId) {
                    return {
                        ...p,
                        status: data.files.length === 0 ? 'new' : p.status,
                        files: data.files
                    };
                }
                return p;
            });
        }
    },

    /**
     * API thực hiện thay thế từ khóa hàng loạt trên các tệp được chọn
     */
    async applyReplacement(profileId, findText, replaceText, targetFileIds) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ findText, replaceText, targetFileIds })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể thực hiện thay thế.");
        }

        const updatedProfile = await response.json();
        
        // Cập nhật local state trực tiếp
        this.state.profiles = this.state.profiles.map(p => 
            p.id === profileId ? updatedProfile : p
        );

        return updatedProfile;
    },

    /**
     * Khôi phục tài liệu gốc và xóa lịch sử thay thế của hồ sơ qua API
     */
    async resetProfile(profileId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/reset`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể khôi phục tài liệu gốc.");
        }

        const updatedProfile = await response.json();
        
        // Cập nhật local state trực tiếp
        this.state.profiles = this.state.profiles.map(p => 
            p.id === profileId ? updatedProfile : p
        );

        return updatedProfile;
    },

    /**
     * Khôi phục (hoàn tác) một cụm từ đã thay thế về từ gốc qua API
     */
    async undoReplacement(profileId, findText, replaceText) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/undo-replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ findText, replaceText })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể hoàn tác thay thế.");
        }

        // Cập nhật local state trực tiếp
        this.state.profiles = this.state.profiles.map(p => 
            p.id === profileId ? updatedProfile : p
        );

        return updatedProfile;
    },

    /**
     * Cập nhật danh sách biến Mail Merge
     */
    async updateProfileVariables(profileId, variables) {
        const rowIndex = (window.AppWorkspaceState && window.AppWorkspaceState.previewRowIndex) || 1;
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/variables`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variables, rowIndex })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể cập nhật danh sách biến.");
        }

        const data = await response.json();
        
        // Cập nhật local state
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                return {
                    ...p,
                    variables: data.variables,
                    files: data.files
                };
            }
            return p;
        });

        return data;
    },

    /**
     * Cập nhật nội dung HTML soạn thảo của tài liệu
     */
    async updateFileContent(profileId, fileId, htmlContent) {
        const rowIndex = (window.AppWorkspaceState && window.AppWorkspaceState.previewRowIndex) || 1;
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/files/${fileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ htmlContent, rowIndex })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể lưu nội dung chỉnh sửa.");
        }

        const data = await response.json();

        // Cập nhật local state
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                return {
                    ...p,
                    variables: data.variables,
                    files: data.files
                };
            }
            return p;
        });

        return data;
    },

    /**
     * Tải lên ảnh minh chứng (Base64)
     */
    async uploadImage(profileId, name, size, dataUrl) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, size, data: dataUrl })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể tải hình ảnh minh chứng.");
        }

        const newImg = await response.json();

        // Cập nhật local state
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                const updatedImages = p.images ? [...p.images] : [];
                // Thêm vào đầu danh sách
                updatedImages.unshift(newImg);
                return {
                    ...p,
                    images: updatedImages
                };
            }
            return p;
        });

        return newImg;
    },

    /**
     * Xóa ảnh minh chứng khỏi hồ sơ
     */
    async deleteImage(profileId, imageId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/images/${imageId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error("Không thể xóa hình ảnh minh chứng.");
        }

        // Cập nhật local state
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                return {
                    ...p,
                    images: (p.images || []).filter(img => img.id !== imageId)
                };
            }
            return p;
        });
    },

    /**
     * Kết nối Hồ sơ thanh toán tới Tệp Mail Merge live
     */
    async connectMailMerge(profileId, mailMergeId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/connect-mailmerge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailMergeId })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể kết nối đến Tệp Mail Merge.");
        }

        const data = await response.json();

        // Cập nhật local state trực tiếp
        this.state.profiles = this.state.profiles.map(p => {
            if (p.id === profileId) {
                return {
                    ...p,
                    mailMergeId: data.mailMergeId,
                    variables: data.variables,
                    files: data.files
                };
            }
            return p;
        });

        return data;
    }
};

// Cập nhật cấu hình build tĩnh cho Vercel
