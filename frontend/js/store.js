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
    API_BASE: "http://localhost:5000/api",

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
    async createProfile(name) {
        if (!name || name.trim() === "") {
            throw new Error("Tên hồ sơ không được để trống.");
        }
        
        const response = await fetch(`${this.API_BASE}/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
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
        await this.refreshProfile(profileId);
        return newFile;
    },

    /**
     * Nạp nhanh bộ tài liệu mẫu MobiFone vào hồ sơ
     */
    async loadMockData(profileId) {
        const response = await fetch(`${this.API_BASE}/profiles/${profileId}/load-mock`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Không thể nạp bộ tài liệu mẫu.");
        }

        const data = await response.json();
        await this.refreshProfile(profileId);
        return data.addedCount;
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

        await this.refreshProfile(profileId);
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
        await this.refreshProfile(profileId);
        return updatedProfile;
    }

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
        await this.refreshProfile(profileId);
        return updatedProfile;
    }
};
