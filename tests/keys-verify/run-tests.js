"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let pass = 0, fail = 0;

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
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

async function main() {
  console.log(`\n=== FPT DDI — GET /v1/keys/verify (BE thật) ===`);
  console.log(`base=${BASE}\n`);

  const tag = Date.now();
  const keyName = `verify-e2e-${tag}`;

  // 1. Tạo key thật (scope endpoints+byom)
  const cr = await req("POST", "/v1/keys", { body: { name: keyName, scopes: ["endpoints", "byom"] } });
  check("tạo key e2e → 201", cr.status === 201, `got ${cr.status}`);
  const fullKey = cr.json && cr.json.full_key;
  check("tạo key trả về full_key", typeof fullKey === "string" && fullKey.startsWith("ddi-live-"), String(fullKey).slice(0, 12));
  const createdId = cr.json && cr.json.id;

  // 2. verify với key hợp lệ
  const ok = await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer " + fullKey } });
  check("verify key hợp lệ → 200", ok.status === 200, `got ${ok.status}`);
  check("verify trả valid:true", ok.json && ok.json.valid === true, JSON.stringify(ok.json));
  check("verify trả đúng name", ok.json && ok.json.name === keyName, ok.json && ok.json.name);
  check("verify trả đúng scopes", ok.json && Array.isArray(ok.json.scopes) && ok.json.scopes.includes("endpoints") && ok.json.scopes.includes("byom"), JSON.stringify(ok.json && ok.json.scopes));
  check("verify trả status active", ok.json && ok.json.status === "active", ok.json && ok.json.status);

  // 3. verify KHÔNG có key → 401
  const nokey = await req("GET", "/v1/keys/verify");
  check("verify không có key → 401", nokey.status === 401, `got ${nokey.status}`);
  check("verify không key trả valid:false", nokey.json && nokey.json.valid === false, JSON.stringify(nokey.json));

  // 4. verify key SAI → 401
  const bad = await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer ddi-live-saihoan1234567890abcdef0" } });
  check("verify key sai → 401", bad.status === 401, `got ${bad.status}`);

  // 5. verify key bị cắt (chỉ prefix 13 ký tự) — trap: user chỉ có phần hiển thị prefix
  const prefix = await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer " + fullKey.slice(0, 13) } });
  check("verify key chỉ prefix (bị cắt) → 401", prefix.status === 401, `got ${prefix.status}`);

  // 6. verify không ghi usage (usage không tăng)
  const before = await req("GET", "/v1/keys/" + createdId);
  const usageBefore = (before.json && before.json.data && before.json.data.usage) || 0;
  await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer " + fullKey } });
  await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer " + fullKey } });
  const after = await req("GET", "/v1/keys/" + createdId);
  const usageAfter = (after.json && after.json.data && after.json.data.usage) || 0;
  check("verify không ghi usage", usageAfter === usageBefore, `before=${usageBefore} after=${usageAfter}`);

  // 7. verify key đã revoke → 401
  const rev = await req("POST", "/v1/keys/" + createdId + "/revoke");
  check("revoke key → 200", rev.status === 200, `got ${rev.status}`);
  const revoked = await req("GET", "/v1/keys/verify", { headers: { Authorization: "Bearer " + fullKey } });
  check("verify key đã revoke → 401", revoked.status === 401, `got ${revoked.status}`);

  // 8. verify là public (không cần admin) — gọi mà không có key vẫn trả 401 (không phải 403)
  check("verify public (không 403)", nokey.status === 401 && nokey.status !== 403, `got ${nokey.status}`);

  console.log(`\nPass: ${pass} · Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });