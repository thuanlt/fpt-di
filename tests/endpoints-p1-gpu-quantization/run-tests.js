"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let authKey = null;
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
    if (authKey && !h.Authorization) h.Authorization = `Bearer ${authKey}`;
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
function name() { return "ep-p1-" + Math.random().toString(36).slice(2, 8); }

async function waitForStatus(epId, want, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await req("GET", `/v1/endpoints/${epId}`);
    if (r.json?.data?.status === want) return r.json.data;
    await sleep(800);
  }
  return null;
}

async function makeKey() {
  const unique = "e2e-p1-" + Date.now();
  const r = await req("POST", "/v1/keys", { body: { name: unique, scopes: ["endpoints"], role: "operator" } });
  if (r.status === 201 && r.json?.full_key) {
    console.log(`[setup] key ${unique} tạo xong\n`);
    return r.json.full_key;
  }
  const lst = await req("GET", "/v1/keys");
  const found = (lst.json?.data || []).find((k) => k.status === "active" && (k.scopes || []).includes("endpoints"));
  if (found) {
    const rr = await req("POST", `/v1/keys/${found.id}/rotate`);
    console.log(`[setup] reuse + rotate key ${found.id}\n`);
    return rr.json?.full_key;
  }
  console.error("Không tạo được key test và không tìm key cũ để rotate");
  process.exit(2);
}

async function main() {
  console.log(`\n=== FPT DDI P1 — GPU Count (tensor parallel) + Quantization (immutable/redeploy) ===`);
  console.log(`base=${BASE}\n`);

  authKey = await makeKey();

  // ───────── Case 1: Tạo endpoint với gpuCount + quantization ─────────
  console.log("[Case 1] Tạo endpoint k8s với gpuCount=4, quantization=fp8");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      gpuCount: 4, quantization: "fp8",
    }});
    check("tạo endpoint → 201", c.status === 201, `got ${c.status}`);
    const ep = c.json?.data;
    if (!ep) { console.log("Bỏ qua case 1 — endpoint không tạo được"); return; }
    check("gpuCount=4", ep.gpuCount === 4, `got ${ep.gpuCount}`);
    check("quantization=fp8", ep.quantization === "fp8", `got ${ep.quantization}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 2: Mặc định khi không truyền ─────────
  console.log("\n[Case 2] Mặc định — gpuCount=1, quantization=bf16");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    check("gpuCount mặc định = 1", ep.gpuCount === 1, `got ${ep.gpuCount}`);
    check("quantization mặc định = bf16", ep.quantization === "bf16", `got ${ep.quantization}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 3: Validation — gpuCount/quantization sai ─────────
  console.log("\n[Case 3] Validation — gpuCount=3, quantization=int4 → 400");
  {
    const c1 = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      gpuCount: 3,
    }});
    check("gpuCount=3 → 400", c1.status === 400, `got ${c1.status}`);
    check("error chứa 'gpuCount'", /gpuCount/.test(c1.json?.error || ""), `err="${c1.json?.error}"`);

    const c2 = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      quantization: "int4",
    }});
    check("quantization=int4 → 400", c2.status === 400, `got ${c2.status}`);
    check("error chứa 'quantization'", /quantization/.test(c2.json?.error || ""), `err="${c2.json?.error}"`);
  }

  // ───────── Case 4: Redeploy config — đổi gpuCount/quantization khi running → deploying → running ─────────
  console.log("\n[Case 4] PUT /redeploy-config sau khi running — đổi gpuCount 1→2, quantization bf16→awq");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 3,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const running = await waitForStatus(ep.id, "running");
    check("endpoint đạt running", !!running, "—");
    if (!running) return;

    const rd = await req("PUT", `/v1/endpoints/${ep.id}/redeploy-config`, { body: {
      gpuCount: 2, quantization: "awq",
    }});
    check("redeploy-config → 200", rd.status === 200, `got ${rd.status} — ${rd.body?.slice(0, 200)}`);
    check("gpuCount=2", rd.json?.data?.gpuCount === 2, `got ${rd.json?.data?.gpuCount}`);
    check("quantization=awq", rd.json?.data?.quantization === "awq", `got ${rd.json?.data?.quantization}`);
    check("status về deploying (immutable → redeploy)", rd.json?.data?.status === "deploying", `got ${rd.json?.data?.status}`);
    const ev = rd.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event ghi 'redeploy:'", /redeploy:/.test(ev), `msg="${ev}"`);

    // worker đẩy lên lại running
    const runningAgain = await waitForStatus(ep.id, "running");
    check("endpoint tự quay lại running", !!runningAgain, "—");
    check("persist qua GET: gpuCount=2/awq",
      runningAgain?.gpuCount === 2 && runningAgain?.quantization === "awq",
      `got ${runningAgain?.gpuCount}/${runningAgain?.quantization}`);

    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 5: Redeploy config — chỉ đổi quantization ─────────
  console.log("\n[Case 5] Redeploy config — chỉ đổi quantization bf16→fp8, giữ gpuCount");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      gpuCount: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    await waitForStatus(ep.id, "running");
    const rd = await req("PUT", `/v1/endpoints/${ep.id}/redeploy-config`, { body: { quantization: "fp8" } });
    check("redeploy-config → 200", rd.status === 200, `got ${rd.status}`);
    check("quantization=fp8", rd.json?.data?.quantization === "fp8", `got ${rd.json?.data?.quantization}`);
    check("gpuCount giữ nguyên = 2", rd.json?.data?.gpuCount === 2, `got ${rd.json?.data?.gpuCount}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 6: Redeploy config validation ─────────
  console.log("\n[Case 6] Redeploy config — gpuCount=5 → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const rd = await req("PUT", `/v1/endpoints/${ep.id}/redeploy-config`, { body: { gpuCount: 5 } });
    check("gpuCount=5 → 400", rd.status === 400, `got ${rd.status}`);
    check("error chứa 'gpuCount'", /gpuCount/.test(rd.json?.error || ""), `err="${rd.json?.error}"`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
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