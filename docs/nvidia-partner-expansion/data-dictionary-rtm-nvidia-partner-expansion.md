# Data Dictionary & Requirements Traceability Matrix (RTM) — Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `brd-nvidia-partner-expansion.md`, `srs-nvidia-partner-expansion.md`

---

## 1. Data Dictionary

### 1.1 Entity: `model_catalog` (danh mục model)

| Field | Type | Required | Mô tả | Ví dụ |
|-------|------|----------|-------|-------|
| `id` | string (UUID) | Yes | Khóa chính | `mod-1234` |
| `name` | string | Yes | Tên model | `deepseek-coder-33b` |
| `family` | enum | Yes | Họ model | `code`, `llm`, `embedding` |
| `segments[]` | array<enum> | Yes | Phân khúc áp dụng | `["coding","banking"]` |
| `source` | enum | Yes | Nguồn model | `nvidia_nim`, `huggingface`, `fpt` |
| `nim_version` | string | No | Version NIM (nếu nguồn NIM) | `1.3.0` |
| `gpu_compatible[]` | array<enum> | Yes | GPU hỗ trợ | `["H100","H200","A30","B300"]` |
| `max_context` | int | Yes | Max context length | `32768` |
| `quantizations[]` | array<enum> | Yes | Định dạng lượng tử | `["bf16","fp8","awq"]` |
| `status` | enum | Yes | Trạng thái | `available`, `coming_soon`, `deprecated` |

### 1.2 Entity: `endpoint` (bổ sung)

| Field | Type | Required | Mô tả | Ví dụ |
|-------|------|----------|-------|-------|
| `segment` | enum | No | Phân khúc gắn | `coding`, `banking`, `securities`, `insurance` |
| `guardrails_enabled` | boolean | No | Bật guardrails | `true` |
| `guardrails_template` | enum | No | Template guardrails | `banking`, `insurance`, `general` |
| `engine` | enum | No | Engine inference | `vllm`, `triton`, `tensorrt-llm`, `nim` |
| `code_privacy` | boolean | No | Chế độ bảo mật mã nguồn | `false` |
| `structured_output` | boolean | No | Hỗ trợ JSON Schema | `true` |
| `price_pack_id` | string | No | Gói giá áp dụng | `pack-bank-h100-01` |
| `data_residency` | enum | Yes | Vùng dữ liệu | `VN` (HAN-1, HAN-2, SGN-1) |

### 1.3 Entity: `guardrail_event` (sự kiện guardrails)

| Field | Type | Required | Mô tả | Ví dụ |
|-------|------|----------|-------|-------|
| `id` | string (UUID) | Yes | Khóa chính | `evt-5678` |
| `endpoint_id` | string | Yes | Endpoint liên quan | `ep-1234` |
| `timestamp` | datetime | Yes | Thời điểm | `2026-08-25T06:00:00Z` |
| `rule` | enum | Yes | Rule chặn | `pii`, `prompt_injection`, `financial_advice` |
| `severity` | enum | Yes | Mức độ | `info`, `warn`, `critical` |
| `blocked` | boolean | Yes | Có chặn không | `true` |
| `reason` | string | No | Lý do chi tiết | `detected CCCD pattern` |

### 1.4 Entity: `audit_log` (bất biến)

| Field | Type | Required | Mô tả | Ví dụ |
|-------|------|----------|-------|-------|
| `id` | string (UUID) | Yes | Khóa chính | `aud-9012` |
| `timestamp` | datetime | Yes | Thời điểm | `2026-08-25T06:00:00Z` |
| `actor` | string | Yes | Người thao tác | `user-xyz` / `key-abcd` |
| `role` | enum | Yes | Vai trò | `admin`, `operator`, `viewer` |
| `action` | enum | Yes | Hành động | `endpoint.create`, `key.revoke`, `guardrails.update` |
| `entity_id` | string | Yes | Đối tượng | `ep-1234` |
| `result` | enum | Yes | Kết quả | `success`, `denied`, `error` |
| `ip` | string | Yes | Địa chỉ IP | `203.113.x.x` |
| `immutable` | boolean | Yes | Bất biến (luôn true) | `true` |

### 1.5 Entity: `price_pack` (gói giá)

| Field | Type | Required | Mô tả | Ví dụ |
|-------|------|----------|-------|-------|
| `id` | string | Yes | Khóa chính | `pack-bank-h100-01` |
| `segment` | enum | Yes | Phân khúc | `banking` |
| `gpu` | enum | Yes | GPU | `H100` |
| `region` | enum | Yes | Region | `HAN-1` |
| `rate_per_hour` | decimal | Yes | Giá/giờ | `12.50` |
| `rate_per_token` | decimal | No | Giá/token | `0.000001` |
| `commitment` | enum | Yes | Cam kết | `on-demand`, `7-30`, `31-90`, `91-180` |
| `discount_pct` | decimal | No | Chiết khấu | `20.0` |
| `quota_rpm` | int | No | Quota RPM | `1000` |
| `quota_tpm` | int | No | Quota TPM | `1000000` |

### 1.6 Enum: `segment` (phân khúc)

| Giá trị | Mô tả |
|---------|-------|
| `coding` | Nhà phát triển phần mềm |
| `banking` | Ngân hàng |
| `securities` | Chứng khoán / quỹ đầu tư |
| `insurance` | Bảo hiểm |
| `general` | Không phân khúc cụ thể |

### 1.7 Enum: `engine`

| Giá trị | Mô tả |
|---------|-------|
| `vllm` | vLLM (mặc định hiện tại) |
| `triton` | NVIDIA Triton Inference Server |
| `tensorrt-llm` | TensorRT-LLM optimization |
| `nim` | NVIDIA NIM container |

---

## 2. Thuật ngữ chuyên ngành (Domain Glossary)

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| **NIM** | NVIDIA Inference Microservices — container inference tối ưu sẵn cho model phổ biến |
| **Triton** | NVIDIA Triton Inference Server — serving đa model, tối ưu throughput |
| **TensorRT-LLM** | Bộ tối ưu inference LLM của NVIDIA trên GPU |
| **NeMo Guardrails** | Framework rào chắn an toàn cho LLM/agent của NVIDIA |
| **NGC** | NVIDIA GPU Cloud — registry chứa container/pretrained model |
| **DGX Cloud** | Dịch vụ AI compute-as-a-service của NVIDIA |
| **PDPA** | Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân |
| **Data residency** | Dữ liệu phải xử lý/lưu trong biên giới quốc gia |
| **Audit trail** | Nhật ký bất biến ghi mọi hoạt động nhạy cảm |
| **Structured output** | Ép model trả output theo JSON Schema |
| **Underwriting** | Định phí/thẩm định rủi ro bảo hiểm |
| **PII** | Personally Identifiable Information — thông tin định danh cá nhân |

---

## 3. Requirements Traceability Matrix (RTM)

### 3.1 BR ↔ FR ↔ US ↔ PF

| BR | FR | US | PF |
|----|----|----|----|
| BR-01 (Coding) | FR-SEG-001, FR-SEG-002 | US-08 | — |
| BR-02 (Banking) | FR-SEG-003, FR-GRD-001, FR-COMP-001, FR-COMP-002 | US-02, US-05 | PF-02, PF-05 |
| BR-03 (Securities) | FR-SEG-004 | US-03 | — |
| BR-04 (Insurance) | FR-SEG-005, FR-GRD-001 | US-04 | PF-03 |
| BR-05 (NVIDIA) | FR-NIM-001, FR-NIM-002, FR-TRT-001, FR-GRD-001 | US-01, US-09 | PF-01 |
| BR-06 (Pricing) | FR-PRICE-001, FR-PRICE-002 | US-06 | PF-04 |
| BR-07 (Dashboard) | FR-DASH-001 | US-07 | — |
| BR-08 (Compliance) | FR-COMP-001, FR-COMP-002, FR-COMP-003 | US-05, US-10 | PF-05, PF-06 |

### 3.2 FR ↔ NFR

| FR | NFR liên quan |
|----|---------------|
| FR-SEG-002 (coding) | NFR-PERF-001 (≤800ms), NFR-SEC-001 |
| FR-SEG-004 (securities) | NFR-PERF-001 (≤500ms) |
| FR-SEG-003, FR-SEG-005 | NFR-COMP-001 (PDPA), NFR-SEC-001 |
| FR-GRD-001 | NFR-SEC-002 (guardrails) |
| FR-COMP-001 | NFR-SEC-001, NFR-COMP-001 |
| FR-NIM-001, FR-TRT-001 | NFR-PERF-002 (≥20%), NFR-REL-001 |
| FR-PRICE-001 | NFR-USAB-001 |
| FR-DASH-001 | NFR-USAB-001 |

### 3.3 Phân phối theo pha

| Pha | BR | FR | US |
|-----|----|----|----|
| **Pha 1 (MVP)** | BR-01, BR-02, BR-05, BR-08 | FR-SEG-001/002/003, FR-NIM-001, FR-GRD-001, FR-COMP-001/002/003 | US-01, US-02, US-05, US-08, US-10 |
| **Pha 2** | BR-03, BR-06, BR-07 | FR-SEG-004, FR-NIM-002, FR-TRT-001, FR-PRICE-001/002, FR-DASH-001 | US-03, US-06, US-07, US-09 |
| **Pha 3** | BR-04 | FR-SEG-005, FR-GRD-002 | US-04 |

---

## 4. Chuẩn & quy định tham chiếu

| Chuẩn/Quy định | Áp dụng cho | Ghi chú |
|----------------|-------------|---------|
| Nghị định 13/2023/NĐ-CP (PDPA) | Banking, Insurance | Bảo vệ dữ liệu cá nhân, PII |
| Nghị định 141/2016/NĐ-CP (fintech sandbox) | Banking | Thử nghiệm công nghệ có kiểm soát |
| Thông tư NHNN về AI/CNTT | Banking | Tuân thủ ngân hàng |
| PCI-DSS | Banking (roadmap) | Nếu xử lý dữ liệu thẻ |
| ISO/IEC 27001 | Tất cả | Quản lý an toàn thông tin |
| RFC 8259 (JSON) / RFC 8927 (JSON Schema) | Securities | Structured output |
| OpenAI API compatibility | Tất cả | Định dạng API chuẩn |