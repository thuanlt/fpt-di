const express = require('express');
const path = require('path');
const fs = require('fs');
const productsRouter = require('./src/routes/products');
const batchRouter = require('./src/batch/jobs');
const skillsRouter = require('./src/skills/routes');
const endpointsRouter = require('./src/endpoints/routes');
const endpointInvokeRouter = require('./src/endpoints/invoke');
const byomRouter = require('./src/byom/routes');
const keysRouter = require('./src/keys/routes').router;
const keysStore = require('./src/keys/store');
const dataRouter = require('./src/data/routes');
const inferenceRouter = require('./src/inference/routes').router;
const auditRouter = require('./src/audit/routes');
const catalogRouter = require('./src/catalog/routes');
const pricingRouter = require('./src/pricing/routes');
const dashboardRouter = require('./src/dashboard/routes');
const db = require('./src/db/pool');
const worker = require('./src/batch/worker');
const byomWorker = require('./src/byom/worker');
const endpointWorker = require('./src/endpoints/worker');
const { shutdown: queueShutdown, ping: redisPing } = require('./src/batch/queue');
const byomCfg = require('./src/byom/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', async (req, res) => {
  const [pgOk, redisOk] = await Promise.all([
    db.ready().catch(() => false),
    redisPing(),
  ]);
  const fsByom = fs.existsSync(byomCfg.storage.root);
  const fsBatch = fs.existsSync(process.env.BATCH_STORAGE_ROOT || '/data/batch');
  const ok = pgOk && redisOk && fsByom && fsBatch;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    workers: {
      batch: worker.status(),
      byom: byomWorker.status(),
      endpoint: endpointWorker.status(),
      mode: process.env.WORKER_MODE || 'all',
    },
    postgres: pgOk,
    redis: redisOk,
    storage: { byom: fsByom, batch: fsBatch },
  });
});

app.use('/api/products', productsRouter);

// /v1/data/* — công khai (dữ liệu hiển thị console; không phải operational API)
app.use('/v1', dataRouter);

// Auth theo path — gate các API theo scope, /keys và /data công khai
function extractKey(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.query.api_key || req.headers['x-api-key'] || '';
}
function pathScope(p) {
  const keysAdminRequired = process.env.KEYS_ADMIN_REQUIRED === 'true';
  // /keys/verify luôn public — chỉ trả thông tin về chính key được trình bày
  if (p === '/keys/verify') return null;
  if (p === '/keys' || p.startsWith('/keys/') || p === '/keys/_/scopes') {
    return keysAdminRequired ? 'admin' : null; // prod on, preview off
  }
  if (p === '/models' || p === '/batch' || p.startsWith('/batch/')) return 'batch';
  if (p === '/audit') return 'admin'; // US-05 — audit chỉ admin
  if (p === '/byom' || p.startsWith('/byom/')) return 'byom';
  // US-06 — price packs (scope admin)
  if (p === '/price-packs' || p.startsWith('/price-packs/')) return 'admin';
  // US-07 — dashboard KPI (scope endpoints)
  if (p === '/dashboard' || p.startsWith('/dashboard/')) return 'endpoints';
  if (p.startsWith('/endpoints') || p === '/skills' || p.startsWith('/skills/')) return 'endpoints';
  // /chat/completions — playground chat, gate scope 'playground' (UI có key với scope)
  if (p === '/chat/completions') return 'playground';
  // /chat public trong preview — worker batch gọi được mà không cần key; production dùng internal token
  if (p === '/chat' || p.startsWith('/chat/')) return null;
  return null;
}

// US-10 — role enforcement theo path (sau khi verify + hasScope)
// Yêu cầu role tối thiểu cho từng loại thao tác:
//   - tạo/sửa key & guardrails → admin
//   - tạo/sửa endpoint → operator/admin
//   - viewer chỉ đọc
// /keys mutations chỉ enforce role khi KEYS_ADMIN_REQUIRED=true (prod) — preview giữ open để bootstrap.
function roleRequirement(method, p) {
  const m = String(method || '').toUpperCase();
  // Guardrails config + events → admin
  if (/^\/endpoints\/[^/]+\/guardrails(\/events)?$/.test(p)) return ['admin'];
  // Audit log → admin
  if (p === '/audit') return ['admin'];
  // US-06 — price packs → admin
  if (p === '/price-packs' || p.startsWith('/price-packs/')) return ['admin'];
  // Endpoint mutations (create/update/delete/scale/start/stop/config/redeploy/swap/status)
  if (p === '/endpoints' || p.startsWith('/endpoints/')) {
    if (p.endsWith('/chat/completions')) return null; // invoke — mọi role dùng được
    if (m === 'GET') return null; // đọc — viewer ok
    return ['operator', 'admin'];
  }
  // Keys mutations — chỉ enforce khi KEYS_ADMIN_REQUIRED (prod)
  if ((p === '/keys' || p.startsWith('/keys/')) && p !== '/keys/verify' && p !== '/keys/_/scopes') {
    if (m === 'GET') return null;
    return process.env.KEYS_ADMIN_REQUIRED === 'true' ? ['admin'] : null;
  }
  return null;
}

app.use('/v1', async (req, res, next) => {
  const scope = pathScope(req.path);
  if (!scope) return next();
  const key = extractKey(req);
  const rec = await keysStore.verify(key);
  if (!rec) return res.status(401).json({ error: 'API key không hợp lệ hoặc đã revoke' });
  if (!keysStore.hasScope(rec, scope)) return res.status(403).json({ error: `Key thiếu scope "${scope}"` });
  // US-10 — role gate
  const needRoles = roleRequirement(req.method, req.path);
  if (needRoles && !needRoles.includes(rec.role || 'viewer')) {
    return res.status(403).json({ error: `Yêu cầu role ${needRoles.join('/')} (hiện ${rec.role || 'viewer'})` });
  }
  await keysStore.recordUsage(rec.id);
  req.apiKey = rec;
  next();
});

// Proxy /v1/chat/completions → vllm-adapter (giữ streaming SSE) — UI playground gọi cùng origin, không CORS
const chatProxyUrl = (process.env.VLLM_BASE_URL || 'http://vllm-adapter:8000') + '/v1/chat/completions';
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const upstream = await fetch(chatProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: { message: `vllm-adapter không tới được: ${e.message}` } });
  }
});

// GET /v1/metrics/cold-start — proxy metric tới vllm-adapter (scope playground)
app.get('/v1/metrics/cold-start', async (req, res) => {
  try {
    const upstream = await fetch((process.env.VLLM_BASE_URL || 'http://vllm-adapter:8000') + '/v1/metrics/cold-start');
    res.status(upstream.status).json(await upstream.json());
  } catch (e) {
    res.status(502).json({ error: { message: `vllm-adapter không tới được: ${e.message}` } });
  }
});

// Mount router operational — tất cả dùng prefix /v1
app.use('/v1', keysRouter, batchRouter, byomRouter, skillsRouter, endpointsRouter, endpointInvokeRouter, inferenceRouter, auditRouter, catalogRouter, pricingRouter, dashboardRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint' });
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON không hợp lệ' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File quá lớn', details: [`giới hạn ${Math.floor(err.limit / 1024 / 1024)}MB`] });
  }
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

const server = app.listen(PORT, async () => {
  const bio = process.env.FPT_DDI_INFERENCE_URL ? `inference=${process.env.FPT_DDI_INFERENCE_URL}` : 'inference=chưa cấu hình';
  console.log(`FPT DDI backend đang chạy tại http://0.0.0.0:${PORT} · ${bio}`);
  // chờ Postgres sẵn sàng
  for (let i = 0; i < 30; i++) {
    if (await db.ready().catch(() => false)) {
      console.log('[pg] đã kết nối Postgres');
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!(await db.ready().catch(() => false))) console.warn('[pg] chưa sẵn sàng — console sẽ rỗng');
  const WORKER_MODE = process.env.WORKER_MODE || 'all'; // 'all' | 'web' | 'worker'
  if (WORKER_MODE === 'all' || WORKER_MODE === 'worker') {
    worker.start();
    byomWorker.start();
    endpointWorker.start();
    console.log(`[workers] mode=${WORKER_MODE} — batch+byom+endpoint đã khởi động`);
  } else {
    console.log(`[workers] mode=${WORKER_MODE} — web/API-only, không khởi động workers`);
  }
});

function graceful(signal) {
  console.log(`[server] nhận ${signal}, tắt worker + đóng server`);
  worker.stop();
  byomWorker.stop();
  endpointWorker.stop();
  Promise.all([queueShutdown(), db.shutdown()]).finally(() => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
process.on('SIGTERM', () => graceful('SIGTERM'));
process.on('SIGINT', () => graceful('SIGINT'));
