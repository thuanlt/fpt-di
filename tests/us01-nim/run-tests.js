"use strict";

// US-01 — Deploy NVIDIA NIM 1-click
// Chạy: node tests/us01-nim/run-tests.js  (BASE=http://localhost:5173)

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

async function main() {
  console.log(`\n=== US-01 Deploy NVIDIA NIM 1-click — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key operator (scope endpoints)
  let opKey = null;
  {
    const o = await req("POST", "/v1/keys", { body: { name: "us01-op-" + Date.now(), scopes: ["endpoints"], role: "operator" } });
    opKey = o.json?.full_key;
    check("setup operator key", !!opKey, "—");
  }

  // 1. GET /v1/catalog — danh sách model NIM
  console.log("\n[1] GET /v1/catalog — list model NIM");
  {
    const r = await req("GET", "/v1/catalog");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("count>=3", (r.json?.count || 0) >= 3, `got ${r.json?.count}`);
    check("có DeepSeek-Coder-33B", (r.json?.data || []).some((m) => m.name === "DeepSeek-Coder-33B"), "—");
    check("có Llama-3.3-70B", (r.json?.data || []).some((m) => m.name === "Llama-3.3-70B"), "—");
    check("có Qwen-Coder-32B", (r.json?.data || []).some((m) => m.name === "Qwen-Coder-32B"), "—");
  }

  // 2. GET /v1/catalog?segment=coding → chỉ model coding
  console.log("\n[2] GET /v1/catalog?segment=coding → chỉ model coding");
  {
    const r = await req("GET", "/v1/catalog?segment=coding");
    check("status 200", r.status === 200, `got ${r.status}`);
    const all = r.json?.data || [];
    check("count>=1", all.length >= 1, `got ${all.length}`);
    check("mọi model đều có segment coding", all.every((m) => (m.segments || []).includes("coding")), JSON.stringify(all.map((m) => m.name)));
  }

  // 3. Deploy model NIM → endpoint running (chờ worker)
  console.log("\n[3] Deploy model NIM (engine=nim) → endpoint running");
  let nimId = null;
  {
    const nm = "us01-nim-" + Date.now();
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: nm, model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
      engine: "nim", segment: "coding", dataResidency: "VN",
    }});
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    check("engine=nim", r.json?.data?.engine === "nim", `got ${r.json?.data?.engine}`);
    check("segment=coding", r.json?.data?.segment === "coding", `got ${r.json?.data?.segment}`);
    check("dataResidency=VN", r.json?.data?.dataResidency === "VN", `got ${r.json?.data?.dataResidency}`);
    nimId = r.json?.data?.id;

    // chờ worker đưa về running (tối đa 15s)
    let status = r.json?.data?.status;
    const t0 = Date.now();
    while (status !== "running" && Date.now() - t0 < 15000) {
      await sleep(1000);
      const g = await req("GET", `/v1/endpoints/${nimId}`, { headers: { Authorization: `Bearer ${opKey}` } });
      status = g.json?.data?.status;
    }
    check("endpoint NIM running", status === "running", `hiện ${status}`);
  }

  // 4. Deploy không key → 401
  console.log("\n[4] Deploy không key → 401");
  {
    const r = await req("POST", "/v1/endpoints", { body: {
      name: "us01-noauth", model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", engine: "nim",
    }});
    check("status 401", r.status === 401, `got ${r.status}`);
  }

  // 5. Deploy thiếu scope → 403
  console.log("\n[5] Deploy thiếu scope → 403");
  {
    const bk = await req("POST", "/v1/keys", { body: { name: "us01-batch-" + Date.now(), scopes: ["batch"], role: "operator" } });
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${bk.json?.full_key}` }, body: {
      name: "us01-noscope", model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", engine: "nim",
    }});
    check("status 403", r.status === 403, `got ${r.status}`);
  }

  // 6. Deploy tên trùng → 409
  console.log("\n[6] Deploy tên trùng → 409");
  {
    const nm = "us01-dup-" + Date.now();
    const a = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: nm, model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", engine: "nim",
    }});
    check("tạo lần 1 201", a.status === 201, `got ${a.status}`);
    const b = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: nm, model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand", engine: "nim",
    }});
    check("tạo trùng → 409", b.status === 409, `got ${b.status}`);
  }

  // 7. Segment banking → dataResidency bắt buộc VN (khác → 400)
  console.log("\n[7] Segment banking + dataResidency!=VN → 400");
  {
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: "us01-bank-" + Date.now(), model: "DeepSeek-Coder-33B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
      engine: "nim", segment: "banking", dataResidency: "SG",
    }});
    check("status 400", r.status === 400, `got ${r.status} — ${r.body?.slice(0, 150)}`);
  }

  console.log(`\n=== US-01: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });