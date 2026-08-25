"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let pass = 0, fail = 0;
const results = [];

let AUTH_KEY = null;

function makeJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    const h = {};
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
    if (AUTH_KEY) h.Authorization = `Bearer ${AUTH_KEY}`;
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

function req(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const h = {};
    if (AUTH_KEY) h.Authorization = `Bearer ${AUTH_KEY}`;
    http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers: h }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, body: buf, json });
      });
    }).on("error", reject).end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const SKILLS = [
  "fpt-ddi-endpoint-ops",
  "fpt-ddi-batch-runner",
  "fpt-ddi-ft-pipeline",
  "fpt-ddi-cost-watch",
  "fpt-ddi-capacity-planner",
  "fpt-ddi-experiment-runner",
];

async function main() {
  console.log(`\n=== FPT DDI Agent Skills — e2e test (zenflow thật) ===`);
  console.log(`base=${BASE}\n`);

  // ---- 0. Setup — tạo key có scope 'endpoints' để auth mọi call API ----
  {
    const unique = "e2e-skills-" + Date.now();
    const r = await makeJson("POST", "/v1/keys", { name: unique, scopes: ["endpoints"] });
    if (r.status === 201 && r.json?.full_key) {
      AUTH_KEY = r.json.full_key;
      console.log(`[setup] key ${unique} tạo xong (prefix ${r.json.keyPrefix})\n`);
    } else {
      const lst = await makeJson("GET", "/v1/keys");
      const found = (lst.json?.data || []).find((k) => k.status === "active" && (k.scopes || []).includes("endpoints"));
      if (!found) { console.error("Không có key endpoints nào để rotate — abort"); process.exit(2); }
      const rr = await makeJson("POST", `/v1/keys/${found.id}/rotate`);
      AUTH_KEY = rr.json?.full_key;
      console.log(`[setup] reuse + rotate key ${found.id} (prefix ${found.keyPrefix})\n`);
    }
  }

  // ---- 1. GET /v1/skills ----
  console.log("[1] GET /v1/skills — list 6 skill đã đăng ký");
  {
    const r = await req("/v1/skills");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("count=6", r.json?.count === 6, JSON.stringify(r.json?.count));
    for (const s of SKILLS) {
      check(`skill "${s}" có mặt`, r.json?.data?.some((x) => x.id === s && x.available === true), "—");
    }
  }

  // ---- 2..7. Invoke từng skill ----
  for (let i = 0; i < SKILLS.length; i++) {
    const name = SKILLS[i];
    console.log(`\n[${i + 2}] INVOKING skill: ${name}`);
    const invokeRes = await req(`/v1/skills/${encodeURIComponent(name)}/invoke`);
    check(`${name}: invoke status 202`, invokeRes.status === 202, `got ${invokeRes.status}`);
    check(`${name}: có runId`, !!invokeRes.json?.id, JSON.stringify(invokeRes.json));
    const runId = invokeRes.json?.id;
    if (!runId) { continue; }

    // Poll tới khi completed/failed (timeout 60s)
    let run = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const r = await req(`/v1/skills/runs/${encodeURIComponent(runId)}`);
      run = r.json?.data;
      if (run?.status === "completed" || run?.status === "failed") break;
      await sleep(1000);
    }
    check(`${name}: run kết thúc`, run?.status === "completed" || run?.status === "failed", `hiện ${run?.status}`);

    // Lấy events để verify workflow chạy thật
    const evRes = await req(`/v1/skills/runs/${encodeURIComponent(runId)}/events`);
    const events = evRes.json?.data || [];
    const types = events.map((e) => e.type);
    check(`${name}: có plan_ready`, types.includes("plan_ready"), "—");
    check(`${name}: có workflow_start`, types.includes("workflow_start"), "—");
    check(`${name}: có ≥1 step_start`, types.filter((t) => t === "step_start").length >= 1, `got ${types.filter((t) => t === "step_start").length}`);
    check(`${name}: có ≥1 step_end`, types.filter((t) => t === "step_end").length >= 1, "—");
    check(`${name}: có workflow_end`, types.includes("workflow_end"), "—");
    check(`${name}: có process_exit`, types.includes("process_exit"), "—");
    check(`${name}: tổng events ≥6`, events.length >= 6, `got ${events.length}`);
  }

  // ---- 8. GET /v1/skills/runs (list history) ----
  console.log("\n[8] GET /v1/skills/runs — danh sách run history");
  {
    const r = await req("/v1/skills/runs");
    check("status 200", r.status === 200);
    check("≥6 runs đã tạo", r.json?.count >= 6, JSON.stringify(r.json?.count));
  }

  // ---- 9. Invoke skill không tồn tại ----
  console.log("\n[9] Invoke skill không tồn tại");
  {
    const r = await req("/v1/skills/no-such-skill/invoke");
    check("status 404", r.status === 404, `got ${r.status}`);
    check("error message có", !!r.json?.error, JSON.stringify(r.json));
  }

  // ---- 10. GET run không tồn tại ----
  console.log("\n[10] GET run không tồn tại");
  {
    const r = await req("/v1/skills/runs/r-doesnotexist");
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  // ---- Done ----
  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  if (fail > 0) {
    console.log("Cases thất bại:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
