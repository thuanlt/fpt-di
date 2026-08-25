"use strict";

// US-10 — Phân quyền theo vai trò (admin/operator/viewer)
// Chạy: node tests/us10-roles/run-tests.js  (BASE=http://localhost:5173)

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
  console.log(`\n=== US-10 Phân quyền theo vai trò — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // 1. Tạo key role=viewer (scope endpoints)
  console.log("[1] Tạo key role=viewer + scope endpoints");
  let viewerKey = null;
  {
    const r = await req("POST", "/v1/keys", { body: { name: "us10-viewer-" + Date.now(), scopes: ["endpoints"], role: "viewer" } });
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("role=viewer trả về", r.json?.role === "viewer", `got ${r.json?.role}`);
    viewerKey = r.json?.full_key;
  }

  // 2. Viewer → POST /endpoints → 403
  console.log("\n[2] Viewer key POST /v1/endpoints → 403");
  {
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${viewerKey}` }, body: {
      name: "us10-viewer-ep", model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
    }});
    check("status 403", r.status === 403, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("error nhắc role", (r.json?.error || "").toLowerCase().includes("role"), `got ${r.json?.error}`);
  }

  // 3. Tạo key role=operator + scope endpoints
  console.log("\n[3] Tạo key role=operator + scope endpoints");
  let opKey = null;
  {
    const r = await req("POST", "/v1/keys", { body: { name: "us10-op-" + Date.now(), scopes: ["endpoints"], role: "operator" } });
    check("status 201", r.status === 201, `got ${r.status}`);
    check("role=operator", r.json?.role === "operator", `got ${r.json?.role}`);
    opKey = r.json?.full_key;
  }

  // 4. Operator → POST /endpoints → cho phép (201)
  console.log("\n[4] Operator key POST /v1/endpoints → 201");
  {
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      name: "us10-op-ep-" + Date.now(), model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
    }});
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
  }

  // 5. Tạo key role=admin
  console.log("\n[5] Tạo key role=admin");
  let adminKey = null;
  {
    const r = await req("POST", "/v1/keys", { body: { name: "us10-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    check("status 201", r.status === 201, `got ${r.status}`);
    check("role=admin", r.json?.role === "admin", `got ${r.json?.role}`);
    adminKey = r.json?.full_key;
  }

  // 6. Admin → POST /keys → cho phép (201)
  console.log("\n[6] Admin key POST /v1/keys → 201");
  {
    const r = await req("POST", "/v1/keys", { headers: { Authorization: `Bearer ${adminKey}` }, body: { name: "us10-by-admin-" + Date.now(), scopes: ["chat"], role: "viewer" } });
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
  }

  // 7. Key không truyền role → mặc định viewer
  console.log("\n[7] Key không truyền role → mặc định viewer");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "us10-default-" + Date.now(), scopes: ["chat"] } });
    check("status 201", r.status === 201, `got ${r.status}`);
    check("role mặc định viewer", r.json?.role === "viewer", `got ${r.json?.role}`);
  }

  // 8. Viewer → POST /keys → trong preview vẫn cho phép (KEYS_ADMIN_REQUIRED off); kiểm tra role invalid → 400
  console.log("\n[8] Role không hợp lệ → 400");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "us10-badrole-" + Date.now(), scopes: ["chat"], role: "superuser" } });
    check("status 400", r.status === 400, `got ${r.status} — ${r.body?.slice(0, 150)}`);
  }

  // 9. PATCH /keys/:id cập nhật role
  console.log("\n[9] PATCH /v1/keys/:id cập nhật role");
  {
    const cr = await req("POST", "/v1/keys", { body: { name: "us10-promote-" + Date.now(), scopes: ["chat"], role: "viewer" } });
    const kid = cr.json?.id;
    const r = await req("PATCH", `/v1/keys/${kid}`, { body: { role: "operator" } });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("role=operator sau update", r.json?.data?.role === "operator", `got ${r.json?.data?.role}`);
  }

  console.log(`\n=== US-10: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });