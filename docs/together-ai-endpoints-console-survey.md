# Feature Survey — Together AI Endpoints Console (api.together.ai/endpoints)

**Phiên bản:** 1.0
**Ngày:** 19/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**URL khảo sát:** `https://api.together.ai/endpoints` (cần sign-in) + `docs.together.ai/docs/dedicated-endpoints/*` + `together.ai/pricing`
**Lưu ý:** Console yêu cầu đăng nhập nên phần UI dựa trên screenshot trong docs công khai; phần feature dựa trên docs + pricing page (08/2026).

---

## 1. Tổng quan sản phẩm

| Field | Value |
|-------|-------|
| **Tên sản phẩm** | Dedicated Model Inference (DMI) — "Deploy a model for inference on dedicated GPUs" |
| **Phiên bản** | **DE 2.0** — resource model mới (Project/Model/Config/Endpoint/Deployment/Replica), có trang "Migrate from v1" |
| **Định vị** | Reserved hardware: performance cao hơn, **không có hard rate limit**, chạy được fine-tuned model, rẻ hơn serverless ở utilization cao (billed per-GPU-minute) |
| **API inference** | Cùng 1 inference API với serverless (OpenAI-compatible) — prototype trên serverless rồi deploy DMI **không đổi code** |
| **Endpoint string** | `<project_slug>/<endpoint_name>` — pass làm `model` param trong request |
| **Pricing** | Per GPU per minute, mỗi replica chạy tự计费; scale down là ngừng计费 |

**4 lợi thế DMI vs serverless (theo docs):**
1. Performance cao hơn: throughput lớn hơn, latency thấp hơn, predictable
2. No hard rate limits — chỉ giới bởi capacity phần cứng + autoscaling config
3. Chạy được fine-tuned models (kể cả model tự upload)
4. Cost-efficient ở scale — billed per-GPU-minute thay vì per-token

---

## 2. Resource Model (6 thành phần)

```
Project → Endpoint → Deployment → Replica → (Model + Config)
```

| Resource | ID | Mô tả |
|----------|-----|-------|
| **Project** | `proj_...` | Organizational boundary; API key scoped theo project |
| **Model** | `ml_...` | 1 bộ weights cụ thể (per quantization: BF16/FP8); model Together-hosted + model tự upload |
| **Config** | `cr_...` | Cách chạy 1 weight: inference engine, parallelism, GPU type/count, optimization profile. **Immutable** — mỗi revision 1 ID mới. Together publish "certified configs" |
| **Deployment Profile** | — | Combos certified: 1 weight + 1 config → fix quantization, parallelism, hardware. Catalog hiển thị `quantization`, `parallelism`, `gpuType`, `gpuCount` |
| **Endpoint** | `ep_...` | Logical grouping của nhiều deployments + stable inference URL. 1 endpoint có thể host nhiều deployment |
| **Deployment** | `dep_...` | Chạy replicas + serve traffic; bind 1 model + 1 config + autoscaling policy vào 1 endpoint |
| **Replica** | — | 1 instance model chạy trên dedicated hardware riêng |
| **Instance type** | — | VD `1xnvidia-h100-80gb` — unit phần cứng có giá/hr + **per-region capacity**. API trả `headroom`: còn bao nhiêu replicas của instance type đó fit trong region (chọn region có capacity trước khi deploy) |

**Architecture hierarchy:** Architecture (VD Llama 3.3 70B Instruct) → Weight (per quantization) → Config (parallelism/hardware) → Profile (weight+config certified).

---

## 3. Feature chi tiết

### 3.1 Deploy — one-command

```bash
tg beta endpoints deploy google/gemma-4-E4B-it --endpoint my-endpoint
```

1 lệnh tạo endpoint + deployment + route traffic. In ra endpoint string để dùng làm `model` param.

- Deploy được: model Together-hosted, model fine-tune trên Together, **model fine-tune tự upload (BYOM)**
- Chọn config: `--config cr_...` (nhiều profile thì chọn, 1 profile thì auto)

### 3.2 Autoscaling — **8 scaling metrics (SLO-driven)**

| Metric | Target nghĩa là |
|--------|-----------------|
| `inflight_requests` (default) | Concurrent in-flight requests/replica (default target 8) — leading indicator, robust |
| `gpu_utilization` | % GPU compute (0–100) |
| `token_utilization` | % KV-cache (0–100) |
| `cache_hit_rate` | % prompt-cache hit (0–100) |
| `throughput_per_replica` | Tokens/sec/replica |
| `ttft` | Time to first token (ms) — **scale theo SLO** |
| `decoding_speed` | Time per output token (ms) |
| `e2e_latency` | End-to-end latency (ms) — **scale theo SLO percentile** |

- **3 họ metric:** concurrency-driven (safe default) / **SLO-driven** (ttft, e2e_latency, decoding_speed — scale theo cam kết latency) / efficiency-driven (cost-first)
- **Percentile** cho latency metrics: `p50/p90/p95 (default)/p99` — VD `e2e_latency target 2000` = giữ p95 ≤ 2s
- **Bounds:** `minReplicas` (floor, ≥1 khi running) / `maxReplicas` (ceiling = max cost). `min==max` → fixed size; `min==max==0` → stop
- **Timing:** scale-up không delay, scale-down default chờ 5 phút (tránh cold start sau burst); rate limit: scale-up max 100%/4 replicas per 15s, scale-down max 25%/1 replica per 60s; evaluate ~60s/lần
- **Cold start:** giữ `minReplicas ≥ 1` để 1 replica luôn warm; scale-down chậm là cố ý để "ride through troughs"

### 3.3 Traffic Routing — 3 chế độ

| Chế độ | Mô tả |
|--------|-------|
| **Traffic split (weight)** | Nhiều deployments sau 1 endpoint URL; share ∝ weight × ready replicas. Weight là relative capacity, không cần tổng 100. Scale replica = shift traffic mà không đổi weight |
| **A/B test** | 1 control + **tối đa 19 variants** (20 members), phân % traffic của control (1–99%), **ramp** variant (5% → 10% → ...), **promote** winner, multi-way compare. Console: tab **Traffic Tests** → New A/B test |
| **Shadow experiment** | Mirror 1 phần traffic live sang deployment mới, **so sánh responses mà không serve** — canary an toàn |

- Routing sticky; endpoint luôn giữ cùng 1 URL cho ứng dụng
- Deployment shadow target không được serve live traffic (weight 0)

### 3.4 Monitoring & Observability

| Layer | Chi tiết |
|-------|----------|
| **Analytics dashboard** (console) | Per-endpoint charts: requests, tokens/sec, input tokens, output tokens, latency, TTFT. Toggle **Usage/Errors**, breakdown **Total / By deployment**, time range. Dùng để compare deployments trong A/B test |
| **Events feed** (console tab Logs) | Audit feed: time, type, source, level, message — scale-up, traffic shift, readiness, pause. CLI: `tg beta endpoints events ep_...` với filter `--types`, `--min-level`, `--since/--until`, `--subject-id`, `--deployment-ids`, `--limit/--after`, `--json` |
| **Prometheus-compatible metrics endpoint** (beta) | `GET https://o11y-de2-metrics.cloud.together.ai/organizations/{org_id}/metrics` — Bearer API key, org-scoped. Scrape bằng Prometheus/Grafana Agent/Datadog/Vector |

**Prometheus metrics (3 tầng request path):**

| Tầng | Metrics |
|------|---------|
| **Edge** (front-door proxy) | `edge_inference_requests_total` (by status_code), `edge_inference_request_duration_ms`, `edge_inference_ttft_ms`, `edge_inference_inflight_requests` |
| **Router** | `router_inference_requests_total`, `router_inference_request_duration_seconds`, `router_inference_ttft_seconds`, `router_pre_worker_duration_seconds`, `router_inference_inflight_requests`, `router_token_count`, `router_tokens_per_request` |
| **Worker** (model server) | `worker_inference_request_total`, `worker_ttft_seconds`, `worker_generation_duration_seconds`, `worker_tpot_seconds`, `worker_token_total`, `worker_tokens_per_request`, `worker_engine_kv_cache_utilization`, `worker_engine_cache_hit_rate` |

Labels: `owner_organization_id`, `owner_project_id`, `endpoint_id/name`, `deployment_id/name`, `model`, `deployment_region`, `replica_id`, `status_code`, `is_streaming`, `token_type`, `requester_organization_id`

### 3.5 BYOM — Upload fine-tuned model

| Source | Cách |
|--------|------|
| Local machine | `tg beta models upload ml_... ./model-dir` |
| Hugging Face Hub | `tg beta models remote-uploads create ml_... --from <repo-url> --token hf_...` (stream server-side, hỗ trợ gated repo) |
| S3 | Presigned URL của archive `.zip`/`.tar.gz` (files ở root, expiration ≥100 phút) |

- **Yêu cầu:** fine-tuned variant của base architecture đã hỗ trợ (không thêm architecture mới), text generation only, HF format (`from_pretrained`, **safetensors** — `.bin`/`.pt` reject)
- **Model record:** `name` + `base_model_id` (bắt buộc) + visibility (**Private** default / **Internal** = mọi project trong org)
- **LoRA adapter:** upload riêng `--type adapter`
- **Revision validation tự động:** kiểm tra safetensors + config/architecture tương thích base model; trạng thái `PENDING/SUCCESS/FAILED/ERROR`; deploy được khi `SUCCESS`
- **Console:** Models > Upload a model — 1 form (upload type, source, name, visibility, compatible base model, quantization), progress live, badge "Uploading" trong My models
- Deploy model upload giống hệt base model: `tg beta endpoints deploy ml_... --endpoint ... --config ...`

### 3.6 CLI (`tg beta`)

| Command | Mô tả |
|---------|-------|
| `tg beta endpoints deploy` | Deploy model: tạo endpoint + deployment + route traffic |
| `tg beta endpoints ab` | Start A/B test (tạo variant deployment + split) |
| `tg beta endpoints shadow` | Start shadow experiment |
| `tg beta endpoints update` | Đổi min/max replicas, scaling metric/target, traffic weight, ab-percent |
| `tg beta endpoints events` | Đọc event feed (filter types/level/time/deployment) |
| `tg beta endpoints rm` | Xóa endpoint/deployment/experiment |
| `tg beta models create/upload/remote-uploads/ls-files/ls-revisions/list/public` | Quản lý model + upload |

- Project scope: `TOGETHER_PROJECT_ID` env hoặc `--project`
- Python SDK: `client.beta.*` (endpoints, deployments, ab_experiments, models) — snake_case, `project_id` param
- TypeScript SDK: `together-ai` package, `client.beta.*`

### 3.7 Agent Skills (feature mới)

- **`together-dedicated-model-inference`** — skill cho coding agent (GitHub: togethercomputer/skills) để agent **tự deploy + quản lý dedicated endpoints**
- → Together đang chuẩn hóa "agent-operated cloud": agent có thể provision, scale, A/B test endpoint không cần người

### 3.8 Provisioned Throughput (PTU) — product liên quan

| Field | Value |
|-------|-------|
| **Đơn vị** | PTU (Provisioned Throughput Unit) — $0.05/PTU/min, commit ≥1 tháng, **chưa self-serve — contact sales** |
| **SLA** | **Throughput:** serve đủ TPM theo PTU đã mua. **Reliability: ≥99% eligible requests thành công/tháng** (không fail do lỗi Together) |
| **Supported models** | Kimi K3, MiniMax M3, GLM-5.2 (mở rộng theo request) |
| **TPM/PTU** | Phụ thuộc model + token type (VD MiniMax M3: 166,667 input TPM/PTU, 833,333 cached, 41,667 output) |
| **Overage** | Traffic vượt PTU → fallback best-effort serverless (billed serverless rate), không covered SLA |
| **PTU calculator** | Trên pricing page: nhập peak RPS, cache hit rate, tokens/request → PTU cần + est. monthly cost + **% savings vs serverless** (VD 83% lower) |
| **So sánh 3 tier** | Serverless (best-effort, dynamic rate limit) / **PTU (SLA + committed capacity, stock models)** / Dedicated (GPU riêng, fine-tuned models, control hardware) |

---

## 4. Console UI Structure (từ docs screenshots)

| Page | Tab/Section |
|------|-------------|
| **Endpoints** (`/endpoints`) | List serverless + dedicated endpoints; create new; monitor |
| **Endpoint detail** | Overview; **Analytics** (charts + Usage/Errors toggle + Total/By deployment + time range); **Logs** (event feed: Time/Type/Source/Level/Message); **Traffic Tests** (A/B tests table + New A/B test dialog: name, traffic-split bar, Control/Variants + %) |
| **Deployment configuration** | Edit: traffic weight, autoscaling (min/max replicas, scaling metric + target) |
| **Models** (`/models`) | Catalog + **My models** (Public/Internal/Private visibility filter); **Upload a model** form; model detail: upload progress log + revisions table |
| **Settings** | Projects management (`/settings/organization/~current/projects`) |

---

## 5. Pricing (pricing page, 08/2026)

### 5.1 Dedicated Inference (per GPU per hour)

| Hardware | On-demand | Reserved |
|----------|-----------|----------|
| NVIDIA HGX H100 | **$5.49** | Contact sales |
| NVIDIA HGX H200 | Contact us | Contact sales |
| NVIDIA HGX B200 | **$8.99** | Contact sales |
| NVIDIA HGX B300 | Contact us | Contact sales |
| NVIDIA GB200 NVL72 | Contact us | Contact sales |
| NVIDIA GB300 NVL72 | Contact us | Contact sales |

> ⚠️ Giá đã thay đổi so với khảo sát trước (H100: $6.49 → $5.49; B200: $11.95 → $8.99) — Together đang giảm giá dedicated.

### 5.2 GPU Clusters (per GPU per hour)

| Hardware | On-demand | Reserved 7–30d | 31–90d | 91–180d | 181+d |
|----------|-----------|----------------|--------|---------|-------|
| H100 | $3.99 | $3.69 | $3.45 | $3.19 | Contact |
| H200 | $5.99 | $4.99 | $4.15 | $3.99 | Contact |
| B200 | $8.19 | $7.99 | $7.79 | $6.79 | Contact |
| B300 / GB200 / GB300 | — | Contact | | | |

### 5.3 Fine-Tuning (per 1M training tokens)

| Size | SFT LoRA | DPO LoRA | SFT Full | DPO Full |
|------|----------|----------|----------|----------|
| ≤16B | $0.48 | $0.54 | $1.20 | $1.35 |
| 17B–69B | $1.50 | $1.65 | $3.75 | $4.12 |
| 70B–100B | $2.90 | $3.20 | $7.25 | $8.00 |

- Minimum charge $4.00/job (standard)
- **Specialized pricing** (per model): Llama 4 Scout $3.00 / Maverick $8.00 / DeepSeek-V4 Flash $6.00 / DeepSeek-V3.1 $10.00 / gpt-oss-120B $5.00 / Kimi K2.6 $15.00 / Qwen3.5-397B $8.00 / GLM-5.2 $40.00 (LoRA)

### 5.4 Sandbox & Storage (product line mới)

| Product | Price |
|---------|-------|
| Code Sandbox | $0.0446/vCPU/hr + $0.0149/GiB RAM/hr |
| Code Interpreter | $0.03/session (60 phút) |
| Managed Storage (shared filesystem) | $0.16/GiB/month |

### 5.5 Serverless (mẫu, per 1M tokens)

| Model | Input | Output |
|-------|-------|--------|
| DeepSeek V4 Flash 0731 | $0.14 ($0.03 cached) | $0.28 |
| DeepSeek V4 Pro 0813 | $1.32 ($0.13 cached) | $3.96 |
| DeepSeek V4 Pro | $1.74 ($0.20 cached) | $3.48 |
| Qwen3.8-Max (2.4T) | $2.50 ($0.50 cached) | $6.25 |
| Kimi K3 | $3.00 ($0.30 cached) | $15.00 |
| GLM-5.2 | $1.40 ($0.26 cached) | $4.40 |
| MiniMax M3 | $0.30 ($0.06 cached) | $1.20 |
| Llama 3.3 70B | $1.04 | $1.04 |
| gpt-oss-120B | $0.15 | $0.60 |
| gpt-oss-20B | $0.05 | $0.20 |

