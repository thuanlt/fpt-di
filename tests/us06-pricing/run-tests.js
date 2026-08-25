"use strict";

// US-06 — Gói giá theo phân khúc (price pack) + quota RPM/TPM
// Chạy: node tests/us06-pricing/run-tests.js  (BASE=http://localhost:5173)
// Idempotent: price_pack có UNIQUE(segment,gpu,region) — test tạo-if-chưa-có để chạy lại được.

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

async function waitRunning(id, key, timeoutMs = 20000) {
  const t0 = Date.now();
  let status = "queued";
  while (status !== "running" && Date.now() - t0 < timeoutMs) {
    await sleep(1000);
    const g = await req("GET", `/v1/endpoints/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    status = g.json?.data?.status;
  }
  return status;
}

// Đảm bảo price pack tồn tại (tạo nếu chưa có) — idempotent
async function ensurePack(H, spec) {
  const q = `segment=${spec.segment}&gpu=${spec.gpu}&region=${spec.region}`;
  const existing = await req("GET", `/v1/price-packs?${q}`, { headers: H });
  if (existing.json?.data?.length) return { pack: existing.json.data[0], created: false };
  const r = await req("POST", "/v1/price-packs", { headers: H, body: spec });
  return { pack: r.json?.data, created: r.status === 201, status: r.status, body: r.body };
}

async function main() {
  console.log(`\n=== US-06 Gói giá theo phân khúc — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup: key admin (scope endpoints + admin, role admin)
  let adminKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us06-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, `got ${a.status}`);
  }
  const H = { Authorization: `Bearer ${adminKey}` };

  // [1] Đảm bảo price pack hợp lệ tồn tại (retail/A30/HAN-2)
  console.log("\n[1] Price pack hợp lệ (retail/A30/HAN-2)");
  {
    const { pack, created, status, body } = await ensurePack(H, {
      segment: "retail", gpu: "A30", region: "HAN-2",
      rate_per_hour: 0.95, rate_per_token: 0.0000004, commitment: "on-demand",
      discount_pct: 5, quota_rpm: 50, quota_tpm: 100000,
    });
    check("gói tồn tại (tạo 201 hoặc đã có)", created || (pack && pack.id), `created=${created} status=${status} — ${String(body).slice(0, 120)}`);
    check("trả về data có id", typeof pack?.id === "string", `got ${JSON.stringify(pack?.id)}`);
    check("ratePerHour đúng", pack?.ratePerHour === 0.95, `got ${pack?.ratePerHour}`);
    check("quotaRpm đúng", pack?.quotaRpm === 50, `got ${pack?.quotaRpm}`);
  }

  // [2] Trùng (segment,gpu,region) → 409
  console.log("\n[2] Trùng (segment,gpu,region) → 409");
  {
    const r = await req("POST", "/v1/price-packs", { headers: H, body: {
      segment: "retail", gpu: "A30", region: "HAN-2", rate_per_hour: 1.0,
    }});
    check("trùng → 409", r.status === 409, `got ${r.status} — ${r.body?.slice(0, 120)}`);
  }

  // [3] Invalid → 400
  console.log("\n[3] Invalid → 400");
  {
    const r = await req("POST", "/v1/price-packs", { headers: H, body: {
      segment: "retail", gpu: "A30", region: "HAN-1", rate_per_hour: -1,
    }});
    check("rate_per_hour âm → 400", r.status === 400, `got ${r.status}`);
    const r2 = await req("POST", "/v1/price-packs", { headers: H, body: {
      segment: "nganh-khong-ton-tai", gpu: "A30", region: "HAN-1", rate_per_hour: 1,
    }});
    check("segment sai → 400", r2.status === 400, `got ${r2.status}`);
  }

  // [4] GET /v1/price-packs?segment=banking → đúng gói seed
  console.log("\n[4] GET /v1/price-packs?segment=banking → gói seed");
  {
    const r = await req("GET", "/v1/price-packs?segment=banking", { headers: H });
    check("GET 200", r.status === 200, `got ${r.status}`);
    const banking = (r.json?.data || []).find((p) => p.segment === "banking" && p.gpu === "H100" && p.region === "HAN-1");
    check("có gói banking H100 HAN-1", !!banking, `data=${JSON.stringify(r.json?.data).slice(0, 120)}`);
    check("banking ratePerHour=12.5", banking && banking.ratePerHour === 12.5, `got ${banking?.ratePerHour}`);
  }

  // [5] GET /v1/price-packs (tất cả) → count >= 3
  console.log("\n[5] GET /v1/price-packs (tất cả)");
  {
    const r = await req("GET", "/v1/price-packs", { headers: H });
    check("GET 200", r.status === 200, `got ${r.status}`);
    check("count >= 3", (r.json?.count || 0) >= 3, `got ${r.json?.count}`);
  }

  // [6] operator (role) POST → 403
  console.log("\n[6] Role operator POST → 403");
  {
    const op = await req("POST", "/v1/keys", { body: { name: "us06-op-" + Date.now(), scopes: ["endpoints", "admin"], role: "operator" } });
    const opKey = op.json?.full_key;
    const r = await req("POST", "/v1/price-packs", { headers: { Authorization: `Bearer ${opKey}` }, body: {
      segment: "manufacturing", gpu: "A30", region: "HAN-1", rate_per_hour: 1,
    }});
    check("operator POST → 403", r.status === 403, `got ${r.status} — ${r.body?.slice(0, 120)}`);
  }

  // [7] viewer GET → 403
  console.log("\n[7] Role viewer GET → 403");
  {
    const vw = await req("POST", "/v1/keys", { body: { name: "us06-vw-" + Date.now(), scopes: ["endpoints", "admin"], role: "viewer" } });
    const vwKey = vw.json?.full_key;
    const r = await req("GET", "/v1/price-packs", { headers: { Authorization: `Bearer ${vwKey}` } });
    check("viewer GET → 403", r.status === 403, `got ${r.status}`);
  }

  // [8] Endpoint banking H100 HAN-1 → rate đúng gói (12.50) + pricePackId
  console.log("\n[8] Endpoint banking H100 HAN-1 → rate gói + pricePackId");
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us06-banking-" + Date.now(), model: "Llama-3.3-70B", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "banking",
    }});
    check("tạo endpoint 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    check("rate = 12.50 (gói)", parseFloat(r.json?.data?.rate) === 12.5, `got ${r.json?.data?.rate}`);
    check("pricePackId khác null", typeof r.json?.data?.pricePackId === "string" && r.json.data.pricePackId.length > 0, `got ${r.json?.data?.pricePackId}`);
  }

  // [9] Endpoint general A30 HAN-1 (không có gói) → rate mặc định + pricePackId null
  console.log("\n[9] Endpoint general A30 HAN-1 (không gói) → rate mặc định");
  {
    const r = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us06-general-" + Date.now(), model: "Llama-3.3-70B", gpu: "A30", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "general",
    }});
    check("tạo endpoint 201", r.status === 201, `got ${r.status}`);
    check("rate mặc định 0.90", parseFloat(r.json?.data?.rate) === 0.9, `got ${r.json?.data?.rate}`);
    check("pricePackId null", r.json?.data?.pricePackId === null, `got ${r.json?.data?.pricePackId}`);
  }

  // [10] Quota RPM: đảm bảo gói coding/A30/HAN-2 quota_rpm=3, endpoint invoke → 429
  console.log("\n[10] Quota RPM → 429 khi vượt");
  {
    const { pack, created, status, body } = await ensurePack(H, {
      segment: "coding", gpu: "A30", region: "HAN-2", rate_per_hour: 0.95, quota_rpm: 3,
    });
    check("gói quota_rpm=3 tồn tại", created || (pack && pack.id), `created=${created} status=${status} — ${String(body).slice(0, 120)}`);
    check("quotaRpm=3", pack?.quotaRpm === 3, `got ${pack?.quotaRpm}`);

    const ce = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us06-quota-" + Date.now(), model: "Llama-3.3-70B", gpu: "A30", region: "HAN-2",
      mode: "k8s", commit: "on-demand", segment: "coding",
    }});
    check("tạo endpoint quota 201", ce.status === 201, `got ${ce.status}`);
    check("endpoint có pricePackId", !!ce.json?.data?.pricePackId, `got ${ce.json?.data?.pricePackId}`);
    const quotaEp = ce.json?.data?.id;
    const st = await waitRunning(quotaEp, adminKey);
    check("endpoint quota running", st === "running", `hiện ${st}`);

    let ok200 = 0, ok429 = 0;
    for (let i = 0; i < 12 && ok429 === 0; i++) {
      const inv = await req("POST", `/v1/endpoints/${quotaEp}/chat/completions`, { headers: H, body: {
        model: "Llama-3.3-70B", messages: [{ role: "user", content: "hello quota test " + i }],
      }});
      if (inv.status === 200) ok200++;
      else if (inv.status === 429) ok429++;
    }
    check("có request 200 trước khi chặn", ok200 >= 1, `ok200=${ok200}`);
    check("vượt quota RPM → 429", ok429 >= 1, `ok429=${ok429} ok200=${ok200}`);
  }

  // [11] Endpoint không có gói → không bị 429 dù invoke nhiều
  console.log("\n[11] Endpoint không gói → không 429");
  {
    const ce = await req("POST", "/v1/endpoints", { headers: H, body: {
      name: "us06-nopack-" + Date.now(), model: "Llama-3.3-70B", gpu: "A30", region: "HAN-1",
      mode: "k8s", commit: "on-demand", segment: "general",
    }});
    const id = ce.json?.data?.id;
    const st = await waitRunning(id, adminKey);
    check("endpoint no-pack running", st === "running", `hiện ${st}`);
    let all200 = true;
    for (let i = 0; i < 5; i++) {
      const inv = await req("POST", `/v1/endpoints/${id}/chat/completions`, { headers: H, body: {
        model: "Llama-3.3-70B", messages: [{ role: "user", content: "no pack " + i }],
      }});
      if (inv.status !== 200) { all200 = false; break; }
    }
    check("5 invoke đều 200 (không quota)", all200, "—");
  }

  console.log(`\n=== US-06: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });