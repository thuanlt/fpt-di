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
function nm() { return "uat-vllm-" + Math.random().toString(36).slice(2, 8); }

async function main() {
  console.log(`\n=== FPT DDI Endpoint ↔ vLLM proxy — e2e test (Sprint 1) ===`);
  console.log(`base=${BASE}\n`);

  // 0. Setup key
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-vllm-" + Date.now(), scopes: ["endpoints", "chat"], role: "operator" } });
    AUTH_KEY = r.json?.full_key;
    if (!AUTH_KEY) { console.error("Không tạo được key"); process.exit(2); }
    console.log(`[setup] key tạo xong\n`);
  }

  // 1. Inference server sống + model list
  console.log("[1] GET /v1/endpoints/:id/health — inference server sẵn sàng");
  let epId = null;
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: nm(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2", mode: "container", commit: "on-demand",
    }});
    epId = c.json?.data?.id;
    let st = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const d = await req("GET", `/v1/endpoints/${epId}`);
      st = d.json?.data?.status;
      if (st === "running") break;
      await sleep(1000);
    }
    check("endpoint chạy tới running", st === "running", `hiện ${st}`);

    const r = await req("GET", `/v1/endpoints/${epId}/health`);
    check("health status 200", r.status === 200, `got ${r.status}`);
    check("inference.configured=true", r.json?.data?.inference?.configured === true, JSON.stringify(r.json?.data?.inference));
    check("inference.healthy=true", r.json?.data?.inference?.healthy === true, "—");
    check("ready=true (running + healthy)", r.json?.data?.ready === true, "—");
  }

  // 2. Invoke không stream — proxy qua vLLM thật
  console.log("\n[2] Invoke qua proxy vLLM (không stream)");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      messages: [{ role: "user", content: "Test proxy sang vLLM thật" }],
    }});
    check("status 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    const content = r.json?.choices?.[0]?.message?.content || "";
    check("content có 'vllm-adapter' (từ inference server)", content.includes("vllm-adapter"), content.slice(0, 100));
    check("content có 'gen=' (sinh mỗi lần khác nhau)", content.includes("gen="), "—");
    check("content có 'temp=' (truyền temperature)", content.includes("temp="), "—");
    check("model khớp", r.json?.model === "PhoGPT-4B", `got ${r.json?.model}`);
    check("usage.total_tokens > 0", (r.json?.usage?.total_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(r.json?.cost_usd || "0") > 0, "—");
    check("latency_ms là số", typeof r.json?.latency_ms === "number", "—");
  }

  // 3. Generation không cố định — 2 call khác kết quả (như model thật)
  console.log("\n[3] Non-deterministic — 2 call cùng prompt ra output khác nhau");
  {
    const r1 = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: { messages: [{ role: "user", content: "same prompt" }] } });
    await sleep(50); // đảm bảo timestamp noise khác
    const r2 = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: { messages: [{ role: "user", content: "same prompt" }] } });
    const c1 = r1.json?.choices?.[0]?.message?.content || "";
    const c2 = r2.json?.choices?.[0]?.message?.content || "";
    check("2 call ra output khác nhau (gen= khác)", c1 !== c2, "giống nhau — vẫn deterministic");
  }

  // 4. Stream passthrough
  console.log("\n[4] Invoke stream=true — passthrough SSE từ vLLM");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      messages: [{ role: "user", content: "stream qua proxy" }], stream: true,
    }});
    check("status 200", r.status === 200, `got ${r.status}`);
    check("Content-Type SSE", (r.headers["content-type"] || "").includes("text/event-stream"), "—");
    check("header X-Endpoint-Id", r.headers["x-endpoint-id"] === epId, `got ${r.headers["x-endpoint-id"]}`);
    const body = r.body || "";
    check("body có 'data: '", body.includes("data: "), "—");
    check("body có [DONE]", body.includes("[DONE]"), "—");
    let streamed = "";
    for (const line of body.split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj.choices?.[0]?.delta?.content) streamed += obj.choices[0].delta.content;
      } catch (_) {}
    }
    check("streamed content có 'vllm-adapter'", streamed.includes("vllm-adapter"), streamed.slice(0, 100));
    check("streamed content có 'gen='", streamed.includes("gen="), "—");
  }

  // 5. Usage ghi đúng cả stream
  console.log("\n[5] Usage sau 3 call (2 thường + 1 stream)");
  {
    const r = await req("GET", `/v1/endpoints/${epId}/usage`);
    const u = r.json?.data?.totals || {};
    check("requests = 4 (1 health-test + 2 + 1 stream)", u.requests === 4, `got ${u.requests}`);
    check("total_tokens > 0", (u.total_tokens || 0) > 0, "—");
    check("cost_usd > 0", parseFloat(u.cost_usd || "0") > 0, "—");
  }

  // 6. Model không có trên inference server → 404 từ upstream
  console.log("\n[6] Invoke model không tồn tại trên vLLM → lỗi upstream truyền qua");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: {
      model: "model-khong-co", messages: [{ role: "user", content: "x" }],
    }});
    check("status 404 (từ upstream)", r.status === 404, `got ${r.status}`);
    check("error message có 'model'", (r.json?.error?.message || "").includes("model"), "—");
  }

  // 7. Invoke endpoint stopped → 409
  console.log("\n[7] Invoke endpoint stopped → 409");
  {
    await req("POST", `/v1/endpoints/${epId}/stop`);
    const r = await req("POST", `/v1/endpoints/${epId}/chat/completions`, { body: { messages: [{ role: "user", content: "x" }] } });
    check("status 409", r.status === 409, `got ${r.status}`);
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
