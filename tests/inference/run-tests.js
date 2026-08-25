"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = process.env.DDI_BASE || "http://localhost:5173";
const TMP = path.join(__dirname, "tmp");
fs.mkdirSync(TMP, { recursive: true });

let pass = 0, fail = 0;
const results = [];

function req(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
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
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function reqStream(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    const payload = JSON.stringify(body);
    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let buf = "";
      const chunks = [];
      res.on("data", (c) => { buf += c.toString(); chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: buf, chunks }));
    });
    r.on("error", reject);
    r.write(payload);
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
  console.log(`\n=== FPT DDI Inference API (/v1/chat/completions) — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // 1. POST không stream — response đầy đủ
  console.log("[1] POST /v1/chat/completions (không stream)");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "Xin chào FPT DDI" }] },
    });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("object='chat.completion'", r.json?.object === "chat.completion", "—");
    check("có id", typeof r.json?.id === "string", "—");
    check("model khớp", r.json?.model === "PhoGPT-4B", "—");
    const content = r.json?.choices?.[0]?.message?.content || "";
    check("content có 'hash='", content.includes("hash="), content.slice(0, 100));
    check("content có 'echo:'", content.includes("echo:"), "—");
    check("content có 'reversed:'", content.includes("reversed:"), "—");
    check("content có 'data-residency=VN'", content.includes("data-residency=VN"), "—");
    check("usage.prompt_tokens > 0", (r.json?.usage?.prompt_tokens || 0) > 0, "—");
    check("usage.completion_tokens > 0", (r.json?.usage?.completion_tokens || 0) > 0, "—");
    check("usage.total_tokens = sum", r.json?.usage?.total_tokens === (r.json?.usage?.prompt_tokens + r.json?.usage?.completion_tokens), "—");
    check("cost_usd là string", typeof r.json?.cost_usd === "string" && parseFloat(r.json?.cost_usd) > 0, "—");
    check("finish_reason='stop'", r.json?.choices?.[0]?.finish_reason === "stop", "—");
  }

  // 2. Deterministic — cùng input ra cùng output (verify 2 lần)
  console.log("\n[2] Deterministic — cùng input → cùng output");
  {
    const r1 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "test-deterministic-123" }] },
    });
    const r2 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "test-deterministic-123" }] },
    });
    const c1 = r1.json?.choices?.[0]?.message?.content || "";
    const c2 = r2.json?.choices?.[0]?.message?.content || "";
    check("2 lần gọi ra cùng content", c1 === c2, "— khác nhau —");
    check("content chứa hash cố định", c1.includes("hash=") && c2.includes("hash="), "—");
  }

  // 3. POST có stream — SSE format
  console.log("\n[3] POST /v1/chat/completions (stream=true)");
  {
    const r = await reqStream("/v1/chat/completions", {
      model: "GLM-5.2", messages: [{ role: "user", content: "stream test" }], stream: true,
    });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("Content-Type text/event-stream", (r.headers["content-type"] || "").includes("text/event-stream"), r.headers["content-type"]);
    const body = r.body || "";
    check("body có 'data: '", body.includes("data: "), "—");
    check("body có '[DONE]'", body.includes("[DONE]"), "—");
    const lines = body.split("\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
    check("≥1 chunk SSE", lines.length >= 1, `got ${lines.length}`);
    let totalDelta = "";
    for (const l of lines) {
      try {
        const obj = JSON.parse(l.slice(6));
        const d = obj.choices?.[0]?.delta?.content || "";
        totalDelta += d;
      } catch (_) {}
    }
    check("streamed content có 'hash='", totalDelta.includes("hash="), totalDelta.slice(0, 100));
    check("streamed content có 'echo:'", totalDelta.includes("echo:"), "—");
  }

  // 4. POST thiếu model → 400
  console.log("\n[4] POST thiếu model → 400");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { messages: [{ role: "user", content: "x" }] },
    });
    check("status 400", r.status === 400, `got ${r.status}`);
    check("error.type='invalid_request_error'", r.json?.error?.type === "invalid_request_error", "—");
  }

  // 5. POST thiếu messages → 400
  console.log("\n[5] POST thiếu messages → 400");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B" },
    });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 6. GET /v1/chat/models
  console.log("\n[6] GET /v1/chat/models — list model khả dụng");
  {
    const r = await req("GET", "/v1/chat/models");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("object='list'", r.json?.object === "list", "—");
    check("≥6 model", r.json?.data?.length >= 6, `got ${r.json?.data?.length}`);
    check("có PhoGPT-4B", r.json?.data?.some((m) => m.id === "PhoGPT-4B"), "—");
    check("có in_per_million", typeof r.json?.data?.[0]?.in_per_million === "number", "—");
  }

  // 7. System message được tôn trọng
  console.log("\n[7] System message — content khác khi system khác");
  {
    const r1 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "system", content: "sys-A" }, { role: "user", content: "same" }] },
    });
    const r2 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "system", content: "sys-B" }, { role: "user", content: "same" }] },
    });
    const c1 = r1.json?.choices?.[0]?.message?.content || "";
    const c2 = r2.json?.choices?.[0]?.message?.content || "";
    check("system khác → hash khác", c1 !== c2, "— giống —");
  }

  // 8. Verify batch job giờ chạy tới completed (vì INFERENCE_URL đã cấu hình)
  console.log("\n[8] Batch job chạy tới completed (inference thật)");
  {
    // tạo 1 key scope batch
    const kr = await req("POST", "/v1/keys", { body: { name: "e2e-inference-" + Date.now(), scopes: ["batch"] } });
    const key = kr.json?.full_key;
    if (!key) { check("tạo key batch", false, "không tạo được key"); process.exit(2); }

    // submit 1 batch nhỏ
    const jsonl = '{"prompt":"hello inference test"}\n{"prompt":"second request"}\n';
    const boundary = "----dditest" + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nPhoGPT-4B\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="t.jsonl"\r\nContent-Type: application/octet-stream\r\n\r\n${jsonl}\r\n--${boundary}--\r\n`;
    const sr = await new Promise((resolve, reject) => {
      const url = new URL(BASE + "/v1/batch");
      const r = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": Buffer.byteLength(body), Authorization: `Bearer ${key}` },
      }, (res) => { let buf = ""; res.on("data", (c) => (buf += c)); res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); } catch (_) { resolve({ status: res.statusCode, body: buf }); } }); });
      r.on("error", reject); r.write(body); r.end();
    });
    check("submit batch status 201", sr.status === 201, `got ${sr.status}`);
    const jobId = sr.json?.id;
    check("có jobId", typeof jobId === "string", "—");

    // poll tới completed/failed (timeout 60s)
    let status = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const r = await req("GET", `/v1/batch/${jobId}`, { headers: { Authorization: `Bearer ${key}` } });
      status = r.json?.data?.status;
      if (status === "completed" || status === "failed") break;
      await sleep(2000);
    }
    check(`batch chạy tới "${status}"`, status === "completed", `hiện ${status} (mong đợi completed)`);

    // verify output có content thật (hash, echo, reversed)
    if (status === "completed") {
      const outRes = await req("GET", `/v1/batch/${jobId}/output`, { headers: { Authorization: `Bearer ${key}` } });
      check("output status 200", outRes.status === 200, `got ${outRes.status}`);
      const lines = (outRes.body || "").split(/\r?\n/).filter(Boolean);
      check("output có 2 dòng", lines.length === 2, `got ${lines.length}`);
      if (lines.length) {
        const first = JSON.parse(lines[0]);
        check("output dòng 1 có response.content", !!first.response?.content, JSON.stringify(first).slice(0, 150));
        check("output dòng 1 có 'hash='", (first.response?.content || "").includes("hash="), "—");
        check("output dòng 1 có usage.prompt_tokens", typeof first.usage?.prompt_tokens === "number", "—");
        check("output dòng 1 có price.batch_usd", typeof first.price?.batch_usd === "string", "—");
      }
    }
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
