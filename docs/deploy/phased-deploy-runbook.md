# Phased deploy runbook — FPT DDI Partner Console

Thực hiện tuần tự 6 phase dưới đây. **Không phase nào được qua gate nếu acceptance fail.** Mỗi phase có: lệnh thật · gate · rollback · ước tính thời gian · rủi ro.

> Yêu cầu trước:
> - Đã apply 4 gap + 4 blocker (xem `docs/modernization/fix-4-gaps.md` + `docs/deploy/production-deploy-plan.md` §8).
> - Có `kubectl` context trỏ cluster prod, `helm` 3.x, `podman`/`docker`, `psql` trỏ staging + prod.
> - Registry nội `registry.fpt.vn/ddi/` có quyền push.
> - Domain `console.fpt-ddi.vn` + `api.fpt-ddi.vn` DNS trỏ ingress controller.
> - S3 FSS bucket `fpt-ddi-backup` đã tạo, presign OK.

---

## Phase 1 — Build & push image (15 phút, rủi ro thấp)

### Lệnh

```bash
cd /workspace
git checkout main && git pull --ff-only

# Bump version manifest
echo "v2.1.0-$(date +%Y%m%d%H%M)" > VERSION

# Build 2 image
podman build -f Dockerfile.backend      -t registry.fpt.vn/ddi/backend:v2.1.0 .
podman build -f Dockerfile.vllm-adapter -t registry.fpt.vn/ddi/vllm-adapter:v2.1.0 .

# Push
podman login registry.fpt.vn -u "$REG_USER" -p "$REG_PASS"
podman push registry.fpt.vn/ddi/backend:v2.1.0
podman push registry.fpt.vn/ddi/vllm-adapter:v2.1.0

# Tag latest (roll-forward anchor)
podman tag  registry.fpt.vn/ddi/backend:v2.1.0      registry.fpt.vn/ddi/backend:latest
podman tag  registry.fpt.vn/ddi/vllm-adapter:v2.1.0  registry.fpt.vn/ddi/vllm-adapter:latest
podman push registry.fpt.vn/ddi/backend:latest
podman push registry.fpt.vn/ddi/vllm-adapter:latest
```

### Gate 1 (chưa qua không qua Phase 2)

- [ ] `podman images | grep ddi/backend:v2.1.0` → tag tồn tại
- [ ] `podman run --rm registry.fpt.vn/ddi/backend:v2.1.0 node -e "require('./server.js')"` exit 0 trong 3s (không crash khi require)
- [ ] Smoke: `podman run --rm -e PORT=3000 -p 3001:3000 registry.fpt.vn/ddi/backend:v2.1.0 & curl -s http://localhost:3001/health | jq -r .status` → `ok`

### Rollback 1
- Xoá tag `v2.1.0` khỏi registry (giữ `:latest` cũ): `podman untag` / `crane delete`.
- Không có gì trong cluster bị ảnh hưởng.

### Rủi ro
- Build fail → sửa lint/Dockerfile, không tác động cluster.
- Push fail (auth) → kiểm tra secret registry.

---

## Phase 2 — DB migration (staging → prod) (30 phút, rủi ro trung bình)

### Lệnh

```bash
# 2a. Staging tiên phong
psql "$PG_STAGING" -f db/migrations/001-init.sql               # idempotent nếu đã chạy
psql "$PG_STAGING" -f db/migrations/002-endpoint-usage.sql
psql "$PG_STAGING" -f db/migrations/003-api-keys-and-endpoints.sql

# 2b. Backfill từ file-store cũ sang Postgres (idempotent)
kubectl -n ddi-stage port-forward svc/ddi-postgres 5433:5432 &
PGHOST=localhost PGPORT=5433 PGUSER=ddi PGDATABASE=ddi node db/scripts/migrate-keys-endpoints.js --dry-run
PGHOST=localhost PGPORT=5433 PGUSER=ddi PGDATABASE=ddi node db/scripts/migrate-keys-endpoints.js --apply

# 2c. Test suite nguyên trên staging
DDI_BASE=https://staging-api.fpt-ddi.vn node tests/keys/run-tests.js
DDI_BASE=https://staging-api.fpt-ddi.vn node tests/endpoints/run-tests.js
DDI_BASE=https://staging-api.fpt-ddi.vn node tests/batch/run-tests.js
DDI_BASE=https://staging-api.fpt-ddi.vn node tests/inference/run-tests.js

# 2d. Prod backup TRƯỚC khi migrate
pg_dump --format=custom --file=/tmp/ddi-prod-$(date +%Y%m%d).dump "$PG_PROD"
aws --profile fss s3 cp /tmp/ddi-prod-*.dump s3://fpt-ddi-backup/db/ --endpoint-url https://s3-han02.fptcloud.com

# 2e. Prod migrate
psql "$PG_PROD" -f db/migrations/003-api-keys-and-endpoints.sql
PGHOST=... node db/scripts/migrate-keys-endpoints.js --apply --target=prod
```

### Gate 2

- [ ] Staging: 4 test suite exit 0; không có dòng `[FAIL]` trong output.
- [ ] `psql "$PG_STAGING" -c "SELECT count(*) FROM api_keys"` ≥ số key trong `data/keys.json` cũ.
- [ ] `psql "$PG_STAGING" -c "SELECT count(*) FROM endpoint_entities"` ≥ số endpoint trong `data/endpoints.json` cũ.
- [ ] Concurrent write test trên staging: `for i in $(seq 1 5); do curl -s -X POST https://staging-api.fpt-ddi.vn/v1/keys -H "Content-Type: application/json" -d "{\"name\":\"k-$i\",\"scopes\":[\"chat\"]}" -H "Authorization: Bearer $KEY" & done; wait; curl -s https://staging-api.fpt-ddi.vn/v1/keys -H "Authorization: Bearer $KEY" | jq .count` → 5 (không race).
- [ ] Prod: backup `.dump` đã lên S3; verify `aws --profile fss s3 ls s3://fpt-ddi-backup/db/ | tail -1`.
- [ ] Prod: `psql "$PG_PROD" -c "SELECT count(*) FROM api_keys"` = 0 sau migrate (sẽ backfill tiếp) → OK; nếu khác → rollback.

### Rollback 2
- Prod: `psql "$PG_PROD" -c "DROP TABLE IF EXISTS key_usage_audit, endpoint_events, endpoint_entities, api_keys CASCADE;"`
- Restore backup nếu backfill đã ghi sai: `pg_restore --clean --if-exists -d "$PG_PROD" /tmp/ddi-prod-*.dump`.
- Env toggle: set `KEYS_BACKEND=file` trong helm values → backend dùng lại `data/keys.json`. Khởi động lại pod.
- Thông báo: hiện chưa canary traffic sang v2.1 nên user vẫn dùng `backend:v2.0.0` cũ.

### Rủi ro
- Backfill duplicate nếu chạy 2 lần → script dùng `ON CONFLICT DO NOTHING`. Verify `count(*)` phải = số bản ghi unique.
- Migration locks	long-running → chạy ngoài giờ; check `pg_locks` trước: `SELECT * FROM pg_locks WHERE granted=false AND mode='AccessExclusiveLock';`

---

## Phase 3 — Canary deployment 10% traffic (1 giờ, rủi ro trung bình)

### Lệnh

```bash
# 3a. Helm install song song (không xóa v2.0)
helm upgrade --install ddi-v21 ./deploy/helm \
  -f deploy/values.prod.yaml \
  --set image.backend=registry.fpt.vn/ddi/backend:v2.1.0 \
  --set image.vllmAdapter=registry.fpt.vn/ddi/vllm-adapter:v2.1.0 \
  --set web.replicas=2,worker.replicas=0 \
  --set worker.enabled=false \
  --namespace ddi-prod

# 3b. Ingress canary 10%
kubectl -n ddi-prod apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ddi-console-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: console.fpt-ddi.vn
    http:
      paths: [{ path: /, pathType: Prefix, backend: { service: { name: ddi-v21-web, port: { number: 3000 } } } }]
  - host: api.fpt-ddi.vn
    http:
      paths: [{ path: /v1, pathType: Prefix, backend: { service: { name: ddi-v21-web, port: { number: 3000 } } } }]
EOF

# 3c. Watch metrics 30 phút
kubectl -n ddi-prod logs -l app=ddi-v21-web --tail=50 -f
# Grafana: p95 latency + 5xx rate dashboard ddi-console
```

