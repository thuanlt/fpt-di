# SRS — Yêu cầu chức năng & phi chức năng: Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** Software Requirements Specification (SRS)
**Liên quan:** `brd-nvidia-partner-expansion.md` (BR-01..BR-08)

---

## 1. Mô-đun & quy ước đánh số

- **FR-XXX** = Functional Requirement (ưu tiên MoSCoW: M/S/C/W)
- **NFR-XXX** = Non-Functional Requirement
- Module: `SEG` (segment packs), `NIM` (NVIDIA NIM), `TRT` (Triton/TensorRT), `GRD` (guardrails), `COMP` (compliance/audit), `PRICE` (pricing), `DASH` (dashboard)

---

## 2. Yêu cầu chức năng (FR)

### Module SEG — Segment Packs

#### FR-SEG-001: Danh mục model theo phân khúc (M)
Hệ thống **phải** cung cấp danh mục model được gắn nhãn theo phân khúc (coding, banking, securities, insurance).
- **FR-SEG-001.1:** Mỗi model **phải** có thuộc tính `segments[]` (danh sách phân khúc áp dụng).
- **FR-SEG-001.2:** Danh mục **phải** lọc được theo phân khúc.
- **Acceptance:** Khi chọn phân khúc "coding", danh mục chỉ hiển thị model có tag `coding`.

#### FR-SEG-002: Segment Pack Coding (M)
Hệ thống **phải** cung cấp gói tính năng coding gồm: model code (CodeLlama, DeepSeek-Coder, Qwen-Coder), endpoint low-latency, playground code, chế độ bảo mật mã nguồn.
- **FR-SEG-002.1:** Playground code **phải** hỗ trợ highlight syntax, completion, và hiển thị token usage.
- **FR-SEG-002.2:** Chế độ "code privacy" **phải** chặn lưu prompt chứa mã nguồn vào log.
- **Acceptance:** Bật code privacy → request chứa mã nguồn không xuất hiện trong audit log dạng plaintext.

#### FR-SEG-003: Segment Pack Banking (M)
Hệ thống **phải** hỗ trợ ngân hàng: guardrails, audit trail, data residency, chế độ tuân thủ NHNN.
- **FR-SEG-003.1:** Endpoint banking **phải** bật guardrails mặc định (chặn PII, chặn lời khuyên tài chính không được phép).
- **FR-SEG-003.2:** Data **phải** được xử lý trong biên giới VN (data residency).
- **Acceptance:** Request banking chứa PII (CMND/CCCD) bị guardrails chặn và ghi audit.

#### FR-SEG-004: Segment Pack Securities (S)
Hệ thống **nên** hỗ trợ endpoint low-latency cho phân tích tài chính thời gian thực + structured output.
- **FR-SEG-004.1:** Endpoint securities **nên** hỗ trợ JSON Schema (structured output).
- **FR-SEG-004.2:** Hệ thống **nên** cung cấp latency SLA p95 ≤500ms.
- **Acceptance:** Request với JSON Schema trả về output khớp schema; latency p95 đạt SLA.

#### FR-SEG-005: Segment Pack Insurance (S)
Hệ thống **nên** hỗ trợ xử lý tài liệu bảo hiểm (contract, claim) với trích xuất + guardrails.
- **FR-SEG-005.1:** Hệ thống **nên** trích xuất thông tin hợp đồng (party, sum insured, term) với độ chính xác ≥90%.
- **FR-SEG-005.2:** Guardrails **nên** chặn prompt chứa thông tin y tế nhạy cảm.
- **Acceptance:** Upload contract PDF → trích xuất các trường chính đạt ≥90%.

### Module NIM — NVIDIA NIM Integration

#### FR-NIM-001: NVIDIA NIM Catalog (M)
Hệ thống **phải** tích hợp catalog model NVIDIA NIM để deploy 1-click.
- **FR-NIM-001.1:** Catalog **phải** hiển thị model NIM (Llama, Mistral, Phi, DeepSeek...) với metadata.
- **FR-NIM-001.2:** Hệ thống **phải** cho phép deploy model NIM thành endpoint dedicated.
- **FR-NIM-001.3:** Hệ thống **phải** gọi API NVIDIA (NGC/NIM) để lấy danh sách model.
- **Acceptance:** Deploy model NIM từ catalog → endpoint running ≤5 phút.

#### FR-NIM-002: Version & update NIM (S)
Hệ thống **nên** theo dõi version NIM và cho phép cập nhật.
- **FR-NIM-002.1:** Hệ thống **nên** hiển thị version NIM hiện tại của endpoint.
- **FR-NIM-002.2:** Hệ thống **nên** cảnh báo khi có version mới.
- **Acceptance:** Endpoint hiển thị version NIM; có thông báo khi version mới khả dụng.

### Module TRT — Triton / TensorRT-LLM Optimization

#### FR-TRT-001: Engine optimization (S)
Hệ thống **nên** áp dụng TensorRT-LLM/Triton để tối ưu hiệu năng endpoint.
- **FR-TRT-001.1:** Endpoint **nên** có tùy chọn engine "TensorRT-LLM" khi deploy.
- **FR-TRT-001.2:** Hệ thống **nên** báo cáo cải thiện hiệu năng (throughput, latency) khi dùng engine tối ưu.
- **Acceptance:** Endpoint TensorRT-LLM đạt throughput ≥20% so với engine mặc định.

### Module GRD — Guardrails

#### FR-GRD-001: Guardrails theo phân khúc (M)
Hệ thống **phải** cung cấp guardrails (NeMo Guardrails) cấu hình theo phân khúc.
- **FR-GRD-001.1:** Hệ thống **phải** cho phép bật/tắt guardrails trên từng endpoint.
- **FR-GRD-001.2:** Hệ thống **phải** cung cấp template guardrails mặc định cho banking, insurance.
- **FR-GRD-001.3:** Guardrails **phải** chặn PII, prompt injection, và nội dung không phù hợp.
- **Acceptance:** Bật guardrails banking → prompt chứa CCCD bị chặn với response chuẩn.

#### FR-GRD-002: Log & báo cáo guardrails (S)
Hệ thống **nên** ghi log các sự kiện guardrails bị chặn.
- **FR-GRD-002.1:** Hệ thống **nên** ghi event `guardrail_blocked` với lý do.
- **Acceptance:** Dashboard hiển thị số request bị guardrails chặn theo thời gian.

### Module COMP — Compliance & Audit

#### FR-COMP-001: Audit trail không thể sửa (M)
Hệ thống **phải** ghi audit trail bất biến cho mọi hoạt động nhạy cảm.
- **FR-COMP-001.1:** Audit log **phải** ghi: timestamp, actor (user/key), action, entity, kết quả.
- **FR-COMP-001.2:** Audit log **phải** không thể sửa/xóa (append-only).
- **FR-COMP-001.3:** Audit log **phải** lưu ≥365 ngày.
- **Acceptance:** Mọi thao tác tạo/sửa/xóa endpoint, key, guardrails được ghi audit; không API nào xóa được audit.

#### FR-COMP-002: Data residency (M)
Hệ thống **phải** đảm bảo dữ liệu khách hàng không rời biên giới VN.
- **FR-COMP-002.1:** Endpoint banking/insurance **phải** xử lý trên hạ tầng VN.
- **FR-COMP-002.2:** Hệ thống **phải** hiển thị vùng dữ liệu (region) của endpoint.
- **Acceptance:** Endpoint banking chỉ deploy tại region VN (HAN-1, HAN-2, SGN-1).

#### FR-COMP-003: Role-based access (M)
Hệ thống **phải** hỗ trợ phân quyền theo vai trò (admin, operator, viewer).
- **FR-COMP-003.1:** Chỉ admin **được phép** tạo/sửa key và guardrails.
- **FR-COMP-003.2:** Viewer chỉ **được phép** xem, không tạo/sửa endpoint.
- **Acceptance:** User viewer gọi POST /endpoints → 403.

### Module PRICE — Pricing theo phân khúc

#### FR-PRICE-001: Gói giá theo phân khúc (M)
Hệ thống **phải** hỗ trợ định giá khác nhau theo phân khúc.
- **FR-PRICE-001.1:** Admin **phải** tạo được gói giá (rate/giờ, rate/token, commitment discount).
- **FR-PRICE-001.2:** Gói giá **phải** gắn với phân khúc + GPU type + region.
- **FR-PRICE-001.3:** Khách **phải** thấy giá đúng theo gói của mình.
- **Acceptance:** Tạo gói banking H100 → khách banking thấy giá gói đó, khách coding thấy gói coding.

