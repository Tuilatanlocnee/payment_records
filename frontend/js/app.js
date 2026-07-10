/**
 * ==========================================================================
 * MAIN APP CONTROLLER - ĐIỀU PHỐI VÀ LIÊN KẾT LOGIC GIAO DIỆN TÌM KIẾM
 * ==========================================================================
 */

let currentSearchQuery = "";

// Trạng thái đóng/mở của các phân vùng giao diện
window.AppWorkspaceState = {
    activeTab: 'preview', // Mặc định hiển thị tab Tài liệu khi vừa mở hồ sơ
    previewRowIndex: 1      // Dòng bản ghi xem trước mặc định
};

const startAppDirectly = async () => {
    // Khởi tạo các icons ngay khi tải trang
    if (window.safeCreateIcons) {
        window.safeCreateIcons();
    }

    const loadingOverlay = document.getElementById('app-loading-overlay');

    // 1. Hiển thị màn hình đánh thức server
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    // 2. Gọi API đánh thức server và tải dữ liệu
    try {
        await AppStore.init();
    } catch (e) {
        showToast("Lỗi kết nối Backend API. Vui lòng đảm bảo Backend đã chạy.", "danger");
    } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    // 3. Khởi động Workspace chính (gắn các sự kiện)
    initApp();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAppDirectly);
} else {
    startAppDirectly();
}

/**
 * Khởi tạo các sự kiện và hiển thị ban đầu
 */
function initApp() {
    // Xác định tab mặc định có chứa hồ sơ để kích hoạt ban đầu
    const profiles = AppStore.getProfiles();
    let defaultTab = 'edited';

    if (profiles.length > 0) {
        const hasEdited = profiles.some(p => (p.type || 'edited') === 'edited');
        const hasOriginal = profiles.some(p => p.type === 'original');
        const hasMailMerge = profiles.some(p => p.type === 'mailmerge');

        if (hasEdited) {
            defaultTab = 'edited';
        } else if (hasOriginal) {
            defaultTab = 'original';
        } else if (hasMailMerge) {
            defaultTab = 'mailmerge';
        }
    }

    // Lưu và kích hoạt tab mặc định này
    AppStore.state.activeTab = defaultTab;
    const activeTabBtn = document.querySelector(`.sidebar-tab[data-type="${defaultTab}"]`);
    if (activeTabBtn) {
        activeTabBtn.classList.add('active');
    }

    // Render danh sách hồ sơ ban đầu của tab active
    renderProfiles();

    // Tự động hiển thị chi tiết hồ sơ active (nếu có)
    renderActiveProfile();

    // Sự kiện click vào logo MobiFone để quay về trang chủ (chưa chọn hồ sơ nào)
    const logoContainer = document.querySelector('.logo-container');
    if (logoContainer) {
        logoContainer.style.cursor = 'pointer';
        logoContainer.addEventListener('click', async () => {
            try {
                currentSearchQuery = ""; // Reset từ khóa tìm kiếm
                await AppStore.setActiveProfile(null);

                // Tắt các tab active và đóng dropdown
                document.querySelectorAll('.sidebar-tab').forEach(t => {
                    t.classList.remove('active');
                    t.classList.remove('open');
                });
                const dropdownMenu = document.getElementById('profile-dropdown-menu');
                if (dropdownMenu) dropdownMenu.classList.add('hidden');

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

    // Sự kiện click tạo mới trực tiếp hoặc xem danh sách từ Empty State
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.addEventListener('click', (e) => {
            const btnDirect = e.target.closest('.btn-direct-create');
            const btnOpenDropdown = e.target.closest('.btn-open-dropdown-direct');

            if (btnDirect) {
                e.preventDefault();
                e.stopPropagation();
                const id = btnDirect.id;
                const btnCreateProfile = document.getElementById('btn-create-profile');
                if (btnCreateProfile) {
                    // Mở modal tạo mới
                    btnCreateProfile.click();

                    // Thiết lập type tương ứng trong modal
                    const typeSelect = document.getElementById('profile-type-select');
                    if (typeSelect) {
                        if (id === 'btn-create-mailmerge-direct') {
                            typeSelect.value = 'mailmerge';
                        } else if (id === 'btn-create-original-direct') {
                            typeSelect.value = 'original';
                        } else {
                            typeSelect.value = 'edited';
                        }
                        // Trigger change để cập nhật nhãn trong modal
                        typeSelect.dispatchEvent(new Event('change'));
                    }
                }
            } else if (btnOpenDropdown) {
                e.preventDefault();
                e.stopPropagation(); // NGĂN NỔI BỌT LÊN DOCUMENT!

                // Mở dropdown chọn hồ sơ của tab đang active
                const activeTab = document.querySelector('.sidebar-tab.active');
                if (activeTab) {
                    activeTab.click(); // Trigger click tab để mở dropdown
                }
            }
        });
    }

    // Đăng ký sự kiện click tab phân loại mở dropdown
    const handleTabSwitch = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const tabBtn = e.target.closest('.sidebar-tab');
        if (!tabBtn) return;

        const type = tabBtn.getAttribute('data-type');

        // Reset các tab khác
        document.querySelectorAll('.sidebar-tab').forEach(t => {
            if (t !== tabBtn) {
                t.classList.remove('active');
                t.classList.remove('open');
            }
        });

        const dropdownMenu = document.getElementById('profile-dropdown-menu');
        if (dropdownMenu) {
            // Nếu tab đã active và dropdown đang mở -> đóng dropdown
            if (tabBtn.classList.contains('active') && !dropdownMenu.classList.contains('hidden')) {
                dropdownMenu.classList.add('hidden');
                tabBtn.classList.remove('open');
            } else {
                // Ngược lại -> mở dropdown định vị bên dưới tab
                tabBtn.classList.add('active');
                tabBtn.classList.add('open');

                // Cập nhật local state của AppStore về active tab
                AppStore.state.activeTab = type;

                // Render danh sách hồ sơ tương ứng
                renderProfiles();

                // Định vị dropdown ngay dưới tab click
                const rect = tabBtn.getBoundingClientRect();
                const parentRect = document.querySelector('.header-center-selector').getBoundingClientRect();
                if (parentRect) {
                    dropdownMenu.style.left = `${rect.left - parentRect.left}px`;
                }
                dropdownMenu.classList.remove('hidden');
            }
        }
    };

    const tabEdited = document.getElementById('tab-edited-profiles');
    const tabOriginal = document.getElementById('tab-original-profiles');
    const tabMailMerge = document.getElementById('tab-mailmerge-profiles');

    if (tabEdited) tabEdited.addEventListener('click', handleTabSwitch);
    if (tabOriginal) tabOriginal.addEventListener('click', handleTabSwitch);
    if (tabMailMerge) tabMailMerge.addEventListener('click', handleTabSwitch);

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

            // Nạp danh sách các hồ sơ gốc làm template
            const originalProfiles = AppStore.getProfiles().filter(p => p.type === 'original');
            const templateSelect = document.getElementById('profile-template-select');
            if (templateSelect) {
                templateSelect.innerHTML = '<option value="">-- Không sao chép (Bắt đầu trống) --</option>' +
                    originalProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            }

            // Mặc định ẩn/hiện chọn nguồn
            const typeSelect = document.getElementById('profile-type-select');
            const templateGroup = document.getElementById('template-profile-group');
            if (typeSelect && templateGroup) {
                typeSelect.value = 'edited';
                // Trigger change event to reset labels
                typeSelect.dispatchEvent(new Event('change'));
            }
        });

        // Ẩn/hiện chọn nguồn hồ sơ mẫu và đổi nhãn động dựa theo loại hồ sơ đang tạo
        const typeSelect = document.getElementById('profile-type-select');
        const templateGroup = document.getElementById('template-profile-group');
        const nameLabel = document.querySelector('label[for="profile-name-input"]');
        const nameHelp = document.getElementById('profile-name-help') || document.querySelector('.form-help');
        const modalTitle = document.querySelector('.modal-header h3');

        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const val = typeSelect.value;
                if (val === 'original' || val === 'mailmerge') {
                    if (templateGroup) templateGroup.classList.add('hidden');
                } else {
                    if (templateGroup) templateGroup.classList.remove('hidden');
                }

                // Cập nhật nhãn động
                if (val === 'mailmerge') {
                    if (nameLabel) nameLabel.innerHTML = 'Tên Tệp Mail Merge <span class="required">*</span>';
                    if (profileNameInput) profileNameInput.placeholder = 'Nhập tên Tệp Mail Merge (ví dụ: Thông tin Hợp đồng quý I)...';
                    if (nameHelp) {
                        nameHelp.id = 'profile-name-help';
                        nameHelp.textContent = 'Đặt tên gợi nhớ đến bộ biến Mail Merge.';
                    }
                    if (modalTitle) modalTitle.textContent = 'TẠO TỆP MAIL MERGE MỚI';
                } else if (val === 'original') {
                    if (nameLabel) nameLabel.innerHTML = 'Tên Hồ sơ gốc <span class="required">*</span>';
                    if (profileNameInput) profileNameInput.placeholder = 'Nhập tên Hồ sơ gốc...';
                    if (nameHelp) {
                        nameHelp.id = 'profile-name-help';
                        nameHelp.textContent = 'Đặt tên cho bộ tài liệu mẫu.';
                    }
                    if (modalTitle) modalTitle.textContent = 'TẠO HỒ SƠ GỐC MỚI';
                } else {
                    if (nameLabel) nameLabel.innerHTML = 'Tên hồ sơ thanh toán <span class="required">*</span>';
                    if (profileNameInput) profileNameInput.placeholder = 'Nhập tên hồ sơ thanh toán...';
                    if (nameHelp) {
                        nameHelp.id = 'profile-name-help';
                        nameHelp.textContent = 'Nên đặt tên gợi nhớ đến kỳ thanh toán hoặc nội dung chứng từ.';
                    }
                    if (modalTitle) modalTitle.textContent = 'TẠO HỒ SƠ THANH TOÁN MỚI';
                }
            });
        }

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
                const type = typeSelect ? typeSelect.value : 'edited';
                const originalProfileId = document.getElementById('profile-template-select').value || null;

                try {
                    const newProfile = await AppStore.createProfile(profileName, type, originalProfileId);
                    modalCreateProfile.classList.add('hidden');

                    // Chuyển tab tương ứng với loại hồ sơ vừa tạo để người dùng thấy ngay
                    if (type === 'original') {
                        if (tabOriginal) tabOriginal.click();
                    } else if (type === 'mailmerge') {
                        if (tabMailMerge) tabMailMerge.click();
                    } else {
                        if (tabEdited) tabEdited.click();
                    }

                    showToast(`Tạo thành công hồ sơ: "${newProfile.name}"`, 'success');
                    await AppStore.setActiveProfile(newProfile.id);
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

                // Reset trạng thái đóng/mở khi chuyển đổi giữa các hồ sơ
                if (window.AppWorkspaceState) {
                    window.AppWorkspaceState.activeTab = 'preview';
                }

                await AppStore.setActiveProfile(profileId);

                document.querySelectorAll('.profile-item').forEach(item => {
                    item.classList.remove('active');
                });
                profileItem.classList.add('active');

                renderActiveProfile();

                // Tự động đóng dropdown chọn hồ sơ
                const dropdownMenu = document.getElementById('profile-dropdown-menu');
                if (dropdownMenu) dropdownMenu.classList.add('hidden');
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('open'));
            }
        });
    }

    // Đăng ký các sự kiện tương tác trong màn hình Chi tiết Hồ sơ (Event Delegation trên container chính)
    const detailContainer = document.getElementById('profile-detail-container');
    if (detailContainer) {
        // Xử lý chuyển đổi giữa các Tab (Tab Bar Switcher)
        detailContainer.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.workspace-tab');
            if (tabBtn) {
                const targetTab = tabBtn.getAttribute('data-tab');
                if (window.AppWorkspaceState) {
                    if (window.AppWorkspaceState.activeTab === targetTab) {
                        // Nếu bấm lại tab đang mở -> Thu gọn (collapse)
                        window.AppWorkspaceState.activeTab = null;
                    } else {
                        // Mở tab mới được chọn
                        window.AppWorkspaceState.activeTab = targetTab;
                    }
                }
                renderActiveProfile();
            }
        });

        // ==========================================
        // CÁC SỰ KIỆN PHẦN MỚI (MAIL MERGE, EDITOR, IMAGES)
        // ==========================================

        // A. QUẢN LÝ BIẾN MAIL MERGE THEO NHÓM (GROUPS)
        // 0. Kết nối/Ngắt kết nối Tệp Mail Merge live
        detailContainer.addEventListener('change', async (e) => {
            const selectMM = e.target.closest('#select-mail-merge-connect');
            if (selectMM) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;

                const mailMergeId = selectMM.value;
                try {
                    const res = await AppStore.connectMailMerge(activeProfile.id, mailMergeId);
                    if (res && res.files) {
                        activeProfile.files = res.files;
                    }
                    // Cập nhật thuộc tính mailMergeId và variables trong state local
                    activeProfile.mailMergeId = res.mailMergeId;
                    activeProfile.variables = res.variables;

                    if (mailMergeId) {
                        showToast("Đã kết nối thành công tới Tệp Mail Merge và đồng bộ các biến!", "success");
                    } else {
                        showToast("Đã ngắt kết nối Tệp Mail Merge.", "success");
                    }
                    renderActiveProfile();
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }

            // Xử lý thay đổi dòng dữ liệu xem trước
            const selectRow = e.target.closest('#select-preview-row');
            if (selectRow) {
                if (window.AppWorkspaceState) {
                    window.AppWorkspaceState.previewRowIndex = parseInt(selectRow.value) || 1;
                }

                // Đồng bộ hiển thị lại văn bản xem trước theo dòng dữ liệu mới
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile && activeProfile.files && activeProfile.files.length > 0) {
                    const selectPreviewFile = document.getElementById('select-preview-file');
                    const fileId = selectPreviewFile ? selectPreviewFile.value : activeProfile.files[0].id;
                    const fileObj = activeProfile.files.find(f => f.id === fileId);
                    if (fileObj) {
                        Components.updateFilePreview(fileObj, activeProfile, "");
                    }
                }
            }
        });

        // 1. Tạo mục biến Mail Merge mới
        detailContainer.addEventListener('click', async (e) => {
            const btnCreateGroup = e.target.closest('#btn-create-group');
            if (btnCreateGroup) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;

                const groupName = prompt("Nhập tên mục Mail Merge mới (ví dụ: Thông tin MobiFone, Chi tiết Hợp đồng):");
                if (!groupName || groupName.trim() === "") return;

                const nameTrimmed = groupName.trim();
                const updatedVariables = [...(activeProfile.variables || [])];

                // Kiểm tra trùng nhóm
                const hasGroup = updatedVariables.some(v => (v.group || 'Chung') === nameTrimmed);
                if (hasGroup) {
                    showToast(`Mục "${nameTrimmed}" đã tồn tại.`, "warning");
                    return;
                }

                // Tự động sinh tên trường từ tên nhóm (viết hoa, không dấu, không ký tự đặc biệt)
                let defaultFieldName = nameTrimmed.toUpperCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
                    .replace(/\s+/g, '_')
                    .replace(/[^A-Z0-9_]/g, '');

                if (!defaultFieldName || defaultFieldName === "") {
                    defaultFieldName = "TRUONG_MAU";
                }

                let finalFieldName = defaultFieldName;
                let fieldCount = 1;
                while (updatedVariables.some(v => v.name === finalFieldName)) {
                    fieldCount++;
                    finalFieldName = `${defaultFieldName}_${fieldCount}`;
                }

                updatedVariables.push({
                    name: finalFieldName,
                    value: "",
                    group: nameTrimmed
                });

                try {
                    await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                    showToast(`Đã tạo mục "${nameTrimmed}" thành công!`, "success");
                    renderActiveProfile();
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });

        // 2. Thêm trường mới vào mục cụ thể
        detailContainer.addEventListener('click', async (e) => {
            const btnAddField = e.target.closest('.btn-add-field-to-group');
            if (btnAddField) {
                const groupName = btnAddField.getAttribute('data-group');
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || !groupName) return;

                const updatedVariables = [...(activeProfile.variables || [])];

                // Sinh tên trường tự động không trùng
                let count = 1;
                let newFieldName = `TRUONG_MOI_${count}`;
                while (updatedVariables.some(v => v.name === newFieldName)) {
                    count++;
                    newFieldName = `TRUONG_MOI_${count}`;
                }

                updatedVariables.push({
                    name: newFieldName,
                    value: "",
                    group: groupName
                });

                try {
                    await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                    showToast("Đã thêm trường mới. Hãy sửa tên trường và nhập giá trị.", "success");
                    renderActiveProfile();
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });

        // 3. Xóa toàn bộ một mục (và tất cả biến thuộc mục đó)
        detailContainer.addEventListener('click', async (e) => {
            const btnDeleteGroup = e.target.closest('.btn-delete-group');
            if (btnDeleteGroup) {
                const groupName = btnDeleteGroup.getAttribute('data-group');
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || !groupName) return;

                if (confirm(`Bạn có chắc chắn muốn xóa mục "${groupName}" và TẤT CẢ các trường bên trong không?`)) {
                    const updatedVariables = (activeProfile.variables || []).filter(v => (v.group || 'Chung') !== groupName);

                    try {
                        await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                        showToast(`Đã xóa mục "${groupName}" thành công.`, "success");
                        renderActiveProfile();
                    } catch (err) {
                        showToast(err.message, "danger");
                    }
                }
            }
        });

        // 4. Sửa tên mục Mail Merge (Đổi tên nhóm biến khi blur contenteditable)
        detailContainer.addEventListener('blur', async (e) => {
            const titleSpan = e.target.closest('.group-title-text');
            if (titleSpan) {
                const oldGroupName = titleSpan.getAttribute('data-original-group');
                const newGroupName = titleSpan.textContent.trim();
                const activeProfile = AppStore.getActiveProfile();

                if (!activeProfile || !oldGroupName || newGroupName === "") {
                    titleSpan.textContent = oldGroupName; // Khôi phục nếu rỗng
                    return;
                }

                if (oldGroupName === newGroupName) return; // Không thay đổi

                const updatedVariables = [...(activeProfile.variables || [])];

                // Kiểm tra trùng nhóm mới
                const isDuplicate = updatedVariables.some(v => v.group === newGroupName && v.group !== oldGroupName);
                if (isDuplicate) {
                    showToast(`Mục "${newGroupName}" đã tồn tại.`, "warning");
                    titleSpan.textContent = oldGroupName;
                    return;
                }

                // Cập nhật group cho các biến
                updatedVariables.forEach(v => {
                    if ((v.group || 'Chung') === oldGroupName) {
                        v.group = newGroupName;
                    }
                });

                try {
                    await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                    showToast(`Đã đổi tên mục thành "${newGroupName}"!`, "success");
                    renderActiveProfile();
                } catch (err) {
                    showToast(err.message, "danger");
                    titleSpan.textContent = oldGroupName;
                }
            }
        }, true); // Sử dụng capture phase để bắt blur trên contenteditable

        // 5. Xóa một trường Mail Merge khỏi danh mục
        detailContainer.addEventListener('click', async (e) => {
            const btnDeleteVar = e.target.closest('.btn-delete-variable');
            if (btnDeleteVar) {
                e.stopPropagation();
                const varName = btnDeleteVar.getAttribute('data-name');
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || !varName) return;

                if (confirm(`Bạn có chắc chắn muốn xóa trường "${varName}" này không?`)) {
                    const updatedVariables = (activeProfile.variables || []).filter(v => v.name !== varName);

                    try {
                        await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                        showToast(`Đã xóa trường "${varName}" thành công.`, "success");
                        renderActiveProfile();
                    } catch (err) {
                        showToast(err.message, "danger");
                    }
                }
            }
        });

        // 6. Sửa tên trường (Key) hoặc Giá trị (Value) của trường Mail Merge
        detailContainer.addEventListener('change', async (e) => {
            const varInput = e.target.closest('.var-key-input, .var-val-input');
            if (varInput) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;

                const row = varInput.closest('.variable-row');
                if (!row) return;

                const originalName = row.getAttribute('data-name');
                const groupName = row.getAttribute('data-group');
                const keyInput = row.querySelector('.var-key-input');
                const valInput = row.querySelector('.var-val-input');

                const updatedVariables = [...(activeProfile.variables || [])];
                const vIdx = updatedVariables.findIndex(v => v.name === originalName);

                if (vIdx === -1) return;

                if (varInput.classList.contains('var-key-input')) {
                    // Chuẩn hóa tên biến: chữ hoa, không dấu, thay thế khoảng trắng bằng dấu gạch dưới
                    let keyVal = keyInput.value.toUpperCase().trim()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
                        .replace(/\s+/g, '_')
                        .replace(/[^A-Z0-9_]/g, '');

                    keyInput.value = keyVal;

                    if (!keyVal || keyVal === "") {
                        showToast("Tên trường không được để trống.", "warning");
                        keyInput.value = originalName;
                        return;
                    }

                    // Kiểm tra trùng lặp tên trường
                    const isDuplicate = updatedVariables.some((v, idx) => v.name === keyVal && idx !== vIdx);
                    if (isDuplicate) {
                        showToast(`Trường "${keyVal}" đã tồn tại trong hồ sơ.`, "warning");
                        keyInput.value = originalName;
                        return;
                    }

                    // Cập nhật tên biến
                    updatedVariables[vIdx].name = keyVal;
                    row.setAttribute('data-name', keyVal);
                } else {
                    // Cập nhật giá trị biến
                    updatedVariables[vIdx].value = valInput.value;
                }

                try {
                    const res = await AppStore.updateProfileVariables(activeProfile.id, updatedVariables);
                    if (res && res.files) {
                        activeProfile.files = res.files;
                    }
                    showToast("Đã cập nhật trường & đồng bộ sang các tài liệu!", "success");
                    renderActiveProfile();
                } catch (err) {
                    showToast("Lỗi đồng bộ: " + err.message, "danger");
                }
            }
        });

        // 7. Tạo trường Mail Merge trực tiếp tại vị trí con trỏ chuột đã được gỡ bỏ

        // 4. Excel Import biến Mail Merge (Click mở file dialog)
        detailContainer.addEventListener('click', (e) => {
            const zone = e.target.closest('#excel-dropzone');
            if (zone && e.target.tagName !== 'INPUT') {
                const fileInput = document.getElementById('excel-input-hidden');
                if (fileInput) fileInput.click();
            }
        });

        // 5. Chọn file Excel
        detailContainer.addEventListener('change', (e) => {
            const fileInput = e.target.closest('#excel-input-hidden');
            if (fileInput && fileInput.files.length > 0) {
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile) {
                    handleExcelImport(fileInput.files[0], activeProfile.id);
                    fileInput.value = ''; // Reset value to allow uploading same file again
                }
            }
        });

        // 6. Excel Drag & Drop
        detailContainer.addEventListener('dragover', (e) => {
            const zone = e.target.closest('#excel-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--success-color)';
                zone.style.backgroundColor = 'var(--success-light)';
            }
        });
        detailContainer.addEventListener('dragleave', (e) => {
            const zone = e.target.closest('#excel-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--border-color)';
                zone.style.backgroundColor = '#ffffff';
            }
        });
        detailContainer.addEventListener('drop', (e) => {
            const zone = e.target.closest('#excel-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--border-color)';
                zone.style.backgroundColor = '#ffffff';
                if (e.dataTransfer.files.length > 0) {
                    const activeProfile = AppStore.getActiveProfile();
                    if (activeProfile) {
                        handleExcelImport(e.dataTransfer.files[0], activeProfile.id);
                    }
                }
            }
        });

        // B. TRÌNH BIÊN TẬP VĂN BẢN RICH TEXT
        // 1. Thao tác định dạng văn bản (Bold, Italic, Underline)
        detailContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.toolbar-btn');
            if (btn) {
                e.preventDefault();
                const command = btn.getAttribute('data-command');
                document.execCommand(command, false, null);
                btn.classList.toggle('active');

                const editor = document.getElementById('preview-content-edited');
                if (editor) editor.focus();
            }
        });

        // 2. Thay đổi Phông chữ & Cỡ chữ
        detailContainer.addEventListener('change', (e) => {
            const select = e.target.closest('.font-name-select, .font-size-select');
            if (select) {
                const command = select.classList.contains('font-name-select') ? 'fontName' : 'fontSize';
                document.execCommand(command, false, select.value);

                const editor = document.getElementById('preview-content-edited');
                if (editor) editor.focus();
            }
        });

        // 3. Thay đổi màu chữ
        detailContainer.addEventListener('input', (e) => {
            const picker = e.target.closest('.toolbar-color-picker');
            if (picker) {
                document.execCommand('foreColor', false, picker.value);

                const editor = document.getElementById('preview-content-edited');
                if (editor) editor.focus();
            }

            // Tự động điều chỉnh chiều cao của textarea khi người dùng gõ phím
            const textarea = e.target.closest('.var-val-input.field-value-input');
            if (textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        });

        // 4. Click chèn biến Mail Merge từ thanh công cụ
        detailContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-insert-merge-field-trigger');
            if (btn) {
                e.preventDefault();
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;

                saveSelectionRange();
                const rect = btn.getBoundingClientRect();
                showMailMergeMenu(rect.left, rect.bottom + window.scrollY, activeProfile.variables);
            }
        });

        // 4.1. Click Tạo trường Mail Merge tương tác từ văn bản bôi đen đã được gỡ bỏ

        // 5. Chuột phải bên trong Editor để hiện menu chèn nhanh biến
        detailContainer.addEventListener('contextmenu', (e) => {
            const editor = e.target.closest('#preview-content-edited');
            if (editor) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || (activeProfile.variables || []).length === 0) return;

                e.preventDefault();
                saveSelectionRange();
                showMailMergeMenu(e.pageX, e.pageY, activeProfile.variables);
            }
        });

        // 6. Theo dõi sự kiện gõ phím / thay đổi trong Editor
        detailContainer.addEventListener('input', (e) => {
            const editor = e.target.closest('#preview-content-edited');
            if (editor) {
                // Tự động lưu hoặc ghi nhận có thay đổi
            }
        });

        // 7. Tự động lưu tài liệu khi Editor mất focus (blur)
        detailContainer.addEventListener('blur', (e) => {
            const editor = e.target.closest('#preview-content-edited');
            if (editor) {
                saveEditorContent();
            }
        }, true);

        // C. BỘ SƯU TẬP HÌNH ẢNH MINH CHỨNG
        // 1. Click mở file dialog chọn ảnh
        detailContainer.addEventListener('click', (e) => {
            const zone = e.target.closest('#images-dropzone');
            if (zone && e.target.tagName !== 'INPUT') {
                const fileInput = document.getElementById('images-input-hidden');
                if (fileInput) fileInput.click();
            }
        });

        // 2. Chọn hình ảnh
        detailContainer.addEventListener('change', (e) => {
            const fileInput = e.target.closest('#images-input-hidden');
            if (fileInput && fileInput.files.length > 0) {
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile) {
                    handleImagesUpload(fileInput.files, activeProfile.id);
                    fileInput.value = ''; // Reset value to allow uploading same file again
                }
            }
        });

        // 3. Ảnh Drag & Drop
        detailContainer.addEventListener('dragover', (e) => {
            const zone = e.target.closest('#images-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--primary-color)';
                zone.style.backgroundColor = 'var(--primary-light)';
            }
        });
        detailContainer.addEventListener('dragleave', (e) => {
            const zone = e.target.closest('#images-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = '#cbd5e1';
                zone.style.backgroundColor = '#f8fafc';
            }
        });
        detailContainer.addEventListener('drop', (e) => {
            const zone = e.target.closest('#images-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = '#cbd5e1';
                zone.style.backgroundColor = '#f8fafc';
                if (e.dataTransfer.files.length > 0) {
                    const activeProfile = AppStore.getActiveProfile();
                    if (activeProfile) {
                        handleImagesUpload(e.dataTransfer.files, activeProfile.id);
                    }
                }
            }
        });

        // 4. Xóa hình ảnh minh chứng
        detailContainer.addEventListener('click', async (e) => {
            const btnDeleteImg = e.target.closest('.image-item-delete-btn');
            if (btnDeleteImg) {
                e.stopPropagation();
                const imageId = btnDeleteImg.getAttribute('data-image-id');
                const profileId = btnDeleteImg.getAttribute('data-profile-id');
                if (confirm("Bạn có chắc chắn muốn xóa ảnh minh chứng này không?")) {
                    try {
                        await AppStore.deleteImage(profileId, imageId);
                        showToast("Đã xóa ảnh minh chứng.", "success");
                        renderActiveProfile();
                    } catch (err) {
                        showToast(err.message, "danger");
                    }
                }
            }
        });

        // 5. Phóng to ảnh minh chứng bằng lightbox
        detailContainer.addEventListener('click', (e) => {
            const galleryItem = e.target.closest('.image-gallery-item');
            if (galleryItem && !e.target.closest('.image-item-delete-btn')) {
                const src = galleryItem.getAttribute('data-src');
                const name = galleryItem.getAttribute('data-name');
                showImageLightbox(src, name);
            }
        });

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

                // Cập nhật lại danh sách option preview đầy đủ và update file preview đầu tiên không có highlight search
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile && activeProfile.files && activeProfile.files.length > 0) {
                    const selectPreview = document.getElementById('select-preview-file');
                    if (selectPreview) {
                        selectPreview.innerHTML = activeProfile.files.map((file, idx) => `
                            <option value="${file.id}" ${idx === 0 ? 'selected' : ''}>${file.name}</option>
                        `).join('');
                    }
                    Components.updateFilePreview(activeProfile.files[0], activeProfile, "");
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
                fileInput.value = ''; // Reset value to allow uploading same file again
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

        // 8. Xử lý thay đổi file xem trước trong preview (Split Preview)
        detailContainer.addEventListener('change', (e) => {
            const select = e.target.closest('#select-preview-file');
            if (select) {
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile) return;
                const fileId = select.value;
                const file = activeProfile.files.find(f => f.id === fileId);
                if (file) {
                    Components.updateFilePreview(file, activeProfile, currentSearchQuery);
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

        // 12. Xử lý nút tải xuống ZIP hồ sơ hoàn thiện duy nhất bằng fetch + blob để có trạng thái chờ (loading)
        detailContainer.addEventListener('click', async (e) => {
            const btnSubmit = e.target.closest('#btn-submit-export');
            if (btnSubmit) {
                // Tránh xử lý trùng lặp nếu nút đang bị vô hiệu hóa
                if (btnSubmit.disabled) return;

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

                // Thiết lập trạng thái loading trên nút bấm để khóa click
                const originalBtnContent = btnSubmit.innerHTML;
                btnSubmit.disabled = true;
                btnSubmit.style.opacity = '0.75';
                btnSubmit.style.cursor = 'not-allowed';
                btnSubmit.innerHTML = `<span class="loading-spinner-btn" style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; margin-right: 8px; vertical-align: middle;"></span> Đang xuất bản...`;

                showToast("Hệ thống đang đóng gói và convert tài liệu (Word COM), vui lòng đợi...", "success");

                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        let errorMsg = "Không thể xuất bản hồ sơ.";
                        try {
                            const errData = await response.json();
                            if (errData && errData.error) errorMsg = errData.error;
                        } catch (_) { }
                        throw new Error(errorMsg);
                    }

                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);

                    // Tạo một thẻ link tải ảo và tự động click để tải file ZIP về
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = `${activeProfile.name}_export.zip`;
                    document.body.appendChild(a);
                    a.click();

                    // Giải phóng tài nguyên link tải
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(downloadUrl);

                    showToast("Đóng gói hồ sơ và tải về thành công!", "success");
                } catch (err) {
                    console.error("Lỗi khi tải file ZIP xuất bản:", err);
                    showToast(`Lỗi xuất bản: ${err.message}`, "danger");
                } finally {
                    // Khôi phục lại trạng thái ban đầu của nút bấm
                    btnSubmit.disabled = false;
                    btnSubmit.style.opacity = '1';
                    btnSubmit.style.cursor = 'pointer';
                    btnSubmit.innerHTML = originalBtnContent;
                    if (window.lucide && typeof window.lucide.createIcons === 'function') {
                        window.lucide.createIcons();
                    }
                }
            }
        });

        // 13. Đã loại bỏ xử lý hiển thị popover xem trước nội dung file khi click

        // 14. Sự kiện nhấp chọn Hồ sơ gốc khi chưa có file để sao chép
        detailContainer.addEventListener('click', async (e) => {
            const card = e.target.closest('.btn-copy-template-card');
            if (card) {
                const sourceId = card.getAttribute('data-source-id');
                const activeProfile = AppStore.getActiveProfile();
                if (!activeProfile || !sourceId) return;

                if (confirm("Hệ thống sẽ sao chép toàn bộ tài liệu từ hồ sơ gốc này sang hồ sơ hiện tại. Bạn có chắc chắn không?")) {
                    showToast("Đang sao chép các tài liệu mẫu...", "info");
                    try {
                        const updatedProfile = await AppStore.copyFilesFromOriginal(activeProfile.id, sourceId);
                        showToast(`Sao chép thành công ${updatedProfile.files.length} tài liệu từ hồ sơ gốc!`, "success");

                        // Render lại workspace để cập nhật giao diện
                        renderProfiles();
                        renderActiveProfile();
                    } catch (err) {
                        showToast("Lỗi sao chép: " + err.message, "danger");
                    }
                }
            }
        });

        // 15. Sự kiện tải file trực tiếp trên Dropzone phụ ở tab Tài liệu
        detailContainer.addEventListener('click', (e) => {
            const zone = e.target.closest('#preview-upload-dropzone');
            if (zone && e.target.tagName !== 'INPUT') {
                const fileInput = document.getElementById('preview-file-input-hidden');
                if (fileInput) fileInput.click();
            }
        });

        detailContainer.addEventListener('change', (e) => {
            const fileInput = e.target.closest('#preview-file-input-hidden');
            if (fileInput && fileInput.files.length > 0) {
                handleUploadedFiles(fileInput.files);
                fileInput.value = ''; // Reset
            }
        });

        // Kéo thả file trên Dropzone phụ ở tab Tài liệu
        detailContainer.addEventListener('dragover', (e) => {
            const zone = e.target.closest('#preview-upload-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--primary-color)';
                zone.style.backgroundColor = 'var(--primary-light)';
            }
        });

        detailContainer.addEventListener('dragleave', (e) => {
            const zone = e.target.closest('#preview-upload-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--border-color)';
                zone.style.backgroundColor = '#f8fafc';
            }
        });

        detailContainer.addEventListener('drop', (e) => {
            const zone = e.target.closest('#preview-upload-dropzone');
            if (zone) {
                e.preventDefault();
                zone.style.borderColor = 'var(--border-color)';
                zone.style.backgroundColor = '#f8fafc';
                if (e.dataTransfer.files.length > 0) {
                    handleUploadedFiles(e.dataTransfer.files);
                }
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
    if (window.AppWorkspaceState) {
        window.AppWorkspaceState.activeTab = 'search';
    }

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

    // Hiển thị trạng thái loading trực quan trên dropzone để người dùng biết hệ thống đang xử lý
    const dropzone = document.getElementById('file-dropzone');
    let originalHtml = "";
    if (dropzone) {
        originalHtml = dropzone.innerHTML;
        dropzone.style.pointerEvents = 'none'; // Khóa click tạm thời
        dropzone.innerHTML = `
            <span class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(0, 86, 158, 0.2); border-radius: 50%; border-top-color: var(--primary-color); animation: spin 1s ease-in-out infinite; margin-bottom: 8px;"></span>
            <p style="font-weight: 600; color: var(--primary-color); margin-bottom: 4px;">Đang tải lên và trích xuất tài liệu, vui lòng đợi...</p>
            <small style="color: var(--text-muted);">Hệ thống đang xử lý và đọc cấu trúc XML của file Word.</small>
        `;
    }

    // Thực hiện tải lên song song toàn bộ file bằng Promise.all để tăng tốc độ tối đa
    const uploadPromises = Array.from(filesList).map(async (file) => {
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'doc') {
            showToast(`Từ chối file "${file.name}": Hệ thống đã chuẩn hóa chỉ nhận file .docx. Vui lòng Save As sang .docx.`, 'danger');
            return { success: false, fileName: file.name, isDoc: true };
        }

        try {
            let content;
            if (fileExtension === 'docx') {
                // Đọc file docx dưới dạng Base64
                content = await readFileAsDataURL(file);
            } else {
                // Các tệp text thông thường
                content = await readFileAsText(file);
            }

            await AppStore.addFileToProfile(activeProfile.id, {
                name: file.name,
                size: file.size,
                content: content
            });
            return { success: true, fileName: file.name };
        } catch (err) {
            console.error(`Lỗi khi tải file ${file.name} lên server:`, err);
            return { success: false, fileName: file.name, isDoc: false };
        }
    });

    try {
        const results = await Promise.all(uploadPromises);

        let successCount = 0;
        let errorCount = 0;
        results.forEach(res => {
            if (res.success) {
                successCount++;
            } else if (!res.isDoc) {
                errorCount++;
            }
        });

        if (successCount > 0) {
            showToast(`Đã thêm thành công ${successCount} tài liệu vào hồ sơ.`, 'success');
            renderProfiles();
            renderActiveProfile();
        }
        if (errorCount > 0) {
            showToast(`Không thể thêm ${errorCount} file do trùng tên trong hệ thống hoặc lỗi mạng.`, 'danger');
        }
    } catch (globalErr) {
        console.error("Lỗi đồng bộ tải lên:", globalErr);
        showToast("Có lỗi xảy ra trong quá trình tải tài liệu lên.", "danger");
    } finally {
        // Khôi phục lại trạng thái ban đầu của dropzone
        if (dropzone) {
            dropzone.innerHTML = originalHtml;
            dropzone.style.pointerEvents = 'auto';
            safeCreateIcons();
        }
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

    // Đồng bộ chỉ báo hồ sơ đang chọn lên Header
    const indicatorEl = document.getElementById('active-profile-indicator');
    const nameEl = document.getElementById('active-profile-name');
    if (indicatorEl && nameEl) {
        if (activeProfile) {
            nameEl.textContent = activeProfile.name;
            indicatorEl.classList.remove('hidden');

            // Đánh dấu active đúng tab phân loại của hồ sơ đó
            document.querySelectorAll('.sidebar-tab').forEach(t => {
                if (t.getAttribute('data-type') === (activeProfile.type || 'edited')) {
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                }
            });
        } else {
            indicatorEl.classList.add('hidden');
        }
    }

    Components.renderProfileDetail(activeProfile, currentSearchQuery);

    // Thêm hoặc xóa class has-active-profile để phục vụ responsive trên mobile
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        if (activeProfile) {
            appContainer.classList.add('has-active-profile');
        } else {
            appContainer.classList.remove('has-active-profile');
        }
    }

    // Duy trì hiển thị nút Hủy tìm kiếm nếu đang có từ khóa tìm kiếm tích cực
    if (currentSearchQuery) {
        const btnClearSearch = document.getElementById('btn-clear-search');
        if (btnClearSearch) btnClearSearch.classList.remove('hidden');

        const searchInput = document.getElementById('search-phrase-input');
        if (searchInput) searchInput.value = currentSearchQuery;
    }

    // Cập nhật preview cho tệp đang hoạt động nếu hồ sơ có tệp tin
    if (activeProfile && activeProfile.files && activeProfile.files.length > 0) {
        // Lấy file đang chọn ở dropdown hoặc mặc định là file đầu tiên
        const selectPreview = document.getElementById('select-preview-file');
        const fileId = selectPreview ? selectPreview.value : activeProfile.files[0].id;
        const file = activeProfile.files.find(f => f.id === fileId) || activeProfile.files[0];
        Components.updateFilePreview(file, activeProfile, currentSearchQuery);
    }

    // Tự động giãn chiều cao cho các textarea biến Mail Merge
    adjustTextareaHeights();
}

/**
 * Tự động điều chỉnh chiều cao của tất cả textarea nhập giá trị biến Mail Merge
 */
function adjustTextareaHeights() {
    const textareas = document.querySelectorAll('.var-val-input.field-value-input');
    textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });
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
        toast.remove();
    }, 3200);
}

/**
 * ==========================================================================
 * CÁC HÀM TIỆN ÍCH CHO TÍNH NĂNG MỚI (MAIL MERGE, IMAGES, RICH TEXT EDITOR)
 * ==========================================================================
 */

/**
 * Xử lý import dữ liệu Excel/CSV Mail Merge ở Client
 * Hỗ trợ hai chế độ:
 * 1. Chế độ Bảng dữ liệu (Mail Merge chuẩn): Cột đầu là tiêu đề, các dòng tiếp theo là bản ghi
 * 2. Chế độ Danh sách (Key-Value): Cột 1 là Tên biến, Cột 2 là Giá trị
 */
function handleExcelImport(file, profileId) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!jsonData || jsonData.length === 0) {
                showToast("File Excel trống hoặc không có dữ liệu.", "danger");
                return;
            }

            // Lọc ra các dòng hợp lệ có dữ liệu
            const validRows = jsonData.filter(row => row && row.length > 0);
            if (validRows.length === 0) {
                showToast("Không tìm thấy dòng dữ liệu nào hợp lệ.", "danger");
                return;
            }

            const firstRow = validRows[0];

            // Nếu dòng đầu tiên có nhiều hơn 2 cột, đây là cấu trúc bảng (Mail Merge chuẩn)
            if (firstRow.length > 2) {
                const headers = firstRow.map(h => String(h || '').trim());
                const records = validRows.slice(1).filter(r => r && r.length > 0);

                if (records.length === 0) {
                    showToast("Bảng dữ liệu Excel không có dòng bản ghi nào dưới dòng tiêu đề.", "warning");
                    return;
                }

                const importedVars = [];

                // Duyệt qua toàn bộ các dòng bản ghi để nạp dữ liệu
                records.forEach((record, rIdx) => {
                    const rowNum = rIdx + 1; // Số thứ tự dòng bản ghi (1-based index)

                    // A. Duy trì ánh xạ cũ (Cột 1 làm Key, Cột 2 làm Value) để hỗ trợ tương thích ngược (Ví dụ: {{1}} -> HS-LHB-001)
                    if (record.length >= 2) {
                        const key = String(record[0]).trim();
                        const val = String(record[1]).trim();
                        if (key && !key.startsWith('#')) {
                            const cleanKey = key.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
                            if (cleanKey) {
                                importedVars.push({ name: cleanKey, value: val === 'undefined' ? '' : val });
                            }
                        }
                    }

                    // B. Ánh xạ tất cả các cột của dòng dữ liệu với hậu tố chỉ mục (Ví dụ: {{TEN_DON_VI_1}} -> Công ty TNHH Bánh Ngọt Mật Ong)
                    headers.forEach((h, colIdx) => {
                        const key = h;
                        const val = record[colIdx] !== undefined ? String(record[colIdx]).trim() : '';
                        if (key && !key.startsWith('#') && key.toLowerCase() !== 'tên biến' && key.toLowerCase() !== 'key') {
                            const cleanKey = `${key.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')}_${rowNum}`;
                            importedVars.push({ name: cleanKey, value: val === 'undefined' ? '' : val });
                        }
                    });
                });

                if (importedVars.length > 0) {
                    await saveImportedVariables(importedVars, profileId);
                } else {
                    showToast("Không trích xuất được biến nào từ bảng dữ liệu Excel.", "warning");
                }
            } else {
                // Định dạng danh sách Key-Value (Cột 1: Tên biến, Cột 2: Giá trị)
                const importedVars = [];
                for (const row of validRows) {
                    if (row && row.length >= 2) {
                        const key = String(row[0]).trim();
                        const val = String(row[1]).trim();
                        if (key && !key.startsWith('#') && key.toLowerCase() !== 'tên biến' && key.toLowerCase() !== 'key') {
                            const cleanKey = key.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
                            if (cleanKey) {
                                importedVars.push({ name: cleanKey, value: val === 'undefined' ? '' : val });
                            }
                        }
                    }
                }

                if (importedVars.length > 0) {
                    await saveImportedVariables(importedVars, profileId);
                } else {
                    showToast("Không tìm thấy biến hợp lệ nào trong file Excel danh sách.", "warning");
                }
            }
        } catch (err) {
            console.error("Lỗi khi đọc file Excel:", err);
            showToast(`Lỗi đọc Excel: ${err.message}`, "danger");
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Hiển thị modal để chọn dòng bản ghi từ file Excel dạng bảng Mail Merge
 */
function showRecordPickerModal(headers, records, onSelect) {
    const existing = document.getElementById('excel-record-picker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'excel-record-picker-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
    modal.style.zIndex = '10000';

    // Tìm các cột có khả năng mô tả tốt cho bản ghi
    const keyIndices = [];
    headers.forEach((h, idx) => {
        const lower = String(h).toLowerCase();
        if (lower.includes('mã') || lower.includes('ma') || lower.includes('tên') || lower.includes('ten') || lower.includes('stt') || lower.includes('đơn vị') || lower.includes('don vi')) {
            keyIndices.push(idx);
        }
    });

    if (keyIndices.length === 0) {
        keyIndices.push(0);
        if (headers.length > 1) keyIndices.push(1);
        if (headers.length > 2) keyIndices.push(2);
    }

    const optionsHtml = records.map((rec, rIdx) => {
        const descParts = keyIndices.map(idx => {
            const hName = headers[idx];
            const val = rec[idx] !== undefined ? rec[idx] : '';
            return `<strong>${hName}</strong>: ${val}`;
        });
        const desc = descParts.join(' | ');
        return `
            <div class="record-picker-option" data-index="${rIdx}" style="padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 8px; cursor: pointer; transition: all var(--transition-fast); background-color: #ffffff;">
                <div style="font-size: 13.5px; color: var(--text-primary);">${desc}</div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; width: 90%; max-height: 80vh; display: flex; flex-direction: column; padding: 24px; background: #ffffff; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--primary-color);">CHỌN BẢN GHI DỮ LIỆU MAIL MERGE</h3>
                <button class="btn-close-modal" id="btn-close-picker-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
            </div>
            
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                Hệ thống phát hiện file Excel dạng bảng dữ liệu. Hãy chọn 1 dòng (bản ghi) dưới đây để nạp các giá trị tương ứng vào danh sách biến Mail Merge của hồ sơ này:
            </p>

            <div style="flex: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 16px;">
                ${optionsHtml}
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                <button class="btn btn-secondary" id="btn-cancel-picker" style="height: 36px;">Hủy bỏ</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closePicker = () => {
        modal.remove();
    };

    modal.querySelector('#btn-close-picker-modal').addEventListener('click', closePicker);
    modal.querySelector('#btn-cancel-picker').addEventListener('click', closePicker);

    modal.querySelectorAll('.record-picker-option').forEach(opt => {
        opt.addEventListener('mouseenter', () => {
            opt.style.borderColor = 'var(--primary-color)';
            opt.style.backgroundColor = 'var(--primary-light)';
        });
        opt.addEventListener('mouseleave', () => {
            opt.style.borderColor = 'var(--border-color)';
            opt.style.backgroundColor = '#ffffff';
        });
        opt.addEventListener('click', () => {
            const rIdx = parseInt(opt.getAttribute('data-index'));
            onSelect(records[rIdx]);
            closePicker();
        });
    });
}

/**
 * Lưu các biến đã trích xuất từ Excel lên Server
 */
async function saveImportedVariables(importedVars, profileId) {
    try {
        const activeProfile = AppStore.getActiveProfile();
        if (!activeProfile) return;

        const existingVars = [...(activeProfile.variables || [])];

        // Trộn danh sách biến mới vào danh sách hiện tại
        for (const impVar of importedVars) {
            const idx = existingVars.findIndex(ev => ev.name === impVar.name);
            if (idx !== -1) {
                existingVars[idx].value = impVar.value;
                if (!existingVars[idx].group) {
                    existingVars[idx].group = 'Excel Import';
                }
            } else {
                existingVars.push({
                    name: impVar.name,
                    value: impVar.value,
                    group: impVar.group || 'Excel Import'
                });
            }
        }

        const res = await AppStore.updateProfileVariables(profileId, existingVars);
        showToast(`Nạp thành công ${importedVars.length} biến từ Excel!`, 'success');

        if (res && res.files) {
            activeProfile.files = res.files;
        }

        renderProfiles();
        renderActiveProfile();
    } catch (err) {
        showToast("Lỗi khi cập nhật biến Excel: " + err.message, "danger");
    }
}

/**
 * Quản lý selection range của con trỏ soạn thảo
 */
let savedRange = null;

function saveSelectionRange() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0);
    } else {
        savedRange = null;
    }
}

function restoreSelectionRange() {
    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
}

/**
 * Chèn thẻ phần tử HTML vào vị trí con trỏ trong Rich Text Editor
 */
function insertElementAtCursor(el) {
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(el);

        // Di chuyển con trỏ ra sau thẻ vừa chèn
        range.setStartAfter(el);
        range.setEndAfter(el);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

/**
 * Hiển thị Menu ngữ cảnh chọn biến chèn Mail Merge
 */
function showMailMergeMenu(x, y, variables) {
    removeMailMergeContextMenu();

    if (!variables || variables.length === 0) {
        showToast("Không có biến nào khả dụng để chèn. Vui lòng khai báo danh mục biến.", "warning");
        return;
    }

    // Nhóm variables theo group
    const groups = {};
    variables.forEach(v => {
        const groupName = v.group || 'Chung';
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(v);
    });

    const menu = document.createElement('div');
    menu.className = 'mail-merge-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    let itemsHtml = "";
    Object.keys(groups).sort().forEach(groupName => {
        // Thêm tiêu đề nhóm
        itemsHtml += `
            <div class="context-menu-group-title">
                <i data-lucide="folder" style="width: 12px; height: 12px; display: inline-block;"></i>
                <span>${groupName}</span>
            </div>
        `;
        // Thêm các biến
        groups[groupName].forEach(v => {
            const hasSub = v.value && typeof v.value === 'string' && v.value.includes('\n');
            if (hasSub) {
                itemsHtml += `
                    <div class="context-menu-item has-submenu" data-name="${v.name}" data-value="${v.value}">
                        <span class="var-name">${v.name}</span>
                        <span class="var-val" style="color: var(--primary-color); font-weight: bold;">chọn dòng ▸</span>
                    </div>
                `;
            } else {
                itemsHtml += `
                    <div class="context-menu-item" data-name="${v.name}" data-value="${v.value || ''}">
                        <span class="var-name">${v.name}</span>
                        <span class="var-val" title="${v.value || ''}">${v.value || '(Trống)'}</span>
                    </div>
                `;
            }
        });
    });

    menu.innerHTML = `
        <div class="context-menu-header">Chọn biến Mail Merge</div>
        <div class="context-menu-body" style="max-height: 240px; overflow-y: auto;">
            ${itemsHtml}
        </div>
        <div class="context-menu-footer" style="padding: 8px 10px; border-top: 1px solid var(--border-color); text-align: center; background-color: var(--bg-secondary);">
            <button class="btn btn-secondary btn-create-var-direct" style="width: 100%; height: 30px; font-size: 11.5px; display: flex; justify-content: center; align-items: center; gap: 4px; border-radius: var(--radius-sm);">
                <i data-lucide="plus-circle" style="width: 13px; height: 13px; color: var(--primary-color);"></i> Tạo biến mới...
            </button>
        </div>
    `;

    document.body.appendChild(menu);
    if (window.safeCreateIcons) {
        window.safeCreateIcons();
    }

    // Biến lưu trữ active state của submenu để đóng khi click ra ngoài
    let activeSubmenu = null;

    // Hàm render submenu
    const renderSubmenu = (item, varName, varValue) => {
        removeMailMergeSubmenu();

        const rect = item.getBoundingClientRect();
        const submenu = document.createElement('div');
        submenu.className = 'mail-merge-submenu';

        // Định vị submenu
        let leftPos = rect.right + window.scrollX + 2;
        // Nếu submenu tràn mép phải màn hình, hiển thị bên trái menu chính
        if (leftPos + 260 > window.innerWidth) {
            leftPos = rect.left + window.scrollX - 242;
        }
        submenu.style.left = `${leftPos}px`;
        submenu.style.top = `${rect.top + window.scrollY}px`;

        const lines = varValue.split('\n').map(l => l.trim());
        let subItemsHtml = "";
        lines.forEach((line, lineIdx) => {
            const rowNum = lineIdx + 1;
            subItemsHtml += `
                <div class="submenu-item" data-row="${rowNum}" data-value="${line}">
                    <span class="row-num">Dòng ${rowNum}:</span>
                    <span class="row-val" title="${line}">${line || '(Trống)'}</span>
                </div>
            `;
        });

        submenu.innerHTML = subItemsHtml;
        document.body.appendChild(submenu);
        activeSubmenu = submenu;

        // Đăng ký sự kiện click chọn dòng trong submenu
        submenu.addEventListener('click', async (se) => {
            const subItem = se.target.closest('.submenu-item');
            if (subItem) {
                const rowNum = parseInt(subItem.getAttribute('data-row')) || 1;
                const lineVal = subItem.getAttribute('data-value');

                restoreSelectionRange();

                // Chèn thẻ span Mail Merge với giá trị hiển thị tương ứng của dòng được chọn, lưu thuộc tính data-row
                const span = document.createElement('span');
                span.className = 'mail-merge-tag';
                span.setAttribute('data-variable', varName);
                span.setAttribute('data-row', rowNum); // Gán chỉ mục dòng cố định
                span.setAttribute('contenteditable', 'true');
                span.textContent = lineVal || `{{${varName}}}`;

                insertElementAtCursor(span);

                // Lưu lại thay đổi tức thì vào Database (để file.currentContent chứa thẻ span mới)
                await saveEditorContent();

                // Tự động đồng bộ dropdown dòng xem trước sang dòng vừa chọn
                if (window.AppWorkspaceState) {
                    window.AppWorkspaceState.previewRowIndex = rowNum;
                }
                const selectRow = document.getElementById('select-preview-row');
                if (selectRow) {
                    selectRow.value = rowNum;
                }

                // Cập nhật lại toàn bộ tài liệu theo dòng preview mới (đọc nội dung mới đã lưu ở trên)
                const activeProfile = AppStore.getActiveProfile();
                if (activeProfile) {
                    const selectPreviewFile = document.getElementById('select-preview-file');
                    const fileId = selectPreviewFile ? selectPreviewFile.value : activeProfile.files[0].id;
                    const fileObj = activeProfile.files.find(f => f.id === fileId);
                    if (fileObj) {
                        Components.updateFilePreview(fileObj, activeProfile, "");
                    }
                }

                removeMailMergeContextMenu();
            }
        });
    };

    // Theo dõi sự kiện mouseover và click trên các menu items
    menu.addEventListener('mouseover', (me) => {
        const item = me.target.closest('.context-menu-item');
        if (item) {
            if (item.classList.contains('has-submenu')) {
                const varName = item.getAttribute('data-name');
                const varValue = item.getAttribute('data-value');
                renderSubmenu(item, varName, varValue);
            } else {
                // Di chuột qua item không có submenu thì đóng submenu hiện tại
                removeMailMergeSubmenu();
            }
        }
    });

    // Sự kiện click trên menu chính
    menu.addEventListener('click', async (me) => {
        const btnCreateDirect = me.target.closest('.btn-create-var-direct');
        if (btnCreateDirect) {
            me.stopPropagation();
            const newVarName = prompt("Nhập tên biến Mail Merge mới (Ví dụ: SO_DIEN_THOAI, MA_SO_THUE):");
            if (!newVarName || newVarName.trim() === "") return;

            const cleanVarName = newVarName.trim().toUpperCase().replace(/\s+/g, '_').normalize('NFC');

            // Kiểm tra trùng lặp
            const activeProfile = AppStore.getActiveProfile();
            if (activeProfile && activeProfile.variables.some(v => v.name === cleanVarName)) {
                showToast("Tên biến này đã tồn tại trong danh sách.", "warning");
                return;
            }

            restoreSelectionRange();

            const span = document.createElement('span');
            span.className = 'mail-merge-tag';
            span.setAttribute('data-variable', cleanVarName);
            span.setAttribute('contenteditable', 'true');
            span.textContent = `{{${cleanVarName}}}`;

            insertElementAtCursor(span);

            if (activeProfile) {
                activeProfile.variables.push({
                    name: cleanVarName,
                    value: "",
                    group: "Chung"
                });
                // Lưu lại editor content (sẽ tự động thêm biến mới trên server)
                await saveEditorContent();
            }

            removeMailMergeContextMenu();
            return;
        }

        const item = me.target.closest('.context-menu-item');
        if (item) {
            if (item.classList.contains('has-submenu')) {
                // Biến có submenu: click sẽ kích hoạt render/focus submenu thay vì chèn trực tiếp dính chùm
                me.stopPropagation();
                const varName = item.getAttribute('data-name');
                const varValue = item.getAttribute('data-value');
                renderSubmenu(item, varName, varValue);
                return;
            }

            const varName = item.getAttribute('data-name');
            const varValue = item.getAttribute('data-value');

            restoreSelectionRange();

            const span = document.createElement('span');
            span.className = 'mail-merge-tag';
            span.setAttribute('data-variable', varName);
            span.setAttribute('contenteditable', 'true');
            span.textContent = varValue || `{{${varName}}}`;

            insertElementAtCursor(span);

            // Lưu lại thay đổi tức thì
            await saveEditorContent();
            removeMailMergeContextMenu();
        }
    });

    // Đóng menu khi click ra ngoài
    const closeMenu = (ce) => {
        const isClickInsideMenu = menu.contains(ce.target);
        const isClickInsideSubmenu = activeSubmenu && activeSubmenu.contains(ce.target);
        if (!isClickInsideMenu && !isClickInsideSubmenu) {
            removeMailMergeContextMenu();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 50);
}

/**
 * Xóa menu ngữ cảnh Mail Merge
 */
function removeMailMergeContextMenu() {
    const existing = document.querySelector('.mail-merge-context-menu');
    if (existing) {
        existing.remove();
    }
    removeMailMergeSubmenu();
}

/**
 * Xóa menu con (submenu) Mail Merge
 */
function removeMailMergeSubmenu() {
    const existing = document.querySelector('.mail-merge-submenu');
    if (existing) {
        existing.remove();
    }
}

/**
 * Lưu nội dung HTML soạn thảo của tài liệu về Backend API
 */
async function saveEditorContent() {
    const editor = document.getElementById('preview-content-edited');
    if (!editor) return;

    const activeProfile = AppStore.getActiveProfile();
    if (!activeProfile) return;

    const selectPreview = document.getElementById('select-preview-file');
    if (!selectPreview) return;

    const fileId = selectPreview.value;
    const file = activeProfile.files.find(f => f.id === fileId);
    if (!file) return;

    const htmlContent = editor.innerHTML;
    if (htmlContent === file.currentContent) return; // Không có thay đổi

    try {
        const res = await AppStore.updateFileContent(activeProfile.id, fileId, htmlContent);
        file.currentContent = htmlContent;

        // Cập nhật lại danh mục biến hiển thị ở card bên trái nếu có sự đồng bộ ngược từ văn bản soạn thảo
        if (res && res.variables) {
            activeProfile.variables = res.variables;
            activeProfile.files = res.files;

            const activeProfileObj = AppStore.getActiveProfile();
            const variablesCard = document.getElementById('card-variables-section');
            if (variablesCard) {
                variablesCard.innerHTML = Components.renderVariablesBlock(activeProfileObj);
                safeCreateIcons();
            }
        }
    } catch (err) {
        showToast("Lỗi tự động lưu: " + err.message, "danger");
    }
}

/**
 * Xử lý đăng tải hình ảnh minh chứng chứng từ
 */
async function handleImagesUpload(files, profileId) {
    const activeProfile = AppStore.getActiveProfile();
    if (!activeProfile) return;

    showToast("Đang tải ảnh minh chứng lên server...", "info");

    const promises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
            showToast(`File "${file.name}" không phải định dạng ảnh được hỗ trợ.`, 'danger');
            return;
        }
        if (file.size > 12 * 1024 * 1024) {
            showToast(`Ảnh "${file.name}" vượt quá kích thước 12MB tối đa.`, 'danger');
            return;
        }

        try {
            const base64 = await readFileAsDataURL(file);
            await AppStore.uploadImage(profileId, file.name, file.size, base64);
        } catch (err) {
            console.error("Lỗi khi tải ảnh lên:", err);
            showToast(`Lỗi upload: ${err.message}`, 'danger');
        }
    });

    await Promise.all(promises);
    if (window.AppWorkspaceState) {
        window.AppWorkspaceState.activeTab = 'images';
    }
    showToast("Đã cập nhật bộ sưu tập ảnh minh chứng!", "success");
    renderActiveProfile();
}

/**
 * Hiển thị lightbox xem trước ảnh lớn
 */
function showImageLightbox(src, name) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close-btn">&times;</button>
            <img src="${src}" alt="${name}">
            <div class="lightbox-title">${name}</div>
        </div>
    `;
    document.body.appendChild(lightbox);

    const close = () => lightbox.remove();
    lightbox.querySelector('.lightbox-close-btn').addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });
}