### Gate 3

- [ ] Pod ready: `kubectl -n ddi-prod rollout status deploy/ddi-v21-web` → `deployment "ddi-v21-web" successfully rolled out`.
- [ ] `/health` 200 (canary ingress): `for i in $(seq 1 20); do curl -s -w "%{http_code}\n" -o /dev/null https://console.fpt-ddi.vn/health; done | sort | uniq -c` → 100% `200`.
- [ ] CSP headers: `curl -sI https://console.fpt-ddi.vn/ | grep -iE "strict-transport-security|content-security-policy"` đủ 2 header.
- [ ] Worker **không** started trong log `ddi-v21-web`: `kubectl logs deploy/ddi-v21-web | grep -E "byom-worker|endpoint-worker" | wc -l` = 0 (vì `WORKER_MODE=web`).
- [ ] Error rate < 1% trong 30 phút (so với baseline v2.0).
- [ ] P95 latency delta < 50ms so với v2.0.

### Rollback 3
- Trả `canary-weight: 0`: `kubectl -n ddi-prod annotate ingress ddi-console-canary nginx.ingress.kubernetes.io/canary-weight=0`.
- `helm uninstall ddi-v21 -n ddi-prod`.
- User về lại 100% v2.0 tức thì. DB đã migrate Phase 2 → App v2.0 vẫn đọc được `KEYS_BACKEND=file` (env toggle) → không vỡ. Quan trọng: KHÔNG rollback DB.

### Rủi ro
- 10% user gặp regression v2.1 → có thể không ai báo → bắt buộc phải check metrics error/latency bằng tay.
- Race giữa v2.0 (đang dùng file-store) + v2.1 canary (dùng Postgres) → user submit key trên v2.0 không thấy ở console v2.1 → cần thông báo pilot chỉ test trên 1 nhóm user được canary (HTTP header `X-Canary: true`).

---

## Phase 4 — Tách worker, stop workers trong v2.0 (45 phút, rủi ro cao)

### Lệnh

```bash
# 4a. Deploy worker v2.1 (chỉ worker, không nhận API traffic)
helm upgrade ddi-v21 ./deploy/helm \
  -f deploy/values.prod.yaml \
  --set worker.enabled=true,worker.replicas=2 \
  --set web.replicas=3 \
  --namespace ddi-prod
kubectl -n ddi-prod rollout status deploy/ddi-v21-worker

# 4b. Stop workers trong v2.0 backend (giữ API tiếp tục phục vụ)
kubectl -n ddi-prod set env deploy/ddi-backend WORKER_MODE=web
kubectl -n ddi-prod rollout status deploy/ddi-backend
kubectl -n ddi-prod logs deploy/ddi-backend --tail=20 | grep -E "byom-worker|endpoint-worker"
# Mong KHÔNG có dòng "started" — có nghĩa worker dừng.
```

### Gate 4

- [ ] `ddi-v21-worker` 2 pod ready: `kubectl -n ddi-prod get deploy/ddi-v21-worker` → 2/2.
- [ ] Worker log dồi dào: `kubectl logs deploy/ddi-v21-worker --tail=50 | grep -E "byom-worker|endpoint-worker|batch-worker"` có dòng started.
- [ ] v2.0 OLD backend ngừng worker: `kubectl logs deploy/ddi-backend | grep -c "byom-worker.*started"` trong 5 phút gần nhất = 0 (chỉ còn log API).
- [ ] **Double-process check**: stream Redis consumer group `ddi-workers` có duy nhất 1 list members mỗi job: `kubectl -n ddi-prod exec -it svc/ddi-redis -- redis-cli XINFO CONSUMERS ddi:batch:stream ddi-workers` → tổng consumer = worker replicas v2.1 (2), KHÔNG có v2.0.
- [ ] Submit 1 batch job thật trên staging + verify được process 1 lần (file output unique): `DDI_BASE=https://staging-api.fpt-ddi.vn node tests/batch/run-tests.js` pass.

### Rollback 4
- `kubectl -n ddi-prod set env deploy/ddi-backend WORKER_MODE=all` (v2.0 start lại worker).
- `helm upgrade ddi-v21 --set worker.enabled=false ...` (ngưng worker v2.1).
- Verify worker v2.0 start: `kubectl logs deploy/ddi-backend | grep -c "byom-worker.*started"` > 0.
- Lúc này v2.0 + v2.1 (web-only) cùng chạy; traffic về v2.0 — không thực sự double-process nếu v2.1 không phục vụ chat/byom (chỉ API). Ảnh hưởng batch nếu queue đang treo → kiểm tra `XINFO CONSUMERS` lại.

### Rủi ro
- Stream consumer group có cả v2.0 + v2.1 → double-process job → chi phí +/*** kết quả. Gate consumer-count duy nhất worker v2.1 critical.
- Khi `WORKER_MODE=web` không h đúng — bảo kiểm kỹ theo `/health` `workers.mode` trả về `web`/`all` (Gap 3 đã thêm).

---

## Phase 5 — Cutover 100% traffic (10 phút, rủi ro cao nhất)

### Lệnh

```bash
# 5a. Scale web v2.1 lên đủ replica trước cutover
helm upgrade ddi-v21 ./deploy/helm -f deploy/values.prod.yaml \
  --set web.replicas=3 --set worker.replicas=3 --namespace ddi-prod
kubectl -n ddi-prod rollout status deploy/ddi-v21-web

# 5b. Cutover ingress (chuyển service)
kubectl -n ddi-prod apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ddi-console
spec:
  rules:
  - host: console.fpt-ddi.vn
    http:
      paths: [{ path: /, pathType: Prefix, backend: { service: { name: ddi-v21-web,  port: { number: 3000 } } } }]
  - host: api.fpt-ddi.vn
    http:
      paths: [{ path: /, pathType: Prefix, backend: { service: { name: ddi-v21-web,  port: { number: 3000 } } } }]
EOF
# Xóa canary ingress
kubectl -n ddi-prod delete ingress ddi-console-canary

# 5c. Watch 60s
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://console.fpt-ddi.vn/health)
  [ "$code" != "200" ] && echo "FAIL at $i: $code" && break
  sleep 1
done

# 5d. Scale v2.0 OLD xuống 0 (không xóa baseline)
kubectl -n ddi-prod scale deploy/ddi-backend --replicas=0
```

### Gate 5

- [ ] Loop 60s ở 5c kết thúc không có dòng `FAIL`.
- [ ] `curl -s https://console.fpt-ddi.vn/health | jq .status` = `ok`.
- [ ] `curl -s https://console.fpt-ddi.vn/v1/keys -H "Authorization: Bearer $KEY" | jq .count` > 0 (key đã migrate Phase 2).
- [ ] Prod: chạy smoke test `tests/keys`, `tests/endpoints` (chỉ đọc — không tạo key thật): chạy 5 test case đầu mỗi suite.
- [ ] P95 latency giám sát 15 phút đầu không vượt baseline + 30%.
- [ ] 5xx rate < 0.1%.

### Rollback 5
- `kubectl -n ddi-prod scale deploy/ddi-backend --replicas=3` (v2.0 lên lại).
- `kubectl -n ddi-prod apply -f deploy/ingress-v20.yaml` (ingress trỏ lại svc `ddi-backend`).
- Verify 60s loop.
- v2.1 vẫn scale 0 traffic — không cần uninstall. Quan trọng: DB đã migrate v2.1 ↔ v2.0_TOGGLE=KEYS_BACKEND=file → v2.0 tiếp tục hoạt động được.

### Rủi ro
- Cutover ngắn (seconds) + không downtime vì 2 backend cùng ready trước khi scale v2.0 xuống 0. Nếu panic bất ngờ → rollback 5 trong 2 phút.

---

## Phase 6 — Cleanup + monitor 24h (vài giờ + 24h monitor)

### Lệnh

```bash
# 6a. Đánh dấu v2.0 deprecated — giữ 48h
kubectl -n ddi-prod annotate deploy/ddi-backend deprecated=true

# 6b. Watch metrics 24h trên Grafana dashboard `ddi-console-prod`:
# - p95 latency / qps / 5xx rate
# - endpoint_consumer count (phải = 3, không +v2.0)
# - pod restart count = 0 trong 24h
# - DB connection pool max (mong < 50% của pool max=10/backend replica)

# 6c. Sau 48h OK → xóa v2.0
helm uninstall ddi-legacy -n ddi-prod 2>/dev/null
kubectl -n ddi-prod delete deploy/ddi-backend svc/ddi-backend 2>/dev/null

# 6d. Backup DB sau deploy
pg_dump --format=custom --file=/tmp/ddi-prod-post-v21-$(date +%Y%m%d).dump "$PG_PROD"
aws --profile fss s3 cp /tmp/ddi-prod-post-v21-*.dump s3://fpt-ddi-backup/db/ --endpoint-url https://s3-han02.fptcloud.com

# 6e. Cleanup file backup cục bộ
rm /tmp/ddi-prod-*.dump 2>/dev/null
```

### Gate 6

- [ ] 24h không có PodRestart > 0 bất thường.
- [ ] 5xx rate < 0.01%.
- [ ] `key_usage_audit` ghi được và có row audit (verify Phase 2 B5): `psql "$PG_PROD" -c "SELECT count(*) FROM key_usage_audit"` > 0 trong 24h.
- [ ] Audit log có ít nhất 1 dòng `action='verify'`.
- [ ] v2.0 đã xóa — `kubectl get deploy -n ddi-prod | grep ddi-backend` → 0 kết quả.

### Rollback 6
- Khó rollback nếu đã xóa v2.0. Giữ image `:v2.0.0` trong registry 30 ngày — có thể reinstall `helm install ddi-legacy ...` nếu critical bug phát hiện. Trước khi xóa, **snapshot prod + verify backup restore-test trên staging** chạy được.

### Rủi ro
- Audit chưa record row → check code chọn `KEYS_BACKEND` env + `recordUsage()` hook vào query audit → nếu lack → fix forward (không rollback).

---

## Tổng kết acceptance (đóng deploy)

Sau khi Phase 6 pass:
- [ ] 100% traffic = v2.1 (`ddi-v21-web`)
- [ ] Worker isolated (`ddi-v21-worker`)
- [ ] DB migrated + audit log chạy
- [ ] TLS + CSP + HSTS đầy
- [ ] Backup hằng đêm + monthly restore-test
- [ ] Dashboards p95/5xx/consumer-count đã dựng trong Grafana
- [ ] Runbook này lưu vào `docs/deploy/phased-deploy-runbook.md`, PR merge hết.

Gửi email launch nội bộ thông báo tin: "FPT DDI Partner Console v2.1 đã deploy production, mọi API hoạt động ổn định. Pilot mở 1 nhóm user nội → monitor 1 tuần → mở rộng."

---

## Quản lý khẩn cấp

| Tình huống | Hành động tức thì |
|---|---|
| 5xx > 1% sau cutover | Rollback Phase 5 (scale v2.0 lên, ingress trỏ svc ddi-backend) |
| Batch queue stuck > 5 phút | `kubectl logs deploy/ddi-v21-worker`; check Redis `XINFO STREAM ddi:batch:stream` |
| DB CPU > 80% | Check slow query `pg_stat_statements`; scale `ddi-postgres` CPU; tuning max connections |
| Audit log không record | Patch forward env `KEYS_BACKEND=postgres` đã set + chạy `db/scripts/migrate-keys-endpoints.js --audit-replay` |
| Ingress TLS cert expire | Caddy ACME auto-renew; nếu fail → manual `caddy reload` + check ACME account email |
