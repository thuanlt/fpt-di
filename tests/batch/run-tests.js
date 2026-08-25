"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";
const TMP = path.join(__dirname, "tmp");
fs.mkdirSync(TMP, { recursive: true });

let pass = 0, fail = 0;
const results = [];

// Auth key scope=batch — tạo 1 lần ở đầu test để gọi được API đã bật auth
let AUTH_KEY = null;

function makeJson(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    const h = { ...headers };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
    if (AUTH_KEY && !h.Authorization) h.Authorization = `Bearer ${AUTH_KEY}`;
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: h }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function req(method, urlPath, { formFields, file, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    let body = null;
    const reqHeaders = { ...headers };
    if (AUTH_KEY && !reqHeaders.Authorization) reqHeaders.Authorization = `Bearer ${AUTH_KEY}`;
    if (file || formFields) {
      const boundary = "----dditest" + Math.random().toString(36).slice(2);
      reqHeaders["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
      let parts = "";
      if (formFields) {
        for (const [k, v] of Object.entries(formFields)) {
          parts += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
        }
      }
      if (file) {
        parts += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n${file.content}\r\n`;
      }
      parts += `--${boundary}--\r\n`;
      body = Buffer.from(parts, "utf8");
      reqHeaders["Content-Length"] = body.length;
    }
    const r = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
      });
    });
    r.on("error", reject);
    if (body) r.write(body);
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
  console.log(`\n=== FPT DDI Batch API — integration test ===`);
  console.log(`base=${BASE}\n`);

  // ---- 0. Setup — tạo key có scope 'batch' để auth mọi call API ----
  {
    const unique = "e2e-batch-" + Date.now();
    const r = await makeJson("POST", "/v1/keys", { name: unique, scopes: ["batch"] });
    if (r.status === 201 && r.json?.full_key) {
      AUTH_KEY = r.json.full_key;
      console.log(`[setup] key ${unique} tạo xong (prefix ${r.json.keyPrefix})\n`);
    } else {
      // fallback: rotate 1 key cũ còn active có scope 'batch'
      const lst = await makeJson("GET", "/v1/keys");
      const found = (lst.json?.data || []).find((k) => k.status === "active" && (k.scopes || []).includes("batch"));
      if (!found) { console.error("Không có key batch nào để rotate — abort"); process.exit(2); }
      const rr = await makeJson("POST", `/v1/keys/${found.id}/rotate`);
      AUTH_KEY = rr.json?.full_key;
      console.log(`[setup] reuse + rotate key ${found.id} (prefix ${found.keyPrefix})\n`);
    }
  }

  // ---- 1. Health ----
  console.log("[1] GET /health");
  {
    const r = await req("GET", "/health");
    check("status 200", r.status === 200, `got ${r.status}`);
    if (r.json) {
      check("worker running", r.json.workers?.batch === true, JSON.stringify(r.json));
    }
  }

  // ---- 2. GET /v1/models ----
  console.log("\n[2] GET /v1/models");
  {
    const r = await req("GET", "/v1/models");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("≥6 models", r.json?.count >= 6, JSON.stringify(r.json?.count));
    check("FPT-LLM 8B (vi) có mặt", r.json?.data?.some((m) => m.id === "FPT-LLM 8B (vi)"), "—");
    check("GLM-5.2 có 50% discount", r.json?.data?.find((m) => m.id === "GLM-5.2").discount === "50%", "—");
  }

  // ---- 3. POST /v1/batch (file JSONL chuẩn) ----
  console.log("\n[3] POST /v1/batch (upload JSONL chuẩn)");
  const sampleJsonl = [
    { model: "PhoGPT-4B", messages: [{ role: "user", content: "Xin chào" }] },
    { prompt: "Viết slogan FPT dedicated inference" },
    { messages: [{ role: "system", content: "trả lời ngắn" }, { role: "user", content: "1+1=" }] },
  ].map((o) => JSON.stringify(o)).join("\n");
  const goodFile = path.join(TMP, "good.jsonl");
  fs.writeFileSync(goodFile, sampleJsonl);
  const goodContent = fs.readFileSync(goodFile, "utf8");
  let goodJobId = null;
  {
    const r = await req("POST", "/v1/batch", {
      formFields: { model: "PhoGPT-4B", max_tokens: "128" },
      file: { name: "good.jsonl", content: goodContent },
    });
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    check("status=queued", r.json?.status === "queued", JSON.stringify(r.json));
    check("requests=3", r.json?.requests === 3, JSON.stringify(r.json));
    check("discount=−50%", r.json?.discount === "−50%" || r.json?.discount === "-50%", JSON.stringify(r.json));
    if (r.json?.id) goodJobId = r.json.id;
  }

  // ---- 4. GET /v1/batch (list) ----
  console.log("\n[4] GET /v1/batch (list sau khi upload)");
  {
    const r = await req("GET", "/v1/batch");
    check("status 200", r.status === 200);
    check("list có job vừa tạo", r.json?.data?.some((j) => j.id === goodJobId), "—");
  }

  // ---- 5. POST /v1/batch (file sai - JSON không hợp lệ) ----
  console.log("\n[5] POST /v1/batch (file sai JSON)");
  {
    const r = await req("POST", "/v1/batch", {
      formFields: { model: "PhoGPT-4B" },
      file: { name: "bad.jsonl", content: "not-a-json-line\n{also broken, " },
    });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("error có detail", !!r.json?.error, JSON.stringify(r.json));
  }

  // ---- 6. POST /v1/batch (sai model) ----
  console.log("\n[6] POST /v1/batch (sai model)");
  {
    const r = await req("POST", "/v1/batch", {
      formFields: { model: "NonExistent-Model" },
      file: { name: "x.jsonl", content: '{"prompt":"hi"}\n' },
    });
    check("status 400 — model không thuộc list", r.status === 400, `got ${r.status}`);
  }

  // ---- 7. POST /v1/batch (thiếu file) ----
  console.log("\n[7] POST /v1/batch (thiếu file)");
  {
    const r = await req("POST", "/v1/batch", { formFields: { model: "PhoGPT-4B" } });
    check("status 400 — thiếu file", r.status === 400, `got ${r.status}`);
  }

  // ---- 8. POST /v1/batch (vượt 50K requests) ----
  console.log("\n[8] POST /v1/batch (vượt giới hạn 50K)");
  {
    const lines = [];
    for (let i = 0; i < 50001; i++) lines.push(JSON.stringify({ prompt: String(i) }));
    const content = lines.join("\n");
    const r = await req("POST", "/v1/batch", {
      formFields: { model: "PhoGPT-4B" },
      file: { name: "big.jsonl", content },
    });
    check("status 400 — vượt 50K", r.status === 400, `got ${r.status} — ${r.body?.slice(0, 200)}`);
  }

  // ---- 9. GET /v1/batch/:id status ----
  console.log("\n[9] GET /v1/batch/:id — theo dõi trạng thái");
  {
    const r = await req("GET", `/v1/batch/${goodJobId}`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("id khớp", r.json?.data?.id === goodJobId, JSON.stringify(r.json));
    check("có trạng thái", !!r.json?.data?.status, "—");
  }

  // ---- 10. Worker xử lý (đợi ≤30s cho tới completed/failed) ----
  console.log("\n[10] Worker xử lý — đợi job chuyển trạng thái");
  let finalStatus = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const r = await req("GET", `/v1/batch/${goodJobId}`);
    finalStatus = r.json?.data?.status;
    if (finalStatus === "completed" || finalStatus === "failed") break;
    await sleep(2000);
  }
  check(`job kết thúc (status=${finalStatus})`,
    finalStatus === "completed" || finalStatus === "failed",
    `hiện ${finalStatus}`);

  // ---- 11. GET output ----
  console.log("\n[11] GET /v1/batch/:id/output — tải kết quả");
  {
    const r = await req("GET", `/v1/batch/${goodJobId}/output`);
    if (r.status === 200) {
      check("status 200", true);
      const lines = r.body.split(/\r?\n/).filter(Boolean);
      check("output có ≥3 dòng (mỗi request 1 dòng)", lines.length >= 3, `got ${lines.length}`);
      const firstRes = JSON.parse(lines[0]);
      check("dòng đầu có 'id' field", typeof firstRes.id === "number", JSON.stringify(firstRes).slice(0, 200));
      check("dòng đầu có usage hoặc error", "usage" in firstRes || "error" in firstRes, "—");
    } else {
      check(`output tải được (status=${r.status})`, false, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    }
  }

  // ---- 12. GET /v1/batch/_/stats ----
  console.log("\n[12] GET /v1/batch/_/stats — thống kê hệ thống");
  {
    const r = await req("GET", "/v1/batch/_/stats");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("field 'submitted' ≥1", r.json?.data?.submitted >= 1, JSON.stringify(r.json));
  }

  // ---- Done ----
  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  console.log("");
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
