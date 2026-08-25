"use strict";

// US-07 — Dashboard KPI theo phân khúc
// Chạy: node tests/us07-dashboard/run-tests.js  (BASE=http://localhost:5173)

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
        resolve({ status: res.statusCode, body: buf, json, headers: res.headers });
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

async function main() {
  console.log(`\n=== US-07 Dashboard KPI — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin
  let adminKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us07-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, `got ${a.status}`);
  }
  const H = { Authorization: `Bearer ${adminKey}` };

  // Tạo endpoint banking (guardrails banking) + invoke để có data
  let ep = null;
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us07-banking-" + Date.now(), model: "Llama-3.3-70B", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "banking",
      guardrailsEnabled: true, guardrailsTemplate: "banking",
    }});
    check("tạo endpoint banking 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    ep = r.json?.data?.id;
    const st = await waitRunning(ep, adminKey);
    check("endpoint running", st === "running", `hiện ${st}`);
  }

  // Invoke 3 request hợp lệ (200)
  console.log("\n[1] Invoke 3 request hợp lệ");
  {
    let ok = 0;
    for (let i = 0; i < 3; i++) {
      const inv = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
        model: "Llama-3.3-70B", messages: [{ role: "user", content: "hello banking " + i }],
      }});
      if (inv.status === 200) ok++;
    }
    check("3 invoke 200", ok === 3, `ok=${ok}`);
  }

  // Invoke 1 request chứa PII (CCCD) → bị guardrail chặn
  console.log("\n[2] Invoke request PII → guardrail chặn");
  {
    const inv = await req("POST", `/v1/endpoints/${ep}/chat/completions`, { headers: H, body: {
      model: "Llama-3.3-70B", messages: [{ role: "user", content: "CCCD của tôi là 123456789" }],
    }});
    check("invoke PII 200 (trả về blocked)", inv.status === 200, `got ${inv.status}`);
    check("guardrail.blocked=true", inv.json?.guardrail?.blocked === true, `got ${JSON.stringify(inv.json?.guardrail)}`);
  }

  // [3] GET /v1/dashboard?segment=banking&range=24h
  console.log("\n[3] GET /v1/dashboard?segment=banking&range=24h");
  {
    const r = await req("GET", "/v1/dashboard?segment=banking&range=24h", { headers: H });
    check("GET 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    const k = r.json?.kpis;
    check("kpis.requests >= 3", k && k.requests >= 3, `got ${k?.requests}`);
    check("kpis.cost_usd > 0", k && parseFloat(k.cost_usd) > 0, `got ${k?.cost_usd}`);
    check("kpis.p95_latency_ms là số >= 0", k && Number.isFinite(k.p95_latency_ms) && k.p95_latency_ms >= 0, `got ${k?.p95_latency_ms}`);
    check("kpis.error_rate là số >= 0", k && Number.isFinite(k.error_rate) && k.error_rate >= 0, `got ${k?.error_rate}`);
    check("kpis.guardrail_blocks >= 1", k && k.guardrail_blocks >= 1, `got ${k?.guardrail_blocks}`);
    check("guardrail_by_rule có rule", Array.isArray(r.json?.guardrail_by_rule) && r.json.guardrail_by_rule.length >= 1, `got ${JSON.stringify(r.json?.guardrail_by_rule)}`);
    check("series là array", Array.isArray(r.json?.series), "—");
    check("segment echo = banking", r.json?.segment === "banking", `got ${r.json?.segment}`);
  }

  // [4] GET format=csv
  console.log("\n[4] GET /v1/dashboard?format=csv");
  {
    const r = await req("GET", "/v1/dashboard?segment=banking&range=24h&format=csv", { headers: H });
    check("CSV 200", r.status === 200, `got ${r.status}`);
    const ct = r.headers["content-type"] || "";
    check("content-type text/csv", ct.includes("text/csv"), `got ${ct}`);
    check("có header series", r.body?.includes("ts,requests,cost_usd,p95_latency_ms"), `body=${r.body?.slice(0, 120)}`);
    check("có dòng kpis", r.body?.includes("kpis:"), "—");
  }

  // [5] range 7d + 30d
  console.log("\n[5] range 7d / 30d");
  {
    const r7 = await req("GET", "/v1/dashboard?range=7d", { headers: H });
    check("range=7d 200", r7.status === 200, `got ${r7.status}`);
    check("range echo 7d", r7.json?.range === "7d", `got ${r7.json?.range}`);
    const r30 = await req("GET", "/v1/dashboard?range=30d", { headers: H });
    check("range=30d 200", r30.status === 200, `got ${r30.status}`);
  }

  // [6] segment khác (coding) — 200, kpis hợp lệ (có thể 0 request)
  console.log("\n[6] segment=coding — 200, kpis hợp lệ");
  {
    const r = await req("GET", "/v1/dashboard?segment=coding&range=24h", { headers: H });
    check("GET 200", r.status === 200, `got ${r.status}`);
    check("kpis.requests là số", r.json?.kpis && Number.isFinite(r.json.kpis.requests), `got ${JSON.stringify(r.json?.kpis)}`);
  }

  // [7] Không có key → 401
  console.log("\n[7] Không key → 401");
  {
    const r = await req("GET", "/v1/dashboard?range=24h", {});
    check("không key → 401", r.status === 401, `got ${r.status}`);
  }

  console.log(`\n=== US-07: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });