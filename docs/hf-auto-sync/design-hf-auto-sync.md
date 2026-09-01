# HF Auto-Sync — Bản thiết kế chi tiết

> Tính năng: **tự động fetch model mới + kiểm tra revision từ HuggingFace theo định kỳ**, đưa vào admin Model Catalog.
> Phiên bản thiết kế: v1.0 · Ngày: 2026-08-29 · Trạng thái: chờ duyệt trước khi triển khai

---

## 1. Mục tiêu & Phạm vi

### 1.1 Vấn đề hiện tại
- Việc lấy dữ liệu từ HuggingFace hiện chỉ **on-demand** (`POST /admin/catalog/hf-fetch` khi người dùng bấm nút) — không có worker tự động.
- Tab "Pending updates (Phase 2)" trong Sync & Mirror chỉ là **UI placeholder**, không có scheduler thật.
- Người vận hành phải thủ công nhập từng `hf_model_id` để tạo entry mới.

### 1.2 Mục tiêu
1. **Discover (khám phá)**: định kỳ quét HF để tìm model mới (trending) và tạo entry **draft** tự động.
2. **Revision check (theo dõi bản mới)**: định kỳ kiểm tra `sha` của các entry đang active, nếu có revision mới → sinh đề xuất vào `mc_pending_updates` (hoàn thiện Phase 2).
3. Cung cấp UI quản trị để xem lịch sử lần chạy, bật/tắt, chạy ngay (run-now), và xem model mới được phát hiện.

### 1.3 Ngoài phạm vi (Out of scope)
- Tự động approve/publish model phát hiện được (luôn để **draft**, cần người duyệt).
- Tự động mirror weights khi có revision mới (chỉ sinh đề xuất, người duyệt Approve mới re-mirror).
- Đồng bộ ngược (push) sang BFF — đã có `publish.js`, không đổi.

---

## 2. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                        server.js (Node/Express)                      │
│                                                                     │
│  ┌───────────────┐   ┌──────────────────────────┐                   │
│  │  mcMirrorWorker│   │  mcHfSyncWorker (MỚI)   │                   │
│  │  mirror.js     │   │  hfsync.js              │                   │
│  │  poll 5s       │   │  poll 6h (cấu hình)     │                   │
│  └───────┬───────┘   └───────────┬──────────────┘                   │
│          │                       │                                   │
│          ▼                       ▼                                   │
│  ┌──────────────────────────────────────────────┐                    │
│  │          catalog-admin/ (module)             │                    │
│  │  store.js · hf.js · publish.js · config.js   │                    │
│  └───────┬───────────────────────────┬──────────┘                    │
│          │                           │                               │
│          ▼                           ▼                               │
│  ┌──────────────┐            ┌───────────────┐                       │
│  │   Postgres   │            │ HuggingFace   │                       │
│  │ mc_entries   │◄──────────►│  /api/models  │                       │
│  │ mc_sync_runs │  (MỚI)     │  /api/models/ │                       │
│  │ mc_pending_  │            │  {id}         │                       │
│  │  updates     │            └───────────────┘                       │
│  └──────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

- Worker mới `hfsync.js` chạy trong **cùng tiến trình** server (pattern giống `mirror.js`, `byom/worker.js`), không tách microservice.
- Dùng **Postgres** làm nguồn sự thật (không dùng Redis cho state sync — giữ đơn giản như các worker khác).
- Gọi HF API qua module `hf.js` hiện có (tái dùng `fetchHfMetadata`, `mapHfToCatalog`, cache, backoff).

---

## 3. Thiết kế Backend (BE)

### 3.1 Cấu hình mới — `src/catalog-admin/config.js`
Thêm block `hfsync` (env-driven, khớp pattern `mirror`/`hf`):

```js
hfsync: {
  enabled: process.env.MC_HF_SYNC_ENABLED !== "false",   // bật/tắt worker
  pollIntervalMs: parseInt(process.env.MC_HF_SYNC_POLL_MS || String(6*3600*1000), 10), // mặc định 6h
  discoverLimit: parseInt(process.env.MC_HF_SYNC_DISCOVER_LIMIT || "20", 10), // số model quét/lần
  discoverSort: process.env.MC_HF_SYNC_DISCOVER_SORT || "trendingScore",     // trendingScore | downloads | likes | createdAt
  revisionCheckEnabled: process.env.MC_HF_SYNC_REVCHECK !== "false",         // bật kiểm tra revision
  minAgeHours: parseInt(process.env.MC_HF_SYNC_MIN_AGE_HOURS || "0", 10),    // lọc model quá mới (tuỳ chọn)
},
```

### 3.2 Worker mới — `src/catalog-admin/hfsync.js`
Pattern giống `mirror.js` (guard `running`, `setInterval`, `start/stop/status`).

**`runOnce()` — một chu kỳ gồm 2 bước:**

**Bước A — Discover model mới:**
1. Gọi HF API tìm model: `GET {apiBase}/models?sort={discoverSort}&limit={discoverLimit}&filter=text-generation` (hoặc dùng endpoint search/trending).
2. Với mỗi model trong kết quả, lọc: có `config.json`, `library_name` hợp lệ (transformers/vllm...), không trùng `hf_model_id` đã tồn tại.
3. Gọi `hf.fetchHfMetadata(id)` để lấy metadata đầy đủ.
4. `store.createEntry({...draft, hfModelId, displayName, ...}, actor="hf-sync")` — luôn tạo **draft**.
5. Ghi audit `mc.hf_discover` (tái dụng `audit.store`).

**Bước B — Revision check (Phase 2):**
1. `store.listEntriesForSync()` — các entry `status=active` và `sync_enabled=true`.
2. Với mỗi entry: gọi HF `GET /api/models/{hf_model_id}` lấy `sha` hiện tại.
3. Nếu `sha !== entry.revision` và chưa có đề xuất `pending` trùng → `store.createPendingUpdate(entryId, oldRev, newRev)`.
4. Cập nhật `hf_last_checked_at`.

**Ghi nhật ký chạy:** mỗi chu kỳ ghi 1 dòng vào bảng `mc_sync_runs` (started/finished, discovered, newRevisions, errors).

**An toàn:**
- Guard `running` chống chồng lấp chu kỳ.
- Backoff khi HF rate-limit (429) — tái dùng logic trong `hf.js`.
- Không crash server khi 1 entry lỗi (try/catch từng entry).
- `timer.unref()` để không giữ tiến trình.

### 3.3 Store mới — `src/catalog-admin/store.js` (thêm hàm)
```js
listEntriesForSync()          // SELECT * WHERE status_code='active' AND sync_enabled
listHfIds()                   // tập hf_model_id đã tồn tại (để dedupe discover)
createPendingUpdate(entryId, oldRev, newRev)  // idempotent: bỏ qua nếu đã có pending trùng
recordSyncRun({startedAt, finishedAt, discovered, newRevisions, errors})
listSyncRuns(limit)           // lịch sử lần chạy
markHfChecked(id)             // set hf_last_checked_at=now()
```

### 3.4 Migration mới — `db/migrations/016-mc-hf-sync.sql`
```sql
-- Thêm cột theo dõi HF trên entry
ALTER TABLE mc_entries ADD COLUMN IF NOT EXISTS hf_last_checked_at TIMESTAMPTZ;
ALTER TABLE mc_entries ADD COLUMN IF NOT EXISTS hf_discovered BOOLEAN NOT NULL DEFAULT FALSE;

-- Bảng ghi lịch sử lần chạy sync
CREATE TABLE IF NOT EXISTS mc_sync_runs (
  id            TEXT PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  discovered    INT NOT NULL DEFAULT 0,
  new_revisions INT NOT NULL DEFAULT 0,
  errors        INT NOT NULL DEFAULT 0,
  detail        JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_mc_sync_runs_started ON mc_sync_runs(started_at DESC);
```
*(Idempotent, chạy qua `docker-entrypoint-initdb.d` khi khởi động Postgres trong preview.)*

### 3.5 Routes mới — `src/catalog-admin/routes.js`
| Method | Path | Scope/Role | Mô tả |
|---|---|---|---|
| GET | `/admin/catalog/sync-runs` | admin (GET) | Lịch sử lần chạy HF sync |
| POST | `/admin/catalog/sync/run-now` | admin | Chạy ngay 1 chu kỳ (manual trigger) |
| GET | `/admin/catalog/discovered` | admin (GET) | Danh sách entry draft do HF discover tạo |

- `run-now` gọi `hfsync.runOnce()` (bất đồng bộ, trả `{ok, started:true}`), tránh chờ lâu.
- Gắn vào `server.js`: khởi động `mcHfSyncWorker.start()` trong block `WORKER_MODE === 'all'`, thêm vào `/health` workers.

---

## 4. Thiết kế Frontend (FE) — Admin Console

### 4.1 Vị trí UI
Mở rộng module **M6 (Sync & Mirror)** — thêm tab thứ ba **"HF Auto-sync"** bên cạnh "Mirror jobs" và "Pending updates". Không tạo nav mới (giữ giao diện gọn).

### 4.2 Module mới — `admin-console/js/m6-sync.js` (mở rộng)
- Thêm tab `data-tab="hfsync"`.
- `load("hfsync")` gọi 3 API song song: `sync-runs`, `discovered`, `pending-updates`.
- Render:
  - **Header**: trạng thái worker (bật/tắt từ `/health`), nút **"▶ Chạy ngay"** (`run-now`), nút Refresh.
  - **Card "Model mới phát hiện"**: bảng draft entries từ HF (tên, hf_model_id, revision, thời gian) + nút **"Xem/Duyệt"** → link `#/entry/{id}`.
  - **Card "Lịch sử lần chạy"**: bảng `mc_sync_runs` (thời điểm, discovered, new_revisions, errors, duration).
- Poll tự động mỗi 30s (tái dùng pattern `setInterval` của M6).

### 4.3 Cập nhật `admin-console/index.html`
- Thêm script `m6-sync.js` đã có — chỉ cần thêm tab HTML trong render (không cần thẻ script mới nếu giữ trong M6). Nếu tách module riêng thì thêm `<script src="/admin/js/m7-hfsync.js">`.

---

## 5. Thiết kế UI (Mockup)

