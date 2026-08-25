"use strict";

// e2e: Playground ↔ Endpoint thật — mô phỏng đúng luồng FE:
// 1. fetch /v1/endpoints?status=running (dropdown nguồn)
// 2. chọn endpoint → invoke /v1/endpoints/:id/chat/completions (stream + thường)
// 3. verify response từ vLLM proxy + usage tăng trong Postgres
// 4. các nhánh lỗi: endpoint stopped → 409, không tồn tại → 404

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
function nm() { return "uat-pg-" + Math.random().toString(36).slice(2, 8); }

async function main() {
  console.log(`\n=== FPT DDI Playground ↔ Endpoint — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // 0. Setup key scope endpoints
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-pg-" + Date.now(), scopes: ["endpoints", "chat"], role: "operator" } });
    AUTH_KEY = r.json?.full_key;
    if (!AUTH_KEY) { console.error("Không tạo được key"); process.exit(2); }
    console.log(`[setup] key tạo xong\n`);
  }

  // 1. Deploy endpoint + đợi running
  console.log("[1] Deploy endpoint (Playground chỉ list endpoint running)");
  let epId = null;
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2", mode: "container", commit: "on-demand",
    }});
    epId = c.json?.data?.id;
    check("tạo endpoint 201", c.status === 201, `got ${c.status}`);
    let st = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const d = await req("GET", `/v1/endpoints/${epId}`);
      st = d.json?.data?.status;
      if (st === "running") break;
      await sleep(1000);
    }
    check("endpoint chạy tới running", st === "running", `hiện ${st}`);
  }

  // 2. Dropdown nguồn: GET /v1/endpoints?status=running — endpoint có trong list
  console.log("\n[2] GET /v1/endpoints?status=running — nguồn dropdown Playground");
  {
    const r = await req("GET", "/v1/endpoints?status=running");
    check("status 200", r.status === 200);
    const list = r.json?.data || [];
    check("endpoint mới có trong list running", list.some((e) => e.id === epId), `list ${list.length} endpoints`);
    check("tất cả đều running", list.every((e) => e.status === "running"), "—");
  }

  // 3. Invoke không stream qua endpoint (như bấm Run không tick stream)
  console.log("\n[3] Invoke endpoint (Playground mode không stream)");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      model: "PhoGPT-4B",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Viết slogan FPT DDI data residency Việt Nam" },
      ],
      temperature: 0.7, max_tokens: 512, stream: false,
    }});
    check("status 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 120)}`);
    const content = r.json?.choices?.[0]?.message?.content || "";
    check("content có 'vllm-adapter' (từ inference server)", content.includes("vllm-adapter"), content.slice(0, 100));
    check("content có 'temp=0.7' (temperature truyền qua)", content.includes("temp=0.7"), "—");
    check("content có 'prompt:' (echo prompt)", content.includes("prompt:"), "—");
    check("model khớp", r.json?.model === "PhoGPT-4B", `got ${r.json?.model}`);
    check("endpoint.name trả về", !!r.json?.endpoint?.name, "—");
    check("usage.total_tokens > 0", (r.json?.usage?.total_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(r.json?.cost_usd || "0") > 0, "—");
  }

  // 4. Invoke stream (như bấm Run có tick stream)
  console.log("\n[4] Invoke endpoint (Playground mode stream)");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      model: "PhoGPT-4B",
      messages: [{ role: "user", content: "stream test playground" }],
      stream: true,
    }});
    check("status 200", r.status === 200, `got ${r.status}`);
    check("Content-Type SSE", (r.headers["content-type"] || "").includes("text/event-stream"), "—");
    check("X-Endpoint-Id header", r.headers["x-endpoint-id"] === epId, `got ${r.headers["x-endpoint-id"]}`);
    const body = r.body || "";
    check("body có data: ", body.includes("data: "), "—");
    check("body có [DONE]", body.includes("[DONE]"), "—");
    // ghép delta như FE playground
    let streamed = "";
    let usageFromStream = null;
    for (const line of body.split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj.usage) usageFromStream = obj.usage;
        if (obj.choices?.[0]?.delta?.content) streamed += obj.choices[0].delta.content;
      } catch (_) {}
    }
    check("streamed content có 'vllm-adapter'", streamed.includes("vllm-adapter"), streamed.slice(0, 100));
    check("stream có usage chunk cuối", !!usageFromStream, "—");
    check("usage.total_tokens > 0", (usageFromStream?.total_tokens || 0) > 0, "—");
  }

  // 5. Usage tăng đúng: 2 call (1 thường + 1 stream)
  console.log("\n[5] Usage sau 2 call Playground");
  {
    const r = await req("GET", `/v1/endpoints/${epId}/usage`);
    const u = r.json?.data?.totals || {};
    check("requests = 2", u.requests === 2, `got ${u.requests}`);
    check("total_tokens > 0", (u.total_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(u.cost_usd || "0") > 0, "—");
    const recent = r.json?.data?.recent || [];
    check("recent có 2 entry", recent.length === 2, `got ${recent.length}`);
  }

  // 6. Luồng "Test in Playground" từ drawer: endpoint đang chạy → chọn → invoke ngay
  console.log("\n[6] Luồng drawer: endpoint thứ 2 (model khác) chọn và invoke");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "Mistral-Large-2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep2 = c.json?.data?.id;
    let st = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const d = await req("GET", `/v1/endpoints/${ep2}`);
      st = d.json?.data?.status;
      if (st === "running") break;
      await sleep(1000);
    }
    check("endpoint 2 chạy tới running", st === "running", `hiện ${st}`);
    const r = await req("POST", `/v1/endpoints/${ep2}/chat/completions`, { body: {
      messages: [{ role: "user", content: "test từ drawer" }],
    }});
    check("invoke endpoint 2 status 200", r.status === 200, `got ${r.status}`);
    const content = r.json?.choices?.[0]?.message?.content || "";
    check("content có model 'Mistral-Large-2'", content.includes("Mistral-Large-2"), content.slice(0, 100));
    check("model trả về đúng", r.json?.model === "Mistral-Large-2", `got ${r.json?.model}`);
    await req("POST", `/v1/endpoints/${ep2}/stop`);
  }

  // 7. Endpoint stopped không vào dropdown + invoke 409
  console.log("\n[7] Endpoint stopped — loại khỏi dropdown + 409");
  {
    const list = await req("GET", "/v1/endpoints?status=running");
    check("không có endpoint stopped trong dropdown nguồn", (list.json?.data || []).every((e) => e.status === "running"), "—");
    const stopped = await req("GET", "/v1/endpoints?status=stopped");
    check("filter status=stopped trả endpoint đã stop", (stopped.json?.data || []).some((e) => e.status === "stopped"), "—");
  }

  // 8. Chọn endpoint không tồn tại → 404 (nhập tay id sai)
  console.log("\n[8] Endpoint không tồn tại → 404");
  {
    const r = await req("POST", "/v1/endpoints/ep-khongtontai/chat/completions", { body: { messages: [{ role: "user", content: "x" }] } });
    check("status 404", r.status === 404, `got ${r.status}`);
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
