"use strict";

// e2e test cho /v1/chat/completions — THIẾT KẾ HIỆN TẠI: proxy → vllm-adapter.
// (server.js đăng ký proxy TRƯỚC inferenceRouter legacy, nên mọi POST
//  /v1/chat/completions đều đi qua vllm-adapter — OpenAI-compat, NON-deterministic.)
//
// Hành vi vllm-adapter (đã probe thực tế):
//  - non-stream: 200, object='chat.completion', id='chatcmpl-vllm-*', model khớp,
//    finish_reason='stop', usage{prompt_tokens,completion_tokens,total_tokens}.
//    KHÔNG có field cost_usd. content = text mô phỏng (gen=*, prompt:, reversed:,
//    seed:, data-residency=VN · vllm-adapter) — KHÔNG có 'hash='/'echo:'.
//  - stream: 200, text/event-stream, các chunk 'data: {...chat.completion.chunk...}'
//    (delta.content), chunk cuối finish_reason='stop' + usage, rồi 'data: [DONE]'.
//  - thiếu model    → 404 { error:{ type:'invalid_request_error', code:'model_not_found' } }
//  - thiếu messages → 400 { error:{ type:'invalid_request_error' } }
//  - GET /v1/chat/models vẫn do inferenceRouter legacy serve (8 model, in_per_million).

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

