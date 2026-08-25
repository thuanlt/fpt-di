"use strict";

// US-09 — TensorRT-LLM: engine tối ưu + benchmark throughput ≥20% vs mặc định
// Chạy: node tests/us09-tensorrt/run-tests.js  (BASE=http://localhost:5173)

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

async function waitRunning(id, key, timeoutMs = 25000) {
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
  console.log(`\n=== US-09 TensorRT-LLM — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin
  let adminKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us09-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, `got ${a.status}`);
  }
  const H = { Authorization: `Bearer ${adminKey}` };

  // [1] Tạo endpoint engine=tensorrt-llm → running, events có bước build engine
  console.log("\n[1] Deploy engine=tensorrt-llm → running");
  let trtEp = null;
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us09-trt-" + Date.now(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "general", engine: "tensorrt-llm",
    }});
    check("tạo endpoint trt 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("engine=tensorrt-llm", r.json?.data?.engine === "tensorrt-llm", `got ${r.json?.data?.engine}`);
    trtEp = r.json?.data?.id;
    const st = await waitRunning(trtEp, adminKey);
    check("endpoint trt running", st === "running", `hiện ${st}`);

    const g = await req("GET", `/v1/endpoints/${trtEp}`, { headers: H });
    const events = g.json?.data?.events || [];
    const hasTrtMsg = events.some((e) => /tensorrt/i.test(e.msg || ""));
    check("events có bước TensorRT (build engine/cache)", hasTrtMsg, `events=${JSON.stringify(events.map((e) => e.msg))}`);
  }

  // [2] Metrics trt: engine + throughput improvement >= 20%
  console.log("\n[2] Metrics trt — engine + throughput improvement");
  let trtThroughput = null;
  {
    const r = await req("GET", `/v1/endpoints/${trtEp}/metrics`, { headers: H });
    check("metrics 200", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("data.engine = tensorrt-llm", r.json?.data?.engine === "tensorrt-llm", `got ${r.json?.data?.engine}`);
    const tp = r.json?.data?.throughput;
    check("throughput có tps/baseline_tps/improvement_pct", tp && Number.isFinite(tp.tps) && Number.isFinite(tp.baseline_tps) && Number.isFinite(tp.improvement_pct), `got ${JSON.stringify(tp)}`);
    if (tp) {
      trtThroughput = tp;
      check("tps > baseline_tps", tp.tps > tp.baseline_tps, `tps=${tp.tps} baseline=${tp.baseline_tps}`);
      check("improvement_pct >= 20", tp.improvement_pct >= 20, `got ${tp.improvement_pct}%`);
    }
    check("totals có p95 (monitoring latency)", r.json?.data?.totals && Number.isFinite(r.json.data.totals.p95), `got ${JSON.stringify(r.json?.data?.totals?.p95)}`);
  }

  // [3] Endpoint vllm (mặc định) cùng GPU → A/B benchmark
  console.log("\n[3] Endpoint vllm (baseline) — A/B benchmark");
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us09-vllm-" + Date.now(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "general", engine: "vllm",
    }});
    check("tạo endpoint vllm 201", r.status === 201, `got ${r.status}`);
    const vllmEp = r.json?.data?.id;
    const st = await waitRunning(vllmEp, adminKey);
    check("endpoint vllm running", st === "running", `hiện ${st}`);

    const m = await req("GET", `/v1/endpoints/${vllmEp}/metrics`, { headers: H });
    check("metrics vllm 200", m.status === 200, `got ${m.status}`);
    check("data.engine = vllm", m.json?.data?.engine === "vllm", `got ${m.json?.data?.engine}`);
    const tpV = m.json?.data?.throughput;
    check("vllm improvement_pct = 0 (baseline)", tpV && tpV.improvement_pct === 0, `got ${tpV?.improvement_pct}%`);

    if (trtThroughput && tpV) {
      const ab = (trtThroughput.tps - tpV.tps) / tpV.tps;
      check(`A/B: trt(${trtThroughput.tps}) vs vllm(${tpV.tps}) → cải thiện ${(ab * 100).toFixed(0)}% >= 20%`, ab >= 0.20, `ab=${(ab * 100).toFixed(1)}%`);
    }
  }

  console.log(`\n=== US-09: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });