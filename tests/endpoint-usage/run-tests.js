"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let pass = 0, fail = 0;
const results = [];
let AUTH_KEY = null;

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
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
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
function nm() { return "uat-inv-" + Math.random().toString(36).slice(2, 8); }

async function main() {
  console.log(`\n=== FPT DDI Endpoint Usage — e2e test (invoke thật + usage thật) ===`);
  console.log(`base=${BASE}\n`);

  // 0. Setup key
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-usage-" + Date.now(), scopes: ["endpoints", "chat"], role: "operator" } });
    AUTH_KEY = r.json?.full_key;
    if (!AUTH_KEY) { console.error("Không tạo được key"); process.exit(2); }
    console.log(`[setup] key tạo xong\n`);
  }

  // 1. Tạo endpoint + đợi tới running
  console.log("[1] Tạo endpoint + đợi running");
  let epId = null;
  {
    const r = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    check("tạo endpoint 201", r.status === 201, `got ${r.status}`);
    epId = r.json?.data?.id;
    check("có endpoint id", typeof epId === "string", "—");
    let st = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const d = await req("GET", `/v1/endpoints/${epId}`);
      st = d.json?.data?.status;
      if (st === "running") break;
      await sleep(1000);
    }
    check("endpoint running", st === "running", `hiện ${st}`);
  }

  // 2. Invoke endpoint — response đầy đủ
  console.log("\n[2] POST /v1/endpoints/:id/chat/completions");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      messages: [{ role: "user", content: "Hello endpoint usage test" }],
    }});
    check("status 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("model khớp endpoint", r.json?.model === "GLM-5.2", `got ${r.json?.model}`);
    check("có endpoint.id", r.json?.endpoint?.id === epId, "—");
    const invContent = r.json?.choices?.[0]?.message?.content || "";
    check("content có 'vllm-adapter' (proxy qua inference server)", invContent.includes("vllm-adapter"), invContent.slice(0, 100));
    check("usage.prompt_tokens > 0", (r.json?.usage?.prompt_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(r.json?.cost_usd || "0") > 0, "—");
    check("latency_ms là số", typeof r.json?.latency_ms === "number", "—");
  }

  // 3. Invoke stream
  console.log("\n[3] Invoke với stream=true");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      messages: [{ role: "user", content: "stream test" }], stream: true,
    }});
    check("status 200", r.status === 200, `got ${r.status}`);
    check("Content-Type SSE", (r.headers["content-type"] || "").includes("text/event-stream"), "—");
    check("body có [DONE]", (r.body || "").includes("[DONE]"), "—");
  }

  // 4. Invoke 3 lần nữa để usage tăng
  console.log("\n[4] Invoke thêm 3 lần để usage tăng");
  for (let i = 0; i < 3; i++) {
    await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: { messages: [{ role: "user", content: "call " + i }] } });
  }

  // 5. GET usage — verify tổng
  console.log("\n[5] GET /v1/endpoints/:id/usage — verify usage thật");
  {
    const r = await req("GET", `/v1/endpoints/${epId}/usage`);
    check("status 200", r.status === 200, `got ${r.status}`);
    const u = r.json?.data?.totals || {};
    check("requests = 5 (1 + 1 stream + 3)", u.requests === 5, `got ${u.requests}`);
    check("total_tokens > 0", (u.total_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(u.cost_usd || "0") > 0, "—");
    check("avg_latency_ms là số", typeof u.avg_latency_ms === "number", "—");
    const recent = r.json?.data?.recent || [];
    check("recent có ≤20 entry", recent.length <= 20 && recent.length >= 1, `got ${recent.length}`);
    check("recent entry có model", recent[0]?.model === "GLM-5.2", "—");
    check("recent entry có created_at", !!recent[0]?.created_at, "—");
  }

  // 6. Invoke endpoint không tồn tại → 404
  console.log("\n[6] Invoke endpoint không tồn tại → 404");
  {
    const r = await req("POST", "/v1/endpoints/ep-khongtontai/chat/completions", { body: { messages: [{ role: "user", content: "x" }] } });
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  // 7. Invoke endpoint stopped → 409
  console.log("\n[7] Invoke endpoint stopped → 409");
  {
    // tạo endpoint mới rồi stop ngay khi running
    const c = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2", mode: "container", commit: "on-demand",
    }});
    const newId = c.json?.data?.id;
    let st = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const d = await req("GET", `/v1/endpoints/${newId}`);
      st = d.json?.data?.status;
      if (st === "running") break;
      await sleep(1000);
    }
    check("endpoint phụ chạy tới running", st === "running", `hiện ${st}`);
    await req("POST", `/v1/endpoints/${newId}/stop`);
    const r = await req("POST", `/v1/endpoints/${newId}/chat/completions`, { body: { messages: [{ role: "user", content: "x" }] } });
    check("status 409 (stopped)", r.status === 409, `got ${r.status}`);
    check("error message có 'running'", (r.json?.error?.message || "").includes("running"), "—");
  }

  // 8. Usage endpoint không tồn tại → 404
  console.log("\n[8] GET usage endpoint không tồn tại → 404");
  {
    const r = await req("GET", "/v1/endpoints/ep-khongtontai/usage");
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  // 9. Thiếu messages → 400
  console.log("\n[9] Invoke thiếu messages → 400");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {} });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  if (fail > 0) {
    console.log("Cases thất bại:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
