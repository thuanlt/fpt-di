"use strict";

// US-04 — Trích xuất tài liệu bảo hiểm (contract/claim) + guardrails y tế
// Chạy: node tests/us04-document/run-tests.js  (BASE=http://localhost:5173)

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

// Upload multipart/form-data (field + file)
function uploadDoc(path, { key, fields = {}, filename, fileContent, fileIsBuffer = false }) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const boundary = "----ddi" + Math.random().toString(36).slice(2);
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
      ));
    }
    const fileBuf = fileIsBuffer ? fileContent : Buffer.from(fileContent, "utf8");
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ));
    parts.push(fileBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);
    const h = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
    };
    if (key) h["Authorization"] = "Bearer " + key;
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "POST", headers: h }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, body: buf, json });
      });
    });
    r.on("error", reject);
    r.write(body);
    r.end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Chờ job chuyển sang completed/failed
async function waitJob(id, key, timeoutMs = 20000) {
  const t0 = Date.now();
  let job = null;
  while (Date.now() - t0 < timeoutMs) {
    const g = await req("GET", `/v1/documents/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    job = g.json?.data || null;
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    await sleep(500);
  }
  return job;
}

// Nội dung mẫu
const CONTRACT_TEXT = [
  "Insurance Contract",
  "Party Name: ABC Corporation",
  "Policy Number: POL-12345",
  "Sum Insured: 1,000,000",
  "Term Start: 2026-01-01",
  "Term End: 2026-12-31",
  "Premium: 25,000",
  "Insurer: FPT Insurance",
].join("\n");

const CLAIM_TEXT = [
  "Insurance Claim",
  "Claim Number: CLM-67890",
  "Claimant: John Doe",
  "Incident Date: 2026-03-15",
  "Amount Claimed: 50,000",
  "Status: pending",
].join("\n");

// Claim chứa thông tin y tế nhạy cảm → redact
const MEDICAL_CLAIM_TEXT = [
  "Insurance Claim",
  "Claim Number: CLM-11111",
  "Claimant: Jane Smith",
  "Incident Date: 2026-04-01",
  "Amount Claimed: 100,000",
  "Status: under review",
  "Diagnosis: fracture of left arm",
  "Prescription: pain medication",
].join("\n");

// File lỗi — binary garbage (không đọc được)
const BAD_FILE_BUFFER = Buffer.from([
  0x00, 0xff, 0xfe, 0x01, 0x02, 0x03, 0x80, 0x81, 0x82, 0x00, 0x00, 0xff,
  0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05,
  0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x00, 0xff, 0xfe, 0x00, 0x00, 0x00,
]);

async function main() {
  console.log(`\n=== US-04 Trích xuất tài liệu bảo hiểm — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // Setup keys
  let adminKey = null, noScopeKey = null, viewerKey = null;
  {
    const a = await req("POST", "/v1/keys", { body: { name: "us04-admin-" + Date.now(), scopes: ["endpoints", "admin"], role: "admin" } });
    adminKey = a.json?.full_key;
    check("setup admin key", !!adminKey, `got ${a.status}`);
    const n = await req("POST", "/v1/keys", { body: { name: "us04-noscope-" + Date.now(), scopes: ["chat"], role: "admin" } });
    noScopeKey = n.json?.full_key;
    const v = await req("POST", "/v1/keys", { body: { name: "us04-viewer-" + Date.now(), scopes: ["endpoints"], role: "viewer" } });
    viewerKey = v.json?.full_key;
    check("setup no-scope + viewer keys", !!noScopeKey && !!viewerKey, "—");
  }
  const H = { Authorization: `Bearer ${adminKey}` };

  // [1] Upload hợp đồng (contract) → completed + fields đúng
  console.log("\n[1] Upload contract → completed + fields đúng");
  let contractId = null;
  {
    const r = await uploadDoc("/v1/documents", { key: adminKey, fields: { doc_type: "contract", segment: "insurance" }, filename: "contract.txt", fileContent: CONTRACT_TEXT });
    check("upload contract 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 150)}`);
    contractId = r.json?.id;
    check("trả về job id", typeof contractId === "string", `got ${contractId}`);
    check("status=queued", r.json?.status === "queued", `got ${r.json?.status}`);

    const job = await waitJob(contractId, adminKey);
    check("job completed", job?.status === "completed", `hiện ${job?.status} — ${job?.error || ""}`);
    const f = job?.fields || {};
    check("party_name đúng", f.party_name === "ABC Corporation", `got ${f.party_name}`);
    check("policy_number đúng", f.policy_number === "POL-12345", `got ${f.policy_number}`);
    check("sum_insured đúng", f.sum_insured === "1,000,000", `got ${f.sum_insured}`);
    check("term_start đúng", f.term_start === "2026-01-01", `got ${f.term_start}`);
    check("term_end đúng", f.term_end === "2026-12-31", `got ${f.term_end}`);
    check("premium đúng", f.premium === "25,000", `got ${f.premium}`);
    check("insurer đúng", f.insurer === "FPT Insurance", `got ${f.insurer}`);
    check("confidence = 1.0 (7/7 trường)", job?.confidence === 1, `got ${job?.confidence}`);
    check("redacted=false", job?.redacted === false, `got ${job?.redacted}`);
  }

  // [2] Upload claim → fields claim đúng
  console.log("\n[2] Upload claim → fields claim đúng");
  let claimId = null;
  {
    const r = await uploadDoc("/v1/documents", { key: adminKey, fields: { doc_type: "claim", segment: "insurance" }, filename: "claim.txt", fileContent: CLAIM_TEXT });
    check("upload claim 201", r.status === 201, `got ${r.status}`);
    claimId = r.json?.id;
    const job = await waitJob(claimId, adminKey);
    check("job completed", job?.status === "completed", `hiện ${job?.status} — ${job?.error || ""}`);
    const f = job?.fields || {};
    check("claim_number đúng", f.claim_number === "CLM-67890", `got ${f.claim_number}`);
    check("claimant_name đúng", f.claimant_name === "John Doe", `got ${f.claimant_name}`);
    check("incident_date đúng", f.incident_date === "2026-03-15", `got ${f.incident_date}`);
    check("amount_claimed đúng", f.amount_claimed === "50,000", `got ${f.amount_claimed}`);
    check("status đúng", f.status === "pending", `got ${f.status}`);
    check("redacted=false", job?.redacted === false, `got ${job?.redacted}`);
  }

  // [3] Tài liệu y tế → redacted=true, fields bị che
  console.log("\n[3] Tài liệu y tế → redacted=true, fields bị che");
  {
    const r = await uploadDoc("/v1/documents", { key: adminKey, fields: { doc_type: "claim", segment: "insurance" }, filename: "medical-claim.txt", fileContent: MEDICAL_CLAIM_TEXT });
    check("upload medical 201", r.status === 201, `got ${r.status}`);
    const medId = r.json?.id;
    const job = await waitJob(medId, adminKey);
    check("job completed", job?.status === "completed", `hiện ${job?.status} — ${job?.error || ""}`);
    check("redacted=true", job?.redacted === true, `got ${job?.redacted}`);
    const f = job?.fields || {};
    check("claim_number bị redact", f.claim_number === "[REDACTED]", `got ${f.claim_number}`);
    check("claimant_name bị redact", f.claimant_name === "[REDACTED]", `got ${f.claimant_name}`);
    check("amount_claimed bị redact", f.amount_claimed === "[REDACTED]", `got ${f.amount_claimed}`);
  }

  // [4] File lỗi (binary) → failed + error rõ
  console.log("\n[4] File lỗi (binary) → failed + error rõ");
  {
    const r = await uploadDoc("/v1/documents", { key: adminKey, fields: { doc_type: "contract", segment: "insurance" }, filename: "bad.txt", fileContent: BAD_FILE_BUFFER, fileIsBuffer: true });
    check("upload bad file 201", r.status === 201, `got ${r.status}`);
    const badId = r.json?.id;
    const job = await waitJob(badId, adminKey);
    check("job failed", job?.status === "failed", `hiện ${job?.status}`);
    check("error rõ ràng", typeof job?.error === "string" && job.error.length > 0, `got ${job?.error}`);
  }

  // [5] Lọc list theo segment/status
  console.log("\n[5] Lọc list theo segment/status");
  {
    const all = await req("GET", "/v1/documents", { headers: H });
    check("GET list 200", all.status === 200, `got ${all.status}`);
    check("count >= 4", (all.json?.count || 0) >= 4, `got ${all.json?.count}`);

    const ins = await req("GET", "/v1/documents?segment=insurance", { headers: H });
    check("lọc segment=insurance 200", ins.status === 200, `got ${ins.status}`);
    const allIns = (ins.json?.data || []).every((j) => j.segment === "insurance");
    check("tất cả segment=insurance", allIns, "—");

    const comp = await req("GET", "/v1/documents?status=completed", { headers: H });
    check("lọc status=completed 200", comp.status === 200, `got ${comp.status}`);
    const allComp = (comp.json?.data || []).every((j) => j.status === "completed");
    check("tất cả status=completed", allComp, "—");

    const failed = await req("GET", "/v1/documents?status=failed", { headers: H });
    check("lọc status=failed có job failed", (failed.json?.count || 0) >= 1, `got ${failed.json?.count}`);
  }

  // [6] Confirm (sửa thủ công) → fields cập nhật
  console.log("\n[6] Confirm (sửa thủ công) → fields cập nhật");
  {
    const g = await req("GET", `/v1/documents/${contractId}`, { headers: H });
    const orig = g.json?.data?.fields || {};
    const edited = { ...orig, premium: "30,000", insurer: "FPT Insurance (confirmed)" };
    const c = await req("POST", `/v1/documents/${contractId}/confirm`, { headers: H, body: { fields: edited } });
    check("confirm 200", c.status === 200, `got ${c.status} — ${c.body?.slice(0, 150)}`);
    check("premium cập nhật", c.json?.data?.fields?.premium === "30,000", `got ${c.json?.data?.fields?.premium}`);
    check("insurer cập nhật", c.json?.data?.fields?.insurer === "FPT Insurance (confirmed)", `got ${c.json?.data?.fields?.insurer}`);
    // verify lại
    const g2 = await req("GET", `/v1/documents/${contractId}`, { headers: H });
    check("fields lưu lại (GET)", g2.json?.data?.fields?.premium === "30,000", `got ${g2.json?.data?.fields?.premium}`);
  }

  // [7] Auth: 401 (không key) / 403 (thiếu scope) / 403 (viewer confirm)
  console.log("\n[7] Auth 401/403");
  {
    const noAuth = await req("GET", "/v1/documents");
    check("không key → 401", noAuth.status === 401, `got ${noAuth.status}`);

    const noScope = await req("GET", "/v1/documents", { headers: { Authorization: `Bearer ${noScopeKey}` } });
    check("thiếu scope endpoints → 403", noScope.status === 403, `got ${noScope.status}`);

    // viewer (có scope endpoints) upload được nhưng confirm → 403
    const vUpload = await uploadDoc("/v1/documents", { key: viewerKey, fields: { doc_type: "contract", segment: "general" }, filename: "viewer.txt", fileContent: CONTRACT_TEXT });
    check("viewer upload 201 (scope endpoints)", vUpload.status === 201, `got ${vUpload.status}`);
    const vConfirm = await req("POST", `/v1/documents/${contractId}/confirm`, { headers: { Authorization: `Bearer ${viewerKey}` }, body: { fields: { premium: "x" } } });
    check("viewer confirm → 403 (role)", vConfirm.status === 403, `got ${vConfirm.status}`);
  }

  // [8] 404 job không tồn tại
  console.log("\n[8] 404 job không tồn tại");
  {
    const r = await req("GET", "/v1/documents/doc-khong-ton-tai", { headers: H });
    check("GET job sai → 404", r.status === 404, `got ${r.status}`);
  }

  console.log(`\n=== US-04: ${pass} pass, ${fail} fail ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });