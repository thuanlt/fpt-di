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
function name() { return "ep-p0-" + Math.random().toString(36).slice(2, 8); }

async function waitForRunning(epId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await req("GET", `/v1/endpoints/${epId}`);
    if (r.json?.data?.status === "running") return r.json.data;
    await sleep(800);
  }
  return null;
}

async function makeKey() {
  const unique = "e2e-p0-" + Date.now();
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
  console.log(`\n=== FPT DDI P0 — SLO Autoscaling + Context Length (post-deploy config) ===`);
  console.log(`base=${BASE}\n`);

  authKey = await makeKey();

  // ───────── Case 1: Tạo endpoint với scaling metric/target + context length ─────────
  console.log("[Case 1] Tạo endpoint k8s với scalingMetric=gpu_util, target=75, maxModelLen=16384");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 3,
      scalingMetric: "gpu_util", scalingTarget: 75, maxModelLen: 16384,
    }});
    check("tạo endpoint → 201", c.status === 201, `got ${c.status}`);
    const ep = c.json?.data;
    if (!ep) { console.log("Bỏ qua case 1 — endpoint không tạo được"); return; }
    check("scalingMetric=gpu_util", ep.scalingMetric === "gpu_util", `got ${ep.scalingMetric}`);
    check("scalingTarget=75", ep.scalingTarget === 75, `got ${ep.scalingTarget}`);
    check("maxModelLen=16384", ep.maxModelLen === 16384, `got ${ep.maxModelLen}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 2: Mặc định khi không truyền ─────────
  console.log("\n[Case 2] Mặc định — không truyền scaling/context → inflight + target 2000 + maxModelLen null");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    check("scalingMetric mặc định = inflight", ep.scalingMetric === "inflight", `got ${ep.scalingMetric}`);
    check("scalingTarget mặc định = 2000", ep.scalingTarget === 2000, `got ${ep.scalingTarget}`);
    check("maxModelLen mặc định = null", ep.maxModelLen === null, `got ${ep.maxModelLen}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 3: Validation — scalingMetric không hợp lệ ─────────
  console.log("\n[Case 3] Validation — scalingMetric sai → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      scalingMetric: "cpu_util",
    }});
    check("scalingMetric=cpu_util → 400", c.status === 400, `got ${c.status}`);
    check("error chứa 'scalingMetric'", /scalingMetric/.test(c.json?.error || ""), `err="${c.json?.error}"`);
  }

  // ───────── Case 4: Config update sau deploy (hot-update) ─────────
  console.log("\n[Case 4] PUT /config sau khi running — đổi scaling metric/target + context length");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 3,
      scalingMetric: "inflight", scalingTarget: 2000,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const running = await waitForRunning(ep.id);
    check("endpoint đạt running", !!running, "—");
    if (!running) return;

    const cfg = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: {
      scalingMetric: "e2e_latency", scalingTarget: 550, maxModelLen: 65536,
    }});
    check("config → 200", cfg.status === 200, `got ${cfg.status} — ${cfg.body?.slice(0, 200)}`);
    check("scalingMetric=e2e_latency", cfg.json?.data?.scalingMetric === "e2e_latency", `got ${cfg.json?.data?.scalingMetric}`);
    check("scalingTarget=550", cfg.json?.data?.scalingTarget === 550, `got ${cfg.json?.data?.scalingTarget}`);
    check("maxModelLen=65536", cfg.json?.data?.maxModelLen === 65536, `got ${cfg.json?.data?.maxModelLen}`);
    const ev = cfg.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event ghi 'config:'", /config:/.test(ev), `msg="${ev}"`);

    // đọc lại qua GET để xác nhận persist
    const g = await req("GET", `/v1/endpoints/${ep.id}`);
    check("persist qua GET: e2e_latency/550/65536",
      g.json?.data?.scalingMetric === "e2e_latency" && g.json?.data?.scalingTarget === 550 && g.json?.data?.maxModelLen === 65536,
      `got ${g.json?.data?.scalingMetric}/${g.json?.data?.scalingTarget}/${g.json?.data?.maxModelLen}`);

    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 5: Config reset context length về null ─────────
  console.log("\n[Case 5] Config — maxModelLen=null (reset về model default)");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      maxModelLen: 32768,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const running = await waitForRunning(ep.id);
    if (!running) return;
    const cfg = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: { maxModelLen: null } });
    check("reset maxModelLen → null", cfg.json?.data?.maxModelLen === null, `got ${cfg.json?.data?.maxModelLen}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 6: Config validation — scalingTarget không hợp lệ ─────────
  console.log("\n[Case 6] Config — scalingTarget<=0 → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const cfg = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: { scalingTarget: 0 } });
    check("scalingTarget=0 → 400", cfg.status === 400, `got ${cfg.status}`);
    check("error chứa 'scalingTarget'", /scalingTarget/.test(cfg.json?.error || ""), `err="${cfg.json?.error}"`);
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