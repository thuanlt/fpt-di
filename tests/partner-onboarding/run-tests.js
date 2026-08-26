"use strict";

// Partner onboarding — e2e test (FR-ONB-017..027, NFR-ONB-002)
// Chạy: node tests/partner-onboarding/run-tests.js  (DDI_BASE=http://localhost:5173)
// Chạy đối với preview backend đang chạy (caddy :5173 → backend :3000, postgres).

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

const auth = (key) => ({ Authorization: "Bearer " + key });

async function main() {
  console.log(`\n=== Partner onboarding — e2e test ===`);
  console.log(`base=${BASE}\n`);

  const tag = Date.now();

  // Setup: 3 keys — operator/endpoints (tạo được), viewer/endpoints (403 role), operator/batch (403 scope)
  let opKey = null, viewerKey = null, noScopeKey = null;
  {
    const o = await req("POST", "/v1/keys", { body: { name: "onb-op-" + tag, scopes: ["endpoints"], role: "operator" } });
    opKey = o.json && o.json.full_key;
    check("setup operator key (endpoints)", !!opKey, `got ${o.status}`);
  }
  {
    const v = await req("POST", "/v1/keys", { body: { name: "onb-viewer-" + tag, scopes: ["endpoints"], role: "viewer" } });
    viewerKey = v.json && v.json.full_key;
    check("setup viewer key (endpoints)", !!viewerKey, `got ${v.status}`);
  }
  {
    const n = await req("POST", "/v1/keys", { body: { name: "onb-noscope-" + tag, scopes: ["batch"], role: "operator" } });
    noScopeKey = n.json && n.json.full_key;
    check("setup operator key (batch, thiếu endpoints)", !!noScopeKey, `got ${n.status}`);
  }

  // 1. GET /v1/partners → 200 + array (có partner seed)
  console.log("\n[1] GET /v1/partners — list (có seed)");
  let seeded = 0;
  {
    const r = await req("GET", "/v1/partners", { headers: auth(opKey) });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("data là array", Array.isArray(r.json && r.json.data), JSON.stringify(r.json).slice(0, 120));
    const data = (r.json && r.json.data) || [];
    seeded = data.length;
    check("có ≥7 partner seed", data.length >= 7, `got ${data.length}`);
    check("có FPT.AI (seed)", data.some((p) => p.name === "FPT.AI"), JSON.stringify(data.map((p) => p.name)));
    check("partner có id (uuid)", data.every((p) => typeof p.id === "string" && p.id.length >= 32), "—");
    check("partner có since/models/share", data.every((p) => typeof p.since === "string" && typeof p.models === "number" && typeof p.share === "number"), "—");
  }

  // 2. POST hợp lệ → 201, tạo thành công, hiện trong GET list
  console.log("\n[2] POST hợp lệ → 201 + hiện trong list");
  const newName = "OnbE2E " + tag;
  {
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: {
      name: newName, contact: "bd@onb-e2e.test", top: "Onb-7B", integration: "vLLM", status: "pending", note: "E2E test partner",
    }});
    check("status 201", r.status === 201, `got ${r.status} — ${r.body && r.body.slice(0, 200)}`);
    const p = r.json;
    check("trả về partner object", !!p && p.name === newName, JSON.stringify(p).slice(0, 150));
    check("id là uuid", typeof p.id === "string" && p.id.length >= 32, String(p.id));
    check("since = YYYY-MM hiện tại", typeof p.since === "string" && /^\d{4}-\d{2}$/.test(p.since), String(p.since));
    check("models = 0", p.models === 0, String(p.models));
    check("share = 0", p.share === 0, String(p.share));
    check("status = pending", p.status === "pending", String(p.status));

    const g = await req("GET", "/v1/partners", { headers: auth(opKey) });
    const data = (g.json && g.json.data) || [];
    check("hiện trong GET list", data.some((x) => x.name === newName), `count=${data.length}`);
    check("list tăng 1 so với seed", data.length === seeded + 1, `seed=${seeded} now=${data.length}`);
  }

  // 3. POST name rỗng → 400
  console.log("\n[3] POST name rỗng → 400");
  {
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: "", contact: "a@b.com" } });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("error=validation + details", r.json && r.json.error === "validation" && Array.isArray(r.json.details) && r.json.details.some((d) => d.field === "name"), JSON.stringify(r.json));
  }

  // 4. POST email sai → 400
  console.log("\n[4] POST email sai → 400");
  {
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: "OnbBadEmail " + tag, contact: "not-an-email" } });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("details có field contact", r.json && r.json.details && r.json.details.some((d) => d.field === "contact"), JSON.stringify(r.json));
  }

  // 5. POST name > 100 → 400
  console.log("\n[5] POST name >100 → 400");
  {
    const longName = "a".repeat(101);
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: longName, contact: "a@b.com" } });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("details có field name (length)", r.json && r.json.details && r.json.details.some((d) => d.field === "name"), JSON.stringify(r.json));
  }

  // 6. POST name trùng → 409
  console.log("\n[6] POST name trùng → 409");
  {
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: "FPT.AI", contact: "x@y.com" } });
    check("status 409", r.status === 409, `got ${r.status} — ${r.body && r.body.slice(0, 120)}`);
    check("error=conflict", r.json && r.json.error === "conflict", JSON.stringify(r.json));
  }

  // 7. POST với key viewer → 403 (role)
  console.log("\n[7] POST key viewer → 403 (role)");
  {
    const r = await req("POST", "/v1/partners", { headers: auth(viewerKey), body: { name: "OnbViewer " + tag, contact: "a@b.com" } });
    check("status 403", r.status === 403, `got ${r.status}`);
  }

  // 8. POST không có key → 401
  console.log("\n[8] POST không key → 401");
  {
    const r = await req("POST", "/v1/partners", { body: { name: "OnbNoAuth " + tag, contact: "a@b.com" } });
    check("status 401", r.status === 401, `got ${r.status}`);
  }

  // 9. POST key thiếu scope endpoints → 403
  console.log("\n[9] POST key thiếu scope endpoints → 403");
  {
    const r = await req("POST", "/v1/partners", { headers: auth(noScopeKey), body: { name: "OnbNoScope " + tag, contact: "a@b.com" } });
    check("status 403", r.status === 403, `got ${r.status}`);
  }

  // 10. SQLi trong name → không crash, lưu literal (không 500)
  console.log("\n[10] SQLi trong name → không 500, lưu literal");
  {
    const sqliName = "sqli-" + tag + "' OR 1=1 --";
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: sqliName, contact: "a@b.com" } });
    check("không 500 (trả 201)", r.status === 201, `got ${r.status} — ${r.body && r.body.slice(0, 200)}`);
    check("name lưu literal", r.json && r.json.name === sqliName, JSON.stringify(r.json && r.json.name));
    const g = await req("GET", "/v1/partners", { headers: auth(opKey) });
    const data = (g.json && g.json.data) || [];
    check("GET không bị SQLi (vẫn list bình thường)", g.status === 200 && Array.isArray(data), `got ${g.status}`);
    check("partner SQLi hiện literal trong list", data.some((p) => p.name === sqliName), "—");
  }

  // 11. XSS trong name → không 500, lưu literal (frontend sẽ encode)
  console.log("\n[11] XSS trong name → không 500, lưu literal");
  {
    const xssName = "xss-" + tag + "<script>alert(1)</script>";
    const r = await req("POST", "/v1/partners", { headers: auth(opKey), body: { name: xssName, contact: "a@b.com" } });
    check("không 500 (trả 201)", r.status === 201, `got ${r.status} — ${r.body && r.body.slice(0, 200)}`);
    check("name lưu literal (chưa execute)", r.json && r.json.name === xssName, JSON.stringify(r.json && r.json.name));
  }

  console.log(`\n=== Partner onboarding: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });