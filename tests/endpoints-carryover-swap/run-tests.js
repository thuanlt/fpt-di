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
function name() { return "ep-cs-" + Math.random().toString(36).slice(2, 8); }

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
  const unique = "e2e-cs-" + Date.now();
  const r = await req("POST", "/v1/keys", { body: { name: unique, scopes: ["endpoints"], role: "operator" } });
  if (r.status === 201 && r.json?.full_key) {
    console.log(`[setup] key ${unique} tạo xong\n`);
    return r.json.full_key;
  }
  // fallback: rotate key cũ có scope endpoints
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
  console.log(`\n=== FPT DDI Sprint 3 — Carryover + GPU Swap (5 trường hợp) ===`);
  console.log(`base=${BASE}\n`);

  authKey = await makeKey();

  // ───────── Case 1: Carryover = YES (commit 7-30, stop sớm) ─────────
  console.log("[Case 1] Carryover YES — commit 7-30, stop ngay sau running, kỳ tiếp nhận credit");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "7-30", minReplicas: 1, maxReplicas: 2,
    }});
    check("tạo endpoint 1  thành công (201)", c.status === 201, `got ${c.status}`);
    const ep1 = c.json?.data;
    if (!ep1) { console.log("Bỏ qua case 1 — endpoint không tạo được"); return; }

    const running = await waitForRunning(ep1.id);
    check("endpoint 1 đạt running", !!running, `hiện ${ep1.id}`);
    if (!running) return;

    await sleep(2000);
    const stop = await req("POST", `/v1/endpoints/${ep1.id}/stop`);
    check("stop endpoint 1 → 200", stop.status === 200, `got ${stop.status}`);
    const stopMsg = stop.json?.data?.events?.slice(-1)[0]?.msg || "";
    // carryover = (cap - elapsed) * 0.20, vì chạy 2s nên còn gần 719h → carryover ~143h
    const carryover1 = stop.json?.data?.carryoverQuotaHours;
    check("carryoverQuotaHours > 0 (vì commit 7-30, stop sớm)", typeof carryover1 === "number" && carryover1 > 0, `got ${carryover1}`);
    check("event stopmsg chứa 'carryover'", /carryover/i.test(stopMsg), `msg="${stopMsg}"`);

    await req("DELETE", `/v1/endpoints/${ep1.id}`);
  }

  // ───────── Case 2: Carryover = NO (commit on-demand, stop) ─────────
  console.log("\n[Case 2] Carryover NO — commit on-demand, stop → carryoverQuotaHours=0");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 1,
    }});
    check("tạo endpoint 2 thành công", c.status === 201, `got ${c.status}`);
    const ep2 = c.json?.data;
    if (!ep2) return;
    const running = await waitForRunning(ep2.id);
    check("endpoint 2 đạt running", !!running, "—");
    if (!running) return;

    await sleep(1000);
    const stop = await req("POST", `/v1/endpoints/${ep2.id}/stop`);
    check("stop endpoint 2 → 200", stop.status === 200, `got ${stop.status}`);
    const carryover2 = stop.json?.data?.carryoverQuotaHours;
    check("carryoverQuotaHours = 0 (on-demand không có quota)", carryover2 === 0, `got ${carryover2}`);
    const stopMsg = stop.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event stopmsg chứa 'no carryover'", /no carryover/i.test(stopMsg), `msg="${stopMsg}"`);

    await req("DELETE", `/v1/endpoints/${ep2.id}`);
  }

  // ───────── Case 3: GPU Swap = YES (allowGpuSwap=true, swap H100→H200) ─────────
  console.log("\n[Case 3] GPU Swap YES — allowGpuSwap=true, swap H100 → H200 khi running");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 1,
      allowGpuSwap: true,
    }});
    check("tạo endpoint 3 thành công", c.status === 201, `got ${c.status}`);
    const ep3 = c.json?.data;
    if (!ep3) return;
    check("allowGpuSwap=true phản hồi", ep3.allowGpuSwap === true, `got ${ep3.allowGpuSwap}`);
    const running = await waitForRunning(ep3.id);
    check("endpoint 3 đạt running", !!running, "—");
    if (!running) return;

    const swap = await req("POST", `/v1/endpoints/${ep3.id}/swap-gpu`, { body: { gpu: "H200" } });
    check("swap-gpu H100→H200 → 200", swap.status === 200, `got ${swap.status} — ${swap.body?.slice(0, 200)}`);
    check("gpu mới = H200", swap.json?.data?.gpu === "H200", `got ${swap.json?.data?.gpu}`);
    check("rate = 3.30 (H200 × on-demand)", swap.json?.data?.rate === "3.30", `got ${swap.json?.data?.rate}`);
    const swapEv = swap.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event ghi 'GPU swap H100→H200'", /GPU swap H100→H200/.test(swapEv), `msg="${swapEv}"`);

    await req("DELETE", `/v1/endpoints/${ep3.id}`);
  }

  // ───────── Case 4: GPU Swap = NO (allowGpuSwap=false, swap bị từ chối) ─────────
  console.log("\n[Case 4] GPU Swap NO — allowGpuSwap=false (mặc định), swap-gpu → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 1,
      // allowGpuSwap mặc định false
    }});
    check("tạo endpoint 4 thành công", c.status === 201, `got ${c.status}`);
    const ep4 = c.json?.data;
    if (!ep4) return;
    check("allowGpuSwap=false mặc định", ep4.allowGpuSwap === false, `got ${ep4.allowGpuSwap}`);
    const running = await waitForRunning(ep4.id);
    check("endpoint 4 đạt running", !!running, "—");
    if (!running) return;

    const swap = await req("POST", `/v1/endpoints/${ep4.id}/swap-gpu`, { body: { gpu: "H200" } });
    check("swap-gpu bị từ chối → 400", swap.status === 400, `got ${swap.status}`);
    check("error chứa 'allowGpuSwap'", /allowGpuSwap/.test(swap.json?.error || ""), `err="${swap.json?.error}"`);

    await req("DELETE", `/v1/endpoints/${ep4.id}`);
  }

  // ───────── Case 5: Combo — carryover YES + GPU Swap YES → swap giữa kỳ rồi stop vẫn credited carryover  ─────────
  console.log("\n[Case 5] Combo — allowGpuSwap=true + commit 7-30 → swap H100→A30 rồi stop vẫn credited carryover");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "7-30", minReplicas: 1, maxReplicas: 1,
      allowGpuSwap: true,
    }});
    check("tạo endpoint 5 thành công", c.status === 201, `got ${c.status}`);
    const ep5 = c.json?.data;
    if (!ep5) return;
    check("allowGpuSwap=true", ep5.allowGpuSwap === true, `got ${ep5.allowGpuSwap}`);
    const running = await waitForRunning(ep5.id);
    check("endpoint 5 đạt running", !!running, "—");
    if (!running) return;

    // swap H100 → A30 giữa kỳ
    const swap = await req("POST", `/v1/endpoints/${ep5.id}/swap-gpu`, { body: { gpu: "A30" } });
    check("swap H100→A30 → 200", swap.status === 200, `got ${swap.status}`);
    check("rate mới = 0.90 (A30 × on-demand-ish × 0.91)", swap.json?.data?.rate === "0.82", `got ${swap.json?.data?.rate}`);
    // lưu startedAt để sau đó stop và verify carryover vẫn dựa vào startedAt gốc (không reset)
    const startedAt = running.startedAt;

    await sleep(1500);
    const stop = await req("POST", `/v1/endpoints/${ep5.id}/stop`);
    check("stop endpoint 5 → 200", stop.status === 200, `got ${stop.status}`);
    const carryover5 = stop.json?.data?.carryoverQuotaHours;
    check("carryoverQuotaHours > 0 (combo)", typeof carryover5 === "number" && carryover5 > 0, `got ${carryover5}`);
    const stopMsg = stop.json?.data?.events?.slice(-1)[0]?.msg || "";
    check("event stopmsg chứa 'carryover'", /carryover/i.test(stopMsg), `msg="${stopMsg}"`);
    check("startedAt không bị reset khi swap", stop.json?.data?.startedAt === startedAt, `started=${startedAt}, after=${stop.json?.data?.startedAt}`);

    await req("DELETE", `/v1/endpoints/${ep5.id}`);
  }

  // ───────── Edge: swap với GPU không hợp lệ + swap cùng GPU ─────────
  console.log("\n[Edge] Swap với GPU không hợp lệ + swap cùng GPU hiện tại");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 1,
      allowGpuSwap: true,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    await waitForRunning(ep.id);

    const swapBad = await req("POST", `/v1/endpoints/${ep.id}/swap-gpu`, { body: { gpu: "V100" } });
    check("swap → V100 (không hợp lệ) phải 400", swapBad.status === 400, `got ${swapBad.status}`);
    check("error chứa 'gpu phải thuộc'", /gpu phải thuộc/.test(swapBad.json?.error || ""), `err="${swapBad.json?.error}"`);

    const swapSame = await req("POST", `/v1/endpoints/${ep.id}/swap-gpu`, { body: { gpu: "H100" } });
    check("swap → cùng GPU hiện tại phải 400", swapSame.status === 400, `got ${swapSame.status}`);
    check("error chứa 'không cần swap'", /không cần swap/.test(swapSame.json?.error || ""), `err="${swapSame.json?.error}"`);

    await req("DELETE", `/v1/endpoints/${ep.id}`);
  }

  // ───────── Edge: swap khi endpoint chưa running ─────────
  console.log("\n[Edge] Swap khi endpoint còn queued (chưa running) → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", minReplicas: 1, maxReplicas: 1,
      allowGpuSwap: true,
    }});
    const ep = c.json?.data;
    if (!ep) return;
    const swapQueued = await req("POST", `/v1/endpoints/${ep.id}/swap-gpu`, { body: { gpu: "H200" } });
    check("swap khi queued → 400", swapQueued.status === 400, `got ${swapQueued.status}`);
    check("error chứa 'running'", /running/.test(swapQueued.json?.error || ""), `err="${swapQueued.json?.error}"`);
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
