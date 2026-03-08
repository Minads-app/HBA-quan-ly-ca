# 📋 HR Manager — Hệ thống Quản lý Ca làm việc

> **Phiên bản:** 1.0 · **Cập nhật:** 08/03/2026  
> **URL:** [https://qlns-q3.web.app](https://qlns-q3.web.app)  
> **Bản quyền:** © MinAds Soft

---

## 📖 Giới thiệu

**HR Manager** là ứng dụng web quản lý ca làm việc (shift scheduling) dành cho doanh nghiệp vừa và nhỏ. Hệ thống cho phép quản lý phân ca, nhân viên tự đăng ký ca, theo dõi thống kê — tất cả hoạt động realtime trên nền tảng đám mây.

### Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS 4 |
| Backend / Database | Firebase (Authentication + Cloud Firestore) |
| Hosting | Firebase Hosting |
| Icons | Lucide React |

### Kiến trúc dự án

```
shift-app/
├── src/
│   ├── contexts/AuthContext.tsx    # Xác thực & phân quyền
│   ├── firebase/
│   │   ├── config.ts              # Cấu hình Firebase
│   │   └── api.ts                 # API giao dịch Firestore (đăng ký/hủy ca...)
│   ├── hooks/useCompanyInfo.ts    # Hook lấy thông tin công ty
│   ├── pages/
│   │   ├── Login.tsx              # Trang đăng nhập
│   │   ├── ManagerDashboard.tsx   # Bảng lịch tuần (Admin/Manager)
│   │   ├── StaffDashboard.tsx     # Thống kê ca làm việc
│   │   ├── UserManagement.tsx     # Quản lý tài khoản nhân sự
│   │   ├── Settings.tsx           # Cài đặt hệ thống (chỉ Admin)
│   │   └── StaffRegistration.tsx  # Đăng ký ca (Nhân viên)
│   ├── services/schedule.ts       # Sinh lịch tuần tự động
│   ├── types/index.ts             # TypeScript interfaces
│   └── App.tsx                    # Routing & phân quyền
├── firestore.rules                # Quy tắc bảo mật Firestore
├── firebase.json                  # Cấu hình Firebase Hosting
└── package.json
```

---

## 👥 Hệ thống phân quyền (4 vai trò)

| Vai trò | Mã hệ thống | Quyền hạn |
|---|---|---|
| **Quản trị viên** | `admin` | Toàn quyền: Cài đặt, Quản lý nhân sự, Lịch, Thống kê, Xóa tài khoản |
| **Quản lý** | `manager` | Lịch (xem/khởi tạo/chốt/xóa), Trám ca, Nhân sự (tạo/sửa), Thống kê. **Không được truy cập Cài đặt** |
| **Thu ngân** | `cashier` | Đăng ký ca, Xem lịch cá nhân, Chốt sổ tuần |
| **Soát vé** | `ticket_checker` | Đăng ký ca, Xem lịch cá nhân, Chốt sổ tuần |

### Đường dẫn (URL) theo vai trò

| URL | Vai trò truy cập | Trang |
|---|---|---|
| `/login` | Tất cả | Đăng nhập |
| `/manager` | Admin, Manager | Bảng lịch tuần |
| `/manager/dashboard` | Admin, Manager | Thống kê ca |
| `/manager/users` | Admin, Manager | Quản lý nhân sự |
| `/manager/settings` | **Chỉ Admin** | Cài đặt hệ thống |
| `/staff` | Cashier, Ticket Checker | Đăng ký ca làm việc |

---

## 🔐 Đăng nhập

1. Truy cập ứng dụng tại URL hệ thống
2. Nhập **Email** và **Mật khẩu** đã được cấp
3. Bấm **Đăng nhập**
4. Hệ thống tự động chuyển hướng theo vai trò:
   - Admin / Manager → Bảng Lịch Quản Lý (`/manager`)
   - Cashier / Ticket Checker → Trang Đăng ký Ca (`/staff`)

> ⚠️ Nhập sai quá nhiều lần sẽ bị Firebase tạm khóa tài khoản.

---

## 🗓️ DÀNH CHO ADMIN / QUẢN LÝ

### 1. Bảng Lịch Tuần (`/manager`)

Đây là trang chính hiển thị toàn bộ lịch ca làm việc trong tuần dưới dạng **bảng lưới 7 ngày × N ca**.

**Chức năng:**

- **Điều hướng tuần:** Dùng nút ◀ ▶ để chuyển giữa các tuần
- **Khởi tạo lịch:** Nếu tuần chưa có lịch, bấm **"Khởi tạo Lịch Tuần"** để tự động sinh ca trống dựa trên Cài đặt
- **Trám ca / Bổ sung:** Bấm nút **"+ Bổ sung"** trong ô trống để gán nhân viên vào ca
- **Xóa nhân viên khỏi ca:** Hover vào tên nhân viên → bấm nút ❌
- **Chốt lịch:** Bấm 🔒 **"Đang Mở"** để chốt — sau khi chốt, mọi thao tác thay đổi bị khóa
- **Mở khóa lịch:** Bấm 🔓 **"Đã Chốt"** để mở lại
- **Xóa lịch tuần:** Bấm nút 🗑️ để xóa toàn bộ lịch của tuần (không thể hoàn tác)
- **Lọc theo ngày (Mobile):** Trên điện thoại có dropdown chọn ngày cụ thể

**Trạng thái nhân viên trong ô:**

| Màu | Ý nghĩa |
|---|---|
| 🔵 Xanh dương | Đã xác nhận |
| 🟡 Vàng | Chờ xác nhận (nhân viên được đôn lên từ dự bị) |
| 🟠 Cam | Dự bị |

---

### 2. Thống kê (`/manager/dashboard`)

Bảng tổng hợp số ca đăng ký theo nhân viên, hỗ trợ xem theo **Tuần** hoặc **Tháng**.

**Thông tin hiển thị:**
- Tổng số ca có nhân viên đăng ký
- Tổng lượt đăng ký
- Số nhân viên tham gia
- Số lượt dự bị
- Bảng chi tiết: Tên NV, Chức vụ, Số ca, Dự bị, Chi tiết từng ca

---

### 3. Quản lý Nhân sự (`/manager/users`)

**Danh sách tài khoản:** Hiển thị toàn bộ nhân viên với vai trò, trạng thái, email, SĐT.

**Các thao tác:**

| Thao tác | Quyền | Mô tả |
|---|---|---|
| **Cấp tài khoản mới** | Admin, Manager | Tạo tài khoản với email, mật khẩu, vai trò, vị trí, thông tin cá nhân |
| **Sửa thông tin** | Admin, Manager (không sửa Admin) | Đổi tên, vai trò, vị trí, CCCD, địa chỉ... |
| **Khóa / Mở khóa** | Admin, Manager | Tạm khóa tài khoản không cho đăng nhập |
| **Xóa vĩnh viễn** | **Chỉ Admin** | Xóa tài khoản khỏi hệ thống (không thể hoàn tác) |

**Lưu ý khi tạo tài khoản:**
- Mật khẩu tối thiểu 6 ký tự
- Chọn **Chức vụ** (vai trò hệ thống) và **Vị trí làm việc** (có thể chọn nhiều vị trí để NV đăng ký đa ca)

---

### 4. Cài đặt (`/manager/settings`) — Chỉ Admin

> ⚠️ **Chỉ tài khoản Admin** mới thấy và truy cập được trang này. Quản lý (Manager) không có quyền.

#### 4.1 Thông tin Công ty
- Tên công ty, Slogan, Logo (≤200KB), Địa chỉ, SĐT
- Hiển thị trên trang Login và Header tất cả các trang

#### 4.2 Khung Giờ Ca Làm Việc
- Thêm / Sửa / Xóa ca (VD: Ca 1 08:00-12:00, Ca 2 13:00-17:00...)
- Thay đổi áp dụng cho lịch tuần **tạo mới**, tuần cũ không bị ảnh hưởng

#### 4.3 Hạn chót Đăng ký (Deadline)
- Cấu hình thứ và giờ tự động khóa đăng ký ca tuần kế tiếp
- VD: Chủ Nhật 23:59 → Sau thời điểm này, NV không thể đăng ký/hủy ca tuần sau

#### 4.4 Cấu hình Vị trí Làm việc
- Thêm / Sửa / Xóa vị trí (VD: Thu ngân, Soát vé, Pha chế, Trực hồ...)
- Mỗi vị trí có **Mã** (dùng nội bộ) và **Tên hiển thị**

#### 4.5 Số lượng Slot / Ca
- Giới hạn số người tối đa cho mỗi vị trí trong 1 ca
- VD: Thu ngân = 2 người/ca, Soát vé = 1 người/ca

#### 4.6 Quy luật Phân Ca Mặc Định
- Bảng ma trận **7 ngày × N ca**: tick chọn ca nào mở cửa ngày nào
- VD: Thứ Hai chỉ mở Ca 3, Chủ Nhật mở cả Ca 1 + Ca 2 + Ca 3

#### 4.7 Ngày Ngoại Lệ (Lễ / Nghỉ)
- Thêm ngày đặc biệt với 2 lựa chọn:
  - **Nghỉ đóng cửa** → Không sinh ca nào
  - **Ca phục vụ riêng** → Chọn ca cụ thể mở cửa

> 💡 Sau khi thay đổi, bấm **"Lưu Thay Đổi"** để lưu cấu hình lịch, hoặc **"Lưu Thông Tin"** để lưu thông tin công ty.

---

## 📱 DÀNH CHO NHÂN VIÊN (Thu ngân / Soát vé)

### Trang Đăng ký Ca (`/staff`)

Giao diện mobile-first tối ưu cho điện thoại.

#### Bảng lịch đăng ký

- Hiển thị **bảng lưới**: Dọc = Các ngày trong tuần, Ngang = Các ca (Ca 1, Ca 2, Ca 3...)
- Mặc định hiển thị lịch **Tuần Sau** (tuần kế tiếp)
- Dùng nút ◀ ▶ để xem các tuần sau nữa

#### Trạng thái ô ca

| Nút | Ý nghĩa | Hành động |
|---|---|---|
| **ĐĂNG KÝ** (xanh) | Chưa đăng ký, còn chỗ | Bấm để đăng ký |
| **HỦY NHẬN** (xanh đậm) | Đã đăng ký thành công | Bấm để hủy đăng ký |
| **DỰ BỊ** (xám) | Ca đã đầy người chính thức | Bấm để đăng ký dự bị |
| **HỦY DỰ BỊ** (cam) | Đã đăng ký dự bị | Bấm để hủy dự bị |
| **XÁC NHẬN** (vàng nhấp nháy) | Được đôn lên từ dự bị, chờ xác nhận | Bấm → Đồng ý nhận ca hoặc Từ chối |
| **ĐÃ CHỐT** | Lịch đã khóa | Không thể thao tác |
| **Nghỉ** | Ngày nghỉ theo cài đặt | Không thể đăng ký |

#### Chọn Vị trí (NV đa vị trí)

Nếu nhân viên được gán nhiều vị trí (VD: vừa Thu ngân, vừa Pha chế), sẽ hiển thị thanh tab chọn vị trí ở header.

#### Lịch của tôi

Bấm **"📅 Lịch của tôi"** (góc phải header) để xem tổng hợp tất cả ca đã đăng ký trong tuần, bao gồm:
- Tên ca, Khung giờ, Vị trí
- Trạng thái: Đã nhận / Dự bị / Chờ xác nhận

#### Chốt sổ tuần

Sau khi chọn đủ ca mong muốn:
1. Bấm nút **"Xác nhận tuần (N ca)"** ở cuối trang
2. Xem lại danh sách ca đã chọn trong modal xác nhận
3. Bấm **"Chốt Lịch"** để chốt sổ báo Quản lý
4. Giao diện tự động chuyển sang trạng thái **"Đã chốt"**

> ⚠️ **Lưu ý:** Sau deadline chốt sổ (do Admin cài đặt), nhân viên không thể tự hủy ca trên ứng dụng. Liên hệ Quản lý để thay đổi.

---

## 🔄 Cơ chế Dự bị & Đôn lên

Khi một nhân viên **hủy ca** và có người dự bị:

1. Hệ thống tự động **đôn người dự bị đầu tiên** lên vị trí chính thức
2. Người được đôn sẽ thấy ô ca **nhấp nháy vàng** với trạng thái **"Xác nhận"**
3. Bấm vào để chọn:
   - **Đồng ý** → Nhận ca chính thức
   - **Từ chối** → Hủy đăng ký

---

## 🚀 Triển khai & Cập nhật

### Chạy local (Development)

```bash
cd shift-app
npm install
npm run dev
```

### Build & Deploy lên Firebase

```bash
npm run build
firebase deploy
```

Hoặc dùng file batch có sẵn:
- `cap_nhat.bat` — Build + Deploy + Push GitHub
- `deploy_to_firebase.bat` — Chỉ deploy lên Firebase
- `push_to_github.bat` — Chỉ push code lên GitHub

---

## 📊 Cấu trúc Database (Firestore)

```
Firestore
├── users/{userId}
│   ├── name, email, role, positions[], status, phone, cccd...
│   └── createdAt
│
├── settings/
│   ├── schedule_rules
│   │   ├── shiftConfig: { ca1: {name, startTime, endTime}, ... }
│   │   ├── positionsConfig: { cashier: {name}, ... }
│   │   ├── weeklyDefaults: { monday: ["ca3"], sunday: ["ca1","ca2","ca3"], ... }
│   │   ├── staffSlots: { cashier: 2, ticket_checker: 1, ... }
│   │   ├── deadline: { dayOfWeek, time }
│   │   └── specialDates: [{ date, reason, type, shifts[] }]
│   │
│   └── company_info
│       ├── companyName, slogan, logoBase64
│       └── address, phone
│
└── weekly_schedules/{weekId}        # VD: "2026-W11"
    ├── startDate, endDate, isLocked, confirmedBy[]
    └── shifts/{shiftId}             # VD: "2026-03-09-ca1"
        ├── date, dateString, shiftName, timeString
        ├── status: "open" | "locked"
        ├── staff: { cashier: [{userId, name, status}], ... }
        └── backups: { cashier: [{userId, name}], ... }
```

---

## ❓ Câu hỏi thường gặp

**Q: Tôi quên mật khẩu?**  
A: Liên hệ Admin để tạo lại tài khoản hoặc reset mật khẩu trên Firebase Console.

**Q: Nhân viên đăng ký nhầm ca, làm sao hủy khi đã chốt?**  
A: Quản lý vào Bảng Lịch → Hover vào tên NV → Bấm ❌ xóa khỏi ca → Gán lại ca đúng.

**Q: Tại sao không thấy tab "Cài đặt"?**  
A: Tab Cài đặt chỉ hiển thị cho tài khoản Admin. Quản lý (Manager) không có quyền truy cập.

**Q: Thay đổi cài đặt có ảnh hưởng lịch tuần đã tạo?**  
A: Không. Thay đổi khung giờ ca, quy luật phân ca chỉ áp dụng khi **tạo mới** lịch tuần. Tuần đã khởi tạo giữ nguyên.
