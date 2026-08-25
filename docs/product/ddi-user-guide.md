# FPT DDI — Hướng dẫn người dùng (MVP O1)

**Phiên bản:** MVP O1 — BYOM upload → playground → one-click deploy to dedicated endpoint
**Áp dụng:** spec-mvp.md Sprint 1-4 · GA target 10 tuần
**Đối tượng:** AI engineer BIDV/MB Bank/Home Credit, IT director E Hospital/FPT Long Chau cần private LLM tuân thủ Nghị định 13/PDPA

---

## 1. Quickstart — 5 phút từ zero đến inference

### 1.1. Tạo tài khoản + nhận API key

1. Đăng nhập FPT AI Factory bằng FPT ID tại `console.fpt-ddi.vn`
2. Vào **Developer tools → API keys → Create API key**
3. Đặt tên key (vd. `prod-server`) và tick 3 scope:
   - `byom` — upload model riêng
   - `endpoints` — tạo/quản lý dedicated endpoint
   - `playground` — thử model trên `/v1/chat/completions`
4. **Copy key ngay** (`ddi-live-...`) — không hiển thị lại được lần sau

### 1.2. Cài CLI

```bash
# macOS / Linux / Windows
curl -fsSL https://fpt.ai/ddi/install.sh | sh
# hoặc
brew install fpt-ai/tap/fpt-ddi
pipx install fpt-ddi

fpt ddi auth login    # đăng nhập bằng FPT ID hoặc API key
fpt ddi configure     # chọn region HAN-1/HAN-2/SGN-1, project mặc định
```

### 1.3. Điểm OpenAI SDK tại FPT DDI (≤1 dòng)

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://api.fpt-ddi.vn/v1",
    api_key=os.environ["FPT_DDI_KEY"],
)
resp = client.chat.completions.create(
    model="FPT-LLM 8B (vi)",
    messages=[{"role": "user", "content": "Xin chào!"}],
    stream=True,
)
```

**Data residency:** mọi request + weights lưu tại Việt Nam (Nghị định 13/2023) — không egress ra hyperscaler ngoài.

---

## 2. Bring your own model (BYOM)

### 2.1. Upload weights

UI: **Model catalog → Bring your own model**, hoặc CLI:

```bash
# Hugging Face Hub
fpt ddi byom upload --source meta-llama/Llama-3.3-70B-Instruct --name my-finetune-v1
# S3 presigned URL (.zip / .tar.gz)
fpt ddi byom upload --source "https://s3.ap-southeast-1.amazonaws.com/bucket/model.tar.gz?X-Amz-Expires=7200" --name my-finetune-v1
# Private/gated HF repo → thêm --hf-token
fpt ddi byom upload --source meta-llama/Llama-3.3-70B-Instruct --name my-finetune-v1 --hf-token hf_xxx
```

Backend async worker (`src/byom/processor.js`) tải weights thật về `/data/byom/<id>/weights/`, validate 2 file bắt buộc (`config.json` + `tokenizer.json`), rồi chuyển trạng thái `queued → downloading → validating → ready`.

- **Ràng buộc tên model:** chỉ chữ thường + số + gạch nối, 2-63 ký tự (vd. `my-finetune-v1` hợp lệ; `MyFinetune v1` không hợp lệ)
- **Giới hạn:** 10GB ≤10 phút cho AC1; lớn hơn vẫn chạy nhưng lâu hơn
- **Lỗi thường gặp:** tổ chức HF repo không tồn tại → backend trả 404 trong ≤5s

### 2.2. Poll trạng thái

```bash
fpt ddi byom list
fpt ddi byom status --id <job-id>
```

UI bảng **Your uploaded models** tự poll mỗi 3s khi đang xem view-catalog. Bạn cũng có thể hủy job đang `queued`/`downloading`/`validating` bằng nút **Cancel**, hoặc xóa hẳn bằng **Delete** (xoá luôn weights trên disk).

---

## 3. Try in Playground

Khi job chuyển `ready`, nút **Playground** xuất hiện trên dòng model trong bảng BYOM.

### 3.1. Mở chat

UI: bấm **Playground** → popup modal với:
- **System prompt** — hướng dẫn role model (vd. `Bạn là trợ lý hữu ích...`)
- **Temperature** (0-2) + **Max tokens** (1-32000)
- **Code snippet** — 3 tab `curl` / `Python` / `JavaScript` sinh từ cấu hình hiện tại + nút copy
- Vùng chat hiển thị từng token SSE (streaming) ≤200ms sau backend phản hồi

### 3.2. Gửi tin nhắn

```bash
curl -X POST https://api.fpt-ddi.vn/v1/chat/completions \
  -H "Authorization: Bearer $FPT_DDI_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byom-<job-id>",
    "messages": [{"role":"user","content":"Hello"}],
    "temperature": 0.7,
    "max_tokens": 256,
    "stream": true
  }'
```

Backend route theo `model=byom-<id>` → playground preview pool (1 H100 luôn warm) → vLLM load động weights từ `/data/byom/<id>/weights/`.

**Lưu ý cold-start:**
- Lần đầu tiên cho model mới có thể chậm 30-60s (warming pool) — UI hiển thị rõ `⏳ warming pool…`
- Sau lần đầu, các request sau <200ms
- p95 cold-start thật được đo và công khai trên view-dedicated → **SLA public** (parity vs Together AI + OpenAI)

### 3.3. Copy snippet để tích hợp

3 tab snippet phản ánh đúng `model` + `system prompt` + `temperature` + `max_tokens` hiện tại — copy dán vào app là chạy được ngay (chỉ cần set `FPT_DDI_KEY` env var).

---

## 4. One-click deploy → Dedicated endpoint

Khi đã thử满意 trên playground, bấm **Deploy →** trong modal → mở form:

| Trường | Mặc định | Ghi chú |
|---|---|---|
| Endpoint name | `byom-<model-name>` | chỉ chữ thường+số+gạch nối, 2-63 ký tự |
| GPU | H100 ($2.50/hr) | A30/H100/H200/B300 |
| Region | HAN-2 | HAN-1/HAN-2/SGN-1 |
| Commit term | On-demand | On-demand / 7-30d (−9%) / 91-180d (−27%) |
| Max replicas | 1 | 1-8 (chỉ k8s mode) |
| Cho phép đổi GPU giữa kỳ | ❌ | tick để bật GPU swap (O3) |

### 4.1. Carryover 20% quota (O3 — tự động)

Khi stop endpoint cam kết (7-30d / 91-180d) sớm, hệ thống tự tính:
- Giờ quota còn lại = `COMMIT_HOURS[commit] − (now − startedAt)`
- Carryover = `remaining × 20%` (cap, giảm lạm dụng)
- Carryover được credited vào endpoint record, dùng cho kỳ cam kết tiếp theo

UI hiển thị rõ trong event: `manual stop · credited 143h carryover (quota còn 715h × 20%)`. On-demand không có quota → không carryover.

### 4.2. GPU swap (O3 — tick khi tạo)

Nếu tick **Cho phép đổi GPU giữa kỳ**, sau khi endpoint `running` có thể gọi:
```bash
fpt ddi endpoint swap-gpu --name <ep> --gpu H200
# hoặc API
curl -X POST https://api.fpt-ddi.vn/v1/endpoints/<id>/swap-gpu \
  -H "Authorization: Bearer $FPT_DDI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"gpu":"H200"}'
