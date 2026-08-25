# Test Case — AI Factory Console (neo.fpt.ai)

**URL:** `https://neo.fpt.ai/`  
**Ngày:** 12/08/2026  
**Tiêu chuẩn:** IPA (Information-technology Promotion Agency, Japan)  
**Ngôn ngữ:** Tiếng Việt  

---

## Tổng quan

AI Factory Console là hệ thống quản lý AI infrastructure bao gồm các tính năng:

- **Dashboard** — Tổng quan workspace, balance, spending, recent activities
- **GPU Virtual Machine** — Quản lý VM GPU, security groups, storage
- **Dedicated Inference** — Deploy model từ Hugging Face
- **Serverless Inference** — Model catalog, playground, API keys, quotas
- **Settings** — Workspace, Billing, Audit Logs
- **Pricing** — Bảng giá GPU Container, GPU VM, Storage
- **Analytics** — Thống kê usage

---

## 1. Authentication & Login

### TC-AUTH-001: Đăng nhập thành công bằng FPT ID

| Field | Content |
|---|---|
| **TC-ID** | TC-AUTH-001 |
| **Function** | Login with FPT ID |
| **Screen** | `https://neo.fpt.ai/` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Đăng nhập thành công với FPT ID |
| **Precondition** | Tài khoản FPT ID hợp lệ |
| **Procedure** | 1. Truy cập `https://neo.fpt.ai/` 2. Click "Continue with FPT ID" 3. Nhập username/password 4. Click "Sign in" |
| **Expected Result** | 1. Redirect đến `/thuanlt11/thuanlt11` (dashboard) 2. Hiển thị "Hello, Thuan" 3. Hiển thị navigation sidebar 4. Hiển thị organization balance |
| **Notes** | Không |

---

### TC-AUTH-002: Đăng nhập thất bại — Sai password

| Field | Content |
|---|---|
| **TC-ID** | TC-AUTH-002 |
| **Function** | Login with wrong password |
| **Screen** | FPT ID login page |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Đăng nhập với password sai |
| **Precondition** | Tài khoản FPT ID hợp lệ |
| **Procedure** | 1. Truy cập `https://neo.fpt.ai/` 2. Click "Continue with FPT ID" 3. Nhập username đúng, password sai 4. Click "Sign in" |
| **Expected Result** | 1. Hiển thị lỗi "Invalid username or password" 2. Không redirect, vẫn ở trang login 3. Password field được clear |
| **Notes** | Không tiết lộ username có tồn tại hay không |

---

### TC-AUTH-003: Trang login hiển thị đầy đủ phương thức đăng nhập

| Field | Content |
|---|---|
| **TC-ID** | TC-AUTH-003 |
| **Function** | Login page rendering |
| **Screen** | `https://neo.fpt.ai/` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang login hiển thị đúng nội dung |
| **Precondition** | Chưa đăng nhập |
| **Procedure** | 1. Truy cập `https://neo.fpt.ai/` |
| **Expected Result** | 1. Tiêu đề: "Sign in to AI Factory" 2. Hiển thị 4 nút: FPT ID, Google, Microsoft, Github 3. Hiển thị link "Sign up" 4. Redirect tự động đến `/login` |
| **Notes** | Không |

---

### TC-AUTH-004: SQL injection trong username

| Field | Content |
|---|---|
| **TC-ID** | TC-AUTH-004 |
| **Function** | Login security |
| **Screen** | FPT ID login page |
| **Viewpoint** | Security |
| **Test Item** | SQL injection trong trường username |
| **Precondition** | Đang ở trang FPT ID login |
| **Procedure** | 1. Nhập `' OR 1=1 --` vào username 2. Nhập password bất kỳ 3. Click "Sign in" |
| **Expected Result** | 1. Không bypass authentication 2. Không có lỗi SQL hiển thị 3. Trả về thông báo lỗi an toàn |
| **Notes** | Kiểm tra backend sử dụng parameterized query |

---

### TC-AUTH-005: XSS trong trường username

| Field | Content |
|---|---|
| **TC-ID** | TC-AUTH-005 |
| **Function** | Login security |
| **Screen** | FPT ID login page |
| **Viewpoint** | Security |
| **Test Item** | XSS trong trường username |
| **Precondition** | Đang ở trang FPT ID login |
| **Procedure** | 1. Nhập `<script>alert('xss')</script>` vào username 2. Click "Sign in" |
| **Expected Result** | 1. Không execute JavaScript 2. Không có alert box 3. Input được encode hoặc bị chặn |
| **Notes** | Không |

---

## 2. Dashboard

### TC-DASH-001: Dashboard hiển thị đầy đủ thông tin

| Field | Content |
|---|---|
| **TC-ID** | TC-DASH-001 |
| **Function** | Dashboard rendering |
| **Screen** | `/thuanlt11/thuanlt11` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Dashboard hiển thị đúng nội dung |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Sau khi đăng nhập, kiểm tra dashboard |
| **Expected Result** | 1. Hiển thị "Hello, Thuan" 2. Hiển thị Organization balance (₫1,634,573) 3. Hiển thị Daily quota (₫264,600 remaining) 4. Hiển thị Hourly burn (₫0) 5. Hiển thị Quick access cards: GPU VM, Dedicated Inference, Serverless Inference, Analytics 6. Hiển thị Recent activities 7. Hiển thị Quick feedback form |
| **Notes** | Không |

---

### TC-DASH-002: Navigation sidebar hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-DASH-002 |
| **Function** | Sidebar navigation |
| **Screen** | Dashboard |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Sidebar hiển thị đúng menu |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Kiểm tra sidebar bên trái |
| **Expected Result** | 1. Hiển thị "Dashboard" 2. Hiển thị "FPT GPU CLOUD" → "GPU Virtual Machine" 3. Hiển thị "FPT TOKEN FACTORY" → "Dedicated Inference", "Serverless Inference" 4. Hiển thị "Settings" 5. Hiển thị nút "Go to Organization" và "Hide menu" |
| **Notes** | Không |

---

### TC-DASH-003: Quick access — Click GPU Virtual Machine

| Field | Content |
|---|---|
| **TC-ID** | TC-DASH-003 |
| **Function** | Quick access navigation |
| **Screen** | Dashboard |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click vào GPU Virtual Machine card |
| **Precondition** | Đã đăng nhập, đang ở dashboard |
| **Procedure** | 1. Click vào card "Create GPU Virtual Machine" |
| **Expected Result** | 1. Redirect đến `/thuanlt11/thuanlt11/gpu-vm` 2. Hiển thị trang GPU VM 3. Sidebar highlight "GPU Virtual Machine" |
| **Notes** | Không |

---

### TC-DASH-004: Recent activities hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-DASH-004 |
| **Function** | Recent activities |
| **Screen** | Dashboard |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Recent activities hiển thị đúng định dạng |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Kiểm tra phần "Recent activities" |
| **Expected Result** | 1. Mỗi activity có: Action type (Enable Service/Remove Member), Status (Success), Target (Workspace/Member), Timestamp 2. Sắp xếp theo thời gian (mới nhất trước) 3. Hiển thị đúng số lượng activities |
| **Notes** | Không |

---

## 3. GPU Virtual Machine

### TC-GPU-001: Trang GPU VM hiển thị đúng khi chưa có VM

| Field | Content |
|---|---|
| **TC-ID** | TC-GPU-001 |
| **Function** | GPU VM empty state |
| **Screen** | `/thuanlt11/thuanlt11/gpu-vm` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang GPU VM hiển thị đúng khi chưa có VM |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Truy cập `/thuanlt11/thuanlt11/gpu-vm` |
| **Expected Result** | 1. Hiển thị tiêu đề "GPU Virtual Machine" 2. Hiển thị tabs: Virtual machines, Security groups, Storage 3. Hiển thị "No Virtual Machines Available" 4. Hiển thị mô tả: "It looks like there aren't any virtual machines yet..." 5. Hiển thị nút "Create Virtual Machine" |
| **Notes** | Không |

---

### TC-GPU-002: Click "Create Virtual Machine"

| Field | Content |
|---|---|
| **TC-ID** | TC-GPU-002 |
| **Function** | Create VM |
| **Screen** | GPU VM page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click nút "Create Virtual Machine" |
| **Precondition** | Đang ở trang GPU VM |
| **Procedure** | 1. Click nút "Create Virtual Machine" |
| **Expected Result** | 1. Mở form tạo VM hoặc redirect đến trang tạo VM 2. Hiển thị các trường: VM name, GPU type, OS image, v.v. 3. Không crash, không lỗi |
| **Notes** | Cần xác minh form thật |

---

