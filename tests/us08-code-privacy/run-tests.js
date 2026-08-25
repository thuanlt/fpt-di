"use strict";

// US-08 — Chế độ code privacy
// Chạy: node tests/us08-code-privacy/run-tests.js  (BASE=http://localhost:5173)

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
  console.log(`\n=== US-08 Chế độ code privacy — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin (scope endpoints + admin, role admin) — để đọc audit + tạo endpoint
  let adminKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us08-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, "—");
  }

  const SECRET_PROMPT = "Mã nguồn: const apiKey = 'sk-super-secret-xyz123'; deploy";

  // Tạo endpoint với codePrivacy=true, chờ running
  let epPrivate = null;
  {
    const r = await req("POST", "/v1/endpoints", { headers: { Authorization: `Bearer ${adminKey}` }, body: {
      name: "us08-private-" + Date.now(), model: "Llama-3.3-70B", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand",
      codePrivacy: true,
    }});
    check("tạo endpoint codePrivacy=true 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("codePrivacy=true trả về", r.json?.data?.codePrivacy === true, `got ${r.json?.data?.codePrivacy}`);
    epPrivate = r.json?.data?.id;
    let status = r.json?.data?.status;
    const t0 = Date.now();
    while (status !== "running" && Date.now() - t0 < 15000) {
      await sleep(1000);
      const g = await req("GET", `/v1/endpoints/${epPrivate}`, { headers: { Authorization: `Bearer ${adminKey}` } });
      status = g.json?.data?.status;
    }
    check("endpoint private running", status === "running", `hiện ${status}`);
  }

  // 1. Bật code privacy → prompt không xuất hiện plaintext trong audit
  console.log("\n[1] Invoke endpoint codePrivacy=true → prompt redact trong audit");
  {
    const r = await req("POST", `/v1/endpoints/${epPrivate}/chat/completions`, { headers: { Authorization: `Bearer ${adminKey}` }, body: {
      model: "Llama-3.3-70B",
      messages: [{ role: "user", content: SECRET_PROMPT }],
    }});
    check("invoke 200 (vẫn hoạt động)", r.status === 200, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("có content trả về", typeof r.json?.choices?.[0]?.message?.content === "string", "—");

    // đọc audit, tìm entry endpoint.invoke mới nhất cho ep này
    const au = await req("GET", `/v1/audit?action=endpoint.invoke&limit=50`, { headers: { Authorization: `Bearer ${adminKey}` } });
    const entries = (au.json?.data || []).filter((x) => x.entityId === epPrivate);
    const last = entries[0];
    check("có entry endpoint.invoke", !!last, "—");
    if (last) {
      const promptLogged = last.meta?.prompt || "";
      check("prompt bị redact ([REDACTED])", promptLogged === "[REDACTED]", `got ${JSON.stringify(promptLogged)}`);
      check("plaintext KHÔNG xuất hiện", !promptLogged.includes("sk-super-secret-xyz123"), "—");
    }
  }

  // 2. Tắt code privacy → log như thường (plaintext xuất hiện)
  console.log("\n[2] Tắt codePrivacy → prompt plaintext trong audit");
  {
    const off = await req("PATCH", `/v1/endpoints/${epPrivate}`, { headers: { Authorization: `Bearer ${adminKey}` }, body: { codePrivacy: false } });
    check("PATCH tắt codePrivacy 200", off.status === 200, `got ${off.status}`);
    check("codePrivacy=false", off.json?.data?.codePrivacy === false, `got ${off.json?.data?.codePrivacy}`);

    const r = await req("POST", `/v1/endpoints/${epPrivate}/chat/completions`, { headers: { Authorization: `Bearer ${adminKey}` }, body: {
      model: "Llama-3.3-70B",
      messages: [{ role: "user", content: SECRET_PROMPT }],
    }});
    check("invoke 200", r.status === 200, `got ${r.status}`);

    const au = await req("GET", `/v1/audit?action=endpoint.invoke&limit=50`, { headers: { Authorization: `Bearer ${adminKey}` } });
    const entries = (au.json?.data || []).filter((x) => x.entityId === epPrivate);
    const last = entries[0];
    check("có entry mới", !!last, "—");
    if (last) {
      const promptLogged = last.meta?.prompt || "";
      check("prompt plaintext xuất hiện", promptLogged.includes("sk-super-secret-xyz123"), `got ${JSON.stringify(promptLogged.slice(0, 60))}`);
    }
  }

  // 3. PATCH /endpoints/:id với codePrivacy=true (bật lại) — nhận field
  console.log("\n[3] PATCH /endpoints/:id bật lại codePrivacy=true");
  {
    const r = await req("PATCH", `/v1/endpoints/${epPrivate}`, { headers: { Authorization: `Bearer ${adminKey}` }, body: { codePrivacy: true } });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("codePrivacy=true", r.json?.data?.codePrivacy === true, `got ${r.json?.data?.codePrivacy}`);
  }

  console.log(`\n=== US-08: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });