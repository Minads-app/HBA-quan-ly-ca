# Giới Thiệu và Hướng Dẫn Sử Dụng Hệ Thống Lịch Quản Lý Nhân Sự (MinAds Soft)

## I. Giới Thiệu Chug
Hệ thống **Lịch Quản Lý Nhân Sự** do **MinAds Soft** phát triển là một giải pháp ứng dụng Web hiện đại (xây dựng bằng ReactJS và Firebase), giúp doanh nghiệp quản lý ca làm việc, phân bổ nhân sự và theo dõi lịch trình một cách tự động và trực quan. 

Hệ thống được thiết kế dành cho 2 nhóm đối tượng chính:
1. **Quản lý (Manager / Admin):** Người có toàn quyền quản lý nhân viên, khởi tạo lịch hàng tuần, phân ca, duyệt ca, thiết lập quy tắc hoạt động, và xem thống kê.
2. **Nhân viên (Staff / Cashier / Ticket Checker):** Tài khoản nhân viên dùng để xem lịch làm việc cá nhân, đăng ký ca làm, và theo dõi trạng thái phân ca.

Các vị trí nhân sự cơ bản được hỗ trợ: *Quản lý*, *Thu ngân*, và *Soát vé*.

---

## II. Các Tính Năng Nổi Bật
- **Quản lý Ca Làm Việc Trực Quan:** Hiển thị lưới lịch làm việc 7 ngày trong tuần, tự động nhận diện ngày hiện tại, chia rõ ca sáng/chiều/tối tùy cấu hình.
- **Khởi Tạo và Chốt Lịch Thông Minh:** Nút chức năng tự động đổ khuôn lịch cho tuần mới. Tính năng "Chốt lịch/Mở khóa" giúp khóa không cho nhân viên tự ý đổi lịch sau khi đã ấn định.
- **Trám Ca/Bổ Sung Nhân Sự:** Quản lý có thể nhanh chóng chỉ định (trám) một nhân sự khác vào vị trí đang thiếu trực tiếp trên giao diện lịch đồ.
- **Danh Sách Dự Bị:** Hỗ trợ tính năng nhân viên dự bị cho từng vị trí nếu ca làm đã đủ người.
- **Thiết Lập Động (Settings):** Tuỳ biến giờ làm của các ca, số lượng nhân sự tối đa cho từng vị trí, các ngày nghỉ lễ (Special Dates), hoặc quy định ngày nào mở ca nào trực tiếp trên trình duyệt mà không cần can thiệp vào code.
- **Phân Quyền Truy Cập:** Bảo mật cao với hệ thống đăng nhập, chuyển hướng người dùng tự động đúng với vai trò (Manager Dashboard vs Staff Dashboard).

---

## III. Hướng Dẫn Sử Dụng Dành Cho Quản Lý (Manager)

### 1. Đăng Nhập
- Sử dụng tài khoản có cấp quyền `manager` hoặc `admin` để đăng nhập.
- Sau khi đăng nhập thành công, hệ thống tự động chuyển hướng đến màn hình **Lịch (Manager Dashboard)**.

### 2. Màn Hình Lịch (Dashboard)
- **Xem Lịch:** Lưới lịch hiển thị danh sách các Ca (bên trái) và các Ngày trong tuần. Các ô trống hiển thị trạng thái hiện tại (Đã xếp người, Trống, Đang chờ duyệt, Nghỉ).
- **Đổi Tuần:** Sử dụng hai nút mũi tên `< >` ở góc phải trên cùng để chuyển sang xem lịch của tuần trước hoặc tuần tiếp theo.
- **Khởi Tạo Lịch:** Với một tuần mới tinh, hệ thống sẽ hiện nút **"Khởi tạo Lịch Tuần"**. Bấm vào để hệ thống tạo danh sách các ca làm việc trống dựa theo Cấu hình (Settings).
- **Chốt Lịch:** Nút có icon Hình Ổ Khóa dùng để **Chốt** lịch. Khi chốt, nhân sự không thể tự ý đăng ký/hủy ca trên app của họ nữa. Bạn có thể mở khóa lại nếu muốn.
- **Xóa ca / Dự bị:** Tại mỗi ô ca làm, quản lý có thể nhấn vào nút "X (Màu đỏ)" xuất hiện khi di chuột vào tên nhân viên để xóa họ khỏi ca hoặc hủy vị trí dự bị.
- **Trám Ca (+ Bổ sung):** Bấm vào nút `+ Bổ sung` ở dưới cùng của một ca đang thiếu người để mở cửa sổ Trám Ca. Tại đây, chọn nhân viên tương ứng với vị trí (Thu ngân/Soát vé,..) để ép người đó vào ca.

