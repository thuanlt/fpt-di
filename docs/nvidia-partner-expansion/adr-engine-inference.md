# ADR — Lựa chọn engine inference: vLLM vs Triton vs TensorRT-LLM

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** Architecture Decision Record (ADR)
**Liên quan:** `production-readiness-gpu-inference.md`, `srs-nvidia-partner-expansion.md` (FR-TRT-001)

> ADR ghi lại quyết định kiến trúc: chọn engine inference nào cho FPT DDI, vì sao, và trade-off.

---

## 1. Bối cảnh (Context)

FPT DDI cần chọn engine inference để chạy model LLM trên GPU NVIDIA (H100/H200/A30/B300). Có 3 ứng viên chính từ hệ sinh thái NVIDIA:

| Engine | Bản chất | Điểm mạnh | Điểm yếu |
|--------|----------|-----------|----------|
| **vLLM** | Serving framework LLM (PagedAttention, continuous batching) | Dễ dùng, OpenAI-compatible, throughput cao, community lớn | Tối ưu chưa sâu bằng TensorRT-LLM |
| **Triton Inference Server** | Serving đa model, dynamic batching, multi-framework | Flexibility, serving nhiều model, ensemble | Phức tạp hơn, cần cấu hình model repo |
| **TensorRT-LLM** | Compiler tối ưu inference LLM trên GPU | Hiệu năng tối đa (latency/throughput thấp nhất) | Compile lâu, ít model hỗ trợ, phức tạp |

Yêu cầu từ SRS:
- FR-TRT-001: throughput tăng ≥20% với TensorRT-LLM.
- NFR-PERF-001: latency p95 coding ≤800ms, securities ≤500ms.
- NFR-PERF-002: throughput +20% với engine tối ưu.

---

## 2. Quyết định (Decision)

**Sử dụng chiến lược multi-engine** — cho phép chọn engine theo endpoint, không bắt buộc một engine duy nhất:

| Engine | Khi nào dùng | Ưu tiên |
|--------|--------------|---------|
| **vLLM** (mặc định) | Endpoint通用, model phổ biến, cần OpenAI-compatible | Mặc định |
| **TensorRT-LLM** | Endpoint cần latency/throughput tối đa (securities, coding low-latency) | Tối ưu |
| **Triton** | Cần serving đa model / ensemble / hybrid | Đặc thù |

**Lý do chọn multi-engine:**
1. Không có engine nào thắng tuyệt đối mọi scenario.
2. Cho phép tối ưu theo phân khúc (securities cần latency thấp → TensorRT-LLM; general → vLLM).
3. Giảm risk — nếu 1 engine có vấn đề, fallback engine khác.
4. Tương thích với catalog NIM (NIM có thể chạy trên vLLM/Triton).

**Engine mặc định: vLLM** — vì dễ vận hành, OpenAI-compatible (khách không cần đổi code), community lớn, throughput tốt.

---

## 3. Phân tích lựa chọn (Options Analysis)

### Option A — Chỉ vLLM
- **Pros:** Đơn giản, 1 engine duy nhất, dễ vận hành.
- **Cons:** Không đạt tối ưu latency/throughput cho securities (cần ≤500ms).
- **Kết luận:** Không đủ cho yêu cầu NFR-PERF-001 (securities).

### Option B — Chỉ TensorRT-LLM
- **Pros:** Hiệu năng tối đa.
- **Cons:** Compile lâu, ít model hỗ trợ, phức tạp vận hành, không phải model nào cũng compile được.
- **Kết luận:** Không phù hợp làm engine duy nhất (rủi ro cao).

### Option C — Multi-engine (ĐÃ CHỌN)
- **Pros:** Tối ưu theo phân khúc, giảm risk, linh hoạt.
- **Cons:** Phức tạp vận hành hơn (nhiều engine), cần benchmark để chọn.
- **Kết luận:** Phù hợp nhất với yêu cầu đa phân khúc.

---

## 4. Hệ quả (Consequences)

### Tích cực
- Tối ưu hiệu năng theo phân khúc (securities → TensorRT-LLM, general → vLLM).
- Linh hoạt, giảm risk.
- Đáp ứng NFR-PERF-001/002.

### Tiêu cực / cần quản lý
- Phức tạp vận hành: cần monitor + benchmark mỗi engine.
- Cần cache TensorRT-LLM engine (compile lâu) — FR-INT-001.
- Cần tài liệu vận hành cho mỗi engine.
- Team cần kỹ năng vận hành 3 engine.

---

## 5. Tiêu chí chọn engine theo endpoint (Decision Matrix)

| Tiêu chí | vLLM | TensorRT-LLM | Triton |
|----------|------|--------------|--------|
| Latency p95 | Tốt | **Tối ưu** | Tốt |
| Throughput | Tốt | **Tối ưu** | Tốt |
| Dễ vận hành | **Cao** | Thấp | Trung bình |
| Model hỗ trợ | **Rộng** | Hẹp | Rộng |
| OpenAI-compatible | **Có** | Có (qua adapter) | Có (via) |
| Compile time | Không | **Lâu** | Không |
| Phù hợp securities | OK | **Tối ưu** | OK |
| Phù hợp general | **Tốt** | OK | OK |

**Quy tắc chọn:**
- Endpoint `securities` / `coding` low-latency → **TensorRT-LLM** (nếu model hỗ trợ).
- Endpoint `general` / `banking` / `insurance` → **vLLM** (mặc định).
- Cần multi-model/ensemble → **Triton**.

---

## 6. Benchmark yêu cầu (trước khi production)

| Benchmark | Mục tiêu | Engine |
|-----------|----------|--------|
| Throughput (tokens/s) | TensorRT-LLM ≥ vLLM × 1.2 | Cả 2 |
| Latency p95 (coding) | ≤800ms | Cả 2 |
| Latency p95 (securities) | ≤500ms | TensorRT-LLM |
| Time-to-first-token | ≤500ms | Cả 2 |
| GPU memory utilization | ≤90% | Cả 2 |

Benchmark phải chạy trên **GPU thật** (không mock) — xem `production-readiness-gpu-inference.md` mục 4.5.

---

## 7. Status & review
- **Status:** Draft — chờ review.
- **Review khi:** Có kết quả benchmark trên GPU thật (P1 production).
- **Revisit nếu:** NVIDIA ra engine mới, hoặc model mới không hỗ trợ TensorRT-LLM.