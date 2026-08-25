# Gap Analysis — FPT DDI (Dedicated Inference) vs Together AI

**Phiên bản:** 1.3
**Ngày:** 20/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** So sánh các feature **còn thiếu** của FPT DDI (dedicated inference) so với Together AI
**Nguồn:** `https://api.together.ai/models` (console, cần sign-in) + `docs.together.ai` (PTU SLA, Batch API) + `together.ai/pricing` + `together.ai/models` + docs nội bộ (`competitive-analysis-together-ai-features.md`, `together-ai-endpoints-console-survey.md`, `srs-ddi-my-endpoints.md`, `market-research-dedicated-inference.md`)
**Xác minh:** 20/08/2026 — re-verify lần 2 từ public pages `together.ai/pricing` + `together.ai/models` + `docs.together.ai` (console 2 bên đều chặn login, chưa có screenshot UI thật)

---

## 1. Executive Summary

| Câu hỏi | Trả lời |
|---------|---------|
| **FPT đang thiếu gì so với Together?** | 23 feature, trong đó 4 nhóm gap lớn nhất: **model catalog (20 vs 200+)**, **fine-tuning**, **Batch API (-50%)**, **PTU/SLA cam kết** |
| **FPT mạnh hơn ở đâu?** | Giá rẻ 45%+ (H100 $2–3/hr vs $5.49/hr), data residency VN, model tiếng Việt, free tier $100 vs $5 |
| **Gap nghiêm trọng nhất cho dedicated inference?** | **SLA cam kết + Provisioned Throughput** — cùng bán "dedicated cho serious traffic" nhưng FPT chưa có SLA thương mại công khai |
| **Khuyến nghị** | Phase 1: catalog ≥20 model + public pricing + SLA 99.9%; Phase 2: Batch API + Fine-tuning (LoRA) + PTU; Phase 3: multi-modal, GPU clusters, CLI, multi-region |

---

## 2. Feature Matrix — Dedicated Inference

| # | Feature | Together AI | FPT DDI | Trạng thái |
|---|---------|-------------|---------|------------|
| 1 | Dedicated endpoints (reserved GPU) | ✓ — H100 $5.49/hr, B200 $8.99/hr (08/2026, đã giảm từ $6.49/$11.95) | ✓ — H100 $2–3/hr | ✅ FPT có, rẻ hơn 50%+ |
| 2 | Always-on, no shared capacity, no rate limits | ✓ | ✓ (định vị cốt lõi) | ✅ |
| 3 | Autoscaling (min/max replica) | ✓ + **SLO-driven: 8 metrics** (inflight, gpu/tok util, cache hit, throughput, **ttft, e2e_latency p50–p99**, decoding speed) | ✓ (cơ bản, `autoscale_enabled`) | ⚠️ Thiếu SLO-driven + 8 metrics |
| 4 | **SLA cam kết thương mại** | ✓ — ≥99% request thành công/tháng (PTU tier) | ✗ — NFR 99.9% nội bộ, chưa cam kết công khai | ❌ **GAP** |
| 5 | **Provisioned Throughput (PTU)** — capacity cam kết theo TPM | ✓ | ✗ | ❌ **GAP** |
| 6 | **Batch API** (async, -50% giá) | ✓ | ✗ | ❌ **GAP** |
| 7 | **Fine-tuning** (LoRA / full / DPO) | ✓ — $0.48–8/1M tokens (standard), $3–40/1M (specialized), min $4/job | ✗ (Phase 3) | ❌ **GAP** |
| 8 | Multi-node training cho large models | ✓ | ✗ | ❌ GAP |
| 9 | One-click deploy sau fine-tune | ✓ | ✗ | ❌ GAP |
| 10 | GPU Clusters (bare-metal + InfiniBand) | ✓ — H100 $3.99/hr on-demand, reserved $3.69→$3.19 (theo tenure); B200 $8.19, H200 $5.99 | ✗ | ❌ GAP |
| 11 | BYOM (bring-your-own-model) | ✓ (custom models) | ✗ (Phase 2) | ❌ GAP |
| 12 | Model catalog | **200+ models** | ~20 models (LLM/VLM/TTS) | ❌ **GAP lớn** |
| 13 | Model frontier mới nhất (Llama 4, DeepSeek V4 Pro **0813**, Qwen 3.8-Max, GLM-5.3) | ✓ (xác minh 20/08: DeepSeek V4 Pro 0813, Qwen3.8-2.4T-A95B, GLM-5.3 1M ctx, Nemotron 3.5 Lightning, Cogito v2.1 671B, Qwen3.5-397B-A17B) | ✗ | ❌ **GAP** |
| 14 | Long context 512K–1M tokens | ✓ (DeepSeek V4 Pro 512K, Qwen 3.6 Plus 1M) | ✗ | ❌ GAP |
| 15 | Multi-modal (image, audio, **video generation**) | ✓ | ✗ (chỉ LLM/VLM/TTS) | ❌ GAP |
| 16 | OpenAI-compatible API | ✓ | ✓ | ✅ |
| 17 | Python SDK | ✓ | ✓ | ✅ |
| 18 | Playground | ✓ | ✓ (FR-EP-003) | ✅ |
| 19 | Streaming | ✓ | ✓ | ✅ |
| 20 | Endpoint management (scale/stop/start/delete) | ✓ | ✓ (FR-EP-004) | ✅ |
| 21 | Metrics & monitoring (p50/p95/p99, GPU util) | ✓ | ✓ (FR-EP-005) | ✅ |
| 22 | API keys (create/rotate/revoke) | ✓ | ✓ (FR-EP-006) | ✅ |
| 23 | Audit trail | ✓ | ✓ (FR-EP-004.5) | ✅ |
| 24 | CLI | ✓ | ✗ | ❌ GAP |
| 25 | Multi-region | ✓ (US/global) | ✗ (VN; JP/KR Phase 3) | ❌ GAP |
| 26 | Public pricing page | ✓ | ✗ | ❌ GAP |
| 27 | Free tier | $5 credit | $100 credit (30 ngày) | ✅ FPT hào phóng hơn 20x |
| 28 | Data residency Việt Nam | ✗ | ✓ (NĐ 13/2023) | ✅ **Lợi thế độc nhất** |
| 29 | Model tiếng Việt | ✗ | ✓ (FPT.AI) | ✅ **Lợi thế độc nhất** |
| 30 | Social proof (customer logos) | ✓ (Decagon, Cursor, Vercept, Cartesia, Cohere, DeepMind, ElevenLabs, SK Telecom, Mozilla, VFS Global, Evertune, Arcee, Captions...) | ✗ | ❌ GAP |
| 31 | **A/B test trên live traffic** (1 control + 19 variants, ramp, promote) | ✓ (DE 2.0) | ✗ | ❌ GAP |
| 32 | **Shadow experiment** (mirror traffic, không serve) | ✓ (DE 2.0) | ✗ | ❌ GAP |
| 33 | **Prometheus-compatible metrics endpoint** (edge/router/worker) | ✓ (beta) | ✗ (chỉ dashboard nội bộ) | ❌ GAP |
| 34 | **PTU calculator** (estimate PTU + savings vs serverless) | ✓ (pricing page) | ✗ | ❌ GAP (khi làm PTU) |
| 35 | **Agent skills** (agent tự manage endpoints) | ✓ (together-dedicated-model-inference) | ✗ | ❌ GAP (trend mới) |
| 36 | **Headroom API** (capacity per region) | ✓ | ✗ | ❌ GAP (nice-to-have) |
| 37 | **Dedicated Container Inference** (chạy engine + model tự chọn trên hạ tầng fully-managed) | ✓ (mới 08/2026, docs: dedicated-container-inference) | ✗ | ❌ GAP |

**Tóm tắt:** 37 feature so sánh → FPT đạt 13, thiếu 23, 1 ⚠️ (autoscaling). Chi tiết feature mới phát hiện (A/B test, shadow, Prometheus, PTU calculator, agent skills, Dedicated Container Inference) xem `together-ai-endpoints-console-survey.md`.

---

## 3. Chi tiết các feature FPT CÒN THIẾU

### 3.1 Model Catalog — GAP lớn nhất (Priority: Must)

| Tiêu chí | Together AI (`api.together.ai/models`) | FPT DDI |
|----------|------------------------------------------|---------|
| Số lượng | 200+ | ~20 |
| Llama | 3.1 (8B/70B/405B), 3.3 70B ($1.04/$1.04, có bản Instruct Turbo FP8), **Llama 4 Maverick (524K ctx)**, **Llama 4 Scout (327K ctx)** | Chưa có Llama 4 |
| DeepSeek | **V4 Pro (512K ctx, 384K output, $1.74/$3.48, 04/2026)** + **V4 Pro 0813 (mới, $1.32/$3.96)** + V4 Flash 0731 ($0.14/$0.28), V3.1 ($0.60/$1.70), R1 + distills | Chưa có DeepSeek V4 |
| Qwen | **3.8-Max 2.4T-A95B ($2.50/$6.25, 08/2026)**, 3.7 Max/Plus (3.7-Plus 1M ctx), **3.6 Plus ($0.50/$3.00)**, 3.5-397B-A17B, 2.5 VL 72B | Qwen bản cũ |
| GLM | GLM-5.2 ($1.40/$4.40), **GLM-5.3 (1M ctx, mới 08/2026)** | Chưa có |
| Khác | GPT-OSS 20B/120B, Kimi K3 ($3.00/$15.00)/K2.7 Code/K2.6, MiniMax M3 ($0.30/$1.20, 1M ctx), Gemma 4 31B, Nemotron 3 Ultra + **3.5 Lightning (dedicated-only)**, **Muse Glimmer 30B (Meta)**, **Inkling + Inkling Small (Thinking Machine Labs)**, **Cogito v2.1 671B (DeepCognito)**, **Rnj-1 Instruct (Essential AI)**, **Ternary Bonsai 27B (FREE $0.00)**, LFM2.5-8B-A1B, Mixtral, DBRX, Mistral | Hạn chế |
| Modalities | Chat, code, image gen, embeddings, vision, audio, **video gen** | LLM/VLM/TTS |
| Tốc độ cập nhật | Model mới ra là có (DeepSeek V4 Pro: 04/2026; Qwen 3.8-Max: 08/2026) | Chậm hơn |

**Impact:** Khách migration từ serverless (Together/OpenAI) kỳ vọng model frontier mới nhất + long context. FPT thiếu → mất deal enterprise chạy agent/reasoning dài.

**Action:**
- Phase 1: ≥20 model, ưu tiên Llama 3.3/4, DeepSeek V3.1/R1, Qwen 3.5+
- Phase 2: ≥50 model, cam kết SLA "model mới ra ≤30 ngày có trên catalog"

### 3.2 SLA Cam Kết + Provisioned Throughput (Priority: Must/Should)

| | Together AI | FPT DDI |
|---|-------------|---------|
| SLA | ≥99% eligible requests thành công/tháng (PTU tier, xác minh docs 20/08) | NFR 99.9% nội bộ, **chưa cam kết thương mại** |
| PTU | Reserved capacity theo **TPM (tokens/phút)** + SLA; giá **$0.05/PTU/phút**, cam kết tối thiểu 1 tháng, contact sales (chưa self-serve); hiện hỗ trợ Kimi K3, MiniMax M3, GLM-5.2; overage fallback serverless (không SLA) | ✗ — chỉ bán theo GPU/giờ |

**Impact:** Định vị FPT là "dedicated cho serious traffic" nhưng enterprise hỏi "SLA bao nhiêu? bồi thường thế nào?" → chưa trả lời được. Đây là gap **trái với định vị** — phải đóng sớm.

**Action:**
- Phase 1: Công bố SLA 99.9% uptime + cơ chế service credit
- Phase 2: PTU — gói cam kết TPM cho enterprise (ngân hàng, Fintech)

### 3.3 Batch API (Priority: Must)

