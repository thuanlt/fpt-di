"use strict";

// US-05 — Audit trail bất biến (append-only)
// Chạy: node tests/us05-audit/run-tests.js  (BASE=http://localhost:5173)

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
  console.log(`\n=== US-05 Audit trail — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin (scope admin + endpoints, role admin) và key operator
  let adminKey = null, opKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us05-admin-" + Date.now(), scopes: ["admin", "endpoints"], role: "admin" } });
    adminKey = a.json?.full_key;
    const o = await req("POST", "/v1/keys", { body: { name: "us05-op-" + Date.now(), scopes: ["endpoints"], role: "operator" } });
    opKey = o.json?.full_key;
    check("setup admin key", !!adminKey, "—");
    check("setup operator key", !!opKey, "—");
  }

  // 1. Tạo endpoint → audit log ghi đủ fields
  console.log("\n[1] Tạo endpoint → audit ghi endpoint.create");
  let epId = null;
  {
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: "us05-ep-" + Date.now(), model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
    }});
    check("tạo endpoint 201", r.status === 201, `got ${r.status}`);
    epId = r.json?.data?.id;

    // đọc audit bằng admin key
    const au = await req("GET", "/v1/audit?action=endpoint.create", { headers: { Authorization: `Bearer ${adminKey}` } });
    check("GET /v1/audit 200", au.status === 200, `got ${au.status}`);
    const entry = (au.json?.data || []).find((x) => x.entityId === epId);
    check("có entry endpoint.create cho ep", !!entry, JSON.stringify(au.json?.data?.[0]));
    if (entry) {
      check("entry có actor", typeof entry.actor === "string" && entry.actor.length > 0, `got ${entry.actor}`);
      check("entry có action", entry.action === "endpoint.create", `got ${entry.action}`);
      check("entry có entityType=endpoint", entry.entityType === "endpoint", `got ${entry.entityType}`);
      check("entry có result", entry.result === "success", `got ${entry.result}`);
      check("entry có ts", !!entry.ts, "—");
      check("entry có id", !!entry.id, "—");
    }
  }

  // 2. Không có API xóa audit → 403/404/405 (append-only)
  console.log("\n[2] DELETE /v1/audit bị chặn (không có API xóa)");
  {
    const r = await req("DELETE", "/v1/audit", { headers: { Authorization: `Bearer ${adminKey}` } });
    check("DELETE /v1/audit trả 4xx", r.status >= 400 && r.status < 500, `got ${r.status}`);
    // audit vẫn còn
    const au = await req("GET", "/v1/audit?action=endpoint.create", { headers: { Authorization: `Bearer ${adminKey}` } });
    check("audit vẫn còn sau DELETE", (au.json?.data || []).length >= 1, `got ${au.json?.data?.length}`);
  }

  // 3. Lọc theo actor đúng
  console.log("\n[3] Lọc audit theo actor");
  {
    // lấy actor từ entry endpoint.create
    const au = await req("GET", "/v1/audit?action=endpoint.create", { headers: { Authorization: `Bearer ${adminKey}` } });
    const actor = au.json?.data?.[0]?.actor;
    check("có actor để lọc", !!actor, "—");
    if (actor) {
      const f = await req("GET", `/v1/audit?actor=${encodeURIComponent(actor)}`, { headers: { Authorization: `Bearer ${adminKey}` } });
      check("status 200", f.status === 200, `got ${f.status}`);
      check("mọi entry đều đúng actor", (f.json?.data || []).every((x) => x.actor === actor), JSON.stringify(f.json?.data?.slice(0, 2)));
    }
  }

  // 4. GET /v1/audit với key không admin → 403
  console.log("\n[4] GET /v1/audit với key không admin → 403");
  {
    const r = await req("GET", "/v1/audit", { headers: { Authorization: `Bearer ${opKey}` } });
    check("status 403", r.status === 403, `got ${r.status}`);
  }

  // 5. GET /v1/audit không key → 401
  console.log("\n[5] GET /v1/audit không key → 401");
  {
    const r = await req("GET", "/v1/audit");
    check("status 401", r.status === 401, `got ${r.status}`);
  }

  console.log(`\n=== US-05: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });