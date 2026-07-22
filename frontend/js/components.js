/**
 * ==========================================================================
 * UI COMPONENTS - CÁC THÀNH PHẦN GIAO DIỆN TÌM KIẾM VÀ THAY THẾ ĐỘNG
 * ==========================================================================
 */

window.safeCreateIcons = function () {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    } else {
        console.warn("Thư viện Lucide icons chưa được tải xong từ CDN.");
    }
};

window.Components = {
    /**
     * Hàm helper lấy số dòng dữ liệu lớn nhất trong các biến
     */
    getMaxRowIndex(variables) {
        if (!variables) return 1;
        let maxMultiLineRows = 1;
        variables.forEach(v => {
            if (v.value && typeof v.value === 'string' && v.value.includes('\n')) {
                const lines = v.value.split('\n').map(l => l.trim());
                if (lines.length > maxMultiLineRows) {
                    maxMultiLineRows = lines.length;
                }
            }
        });

        const rowSuffixRegex = /^(.*)_(\d+)$/;
        let maxSuffixRowIndex = 0;
        variables.forEach(v => {
            const match = v.name.match(rowSuffixRegex);
            if (match) {
                const rowNum = parseInt(match[2]);
                if (rowNum > maxSuffixRowIndex) {
                    maxSuffixRowIndex = rowNum;
                }
            }
        });

        return Math.max(maxMultiLineRows, maxSuffixRowIndex);
    },

    /**
     * Hàm helper lấy giá trị của một biến theo rowIndex
     */
    getVariableValue(variables, varName, rowIndex = 1) {
        if (!variables) return "";

        // 1. Tìm biến có hậu tố dòng trước (Ví dụ: MA_HO_SO_1)
        const targetVarName = `${varName}_${rowIndex}`;
        const suffixVar = variables.find(v => v.name === targetVarName);
        if (suffixVar) {
            return suffixVar.value || "";
        }

        // 2. Tìm biến gốc không có hậu tố (Ví dụ: MA_HO_SO)
        const baseVar = variables.find(v => v.name === varName);
        if (baseVar) {
            const val = baseVar.value || "";
            if (typeof val === 'string' && val.includes('\n')) {
                const lines = val.split('\n');
                if (rowIndex - 1 < lines.length) {
                    return lines[rowIndex - 1].trim();
                }
                return "";
            }
            return val;
        }

        return "";
    },

    /**
     * Định dạng kích thước file sang định dạng dễ đọc (KB, MB)
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Định dạng chuỗi ngày tháng sang chuẩn Việt Nam
     */
    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Trả về nhãn trạng thái và màu sắc tương ứng
     */
    getStatusMeta(status) {
        switch (status) {
            case 'new':
                return { label: 'Chưa chỉnh sửa', class: 'new', textClass: 'text-muted' };
            case 'completed':
                return { label: 'Đã hoàn thành', class: 'completed', textClass: 'text-success' };
            default:
                return { label: 'Đang xử lý', class: 'scanning', textClass: 'text-warning' };
        }
    },

    /**
     * Render danh sách hồ sơ thanh toán bên Sidebar
     */
    renderProfileList(profiles, activeId) {
        const container = document.getElementById('profile-list');
        const countBadge = document.getElementById('profile-count');
        const dropdownCountBadge = document.getElementById('dropdown-profile-count');

        if (!container) return;

        const activeTab = document.querySelector('.sidebar-tab.active');
        const tabType = activeTab ? activeTab.getAttribute('data-type') : 'edited';
        const tabFiltered = profiles.filter(p => (p.type || 'edited') === tabType);

        // Cập nhật số lượng hồ sơ đồng bộ cho cả hai nhãn
        if (countBadge) countBadge.textContent = `${tabFiltered.length} hồ sơ`;
        if (dropdownCountBadge) dropdownCountBadge.textContent = `${tabFiltered.length} hồ sơ`;

        if (tabFiltered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 13px;">
                    <i data-lucide="info" style="margin: 0 auto 8px auto; display: block; opacity: 0.5; width: 20px; height: 20px;"></i>
                    Không có hồ sơ nào thuộc nhóm này.
                </div>
            `;
            safeCreateIcons();
            return;
        }

        container.innerHTML = tabFiltered.map(profile => {
            const isActive = profile.id === activeId ? 'active' : '';
            const fileCount = profile.files ? profile.files.length : 0;
            const subText = profile.type === 'original'
                ? 'Hồ sơ mẫu'
                : (profile.type === 'mailmerge' ? 'Mail merge' : `${fileCount} tài liệu`);

            return `
                <li class="profile-item ${isActive}" data-id="${profile.id}" id="profile-item-${profile.id}">
                    <h4>${profile.name}</h4>
                    <div class="profile-meta">
                        <span>${subText}</span>
                    </div>
                </li>
            `;
        }).join('');

        safeCreateIcons();
    },

    /**
     * Render chi tiết của một hồ sơ đang hoạt động
     */
    renderProfileDetail(profile, activeSearchQuery = "") {
        const container = document.getElementById('profile-detail-container');
        const emptyState = document.getElementById('empty-state');

        if (!container || !emptyState) return;

        if (!profile) {
            container.classList.add('hidden');

            // Cập nhật nội dung Empty State động theo tab đang active
            const activeTab = document.querySelector('.sidebar-tab.active');
            const tabType = activeTab ? activeTab.getAttribute('data-type') : 'edited';

            const titleEl = emptyState.querySelector('h3');
            const descEl = emptyState.querySelector('p');

            // Xóa nút cũ nếu có để tránh trùng lặp
            emptyState.querySelectorAll('.btn-direct-create, .btn-open-dropdown-direct').forEach(el => el.remove());

            if (titleEl && descEl) {
                let btnHtml = '';
                if (tabType === 'mailmerge') {
                    titleEl.textContent = 'Chưa chọn Mail merge';
                    descEl.textContent = 'Hãy chọn một mục Mail merge từ danh mục phía trên Header hoặc tạo mới một tệp Mail merge để bắt đầu.';
                    btnHtml = `
                        <button class="btn btn-primary btn-direct-create" id="btn-create-mailmerge-direct" style="margin-top: 16px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Tạo Tệp Mail Merge Mới</button>
                        <button class="btn btn-secondary btn-open-dropdown-direct" style="margin-top: 16px; margin-left: 8px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="menu" style="width: 16px; height: 16px;"></i> Xem danh sách Mail merge</button>
                    `;
                } else if (tabType === 'original') {
                    titleEl.textContent = 'Chưa chọn hồ sơ gốc';
                    descEl.textContent = 'Hãy chọn một hồ sơ gốc từ danh mục phía trên Header hoặc tạo mới một hồ sơ gốc để tải tài liệu mẫu.';
                    btnHtml = `
                        <button class="btn btn-primary btn-direct-create" id="btn-create-original-direct" style="margin-top: 16px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Tạo Hồ Sơ Gốc Mới</button>
                        <button class="btn btn-secondary btn-open-dropdown-direct" style="margin-top: 16px; margin-left: 8px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="menu" style="width: 16px; height: 16px;"></i> Xem danh sách Hồ sơ gốc</button>
                    `;
                } else {
                    titleEl.textContent = 'Chưa chọn hồ sơ thanh toán';
                    descEl.textContent = 'Hãy chọn một hồ sơ từ danh mục phía trên Header hoặc tạo mới một hồ sơ thanh toán để bắt đầu làm việc.';
                    btnHtml = `
                        <button class="btn btn-primary btn-direct-create" id="btn-create-edited-direct" style="margin-top: 16px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Tạo Hồ Sơ Thanh Toán Mới</button>
                        <button class="btn btn-secondary btn-open-dropdown-direct" style="margin-top: 16px; margin-left: 8px; display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="menu" style="width: 16px; height: 16px;"></i> Xem danh sách Hồ sơ</button>
                    `;
                }

                if (btnHtml) {
                    emptyState.insertAdjacentHTML('beforeend', btnHtml);
                }
            }

            emptyState.classList.remove('hidden');
            safeCreateIcons();
            return;
        }

        emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        const isOriginal = profile.type === 'original';
        const isMailMerge = profile.type === 'mailmerge';
        const isEdited = !isOriginal && !isMailMerge;
        const currentActiveTab = (window.AppWorkspaceState && window.AppWorkspaceState.activeTab) || 'preview';

        container.innerHTML = `
            <!-- Tiêu đề chi tiết hồ sơ -->
            <div class="detail-header">
                <div class="detail-title-wrapper" style="min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <h2 style="margin: 0;">${profile.name}</h2>
                        ${isOriginal
                ? `<span class="badge" style="background-color: #0284c7; color: #ffffff; border-color: #0284c7;">Hồ sơ gốc</span>`
                : (isMailMerge
                    ? `<span class="badge" style="background-color: #059669; color: #ffffff; border-color: #059669;">Tệp Mail Merge</span>`
                    : `<span class="badge" style="background-color: var(--primary-color); color: #ffffff; border-color: var(--primary-color);">Hồ sơ chỉnh sửa</span>`
                )}
                    </div>
                    <div class="detail-subtitle">
                        Tạo lúc: <strong>${this.formatDate(profile.createdAt)}</strong>
                    </div>
                </div>
                <div class="detail-actions" style="display: flex; gap: 10px;">
                    ${isEdited ? `
                    <button class="btn btn-secondary" id="btn-reset-profile" data-id="${profile.id}" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">
                        <i data-lucide="refresh-cw"></i>
                        Khôi phục bản gốc
                    </button>
                    ` : ''}
                    <button class="btn btn-danger" id="btn-delete-profile" data-id="${profile.id}">
                        <i data-lucide="trash-2"></i>
                        Xóa hồ sơ
                    </button>
                </div>
            </div>

            <!-- Khối 1: Tải lên tài liệu và Quản lý file -->
            <div class="card ${isMailMerge ? 'hidden' : ''}" id="card-files-section">
                <div class="card-title">
                    <i data-lucide="file-text"></i> Danh sách tài liệu trong hồ sơ
                </div>
                
                <!-- Dropzone kéo thả file -->
                <div class="upload-dropzone" id="file-dropzone">
                    <i data-lucide="upload-cloud" style="width: 40px; height: 40px;"></i>
                    <p>Kéo và thả các tài liệu cần thanh toán vào đây hoặc <strong>bấm để chọn file</strong></p>
                    <small style="color: var(--text-muted);">Hỗ trợ định dạng .docx, .txt (Hệ thống đã chuẩn hóa không nhận file .doc cũ).</small>
                    <input type="file" id="file-input-hidden" class="hidden" multiple accept=".txt,.docx">
                </div>

                <!-- Danh sách các file hiện tại -->
                <ul class="file-list" id="detail-file-list">
                    ${this.renderFiles(profile.files, profile.id)}
                </ul>
            </div>

            <!-- Khối Tab Bar và Tab Content thay thế cho grid cũ để tối ưu diện tích và UX -->
            ${(() => {
                if (isOriginal) return ''; // Ẩn hoàn toàn đối với Hồ sơ gốc

                const isMailMerge = profile.type === 'mailmerge';
                const isEdited = !isOriginal && !isMailMerge;
                const hasFiles = profile.files && profile.files.length > 0;

                const activeTab = isMailMerge ? 'variables' : ((window.AppWorkspaceState && window.AppWorkspaceState.activeTab) || 'preview');

                const isVariablesActive = activeTab === 'variables';
                const isSearchActive = activeTab === 'search';
                const isPreviewActive = activeTab === 'preview';
                const isImagesActive = activeTab === 'images';

                return `
                <!-- Thanh Header Tab -->
                ${isMailMerge ? '' : `
                <div class="workspace-tabs-container">
                    <div class="workspace-tabs">
                        <!-- Tab Tài liệu: Hiện cho Hồ sơ gốc và Hồ sơ thanh toán (kể cả khi chưa có file) -->
                        <button class="workspace-tab ${!isMailMerge ? '' : 'hidden'} ${isPreviewActive ? 'active' : ''}" data-tab="preview">
                            <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
                            <span>Tài liệu</span>
                        </button>

                        <!-- Tab Biến Mail Merge: Hiện cho Hồ sơ thanh toán và Tệp Mail Merge -->
                        <button class="workspace-tab ${isVariablesActive ? 'active' : ''}" data-tab="variables">
                            <i data-lucide="variable" style="width: 16px; height: 16px;"></i>
                            <span>Biến Mail Merge</span>
                            <span class="tab-badge">${profile.variables ? profile.variables.length : 0}</span>
                        </button>

                        <!-- Tab Ảnh minh chứng: Chỉ hiện cho Hồ sơ thanh toán -->
                        <button class="workspace-tab ${isImagesActive ? 'active' : ''} ${isEdited ? '' : 'hidden'}" data-tab="images">
                            <i data-lucide="camera" style="width: 16px; height: 16px;"></i>
                            <span>Ảnh minh chứng</span>
                            <span class="tab-badge">${profile.images ? profile.images.length : 0}</span>
                        </button>

                        <!-- Tab Tìm kiếm: Chỉ hiện cho Hồ sơ thanh toán -->
                        <button class="workspace-tab ${isSearchActive ? 'active' : ''} ${isEdited ? '' : 'hidden'}" data-tab="search">
                            <i data-lucide="search" style="width: 16px; height: 16px;"></i>
                            <span>Tìm kiếm & Thay thế</span>
                        </button>
                    </div>
                </div>
                `}

                <div class="workspace-tab-content">
                    <!-- Khối 2: Quản lý các biến Mail Merge từ Excel -->
                    <div class="card tab-pane ${isVariablesActive ? '' : 'hidden'}" id="card-variables-section" style="margin-bottom: 0;">
                        ${this.renderVariablesBlock(profile)}
                    </div>

                    <!-- Khối 3: Bảng Tìm kiếm & Thay thế văn bản -->
                    <div class="card tab-pane ${isSearchActive ? '' : 'hidden'} ${isEdited ? '' : 'hidden'}" id="card-search-replace-section" style="margin-bottom: 0;">
                        ${this.renderSearchBlock(profile, activeSearchQuery)}
                    </div>

                    <!-- Khối 4: Trình Xem Trước So Sánh Song Song & Soạn thảo (Split Preview Editor) -->
                    <div class="card tab-pane ${!isMailMerge ? '' : 'hidden'} ${isPreviewActive ? '' : 'hidden'}" id="card-preview-section" style="margin-bottom: 0;">
                        ${this.renderPreviewBlock(profile, activeSearchQuery)}
                    </div>

                    <!-- Khối 5: Bộ sưu tập ảnh minh chứng -->
                    <div class="card tab-pane ${isImagesActive ? '' : 'hidden'} ${isEdited ? '' : 'hidden'}" id="card-images-section" style="margin-bottom: 0;">
                        ${this.renderImagesBlock(profile)}
                    </div>
                </div>
                `;
            })()}

            <!-- Khối 6: Tải xuống hồ sơ hoàn chỉnh (Tài liệu hoặc Ảnh) -->
            ${(() => {
                if (!isEdited) return '';

                if (currentActiveTab === 'images') {
                    const hasImages = profile.images && profile.images.length > 0;
                    return `
                        <div class="card ${hasImages ? '' : 'hidden'}" id="card-export-images-section">
                            ${this.renderExportImagesBlock(profile)}
                        </div>
                    `;
                } else if (currentActiveTab === 'preview' || currentActiveTab === 'search') {
                    const hasFiles = profile.files && profile.files.length > 0;
                    return `
                        <div class="card ${hasFiles ? '' : 'hidden'}" id="card-export-section">
                            ${this.renderExportBlock(profile)}
                        </div>
                    `;
                }

                return '';
            })()}
        `;

        safeCreateIcons();
    },

    /**
     * Render danh sách các file trong hồ sơ
     */
    renderFiles(files, profileId) {
        if (!files || files.length === 0) {
            return `
                <div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
                    Chưa có tài liệu nào trong hồ sơ này. Vui lòng kéo thả hoặc tải lên tài liệu mẫu.
                </div>
            `;
        }

        return files.map(file => `
            <li class="file-item" data-file-id="${file.id}">
                <div class="file-info">
                    <i data-lucide="file-signature"></i>
                    <div style="min-width: 0;">
                        <div class="file-name" title="${file.name}">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="btn-remove-file" data-file-id="${file.id}" data-profile-id="${profileId}" title="Xóa tài liệu">
                    <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                </button>
            </li>
        `).join('');
    },

    /**
     * Render khu vực Quản lý Biến Mail Merge
     */
    renderVariablesBlock(profile) {
        const isMailMerge = profile.type === 'mailmerge';
        const variables = profile.variables || [];

        // 1. Tạo selector kết nối đối với Hồ sơ thanh toán (edited)
        let connectSelectorHtml = '';
        if (profile.type === 'edited' || !profile.type) {
            // Lấy tất cả các Tệp Mail Merge (type === 'mailmerge') từ Store
            const allMailMerges = typeof AppStore !== 'undefined' ? AppStore.getProfiles().filter(p => p.type === 'mailmerge') : [];
            const options = allMailMerges.map(mm => `
                <option value="${mm.id}" ${profile.mailMergeId === mm.id ? 'selected' : ''}>${mm.name}</option>
            `).join('');

            connectSelectorHtml = `
                <div class="mail-merge-connect-container" style="margin-bottom: 16px; padding: 12px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background-color: var(--bg-secondary);">
                    <label for="select-mail-merge-connect" style="font-size: 13px; font-weight: 600; display: block; margin-bottom: 6px;">
                        <i data-lucide="link" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>
                        Kết nối tới Tệp Mail Merge live:
                    </label>
                    <select id="select-mail-merge-connect" style="width: 100%; height: 38px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background-color: var(--bg-primary); color: var(--text-primary);">
                        <option value="">-- Chọn Tệp Mail Merge để kết nối --</option>
                        ${options}
                    </select>
                    <p style="font-size: 11px; color: var(--text-muted); margin: 6px 0 0 0;">
                        Khi được kết nối, toàn bộ tài liệu trong hồ sơ thanh toán này sẽ tự động nhận diện và đồng bộ các biến Mail Merge live từ Tệp Mail Merge được chọn.
                    </p>
                </div>
            `;
        }

        const sortedVars = [...variables].sort((a, b) => a.name.localeCompare(b.name));

        const importDropzone = `
            <div class="excel-dropzone" id="excel-dropzone" data-profile-id="${profile.id}" style="margin-top: 16px;">
                <i data-lucide="sheet" style="width: 24px; height: 24px; color: var(--success-color); margin-bottom: 6px; display: inline-block;"></i>
                <p style="font-size: 12.5px; margin: 0;">Kéo thả file <strong>Excel Mail Merge (.xlsx, .csv)</strong> hoặc <strong>bấm để chọn</strong></p>
                <small style="color: var(--text-muted); font-size: 11px;">Hệ thống sẽ nạp các biến trích xuất vào nhóm biến của hồ sơ này.</small>
                <input type="file" id="excel-input-hidden" class="hidden" accept=".xlsx,.xls,.csv">
            </div>
        `;

        const isExpanded = true;
        const displayStyle = "display: block;";
        const bodyClass = "card-body collapsible-body";
        const iconTransform = "transform: rotate(180deg);";

        const headerHtml = `
            <div class="variables-group-header" style="margin-bottom: 12px;">
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0; max-width: 100%;">
                    ${isMailMerge
                ? 'Định nghĩa các trường Mail Merge của bạn. Các biến này sẽ đồng bộ trực tiếp tới tất cả tài liệu.'
                : 'Danh sách các trường biến Mail Merge. Thay đổi giá trị tại đây sẽ tự động đồng bộ sang toàn bộ tài liệu trong hồ sơ.'}
                </p>
            </div>
        `;

        let mainContentHtml = '';

        if (!isMailMerge && !profile.mailMergeId) {
            mainContentHtml = `
                <div style="text-align: center; color: var(--text-muted); padding: 30px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                    Hồ sơ thanh toán này chưa được kết nối tới Tệp Mail Merge nào. Vui lòng chọn và kết nối tới một Tệp Mail Merge ở trên để liên kết và chỉnh sửa các biến cho tài liệu.
                </div>
            `;
        } else if (sortedVars.length === 0) {
            mainContentHtml = `
                <div style="text-align: center; color: var(--text-muted); padding: 30px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                    Chưa có biến Mail Merge nào. Hãy bấm nút "Thêm biến mới" ở trên hoặc kéo thả file Excel để bắt đầu.
                </div>
            `;
        } else {
            const variableRows = sortedVars.map((v) => {
                return `
                    <tr class="variable-row" data-name="${v.name}" data-group="Chung">
                        <td style="width: 40%;">
                            <div class="field-key-wrapper">
                                <span class="field-key-bracket">{{</span>
                                <input type="text" 
                                       class="var-key-input field-key-input" 
                                       value="${v.name}" 
                                       placeholder="TEN_TRUONG..." 
                                       data-original-name="${v.name}" 
                                       data-group="Chung">
                                <span class="field-key-bracket">}}</span>
                            </div>
                        </td>
                        <td style="width: 50%;">
                            <textarea class="var-val-input field-value-input" 
                                      placeholder="(Trống hoặc nhập nhiều dòng)" 
                                      data-name="${v.name}" 
                                      data-group="Chung"
                                      rows="1"
                                      style="width: 100%; min-height: 38px; resize: vertical; padding: 8px 10px; font-size: 13px; line-height: 1.5; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background-color: var(--bg-primary); color: var(--text-primary); font-family: inherit; transition: border-color var(--transition-fast);">${v.value || ''}</textarea>
                        </td>
                        <td style="text-align: center; width: 10%;">
                            <button class="btn-delete-field btn-delete-variable" data-name="${v.name}" data-group="Chung" title="Xóa trường này">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            mainContentHtml = `
                <div class="mail-merge-group-card" data-group-name="Chung">
                    <div class="group-card-header">
                        <div class="group-title-wrapper">
                            <i data-lucide="variable" class="group-icon" style="color: var(--primary-color);"></i>
                            <span class="group-title-text" style="font-weight: 700;">Danh sách biến Mail Merge</span>
                        </div>
                        <div class="group-actions">
                            <button class="btn btn-primary" id="btn-add-variable-flat">
                                <i data-lucide="plus"></i> Thêm biến mới
                            </button>
                        </div>
                    </div>
                    <div class="group-card-body">
                        <table class="group-fields-table">
                            <thead>
                                <tr>
                                    <th style="width: 40%;">Tên trường (Key)</th>
                                    <th style="width: 50%;">Giá trị (Value)</th>
                                    <th style="text-align: center; width: 10%;">Xóa</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${variableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const showVariablesBody = isMailMerge || !!profile.mailMergeId;

        return `
            <div class="card-header-toggle" id="variables-section-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                <div class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="variable" style="color: var(--primary-color);"></i> Mục và biến Mail Merge (${variables.length})
                </div>
                <i data-lucide="chevron-down" class="toggle-icon" id="variables-section-toggle-icon" style="transition: transform var(--transition-fast); ${iconTransform}"></i>
            </div>
            
            <div class="${bodyClass}" id="variables-section-body" style="${displayStyle} margin-top: 14px;">
                <div class="variables-section-container" style="display: block;">
                    ${connectSelectorHtml}

                    ${showVariablesBody ? `
                        ${headerHtml}

                        <div class="groups-container" style="margin-top: 12px;">
                            ${mainContentHtml}
                        </div>

                        ${importDropzone}
                    ` : `
                        <div class="groups-container" style="margin-top: 12px;">
                            ${mainContentHtml}
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    /**
     * Render khu vực Quản lý Ảnh minh chứng
     */
    renderImagesBlock(profile) {
        const images = profile.images || [];
        const isExpanded = true;
        const displayStyle = "display: block;";
        const bodyClass = "card-body collapsible-body";
        const iconTransform = "transform: rotate(180deg);";

        return `
            <div class="card-header-toggle" id="images-section-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                <div class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="camera" style="color: var(--primary-color);"></i> Ảnh minh chứng hồ sơ (${images.length})
                </div>
                <i data-lucide="chevron-down" class="toggle-icon" id="images-section-toggle-icon" style="transition: transform var(--transition-fast); ${iconTransform}"></i>
            </div>
            
            <div class="${bodyClass}" id="images-section-body" style="${displayStyle} margin-top: 14px;">
                <div class="evidence-images-section" style="display: block;">
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 4px 0;">
                        Tải lên các hình ảnh minh chứng để lưu trữ lâu dài cùng bộ hồ sơ này (Biên lai, chứng từ, ảnh thực địa...).
                    </p>

                    <!-- Vùng upload ảnh -->
                    <div class="images-dropzone" id="images-dropzone" data-profile-id="${profile.id}">
                        <i data-lucide="image" style="width: 32px; height: 32px; color: var(--primary-color); margin-bottom: 6px; display: inline-block;"></i>
                        <p style="font-size: 13px; margin: 0;">Kéo thả các file ảnh minh chứng vào đây hoặc <strong>bấm để chọn ảnh</strong></p>
                        <small style="color: var(--text-muted); font-size: 11px;">Hỗ trợ định dạng JPG, PNG, GIF. Dung lượng tối đa 10MB/ảnh.</small>
                        <input type="file" id="images-input-hidden" class="hidden" multiple accept="image/*">
                    </div>

                    <!-- Gallery ảnh -->
                    <div class="images-gallery-grid" id="images-gallery-grid">
                        ${images.map(img => `
                            <div class="image-gallery-item" data-id="${img.id}" data-name="${img.name}" data-src="${img.data}">
                                <img src="${img.data}" alt="${img.name}" title="${img.name}">
                                <div class="image-gallery-item-overlay">
                                    <button class="image-item-delete-btn" data-image-id="${img.id}" data-profile-id="${profile.id}" title="Xóa hình ảnh này">
                                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${images.length === 0 ? `
                            <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted); font-size: 12.5px;">
                                Chưa có hình ảnh minh chứng nào trong hồ sơ này.
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Dựng nội dung khu vực Tìm kiếm và Thay thế
     */
    renderSearchBlock(profile, activeSearchQuery = "") {
        const fileCount = profile.files ? profile.files.length : 0;

        if (fileCount === 0) {
            return `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <i data-lucide="search" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 13px;">Vui lòng thêm tài liệu vào hồ sơ để thực hiện tìm kiếm & thay thế đồng bộ.</p>
                </div>
            `;
        }

        const replacementsHtml = (profile.replacements && profile.replacements.length > 0) ? `
            <div class="replacements-history-section" style="margin-top: 20px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
                <h4 style="font-size: 13px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; color: var(--text-primary);">
                    <i data-lucide="history" style="width: 16px; height: 16px; color: var(--primary-color);"></i>
                    Cụm từ đã thay thế trong hồ sơ này (${profile.replacements.length})
                </h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${profile.replacements.map(rep => `
                        <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-secondary); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; flex-wrap: wrap;">
                                <span class="phrase-red-tag" style="background-color: var(--accent-red-bg); color: var(--accent-red); border-color: rgba(230,0,18,0.15); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; display: inline-block; padding: 2px 6px; border-radius: 4px;" title="${rep.findText}">${rep.findText}</span>
                                <i data-lucide="arrow-right" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                                <span class="phrase-green-tag" style="background-color: var(--accent-green-bg); color: var(--accent-green); border-color: rgba(46,125,50,0.15); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; display: inline-block; padding: 2px 6px; border-radius: 4px;" title="${rep.replaceText}">${rep.replaceText || '(Xóa từ)'}</span>
                            </div>
                            <button class="btn btn-secondary btn-undo-replace" 
                                    data-find-text="${rep.findText}" 
                                    data-replace-text="${rep.replaceText}"
                                    style="height: 28px; padding: 0 8px; font-size: 11px; color: var(--accent-red); border-color: rgba(230, 0, 18, 0.2); cursor: pointer;" 
                                    title="Hoàn tác thay thế cụm từ này">
                                <i data-lucide="rotate-ccw" style="width: 12px; height: 12px; margin-right: 4px;"></i>
                                Hoàn tác
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const displayStyle = "display: block;";
        const bodyClass = "card-body collapsible-body";
        const iconTransform = "transform: rotate(180deg);";

        return `
            <div class="card-header-toggle" id="search-replace-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                <div class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="search"></i> Tìm kiếm & Thay thế văn bản hàng loạt
                </div>
                <i data-lucide="chevron-down" class="toggle-icon" id="search-replace-toggle-icon" style="transition: transform var(--transition-fast); ${iconTransform}"></i>
            </div>
            
            <div class="${bodyClass}" id="search-replace-body" style="${displayStyle} margin-top: 14px;">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                    Nhập cụm từ bạn muốn tìm kiếm trên tất cả các tài liệu của hồ sơ này. Hệ thống sẽ lọc ra các tài liệu chứa cụm từ đó và hỗ trợ thay thế đồng bộ.
                </p>
                
                <!-- Form Tìm kiếm -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <input type="text" id="search-phrase-input" class="replacement-input" placeholder="Nhập từ hoặc cụm từ cần tìm (ví dụ: Phương Nam, 120.000.000)..." style="flex: 1; height: 38px;">
                    <button class="btn btn-primary" id="btn-trigger-search" style="height: 38px; padding: 0 20px;">
                        <i data-lucide="search"></i> Tìm kiếm
                    </button>
                    <button class="btn btn-secondary hidden" id="btn-clear-search" style="height: 38px; padding: 0 16px;" title="Hủy bộ lọc tìm kiếm">
                        <i data-lucide="x-circle"></i> Hủy
                    </button>
                </div>
                
                <!-- Vùng hiển thị kết quả -->
                <div id="search-results-area">
                    <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                        <i data-lucide="info" style="width: 20px; height: 20px; margin: 0 auto 8px auto; opacity: 0.5; display: block;"></i>
                        Hãy nhập cụm từ tìm kiếm ở trên để bắt đầu chỉnh sửa.
                    </div>
                </div>
                ${replacementsHtml}
            </div>
        `;
    },

    /**
     * Render bảng kết quả tìm kiếm cụm từ trong tài liệu
     */
    renderSearchResults(query, matchingFiles) {
        const container = document.getElementById('search-results-area');
        if (!container) return;

        if (matchingFiles.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--accent-red); background-color: var(--accent-red-bg); border: 1px solid rgba(230, 0, 18, 0.1); border-radius: var(--radius-md);">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px; margin-bottom: 8px; display: inline-block;"></i>
                    <p style="font-size: 13px; font-weight: 600;">Không tìm thấy cụm từ "${query}" trong bất kỳ tài liệu nào của hồ sơ này.</p>
                </div>
            `;
            safeCreateIcons();
            return;
        }

        const fileBadges = matchingFiles.map(f => `
            <span class="file-badge" title="${f.name}">${f.name}</span>
        `).join('');

        container.innerHTML = `
            <div class="red-phrases-table-container">
                <table class="red-phrases-table">
                    <thead>
                        <tr>
                            <th>Cụm từ tìm thấy</th>
                            <th>Xuất hiện trong các file</th>
                            <th>Cụm từ thay thế mới</th>
                            <th style="text-align: center;">Đồng bộ tất cả</th>
                            <th style="text-align: right;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="width: 180px;">
                                <span class="phrase-red-tag" style="background-color: var(--primary-light); color: var(--primary-color); border-color: rgba(0,86,158,0.15);">${query}</span>
                            </td>
                            <td>
                                <div class="phrase-files-badges">
                                    ${fileBadges}
                                </div>
                            </td>
                            <td style="width: 250px;">
                                <input type="text" 
                                       class="replacement-input" 
                                       id="replace-text-input" 
                                       data-find-text="${query}"
                                       placeholder="Nhập cụm từ thay thế mới..." 
                                       style="height: 36px;">
                            </td>
                            <td style="text-align: center; width: 100px;">
                                <input type="checkbox" 
                                       class="sync-checkbox" 
                                       id="checkbox-sync-all" 
                                       checked 
                                       title="Đồng bộ thay thế trên tất cả các file chứa cụm từ này">
                            </td>
                            <td style="width: 130px; text-align: right;">
                                <button class="btn btn-success" id="btn-apply-replace" style="height: 36px; font-size: 12px; padding: 0 12px;">
                                    <i data-lucide="check"></i> Áp dụng sửa
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        safeCreateIcons();
    },

    /**
     * Dựng nội dung khu vực Xuất file
     */
    renderExportBlock(profile) {
        if (!profile.files || profile.files.length === 0) return '';

        return `
            <div class="card-title">
                <i data-lucide="download-cloud" style="color: var(--primary-color);"></i>
                Tải Xuống Hồ Sơ Hoàn Chỉnh
            </div>
            <div class="export-options-container" style="margin-top: 0; padding-top: 0; border-top: none;">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                    Chọn các tùy chọn bên dưới để đóng gói toàn bộ tài liệu đã chỉnh sửa trong hồ sơ này thành một tệp nén ZIP duy nhất.
                </p>
                
                <div class="export-cards">
                    <!-- Option 1: Xuất toàn bộ -->
                    <div class="export-card active" data-mode="all" id="export-card-all">
                        <div class="export-card-icon">
                            <i data-lucide="folder-archive"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 class="export-card-title">Xuất toàn bộ hồ sơ</h4>
                            <p class="export-card-desc">Tải về tất cả tài liệu trong hồ sơ (bao gồm cả các file không chứa từ khóa tìm kiếm).</p>
                        </div>
                        <input type="radio" name="export-mode" value="all" checked style="margin-top: 5px; accent-color: var(--primary-color); cursor: pointer;">
                    </div>

                    <!-- Option 2: Chỉ file chỉnh sửa -->
                    <div class="export-card" data-mode="edited" id="export-card-edited">
                        <div class="export-card-icon">
                            <i data-lucide="file-check"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 class="export-card-title">Chỉ xuất file chỉnh sửa</h4>
                            <p class="export-card-desc">Chỉ tải về những tài liệu đã được thay thế nội dung (các file có chỉnh sửa).</p>
                        </div>
                        <input type="radio" name="export-mode" value="edited" style="margin-top: 5px; accent-color: var(--primary-color); cursor: pointer;">
                    </div>

                    <!-- Option 3: Tự chọn file xuất bản -->
                    <div class="export-card" data-mode="custom" id="export-card-custom">
                        <div class="export-card-icon">
                            <i data-lucide="check-square"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 class="export-card-title">Tự chọn tài liệu xuất bản</h4>
                            <p class="export-card-desc">Chọn thủ công từng tài liệu cụ thể bạn muốn đóng gói và tải về.</p>
                        </div>
                        <input type="radio" name="export-mode" value="custom" style="margin-top: 5px; accent-color: var(--primary-color); cursor: pointer;">
                    </div>
                </div>

                <!-- Vùng hiển thị danh sách các file để tự chọn (mặc định ẩn) -->
                <div id="custom-files-select-container" class="custom-files-select-container hidden">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
                        <span style="font-size: 15px; font-weight: 600; color: var(--text-primary);">Danh sách tài liệu trong hồ sơ:</span>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" id="btn-export-select-all" style="background: none; border: none; color: var(--primary-color); font-size: 14px; font-weight: 600; cursor: pointer;">Chọn tất cả</button>
                            <span style="color: var(--border-color);">|</span>
                            <button type="button" id="btn-export-deselect-all" style="background: none; border: none; color: var(--text-secondary); font-size: 14px; font-weight: 600; cursor: pointer;">Bỏ chọn hết</button>
                        </div>
                    </div>
                    <ul class="custom-export-list">
                        ${profile.files.map(file => `
                            <li class="custom-export-item" data-file-id="${file.id}">
                                <input type="checkbox" class="export-file-checkbox" value="${file.id}" checked>
                                <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
                                <span title="${file.name}">${file.name}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>



                <!-- Nút xuất bản chính thức -->
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 16px;">
                    <span id="export-status-info" style="font-size: 14px; color: var(--text-secondary);"></span>
                    <button class="btn btn-success" id="btn-submit-export" style="height: 48px; padding: 0 28px;">
                        <i data-lucide="download"></i>
                        Tải Xuống Hồ Sơ (.ZIP)
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Dựng nội dung khu vực Xuất ảnh minh chứng
     */
    renderExportImagesBlock(profile) {
        const imageCount = profile.images ? profile.images.length : 0;
        if (imageCount === 0) return '';

        return `
            <div class="card-title">
                <i data-lucide="download-cloud" style="color: var(--primary-color);"></i>
                Tải Xuống Ảnh Minh Chứng
            </div>
            <div class="export-options-container" style="margin-top: 0; padding-top: 0; border-top: none;">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                    Đóng gói toàn bộ <strong>${imageCount} ảnh minh chứng</strong> của hồ sơ này thành một tệp nén ZIP duy nhất để tải xuống máy tính.
                </p>
                
                <!-- Nút xuất bản chính thức -->
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 16px;">
                    <span id="export-images-status-info" style="font-size: 14px; color: var(--text-secondary);"></span>
                    <button class="btn btn-success" id="btn-submit-export-images" style="height: 48px; padding: 0 28px;">
                        <i data-lucide="download"></i>
                        Tải Xuống Ảnh Minh Chứng (.ZIP)
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Dựng nội dung khu vực xem trước (Preview)
     */
    renderPreviewBlock(profile, activeSearchQuery = "") {
        const isExpanded = true;
        const displayStyle = "display: block;";
        const bodyClass = "card-body collapsible-body";
        const iconTransform = "transform: rotate(180deg);";

        // Trường hợp chưa có file trong hồ sơ
        if (!profile.files || profile.files.length === 0) {
            const originalProfiles = (window.AppStore ? window.AppStore.getProfiles() : []).filter(p => p.type === 'original');
            // Chỉ lấy các hồ sơ gốc có file để sao chép
            const availableOriginals = originalProfiles.filter(p => p.files && p.files.length > 0);

            let originalsHtml = '';
            if (availableOriginals.length === 0) {
                originalsHtml = `
                    <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                        <i data-lucide="info" style="width: 24px; height: 24px; margin-bottom: 6px; color: var(--text-muted);"></i>
                        <p style="font-size: 12.5px; margin: 0;">Chưa có Hồ sơ gốc nào có sẵn tài liệu trên hệ thống.</p>
                    </div>
                `;
            } else {
                originalsHtml = `
                    <div class="original-profiles-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
                        ${availableOriginals.map(p => `
                            <div class="btn-copy-template-card" data-source-id="${p.id}" style="padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: #ffffff; cursor: pointer; transition: all var(--transition-fast) ease; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    <i data-lucide="folder" style="color: var(--primary-color); width: 18px; height: 18px; flex-shrink: 0;"></i>
                                    <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${p.name}</span>
                                </div>
                                <span class="badge" style="background-color: var(--primary-light); color: var(--primary-color); font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; flex-shrink: 0;">${p.files.length} file mẫu</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            return `
                <div class="card-header-toggle" id="preview-section-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                    <div class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="file-text" style="color: var(--primary-color);"></i>
                        Tài liệu hồ sơ
                    </div>
                    <i data-lucide="chevron-down" class="toggle-icon" id="preview-section-toggle-icon" style="transition: transform var(--transition-fast); ${iconTransform}"></i>
                </div>
                
                <div class="${bodyClass}" id="preview-section-body" style="${displayStyle} margin-top: 14px;">
                    <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
                        <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Hồ sơ chưa có tài liệu nào</h3>
                        <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0; max-width: 520px; margin: 0 auto; line-height: 1.5;">Vui lòng chọn một trong hai phương án dưới đây để thêm tài liệu vào hồ sơ hiện tại và bắt đầu chỉnh sửa.</p>
                    </div>

                    <div class="preview-empty-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <!-- Cột 1: Tự đẩy file vào -->
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text-secondary); margin: 0; display: flex; align-items: center; gap: 6px;">
                                <span style="background-color: var(--bg-input); width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-primary);">1</span>
                                Tự đẩy file tài liệu mới
                            </h4>
                            <div class="upload-dropzone" id="preview-upload-dropzone" style="flex: 1; min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: #f8fafc; cursor: pointer; transition: all var(--transition-fast) ease;">
                                <i data-lucide="upload-cloud" style="width: 36px; height: 36px; margin-bottom: 8px; color: var(--primary-color);"></i>
                                <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px 0; color: var(--text-primary);">Tải tài liệu lên trực tiếp</p>
                                <small style="color: var(--text-muted); font-size: 11px;">Kéo thả tệp hoặc click để chọn (.docx, .txt)</small>
                                <input type="file" id="preview-file-input-hidden" class="hidden" multiple accept=".txt,.docx">
                            </div>
                        </div>

                        <!-- Cột 2: Chọn từ hồ sơ gốc -->
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text-secondary); margin: 0; display: flex; align-items: center; gap: 6px;">
                                <span style="background-color: var(--bg-input); width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-primary);">2</span>
                                Chọn lấy mẫu từ Hồ sơ gốc
                            </h4>
                            <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                                ${originalsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        let displayFiles = profile.files;
        if (activeSearchQuery && activeSearchQuery.trim() !== "") {
            const cleanString = (str) => (str || '').normalize('NFC').replace(/\s+/g, ' ');
            const normalizedQuery = cleanString(activeSearchQuery);
            displayFiles = profile.files.filter(file =>
                cleanString(file.currentContent).includes(normalizedQuery) ||
                cleanString(file.originalContent).includes(normalizedQuery)
            );
        }

        // Nếu kết quả lọc rỗng, hiển thị lại tất cả file
        if (displayFiles.length === 0) {
            displayFiles = profile.files;
        }

        const options = displayFiles.map((file, idx) => `
            <option value="${file.id}" ${idx === 0 ? 'selected' : ''}>${file.name}</option>
        `).join('');

        // Tự động sinh bộ chọn dòng xem trước (Mail Merge)
        let rowSelectorHtml = '';
        const maxRows = this.getMaxRowIndex(profile.variables);
        if (maxRows > 1 && (profile.type === 'mailmerge' || profile.mailMergeId)) {
            const currentSelectedRow = (window.AppWorkspaceState && window.AppWorkspaceState.previewRowIndex) || 1;
            let rowOptions = '';
            for (let r = 1; r <= maxRows; r++) {
                rowOptions += `<option value="${r}" ${r === currentSelectedRow ? 'selected' : ''}>Dòng ${r}</option>`;
            }
            rowSelectorHtml = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label for="select-preview-row" style="font-size: 13px; font-weight: 600;">Xem trước dòng:</label>
                    <select id="select-preview-row" style="height: 34px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background-color: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                        ${rowOptions}
                    </select>
                </div>
            `;
        }

        // Tự động sinh bảng đồng bộ nhanh giá trị biến sang toàn bộ tài liệu
        let quickVarSyncHtml = '';
        if (profile.variables && profile.variables.length > 0) {
            const firstVar = profile.variables[0];
            const currentSelectedRow = (window.AppWorkspaceState && window.AppWorkspaceState.previewRowIndex) || 1;
            const defaultVal = this.getVariableValue(profile.variables, firstVar.name, currentSelectedRow);

            let rowPickerHtml = '';
            if (maxRows > 1 && (profile.type === 'mailmerge' || profile.mailMergeId)) {
                const varLines = (firstVar && typeof firstVar.value === 'string') ? firstVar.value.split('\n') : [];
                let rowOptions = '<option value="">Chọn nhanh từ danh sách...</option>';
                for (let r = 1; r <= maxRows; r++) {
                    const lineVal = (r - 1 < varLines.length) ? varLines[r - 1].trim() : '';
                    rowOptions += `<option value="${r}">${lineVal || `(Dòng ${r} trống)`}</option>`;
                }
                rowPickerHtml = `
                    <select id="select-quick-var-row-picker" style="height: 34px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background-color: var(--bg-primary); color: var(--text-primary); cursor: pointer; max-width: 250px;">
                        ${rowOptions}
                    </select>
                `;
            }

            quickVarSyncHtml = `
                <div class="quick-variable-sync-container" style="margin-top: 6px; margin-bottom: 14px; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background-color: var(--bg-secondary); display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="variable" style="width: 16px; height: 16px; color: var(--primary-color);"></i>
                        Đồng bộ nhanh giá trị biến sang toàn bộ tài liệu trong hồ sơ
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label for="select-quick-var-name" style="font-size: 12.5px; color: var(--text-secondary); font-weight: 500;">Chọn biến:</label>
                            <select id="select-quick-var-name" style="height: 34px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background-color: var(--bg-primary); color: var(--text-primary); cursor: pointer; min-width: 150px;">
                                ${profile.variables.map(v => `<option value="${v.name}">${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 260px;">
                            <label for="input-quick-var-value" style="font-size: 12.5px; color: var(--text-secondary); font-weight: 500;">Giá trị:</label>
                            <input type="text" id="input-quick-var-value" value="${defaultVal.replace(/"/g, '&quot;')}" placeholder="Nhập giá trị gán (Ví dụ: Nguyễn Văn A)..." style="flex: 1; height: 34px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background-color: var(--bg-primary); color: var(--text-primary);">
                            ${rowPickerHtml}
                        </div>
                        <button class="btn btn-primary" id="btn-submit-quick-var-sync" style="height: 34px; font-size: 12.5px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px;">
                            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Thay thế & Đồng bộ
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="card-header-toggle" id="preview-section-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                <div class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="eye" style="color: var(--primary-color);"></i>
                    Trình Xem Trước & Soạn Thảo Văn Bản (Word Editor)
                </div>
                <i data-lucide="chevron-down" class="toggle-icon" id="preview-section-toggle-icon" style="transition: transform var(--transition-fast); ${iconTransform}"></i>
            </div>
            
            <div class="${bodyClass}" id="preview-section-body" style="${displayStyle} margin-top: 14px;">
                <div class="preview-pane-wrapper">
                    <div class="preview-selector" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label for="select-preview-file" style="font-size: 13px; font-weight: 600;">Chọn tài liệu soạn thảo:</label>
                            <select id="select-preview-file">
                                ${options}
                            </select>
                        </div>
                        ${rowSelectorHtml}
                    </div>
                    ${quickVarSyncHtml}

                    <!-- Trình soạn thảo Rich Text (Chỉ cần 1 văn bản) -->
                    <div class="preview-split-container" style="grid-template-columns: 1fr;">
                        <!-- Trình soạn thảo Rich Text -->
                        <div class="preview-column">
                            <div class="preview-column-header edited">
                                <span>SOẠN THẢO VĂN BẢN TRỰC TIẾP</span>
                                <span class="badge" style="background-color: var(--accent-green-bg); color: var(--accent-green);">Định dạng Word</span>
                            </div>
                            
                            <div class="editor-wrapper">
                                <!-- Thanh công cụ định dạng -->
                                <div class="editor-toolbar">
                                    <div class="toolbar-group">
                                        <button class="toolbar-btn" data-command="undo" title="Hoàn tác (Ctrl+Z)">
                                            <i data-lucide="undo" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="redo" title="Làm lại (Ctrl+Y)">
                                            <i data-lucide="redo" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </div>
                                    <div class="toolbar-group">
                                        <button class="toolbar-btn" data-command="bold" title="In đậm" style="font-weight: bold;">B</button>
                                        <button class="toolbar-btn" data-command="italic" title="In nghiêng" style="font-style: italic;">I</button>
                                        <button class="toolbar-btn" data-command="underline" title="Gạch chân" style="text-decoration: underline;">U</button>
                                        <button class="toolbar-btn" data-command="removeFormat" title="Xóa định dạng">
                                            <i data-lucide="remove-formatting" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </div>
                                    <div class="toolbar-group">
                                        <button class="toolbar-btn" data-command="justifyLeft" title="Căn lề trái">
                                            <i data-lucide="align-left" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="justifyCenter" title="Căn giữa">
                                            <i data-lucide="align-center" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="justifyRight" title="Căn lề phải">
                                            <i data-lucide="align-right" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="justifyFull" title="Căn đều hai bên">
                                            <i data-lucide="align-justify" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </div>
                                    <div class="toolbar-group">
                                        <button class="toolbar-btn" data-command="insertUnorderedList" title="Danh sách ký hiệu">
                                            <i data-lucide="list" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="insertOrderedList" title="Danh sách số">
                                            <i data-lucide="list-ordered" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="outdent" title="Giảm thụt lề">
                                            <i data-lucide="outdent" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button class="toolbar-btn" data-command="indent" title="Tăng thụt lề">
                                            <i data-lucide="indent" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </div>
                                    <div class="toolbar-group">
                                        <select class="toolbar-select font-name-select" title="Phông chữ">
                                            <option value="Arial">Arial</option>
                                            <option value="Times New Roman" selected>Times New Roman</option>
                                            <option value="Courier New">Courier New</option>
                                            <option value="Inter">Inter</option>
                                            <option value="Montserrat">Montserrat</option>
                                        </select>
                                        <select class="toolbar-select font-size-select" title="Cỡ chữ">
                                            <option value="3">12px</option>
                                            <option value="4" selected>14px</option>
                                            <option value="5">16px</option>
                                            <option value="6">18px</option>
                                            <option value="7">24px</option>
                                        </select>
                                    </div>
                                    <div class="toolbar-group">
                                        <input type="color" class="toolbar-color-picker" title="Màu chữ" value="#000000">
                                    </div>
                                    <div class="toolbar-group" style="display: flex; gap: 6px;">
                                        <button class="btn btn-secondary btn-insert-merge-field-trigger" style="height: 28px; font-size: 11px; padding: 0 8px;">
                                            <i data-lucide="plus-circle" style="width: 12px; height: 12px; margin-right: 4px;"></i> Chèn biến Mail Merge
                                        </button>
                                        <button class="btn btn-secondary btn-refresh-editor-content" id="btn-refresh-editor-content" title="Tải lại nội dung và đồng bộ các biến Mail Merge mới nhất" style="height: 28px; font-size: 11px; padding: 0 8px; display: inline-flex; align-items: center; gap: 4px;">
                                            <i data-lucide="rotate-cw" style="width: 12px; height: 12px;"></i> Làm mới tài liệu
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="rich-text-editor" id="preview-content-edited" contenteditable="true" spellcheck="false">
                                    <!-- Nội dung soạn thảo được tải động ở đây -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Định dạng nội dung văn bản hiển thị trong khung Xem trước
     */
    formatContentForPreview(content, type, replacements = [], activeSearchQuery = "") {
        if (!content) return '';

        let escaped = content.normalize('NFC');

        // Tạm thời thay thế các thẻ HTML bảng sang token an toàn không chứa ký tự đặc biệt
        escaped = escaped
            .replace(/<table class=["']docx-table["']>/g, '___TABLE_OPEN___')
            .replace(/<table>/g, '___TABLE_SIMPLE_OPEN___')
            .replace(/<\/table>/g, '___TABLE_CLOSE___')
            .replace(/<tbody>/g, '___TBODY_OPEN___')
            .replace(/<\/tbody>/g, '___TBODY_CLOSE___')
            .replace(/<tr>/g, '___TR_OPEN___')
            .replace(/<\/tr>/g, '___TR_CLOSE___')
            .replace(/<td>/g, '___TD_OPEN___')
            .replace(/<\/td>/g, '___TD_CLOSE___')
            .replace(/<br\s*\/?>/g, '___BR___');

        // Encode HTML entities cho phần văn bản còn lại
        escaped = escaped
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Highlight các từ cũ/mới đã được thay thế thành công (Bỏ qua các thẻ HTML và các token an toàn)
        if (replacements && replacements.length > 0) {
            if (type === 'original') {
                // Highlight các từ cũ đã bị thay thế bằng màu đỏ
                replacements.forEach(({ findText }) => {
                    if (!findText) return;
                    const normalizedFind = findText.normalize('NFC');
                    const escapedFind = normalizedFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regexPattern = escapedFind.replace(/\s+/g, '\\s+');
                    // Loại trừ các class highlight và các token bảng biểu
                    const regex = new RegExp(`(highlight-red|highlight-green|highlight-search-temp|___[A-Z0-9_]+___|<[^>]*>)|(${regexPattern})`, 'g');
                    escaped = escaped.replace(regex, (match, p1, p2) => {
                        if (p1) return p1;
                        return `<span class="highlight-red">${p2}</span>`;
                    });
                });
            } else {
                // Highlight các từ mới thay thế bằng màu xanh lá
                replacements.forEach(({ replaceText }) => {
                    if (!replaceText) return;
                    const normalizedReplace = replaceText.normalize('NFC');
                    const escapedReplace = normalizedReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regexPattern = escapedReplace.replace(/\s+/g, '\\s+');
                    const regex = new RegExp(`(highlight-red|highlight-green|highlight-search-temp|___[A-Z0-9_]+___|<[^>]*>)|(${regexPattern})`, 'g');
                    escaped = escaped.replace(regex, (match, p1, p2) => {
                        if (p1) return p1;
                        return `<span class="highlight-green">${p2}</span>`;
                    });
                });
            }
        }

        // Highlight từ khóa đang tìm kiếm tạm thời bằng màu vàng nhạt
        if (activeSearchQuery && activeSearchQuery.trim() !== "") {
            const normalizedSearch = activeSearchQuery.normalize('NFC');
            const escapedSearch = normalizedSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regexPattern = escapedSearch.replace(/\s+/g, '\\s+');
            const regex = new RegExp(`(highlight-red|highlight-green|highlight-search-temp|___[A-Z0-9_]+___|<[^>]*>)|(${regexPattern})`, 'g');
            escaped = escaped.replace(regex, (match, p1, p2) => {
                if (p1) return p1;
                return `<span class="highlight-search-temp">${p2}</span>`;
            });
        }

        // Phân tích thông minh theo từng dòng để định dạng căn lề (quốc hiệu, tiêu đề, ngày tháng, chữ ký) chuẩn Việt Nam
        const lines = escaped.split('\n');
        let inRightSignature = false;

        const formattedLines = lines.map(line => {
            const trimmedLine = line.trim();
            const upperLine = trimmedLine.toUpperCase();

            // Nếu dòng chứa các thẻ bảng hoặc token bảng biểu, bỏ qua việc bọc thẻ div định dạng
            const hasTableTag = /<table|<tr|<td|___TABLE_|___TR_|___TD_|___TBODY_/i.test(trimmedLine);
            if (hasTableTag) {
                return line;
            }

            // 0. Nhận diện và render hình ảnh trích xuất từ Word gốc
            if (trimmedLine.startsWith("[IMAGE:") && trimmedLine.endsWith("]")) {
                const inner = trimmedLine.substring(7, trimmedLine.length - 1);
                let base64Src = inner;
                let customStyle = "";

                const pipeIndex = inner.indexOf('|');
                if (pipeIndex !== -1) {
                    base64Src = inner.substring(0, pipeIndex);
                    const styleParts = inner.substring(pipeIndex + 1).split(';');
                    let wStyle = "";
                    let hStyle = "";
                    styleParts.forEach(part => {
                        if (part.startsWith('width:')) wStyle = part;
                        if (part.startsWith('height:')) hStyle = part;
                    });
                    if (wStyle && hStyle) {
                        customStyle = `${wStyle}; ${hStyle};`;
                    }
                }

                const imgStyle = customStyle ? customStyle : "max-width: 100%; max-height: 250px; height: auto;";
                return `<div style="text-align: center; margin: 15px 0;"><img src="${base64Src}" style="${imgStyle} border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); display: inline-block;"></div>`;
            }

            // 1. Quốc hiệu
            if (upperLine.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM")) {
                return `<div style="text-align: center; font-weight: bold; margin-bottom: 2px;">${trimmedLine}</div>`;
            }
            // 2. Tiêu ngữ (Hỗ trợ en-dash, em-dash, hyphen, dấu cách ngẫu nhiên)
            const isTieuNgu = /Độc\s+lập\s+[\-\–\—]\s+Tự\s+do\s+[\-\–\—]\s+Hạnh\s+phúc/i.test(trimmedLine);
            if (isTieuNgu) {
                return `<div style="text-align: center; font-weight: bold; margin-bottom: 15px;">${trimmedLine}</div>`;
            }
            // 3. Tiêu đề chính (BÁO CÁO, TỜ TRÌNH, BIÊN BẢN, v.v.)
            const isTitleKeyword = /^(BÁO CÁO|TỜ TRÌNH|BIÊN BẢN|QUYẾT ĐỊNH|KẾ HOẠCH|CÔNG VĂN|ĐỀ NGHỊ|DANH SÁCH|THÔNG BÁO|HỢP ĐỒNG)(\b|$)/i.test(trimmedLine);
            // Loại bỏ các thẻ HTML để so sánh chữ hoa/thường chính xác (tránh lỗi khi có thẻ span highlight)
            const cleanText = trimmedLine.replace(/<[^>]*>/g, '');
            if (isTitleKeyword && cleanText.length < 100 && cleanText === cleanText.toUpperCase() && cleanText.trim() !== "") {
                return `<div style="text-align: center; font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 1.15em; color: var(--primary-color);">${trimmedLine}</div>`;
            }
            // Tiêu đề phụ đi kèm ngay sau tiêu đề chính (ví dụ: "Về việc...", "V/v...")
            const isSubTitle = /^(về việc|v\/v)/i.test(trimmedLine);
            if (isSubTitle && trimmedLine.length < 120) {
                return `<div style="text-align: center; font-style: italic; margin-bottom: 15px; font-weight: 500;">${trimmedLine}</div>`;
            }
            // 4. Ngày tháng địa danh hành chính (ví dụ: "..., ngày ... tháng ... năm ...", hỗ trợ cả khoảng trống template)
            const isDateLine = /,\s*ngày\s*[\d\s._]*\s*tháng\s*[\d\s._]*\s*năm\s*[\d\s._]*\d{4}\s*\.?$/i.test(trimmedLine);
            if (isDateLine && trimmedLine.length < 100) {
                return `<div style="text-align: right; font-style: italic; margin-bottom: 12px; padding-right: 10px;">${trimmedLine}</div>`;
            }
            // 5. Nơi nhận hoặc Kính gửi
            if ((trimmedLine.startsWith("Kính gửi:") || trimmedLine.startsWith("Kính gửi :") || trimmedLine.startsWith("KÍNH GỬI:")) && trimmedLine.length < 120) {
                return `<div style="font-weight: bold; margin-top: 8px; margin-bottom: 8px;">${line}</div>`;
            }

            // 6. Định dạng chữ ký của người ký đơn lẻ ở cuối văn bản (Căn phải và căn giữa theo khối)
            const isSignatureTitle = /^(GIÁM ĐỐC|PHÓ GIÁM ĐỐC|THỦ TRƯỞNG|ĐẠI DIỆN|KẾ TOÁN TRƯỞNG|NGƯỜI LẬP BIỂU|NGƯỜI LẬP|NGƯỜI ĐỀ NGHỊ|KT\b)/i.test(trimmedLine) && !trimmedLine.includes(':');
            if (isSignatureTitle && trimmedLine.length < 150) {
                inRightSignature = true;
                return `<div style="text-align: center; margin-left: auto; margin-right: 20px; width: 320px; font-weight: bold; margin-top: 20px; font-size: 1.05em;">${trimmedLine}</div>`;
            }

            if (inRightSignature) {
                if (trimmedLine === "") {
                    return `<div></div>`;
                } else {
                    inRightSignature = false;
                    return `<div style="text-align: center; margin-left: auto; margin-right: 20px; width: 320px; font-weight: bold; margin-top: 60px;">${trimmedLine}</div>`;
                }
            }

            // Mặc định
            return `<div>${line}</div>`;
        });

        let result = formattedLines.join('');

        // Khôi phục các thẻ bảng HTML từ token an toàn
        result = result
            .replace(/___TABLE_OPEN___/g, '<table class="docx-table">')
            .replace(/___TABLE_SIMPLE_OPEN___/g, '<table>')
            .replace(/___TABLE_CLOSE___/g, '</table>')
            .replace(/___TBODY_OPEN___/g, '<tbody>')
            .replace(/___TBODY_CLOSE___/g, '</tbody>')
            .replace(/___TR_OPEN___/g, '<tr>')
            .replace(/___TR_CLOSE___/g, '</tr>')
            .replace(/___TD_OPEN___/g, '<td>')
            .replace(/___TD_CLOSE___/g, '</td>')
            .replace(/___BR___/g, '<br>');

        return result;
    },

    /**
     * Tự động convert placeholder {{TEN_BIEN}} thành thẻ mail-merge-tag
     */
    convertPlaceholdersToTags(htmlContent, variables, rowIndex = 1) {
        if (!htmlContent) return "";

        // 1. Chuyển đổi placeholders {{TEN_BIEN}} thành thẻ span
        const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
        let updatedHtml = htmlContent.replace(placeholderRegex, (match, varName) => {
            const cleanVarName = varName.trim();
            const value = this.getVariableValue(variables, cleanVarName, rowIndex);
            const displayText = value || `{{${cleanVarName}}}`;
            return `<span class="mail-merge-tag" data-variable="${cleanVarName}" contenteditable="true">${displayText}</span>`;
        });

        // 2. Cập nhật nội dung các thẻ span mail-merge-tag bằng Regex siêu thông minh để tránh làm hỏng cấu trúc bảng HTML
        const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
        updatedHtml = updatedHtml.replace(spanRegex, (match, attrs, content) => {
            if (!attrs.includes('mail-merge-tag')) return match;

            const varNameMatch = attrs.match(/data-variable="([^"]+)"/i);
            if (!varNameMatch) return match;
            const cleanVarName = varNameMatch[1].trim();

            const dataRowMatch = attrs.match(/data-row="(\d+)"/i);
            const targetRowIndex = dataRowMatch ? (parseInt(dataRowMatch[1]) || 1) : rowIndex;

            const value = this.getVariableValue(variables, cleanVarName, targetRowIndex);
            const displayText = value || `{{${cleanVarName}}}`;

            return `<span ${attrs.trim()}>${displayText}</span>`;
        });

        return updatedHtml;
    },

    /**
     * Cập nhật nội dung chi tiết cho màn hình Preview cụ thể của file
     */
    updateFilePreview(file, profile, activeSearchQuery = "") {
        const originalContainer = document.getElementById('preview-content-original');
        const editedContainer = document.getElementById('preview-content-edited');

        if (!file || !editedContainer) return;

        const variables = profile ? (profile.variables || []) : [];
        const rowIndex = (window.AppWorkspaceState && window.AppWorkspaceState.previewRowIndex) || 1;

        // Xử lý nạp nội dung cho editor
        let editedHtml = file.currentContent || "";
        const hasBlockTags = /<div|<p|<table/i.test(editedHtml);
        if (!hasBlockTags) {
            const lines = editedHtml.split('\n');
            editedHtml = lines.map(line => `<div>${line.trim() === "" ? '<br>' : line}</div>`).join('');
        }

        // Chuyển đổi placeholders thành tags trực quan trên editor
        editedContainer.innerHTML = this.convertPlaceholdersToTags(editedHtml, variables, rowIndex);

        // Tương tự cho originalContainer nếu có
        if (originalContainer) {
            let originalHtml = file.originalContent || "";
            if (!/<div|<p|<table/i.test(originalHtml)) {
                const lines = originalHtml.split('\n');
                originalHtml = lines.map(line => `<div>${line.trim() === "" ? '<br>' : line}</div>`).join('');
            }
            originalContainer.innerHTML = this.convertPlaceholdersToTags(originalHtml, variables, rowIndex);
        }
    }
};
