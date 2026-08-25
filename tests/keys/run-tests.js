"use strict";

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
  console.log(`\n=== FPT DDI API Keys — e2e test (BE thật) ===`);
  console.log(`base=${BASE}\n`);

  let createdKeyId = null;
  let createdKey = null;

  // 1. GET /keys ban đầu rỗng
  console.log("[1] GET /v1/keys — list ban đầu");
  {
    const r = await req("GET", "/v1/keys");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("data là array", Array.isArray(r.json?.data), "—");
  }

  // 2. POST /keys tạo key hợp lệ
  console.log("\n[2] POST /v1/keys — tạo key với scopes [endpoints, batch]");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-keys", scopes: ["endpoints", "batch"] } });
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    check("có full_key", typeof r.json?.full_key === "string" && r.json.full_key.startsWith("ddi-live-"), "—");
    check("có id", typeof r.json?.id === "string", "—");
    check("scopes đúng", JSON.stringify(r.json?.scopes) === JSON.stringify(["endpoints", "batch"]), "—");
    check("keyPrefix mask", typeof r.json?.keyPrefix === "string" && r.json.keyPrefix.includes("•••"), "—");
    check("có message warning", typeof r.json?.message === "string", "—");
    if (r.json?.id) createdKeyId = r.json.id;
    if (r.json?.full_key) createdKey = r.json.full_key;
  }

  // 3. POST /keys thiếu name
  console.log("\n[3] POST /v1/keys — thiếu name → 400");
  {
    const r = await req("POST", "/v1/keys", { body: { scopes: ["batch"] } });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("error message", !!r.json?.error, "—");
  }

  // 4. POST /keys thiếu scopes
  console.log("\n[4] POST /v1/keys — thiếu scopes → 400");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "should-fail" } });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 5. POST /keys scope không hợp lệ
  console.log("\n[5] POST /v1/keys — scope không hợp lệ → 400");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "bad-scope", scopes: ["nope"] } });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 6. POST /keys trùng tên active
  console.log("\n[6] POST /v1/keys — trùng tên active → 400");
  {
    const r = await req("POST", "/v1/keys", { body: { name: "e2e-keys", scopes: ["batch"] } });
    check("status 400 — trùng tên", r.status === 400, `got ${r.status}`);
  }

  // 7. GET /keys thấy key mới
  console.log("\n[7] GET /v1/keys — thấy key vừa tạo");
  {
    const r = await req("GET", "/v1/keys");
    check("status 200", r.status === 200);
    check("≥1 key", r.json?.data?.length >= 1, `got ${r.json?.data?.length}`);
    check("key mới có mặt", r.json?.data?.some((k) => k.id === createdKeyId), "—");
    check("key không trả keyHash", !r.json?.data?.[0]?.keyHash, "— keyHash bị lộ");
  }

  // 8. GET /keys/:id
  console.log("\n[8] GET /v1/keys/:id — chi tiết key");
  {
    const r = await req("GET", `/v1/keys/${createdKeyId}`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("id khớp", r.json?.data?.id === createdKeyId, "—");
    check("status=active", r.json?.data?.status === "active", "—");
  }

  // 9. Dùng key gọi endpoint cần scope (auth hoạt động)
  console.log("\n[9] Auth — dùng key mới gọi /v1/batch (scope=batch) phải 200");
  {
    const r = await req("GET", "/v1/batch", { headers: { Authorization: `Bearer ${createdKey}` } });
    check("status 200 (key hợp lệ)", r.status === 200, `got ${r.status}`);
  }

  // 10. Auth — không key → 401
  console.log("\n[10] Auth — không key gọi /v1/batch → 401");
  {
    const r = await req("GET", "/v1/batch");
    check("status 401", r.status === 401, `got ${r.status}`);
  }

  // 11. Auth — key sai → 401
  console.log("\n[11] Auth — key sai → 401");
  {
    const r = await req("GET", "/v1/batch", { headers: { Authorization: "Bearer ddi-live-fakekey123" } });
    check("status 401", r.status === 401, `got ${r.status}`);
  }

  // 12. Scope check — key chỉ scope batch, gọi /v1/endpoints phải 403
  console.log("\n[12] Scope — key chỉ 'batch' gọi /v1/endpoints → 403");
  {
    const onlyBatch = await req("POST", "/v1/keys", { body: { name: "only-batch-e2e-" + Date.now(), scopes: ["batch"] } });
    const obKey = onlyBatch.json?.full_key;
    const r = await req("GET", "/v1/endpoints", { headers: { Authorization: `Bearer ${obKey}` } });
    check("status 403", r.status === 403, `got ${r.status}`);
    check("error có 'scope'", (r.json?.error || "").includes("scope"), "—");
  }

  // 13. Kết quả gọi API tăng usage counter
  console.log("\n[13] Usage counter — sau khi gọi API, usage của key tăng");
  {
    const before = await req("GET", `/v1/keys/${createdKeyId}`);
    const usageBefore = before.json?.data?.usage || 0;
    await req("GET", "/v1/batch", { headers: { Authorization: `Bearer ${createdKey}` } });
    await req("GET", "/v1/skills", { headers: { Authorization: `Bearer ${createdKey}` } });
    const after = await req("GET", `/v1/keys/${createdKeyId}`);
    const usageAfter = after.json?.data?.usage || 0;
    check("usage tăng", usageAfter >= usageBefore + 2, `before=${usageBefore} after=${usageAfter}`);
    check("lastUsedAt có giá trị", !!after.json?.data?.lastUsedAt, "—");
  }

  // 14. Rotate key
  console.log("\n[14] POST /v1/keys/:id/rotate — rotate key");
  {
    const r = await req("POST", `/v1/keys/${createdKeyId}/rotate`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("trả full_key mới", typeof r.json?.full_key === "string" && r.json.full_key !== createdKey, "—");
    check("keyPrefix mask", (r.json?.keyPrefix || "").includes("•••"), "—");
    const oldKeyStillWorks = await req("GET", "/v1/batch", { headers: { Authorization: `Bearer ${createdKey}` } });
    check("key CŨ sau rotate → 401", oldKeyStillWorks.status === 401, `got ${oldKeyStillWorks.status}`);
    createdKey = r.json.full_key;
    const newKeyWorks = await req("GET", "/v1/batch", { headers: { Authorization: `Bearer ${createdKey}` } });
    check("key MỚI sau rotate → 200", newKeyWorks.status === 200, `got ${newKeyWorks.status}`);
  }

  // 15. Revoke key
  console.log("\n[15] POST /v1/keys/:id/revoke — revoke key");
  {
    const r = await req("POST", `/v1/keys/${createdKeyId}/revoke`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("status=revoked", r.json?.data?.status === "revoked", "—");
    check("revokedAt có", !!r.json?.data?.revokedAt, "—");
    const revokedKey = await req("GET", "/v1/batch", { headers: { Authorization: `Bearer ${createdKey}` } });
    check("key revoked → 401", revokedKey.status === 401, `got ${revokedKey.status}`);
  }

  // 16. Revoke lại key đã revoke — idempotent
  console.log("\n[16] POST /v1/keys/:id/revoke — revoke lần 2 idempotent");
  {
    const r = await req("POST", `/v1/keys/${createdKeyId}/revoke`);
    check("status 200 (idempotent)", r.status === 200, `got ${r.status}`);
  }

  // 17. Rotate key đã revoke — lỗi
  console.log("\n[17] POST /v1/keys/:id/rotate — rotate key revoked → 400");
  {
    const r = await req("POST", `/v1/keys/${createdKeyId}/rotate`);
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 18. GET /v1/keys/_/scopes
  console.log("\n[18] GET /v1/keys/_/scopes — list scope khả dụng");
  {
    const r = await req("GET", "/v1/keys/_/scopes");
    check("status 200", r.status === 200);
    check("≥8 scope", r.json?.data?.length >= 8, `got ${r.json?.data?.length}`);
    check("có 'batch'", (r.json?.data || []).includes("batch"), "—");
  }

  // 19. DELETE key
  console.log("\n[19] DELETE /v1/keys/:id — xóa key");
  {
    const r = await req("DELETE", `/v1/keys/${createdKeyId}`);
    check("status 200", r.status === 200, `got ${r.status}`);
    const after = await req("GET", `/v1/keys/${createdKeyId}`);
    check("GET sau delete → 404", after.status === 404, `got ${after.status}`);
  }

  // 20. GET key không tồn tại
  console.log("\n[20] GET /v1/keys/id-khongtontai → 404");
  {
    const r = await req("GET", "/v1/keys/key-khongtontai");
    check("status 404", r.status === 404, `got ${r.status}`);
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
