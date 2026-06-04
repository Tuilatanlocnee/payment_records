/**
 * ==========================================================================
 * UI COMPONENTS - CÁC THÀNH PHẦN GIAO DIỆN TÌM KIẾM VÀ THAY THẾ ĐỘNG
 * ==========================================================================
 */

window.Components = {
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
        
        if (!container) return;

        // Cập nhật số lượng hồ sơ
        countBadge.textContent = `${profiles.length} hồ sơ`;

        if (profiles.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 10px; color: var(--text-secondary); font-size: 13px;">
                    <i data-lucide="info" style="margin: 0 auto 10px auto; display: block; opacity: 0.5;"></i>
                    Chưa có hồ sơ thanh toán nào được tạo.
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = profiles.map(profile => {
            const isActive = profile.id === activeId ? 'active' : '';
            const fileCount = profile.files ? profile.files.length : 0;
            
            return `
                <li class="profile-item ${isActive}" data-id="${profile.id}" id="profile-item-${profile.id}">
                    <h4>${profile.name}</h4>
                    <div class="profile-meta">
                        <span>${fileCount} tài liệu</span>
                    </div>
                </li>
            `;
        }).join('');

        lucide.createIcons();
    },

    /**
     * Render chi tiết của một hồ sơ đang hoạt động
     */
    renderProfileDetail(profile) {
        const container = document.getElementById('profile-detail-container');
        const emptyState = document.getElementById('empty-state');
        
        if (!container || !emptyState) return;

        if (!profile) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        const hasReplacements = profile.replacements && profile.replacements.length > 0;

        container.innerHTML = `
            <!-- Tiêu đề chi tiết hồ sơ -->
            <div class="detail-header">
                <div class="detail-title-wrapper" style="min-width: 0;">
                    <h2>${profile.name}</h2>
                    <div class="detail-subtitle">
                        Tạo lúc: <strong>${this.formatDate(profile.createdAt)}</strong>
                    </div>
                </div>
                <div class="detail-actions" style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" id="btn-reset-profile" data-id="${profile.id}" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">
                        <i data-lucide="refresh-cw"></i>
                        Khôi phục bản gốc
                    </button>
                    <button class="btn btn-danger" id="btn-delete-profile" data-id="${profile.id}">
                        <i data-lucide="trash-2"></i>
                        Xóa hồ sơ
                    </button>
                </div>
            </div>

            <!-- Khối 1: Tải lên tài liệu và Quản lý file -->
            <div class="card" id="card-files-section">
                <div class="card-title">
                    <i data-lucide="file-text"></i> Danh sách tài liệu trong hồ sơ
                </div>
                
                <!-- Dropzone kéo thả file -->
                <div class="upload-dropzone" id="file-dropzone">
                    <i data-lucide="upload-cloud" style="width: 40px; height: 40px;"></i>
                    <p>Kéo và thả các tài liệu cần thanh toán vào đây hoặc <strong>bấm để chọn file</strong></p>
                    <small style="color: var(--text-muted);">Hỗ trợ các file văn bản (.txt, .doc, .docx).</small>
                    <input type="file" id="file-input-hidden" class="hidden" multiple accept=".txt,.doc,.docx">
                </div>

                <!-- Nút nạp nhanh file mẫu để trải nghiệm hệ thống -->
                <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: var(--text-secondary);">Bạn chưa có file mẫu?</span>
                    <button class="btn btn-secondary" id="btn-load-mock-files" style="height: 30px; font-size: 11px; padding: 0 10px;">
                        <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                        Nạp nhanh bộ tài liệu mẫu MobiFone
                    </button>
                </div>

                <!-- Danh sách các file hiện tại -->
                <ul class="file-list" id="detail-file-list">
                    ${this.renderFiles(profile.files, profile.id)}
                </ul>
            </div>

            <!-- Khối 2: Bảng Tìm kiếm & Thay thế văn bản -->
            <div class="card" id="card-search-replace-section">
                ${this.renderSearchBlock(profile)}
            </div>

            <!-- Khối 3: Trình xem trước (Split Preview) & Xuất hồ sơ hoàn chỉnh -->
            <div class="card ${hasReplacements ? '' : 'hidden'}" id="card-preview-section">
                ${this.renderPreviewBlock(profile)}
            </div>
        `;

        lucide.createIcons();
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
            <li class="file-item">
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
     * Dựng nội dung khu vực Tìm kiếm và Thay thế
     */
    renderSearchBlock(profile) {
        const fileCount = profile.files ? profile.files.length : 0;

        if (fileCount === 0) {
            return `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <i data-lucide="search" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 13px;">Vui lòng thêm tài liệu vào hồ sơ để thực hiện tìm kiếm & thay thế đồng bộ.</p>
                </div>
            `;
        }

        return `
            <div class="card-title">
                <i data-lucide="search"></i> Tìm kiếm & Thay thế văn bản hàng loạt
            </div>
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
            lucide.createIcons();
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
        lucide.createIcons();
    },

    /**
     * Dựng nội dung khu vực xem trước (Preview) và Xuất file
     */
    renderPreviewBlock(profile) {
        if (!profile.files || profile.files.length === 0) return '';

        const options = profile.files.map((file, idx) => `
            <option value="${file.id}" ${idx === 0 ? 'selected' : ''}>${file.name}</option>
        `).join('');

        return `
            <div class="card-title">
                <i data-lucide="eye" style="color: var(--primary-color);"></i>
                Trình Xem Trước & Xuất Bản Ghi Hoàn Chỉnh
            </div>
            <div class="preview-pane-wrapper">
                <div class="preview-selector">
                    <label for="select-preview-file" style="font-size: 13px; font-weight: 600;">Chọn tài liệu xem trước:</label>
                    <select id="select-preview-file">
                        ${options}
                    </select>
                </div>

                <!-- Bố cục so sánh 2 bên (Split View) -->
                <div class="preview-split-container">
                    <!-- Bên trái: Tài liệu gốc (Highlight Đỏ từ cũ) -->
                    <div class="preview-column">
                        <div class="preview-column-header original">
                            <span>VĂN BẢN GỐC (CHƯA SỬA)</span>
                            <span class="badge" style="background-color: var(--accent-red-bg); color: var(--accent-red);">Cụm từ gốc</span>
                        </div>
                        <div class="preview-body-content" id="preview-content-original">
                            <!-- Nội dung được cập nhật động bằng js -->
                        </div>
                    </div>

                    <!-- Bên phải: Tài liệu sau khi chỉnh sửa (Highlight Xanh từ mới) -->
                    <div class="preview-column">
                        <div class="preview-column-header edited">
                            <span>VĂN BẢN ĐÃ SỬA (KẾT QUẢ ĐỒNG BỘ)</span>
                            <span class="badge" style="background-color: var(--accent-green-bg); color: var(--accent-green);">Đã thay thế</span>
                        </div>
                        <div class="preview-body-content" id="preview-content-edited">
                            <!-- Nội dung được cập nhật động bằng js -->
                        </div>
                    </div>
                </div>

                <!-- Footer chứa lựa chọn hình thức xuất bản và nút tải tệp ZIP duy nhất -->
                <div class="export-options-container">
                    <h3 class="export-section-title" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="download-cloud" style="color: var(--primary-color);"></i>
                        Tùy chọn xuất hồ sơ thanh toán
                    </h3>
                    
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
            </div>
        `;
    },

    formatContentForPreview(content, type, replacements = [], activeSearchQuery = "") {
        if (!content) return '';
        
        let escaped = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Highlight các từ cũ/mới đã được thay thế thành công
        if (replacements && replacements.length > 0) {
            if (type === 'original') {
                // Highlight các từ cũ đã bị thay thế bằng màu đỏ
                replacements.forEach(({ findText }) => {
                    if (!findText) return;
                    const escapedFind = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`(${escapedFind})`, 'g');
                    escaped = escaped.replace(regex, '<span class="highlight-red">$1</span>');
                });
            } else {
                // Highlight các từ mới thay thế bằng màu xanh lá
                replacements.forEach(({ replaceText }) => {
                    if (!replaceText) return;
                    const escapedReplace = replaceText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`(${escapedReplace})`, 'g');
                    escaped = escaped.replace(regex, '<span class="highlight-green">$1</span>');
                });
            }
        }

        // Highlight từ khóa đang tìm kiếm tạm thời bằng màu vàng nhạt (chưa thay thế)
        if (activeSearchQuery && activeSearchQuery.trim() !== "") {
            const escapedSearch = activeSearchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(${escapedSearch})`, 'gi'); // Không phân biệt chữ hoa chữ thường khi tìm kiếm
            escaped = escaped.replace(regex, '<span class="highlight-search-temp">$1</span>');
        }
        
        return escaped;
    },

    /**
     * Cập nhật nội dung chi tiết cho màn hình Preview cụ thể của file
     */
    updateFilePreview(file, profile, activeSearchQuery = "") {
        const originalContainer = document.getElementById('preview-content-original');
        const editedContainer = document.getElementById('preview-content-edited');

        if (!file || !originalContainer || !editedContainer) return;

        const replacements = profile ? profile.replacements : [];

        originalContainer.innerHTML = this.formatContentForPreview(file.originalContent, 'original', replacements, activeSearchQuery);
        editedContainer.innerHTML = this.formatContentForPreview(file.currentContent, 'edited', replacements, activeSearchQuery);
    }
};
