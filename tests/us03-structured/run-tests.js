"use strict";

// US-03 — Structured output (response_format json_schema) + SLA securities p95 ≤500ms
// Chạy: node tests/us03-structured/run-tests.js  (BASE=http://localhost:5173)

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let pass = 0, fail = 0;
const results = [];

function req(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    let payload = null;
    const h = { ...headers };
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
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

async function waitRunning(id, key, timeoutMs = 20000) {
  const t0 = Date.now();
  let status = "queued";
  while (status !== "running" && Date.now() - t0 < timeoutMs) {
    await sleep(1000);
    const g = await req("GET", `/v1/endpoints/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    status = g.json?.data?.status;
  }
  return status;
}

// Schema giao dịch chứng khoán cho test
const TRADE_SCHEMA = {
  name: "trade_signal",
  schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      price: { type: "number" },
      direction: { type: "string", enum: ["buy", "sell"] },
    },
    required: ["symbol", "price"],
  },
};

async function main() {
  console.log(`\n=== US-03 Structured output — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin
  let adminKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us03-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, `got ${a.status}`);
  }
  const H = { Authorization: `Bearer ${adminKey}` };

  // Tạo endpoint securities (H200 SGN-1 — có gói giá seed)
  let ep = null;
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us03-sec-" + Date.now(), model: "Qwen 3.7 Plus", gpu: "H200", region: "SGN-1",
      mode: "k8s", commit: "on-demand", segment: "securities",
    }});
    check("tạo endpoint securities 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("segment=securities được chấp nhận", r.json?.data?.segment === "securities", `got ${r.json?.data?.segment}`);
    ep = r.json?.data?.id;
    const st = await waitRunning(ep, adminKey);
    check("endpoint running", st === "running", `hiện ${st}`);
  }

  // [1] response_format json_schema hợp lệ → output JSON đúng schema
  console.log("\n[1] response_format json_schema → output đúng schema");
  {
    const r = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus",
      messages: [{ role: "user", content: "Phân tích cổ phiếu VNM" }],
      response_format: { type: "json_schema", json_schema: TRADE_SCHEMA },
    }});
    check("invoke 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    const content = r.json?.choices?.[0]?.message?.content;
    check("content là string", typeof content === "string", `got ${typeof content}`);
    let parsed = null;
    try { parsed = JSON.parse(content); } catch (_) {}
    check("content parse được JSON", parsed !== null, `content=${String(content).slice(0, 120)}`);
    if (parsed) {
      check("symbol là string", typeof parsed.symbol === "string", `got ${typeof parsed.symbol}`);
      check("price là number", typeof parsed.price === "number", `got ${typeof parsed.price}`);
      check("direction thuộc enum [buy,sell]", ["buy", "sell"].includes(parsed.direction), `got ${parsed.direction}`);
    }
  }

  // [2] response_format json_object → output JSON hợp lệ
  console.log("\n[2] response_format json_object → JSON");
  {
    const r = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus",
      messages: [{ role: "user", content: "hello" }],
      response_format: { type: "json_object" },
    }});
    check("invoke 200", r.status === 200, `got ${r.status}`);
    const content = r.json?.choices?.[0]?.message?.content;
    let parsed = null;
    try { parsed = JSON.parse(content); } catch (_) {}
    check("content là JSON object", parsed !== null && typeof parsed === "object", `content=${String(content).slice(0, 100)}`);
  }

  // [3] Schema không hợp lệ → 400
  console.log("\n[3] Schema không hợp lệ → 400");
  {
    // a) json_schema thiếu schema
    const a = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus", messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_schema", json_schema: { name: "x" } },
    }});
    check("thiếu schema → 400", a.status === 400, `got ${a.status}`);
    // b) schema thiếu type
    const b = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus", messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_schema", json_schema: { name: "x", schema: {} } },
    }});
    check("schema thiếu type → 400", b.status === 400, `got ${b.status}`);
    // c) type sai
    const c = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus", messages: [{ role: "user", content: "x" }],
      response_format: { type: "bogus" },
    }});
    check("type sai → 400", c.status === 400, `got ${c.status}`);
    // d) response_format không phải object
    const d = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus", messages: [{ role: "user", content: "x" }],
      response_format: "string",
    }});
    check("response_format string → 400", d.status === 400, `got ${d.status}`);
  }

  // [4] Không response_format → hoạt động như thường (text)
  console.log("\n[4] Không response_format → text thường");
  {
    const r = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Qwen 3.7 Plus", messages: [{ role: "user", content: "hello plain" }],
    }});
    check("invoke 200", r.status === 200, `got ${r.status}`);
    check("có content", typeof r.json?.choices?.[0]?.message?.content === "string", "—");
  }

  // [5] SLA securities: p95 latency ≤ 500ms (10 request)
  console.log("\n[5] SLA securities — p95 ≤ 500ms");
  {
    const latencies = [];
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      const r = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
        model: "Qwen 3.7 Plus",
        messages: [{ role: "user", content: "latency check " + i }],
        response_format: { type: "json_schema", json_schema: TRADE_SCHEMA },
      }});
      if (r.status === 200) latencies.push(Date.now() - t0);
    }
    check("có >= 5 mẫu latency", latencies.length >= 5, `got ${latencies.length}`);
    if (latencies.length) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
      check(`p95 = ${p95}ms ≤ 500ms`, p95 <= 500, `p95=${p95}ms`);
    }
  }

  console.log(`\n=== US-03: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });