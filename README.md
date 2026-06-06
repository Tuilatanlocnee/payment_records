# Hệ thống Tự động hóa & Đồng bộ Hồ sơ Thanh toán (MobiFone Cần Thơ)

Dự án này là ứng dụng Client-Server hỗ trợ quản lý và xử lý đồng bộ hồ sơ thanh toán: tạo hồ sơ, tải lên tài liệu, tự động quét nhận diện các lỗi/cụm từ màu đỏ cần thay thế, đồng bộ hàng loạt trên nhiều file và so sánh kết quả trực quan (Split Preview) trước khi xuất bản ghi hoàn chỉnh.

---

## 1. Tổng quan Kiến trúc Hệ thống (Client-Server)
Hệ thống được thiết kế theo mô hình Client-Server chuyên nghiệp, phân tách rõ ràng vai trò hiển thị và lưu trữ dữ liệu:
- **Frontend Client (`/frontend`)**: Ứng dụng SPA (Single Page Application) sử dụng HTML/CSS và Javascript kết nối API, được biên dịch và chạy bằng **Vite** trên cổng `5173`.
- **Backend API Server (`/backend`)**: Máy chủ **ExpressJS (Node.js)** trên cổng `5000`, xử lý các dịch vụ lưu trữ dữ liệu tệp tin dạng JSON (`db.json`), quét Regex nhận diện lỗi và đồng bộ thay thế hàng loạt.

---

## 2. Yêu cầu Hệ thống (Prerequisites)
Để vận hành hệ thống, bạn cần cài đặt sẵn:
- **Node.js**: Phiên bản LTS mới nhất (Khuyến nghị phiên bản 18+ hoặc 20+).
- **Trình duyệt Web**: Google Chrome, Microsoft Edge hoặc các trình duyệt hiện đại khác.

---

## 3. Hướng dẫn chạy từng bước (Yêu cầu chạy 2 Terminal)

Bạn bắt buộc phải khởi chạy đồng thời cả Backend và Frontend để hệ thống hoạt động.

### Bước 1: Khởi chạy máy chủ Backend (Terminal 1)
1. Mở cửa sổ Terminal thứ nhất (Command Prompt hoặc PowerShell).
2. Di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
3. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
   *Kết quả mong đợi:* Terminal sẽ tải và cài đặt các gói `express`, `cors`, `dotenv` và `nodemon` thành công không có lỗi đỏ.
4. Chạy server phát triển (Dev server):
   ```bash
   npm run dev
   ```
   *Kết quả mong đợi:* Terminal sẽ hiển thị dòng thông báo:
   ```text
   Backend API Server is running on port 5000
   ```

---

### Bước 2: Khởi chạy máy chủ Frontend (Terminal 2)
1. Mở cửa sổ Terminal thứ hai.
2. Di chuyển vào thư mục frontend:
   ```bash
   cd frontend
   ```
3. Cài đặt Vite làm máy chủ phục vụ giao diện:
   ```bash
   npm install
   ```
   *Kết quả mong đợi:* Thư mục `node_modules` được tạo ra trong `frontend/` với máy chủ Vite được cài đặt hoàn tất.
4. Chạy dev server của Frontend:
   ```bash
   npm run dev
   ```
   *Kết quả mong đợi:* Terminal sẽ hiển thị thông báo chạy thành công của Vite kèm địa chỉ truy cập:
   ```text
     VITE v5.2.0  ready in 120 ms
     ➜  Local:   http://localhost:5173/
   ```
5. Mở trình duyệt web và truy cập vào địa chỉ **`http://localhost:5173/`** để bắt đầu trải nghiệm ứng dụng.

---

## 4. Cấu hình Biến môi trường (Configuration)
Hệ thống sử dụng các tệp cấu hình môi trường để cấu hình cổng hoạt động:
- Các cấu hình mẫu được khai báo sẵn tại [backend/.env.example](file:///d:/payment_records/backend/.env.example).
- Khi chạy ở local, hệ thống đã khởi tạo sẵn một tệp [.env](file:///d:/payment_records/backend/.env) trống. Bạn có thể thêm biến cấu hình như `PORT=5000` tại đây nếu muốn đổi cổng.

---

## 5. Kịch bản Kiểm thử & Demo Chức năng (Test Cases)

Hãy thực hiện theo quy trình kiểm thử dưới đây để xác nhận toàn bộ tính năng hoạt động đồng nhất qua REST API:

1. **Tạo hồ sơ mới**: Nhấp vào nút **"Tạo Hồ Sơ Mới"** trên Header -> Nhập tên hồ sơ -> Xác nhận. Bạn sẽ thấy Toast báo thành công và hồ sơ được lưu trực tiếp vào tệp dữ liệu [backend/db.json](file:///d:/payment_records/backend/db.json).
2. **Nạp dữ liệu mẫu**: Chọn hồ sơ mới -> Nhấn nút **"Nạp nhanh bộ tài liệu mẫu MobiFone"**. Hệ thống sẽ gọi API tải và nạp 3 tài liệu demo từ Backend vào hồ sơ của bạn.
3. **Quét lỗi**: Bấm nút **"Tiến hành quét tài liệu ngay"** (Màu đỏ). Bạn sẽ thấy hiệu ứng thanh tiến trình chạy. Khi hoàn thành, backend sẽ phân tích các lỗi màu đỏ (`[RED:...]`) và trả về danh sách lỗi hiển thị trong bảng.
4. **Đồng bộ hàng loạt**: Nhập các giá trị chuẩn hóa mới ở cột Thay thế -> Đảm bảo đã chọn **"Đồng bộ tất cả"** -> Nhấn **"Áp dụng & Đồng bộ hàng loạt"**. Backend sẽ xử lý sửa đổi toàn bộ các tệp tin chứa lỗi đó và cập nhật trạng thái hồ sơ sang `"Hoàn thành"`.
5. **Xem trước & Xuất bản**: Chọn từng tệp tin ở dropdown preview để xem so sánh trực quan văn bản gốc và văn bản đã được chuẩn hóa. Nhấn **"Xuất Hồ Sơ Hoàn Chỉnh (.TXT)"** để tải tệp tin sạch đã được gỡ bỏ thẻ tag lỗi.