### TC-GPU-003: Tabs trên trang GPU VM

| Field | Content |
|---|---|
| **TC-ID** | TC-GPU-003 |
| **Function** | GPU VM tabs |
| **Screen** | `/thuanlt11/thuanlt11/gpu-vm` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click vào từng tab: Virtual machines, Security groups, Storage |
| **Precondition** | Đang ở trang GPU VM |
| **Procedure** | 1. Click "Security groups" 2. Click "Storage" |
| **Expected Result** | 1. Tab "Security groups" — hiển thị danh sách security groups (hoặc empty state) 2. Tab "Storage" — hiển thị danh sách storage volumes (hoặc empty state) 3. Không crash khi chuyển tab |
| **Notes** | Không |

---

## 4. Dedicated Inference

### TC-DDI-001: Trang Dedicated Inference hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-DDI-001 |
| **Function** | Dedicated Inference page |
| **Screen** | `/thuanlt11/thuanlt11/ddi/model-catalog` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang Dedicated Inference hiển thị đúng |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Truy cập `/thuanlt11/thuanlt11/ddi/model-catalog` |
| **Expected Result** | 1. Hiển thị tiêu đề "Model Catalog" 2. Hiển thị "0 models from Hugging Face" 3. Hiển thị nút "Deploy model from Hugging Face" 4. Sidebar highlight "Dedicated Inference" 5. Sidebar có sub-menu: Models, My endpoints |
| **Notes** | Không |

---

### TC-DDI-002: Search model trên Dedicated Inference

| Field | Content |
|---|---|
| **TC-ID** | TC-DDI-002 |
| **Function** | Model search |
| **Screen** | DDI model catalog |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Tìm kiếm model trên Dedicated Inference |
| **Precondition** | Đang ở trang DDI model catalog |
| **Procedure** | 1. Nhập "llama" vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Hiển thị kết quả tìm kiếm hoặc "No models found" 2. Không crash, không lỗi 3. Thời gian phản hồi hợp lý |
| **Notes** | Không |

---

## 5. Serverless Inference

### TC-SLI-001: Trang Serverless Inference hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-SLI-001 |
| **Function** | Serverless Inference page |
| **Screen** | `/thuanlt11/thuanlt11/serverless-inference/models` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang Serverless Inference hiển thị đúng |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Truy cập `/thuanlt11/thuanlt11/serverless-inference/models` |
| **Expected Result** | 1. Hiển thị tiêu đề "Model Catalog" 2. Hiển thị filter: "All categories", "All providers" 3. Sidebar có sub-menu: Models, Playground, API Keys, User Quotas, Usage, Settings |
| **Notes** | Không |

---

### TC-SLI-002: Filter model theo category

| Field | Content |
|---|---|
| **TC-ID** | TC-SLI-002 |
| **Function** | Model category filter |
| **Screen** | Serverless Inference |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Chọn category filter |
| **Precondition** | Đang ở trang Serverless Inference |
| **Procedure** | 1. Click "All categories" dropdown 2. Chọn một category |
| **Expected Result** | 1. Dropdown hiển thị danh sách categories 2. Model catalog filter theo category được chọn 3. Không crash |
| **Notes** | Không |

---

### TC-SLI-003: Filter model theo provider

| Field | Content |
|---|---|
| **TC-ID** | TC-SLI-003 |
| **Function** | Model provider filter |
| **Screen** | Serverless Inference |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Chọn provider filter |
| **Precondition** | Đang ở trang Serverless Inference |
| **Procedure** | 1. Click "All providers" dropdown 2. Chọn một provider |
| **Expected Result** | 1. Dropdown hiển thị danh sách providers 2. Model catalog filter theo provider được chọn 3. Không crash |
| **Notes** | Không |

---

## 6. Pricing

### TC-PRICE-001: Trang Pricing hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-PRICE-001 |
| **Function** | Pricing page |
| **Screen** | `/thuanlt11/thuanlt11/pricing` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang Pricing hiển thị đúng nội dung |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Click "Pricing" trên navigation |
| **Expected Result** | 1. Hiển thị tiêu đề "Pricing" 2. Hiển thị sections: GPU Container, GPU Virtual Machine, Storage 3. Hiển thị bảng giá H100 GPU Instance (1/4x đến 8x) 4. Hiển thị bảng giá H200 GPU Instance 5. Hiển thị bảng giá Storage 6. Hiển thị bảng giá GPU VM (B300 SXM) |
| **Notes** | Không |

