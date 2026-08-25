# Competitive Survey — Cấu hình tham số model sau khi deploy dedicated inference

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Câu hỏi:** Khi model dedicated inference đã deploy xong, muốn cấu hình thêm các tham số để model chạy tốt hơn thì làm gì? Đối thủ cung cấp những chức năng nào?
**Phạm vi:** Khảo sát các nền tảng dedicated inference (Together AI, Fireworks AI, Baseten, Friendli, Hugging Face Inference Endpoints, vLLM-based) về **post-deploy configuration / runtime tuning** — những tham số có thể chỉnh sau khi model đã chạy.
**Liên quan:** `docs/together-ai-endpoints-console-survey.md`, `docs/gap-analysis-fpt-ddi-vs-together-ai-dedicated.md`, `docs/market-research-dedicated-inference.md`

---

## 1. Executive Summary

| Câu hỏi | Trả lời |
|---------|---------|
| **Đối thủ có cho chỉnh tham số sau deploy không?** | Có, nhưng **phân 2 lớp rõ rệt**: (A) tham số **serving/engine** (cấu hình cách model chạy) — chỉnh được, thường cần redeploy; (B) tham số **inference/sampling** (temperature, max_tokens…) — **KHÔNG cấu hình ở endpoint**, mà truyền **per-request** qua API |
| **Xu hướng chung của đối thủ** | Không để user chỉnh engine param trực tiếp (tránh phá hạ tầng); thay vào đó expose **các knobs an toàn, có kiểm soát**: autoscaling, GPU type/count, context length, quantization, KV cache, concurrency |
| **Knob được cấu hình nhiều nhất** | **Autoscaling** (min/max replica + scaling metric) — mọi nền tảng đều có, là "cấu hình sau deploy" phổ biến nhất |
| **Knob có tác động hiệu năng lớn nhất** | **Context length (max_model_len)**, **GPU memory / KV cache**, **quantization**, **tensor parallel** — quyết định throughput & latency |
| **Điểm mấu chốt cho FPT** | FPT DDI hiện **chỉ có autoscale_enabled cơ bản + GPU swap** — thiếu gần hết các knob serving mà đối thủ có. Đây là gap rõ nhất để nâng cấp "My Endpoints" |

---

## 2. Phân loại tham số — 2 lớp quan trọng

Khi khảo sát, cần tách bạch **2 lớp tham số** vì cách xử lý của đối thủ khác hẳn nhau:

### Lớp A — Serving / Engine parameters (cấu hình cách model chạy)
Chỉnh ở **thời điểm deploy hoặc redeploy** endpoint. Ảnh hưởng throughput, latency, chi phí, khả năng chạy model lớn.

| Tham số | Ý nghĩa | Ví dụ |
|---------|---------|-------|
| **GPU type / count** | Loại GPU (H100/B200…) + số GPU | `1xnvidia-h100-80gb`, tensor parallel 2/4/8 |
| **Quantization** | BF16 / FP8 / AWQ — giảm VRAM, tăng throughput | FP8 KV cache |
| **Context length (max_model_len)** | Độ dài ngữ cảnh tối đa | 128K → 512K |
| **KV cache** | Dung lượng cache; host KV cache vượt VRAM | Friendli Host KV Cache |
| **Concurrency / batch** | max_num_seqs, max_num_batched_tokens | vLLM: 256–2048 |
| **GPU memory utilization** | % VRAM dùng cho model/KV cache | 0.85–0.9 |
| **Autoscaling** | min/max replica + scaling metric | inflight, gpu_util, e2e_latency |

### Lớp B — Inference / Sampling parameters (tham số sinh kết quả)
Temperature, top_p, top_k, max_tokens, stop, frequency_penalty, presence_penalty…

> **Quy tắc chung của mọi đối thủ:** Lớp B **không cấu hình ở endpoint**, mà truyền **trong từng request** (OpenAI-compatible body). Endpoint chỉ có thể đặt **default** (optional), user override per-request.

**Hệ quả cho FPT:** Nếu user hỏi "muốn model chạy tốt hơn" theo nghĩa sinh kết quả (temperature, max_tokens…) → câu trả lời là **đã có sẵn qua API** (FPT DDI `invoke.js` đã pass `temperature`, `max_tokens` per-request). Nếu theo nghĩa **hiệu năng/chi phí** (context, GPU, autoscaling, quantization) → **FPT đang thiếu**, đây là phần cần xây.

---

## 3. Khảo sát chi tiết từng đối thủ

### 3.1 Together AI (Dedicated Endpoints / DE 2.0) — chuẩn mực

**Resource model:** Project → Endpoint → Deployment → Replica → (Model + Config). Điểm hay: tách **Config** (cách chạy 1 weight) khỏi **Model** (weights) — đổi config = tạo revision mới, không đụng model.

**Knobs có thể cấu hình (qua CLI `tg beta endpoints update` hoặc console):**

| Knob | Cấu hình được sau deploy? | Ghi chú |
|------|:---:|---------|
| **min/max replicas** | ✅ | `tg beta endpoints update` |
| **Scaling metric + target** | ✅ | 8 metrics: inflight (default), gpu_utilization, token_utilization, cache_hit_rate, throughput_per_replica, **ttft, e2e_latency (p50–p99), decoding_speed** |
| **Traffic weight** | ✅ | Chia % traffic giữa deployments |
| **A/B test % / promote** | ✅ | 1 control + 19 variants, ramp |
| **GPU type / count** | ⚠️ (redeploy) | Chọn lúc deploy; đổi cần deployment mới |
| **Quantization** | ⚠️ (redeploy) | Chọn lúc deploy (BF16/FP8) |
| **Context length** | ⚠️ (redeploy) | Theo model/config |
| **Env vars** | ✅ | Qua `pyproject.toml` / Jig CLI |

**Insight:** Together cho chỉnh **autoscaling + traffic + A/B** ngay trên endpoint đang chạy (không downtime). Còn **GPU/quantization/context** thì "immutable config" — phải redeploy. Đây là thiết kế tốt: cái an toàn thì hot-update, cái rủi ro thì bắt redeploy.

### 3.2 Fireworks AI (Dedicated / On-Demand)

- Dedicated deployment = GPU riêng, multi-region, hỗ trợ post-trained model.
- **Knobs:** GPU instance type, autoscaling (min/max), region.
- **Điểm mạnh:** **Single-LoRA live merge** — deploy LoRA adapter lên dedicated mà hiệu năng bằng base model, không cần 2 bước.
- **Insight:** Tập trung vào **fine-tune → deploy 1-click** hơn là nhiều knob serving. "Chạy tốt hơn" của họ = fine-tune model đúng task thay vì vặn engine param.

### 3.3 Baseten (Containerized deployment + autoscaling)

- Deploy qua **Truss CLI** (`truss push`); config trong `config.yaml`.
- **Knobs:** GPU instance type (đổi instance type = tạo deployment mới), autoscaling (replicas theo traffic), resources (CPU/RAM/GPU), env vars.
- **Insight:** Autoscaling là feature chủ đạo ("spawn/terminate replicas theo traffic, chỉ trả tiền compute đang dùng"). Đổi instance type = **tạo deployment mới rồi promote** — pattern "immutable deployment" giống Together.

### 3.4 Friendli (Dedicated Endpoints)

- **Điểm khác biệt:** **Host KV Cache** — attach thêm host memory cho KV cache, kéo dài context vượt giới hạn VRAM, giữ latency khi context dài.
- **Insight:** Đây là knob "chạy tốt hơn" rất thực tế cho workload context dài — FPT chưa có khái niệm này.

### 3.5 Hugging Face Inference Endpoints (dedicated)

- **Knobs (qua vLLM engine args):** **Tensor Parallel Size** (số GPU chia weights/layer — tăng để chạy model lớn, giải phóng VRAM cho KV cache), GPU instance, autoscaling (min/max replica).
- **Insight:** TF cho chỉnh **tensor parallel** rõ ràng — đây là knob quan trọng nhất để "chạy model to hơn / nhanh hơn" mà FPT chưa expose.

### 3.6 vLLM (engine gốc — nguồn chân lý cho serving params)

Mọi nền tảng trên đều chạy vLLM phía sau. Các tham số **engine** quyết định hiệu năng:

| Tham số | Mặc định | Khuyến nghị |
|---------|----------|-------------|
| `--max-model-len` | theo model | giảm nếu use-case ngắn → tăng throughput |
| `--gpu-memory-utilization` | 0.9 | 0.85–0.9 |
| `--max-num-seqs` | 1024 (V1) | 256–2048 theo traffic |
| `--max-num-batched-tokens` | dynamic (8K–32K) | 32768+ cho throughput cao |
| `--quantization` (FP8 KV cache) | — | giảm VRAM, tăng tốc |
| `--tensor-parallel-size` | 1 | power of 2, chạy model lớn |

**Insight quan trọng:** Đây chính là "các tham số để model chạy tốt hơn" mà user hỏi. Nhưng đối thủ **không expose toàn bộ** — họ gói thành các preset/knob an toàn (context length, GPU count, autoscaling) và giấu phần còn lại.

---

## 4. Ma trận so sánh — Knob cấu hình sau deploy

| Knob | Together | Fireworks | Baseten | Friendli | HF IE | **FPT DDI** |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Autoscaling (min/max replica) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (P0) |
| Scaling metric (inflight/gpu/latency) | ✅ 8 metrics | ✅ | ✅ | ✅ | ✅ | ✅ 3 metrics (P0) |
| GPU type / count (swap) | ⚠️ redeploy | ✅ | ⚠️ redeploy | ✅ | ✅ | ✅ GPU swap (Sprint 3) + count (P1) |
| Context length (max_model_len) | ⚠️ redeploy | ✅ | ✅ | ✅ | ✅ | ✅ hot-update (P0) |
| Quantization (FP8/BF16/AWQ) | ⚠️ redeploy | ✅ | ✅ | ✅ | ✅ | ✅ redeploy (P1) |
| KV cache (host/VRAM) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ host KV cache (P2) |
| Tensor parallel | ⚠️ redeploy | ✅ | ✅ | ✅ | ✅ | ✅ gpuCount (P1) |
| Concurrency / batch size | ❌ (ẩn) | ❌ | ❌ | ❌ | ❌ | ❌ |
| GPU memory utilization | ❌ (ẩn) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Traffic split / A-B / shadow | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Env vars / runtime config | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (compose) |
| Sampling params (temp/max_tokens) | per-request | per-request | per-request | per-request | per-request | ✅ per-request + defaults (P2) |

**Đọc bảng:** Đối thủ cho chỉnh **autoscaling + GPU + context + quantization** (nhóm "hiệu năng/chi phí"), **giấu** concurrency/memory (nhóm "engine nội bộ"), và để **sampling params** qua per-request.

---

## 5. Insight & Khuyến nghị cho FPT DDI

### 5.1 Ba cấp độ "chạy tốt hơn" mà user có thể hỏi

1. **Sinh kết quả tốt hơn** (temperature, top_p, max_tokens, stop, system prompt) → **đã có sẵn** qua API per-request. Cần làm rõ trong UI/docs để user không tưởng là thiếu.
2. **Hiệu năng/chi phí tốt hơn** (context, GPU, autoscaling, quantization, concurrency) → **FPT thiếu gần hết**, đây là gap cần xây.
3. **Kết quả đúng task hơn** (fine-tune LoRA, RAG, prompt) → roadmap Phase 2 (fine-tuning).

### 5.2 Gap FPT DDI cần đóng (theo mức ưu tiên)

> **Quyết định 25/08/2026:** PO chọn triển khai **tuần tự P0 → P1 → P2** (làm đủ cả 6 chức năng). **✅ ĐÃ TRIỂN KHAI XONG toàn bộ P0 + P1 + P2** (25/08/2026).

| Giai đoạn | Chức năng | Cơ chế | Trạng thái |
|:---:|-----------|--------|:---:|
| **P0** | **Autoscaling đầy đủ**: min/max replica + chọn scaling metric (inflight, gpu_util, e2e_latency) | Hot-update | ✅ |
| **P0** | **Context length (max_model_len)** có thể chỉnh | Hot-update | ✅ |
| **P1** | **GPU count / tensor parallel** | Redeploy (immutable) | ✅ |
| **P1** | **Quantization** (FP8/BF16/AWQ) | Redeploy (immutable) | ✅ |
| **P2** | **Host KV cache** (cho context dài) | Redeploy (immutable) | ✅ |
| **P2** | **Sampling defaults** (temperature/top_p/max_tokens, user override per-request) | Hot-update | ✅ |

**Chi tiết triển khai (25/08/2026):**
- **Backend:** `src/endpoints/store.js` (create + `config()` hot-update + `redeployConfig()` immutable, cả 2 backend file/postgres), `src/endpoints/routes.js` (`PUT /config`, `PUT /redeploy-config`), `src/endpoints/worker.js` (autoscaling thật theo metric), `src/endpoints/invoke.js` (pass `max_model_len` + sampling defaults lên vLLM).
- **Migration:** `db/migrations/004-p0-scaling-context-length.sql`, `005-p1-gpu-count-quantization.sql`, `006-p2-host-kv-cache-sampling.sql`.
- **Frontend:** `partner-console/index.html` + `app.js` (form tạo endpoint + drawer "Cấu hình sau deploy").
- **Tests:** `tests/endpoints-p0-scaling-context` (19), `tests/endpoints-p1-gpu-quantization` (22), `tests/endpoints-p2-hostkv-sampling` (26) — **tất cả pass**; regression toàn bộ 12 suite 0 fail.

### 5.3 Nguyên tắc thiết kế nên học từ đối thủ

1. **Hot-update vs redeploy:** Knob an toàn (autoscaling, traffic) → chỉnh ngay không downtime. Knob rủi ro (GPU, quantization, context) → bắt redeploy (immutable config), như Together/Baseten.
2. **Không expose engine param thô** (max_num_seqs, gpu_memory_utilization) — gói thành preset/knob an toàn để user không phá hạ tầng.
3. **Sampling params để per-request**, chỉ đặt default ở endpoint.
4. **A/B + traffic split** biến endpoint thành experimentation platform — điểm khác biệt lớn nhất của Together DE 2.0, FPT nên cân nhắc Phase 2.

---

## 6. Nguồn

- `docs.together.ai` — Dedicated Endpoints (DE 2.0), Jig CLI, autoscaling (8 metrics), traffic split, A/B test, shadow
- `fireworks.ai` + `fireworksai.mintlify.app` — Dedicated/On-Demand deployments, Single-LoRA live merge
- `docs.baseten.co` — Autoscaling, Resources (instance type), Truss CLI, Concepts
- `friendli.ai` + LinkedIn pulse — Host KV Cache, Dedicated Endpoints
- `huggingface.co/docs/inference-endpoints` — vLLM engine args, Tensor Parallel Size
- `docs.vllm.ai` — Engine arguments (`--max-model-len`, `--gpu-memory-utilization`, `--max-num-seqs`, `--max-num-batched-tokens`, FP8 KV cache)
- Nội bộ: `src/endpoints/store.js`, `src/endpoints/invoke.js` (FPT DDI hiện trạng)

> **Lưu ý:** Số liệu đối thủ lấy từ nguồn công khai 08/2026, có thể thay đổi. Console các nền tảng đều chặn login nên phần UI dựa trên docs công khai.