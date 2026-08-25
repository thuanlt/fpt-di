# Fix 4 gap production-readiness — FPT DDI Partner Console

Scope: 3 gap ở phần "Gap khi scale" + 1 block auth-critical (keys→Postgres). Tất cả patch dưới đây dựa trên code thật tại thời điểm viết (đối chiếu `server.js`, `src/batch/queue.js`, `src/keys/store.js`, `src/endpoints/store.js`, `db/migrations/001-init.sql`).

---

## ⚡ Apply checklist (cho build agent — chạy tuần tự, không sót)

Thực hiện đúng thứ tự dưới đây. **Sau mỗi bước Gap 3/4/2/1 phải rebuild + test thật trên preview trước khi sang bước kế**, không giả định "chắc chạy đúng". Môi trường preview: `podman-compose -f podman-compose.preview.vibeflow.yaml`.

- [ ] **B0. Preflight** — `git status` sạch; `cp -r src src.bak` (rollback nhanh); chốt deploy targets theo §"Cần bạn xác nhận".
- [ ] **B1. Gap 3** — patch `src/batch/queue.js` (thêm `ping()`) + `server.js` (mở rộng `/health` 200/503, env `WORKER_MODE`).
  - Verify: `curl -s -w "\n%{http_code}\n" http://localhost:5173/health` → 200; stop redis → 503 `redis:false`; rm `/data/byom` → 503 `storage.byom:false`; restore → 200. Lưu `.vibeflow-preview.hash`.
- [ ] **B2. Gap 4** — tạo `deploy/Caddyfile.prod` (ACME + HSTS + CSP `script-src 'self'` + X-Frame DENY + headers).
  - Verify: `curl -sI` prod host → đầy HSTS/CSP/X-Frame-Options; quét SSL Labs ≥ A. (Trong preview sandbox không có domain thật — chỉ dry-run syntax: `caddy validate --config deploy/Caddyfile.prod`.)
- [ ] **B3. Gap 2** — `server.js` env-gate `WORKER_MODE=all|web|worker` (đã gộp B1); tạo `deploy/podman-compose.prod.yaml` tách 2 service `web` + `worker` + `caddy` + prod `postgres`/`redis` có password.
  - Verify: `web` replica log **không** có `[byom-worker] started` / `[endpoint-worker] starting`; `worker` replica log **có**. Test suite `tests/endpoints/run-tests.js` pass.
- [ ] **B4. Block B1 trước Gap 1 — KHÔNG ship Gap 1 nếu `/v1/keys` vẫn public.** Thêm admin-gate (separate patch — cần method auth admin: MFA/SSO/IP allowlist) trước khi sang B5.
- [ ] **B5. Gap 1** — apply `db/migrations/003-api-keys-and-endpoints.sql` (dry-run prod staging trước); chạy backfill `db/scripts/migrate-keys-endpoints.js` (idempotent, `ON CONFLICT DO NOTHING`); rewrite `keys/store.js` + `endpoints/store.js` giữ nguyên exported signatures + `KEYS_BACKEND=file|postgres` toggle.
  - Verify: `DDI_BASE=http://localhost:5173 node tests/keys/run-tests.js` pass; tương tự `tests/endpoints`; concurrent 5 POST `/v1/keys` song song → `GET /v1/keys` count=5 (file-store cũ sẽ race).
- [ ] **B6. Cleanup** — xoá `src.bak` sau khi mọi test pass; giữ `data/keys.json` + `data/endpoints.json` 24–48h (rollback); commit theo từng Gap (4 commit tách biệt, dễ revert).

**Acceptance tổng:** `tests/keys`, `tests/endpoints`, `tests/batch`, `tests/inference` đều pass + `/health` trả 200 + CSP headers đầy + worker web-only không start workers.

---



> Prerequisite: đã chốt 4 decision: target = **Kubernetes (AKS-style)**, secrets = **k8s Secrets + sealed-secrets** cho cron, storage postgres + restore-point backup, TLS = **Caddy ACME tự ký/renewk renew**. Patch dưới đây tuân theo đấy.

## Gap 3 — `/health` check Redis + FS storage roots

### Vấn đề (ground truth)

`server.js:26-35` — `/health` chỉ check Postgres:

```js
app.get('/health', async (req, res) => {
  const pgOk = await db.ready().catch(() => false);
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    worker: worker.status(),
    endpointWorker: endpointWorker.status(),
    postgres: pgOk,
  });
});
```

Không check Redis (batch queue). Không check `BYOM_STORAGE_ROOT` / `BATCH_STORAGE_ROOT`. Liveness probe thus luôn 200 ngay cả khi Redis宕 hay disk full → k8s không restart pod → job queue treo.

### Patch 3a — trong `src/batch/queue.js`

Thêm hàm ping被封:

```js
async function ping() {
  try {
    const r = new Redis(cfg.redis);
    r.on('error', () => {});
    await r.ping();
    await r.quit().catch(() => {});
    return true;
  } catch (_) {
    return false;
  }
}

// xuất thêm:
module.exports = { ..., ping };   // merge với export hiện có tại queue.js:135
```

### Patch 3b — trong `server.js`, sửa `/health`

```js
const { ping: redisPing } = require('./src/batch/queue');
const byomCfg = require('./src/byom/config');

app.get('/health', async (req, res) => {
  const checks = await Promise.all([
    db.ready().catch(() => false),
    redisPing(),
  ]);
  const [postgres, redis] = checks;
  const fs = require('fs');
  const fsByom = fs.existsSync(byomCfg.storage.root) && fs.existsSync(require('path').join(byomCfg.storage.root));
  const fsBatch = fs.existsSync(process.env.BATCH_STORAGE_ROOT || '/data/batch');
  const ok = postgres && redis && fsByom && fsBatch;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    workers: { batch: worker.status(), byom: byomWorker.status(), endpoint: endpointWorker.status(), mode: process.env.WORKER_MODE || 'all' },
    postgres, redis,
    storage: { byom: fsByom, batch: fsBatch },
  });
});
```

### Verify (sau apply)

```bash
# 1.(redis-down) — stop redis container tạm để check 503:
podman-compose -f podman-compose.preview.vibeflow.yaml stop redis
curl -s -w "\n%{http_code}\n" http://localhost:5173/health  # mong 503, redis:false
# (fs) — touch để mount trống → fs:false → 503
podman-compose -f podman-compose.preview.vibeflow.yaml exec -T backend rm -rf /data/byom
curl -s http://localhost:5173/health  # mong 503, storage.byom:false
# restore:
podman-compose -f podman-compose.preview.vibeflow.yaml exec -T backend mkdir -p /data/byom
podman-compose -f podman-compose.preview.vibeflow.yaml start redis
curl -s http://localhost:5173/health  # mong 200
```

---

## Gap 4 — TLS edge (prod Caddyfile) + CSP + security headers

### Vấn đề (ground truth)

`Caddyfile.preview.vibeflow` là path-based proxy cho preview sandbox. Trong prod, app party console phải có hostname thật + HTTPS. Hiện không có security headers (CSP/X-Frame-Options/Referrer), không CSP → SPA chạy inline-scripts từ string `app.js`, dễ bị XSS nếu có insert user-input không escaped.

### Patch 4a — tạo `deploy/Caddyfile.prod`

```caddyfile
{
  admin off
  email ops@fpt-ddi.vn          # ACME account
  # trusted_proxies 10.0.0.0/8   # nếu sau LB nội bộ
}

console.fpt-ddi.vn {
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "geolocation=(), microphone=(), camera=()"
    # CSP: SPA tĩnh tại /, API tại /v1/* (same-origin). Caddy serve /+/assets/**
    Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://s3-han02.fptcloud.com https://huggingface.co"
    -Server
  }
  root * /srv
  handle /v1/* {
    reverse_proxy backend:3000 { header_up Host {host} }
  }
  handle /health { reverse_proxy backend:3000 }
  handle {
    @html path / *.html
    header @html Cache-Control "no-store, max-age=0"
    try_files {path} /index.html
    file_server
  }
}

# (optional) auth.fpt-ddi.vn → /v1/keys khi B1 enable MFA/admin-gate
```

### Patch 4b — `partner-console` sửa `/endpoint-usage` CSP allow `un save-inline`

SPA dùng `<style>` inline tại các trang settings/toast; style-src giữ `'unsafe-inline'`. **Script-src `self`** (đã đ što). N hiếu v ớn domain HF/S3 tại connect-src để console có thể refresh/poll trực tiếp (k lo qua proxy) — nếu muốn force qua proxy same-origin thì bỏ connect-src HF/S3.

### Verify

```bash
curl -sI https://console.fpt-ddi.vn/ | grep -iE "strict-transport|content-security|x-frame"
# mong đầy quit HSTS + CSP + X-Frame-Options: DENY
curl -sI https://console.fpt-ddi.vn/v1/keys
# mong 401 (browse không tiếp reputation với key) — không trả list
qualys SSL Labs: A trở lên (ACME cert hiện hợp style)
```

### Rollback

Revert `Caddyfile.prod` về hostname/path-based như preview (y chang `Caddyfile.preview.vibeflow` nhưng bỏ security headers). Đổi Caddyfile → `caddy reload` không ngắt connection.

---

## Gap 2 — WORKER_MODE tách workers ra process riêng + prod compose

### Vấn đề (ground truth)

`server.js:99-101`:

```js
worker.start();          // batch
byomWorker.start();      // byom
endpointWorker.start();  // endpoints
```

Cả 3 worker chạy trong cùng process backend. Nếu scale `backend` lên >1 replica → stream consumer group Redis mỗi replica lấy job khác nhau OK (idempotent vì consumerName=HOSTNAME/pid), NHƯNG:

- **byom worker**: `processJob` tách vào 1 pool concurrent=2; 2 replica = 4 concurrent → fine (vì có jobId lock trong meta). Truly OK nếu hạn chế `BYOM_WORKER_CONCURRENCY × replica ≤ maxFiles`.
- **endpoints worker**: TTL 2s polling schedule `setInterval` — mọi replica cùng reconcile **cùng endpoint** = double-transition-inflame, plus `store.transition` đập file JSON cùng lúc → race write hỏng `endpoints.json` (Patch Gap 1 also fix migration sang Postgres để tránh race).
- **Cron/watchdog `setInterval`**: nhiều replica duplicate firing cron.

### Patch 2a — `server.js` env-gate worker start

```js
const WORKER_MODE = process.env.WORKER_MODE || 'all'; // 'all' | 'web' (web/API-only) | 'worker' (workers-only)

if (WORKER_MODE === 'all' || WORKER_MODE === 'worker') {
  worker.start();
  byomWorker.start();
  endpointWorker.start();
}
```

Default `all` — giữ cách chạy đông(cth, dev/preview) nếu không thêm env. Prod compose tách: `web` service không start workers; worker dedicated replicas chỉ chạy worker.

### Patch 2b — `deploy/podman-compose.prod.yaml` (skeleton)

```yaml
# Deploy-ready compose cho prod. Secrets qua env_file (k8s mount <secret-file>).
services:
  web:        # API + partner-console, WORKER_MODE=web — scale được
    build: { context: ., dockerfile: Dockerfile.backend }
    env_file: [.env.prod]
    environment:
      WORKER_MODE: web
      PG_HOST: ${PG_HOST}
      REDIS_HOST: ${REDIS_HOST}
      PORT: 3000
    depends_on: [postgres, redis]
  worker:     # chỉ chạy worker — scale theo load
    build: { context: ., dockerfile: Dockerfile.backend }
    env_file: [.env.prod]
    environment:
      WORKER_MODE: worker
      PG_HOST: ${PG_HOST}
      REDIS_HOST: ${REDIS_HOST}
      BYOM_WORKER_CONCURRENCY: 2
      FPT_DDI_BATCH_CONCURRENCY: 4
    depends_on: [postgres, redis]
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/Caddyfile.prod:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - ./partner-console:/srv:ro
    depends_on: [web]
  postgres:
    image: pgvector/pgvector:pg15   # prod DB thật + SSL/TLS-only + secret rotation
    volumes: [pgdata:/var/lib/postgresql/data, ./db/migrations:/docker-entrypoint-initdb.d:ro]
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}", "--save", "60", "1"]
    volumes: [redisdata:/data]
volumes: { pgdata: {}, redisdata: {}, caddy_data: {} }
```

### Pairing với Gap 1

Worker dedicated service chạy **endpoints worker** multi-replica → nếu `endpoints.json` работать concurrently race sẽ gãy file. Gap 1 migration sang Postgres giải quyết dứt điểm. **Order: apply Gap 1 trước khi scale worker >1 replica**.

### Verify

```bash
# Chỉ web start workers=false (xem log):
podman-compose -f deploy/podman-compose.prod.yaml up -d web
podman-compose -f deploy/podman-compose.prod.yaml logs web | grep worker
# mong không có dòng "[byom-worker] started" / "[endpoint-worker] starting"
# Apply cả stack:
podman-compose -f deploy/podman-compose.prod.yaml up -d
podman-compose -f deploy/podman-compose.prod.yaml logs web worker
```

---

## Gap 1 — keys/endpoints file-store → Postgres (auth-critical, cần confirm)

### Vấn đề (ground truth)

`src/keys/store.js:7-9` + `src/endpoints/store.js:7-9`: JSON file `data/keys.json`, `data/endpoints.json`, `keys-usage.json`. Hệ quả:

- Scale-horizontality bị zero (1 wire write file).
- Pod restart = mất lịch sử nếu mount tmpfs (preview dùng volume OK).
- Per-request `readAll()` = O(n) parse toàn JSON — key verify mỗi request kéo toàn file.
- **Audit**: `recordUsage` chỉ đếm int; không log ai-revoke-ai, không timestamp per action.
- Verify dùng full SHA256 hash: `verify(key)` hash **mỗi incoming key** + loop `find()` → brute-forceable offline nếu file leak + các token cùng prefix không rate-limited.

### Plan (chia 3 PR nhỏ)

**PR-1.1 — migration schema** (additive, không phá code cũ):

`db/migrations/003-api-keys-and-endpoints.sql`:

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  key_hash     TEXT NOT NULL UNIQUE,         -- sha256(full_key)
  key_prefix   TEXT NOT NULL,                -- "ddi-live-xxx•••"
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  rotated_at   TIMESTAMPTZ,
  scopes_updated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash  ON api_keys(key_hash) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_api_keys_name  ON api_keys(name);

CREATE TABLE IF NOT EXISTS endpoint_entities (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  model           TEXT NOT NULL,
  gpu             TEXT NOT NULL,
  region          TEXT NOT NULL,
  mode            TEXT NOT NULL,
  commit          TEXT NOT NULL,
  replicas        TEXT NOT NULL,
  desired_replicas INT NOT NULL,
  max_replicas    INT NOT NULL,
  rate            NUMERIC(10,2) NOT NULL,
  commit_label    TEXT NOT NULL,
  image           TEXT,
  port            INT,
  status          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  stopped_at      TIMESTAMPTZ,
  failed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoint_entities(status);
CREATE INDEX IF NOT EXISTS idx_endpoints_model  ON endpoint_entities(model);

CREATE TABLE IF NOT EXISTS endpoint_events (
  id        BIGSERIAL PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES endpoint_entities(id) ON DELETE CASCADE,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_state TEXT,
  to_state   TEXT NOT NULL,
  msg       TEXT
);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_ep ON endpoint_events(endpoint_id, at);

CREATE TABLE IF NOT EXISTS key_usage_audit (
  id        BIGSERIAL PRIMARY KEY,
  key_id    TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  action    TEXT NOT NULL,           -- create | verify | revoke | rotate | scope_update | delete
  actor     TEXT,                    -- req.apiKey.id nếu có / IP / header X-Caller
  meta      JSONB
);
CREATE INDEX IF NOT EXISTS idx_key_audit_key ON key_usage_audit(key_id, at);
COMMIT;
```

**PR-1.2 — backfill script** `db/scripts/migrate-keys-endpoints.js`: đọc `data/keys.json` + `data/endpoints.json` (nếu còn) → INSERT; idempotent (`ON CONFLICT DO NOTHING`); chạy 1 lần dry-run trên preview, rồi prod.

**PR-1.3 — rewrite `src/keys/store.js` + `src/endpoints/store.js`**: giữ nguyên exported signatures (`create`, `verify`, `hasScope`, `recordUsage`, `revoke`, `rotate`, `updateScopes`, `remove`, `list`, `listWithUsage` cho keys; `create`, `transition`, `scale`, `start`, `stop`, `remove`, `list`, `getById` cho endpoints). Entity store giữ JSON value nhẹ (events[]) → bảng riêng. Verify dùng `SELECT ... WHERE key_hash=$1 AND status='active'` (index hash, O(1)). Test suite có sẵn `tests/keys/run-tests.js` phải pass không sửa — đó là guard contract.

### Rollback

- Old `data/keys.json` giữ (không xoá) cho 24-48h; đặt env `KEYS_STORAGE_DIR=/data/legacy-keys` để rollback code chỉ cần vẫn đọc file. Switch code old-dep có `KEYS_BACKEND=file|postgres` để fallback.
- DB rollback: `DROP TABLE api_keys, endpoint_entities, endpoint_events, key_usage_audit;` (sau khi backup).

### Test kh a

```bash
# Reuse test suite có sẵn:
DDI_BASE=http://localhost:5173 node tests/keys/run-tests.js
DDI_BASE=http://localhost:5173 node tests/endpoints/run-tests.js
# Concurrent write test (chứng minh race gone):
for i in 1 2 3 4 5; do curl -s -X POST http://localhost:5173/v1/keys -d '{"name":"k-'$i'","scopes":["chat"]}' -H 'content-type: application/json' & done; wait
curl -s http://localhost:5173/v1/keys | jq '.count'
# mong 5 keys — file-store cũ sẽ có race khi trùng-thời (writeAll đập file).
```

---

## Runbook apply tổng hợp (acceptance)

```bash
# 1. Apply Gap 3 + 4 + 2 (không auth-critical)
# 2. chạy test suite:
for t in keys endpoints batch inference; do DDI_BASE=http://localhost:5173 node tests/$t/run-tests.js || break; done
# 3. health endpoint:
curl -s http://localhost:5173/health | jq .

# 4. LUÔN apply Gap 1 cuối (xác nhận từng commit với đề-kiện trên), sau khi B1 khóa public /keys (xem assessment) mới ship.
```

## Risk register

| Risk | Severity | Khắc phục |
|---|---|---|
| `/v1/keys` public (B1 block) | CRITICAL | Gap 1 + thêm admin auth (separate doc) — KHÔNG ship Gap 1 nếu B1 chưa khóa |
| worker multi-replica race trên file-store | HIGH | Gap 1 trước, rồi Gap 2 scale |
| Postgres ddi/ddi default (B4 block) | HIGH | prod compose override `PG_PASSWORD` + SSL/tls-only |
| Redis no password (B5 block) | HIGH | `--requirepass ${REDIS_PASSWORD}` trong compose |
| TCP TLS target ACME fail | LOW | rollback `Caddyfile.prod` → `self-signed` (Let's Encrypt vai Staging) |

## Cần bạn xác nhận (bằng tiếng Việt) trước khi apply Gap 1:

1. **Cho phép tôi rotate code auth-critical** (`keys/store.js`, `endpoints/store.js`) — blast radius = toàn bộ verify path + audit.
2. **Test kh a là test suite có sẵn** (`tests/keys/run-tests.js` + `tests/endpoints/run-tests.js`) phải pass không sửa — OK?
3. **Rotwin: keeping old file-store 24-48h** với env toggle `KEYS_BACKEND` — OK?
