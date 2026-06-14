# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG LÊN VERCEL & RENDER

Tài liệu này hướng dẫn chi tiết từng bước (Step-by-step) để bạn đưa ứng dụng lên các nền tảng đám mây miễn phí 24/7: Frontend chạy trên **Vercel**, Backend chạy trên **Render**, và Cơ sở dữ liệu chạy trên **MongoDB Atlas**.

---

## 1. TỔNG QUAN KIẾN TRÚC TRIỂN KHAI

Hệ thống được cấu trúc theo mô hình Client-Server độc lập:
- **Client (Frontend):** Trang web tĩnh HTML/CSS/JS chạy trên **Vercel** tại domain public (ví dụ: `https://your-app.vercel.app`).
- **Server (Backend API):** Server chạy Node.js/Express trên **Render** tại domain public (ví dụ: `https://your-api.onrender.com`).
- **Database (MongoDB):** Dữ liệu lưu trữ đám mây tại **MongoDB Atlas**.

```
[Trình duyệt Client] ---> [Frontend (Vercel)]
       |
       v (gọi API qua Internet)
[Backend (Render)] ----> [Database (MongoDB Atlas)]
```

---

## 2. BƯỚC 1: KHỞI TẠO CƠ SỞ DỮ LIỆU ONLINE (MONGODB ATLAS)

Vì chạy online, chúng ta không thể sử dụng MongoDB localhost được nữa. Hãy làm theo các bước sau để tạo Database miễn phí:

1. **Đăng ký/Đăng nhập:**
   - Truy cập trang chủ [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) và đăng ký một tài khoản miễn phí.
2. **Tạo Cluster mới:**
   - Nhấn **Create** để tạo một Database mới.
   - Chọn gói **M0 Free** (gói miễn phí trọn đời).
   - Chọn nhà cung cấp hạ tầng (AWS/Google Cloud) và khu vực gần nhất (ví dụ: Singapore - `ap-southeast-1` để có tốc độ kết nối nhanh nhất về Việt Nam).
   - Bấm **Create Deployment**.
3. **Thiết lập bảo mật (Security):**
   - **Database Access:** Tạo một tài khoản kết nối Database. Nhập Username (ví dụ: `mobifone_admin`) và Password (hãy lưu lại password này).
   - **Network Access:** Cho phép kết nối từ mọi địa chỉ IP bằng cách nhấn **Add IP Address** -> Điền `0.0.0.0/0` (đây là bước bắt buộc vì Render chạy trên các dải IP động, nếu không cho phép IP `0.0.0.0/0`, Render sẽ bị chặn kết nối đến Database).
4. **Lấy chuỗi kết nối (Connection String):**
   - Tại trang quản lý Cluster, bấm nút **Connect** -> Chọn **Drivers** (Node.js).
   - Copy chuỗi kết nối có định dạng như sau:
     ```
     mongodb+srv://mobifone_admin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Thay thế cụm `<password>` bằng mật khẩu bạn đã tạo ở bước trên, đồng thời chỉ định tên Database ở trước dấu `?` (ví dụ: `...mongodb.net/payment_records?retryWrites=...`).
   - Lưu chuỗi kết nối này lại để cấu hình cho Backend Render ở Bước 2.

---

## 3. BƯỚC 2: TRIỂN KHAI BACKEND LÊN RENDER

Render là nền tảng đám mây hỗ trợ chạy ứng dụng Node.js miễn phí rất tốt.

1. **Đưa mã nguồn lên GitHub:**
   - Tạo một kho lưu trữ (Repository) mới trên GitHub (ví dụ đặt tên là `payment-records-backend`).
   - Đẩy toàn bộ mã nguồn của thư mục `backend/` trong dự án của bạn lên GitHub.
     *(Lưu ý: Không đẩy thư mục `node_modules` và file `.env` chứa mật khẩu thật lên GitHub bằng cách khai báo trong file `.gitignore`)*.
2. **Liên kết với Render:**
   - Truy cập [Render](https://render.com/) và đăng nhập bằng tài khoản GitHub của bạn.
   - Tại màn hình Dashboard, bấm **New** -> Chọn **Web Service**.
   - Liên kết với Repository GitHub chứa mã nguồn backend vừa tạo ở trên.
3. **Cấu hình Web Service:**
   - **Name:** Đặt tên cho dịch vụ backend của bạn (ví dụ: `mobifone-payment-api`).
   - **Region:** Chọn khu vực máy chủ (khuyên dùng `Singapore` để kết nối nhanh nhất).
   - **Branch:** `main` (hoặc nhánh chứa code của bạn).
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Chọn gói **Free** ($0/month).
4. **Cấu hình biến môi trường (Environment Variables):**
   - Cuộn xuống chọn tab **Environment** hoặc **Advanced** -> Bấm **Add Environment Variable** để thêm 2 biến sau:
     - `PORT` = `10000`
     - `MONGODB_URI` = *[Dán chuỗi kết nối MongoDB Atlas đã lấy ở Bước 1]*
5. **Kích hoạt Deploy:**
   - Nhấn **Deploy Web Service** ở cuối trang.
   - Hệ thống sẽ tự động tải thư viện và khởi chạy. Khi màn hình console của Render hiện chữ `Backend API Server is running on port 10000` và `Connected to MongoDB successfully!`, trạng thái chuyển sang màu xanh **Live** là thành công.
   - Hãy copy link URL máy chủ backend được Render cấp ở trên cùng góc trái giao diện (đường link có dạng: `https://mobifone-payment-api.onrender.com`).

