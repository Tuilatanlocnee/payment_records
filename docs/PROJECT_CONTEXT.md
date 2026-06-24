# Bản đồ Trí nhớ Dự án: Hồ sơ Thanh toán MobiFone Cần Thơ

Bản đồ trí nhớ này ghi nhận trạng thái và kiến trúc hiện tại của dự án nhằm giúp đồng bộ ngữ cảnh tức thì trong các phiên làm việc tiếp theo.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)
- **Frontend Core:** HTML5, Vanilla JavaScript (ES6) chạy trực tiếp trên trình duyệt.
- **Styling:** CSS3 (Variables, Grid, Flexbox, Keyframes transitions), thiết kế giao diện theo tông màu MobiFone (xanh dương đậm và đỏ) sang trọng, chuyên nghiệp.
- **Biên tập & Mail Merge:** XLSX parser (đọc Excel client), Rich Text Editor (`contenteditable="true"`), hệ thống thẻ Mail Merge `<span class="mail-merge-tag" data-variable="...">`.
- **Backend API:** Node.js Express Server, xử lý trích xuất XML Word, giải nén ZIP.
- **Cơ sở dữ liệu:** MongoDB với Mongoose ODM (Profile, File, Image, Setting).
- **Thư viện xuất bản Word:** `html-to-docx` chuyển đổi HTML soạn thảo sang file `.docx` thực tế giữ nguyên định dạng.

---

## 📁 Cấu trúc thư mục hiện tại
```text
payment_records/
├── README.md               # Hướng dẫn chạy nhanh ứng dụng
├── docs/
│   ├── setup.md            # Hướng dẫn chạy chi tiết và kịch bản test
│   ├── PROJECT_CONTEXT.md  # [FILE NÀY] Bản đồ ngữ cảnh đồng bộ dự án
│   └── ONBOARDING.md       # Tài liệu onboarding thành viên mới
├── backend/
│   ├── server.js           # Máy chủ API Express, Mongoose Schemas, dịch vụ chuyển đổi docx
│   ├── package.json        # Dependencies (html-to-docx, mongoose, word-extractor, adm-zip)
│   ├── .env                # Biến cấu hình môi trường thực tế (trống)
│   └── .env.example        # File biến cấu hình mẫu
└── frontend/
    ├── index.html          # Bộ khung giao diện Single Page Application (SPA)
    ├── css/
    │   └── styles.css      # CSS tokens màu sắc, Rich Text Editor, Dropzones, gallery ảnh
    └── js/
        ├── store.js        # Trình quản lý trạng thái kết nối tới Backend API
        ├── components.js   # Bộ sinh giao diện động cho các phân vùng chính
        └── app.js          # Trình bắt sự kiện và điều phối nghiệp vụ chính
```

---

## 🔄 Luồng Dữ liệu Chính (Data Flow)
1. **Khởi tạo:** `app.js` -> nạp `store.js` -> gọi `GET /api/profiles` -> nhận danh sách hồ sơ từ MongoDB -> Render danh sách hồ sơ ở Sidebar (`components.js`) phân chia theo 2 nhóm (Hồ sơ gốc & Hồ sơ chỉnh sửa).
2. **Tạo hồ sơ:** 
   - Nếu là **Hồ sơ gốc (Template)**: Khởi tạo trống trên MongoDB.
   - Nếu là **Hồ sơ chỉnh sửa**: Chọn liên kết tới Hồ sơ gốc mẫu -> Backend tự động clone toàn bộ danh mục biến (`variables`) và sao chép các tệp tài liệu (`files`) sang hồ sơ mới.
3. **Quản lý biến (Mail Merge):** 
   - Tải file Excel/CSV lên -> client tự động trích xuất các cột thành các biến -> Lưu qua `PUT /api/profiles/:id/variables`.
   - Thay đổi giá trị biến ở bảng điều khiển bên trái -> Backend cập nhật DB -> Tự động quét và thay thế text hiển thị trên tất cả thẻ `span.mail-merge-tag` thuộc các file của hồ sơ.
4. **Trình soạn thảo Rich Text & Đồng bộ ngược:** 
   - Soạn thảo trực tiếp trên `preview-content-edited` (`contenteditable="true"`). Chèn biến tại vị trí con trỏ chuột (chuột phải mở menu ngữ cảnh).
   - Người dùng chỉnh sửa trực tiếp giá trị của thẻ Mail Merge trong văn bản -> Khi mất focus (blur), client tự động lưu thông qua API -> Backend phát hiện các thẻ đã bị thay đổi giá trị -> Lưu ngược lại vào danh mục biến chung của Profile -> Đồng bộ sang các tài liệu khác.
5. **Ảnh minh chứng:** Tải lên ảnh (Biên lai, chứng từ) dưới dạng Base64 -> Lưu trực tiếp vào schema `Image` trong MongoDB -> Hiển thị gallery ảnh trực quan kèm lightbox phóng to.
6. **Đóng gói & Xuất bản:** Bấm xuất bản ZIP -> Gọi API -> Backend dùng `html-to-docx` chuyển đổi HTML soạn thảo sang file `.docx` thực tế có định dạng hoàn chỉnh -> Đóng gói toàn bộ vào file ZIP trả về client tải xuống.

---

## 📌 Tiến độ Hiện tại
- **Đã hoàn thành (100%):**
  - [x] Nâng cấp schema Mongoose hỗ trợ phân loại hồ sơ, biến và ảnh minh chứng.
  - [x] Triển khai tính năng tự động clone tài liệu & biến từ Hồ sơ gốc.
  - [x] Xây dựng cơ chế đồng bộ biến hai chiều: từ bảng điều khiển sang văn bản và từ thẻ soạn thảo ngược về danh mục.
  - [x] Tích hợp bộ Rich Text Word Editor trên giao diện và thư viện `html-to-docx` ở Backend.
  - [x] Hoàn thiện tính năng tải/xóa ảnh minh chứng dạng Base64 lưu trữ trong MongoDB.
  - [x] Viết script kiểm thử tự động xác thực toàn bộ luồng nghiệp vụ không có lỗi.
- **Trạng thái:** Dự án đã sẵn sàng hoạt động ở môi trường local và staging.
