# Process Flows (BPMN) — Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `brd-nvidia-partner-expansion.md`, `srs-nvidia-partner-expansion.md`

> Các quy trình được mô tả bằng Mermaid (flowchart/sequenceDiagram). Mỗi quy trình kèm business rules và exception.

---

## PF-01 — Quy trình deploy model NVIDIA NIM (US-01)

### Actors
- **Khách hàng**: kỹ sư AI, có API key scope `endpoints`.
- **Hệ thống FPT DDI**: nền tảng.
- **NVIDIA NGC/NIM**: nguồn catalog model.

### Flow

```mermaid
flowchart TD
    A["Khách mở tab Catalog"] --> B["Chọn phân khúc (coding/banking/...)"]
    B --> C["Danh mục lọc model theo phân khúc"]
    C --> D["Chọn model NVIDIA NIM"]
    D --> E["Bấm Deploy"]
    E --> F{Key hợp lệ & scope endpoints?}
    F -- No --> G["401/403 — hướng dẫn tạo key"]
    G --> D
    F -- Yes --> H["Hệ thống tạo endpoint (status=deploying)"]
    H --> I["Hệ thống pull NIM container từ NGC"]
    I --> J["Khởi động engine + guardrails (nếu bật)"]
    J --> K["Endpoint → running"]
    K --> L["Khách gọi /v1/endpoints/{id}/chat/completions"]
    L --> M["Nhận response OpenAI-compatible"]
```

### Business Rules
- BR-PF01-1: Deploy endpoint NIM phải hoàn tất (running) trong ≤5 phút (FR-NIM-001.3).
- BR-PF01-2: Key phải có scope `endpoints`; thiếu → 403.
- BR-PF01-3: Endpoint NIM hiển thị version NIM (FR-NIM-002.1).

### Exceptions
- EX-PF01-1: NGC không truy cập được → endpoint chuyển `failed`, ghi audit, thông báo khách.
- EX-PF01-2: Model NIM không hỗ trợ engine đã chọn → chặn deploy, hiển thị lỗi.

---

## PF-02 — Quy trình bật guardrails banking (US-02)

### Actors
- **Admin/Giám đốc CNTT**: bật guardrails.
- **Hệ thống**: áp guardrails.
- **Khách hàng cuối**: gọi endpoint.

### Flow

```mermaid
flowchart TD
    A["Admin mở cấu hình endpoint banking"] --> B["Chọn template guardrails Banking"]
    B --> C["Hệ thống bật NeMo Guardrails"]
    C --> D["Guardrails active trên endpoint"]
    D --> E["Khách gửi request"]
    E --> F{"Guardrails chặn?"}
    F -- No --> G["Forward request → model"]
    G --> H["Response bình thường"]
    F -- Yes --> I["Chặn + response chuẩn"]
    I --> J["Ghi event guardrail_blocked"]
    J --> K["Audit log (timestamp, actor, lý do)"]
    H --> K
```

### Business Rules
- BR-PF02-1: Guardrails banking bật mặc định cho endpoint banking (FR-SEG-003.1).
- BR-PF02-2: Chặn PII (CCCD/CMND) theo Nghị định 13/2023/NĐ-CP.
- BR-PF02-3: Mọi sự kiện chặn ghi audit log append-only (FR-COMP-001).

### Exceptions
- EX-PF02-1: Guardrails service lỗi → fail-open hoặc fail-closed tùy cấu hình; mặc định fail-closed cho banking (chặn request) để đảm bảo tuân thủ.

---

## PF-03 — Quy trình trích xuất tài liệu bảo hiểm (US-04)

### Actors
- **Nhân viên underwriting**: upload tài liệu.
- **Hệ thống**: trích xuất + guardrails.

### Flow

```mermaid
flowchart TD
    A["Upload PDF hợp đồng/claim"] --> B["Hệ thống OCR + trích xuất"]
    B --> C["Guardrails rà soát thông tin nhạy cảm"]
    C --> D{"Chứa thông tin y tế?"}
    D -- Yes --> E["Che/chặn thông tin nhạy cảm"]
    E --> F["Hiển thị kết quả đã che"]
    D -- No --> G["Hiển thị kết quả trích xuất"]
    G --> H["Nhân viên sửa thủ công (nếu cần)"]
    F --> H
    H --> I["Xác nhận & lưu"]
```

