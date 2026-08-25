"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let AUTH_KEY = null;
let pass = 0, fail = 0;
const results = [];

function req(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    let payload = null;
    const h = { ...headers };
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
    if (AUTH_KEY && !h.Authorization) h.Authorization = `Bearer ${AUTH_KEY}`;
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: h }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, body: buf, json });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nm() { return "mon-" + Math.random().toString(36).slice(2, 8); }

async function waitRunning(epId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await req("GET", `/v1/endpoints/${epId}`);
    if (r.json?.data?.status === "running") return r.json.data;
    await sleep(800);
  }
  return null;
}

async function main() {
  console.log(`\n=== FPT DDI Monitoring — Endpoint Metrics (thật từ usage) ===`);
  console.log(`base=${BASE}\n`);

  // setup key
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-mon-" + Date.now(), scopes: ["endpoints", "chat"], role: "operator" } });
    AUTH_KEY = r.json?.full_key;
    if (!AUTH_KEY) { console.error("Không tạo được key"); process.exit(2); }
    console.log(`[setup] key tạo xong\n`);
  }

  // 1. Tạo endpoint + đợi running
  console.log("[1] Tạo endpoint + đợi running");
  let epId = null;
  {
    const r = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    check("tạo endpoint 201", r.status === 201, `got ${r.status}`);
    epId = r.json?.data?.id;
    const running = await waitRunning(epId);
    check("endpoint running", !!running, "—");
    if (!running) { console.log("Bỏ qua — endpoint không running"); process.exit(fail > 0 ? 1 : 0); }
  }

  // 2. Invoke nhiều lần để có usage thật
  console.log("\n[2] Invoke 5 lần (4 thành công + 1 lỗi 400) để có data metrics");
  {
    for (let i = 0; i < 4; i++) {
      await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: { messages: [{ role: "user", content: "monitoring call " + i }] } });
    }
    // 1 lỗi 400 (thiếu messages) — ghi status_code=400 vào usage
    await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {} });
    await sleep(500);
  }

  // 3. GET metrics — verify aggregate thật
  console.log("\n[3] GET /metrics — aggregate thật từ endpoint_usage");
  {
    const r = await req("GET", `/v1/endpoints/${epId}/metrics?range=24h`);
    check("status 200", r.status === 200, `got ${r.status}`);
    const d = r.json?.data || {};
    const t = d.totals || {};
    check("range=24h", d.range === "24h", `got ${d.range}`);
    check("requests >= 4 (4 thành công)", t.requests >= 4, `got ${t.requests}`);
    check("errors >= 1 (lỗi 400)", t.errors >= 1, `got ${t.errors}`);
    check("error_rate tính đúng = errors/requests*100", Math.abs(t.error_rate - (t.errors / t.requests) * 100) < 0.5, `got ${t.error_rate}`);
    check("total_tokens > 0", (t.total_tokens || 0) > 0, "—");
    check("prompt_tokens > 0", (t.prompt_tokens || 0) > 0, "—");
    check("completion_tokens > 0", (t.completion_tokens || 0) > 0, "—");
    check("cost_usd là string", typeof t.cost_usd === "string", "—");
    check("avg_latency_ms là số", typeof t.avg_latency_ms === "number", "—");
    check("p50/p95/p99 là số", typeof t.p50 === "number" && typeof t.p95 === "number" && typeof t.p99 === "number", `got ${t.p50}/${t.p95}/${t.p99}`);
    check("tokens_per_sec là số", typeof t.tokens_per_sec === "number", "—");
    check("series là array", Array.isArray(d.series), "—");
    check("series có ≥1 bucket", d.series.length >= 1, `got ${d.series.length}`);
    if (d.series.length) {
      const s = d.series[0];
      check("series bucket có ts/requests/total_tokens/p95",
        !!s.ts && typeof s.requests === "number" && typeof s.total_tokens === "number" && typeof s.p95 === "number", "—");
    }
  }

  // 4. Metrics theo range khác
  console.log("\n[4] GET /metrics?range=1h và 7d");
  {
    const r1 = await req("GET", `/v1/endpoints/${epId}/metrics?range=1h`);
    check("range=1h → 200", r1.status === 200, `got ${r1.status}`);
    check("range=1h trả về '1h'", r1.json?.data?.range === "1h", `got ${r1.json?.data?.range}`);
    const r7 = await req("GET", `/v1/endpoints/${epId}/metrics?range=7d`);
    check("range=7d → 200", r7.status === 200, `got ${r7.status}`);
    check("range=7d trả về '7d'", r7.json?.data?.range === "7d", `got ${r7.json?.data?.range}`);
    const rBad = await req("GET", `/v1/endpoints/${epId}/metrics?range=99d`);
    check("range không hợp lệ → fallback 24h", rBad.json?.data?.range === "24h", `got ${rBad.json?.data?.range}`);
  }

  // 5. Metrics endpoint không tồn tại → 404
  console.log("\n[5] GET /metrics endpoint không tồn tại → 404");
  {
    const r = await req("GET", "/v1/endpoints/ep-khongtontai/metrics");
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  // 6. Metrics endpoint chưa có usage → totals rỗng (không crash)
  console.log("\n[6] GET /metrics endpoint mới (chưa invoke) → 200, requests=0");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2", mode: "container", commit: "on-demand",
    }});
    const newId = c.json?.data?.id;
    await waitRunning(newId);
    const r = await req("GET", `/v1/endpoints/${newId}/metrics?range=24h`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("requests=0", r.json?.data?.totals?.requests === 0, `got ${r.json?.data?.totals?.requests}`);
    check("error_rate=0", r.json?.data?.totals?.error_rate === 0, `got ${r.json?.data?.totals?.error_rate}`);
    check("series rỗng", Array.isArray(r.json?.data?.series) && r.json?.data?.series.length === 0, `got ${r.json?.data?.series?.length}`);
    await req("DELETE", `/v1/endpoints/${newId}`);
  }

  // cleanup
  await req("DELETE", `/v1/endpoints/${epId}`);

  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  if (fail > 0) {
    console.log("Cases thất bại:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });