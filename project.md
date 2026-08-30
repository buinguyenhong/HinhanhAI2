# Dự án: AI Image Studio (Công cụ chỉnh sửa ảnh AI tùy chỉnh)

## 1. Giới thiệu chung
AI Image Studio là một công cụ chỉnh sửa hình ảnh đơn lẻ chất lượng cao, hoạt động dựa trên việc tích hợp và gọi các API AI tùy chỉnh. Ứng dụng hỗ trợ người dùng tinh chỉnh hình ảnh chuyên sâu, phân tích prompt thông minh và có khả năng xuất file trực tiếp vào Google Drive. Toàn bộ giao diện được thiết kế chuyên nghiệp, trực quan và sử dụng 100% ngôn ngữ tiếng Việt.

## 2. Các tính năng cốt lõi (Theo yêu cầu)

### 2.1. Khu vực Chỉnh sửa (Editor)
- **Quản lý file đầu vào:** Hỗ trợ tải "Ảnh Gốc" (bắt buộc để xử lý) và "Ảnh Mẫu" (tùy chọn để tham khảo phong cách).
- **Phân tích AI & Trích xuất Prompt:** Tính năng tự động đọc hiểu ảnh mẫu và viết ra một câu lệnh (prompt) chuẩn chỉnh, ngôn ngữ dễ hiểu cho AI, bao gồm đầy đủ các keyword chuyên nghiệp.
- **Tùy chỉnh thông số đầu ra:**
  - Cài đặt số lượng ảnh cần tạo (batch size từ 1 đến 4 biến thể).
  - Tùy chọn: **Giữ nguyên cấu trúc chủ thể** (đảm bảo không thay đổi gương mặt, hình thể, quần áo, vị trí... thông qua các công nghệ như ControlNet hoặc IP-Adapter).
  - Tùy chọn: **Giữ tỷ lệ khung hình gốc** của bức ảnh.
- **Quy trình duyệt và lưu ảnh:**
  - Giao diện chờ tạo ảnh (loading) chuyên nghiệp.
  - Hiển thị kết quả dạng lưới để người dùng so sánh.
  - Cho phép người dùng click chọn 1 bức ảnh ưng ý nhất (chốt hình).
  - Có nút **"Chưa ưng ý, tạo lại"** để bắt đầu lại quy trình.
  - Nút **"Chốt hình & Lưu lên Drive"** để tải file ảnh chất lượng cao trực tiếp vào Google Drive.

### 2.2. Bảng điều khiển (Dashboard)
- Quản lý hạn mức sử dụng (Token Limit) và Số Token đã sử dụng (Token Used) trực quan qua thanh tiến trình (Progress bar).
- Thống kê tổng số lượng hình ảnh đã được tạo ra.
- Bảng ước tính chi phí API chi tiết (So sánh giữa chi phí xử lý thường và chi phí khi bật ControlNet giữ nguyên chủ thể).
- Theo dõi thông tin lưu trữ Google Drive (Trạng thái kết nối, dung lượng dự kiến tiêu tốn cho mỗi ảnh, tổng dung lượng đã lưu).

### 2.3. Lịch sử (History)
- Tự động lưu trữ lịch sử các lần chỉnh sửa hình ảnh.
- Lưu lại các tham số (Prompt, thời gian tạo) vào bộ nhớ cục bộ nhằm tiết kiệm dung lượng, hiển thị trực quan dạng lưới để dễ dàng xem lại.

### 2.4. Cài đặt hệ thống (Settings)
- **Cấu hình API Tùy chỉnh:** Giao diện cho phép người dùng tự điền Endpoint URL và API Key của nhà cung cấp. API Key được lưu trữ bảo mật cục bộ trên trình duyệt.
- **Kết nối Google Drive:** Nút kết nối Google (OAuth) để cấp quyền cho ứng dụng tự động upload ảnh xuất ra lên bộ nhớ Drive của người dùng.

### 2.5. Bảo mật & Xác thực (Đăng nhập)
- **Màn hình đăng nhập (Login):** Ứng dụng được bảo vệ bởi một lớp đăng nhập cơ bản trước khi truy cập vào không gian làm việc.
- **Biến môi trường Vercel:** Mật khẩu và session secret được quản lý server-side qua `APP_PASSWORD` và `SESSION_SECRET`; không dùng biến `VITE_` cho secret. Cấu hình Google OAuth được triển khai sau khi có client credentials production.
