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
function name() { return "ep-p2-" + Math.random().toString(36).slice(2, 8); }

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
  const unique = "e2e-p2-" + Date.now();
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
  console.log(`\n=== FPT DDI P2 — Host KV Cache (immutable) + Sampling Defaults (hot-update) ===`);
  console.log(`base=${BASE}\n`);

  authKey = await makeKey();

  // ───────── Case 1: Tạo endpoint với hostKvCache + samplingDefaults ─────────
  console.log("[Case 1] Tạo endpoint k8s với hostKvCache=true, samplingDefaults={temp:0.7,top_p:0.9,max_tokens:512}");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
      hostKvCache: true,
      samplingDefaults: { temperature: 0.7, top_p: 0.9, max_tokens: 512 },
    }});
    check("tạo endpoint → 201", c.status === 201, `got ${c.status}`);
    const ep = c.json?.data;
    if (!ep) { console.log("Bỏ qua case 1 — endpoint không tạo được"); return; }
    check("hostKvCache=true", ep.hostKvCache === true, `got ${ep.hostKvCache}`);
    check("samplingDefaults.temperature=0.7", ep.samplingDefaults?.temperature === 0.7, `got ${ep.samplingDefaults?.temperature}`);
    check("samplingDefaults.top_p=0.9", ep.samplingDefaults?.top_p === 0.9, `got ${ep.samplingDefaults?.top_p}`);
    check("samplingDefaults.max_tokens=512", ep.samplingDefaults?.max_tokens === 512, `got ${ep.samplingDefaults?.max_tokens}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 2: Mặc định khi không truyền ─────────
  console.log("\n[Case 2] Mặc định — hostKvCache=false, samplingDefaults={1.0,1.0,1024}");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    check("hostKvCache mặc định = false", ep.hostKvCache === false, `got ${ep.hostKvCache}`);
    check("samplingDefaults mặc định = 1.0/1.0/1024",
      ep.samplingDefaults?.temperature === 1.0 && ep.samplingDefaults?.top_p === 1.0 && ep.samplingDefaults?.max_tokens === 1024,
      `got ${JSON.stringify(ep.samplingDefaults)}`);
    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 3: Sampling defaults — hot-update qua PUT /config ─────────
  console.log("\n[Case 3] PUT /config samplingDefaults khi running — temp 0.7→0.3, max_tokens 1024→256");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const running = await waitForStatus(ep.id, "running");
    check("endpoint đạt running", !!running, "—");
    if (!running) return;

    const cfg = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: {
      samplingDefaults: { temperature: 0.3, max_tokens: 256 },
    }});
    check("config samplingDefaults → 200", cfg.status === 200, `got ${cfg.status} — ${cfg.body?.slice(0, 200)}`);
    check("temperature=0.3", cfg.json?.data?.samplingDefaults?.temperature === 0.3, `got ${cfg.json?.data?.samplingDefaults?.temperature}`);
    check("max_tokens=256", cfg.json?.data?.samplingDefaults?.max_tokens === 256, `got ${cfg.json?.data?.samplingDefaults?.max_tokens}`);
    check("top_p giữ nguyên = 1.0", cfg.json?.data?.samplingDefaults?.top_p === 1.0, `got ${cfg.json?.data?.samplingDefaults?.top_p}`);
    check("status KHÔNG đổi (hot-update, không redeploy)", cfg.json?.data?.status === "running", `got ${cfg.json?.data?.status}`);
    const ev = cfg.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event ghi 'samplingDefaults'", /samplingDefaults/.test(ev), `msg="${ev}"`);

    const g = await req("GET", `/v1/endpoints/${ep.id}`);
    check("persist qua GET: 0.3/1.0/256",
      g.json?.data?.samplingDefaults?.temperature === 0.3 && g.json?.data?.samplingDefaults?.max_tokens === 256,
      `got ${JSON.stringify(g.json?.data?.samplingDefaults)}`);

    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 4: Host KV cache — redeploy qua PUT /redeploy-config ─────────
  console.log("\n[Case 4] PUT /redeploy-config hostKvCache false→true khi running → deploying → running");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const running = await waitForStatus(ep.id, "running");
    check("endpoint đạt running", !!running, "—");
    if (!running) return;

    const rd = await req("PUT", `/v1/endpoints/${ep.id}/redeploy-config`, { body: { hostKvCache: true } });
    check("redeploy-config → 200", rd.status === 200, `got ${rd.status} — ${rd.body?.slice(0, 200)}`);
    check("hostKvCache=true", rd.json?.data?.hostKvCache === true, `got ${rd.json?.data?.hostKvCache}`);
    check("status về deploying (immutable → redeploy)", rd.json?.data?.status === "deploying", `got ${rd.json?.data?.status}`);
    const ev = rd.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event ghi 'redeploy:'", /redeploy:/.test(ev), `msg="${ev}"`);

    const runningAgain = await waitForStatus(ep.id, "running");
    check("endpoint tự quay lại running", !!runningAgain, "—");
    check("persist qua GET: hostKvCache=true", runningAgain?.hostKvCache === true, `got ${runningAgain?.hostKvCache}`);

    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Case 5: Validation — samplingDefaults sai ─────────
  console.log("\n[Case 5] Validation — temperature=3 (>2), top_p=0 → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 2,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const bad1 = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: { samplingDefaults: { temperature: 3 } } });
    check("temperature=3 → 400", bad1.status === 400, `got ${bad1.status}`);
    check("error chứa 'temperature'", /temperature/.test(bad1.json?.error || ""), `err="${bad1.json?.error}"`);
    const bad2 = await req("PUT", `/v1/endpoints/${ep.id}/config`, { body: { samplingDefaults: { top_p: 0 } } });
    check("top_p=0 → 400", bad2.status === 400, `got ${bad2.status}`);
    check("error chứa 'top_p'", /top_p/.test(bad2.json?.error || ""), `err="${bad2.json?.error}"`);
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