#### FR-PRICE-002: Commitment & quota (S)
Hệ thống **nên** hỗ trợ commitment (7-30, 31-90, 91-180 ngày) và quota.
- **FR-PRICE-002.1:** Hệ thống **nên** tính giá commitment giảm dần theo thời hạn.
- **FR-PRICE-002.2:** Hệ thống **nên** áp quota (RPM/TPM) theo gói.
- **Acceptance:** Chọn commitment 91-180 ngày → giá giảm ≥20%; vượt quota → 429.

### Module DASH — Dashboard theo phân khúc

#### FR-DASH-001: Dashboard KPI theo phân khúc (S)
Hệ thống **nên** cung cấp dashboard KPI theo phân khúc.
- **FR-DASH-001.1:** Dashboard **nên** hiển thị: usage, cost, latency, error rate, guardrail blocks.
- **FR-DASH-001.2:** Dashboard **nên** lọc theo phân khúc, region, GPU.
- **FR-DASH-001.3:** Dashboard **nên** xuất báo cáo CSV.
- **Acceptance:** Lọc theo phân khúc banking → hiển thị KPI banking; xuất CSV thành công.

---

## 3. Yêu cầu phi chức năng (NFR)

#### NFR-PERF-001: Latency (M)
- Endpoint coding: p95 ≤800ms (completion ngắn).
- Endpoint securities: p95 ≤500ms.
- Endpoint banking/insurance: p95 ≤1500ms (cho phép guardrails overhead).
- **Acceptance:** Đo qua monitoring, đạt ngưỡng trong 95% thời gian.

#### NFR-PERF-002: Throughput (M)
- Throughput tăng ≥20% khi dùng TensorRT-LLM so với engine mặc định.
- **Acceptance:** Benchmark A/B đo được cải thiện ≥20%.

#### NFR-SEC-001: Bảo mật dữ liệu (M)
- Mã hóa dữ liệu at-rest (AES-256) và in-transit (TLS 1.2+).
- Không lưu plaintext PII trong log.
- **Acceptance:** Rà soát bảo mật không phát hiện plaintext PII trong log.

#### NFR-SEC-002: Authentication & Authorization (M)
- Mọi API operational yêu cầu API key hợp lệ với scope đúng.
- Guardrails chặn prompt injection.
- **Acceptance:** Gọi API không key → 401; thiếu scope → 403.

#### NFR-REL-001: Availability (M)
- Uptime ≥99.5% cho endpoint production.
- **Acceptance:** Monitoring 30 ngày đạt uptime ≥99.5%.

#### NFR-USAB-001: Khả năng sử dụng (S)
- Deploy endpoint từ catalog ≤5 phút (bao gồm tạo key, chọn model, deploy).
- UI hỗ trợ tiếng Việt và tiếng Anh.
- **Acceptance:** User mới deploy endpoint thành công trong ≤5 phút (test usability).

#### NFR-COMP-001: Tuân thủ (M)
- Tuân thủ Nghị định 13/2023/NĐ-CP (PDPA) về dữ liệu cá nhân.
- Tuân thủ quy định NHNN về AI trong ngân hàng (sandbox).
- Tuân thủ PCI-DSS nếu xử lý dữ liệu thẻ (roadmap).
- **Acceptance:** Rà soát tuân thủ đạt; audit trail đáp ứng yêu cầu.

---

## 4. Ma trận nguồn gốc (Traceability — BR ↔ FR)

| BR | FR liên quan |
|----|--------------|
| BR-01 | FR-SEG-001, FR-SEG-002 |
| BR-02 | FR-SEG-003, FR-GRD-001, FR-COMP-001, FR-COMP-002 |
| BR-03 | FR-SEG-004 |
| BR-04 | FR-SEG-005, FR-GRD-001 |
| BR-05 | FR-NIM-001, FR-NIM-002, FR-TRT-001, FR-GRD-001 |
| BR-06 | FR-PRICE-001, FR-PRICE-002 |
| BR-07 | FR-DASH-001 |
| BR-08 | FR-COMP-001, FR-COMP-002, FR-COMP-003 |

---

## 5. Ngoài phạm vi (v1.0)
- Training/fine-tuning toàn diện.
- DGX Cloud tích hợp sâu (pha 2).
- Marketplace mở bên thứ ba.
- Xử lý thanh toán thẻ trực tiếp (PCI-DSS — roadmap).