| | Together AI | FPT DDI |
|---|-------------|---------|
| Async batch inference | ✓ — JSONL upload, max 50K requests/job, file 100MB, completion window 24h, rate-limit pool riêng | ✗ |
| Discount | **up to -50%** so serverless (chỉ áp dụng nhóm model chọn: Llama 3.3 70B Turbo, Llama 3 70B, Qwen2.5-7B Turbo, Mixtral 8x7B, GLM-4.5-Air-FP8, Whisper); DeepSeek R1/V3.1/V4-Pro, Kimi K2.5/K2.6 **không** hỗ trợ | — |

**Impact:** Non-urgent workloads (ETL, data labeling, RAG ingestion) chiếm 30–50% workload enterprise. Không có batch → khách chạy phần này ở nơi khác, giảm share-of-wallet.

**Action:** Phase 2 — Batch API với giá -50%, queue async, kết quả trả về file.

### 3.4 Fine-tuning Platform (Priority: Must — Phase 2)

| | Together AI | FPT DDI |
|---|-------------|---------|
| Phương pháp | LoRA, full fine-tuning, **DPO** | ✗ |
| Scale | Multi-node training | ✗ |
| Deploy sau fine-tune | One-click lên dedicated endpoint | ✗ |
| Pricing | **$0.48–8/1M tokens** (standard, theo size ≤16B/17–69B/70–100B; LoRA rẻ hơn Full; DPO +~12%), min $4/job; specialized $3–40/1M (Llama 4 Maverick $8, DeepSeek V3.1 $10, Kimi K2.7 $15, GLM-5.2 $40) | — |

**Impact:** Upsell lớn nhất từ inference → fine-tune. Together giữ chân khách bằng "fine-tune rồi serve ngay trên dedicated". FPT chỉ có inference → khách fine-tune ở nơi khác rồi serve cũng ở nơi khác.

**Action:** Phase 2 — LoRA trước (phổ biến, rẻ), DPO/full sau. One-click deploy model fine-tuned lên dedicated endpoint (tận dụng sẵn My Endpoints).

### 3.5 GPU Clusters Bare-metal (Priority: Should — Phase 3)

| | Together AI | FPT DDI |
|---|-------------|---------|
| Bare-metal GPU | ✓ + InfiniBand | ✗ |
| Pricing | H100 $3.99/hr on-demand, reserved $3.69 (7–30d) / $3.45 (31–90d) / $3.19 (181+d); B200 $8.19, H200 $5.99; B300/GB200/GB300 NVL72: contact sales | — |
| Use case | Training, custom inference engine | — |

**Action:** Phase 3 — khi có nhu cầu training, hợp tác NVIDIA AI Factory.

### 3.6 Multi-modal (image, audio, video generation) (Priority: Should)

- Together: image gen, audio, **video generation** (Pika, Hedra là khách hàng)
- FPT: chỉ LLM/VLM/TTS
- **Action:** Phase 3 — bổ sung image gen trước (nhu cầu VN cao), video sau.

### 3.7 Dedicated Container Inference (Priority: Could — Phase 3)

| | Together AI (mới 08/2026) | FPT DDI |
|---|---------------------------|---------|
| Chạy engine + model tự chọn | ✓ — fully-managed, scalable | ✗ |
| Use case | Generative media models, non-standard runtimes, custom inference pipelines | — |

**Impact:** Mở rộng "bring your own engine" — khách có runtime/engine riêng (VD vLLM fork, TensorRT-LLM tùy biến, media pipeline) vẫn chạy trên hạ tầng Together. FPT chỉ bán dedicated endpoint đóng → mất nhóm khách này.

**Action:** Phase 3 — cân nhắc khi có nhu cầu custom engine; có thể gộp với roadmap BYOM.

### 3.8 Các gap còn lại (Priority: Could)

| Feature | Ghi chú | Phase |
|---------|---------|-------|
| BYOM | Enterprise tự upload model weights (HF/S3/local, validation tự động, LoRA adapter) | Phase 2 |
| SLO-driven autoscaling | 8 metrics (inflight, gpu/tok util, cache hit, throughput, ttft, e2e_latency p50–p99, decoding speed) | Phase 2 |
| A/B test + Shadow experiment | Live traffic experiment (1 control + 19 variants, ramp, promote) | Phase 2 |
| Prometheus metrics endpoint | Edge/router/worker, 20+ metrics, integrate Grafana/Datadog | Phase 2 |
| PTU calculator | Estimate PTU + savings vs serverless (UX bán hàng) | Phase 2 (khi làm PTU) |
| Agent skills | Agent tự manage endpoints (trend mới) | Phase 3 |
| Headroom API | Capacity per region (nice-to-have) | Phase 3 |
| Code Sandbox + Managed Storage | Code Sandbox $0.0446/vCPU/hr + $0.0149/GiB RAM/hr, Code Interpreter $0.03/session, Storage $0.16/GiB/tháng | Phase 3 |
| CLI | Cluster/endpoint operations | Phase 3 |
| Multi-region (JP/KR) | Mở rộng quốc tế | Phase 3 |
| Public pricing page | Transparency — Together hiển thị giá GPU/hr công khai | **Phase 1 (rẻ, làm ngay)** |
| Social proof | Customer logos trên landing | Khi có khách hàng |

---

## 4. Lợi thế FPT — điểm Together KHÔNG CÓ

| # | Advantage | Chi tiết | Cách dùng trong GTM |
|---|-----------|----------|---------------------|
| 1 | **Giá rẻ 45%+** | H100 $2–3/hr (FPT) vs $5.49/hr (Together, on-demand 08/2026) | "Cùng dedicated, một nửa giá" |
| 2 | **Data residency VN** | Tuân thủ NĐ 13/2023 — Together không có | Enterprise ngân hàng/chính phủ — **barrier mà Together không vượt được** |
| 3 | **Model tiếng Việt** | FPT.AI | Unique, không đối thủ global nào có |
| 4 | **Free tier $100** | vs $5 của Together | Onboarding dễ hơn 20x |
| 5 | **Local support** | Tiếng Việt, latency thấp cho VN | Hỗ trợ 24/7 tại chỗ |

---

## 5. Roadmap đóng gap (tổng hợp)

| Phase | Gap cần đóng | KPI |
|-------|--------------|-----|
| **Phase 1 (0–6 tháng)** | SLA 99.9% công khai, public pricing, catalog ≥20 model (Llama 3.3/4, DeepSeek V3.1/R1, Qwen 3.5+) | ≥20 model, SLA cam kết, ≥10 pilot |
| **Phase 2 (6–12 tháng)** | Batch API (-50%), Fine-tuning (LoRA), PTU, BYOM, SLO-driven autoscaling | ≥50 model, ≥50 khách hàng |
| **Phase 3 (12–24 tháng)** | Multi-modal (image/video), GPU clusters, CLI, multi-region (JP/KR), DPO/full fine-tune | ≥100 model, ≥200 khách hàng |

---

## 6. Conclusion

Together AI dẫn trước FPT về **feature breadth** (200+ model, fine-tuning, batch, PTU, clusters, multi-modal). Nhưng FPT có 3 lợi thế cấu trúc mà Together **không thể sao chép**: giá rẻ 50%+, data residency VN, model tiếng Việt.

**Nguyên tắc đóng gap:** không đuổi theo toàn bộ feature breadth của Together — tập trung đóng 4 gap **Must** (SLA/PTU, Batch API, Fine-tuning LoRA, catalog ≥20 model frontier) ở đúng phase, và dùng 3 lợi thế độc nhất làm lá chắn cạnh tranh.

> **Lưu ý:** Số liệu Together AI (giá, model, context length) đã được xác minh lại lần 2 ngày 20/08/2026 từ nguồn công khai (`together.ai/pricing`, `together.ai/models`, `docs.together.ai` — PTU SLA, Batch API). Console 2 bên (`api.together.ai`, `neo.fpt.ai`) đều chặn login — phần UI console dựa trên docs công khai + screenshot trong docs. Số liệu có thể thay đổi; xác minh lại trước khi trình bày chính thức.