### 3. Mục Nhân Sự (User Management)
- Xem danh sách toàn bộ nhân sự trên hệ thống.
- Chức năng: **Thêm mới**, **Khóa/Mở Khóa** (inactive) tài khoản, thay đổi quyền (role) và vị trí có thể làm việc (positions) của nhân viên.

### 4. Mục Cài Đặt (Settings)
Góc phải màn hình quản lý, bạn truy cập tab "Cài đặt" để cấu hình tự động hóa:
- **Thời gian phân ca:** Đặt giờ bắt đầu/kết thúc cho Ca 1, Ca 2, Ca 3,...
- **Cấu hình ca mặc định (Weekly Defaults):** Chọn xem Thứ 2 có mở Ca 1 và Ca 2 không, Chủ nhật có mở Ca 3 không,... để lúc Khởi tạo lịch hệ thống làm theo khung này.
- **Cấu hình số lượng định biên (Staff Slots):** Điều chỉnh mỗi ca cần bao nhiêu lễ tân, bao nhiêu phục vụ/soát vé tối đa.
- **Ngày Đặc Biệt (Ngưng ca/Nghỉ lễ):** Ngăn không cho phát sinh lịch vào các ngày nghỉ lễ.

### 5. Mục Thống Kê (Thống kê)
- Cung cấp cái nhìn tổng quan về số ca đã làm của từng nhân sự, hỗ trợ xuất dữ liệu báo cáo chấm công tính lương cuối tháng.

---

## IV. Hướng Dẫn Sử Dụng Dành Cho Nhân Viên (Staff)

### 1. Đăng nhập và Xem Lịch
- Nhân viên sử dụng tài khoản được Quản lý cấp để đăng nhập.
- Giao diện Staff Menu sẽ hiển thị thẳng lịch làm việc cá nhân và lịch tổng của cửa hàng ở chế độ Xem.

### 2. Đăng ký Ca làm (Staff Registration)
- Ở giao diện đăng ký, nhân viên có thể xem các tuần hiện tại hoặc tương lai (những tuần mà quản lý **Đã mở khóa**).
- Tại các ô ca làm việc đang còn trống vị trí chuyên môn của mình, nhân viên bấm **"Đăng ký"**. 
- Nếu ca đã đủ số lượng quy định, nhân viên có thể bấm đăng ký để lọt vào **"Danh sách dự bị"**. 
- Trạng thái ca sau khi chọn sẽ là "Chờ xác nhận" (Pending) cho đến khi Quản lý duyệt/Chốt lịch tuần.

### 3. Rút ca / Hủy ca
- Khi quản lý chưa Chốt Lịch (Khóa lịch), nhân viên có thể bấm "Hủy" trên các ca mình đã đăng ký nếu có việc bận đột xuất.
- Nếu lịch đã bị Chốt, chức năng đăng ký/hủy sẽ bị ẩn. Nhân viên buộc phải liên hệ Quản lý để xin "Trám ca".

---

> **Lưu ý Bổ sung về Kỹ Thuật (Cho Developer):**
> 1. Source code sử dụng React (Vite) và Tailwind CSS.
> 2. Database ở Firestore: Mọi thay đổi lịch được đồng bộ thời gian thực (realtime) tới toàn bộ thiết bị qua hàm `onSnapshot`.
> 3. Để triển khai (Deploy) cập nhật mới lên Internet cho người dùng: 
>    - Chạy `npm run build` sau đó `firebase deploy`. Không quên push code lên repo Github để lưu dự phòng!
