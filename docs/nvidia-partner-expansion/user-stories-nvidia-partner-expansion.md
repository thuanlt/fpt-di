# User Stories & Acceptance Criteria — Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `brd-nvidia-partner-expansion.md`, `srs-nvidia-partner-expansion.md`

> Ký hiệu: **[M]**=Must, **[S]**=Should, **[C]**=Could. Mỗi story có acceptance criteria dạng Given/When/Then.

---

## US-01 — Deploy model NVIDIA NIM 1-click [M]
**As a** khách hàng (kỹ sư AI)
**I want** deploy model NVIDIA NIM từ catalog chỉ với 1 cú nhấp
**So that** tôi không phải cấu hình engine phức tạp và có endpoint chạy nhanh.

### Acceptance Criteria
- [ ] **Given** tôi đang ở tab Catalog và đã có API key scope `endpoints`, **when** tôi bấm "Deploy" trên model NIM, **then** hệ thống tạo endpoint và chuyển sang trạng thái `running` trong ≤5 phút.
- [ ] **Given** model NIM đã deploy, **when** tôi gọi `/v1/endpoints/{id}/chat/completions` với key hợp lệ, **then** nhận response đúng định dạng OpenAI-compatible.
- [ ] **Given** tôi deploy model NIM, **when** endpoint đang `deploying`, **then** UI hiển thị trạng thái và tiến trình.

### Business Rules
- BR-US01-1: Model NIM chỉ deploy được khi key có scope `endpoints`.
- BR-US01-2: Endpoint NIM phải hiển thị version NIM (FR-NIM-002).

### Dependencies
- FR-NIM-001, FR-NIM-002

---

## US-02 — Bật guardrails banking [M]
**As a** giám đốc CNTT ngân hàng
**I want** bật guardrails (NeMo) chặn PII và lời khuyên tài chính trái phép trên endpoint
**So that** tôi tuân thủ Nghị định 13/2023/NĐ-CP và bảo vệ dữ liệu khách hàng.

### Acceptance Criteria
- [ ] **Given** tôi có endpoint banking, **when** tôi bật guardrails template "Banking", **then** guardrails active và chặn prompt chứa CCCD/CMND.
- [ ] **Given** guardrails banking đang bật, **when** request chứa PII được gửi, **then** hệ thống trả response chuẩn chặn + ghi event `guardrail_blocked`.
- [ ] **Given** guardrails bật, **when** tôi xem audit log, **then** thấy sự kiện chặn với timestamp, actor, lý do.

### Business Rules
- BR-US02-1: Tuân thủ Nghị định 13/2023/NĐ-CP (PDPA).
- BR-US02-2: Guardrails banking bật mặc định cho endpoint banking (FR-SEG-003.1).

### Dependencies
- FR-GRD-001, FR-GRD-002, FR-COMP-001

---

## US-03 — Structured output cho phân tích chứng khoán [S]
**As a** nhà phân tích chứng khoán
**I want** nhận output theo JSON Schema từ model
**So that** tôi tự động hóa việc trích xuất số liệu tài chính mà không cần parse thủ công.

### Acceptance Criteria
- [ ] **Given** tôi gọi endpoint securities với JSON Schema trong request, **when** model trả về, **then** output khớp schema (kiểm tra bằng validator).
- [ ] **Given** endpoint securities, **when** đo latency, **then** p95 ≤500ms.
- [ ] **Given** schema không hợp lệ, **when** tôi gửi request, **then** hệ thống trả 400 với lỗi rõ ràng.

### Business Rules
- BR-US03-1: Structured output dùng JSON Schema (RFC 8927).
- BR-US03-2: Latency SLA p95 ≤500ms (NFR-PERF-001).

### Dependencies
- FR-SEG-004

---

## US-04 — Trích xuất tài liệu bảo hiểm [S]
**As a** nhân viên underwriting bảo hiểm
**I want** upload hợp đồng/claim form và trích xuất thông tin chính
**So that** tôi xử lý hồ sơ nhanh hơn và giảm sai sót nhập liệu.

### Acceptance Criteria
- [ ] **Given** tôi upload PDF hợp đồng, **when** hệ thống xử lý, **then** trích xuất các trường (party, sum insured, term) với độ chính xác ≥90%.
- [ ] **Given** tài liệu chứa thông tin y tế, **when** guardrails bật, **then** thông tin nhạy cảm bị che/chặn.
- [ ] **Given** tôi xem kết quả, **when** có lỗi trích xuất, **then** UI cho phép sửa thủ công.

### Business Rules
- BR-US04-1: Trích xuất đạt độ chính xác ≥90% (FR-SEG-005.1).
- BR-US04-2: Guardrails chặn thông tin y tế nhạy cảm (FR-SEG-005.2).

### Dependencies
- FR-SEG-005, FR-GRD-001

---

## US-05 — Audit trail không thể sửa [M]
**As a** đội tuân thủ
**I want** mọi hoạt động nhạy cảm được ghi vào audit log bất biến
**So that** tôi chứng minh tuân thủ quy định và truy vết khi có sự cố.

### Acceptance Criteria
- [ ] **Given** admin tạo/sửa/xóa endpoint hoặc key, **when** thao tác xảy ra, **then** audit log ghi timestamp, actor, action, entity, kết quả.
- [ ] **Given** audit log đã ghi, **when** tôi cố xóa/sửa qua API, **then** hệ thống chặn (append-only).
- [ ] **Given** tôi xem audit log, **when** lọc theo thời gian/actor, **then** kết quả chính xác.

### Business Rules
- BR-US05-1: Audit log append-only, lưu ≥365 ngày (FR-COMP-001.3).
- BR-US05-2: Không API nào xóa được audit log.

### Dependencies
- FR-COMP-001

---

## US-06 — Gói giá theo phân khúc [M]
**As a** admin FPT
**I want** tạo gói giá khác nhau theo phân khúc và GPU
**So that** tôi tối ưu doanh thu từ từng nhóm khách hàng.

### Acceptance Criteria
- [ ] **Given** tôi là admin, **when** tôi tạo gói giá (phân khúc + GPU + region + rate), **then** gói lưu thành công.
- [ ] **Given** khách thuộc phân khúc X, **when** xem giá endpoint, **then** thấy đúng gói của phân khúc X.
- [ ] **Given** gói có quota, **when** khách vượt quota, **then** hệ thống trả 429.

### Business Rules
- BR-US06-1: Gói giá gắn với phân khúc + GPU + region (FR-PRICE-001.2).
- BR-US06-2: Quota áp theo RPM/TPM (FR-PRICE-002.2).

### Dependencies
- FR-PRICE-001, FR-PRICE-002

---

## US-07 — Dashboard KPI theo phân khúc [S]
**As a** quản lý sản phẩm
**I want** xem KPI (usage, cost, latency, guardrail blocks) theo phân khúc
**So that** tôi đánh giá hiệu quả và điều chỉnh chiến lược.

### Acceptance Criteria
- [ ] **Given** tôi mở dashboard, **when** tôi lọc theo phân khúc "banking", **then** hiển thị KPI banking.
- [ ] **Given** dashboard đang hiển thị, **when** tôi bấm "Export CSV", **then** tải file CSV đúng dữ liệu.
- [ ] **Given** có guardrail blocks, **when** xem dashboard, **then** số liệu phản ánh đúng event log.

### Business Rules
- BR-US07-1: Dashboard lọc theo phân khúc, region, GPU (FR-DASH-001.2).

### Dependencies
- FR-DASH-001, FR-GRD-002

---

## US-08 — Chế độ code privacy [M]
**As a** kỹ sư phần mềm
**I want** bật chế độ bảo mật mã nguồn (không log prompt)
**So that** mã nguồn của tôi không bị lưu/log khi dùng code assistant.

### Acceptance Criteria
- [ ] **Given** tôi bật "code privacy" trên endpoint coding, **when** tôi gửi prompt chứa mã nguồn, **then** prompt không xuất hiện plaintext trong audit log.
- [ ] **Given** code privacy bật, **when** tôi gửi request, **then** response vẫn hoạt động bình thường.
- [ ] **Given** code privacy tắt, **when** tôi gửi prompt, **then** prompt được ghi log như thường.

### Business Rules
- BR-US08-1: Code privacy chặn log plaintext mã nguồn (FR-SEG-002.2).

### Dependencies
- FR-SEG-002, FR-COMP-001

---

## US-09 — Tối ưu engine TensorRT-LLM [S]
**As a** kỹ sư vận hành
**I want** chọn engine TensorRT-LLM khi deploy endpoint
**So that** tôi tăng throughput và giảm chi phí.

### Acceptance Criteria
- [ ] **Given** tôi deploy endpoint, **when** tôi chọn engine "TensorRT-LLM", **then** endpoint chạy với engine tối ưu.
- [ ] **Given** endpoint TensorRT-LLM, **when** benchmark so với engine mặc định, **then** throughput tăng ≥20%.
- [ ] **Given** engine tối ưu, **when** tôi xem monitoring, **then** thấy chỉ số throughput/latency.

### Business Rules
- BR-US09-1: Throughput tăng ≥20% với TensorRT-LLM (NFR-PERF-002).

### Dependencies
- FR-TRT-001

---

## US-10 — Phân quyền theo vai trò [M]
**As a** admin
**I want** phân quyền (admin/operator/viewer) cho người dùng
**So that** tôi kiểm soát ai được tạo/sửa endpoint và key.

### Acceptance Criteria
- [ ] **Given** user có vai trò viewer, **when** gọi POST /endpoints, **then** nhận 403.
- [ ] **Given** user có vai trò operator, **when** gọi POST /endpoints, **then** được phép (có scope đúng).
- [ ] **Given** user có vai trò admin, **when** tạo/sửa key, **then** được phép.

### Business Rules
- BR-US10-1: Chỉ admin tạo/sửa key và guardrails (FR-COMP-003.1).
- BR-US10-2: Viewer chỉ xem (FR-COMP-003.2).

### Dependencies
- FR-COMP-003

---

## Tóm tắt ưu tiên

| Story | Phân khúc | Ưu tiên | Pha |
|-------|-----------|---------|-----|
| US-01 NIM deploy | Tất cả | M | 1 |
| US-02 Guardrails banking | Banking | M | 1 |
| US-05 Audit trail | Tất cả | M | 1 |
| US-08 Code privacy | Coding | M | 1 |
| US-10 Phân quyền | Tất cả | M | 1 |
| US-06 Gói giá | Tất cả | M | 2 |
| US-03 Structured output | Chứng khoán | S | 2 |
| US-07 Dashboard | Tất cả | S | 2 |
| US-09 TensorRT-LLM | Tất cả | S | 2 |
| US-04 Trích xuất bảo hiểm | Bảo hiểm | S | 3 |