### Business Rules
- BR-PF03-1: Độ chính xác trích xuất ≥90% (FR-SEG-005.1).
- BR-PF03-2: Guardrails chặn thông tin y tế nhạy cảm (FR-SEG-005.2).

### Exceptions
- EX-PF03-1: PDF không đọc được (scan kém) → yêu cầu upload lại bản rõ hơn.
- EX-PF03-2: Trích xuất dưới ngưỡng tin cậy → cảnh báo để nhân viên kiểm tra thủ công.

---

## PF-04 — Quy trình tạo gói giá theo phân khúc (US-06)

### Actors
- **Admin FPT**: tạo gói giá.
- **Hệ thống**: lưu + áp dụng.
- **Khách hàng**: xem giá.

### Flow

```mermaid
flowchart TD
    A["Admin tạo gói giá"] --> B["Chọn phân khúc + GPU + region"]
    B --> C["Nhập rate/giờ + rate/token + commitment"]
    C --> D["Nhập quota (RPM/TPM)"]
    D --> E["Lưu gói giá"]
    E --> F["Hệ thống gắn gói vào phân khúc"]
    F --> G["Khách thuộc phân khúc xem giá"]
    G --> H["Hiển thị đúng gói của phân khúc"]
    H --> I{"Vượt quota?"}
    I -- Yes --> J["Trả 429"]
    I -- No --> K["Cho phép inference"]
```

### Business Rules
- BR-PF04-1: Gói giá gắn với phân khúc + GPU + region (FR-PRICE-001.2).
- BR-PF04-2: Quota áp theo RPM/TPM (FR-PRICE-002.2).
- BR-PF04-3: Vượt quota → 429.

### Exceptions
- EX-PF04-1: Gói giá trùng (cùng phân khúc+GPU+region) → chặn tạo, yêu cầu sửa.

---

## PF-05 — Quy trình audit trail bất biến (US-05)

### Actors
- **User/Admin**: thao tác.
- **Hệ thống**: ghi audit.
- **Đội tuân thủ**: truy vết.

### Flow

```mermaid
sequenceDiagram
    participant U as User/Admin
    participant S as Hệ thống
    participant A as Audit Store (append-only)
    participant C as Đội tuân thủ

    U->>S: Thao tác (tạo/sửa/xóa endpoint, key, guardrails)
    S->>S: Xác thực + phân quyền
    S->>A: Ghi audit (timestamp, actor, action, entity, result)
    S-->>U: Kết quả
    C->>A: Truy vấn audit log (lọc theo thời gian/actor)
    A-->>C: Kết quả bất biến
    C->>C: Xuất báo cáo tuân thủ
```

### Business Rules
- BR-PF05-1: Audit log append-only, không API xóa/sửa được (FR-COMP-001.2).
- BR-PF05-2: Lưu ≥365 ngày (FR-COMP-001.3).

### Exceptions
- EX-PF05-1: Audit store đầy → cảnh báo admin, không chặn ghi (vòng lặp lưu trữ).

---

## PF-06 — Quy trình phân quyền theo vai trò (US-10)

### Actors
- **Admin**: gán vai trò.
- **Operator**: vận hành.
- **Viewer**: chỉ xem.

### Flow

```mermaid
flowchart TD
    A["Admin gán vai trò cho user"] --> B["Vai trò: admin/operator/viewer"]
    B --> C["User gọi API operational"]
    C --> D{"Vai trò + scope?"}
    D -- "admin + scope đúng" --> E["Cho phép mọi thao tác"]
    D -- "operator + scope endpoints" --> F["Cho phép tạo/sửa endpoint"]
    D -- "viewer" --> G["Chỉ xem — POST/Delete → 403"]
    D -- "thiếu scope" --> H["403 Key thiếu scope"]
```

### Business Rules
- BR-PF06-1: Chỉ admin tạo/sửa key và guardrails (FR-COMP-003.1).
- BR-PF06-2: Viewer chỉ xem (FR-COMP-003.2).

### Exceptions
- EX-PF06-1: User chưa gán vai trò → mặc định viewer.

---

## Tóm tắt quy trình ↔ story

| Quy trình | Story | Module |
|-----------|-------|--------|
| PF-01 | US-01 | NIM |
| PF-02 | US-02 | GRD, COMP |
| PF-03 | US-04 | SEG |
| PF-04 | US-06 | PRICE |
| PF-05 | US-05 | COMP |
| PF-06 | US-10 | COMP |