function reqStream(urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    const payload = JSON.stringify(body);
    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
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
  console.log(`\n=== FPT DDI Inference API (/v1/chat/completions) — e2e test (vllm-adapter) ===`);
  console.log(`base=${BASE}\n`);

  // 0. Tạo API key scope 'playground' — /v1/chat/completions bị gate scope này (server.js pathScope)
  const kr = await req("POST", "/v1/keys", { body: { name: "inference-e2e-" + Date.now(), scopes: ["playground"] } });
  const KEY = kr.json?.full_key;
  if (!KEY) { console.error("FATAL: không tạo được key scope playground —", kr.status, kr.body?.slice(0, 200)); process.exit(2); }
  const AUTH = { Authorization: "Bearer " + KEY };
  console.log("[0] Đã tạo key scope playground:", kr.json?.id);

  // 1. POST không stream — response OpenAI-compat (vllm-adapter)
  console.log("[1] POST /v1/chat/completions (không stream)");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "Xin chào FPT DDI" }] },
      headers: AUTH,
    });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("object='chat.completion'", r.json?.object === "chat.completion", `got ${r.json?.object}`);
    check("có id", typeof r.json?.id === "string" && r.json.id.length > 0, "—");
    check("model khớp", r.json?.model === "PhoGPT-4B", `got ${r.json?.model}`);
    const content = r.json?.choices?.[0]?.message?.content || "";
    check("content non-empty", content.length > 0, "—");
    check("usage.prompt_tokens > 0", (r.json?.usage?.prompt_tokens || 0) > 0, `got ${r.json?.usage?.prompt_tokens}`);
    check("usage.completion_tokens > 0", (r.json?.usage?.completion_tokens || 0) > 0, `got ${r.json?.usage?.completion_tokens}`);
    check("usage.total_tokens = sum", r.json?.usage?.total_tokens === (r.json?.usage?.prompt_tokens + r.json?.usage?.completion_tokens),
      `got total=${r.json?.usage?.total_tokens} sum=${(r.json?.usage?.prompt_tokens || 0) + (r.json?.usage?.completion_tokens || 0)}`);
    check("finish_reason='stop'", r.json?.choices?.[0]?.finish_reason === "stop", `got ${r.json?.choices?.[0]?.finish_reason}`);
  }

  // 2. vllm-adapter NON-deterministic — chỉ verify 2 call đều 200 + content non-empty
  console.log("\n[2] 2 call liên tiếp đều 200 + content non-empty (non-deterministic)");
  {
    const r1 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "test-run-123" }] },
      headers: AUTH,
    });
    const r2 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "user", content: "test-run-123" }] },
      headers: AUTH,
    });
    const c1 = r1.json?.choices?.[0]?.message?.content || "";
    const c2 = r2.json?.choices?.[0]?.message?.content || "";
    check("call 1 status 200", r1.status === 200, `got ${r1.status}`);
    check("call 2 status 200", r2.status === 200, `got ${r2.status}`);
    check("call 1 content non-empty", c1.length > 0, "—");
    check("call 2 content non-empty", c2.length > 0, "—");
  }

  // 3. POST có stream — SSE format
  console.log("\n[3] POST /v1/chat/completions (stream=true)");
  {
    const r = await reqStream("/v1/chat/completions", {
      model: "GLM-5.2", messages: [{ role: "user", content: "stream test" }], stream: true,
    }, AUTH);
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
    check("streamed content non-empty", totalDelta.length > 0, totalDelta.slice(0, 100));
  }

  // 4. POST thiếu model → 404 (vllm-adapter: model_not_found)
  console.log("\n[4] POST thiếu model → 404");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { messages: [{ role: "user", content: "x" }] },
      headers: AUTH,
    });
    check("status 404", r.status === 404, `got ${r.status}`);
    check("error.type='invalid_request_error'", r.json?.error?.type === "invalid_request_error", `got ${r.json?.error?.type}`);
  }

  // 5. POST thiếu messages → 400
  console.log("\n[5] POST thiếu messages → 400");
  {
    const r = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B" },
      headers: AUTH,
    });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 6. GET /v1/chat/models
  console.log("\n[6] GET /v1/chat/models — list model khả dụng");
  {
    const r = await req("GET", "/v1/chat/models");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("object='list'", r.json?.object === "list", `got ${r.json?.object}`);
    check("≥6 model", r.json?.data?.length >= 6, `got ${r.json?.data?.length}`);
    check("có PhoGPT-4B", r.json?.data?.some((m) => m.id === "PhoGPT-4B"), "—");
    check("có in_per_million", typeof r.json?.data?.[0]?.in_per_million === "number", "—");
  }

  // 7. vllm-adapter non-deterministic — 2 call (system khác nhau) đều 200 + content non-empty
  console.log("\n[7] System message — 2 call đều 200 + content non-empty");
  {
    const r1 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "system", content: "sys-A" }, { role: "user", content: "same" }] },
      headers: AUTH,
    });
    const r2 = await req("POST", "/v1/chat/completions", {
      body: { model: "PhoGPT-4B", messages: [{ role: "system", content: "sys-B" }, { role: "user", content: "same" }] },
      headers: AUTH,
    });
    const c1 = r1.json?.choices?.[0]?.message?.content || "";
    const c2 = r2.json?.choices?.[0]?.message?.content || "";
    check("call 1 status 200", r1.status === 200, `got ${r1.status}`);
    check("call 2 status 200", r2.status === 200, `got ${r2.status}`);
    check("call 1 content non-empty", c1.length > 0, "—");
    check("call 2 content non-empty", c2.length > 0, "—");
  }

  // 8. Verify batch job chạy tới completed (inference thật qua vllm-adapter)
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

    // verify output có content thật (vllm-adapter)
    if (status === "completed") {
      const outRes = await req("GET", `/v1/batch/${jobId}/output`, { headers: { Authorization: `Bearer ${key}` } });
      check("output status 200", outRes.status === 200, `got ${outRes.status}`);
      const lines = (outRes.body || "").split(/\r?\n/).filter(Boolean);
      check("output có 2 dòng", lines.length === 2, `got ${lines.length}`);
      if (lines.length) {
        const first = JSON.parse(lines[0]);
        check("output dòng 1 có response.content", !!first.response?.content, JSON.stringify(first).slice(0, 150));
        check("output dòng 1 content non-empty", (first.response?.content || "").length > 0, "—");
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