---

### TC-PRICE-002: Pricing table — H100 GPU Instance

| Field | Content |
|---|---|
| **TC-ID** | TC-PRICE-002 |
| **Function** | Pricing table |
| **Screen** | Pricing page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Bảng giá H100 hiển thị đúng |
| **Precondition** | Đang ở trang Pricing |
| **Procedure** | 1. Kiểm tra bảng "H100 GPU Instance" |
| **Expected Result** | 1. Hiển thị 9 instances (1/4x đến 8x) 2. Mỗi instance có: GPU type, RAM, CPU cores, NVMe disk, Price/hour, nút "Rent" 3. Giá tăng dần theo số lượng GPU 4. 1/4x: ₫18,522/giờ, 8x: ₫543,398/giờ |
| **Notes** | Không |

---

### TC-PRICE-003: Pricing table — H200 GPU Instance

| Field | Content |
|---|---|
| **TC-ID** | TC-PRICE-003 |
| **Function** | Pricing table |
| **Screen** | Pricing page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Bảng giá H200 hiển thị đúng |
| **Precondition** | Đang ở trang Pricing |
| **Procedure** | 1. Cuộn xuống phần "H200 GPU Instance" |
| **Expected Result** | 1. Hiển thị 8 instances (1x đến 8x) 2. Mỗi instance có: GPU type, RAM, CPU cores, NVMe disk, Price/hour, nút "Rent" 3. 1x: ₫176,497/giờ, 8x: ₫1,411,976/giờ 4. Hiển thị mô tả: "141 GB HBM3 Memory · Intel Xeon Platinum 8558 · Japan" |
| **Notes** | Không |

---

### TC-PRICE-004: Pricing table — Storage

| Field | Content |
|---|---|
| **TC-ID** | TC-PRICE-004 |
| **Function** | Storage pricing |
| **Screen** | Pricing page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Bảng giá Storage hiển thị đúng |
| **Precondition** | Đang ở trang Pricing |
| **Procedure** | 1. Cuộn xuống phần "Storage" |
| **Expected Result** | 1. Hiển thị "Persistent Storage" 2. Giá: ₫6/GB/giờ 3. Location: Southeast Asia, Japan 4. Mô tả: "Suitable for storing data, models, or files..." |
| **Notes** | Không |

---

## 7. Settings

### TC-SET-001: Settings — Workspace

| Field | Content |
|---|---|
| **TC-ID** | TC-SET-001 |
| **Function** | Workspace settings |
| **Screen** | Settings → Workspace |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Settings hiển thị đúng sub-menu |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Click "Settings" trên sidebar 2. Kiểm tra sub-menu |
| **Expected Result** | 1. Sidebar hiển thị sub-menu: Workspace, Billing, Audit Logs 2. Không crash |
| **Notes** | Không |

---

## 8. Navigation & General

### TC-NAV-001: Navigation — Dashboard

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-001 |
| **Function** | Navigation to Dashboard |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Dashboard" trên sidebar |
| **Precondition** | Đã đăng nhập, đang ở bất kỳ trang nào |
| **Procedure** | 1. Click "Dashboard" trên sidebar |
| **Expected Result** | 1. Redirect đến `/thuanlt11/thuanlt11` 2. Hiển thị dashboard 3. Sidebar highlight "Dashboard" |
| **Notes** | Không |

---

### TC-NAV-002: Navigation — Hide/Show menu

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-002 |
| **Function** | Toggle sidebar |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Hide menu" để ẩn sidebar |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Click "Hide menu" 2. Kiểm tra sidebar 3. Click để hiện lại sidebar |
| **Expected Result** | 1. Sidebar ẩn đi 2. Nội dung chính mở rộng 3. Có thể hiện lại sidebar |
| **Notes** | Không |

---

### TC-NAV-003: Navigation — Go to Organization

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-003 |
| **Function** | Go to Organization |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Go to Organization" |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Click "Go to Organization" trên sidebar |
| **Expected Result** | 1. Redirect đến trang organization 2. Hiển thị thông tin organization 3. Không crash |
| **Notes** | Không |

---

### TC-NAV-004: External links — Docs

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-004 |
| **Function** | External link |
| **Screen** | Header |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Docs" link |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Click "Docs" trên header |
| **Expected Result** | 1. Redirect đến `https://docs.fptcloud.com/docs/category/fpt-ai-factory/` 2. Mở trong tab mới hoặc cùng tab |
| **Notes** | Link external |

