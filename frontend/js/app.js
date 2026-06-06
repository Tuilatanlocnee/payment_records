/**
 * ==========================================================================
 * MAIN APP CONTROLLER - ĐIỀU PHỐI VÀ LIÊN KẾT LOGIC GIAO DIỆN TÌM KIẾM
 * ==========================================================================
 */

let currentSearchQuery = "";

document.addEventListener('DOMContentLoaded', async () => {
    // Khởi tạo trạng thái store bằng cách gọi API
    try {
        await AppStore.init();
    } catch (e) {
        showToast("Lỗi kết nối Backend API. Vui lòng đảm bảo Backend đã chạy.", "danger");
    }

    // Khởi động giao diện chính
    initApp();
});

/**
 * Khởi tạo các sự kiện và hiển thị ban đầu
 */
function initApp() {
    // Render danh sách hồ sơ ban đầu
    renderProfiles();

    // Sự kiện click vào logo MobiFone để quay về trang chủ (chưa chọn hồ sơ nào)
    const logoContainer = document.querySelector('.logo-container');
    if (logoContainer) {
        logoContainer.style.cursor = 'pointer';
        logoContainer.addEventListener('click', async () => {
            try {
                currentSearchQuery = ""; // Reset từ khóa tìm kiếm
                await AppStore.setActiveProfile(null);
                renderProfiles();
                renderActiveProfile();
                
                // Reset ô tìm kiếm hồ sơ ở Sidebar
                const searchInput = document.getElementById('search-profile-input');
                if (searchInput) {
                    searchInput.value = '';
                }
            } catch (error) {
                console.error("Lỗi khi quay về màn hình chính:", error);
            }
        });
    }

    // Đăng ký sự kiện tạo hồ sơ mới trên Header
    const btnCreateProfile = document.getElementById('btn-create-profile');
    const modalCreateProfile = document.getElementById('create-profile-modal');
    const btnCloseModalX = document.getElementById('btn-close-modal-x');
    const btnCloseModalCancel = document.getElementById('btn-close-modal-cancel');
    const createProfileForm = document.getElementById('create-profile-form');
    const profileNameInput = document.getElementById('profile-name-input');

    if (btnCreateProfile && modalCreateProfile) {
        // Mở modal
        btnCreateProfile.addEventListener('click', () => {
            modalCreateProfile.classList.remove('hidden');
            profileNameInput.value = '';
            profileNameInput.focus();
        });

        // Đóng modal bằng nút X
        if (btnCloseModalX) {
            btnCloseModalX.addEventListener('click', () => {
                modalCreateProfile.classList.add('hidden');
            });
        }

        // Đóng modal bằng nút Hủy
        if (btnCloseModalCancel) {
            btnCloseModalCancel.addEventListener('click', () => {
                modalCreateProfile.classList.add('hidden');
            });
        }

        // Đóng modal khi click ra ngoài vùng nội dung modal
        modalCreateProfile.addEventListener('click', (e) => {
            if (e.target === modalCreateProfile) {
                modalCreateProfile.classList.add('hidden');
            }
        });

        // Xử lý submit form tạo hồ sơ mới
        if (createProfileForm) {
            createProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const profileName = profileNameInput.value;
                try {
                    const newProfile = await AppStore.createProfile(profileName);
                    modalCreateProfile.classList.add('hidden');
                    showToast(`Tạo thành công hồ sơ: "${newProfile.name}"`, 'success');
                    
                    renderProfiles();
                    renderActiveProfile();
                } catch (error) {
                    showToast(error.message, 'danger');
                }
            });
        }
    }

    // Sự kiện tìm kiếm hồ sơ ở Sidebar
    const searchInput = document.getElementById('search-profile-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filteredProfiles = AppStore.getProfiles().filter(p => 
                p.name.toLowerCase().includes(query)
            );
            Components.renderProfileList(filteredProfiles, AppStore.state.activeProfileId);
        });
    }

    // Sự kiện click chọn hồ sơ trong danh sách ở Sidebar (Dùng Event Delegation)
    const profileList = document.getElementById('profile-list');
    if (profileList) {
        profileList.addEventListener('click', async (e) => {
            const profileItem = e.target.closest('.profile-item');
            if (profileItem) {
                const profileId = profileItem.getAttribute('data-id');
                await AppStore.setActiveProfile(profileId);
                
                document.querySelectorAll('.profile-item').forEach(item => {
                    item.classList.remove('active');
                });
                profileItem.classList.add('active');

                renderActiveProfile();
            }
        });
    }

    // Đăng ký các sự kiện tương tác trong màn hình Chi tiết Hồ sơ (Event Delegation trên container chính)
    const detailContainer = document.getElementById('profile-detail-container');
    if (detailContainer) {
        // 1. Xử lý xóa hồ sơ
        detailContainer.addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('#btn-delete-profile');
            if (btnDelete) {
                const profileId = btnDelete.getAttribute('data-id');
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile && confirm(`Bạn có chắc chắn muốn xóa hồ sơ "${activeProfile.name}" không?`)) {
                    try {
                        await AppStore.deleteProfile(profileId);
                        showToast("Đã xóa hồ sơ thanh toán.", "success");
                        renderProfiles();
                        renderActiveProfile();
                    } catch (error) {
                        showToast(error.message, 'danger');
                    }
                }
            }
        });

        // Xử lý Khôi phục tài liệu gốc (Reset hồ sơ)
        detailContainer.addEventListener('click', async (e) => {
            const btnReset = e.target.closest('#btn-reset-profile');
            if (btnReset) {
                const profileId = btnReset.getAttribute('data-id');
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile && confirm(`Bạn có chắc chắn muốn khôi phục hồ sơ "${activeProfile.name}" về tài liệu gốc không? Mọi thay đổi và lịch sử chỉnh sửa sẽ bị xóa sạch.`)) {
                    try {
                        await AppStore.resetProfile(profileId);
                        showToast("Đã khôi phục tài liệu gốc thành công.", "success");
                        currentSearchQuery = ""; // Reset từ khóa tìm kiếm
                        renderProfiles();
                        renderActiveProfile();
                    } catch (error) {
                        showToast(error.message, 'danger');
                    }
                }
            }
        });

        // Xử lý Hủy tìm kiếm
        detailContainer.addEventListener('click', (e) => {
            const btnClear = e.target.closest('#btn-clear-search');
            if (btnClear) {
                currentSearchQuery = "";
                const searchInput = document.getElementById('search-phrase-input');
                if (searchInput) searchInput.value = "";
                
                btnClear.classList.add('hidden');
                
                // Trả vùng kết quả về mặc định
                const resultsArea = document.getElementById('search-results-area');
                if (resultsArea) {
                    resultsArea.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                            <i data-lucide="info" style="width: 20px; height: 20px; margin: 0 auto 8px auto; opacity: 0.5; display: block;"></i>
                            Hãy nhập cụm từ tìm kiếm ở trên để bắt đầu chỉnh sửa.
                        </div>
                    `;
                    safeCreateIcons();
                }

                // Cập nhật lại preview (ẩn đi nếu không có replacements thực tế)
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile) {
                    if (activeProfile.replacements && activeProfile.replacements.length > 0) {
                        if (activeProfile.files && activeProfile.files.length > 0) {
                            const selectPreview = document.getElementById('select-preview-file');
                            if (selectPreview) {
                                const editedFiles = activeProfile.files.filter(file => file.currentContent !== file.originalContent);
                                const displayFiles = editedFiles.length > 0 ? editedFiles : activeProfile.files;
                                selectPreview.innerHTML = displayFiles.map((file, idx) => `
                                    <option value="${file.id}" ${idx === 0 ? 'selected' : ''}>${file.name}</option>
                                `).join('');
                            }
                            const fileId = selectPreview ? selectPreview.value : activeProfile.files[0].id;
                            const file = activeProfile.files.find(f => f.id === fileId) || activeProfile.files[0];
                            if (file) {
                                Components.updateFilePreview(file, activeProfile, "");
                            }
                        }
                    } else {
                        // Ẩn preview section đi nếu chưa có replacements và đã hủy tìm kiếm
                        const previewSection = document.getElementById('card-preview-section');
                        if (previewSection) previewSection.classList.add('hidden');
                    }
                }
            }
        });


        // 3. Xử lý xóa file khỏi hồ sơ
        detailContainer.addEventListener('click', async (e) => {
            const btnRemoveFile = e.target.closest('.btn-remove-file');
            if (btnRemoveFile) {
                const fileId = btnRemoveFile.getAttribute('data-file-id');
                const profileId = btnRemoveFile.getAttribute('data-profile-id');
                
                try {
                    await AppStore.removeFileFromProfile(profileId, fileId);
                    showToast("Đã xóa tài liệu khỏi hồ sơ.", "success");
                    renderProfiles();
                    renderActiveProfile();
                } catch (error) {
                    showToast(error.message, 'danger');
                }
            }
        });

        // 4. Click kích hoạt input file ẩn khi nhấn vào dropzone
        detailContainer.addEventListener('click', (e) => {
            const dropzone = e.target.closest('#file-dropzone');
            if (dropzone && e.target.tagName !== 'INPUT') {
                const fileInput = document.getElementById('file-input-hidden');
                if (fileInput) fileInput.click();
            }
        });

        // Lắng nghe sự kiện chọn file từ thẻ input ẩn
        detailContainer.addEventListener('change', (e) => {
            const fileInput = e.target.closest('#file-input-hidden');
            if (fileInput && fileInput.files.length > 0) {
                handleUploadedFiles(fileInput.files);
            }
        });

        // 5. Xử lý Drag & Drop trên vùng dropzone
        detailContainer.addEventListener('dragover', (e) => {
            const dropzone = e.target.closest('#file-dropzone');
            if (dropzone) {
                e.preventDefault();
                dropzone.classList.add('dragover');
            }
        });

        detailContainer.addEventListener('dragleave', (e) => {
            const dropzone = e.target.closest('#file-dropzone');
            if (dropzone) {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            }
        });

        detailContainer.addEventListener('drop', (e) => {
            const dropzone = e.target.closest('#file-dropzone');
            if (dropzone) {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    handleUploadedFiles(e.dataTransfer.files);
                }
            }
        });

        // 6. Xử lý sự kiện nhấn nút Tìm kiếm cụm từ trong tài liệu
        detailContainer.addEventListener('click', (e) => {
            const btnSearch = e.target.closest('#btn-trigger-search');
            if (btnSearch) {
                triggerTextSearch();
            }
        });

        // Hỗ trợ nhấn Enter trên ô tìm kiếm
        detailContainer.addEventListener('keypress', (e) => {
            const searchInput = e.target.closest('#search-phrase-input');
            if (searchInput && e.key === 'Enter') {
                triggerTextSearch();
            }
        });

        // 7. Xử lý Bấm nút Áp dụng chỉnh sửa & thay thế
        detailContainer.addEventListener('click', async (e) => {
            const btnApply = e.target.closest('#btn-apply-replace');
            if (btnApply) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;

                const replaceInput = document.getElementById('replace-text-input');
                if (!replaceInput) return;

                const findText = replaceInput.getAttribute('data-find-text');
                const replaceText = replaceInput.value; // Cho phép thay bằng chuỗi rỗng nếu muốn xóa từ
                const syncCheckbox = document.getElementById('checkbox-sync-all');
                const shouldSyncAll = syncCheckbox ? syncCheckbox.checked : true;

                // Lọc ra danh sách các file khớp chứa cụm từ đó
                // Chuẩn hóa Unicode NFC và rút gọn khoảng trắng để so sánh chính xác hơn (chấp nhận khoảng trắng kép/xuống dòng)
                const cleanString = (str) => (str || '').normalize('NFC').replace(/\s+/g, ' ');
                const normalizedFind = cleanString(findText);
                const matchingFiles = activeProfile.files.filter(file =>
                    cleanString(file.currentContent).includes(normalizedFind)
                );

                let targetFileIds = [];
                if (shouldSyncAll) {
                    targetFileIds = matchingFiles.map(f => f.id);
                } else {
                    if (matchingFiles.length > 0) {
                        targetFileIds = [matchingFiles[0].id];
                    }
                }

                if (targetFileIds.length === 0) {
                    showToast("Không tìm thấy tệp nào chứa cụm từ này để thay thế.", "danger");
                    return;
                }

                try {
                    await AppStore.applyReplacement(activeProfile.id, findText, replaceText, targetFileIds);
                    showToast(`Đã thay thế "${findText}" thành "${replaceText}" thành công!`, "success");
                    
                    renderProfiles();
                    renderActiveProfile();

                    // Làm trống ô tìm kiếm và hiển thị thông báo thành công
                    const searchInput = document.getElementById('search-phrase-input');
                    if (searchInput) searchInput.value = "";
                    
                    currentSearchQuery = "";
                    const btnClearSearch = document.getElementById('btn-clear-search');
                    if (btnClearSearch) btnClearSearch.classList.add('hidden');
                    
                    const resultsArea = document.getElementById('search-results-area');
                    if (resultsArea) {
                        resultsArea.innerHTML = `
                            <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                                <i data-lucide="check" style="width: 20px; height: 20px; margin: 0 auto 8px auto; opacity: 0.5; display: block; color: var(--accent-green);"></i>
                                Đã áp dụng thay thế thành công cụm từ. Hãy nhập cụm từ tìm kiếm mới để tiếp tục.
                            </div>
                        `;
                        safeCreateIcons();
                    }
                } catch (err) {
                    showToast("Lỗi thay thế: " + err.message, "danger");
                }
            }
        });

        // Xử lý Bấm nút Hoàn tác từng cụm từ đã thay thế
        detailContainer.addEventListener('click', async (e) => {
            const btnUndo = e.target.closest('.btn-undo-replace');
            if (btnUndo) {
                const findText = btnUndo.getAttribute('data-find-text');
                const replaceText = btnUndo.getAttribute('data-replace-text');
                const activeProfile = AppStore.getActiveProfile();
                
                if (activeProfile && confirm(`Bạn có chắc chắn muốn khôi phục cụm từ "${replaceText}" trở lại thành "${findText}" trong tất cả tài liệu không?`)) {
                    try {
                        await AppStore.undoReplacement(activeProfile.id, findText, replaceText);
                        showToast(`Đã khôi phục thành công cụm từ gốc!`, "success");
                        
                        renderProfiles();
                        renderActiveProfile();
                    } catch (error) {
                        showToast("Lỗi hoàn tác: " + error.message, "danger");
                    }
                }
            }
        });

        // 8. Thay đổi file xem trước trong dropdown preview
        detailContainer.addEventListener('change', (e) => {
            const selectPreview = e.target.closest('#select-preview-file');
            if (selectPreview) {
                const fileId = selectPreview.value;
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile) {
                    const file = activeProfile.files.find(f => f.id === fileId);
                    if (file) {
                        Components.updateFilePreview(file, activeProfile, currentSearchQuery);
                    }
                }
            }
        });

        // 9. Xử lý chuyển đổi qua lại giữa các hình thức xuất hồ sơ (Toàn bộ / Chỉ chỉnh sửa / Tự chọn)
        detailContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.export-card');
            if (card) {
                const radio = card.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
                
                // Cập nhật class active
                document.querySelectorAll('.export-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                // Hiện hoặc ẩn danh sách tự chọn file
                const mode = card.getAttribute('data-mode');
                const customSelectArea = document.getElementById('custom-files-select-container');
                if (customSelectArea) {
                    if (mode === 'custom') {
                        customSelectArea.classList.remove('hidden');
                    } else {
                        customSelectArea.classList.add('hidden');
                    }
                }
            }
        });

        // 10. Xử lý Click chọn/bỏ chọn checkbox bằng cách click vào dòng .custom-export-item
        detailContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.custom-export-item');
            if (item && e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('.export-file-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
            }
        });

        // 11. Xử lý nút Chọn tất cả và Bỏ chọn hết ở danh sách file tự chọn
        detailContainer.addEventListener('click', (e) => {
            const btnSelectAll = e.target.closest('#btn-export-select-all');
            const btnDeselectAll = e.target.closest('#btn-export-deselect-all');
            
            if (btnSelectAll || btnDeselectAll) {
                const state = !!btnSelectAll;
                const checkboxes = document.querySelectorAll('.export-file-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = state;
                });
            }
        });

        // 12. Xử lý nút tải xuống ZIP hồ sơ hoàn thiện duy nhất
        detailContainer.addEventListener('click', (e) => {
            const btnSubmit = e.target.closest('#btn-submit-export');
            if (btnSubmit) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || activeProfile.files.length === 0) return;

                // Lấy chế độ xuất đang active
                const activeCard = document.querySelector('.export-card.active');
                if (!activeCard) return;
                
                const mode = activeCard.getAttribute('data-mode');
                let url = `${AppStore.API_BASE}/profiles/${activeProfile.id}/export?mode=${mode}`;

                if (mode === 'edited') {
                    const editedFiles = activeProfile.files.filter(f => f.currentContent !== f.originalContent);
                    if (editedFiles.length === 0) {
                        showToast("Chưa có tài liệu nào được chỉnh sửa trong hồ sơ này.", "danger");
                        return;
                    }
                } else if (mode === 'custom') {
                    const checkedBoxes = document.querySelectorAll('.export-file-checkbox:checked');
                    if (checkedBoxes.length === 0) {
                        showToast("Vui lòng tích chọn ít nhất một tài liệu để tải về.", "danger");
                        return;
                    }
                    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value).join(',');
                    url += `&fileIds=${selectedIds}`;
                }

                // Tải file qua Fetch API dưới dạng Blob để tránh làm gián đoạn trạng thái trang web
                showToast("Đang đóng gói tài liệu và chuẩn bị tải về...", "success");

                fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error("Không thể tải file xuất bản từ server.");
                        return response.blob();
                    })
                    .then(blob => {
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `${activeProfile.name}_export.zip`;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                    })
                    .catch(err => {
                        console.error("Lỗi xuất file:", err);
                        showToast("Lỗi khi tải xuống hồ sơ: " + err.message, "danger");
                    });
            }
        });
    }
}

/**
 * Thực hiện tìm kiếm cụm từ trong các tệp của hồ sơ hiện tại
 */
function triggerTextSearch() {
    const activeProfile = AppStore.getActiveProfile();
    if (!activeProfile) return;

    const searchInput = document.getElementById('search-phrase-input');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query === "") {
        showToast("Vui lòng nhập cụm từ tìm kiếm.", "info");
        return;
    }

    // Lưu từ khóa tìm kiếm tích cực
    currentSearchQuery = query;

    // Chuẩn hóa Unicode NFC và rút gọn khoảng trắng để so sánh chính xác hơn (chấp nhận khoảng trắng kép/xuống dòng)
    const cleanString = (str) => (str || '').normalize('NFC').replace(/\s+/g, ' ');
    const normalizedQuery = cleanString(query);
    const matchingFiles = activeProfile.files.filter(file => 
        cleanString(file.currentContent).includes(normalizedQuery) ||
        cleanString(file.originalContent).includes(normalizedQuery)
    );

    // Render bảng kết quả
    Components.renderSearchResults(query, matchingFiles);

    // Hiện nút Hủy tìm kiếm
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (btnClearSearch) btnClearSearch.classList.remove('hidden');

    // Cập nhật highlight từ khóa đang tìm kiếm tạm thời trong Preview
    if (activeProfile.files && activeProfile.files.length > 0) {
        // Đảm bảo Preview section hiển thị
        const previewSection = document.getElementById('card-preview-section');
        if (previewSection) {
            previewSection.classList.remove('hidden');
            
            // Cập nhật dropdown để chỉ hiển thị các tài liệu chứa cụm từ tìm kiếm
            const selectPreview = document.getElementById('select-preview-file');
            if (selectPreview) {
                const targetFiles = matchingFiles.length > 0 ? matchingFiles : activeProfile.files;
                selectPreview.innerHTML = targetFiles.map((file, idx) => `
                    <option value="${file.id}" ${idx === 0 ? 'selected' : ''}>${file.name}</option>
                `).join('');
            }
            
            // Chọn file khớp đầu tiên để xem trước
            const defaultFile = matchingFiles[0] || activeProfile.files[0];
            if (defaultFile) {
                Components.updateFilePreview(defaultFile, activeProfile, currentSearchQuery);
            }
        }
    }
}

/**
 * Xử lý danh sách file được tải lên (từ input hoặc kéo thả dropzone)
 */
async function handleUploadedFiles(filesList) {
    const activeProfile = AppStore.getActiveProfile();
    if (!activeProfile) return;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const fileExtension = file.name.split('.').pop().toLowerCase();

        try {
            let content;
            if (fileExtension === 'docx') {
                // Đọc file docx dưới dạng Base64 để backend tự giải nén và trích xuất
                content = await readFileAsDataURL(file);
            } else if (fileExtension === 'doc') {
                // Tệp .doc cũ sinh dữ liệu giả lập sạch
                content = generateSimulatedContent(file.name);
            } else {
                // Các tệp text thông thường
                content = await readFileAsText(file);
            }

            await AppStore.addFileToProfile(activeProfile.id, {
                name: file.name,
                size: file.size,
                content: content
            });
            successCount++;
        } catch (err) {
            errorCount++;
            console.error(err);
        }
    }

    if (successCount > 0) {
        showToast(`Đã thêm thành công ${successCount} tài liệu vào hồ sơ.`, 'success');
        renderProfiles();
        renderActiveProfile();
    }
    if (errorCount > 0) {
        showToast(`Không thể thêm ${errorCount} file do trùng tên trong hệ thống.`, 'danger');
    }
}

/**
 * Hàm hỗ trợ đọc file nhị phân dạng Base64 Data URL
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Không thể đọc file: ${file.name}`));
        reader.readAsDataURL(file);
    });
}

/**
 * Hàm hỗ trợ đọc file dạng Text bất đồng bộ
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result || "");
        reader.onerror = () => reject(new Error(`Không thể đọc file: ${file.name}`));
        reader.readAsText(file);
    });
}

/**
 * Hàm tạo nội dung giả lập động dựa trên tên file (Dùng cho tệp .doc)
 */
function generateSimulatedContent(filename) {
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
        hash = (hash * 31 + filename.charCodeAt(i)) % 1000;
    }
    
    // Tạo nội dung mẫu không chứa tag [RED] để người dùng tự tìm kiếm
    return `TÀI LIỆU CHỨNG TỪ THANH TOÁN (GIẢ LẬP)
Tên tài liệu gốc: ${filename}
---
Đơn vị đề nghị thanh toán: Công ty Cổ phần Công nghệ thông tin Phương Nam
Mã số thuế: 0100686209-009
Địa chỉ Bên thụ hưởng: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ
Tài khoản thụ hưởng: 0111000234xxx tại Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank)
Số tiền quyết toán: 120.000.000 VNĐ

Nội dung thanh toán: Chi phí thực hiện dịch vụ bảo trì kỹ thuật và hạ tầng viễn thông cho MobiFone Cần Thơ quý I năm 2026.
Kính mong Ban Giám đốc MobiFone phê duyệt quyết toán.`;
}