```

Backend:
- Verify `allowGpuSwap=true` + `status=running` + `newGpu ≠ cur.gpu`
- UPDATE `gpu` + `rate` (giữ commit hiện tại)
- Event: `GPU swap H100→H200 · $2.50→$3.30/hr`
- `startedAt` không reset → carryover sau swap vẫn dựa vào mốc gốc

Ràng buộc:
- `allowGpuSwap=false` (mặc định) → 400 `endpoint không bật allowGpuSwap`
- Endpoint chưa `running` → 400 `chỉ swap GPU được endpoint running`
- Cùng GPU hiện tại → 400 `không cần swap`
- GPU không hợp lệ (vd. `V100`) → 400 `gpu phải thuộc A30, H100, H200, B300`

### 4.3. Lifecycle + kiểm tra

Sau bấm **Deploy endpoint**:
1. Backend gọi `POST /v1/byom/:id/deploy` → tạo endpoint với `status=queued`
2. Worker (`src/endpoints/worker.js`) poll mỗi 2s, chuyển `queued → deploying (~800ms) → running (~2500ms)`
3. UI tự jump sang tab **Dedicated inference** + hiển thị workflow live + toast `Endpoint <name> is running`

```bash
fpt ddi endpoint list
fpt ddi endpoint get --name <ep>
fpt ddi endpoint logs --name <ep> --tail
fpt ddi endpoint scale --name <ep> --replicas 4
fpt ddi endpoint stop --name <ep>    # → credited carryover nếu commit
fpt ddi endpoint start --name <ep>  # khởi động lại từ stopped
fpt ddi endpoint delete --name <ep>
```

---

## 5. Pricing

| GPU | On-demand | 7-30d | 91-180d | Hyperscaler ref |
|---|---|---|---|---|
| A30 | $0.90 | $0.82 | — | — |
| H100 | $2.50 | $2.28 | $1.82 | $6.16 |
| H200 | $3.30 | $3.00 | $2.41 | $7.91 |
| B300 | $5.50 | $5.01 | $4.04 | — |

So với hyperscaler: **−60%** trung bình. Data residency Việt Nam mặc định.

---

## 6. Mẫu dùng thử — 3 ngày trước cam kết

Khách persona 2 (IT director E Hospital):

1. Tạo key scope `byom+endpoints+playground` (free)
2. Upload model BYOM (HF repo công khai)
3. Thử 3 ngày trên playground — đo p95 cold-start + token throughput thật
4. Khi đạt giá trị, bấm **Deploy** với commit 7-30d (−9%)
5. Sau 3 ngày trial, quyết định:
   - Hài lòng → gia hạn 91-180d (−27%)
   - Đổi nhu cầu → stop → credited 20% carryover → deploy lại model khác

---

## 7. Khắc phục lỗi thường gặp

| Triệu chứng | Nguyên nhân | Khắc phục |
|---|---|---|
| `401 Unauthorized` | API key thiếu scope `playground` cho `/v1/chat/completions` | tạo key mới với 3 scope `byom+endpoints+playground` |
| `404 model không có trên server` | modelname BYOM sai định dạng | dùng `byom-<job-id>` (job-id từ `byom list`) |
| `409 model đã có endpoint XYZ` | model này đã deploy | bấm **Deploy đè** (xóa endpoint cũ) hoặc đổi tên endpoint |
| `First request chậm 30-60s` | warming preview pool (lần đầu) | chờ — UI hiển thị `⏳ warming pool…`, sau đó <200ms |
| `400 endpoint không bật allowGpuSwap` | quên tick khi tạo | xóa endpoint, tạo lại với tick |
| `400 chỉ swap GPU được endpoint running` | endpoint đang queued/stopped | đợi `running` hoặc swap trước khi stop |

---

## 8. Tài liệu đối chiếu

- Spec MVP: `docs/product/spec-mvp.md` (người dùng, use case, AC, kiến trúc, task breakdown)
- Opportunity brief: `docs/product/opportunity-brief.md` (6 cơ hội O1-O6)
- Scoring: `docs/product/opportunity-scoring.md` (4 trục, top-3)
- Interview script: `docs/product/interview-script.md` (6 khách reference)
- API reference: `docs.ddi.fpt.vn/api`
- OpenAI compatibility: `docs.ddi.fpt.vn/openai-compat`
- Data residency: `docs.ddi.fpt.vn/residency`
- CLI reference: `docs.ddi.fpt.vn/cli`

---

## 9. Cập nhật

- **2026-08-24** — MVP O1 Sprint 1-3 hoàn tất: BYOM upload + playground chat SSE + one-click deploy + carryover 20% + GPU swap (37/37 test pass trên preview postgres thật)
- Sprint 4: tài liệu này + blog công bố + đo p95 cold-start thật công khai trên UI