---

## 9. Quick Feedback Form

### TC-FB-001: Feedback form — Hiển thị đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-FB-001 |
| **Function** | Feedback form |
| **Screen** | Dashboard |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Feedback form hiển thị đúng |
| **Precondition** | Đã đăng nhập, đang ở dashboard |
| **Procedure** | 1. Kiểm tra phần "Quick feedback" |
| **Expected Result** | 1. Hiển thị câu hỏi "How satisfied are you?" (required) 2. Hiển thị câu hỏi "Any issues with GPU Virtual Machine?" 3. Hiển thị các options: Limited network features, Limited pre-built OS images, Unstable network connection, Cannot resize/upgrade, No CPU-only, Snapshot/restore not available, Other 4. Hiển thị nút "Submit" |
| **Notes** | Không |

---

### TC-FB-002: Feedback form — Submit với required field rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-FB-002 |
| **Function** | Feedback form validation |
| **Screen** | Dashboard |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Submit feedback không chọn satisfaction |
| **Precondition** | Đang ở dashboard |
| **Procedure** | 1. Không chọn "How satisfied are you?" 2. Click "Submit" |
| **Expected Result** | 1. Hiển thị validation error: "This field is required" 2. Không gửi form 3. Focus vào trường required |
| **Notes** | Client-side validation |

---

## 10. Performance & Security

### TC-PERF-001: Thời gian đăng nhập

| Field | Content |
|---|---|
| **TC-ID** | TC-PERF-001 |
| **Function** | Login performance |
| **Screen** | Login page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Thời gian đăng nhập hợp lý |
| **Precondition** | Chưa đăng nhập |
| **Procedure** | 1. Đo thời gian từ khi click "Sign in" đến khi redirect đến dashboard |
| **Expected Result** | 1. Thời gian đăng nhập < 10 giây 2. Không timeout |
| **Notes** | Không |

---

### TC-PERF-002: Thời gian tải dashboard

| Field | Content |
|---|---|
| **TC-ID** | TC-PERF-002 |
| **Function** | Dashboard load time |
| **Screen** | Dashboard |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Dashboard tải nhanh |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Đo thời gian từ khi navigation đến dashboard đến khi nội dung hiển thị đầy đủ |
| **Expected Result** | 1. Thời gian tải < 5 giây 2. Không có resource bị timeout |
| **Notes** | Không |

---

### TC-SEC-001: Session management — Logout

| Field | Content |
|---|---|
| **TC-ID** | TC-SEC-001 |
| **Function** | Logout |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Logout và kiểm tra session |
| **Precondition** | Đã đăng nhập |
| **Procedure** | 1. Tìm và click logout button 2. Truy cập lại `https://neo.fpt.ai/` |
| **Expected Result** | 1. Redirect đến trang login 2. Không thể truy cập dashboard mà không login 3. Session được clear |
| **Notes** | Cần xác minh logout button |

---

## Tóm tắt Test Cases

| Area | Số lượng | 正常系 | 準正常系 | 異常系 | 境界値 | Security |
|---|---|---|---|---|---|---|
| Authentication | 5 | 2 | 0 | 1 | 0 | 2 |
| Dashboard | 4 | 4 | 0 | 0 | 0 | 0 |
| GPU VM | 3 | 3 | 0 | 0 | 0 | 0 |
| Dedicated Inference | 2 | 2 | 0 | 0 | 0 | 0 |
| Serverless Inference | 3 | 3 | 0 | 0 | 0 | 0 |
| Pricing | 4 | 4 | 0 | 0 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 | 0 | 0 |
| Navigation | 4 | 4 | 0 | 0 | 0 | 0 |
| Feedback | 2 | 1 | 0 | 1 | 0 | 0 |
| Performance | 2 | 2 | 0 | 0 | 0 | 0 |
| Security | 1 | 1 | 0 | 0 | 0 | 0 |
| **Tổng** | **31** | **27** | **0** | **2** | **0** | **2** |

---

**Ghi chú:**
- Template: IPA standard
- Output format: Markdown
- Một số test case cần xác minh thêm khi execute (form fields, validation messages)
- Hệ thống yêu cầu đăng nhập cho tất cả các trang — không có public pages