/**
 * Render danh sách hồ sơ ở Sidebar
 */
function renderProfiles() {
    const profiles = AppStore.getProfiles();
    const activeId = AppStore.state.activeProfileId;
    Components.renderProfileList(profiles, activeId);
}

/**
 * Render chi tiết hồ sơ được chọn ở khung nội dung chính
 */
function renderActiveProfile() {
    const activeProfile = AppStore.getActiveProfile();
    Components.renderProfileDetail(activeProfile, currentSearchQuery);

    // Duy trì hiển thị nút Hủy tìm kiếm nếu đang có từ khóa tìm kiếm tích cực
    if (currentSearchQuery) {
        const btnClearSearch = document.getElementById('btn-clear-search');
        if (btnClearSearch) btnClearSearch.classList.remove('hidden');
        
        const searchInput = document.getElementById('search-phrase-input');
        if (searchInput) searchInput.value = currentSearchQuery;
    }

    // Nếu hồ sơ có replacements (chỉnh sửa) hoặc đang có từ khóa tìm kiếm tích cực
    const hasReplacements = activeProfile && activeProfile.replacements && activeProfile.replacements.length > 0;
    
    if (activeProfile && (hasReplacements || currentSearchQuery)) {
        const previewSection = document.getElementById('card-preview-section');
        if (previewSection) {
            previewSection.classList.remove('hidden');
            
            if (activeProfile.files && activeProfile.files.length > 0) {
                // Lấy file đang chọn hoặc mặc định là file đầu tiên
                const selectPreview = document.getElementById('select-preview-file');
                const fileId = selectPreview ? selectPreview.value : activeProfile.files[0].id;
                const file = activeProfile.files.find(f => f.id === fileId) || activeProfile.files[0];
                Components.updateFilePreview(file, activeProfile, currentSearchQuery);
            }
        }
    }
}

/**
 * Hiển thị thông báo Toast nhanh góc màn hình
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'danger') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    safeCreateIcons();

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3200);
}
