# Bản đồ Trí nhớ Dự án: Hồ sơ Thanh toán MobiFone Cần Thơ

Bản đồ trí nhớ này ghi nhận trạng thái và kiến trúc hiện tại của dự án nhằm giúp đồng bộ ngữ cảnh tức thì trong các phiên làm việc tiếp theo.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)
- **Frontend Core:** HTML5, Vanilla JavaScript (ES6) chạy trực tiếp trên trình duyệt.
- **Styling:** CSS3 (Variables, Grid, Flexbox, Keyframes transitions), không dùng thư viện CSS ngoài.
- **Icons & Fonts:** Font Inter (Google Fonts) và Lucide Icons (CDN).
- **Lưu trữ:** Web LocalStorage API (Đồng bộ trạng thái ngoại tuyến).

---

## 📁 Cấu trúc thư mục hiện tại
```text
payment_records/
├── index.html              # Bộ khung giao diện Single Page Application (SPA)
├── README.md               # Hướng dẫn chạy nhanh ứng dụng
├── css/
│   └── styles.css          # Định nghĩa tokens màu sắc, layout & animations (spin, fade, pulse)
├── docs/
│   ├── setup.md            # Hướng dẫn chạy chi tiết và kịch bản test
│   └── PROJECT_CONTEXT.md  # [FILE NÀY] Bản đồ ngữ cảnh đồng bộ dự án
└── js/
    ├── store.js            # Trình quản lý trạng thái kết nối tới Backend API
    ├── components.js       # Bộ sinh giao diện động cho các phân vùng chính
    └── app.js              # Trình bắt sự kiện và điều phối nghiệp vụ chính
```

---

## 🔄 Luồng Dữ liệu Chính (Data Flow)
1. **Khởi tạo:** `app.js` -> nạp `store.js` -> đồng bộ từ Backend API -> Render danh sách hồ sơ ở Sidebar (`components.js`).
2. **Tạo hồ sơ:** Người dùng điền modal -> `store.createProfile()` -> cập nhật Backend -> Render lại Sidebar -> Chọn làm active profile.
3. **Thêm tài liệu:** Người dùng kéo thả file hoặc chọn tải lên từ máy tính -> `store.addFileToProfile()` -> trạng thái hồ sơ quay về `"new"`.
4. **Quét lỗi:** Bấm quét -> `store.scanProfileFiles()` chạy progress bar -> dùng Regex trích xuất tất cả các đoạn `[RED:nội dung]` từ các file -> lưu danh sách cụm từ đỏ -> chuyển trạng thái hồ sơ sang `"scanned"`.
5. **Đồng bộ hàng loạt:** Người dùng nhập từ thay thế -> bấm đồng bộ -> `store.applyBulkReplacement()` -> duyệt qua các tệp được chọn, thực hiện thay thế (nếu là file docx sẽ thay thế trong XML) -> lưu trạng thái `"completed"` -> cập nhật preview.
6. **Xem trước & Tải về:** Trình preview hiển thị so sánh song song -> Người dùng chọn tải -> Hệ thống tái dựng file gốc với nội dung mới và trả về định dạng ban đầu (.docx/.doc/.txt) đảm bảo nguyên vẹn định dạng.

---

## 📌 Tiến độ Hiện tại
- **Đã hoàn thành (100%):**
  - [x] Thiết lập cấu trúc dự án.
  - [x] Thiết kế giao diện CSS tông xanh MobiFone và đỏ cảnh báo.
  - [x] Xây dựng store lưu trữ trạng thái kết nối Backend API.
  - [x] Loại bỏ dữ liệu mẫu và nút nạp nhanh, hỗ trợ 100% tài liệu thật.
  - [x] Xây dựng các components giao diện chính và ghép nối logic điều khiển.
  - [x] Hướng dẫn cài đặt và chạy thử nghiệm.
- **Trạng thái:** Dự án Frontend chạy độc lập đã sẵn sàng kiểm thử và sử dụng.
