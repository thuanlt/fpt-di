# Kế hoạch kiểm thử — Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `user-stories-nvidia-partner-expansion.md`, `api-spec-nvidia-partner-expansion.md`

> Kế hoạch kiểm thử theo từng story + test case mức hệ thống (API). QA dùng làm checklist khi thực thi.

---

## 1. Phạm vi kiểm thử

### Trong phạm vi
- Kiểm thử chức năng (functional) cho US-01..US-10.
- Kiểm thử API (hợp đồng) theo `api-spec-nvidia-partner-expansion.md`.
- Kiểm thử phi chức năng (latency, throughput, bảo mật).
- Kiểm thử hồi quy (regression) các tính năng hiện có.

### Ngoài phạm vi
- Kiểm thử hiệu năng toàn diện (load test) — pha 2.
- Kiểm thử bảo mật penetration — pha 2.
- Kiểm thử UX/usability chính thức — pha 2.

---

## 2. Chiến lược kiểm thử

| Tầng | Công cụ | Mục tiêu |
|------|---------|----------|
| Unit test | Jest (BE) | Logic store, guardrails rule, pricing |
| API test | Supertest / script | Hợp đồng API, mã lỗi |
| E2E (UI) | Playwright | Luồng người dùng trên console |
| Regression | Script hiện có | Không vỡ tính năng cũ |

---

## 3. Test case theo story

> Định dạng: `TC-<Story>-<STT>`. Ưu tiên: P0=Blocker, P1=High, P2=Medium, P3=Low.

### US-01 — Deploy NVIDIA NIM

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US01-1 | Deploy NIM thành công | Catalog → chọn model NIM → Deploy (key scope endpoints) | Endpoint `running` ≤5 phút; gọi chat/completions OK | P0 |
| TC-US01-2 | Deploy không key | Deploy không có Authorization | 401 | P0 |
| TC-US01-3 | Deploy thiếu scope | Deploy với key scope `chat` | 403 | P0 |
| TC-US01-4 | Deploy tên trùng | Deploy 2 endpoint cùng tên | 409 | P1 |
| TC-US01-5 | Lọc catalog theo segment | GET /v1/catalog?segment=coding | Chỉ model tag coding | P1 |
| TC-US01-6 | Deploy model không hỗ trợ engine | Chọn engine không tương thích | Chặn + lỗi rõ | P2 |

### US-02 — Guardrails banking

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US02-1 | Bật guardrails banking | PATCH guardrails template=banking | enabled=true, rules áp dụng | P0 |
| TC-US02-2 | Chặn PII | Gửi prompt chứa CCCD | Guardrails chặn + ghi event | P0 |
| TC-US02-3 | Chặn prompt injection | Gửi "ignore instructions" | Chặn + ghi event | P0 |
| TC-US02-4 | Request hợp lệ | Gửi prompt bình thường | Forward → response OK | P1 |
| TC-US02-5 | Event log | GET guardrails/events | Đếm blocked đúng | P1 |
| TC-US02-6 | Template không hợp lệ | PATCH template=sai | 400 | P2 |

### US-03 — Structured output

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US03-1 | Output khớp schema | Gửi response_format json_schema | Output validate đúng schema | P0 |
| TC-US03-2 | Schema không hợp lệ | Gửi schema sai | 400 lỗi rõ | P1 |
| TC-US03-3 | Latency SLA | Đo p95 endpoint securities | p95 ≤500ms | P1 |

### US-04 — Trích xuất bảo hiểm

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US04-1 | Trích xuất hợp đồng | Upload PDF hợp đồng | Trích xuất ≥90% chính xác | P0 |
| TC-US04-2 | Chặn thông tin y tế | Tài liệu chứa thông tin y tế | Che/chặn nhạy cảm | P0 |
| TC-US04-3 | PDF không đọc được | Upload scan kém | Yêu cầu upload lại | P2 |

### US-05 — Audit trail

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US05-1 | Ghi audit khi tạo endpoint | POST /v1/endpoints | Audit log ghi đủ fields | P0 |
| TC-US05-2 | Không xóa được audit | Gọi DELETE audit | 405/403 | P0 |
| TC-US05-3 | Lọc audit theo actor | GET /v1/audit?actor=x | Kết quả đúng | P1 |
| TC-US05-4 | Audit yêu cầu admin | GET /v1/audit key không admin | 403 | P1 |

### US-06 — Gói giá

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US06-1 | Tạo gói giá | POST /v1/price-packs | 201, lưu đúng | P0 |
| TC-US06-2 | Trùng gói | Tạo gói trùng segment+gpu+region | 409 | P1 |
| TC-US06-3 | Khách thấy đúng gói | Khách segment X xem giá | Thấy gói X | P1 |
| TC-US06-4 | Vượt quota | Gửi request vượt RPM | 429 | P1 |

### US-07 — Dashboard

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US07-1 | KPI theo phân khúc | GET /v1/dashboard?segment=banking | KPI banking đúng | P0 |
| TC-US07-2 | Export CSV | GET /v1/dashboard?format=csv | File CSV đúng | P1 |
| TC-US07-3 | Guardrail blocks | So dashboard với guardrail_event | Khớp số liệu | P1 |

### US-08 — Code privacy

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US08-1 | Không log mã nguồn | Bật code privacy, gửi mã nguồn | Prompt không xuất hiện plaintext trong audit | P0 |
| TC-US08-2 | Vẫn hoạt động | Bật code privacy, gửi request | Response bình thường | P1 |
| TC-US08-3 | Tắt privacy | Tắt, gửi mã nguồn | Log như thường | P2 |

### US-09 — TensorRT-LLM

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US09-1 | Deploy engine tensorrt-llm | Deploy endpoint engine=tensorrt-llm | Endpoint running | P0 |
| TC-US09-2 | Throughput +20% | Benchmark vs engine mặc định | Tăng ≥20% | P0 |
| TC-US09-3 | Monitoring hiển thị | Xem throughput/latency | Hiển thị đúng | P1 |

### US-10 — Phân quyền

| ID | Mục tiêu | Steps | Expected | Prio |
|----|----------|-------|----------|------|
| TC-US10-1 | Viewer không tạo endpoint | Viewer gọi POST /v1/endpoints | 403 | P0 |
| TC-US10-2 | Operator tạo endpoint | Operator gọi POST /v1/endpoints | Cho phép (scope đúng) | P0 |
| TC-US10-3 | Admin tạo key | Admin gọi POST /v1/keys | Cho phép | P1 |
| TC-US10-4 | User chưa gán vai trò | User không có role | Mặc định viewer | P2 |

---

## 4. Kiểm thử phi chức năng

| ID | Loại | Mục tiêu | Tiêu chí | Prio |
|----|------|----------|----------|------|
| NF-01 | Latency | Endpoint coding | p95 ≤800ms | P0 |
| NF-02 | Latency | Endpoint securities | p95 ≤500ms | P0 |
| NF-03 | Latency | Endpoint banking (guardrails) | p95 ≤1500ms | P1 |
| NF-04 | Throughput | TensorRT-LLM | +20% vs mặc định | P0 |
| NF-05 | Availability | Endpoint production | Uptime ≥99.5% | P1 |
| NF-06 | Bảo mật | PII trong log | Không plaintext PII | P0 |

---

## 5. Kiểm thử hồi quy (Regression)

Trước khi release mỗi pha, chạy lại toàn bộ suite hiện có:
- `tests/endpoints`, `tests/endpoints-monitoring`, `tests/endpoints-p0/p1/p2`
- `tests/endpoints-carryover-swap`, `tests/endpoint-usage`, `tests/endpoint-vllm`
- `tests/playground-endpoint`, `tests/batch`, `tests/keys`, `tests/keys-verify`, `tests/data`

**Tiêu chí:** 100% pass, 0 fail trước khi merge.

---

## 6. Tiêu chí thoát (Exit criteria)

- 100% test case P0 pass.
- ≥95% test case P1 pass.
- 0 lỗi Blocker/Major còn mở.
- Regression 100% pass.
- Audit trail & guardrails đạt kiểm thử tuân thủ.

---

## 7. Ma trận kiểm thử ↔ Story

| Story | TC |
|-------|----|
| US-01 | TC-US01-1..6 |
| US-02 | TC-US02-1..6 |
| US-03 | TC-US03-1..3 |
| US-04 | TC-US04-1..3 |
| US-05 | TC-US05-1..4 |
| US-06 | TC-US06-1..4 |
| US-07 | TC-US07-1..3 |
| US-08 | TC-US08-1..3 |
| US-09 | TC-US09-1..3 |
| US-10 | TC-US10-1..4 |