```
┌────────────────────────────────────────────────────────────────────┐
│  Sync & Mirror                              [⟳ Refresh] [▶ Chạy ngay]│
│  [Mirror jobs] [Pending updates] [HF Auto-sync]                     │
├────────────────────────────────────────────────────────────────────┤
│  ● Worker: ĐANG BẬT · chu kỳ 6h · lần chạy cuối 2 phút trước       │
│                                                                     │
│  ── Model mới phát hiện từ HuggingFace ──                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Model              │ hf_model_id        │ Revision │ Thời gian│ │
│  │ Qwen 3.8 Flash Next│ Qwen/Qwen3.8-Flash │ abc1234  │ 2p trước │ │
│  │ GLM 5.3 Flash      │ zai-org/glm-5.3    │ def5678  │ 2p trước │ │
│  │  [Xem & duyệt]  [Xem & duyệt]                                  │ │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Lịch sử lần chạy ──                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Started            │ Discovered │ New rev │ Errors │ Duration │ │
│  │ 2026-08-29 11:00   │ 2          │ 1       │ 0      │ 4.2s     │ │
│  │ 2026-08-29 05:00   │ 0          │ 0       │ 0      │ 1.1s     │ │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc UX:**
- Model phát hiện luôn là **draft** — không tự publish, không tự mirror.
- Nút "Chạy ngay" có trạng thái loading + toast kết quả.
- Hiển thị rõ trạng thái worker (bật/tắt) để người vận hành biết.
- Khi có revision mới, tab "Pending updates" sẽ hiện đề xuất (đã có sẵn Approve/Reject).

---

## 6. Test Tasks

### 6.1 Unit / Integration (backend)
| ID | Mô tả | Tiêu chí pass |
|---|---|---|
| UT-01 | `runOnce` discover tạo entry draft khi HF trả model mới | Entry mới `status=draft`, `hf_discovered=true`, có audit |
| UT-02 | Discover **bỏ qua** model đã tồn tại `hf_model_id` | Không tạo trùng, không lỗi |
| UT-03 | Discover bỏ qua model thiếu `config.json` | Không tạo entry |
| UT-04 | Revision check tạo `mc_pending_updates` khi `sha` đổi | Có dòng pending, `old_revision`≠`new_revision` |
| UT-05 | Revision check **không** tạo trùng pending | Gọi 2 lần → chỉ 1 dòng pending |
| UT-06 | Revision check bỏ qua entry `sync_enabled=false` | Không sinh đề xuất |
| UT-07 | `run-now` chạy thủ công | Ghi `mc_sync_runs`, trả `{ok:true}` |
| UT-08 | HF rate-limit (429) → backoff, không crash | Worker tiếp tục chu kỳ sau |
| UT-09 | HF timeout/network lỗi → ghi errors, không crash | `mc_sync_runs.errors` tăng, server sống |
| UT-10 | Guard `running` chống chồng lấp | 2 lần gọi đồng thời → chỉ 1 chạy |

### 6.2 API (integration qua HTTP)
| ID | Endpoint | Tiêu chí pass |
|---|---|---|
| API-01 | `GET /admin/catalog/sync-runs` | Trả danh sách, `ok:true` |
| API-02 | `POST /admin/catalog/sync/run-now` (scope admin) | 200, khởi động async |
| API-03 | `GET /admin/catalog/discovered` | Trả draft entries do HF tạo |
| API-04 | Auth: gọi không có key / sai scope | 401/403 |
| API-05 | Role: viewer gọi `run-now` | 403 |

### 6.3 Frontend / E2E (Playwright trên preview)
| ID | Mô tả | Tiêu chí pass |
|---|---|---|
| FE-01 | Vào Sync & Mirror → tab HF Auto-sync | Tab hiển thị, không lỗi console |
| FE-02 | Bảng "Model mới phát hiện" render đúng | Hiện draft entries + nút Xem |
| FE-03 | Click "Xem & duyệt" | Điều hướng `#/entry/{id}` đúng |
| FE-04 | Click "Chạy ngay" | Toast thành công, bảng lịch sử cập nhật |
| FE-05 | Poll 30s tự refresh | Dữ liệu mới xuất hiện không cần reload |
| FE-06 | Worker tắt → hiển thị trạng thái "TẮT" | Banner/trạng thái đúng |

### 6.4 Regression
| ID | Mô tả |
|---|---|
| REG-01 | Approve entry vẫn publish + tạo mirror job (không đổi) |
| REG-02 | Mirror jobs tab vẫn hoạt động bình thường |
| REG-03 | Pending updates Approve/Reject vẫn hoạt động |

---

## 7. Checklist triển khai (thứ tự)
1. Migration `016-mc-hf-sync.sql`
2. `config.js` — thêm block `hfsync`
3. `store.js` — thêm hàm sync
4. `hfsync.js` — worker mới
5. `routes.js` — 3 endpoint mới
6. `server.js` — khởi động worker + `/health`
7. `m6-sync.js` — tab HF Auto-sync
8. Test (unit → API → FE/E2E → regression)
9. Cập nhật docs (SRS/BRD nếu cần)