- **Cache discount:** input cached rẻ hơn ~80% (VD $1.74 → $0.20)
- Image gen: $0.0019–$0.134/image; Audio: $0.0035–$65/1M chars; Video: $0.115–$1.60/video

---

## 6. Insights & Implications cho FPT DDI

### 6.1 Feature mới phát hiện (không có trong khảo sát trước)

| # | Feature | Ý nghĩa cho FPT |
|---|---------|-----------------|
| 1 | **A/B test trên live traffic** (1 control + 19 variants, ramp, promote) | FPT DDI chưa có — đây là feature "production-grade" mà enterprise cần để đổi model/config an toàn |
| 2 | **Shadow experiment** (mirror traffic, không serve) | Canary an toàn — FPT chưa có |
| 3 | **8 autoscaling metrics** (kể cả SLO-driven: ttft, e2e_latency p50–p99) | Xác nhận gap "SLO-driven autoscaling" — FPT chỉ có `autoscale_enabled` cơ bản |
| 4 | **Prometheus-compatible metrics endpoint** (edge/router/worker, 20+ metrics) | Enterprise cần integrate Grafana/Datadog — FPT chỉ có dashboard nội bộ |
| 5 | **BYOM + revision validation + LoRA adapter upload** | FPT Phase 2 BYOM cần có validation pipeline + HF/S3 import |
| 6 | **PTU + SLA ≥99% + PTU calculator** | Xác nhận gap SLA/PTU; calculator là UX tốt — FPT nên có khi làm PTU |
| 7 | **Agent skills** (agent tự manage endpoints) | Trend mới — FPT nên cân nhắc agent-operated API |
| 8 | **Headroom API** (capacity per region) | Transparency về capacity — FPT có thể làm tương tự |
| 9 | **Sandbox + Managed Storage** (product line mới) | Together mở rộng sang code execution + storage — FPT nên theo dõi |
| 10 | **DE 2.0 resource model** (Project/Config/Profile) | Architecture mới — FPT nên tham khảo khi thiết kế resource model |

### 6.2 Điểm nổi bật cần học

1. **One-command deploy** — `tg beta endpoints deploy` tạo endpoint + deployment + routing trong 1 lệnh. FPT nên có UX tương đương (1 click/1 lệnh).
2. **SLO-driven autoscaling** — scale theo `ttft`/`e2e_latency` p95 là feature "wow" cho enterprise. FPT Phase 2 nên có ít nhất 3 metrics: inflight, gpu_util, e2e_latency.
3. **A/B + Shadow** — 2 feature này biến endpoint thành "experimentation platform", không chỉ là "GPU hosting". Đây là điểm khác biệt lớn nhất của DE 2.0.
4. **Prometheus endpoint** — enterprise luôn hỏi "connect Grafana/Datadog được không?" — FPT cần có metrics API (kể chỉ là basic).
5. **PTU calculator** — UX bán hàng tốt: khách tự estimate cost + savings. FPT nên có khi làm PTU.
6. **Giá dedicated giảm** — H100 $6.49 → $5.49, B200 $11.95 → $8.99. FPT ($2–3/hr) vẫn rẻ hơn 50%+, nhưng khoảng cách đang thu hẹp.

### 6.3 Lợi thế FPT vẫn giữ

- Giá rẻ 50%+ (H100 $2–3/hr vs $5.49/hr)
- Data residency VN (NĐ 13/2023)
- Model tiếng Việt (FPT.AI)
- Free tier $100 vs $5
- Local support 24/7

---

## 7. Nguồn

- `https://docs.together.ai/docs/dedicated-endpoints` (overview, concepts, scaling, monitoring, ab-tests, split-traffic, custom-models)
- `https://docs.together.ai/docs/inference/provisioned-throughput`
- `https://www.together.ai/pricing` (08/2026)
- `https://github.com/togethercomputer/skills` (agent skills)
- Screenshot console trong docs (Analytics, Logs, Traffic Tests, Upload model form)

> **Lưu ý:** Số liệu giá + model lấy từ nguồn công khai 08/2026, có thể thay đổi. Console UI cần xác minh thêm bằng screenshot thực tế (cần tài khoản Together AI).