---

## 4. BƯỚC 3: CẤU HÌNH VÀ TRIỂN KHAI FRONTEND LÊN VERCEL

Vercel là dịch vụ lưu trữ và deploy Frontend tốc độ cao, hoàn toàn miễn phí.

1. **Cấu hình liên kết Backend:**
   - Mở file mã nguồn frontend của bạn tại đường dẫn [store.js](file:///d:/payment_records/frontend/js/store.js).
   - Tìm đến dòng `API_BASE` và đổi liên kết Render mẫu thành địa chỉ URL backend thật của bạn vừa lấy được ở Bước 2:
     ```javascript
     API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
         ? "http://localhost:5000/api"
         : "https://mobifone-payment-api.onrender.com/api", // <--- Dán link backend Render của bạn vào đây
     ```
2. **Đẩy mã nguồn Frontend lên GitHub:**
   - Tạo một Repository GitHub mới (ví dụ: `payment-records-frontend`).
   - Đẩy toàn bộ mã nguồn của thư mục `frontend/` lên GitHub (bao gồm cả file `vercel.json` chúng ta đã tạo sẵn).
3. **Liên kết với Vercel:**
   - Truy cập [Vercel](https://vercel.com/) và đăng nhập bằng tài khoản GitHub.
   - Nhấn **Add New** -> Chọn **Project** -> Chọn **Import** repository chứa frontend vừa đẩy lên.
4. **Cấu hình Deploy trên Vercel:**
   - **Framework Preset:** Chọn `Vite` (hoặc Other).
   - **Build Command:** `npm run build` (nếu dự án có cấu hình build Vite) hoặc để trống nếu chỉ chạy HTML tĩnh.
   - **Output Directory:** `dist` (hoặc `.` nếu là thư mục gốc của HTML tĩnh).
   - Bấm **Deploy**.
5. **Hoàn tất:**
   - Sau khi Vercel deploy xong, bạn sẽ nhận được một đường link URL công khai (dạng: `https://payment-records-frontend.vercel.app`).
   - Bạn có thể gửi link này cho sếp và mọi người truy cập vào xem 24/7 từ bất kỳ thiết bị nào!

---

## 5. KỊCH BẢN KIỂM THỬ TRÊN MÔI TRƯỜNG ONLINE

Sau khi đã triển khai thành công, hãy thực hiện kiểm thử theo kịch bản sau để đảm bảo hệ thống online hoạt động đúng logic:

1. **Bước 1: Kiểm thử giao diện**
   - Truy cập đường link website Vercel của bạn. Đảm bảo giao diện tải nhanh, các icons Lucide hiển thị đầy đủ và không bị lỗi vỡ layout.
2. **Bước 2: Tạo hồ sơ & Tải lên file**
   - Click nút **Tạo Hồ Sơ Mới** -> Nhập tên hồ sơ thử nghiệm.
   - Thử kéo thả hoặc chọn một file `.doc` cũ để tải lên.
     *Kết quả mong đợi:* Hệ thống lập tức từ chối, hiện Toast đỏ báo lỗi: *"Hệ thống đã chuẩn hóa chỉ nhận file .docx. Vui lòng Save As..."*.
   - Thử chọn một file `.docx` mới chuẩn chỉnh để tải lên.
     *Kết quả mong đợi:* Tệp tin tải lên thành công, nội dung văn bản hiển thị đầy đủ trong khung Side-by-side Preview.
3. **Bước 3: Tìm kiếm và thay thế**
   - Nhập từ khóa tìm kiếm có trong file `.docx` vừa tải.
   - Nhập từ khóa thay thế mới -> Bấm **Áp dụng sửa**.
     *Kết quả mong đợi:* Đoạn văn được thay thế thành công, nội dung cập nhật màu xanh lá cây trên giao diện Preview.
4. **Bước 4: Xuất bản ZIP hoàn chỉnh**
   - Chọn chế độ **Tự chọn tài liệu xuất bản** hoặc **Xuất toàn bộ** -> Bấm **Tải Xuống Hồ Sơ (.ZIP)**.
     *Kết quả mong đợi:* Nút bấm chuyển sang trạng thái disabled hiển thị spinner xoay tròn *"Đang xuất bản..."*. Sau vài giây, file ZIP được tải xuống máy của bạn, giải nén ra file `.docx` đã được cập nhật văn bản mới nhưng vẫn giữ nguyên 100% định dạng, bảng biểu ban đầu.
