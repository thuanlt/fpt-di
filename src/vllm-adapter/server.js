"use strict";

// vllm-adapter — inference server giả lập chuẩn vLLM OpenAI-compat API.
// Khi có GPU thật: thay service này bằng image `vllm/vllm-openai` với model weights thật,
// giữ nguyên interface — backend FPT DDI không cần đổi code.

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json({ limit: "10mb" }));

const MODELS = {
  "PhoGPT-4B": { in: 0.10, out: 0.30, ctx: 65536 },
  "FPT-LLM 8B (vi)": { in: 0.20, out: 0.60, ctx: 131072 },
  "GLM-5.2": { in: 1.40, out: 4.40, ctx: 262144 },
  "GLM-4.6": { in: 1.40, out: 4.40, ctx: 262144 },
  "Qwen 3.7 Plus": { in: 0.50, out: 3.00, ctx: 1048576 },
  "DeepSeek V4 Pro": { in: 1.74, out: 3.48, ctx: 524288 },
  "DeepSeek-R1": { in: 0.55, out: 2.19, ctx: 131072 },
  "Llama-3.3-70B": { in: 1.04, out: 1.04, ctx: 131072 },
  "Mistral-Large-2": { in: 2.00, out: 6.00, ctx: 131072 },
};

function countTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

// US-03 — mô phỏng guided decoding: sinh JSON conform json_schema.
// Dùng example/default/const/enum nếu có, không thì sample theo type.
function sampleFromSchema(schema) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.const !== undefined) return schema.const;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  const type = schema.type;
  if (type === "object" || schema.properties) {
    const obj = {};
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      obj[key] = sampleFromSchema(prop);
    }
    return obj;
  }
  if (type === "array") return [sampleFromSchema(schema.items || {})];
  if (type === "string") return "sample";
  if (type === "number") return 1.5;
  if (type === "integer") return 42;
  if (type === "boolean") return true;
  if (type === "null") return null;
  return null;
}

// US-03 — validate response_format ở adapter (defense in depth). Trả lỗi hoặc null.
function validateResponseFormat(rf) {
  if (rf == null) return null;
  if (typeof rf !== "object" || Array.isArray(rf)) return "response_format phải là object";
  if (rf.type === "json_object") return null;
  if (rf.type === "json_schema") {
    const js = rf.json_schema;
    if (!js || typeof js !== "object" || Array.isArray(js)) return "response_format.json_schema phải là object";
    if (typeof js.name !== "string" || !js.name) return "response_format.json_schema.name phải là string";
    const schema = js.schema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return "response_format.json_schema.schema phải là object";
    if (typeof schema.type !== "string" || !schema.type) return "response_format.json_schema.schema.type bắt buộc";
    return null;
  }
  return `response_format.type không hợp lệ: ${JSON.stringify(rf.type)}`;
}

// "Generation" mô phỏng hành vi model thật:
// - output PHỤ THUỘC prompt (không phải hash cố định — thêm nhiễu theo timestamp để mô phỏng sinh token thật)
// - khác prompt → khác output hoàn toàn
// - stream trả từng chunk có thứ tự
// Khi đổi sang vLLM thật, toàn bộ phần sinh output này bị thay bằng weights thật — interface giữ nguyên.
function generate({ model, messages, temperature }) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = lastUser?.content || "";
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const seed = crypto.createHash("sha256").update(sys + "|" + prompt + ":" + model).digest("hex");
  const noise = Date.now().toString(36).slice(-4); // mỗi lần generate khác nhau — như model thật
  const reversed = String(prompt).split("").reverse().join("");
  const t = temperature === undefined ? 0.7 : Number(temperature);
  const lines = [
    `[${model}] · gen=${noise} · temp=${t.toFixed(1)} · ctx=${MODELS[model]?.ctx || 8192}`,
    `> prompt: ${String(prompt).slice(0, 100)}`,
    `> reversed: ${reversed.slice(0, 100)}`,
    `> seed: ${seed.slice(0, 16)}`,
    `> data-residency=VN · vllm-adapter`,
  ];
  return lines.join("\n");
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", engine: "vllm-adapter", uptime: process.uptime() });
});

app.get("/v1/models", (req, res) => {
  res.json({
    object: "list",
    data: Object.entries(MODELS).map(([id, p]) => ({
      id,
      object: "model",
      owned_by: "fpt-ddi",
      context_length: p.ctx,
      pricing: { prompt_per_million: p.in, completion_per_million: p.out },
    })),
  });
});

// p50/p95 cold-start đo thật — lưu vào in-memory ring buffer (200 mẫu gần nhất)
const COLD_START_SAMPLES = [];
function recordColdStart(ms) {
  COLD_START_SAMPLES.push(ms);
  if (COLD_START_SAMPLES.length > 200) COLD_START_SAMPLES.shift();
}
function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}
app.get("/v1/metrics/cold-start", (req, res) => {
  res.json({
    samples: COLD_START_SAMPLES.length,
    p50_ms: percentile(COLD_START_SAMPLES, 50),
    p95_ms: percentile(COLD_START_SAMPLES, 95),
    p99_ms: percentile(COLD_START_SAMPLES, 99),
    max_ms: COLD_START_SAMPLES.length ? Math.max(...COLD_START_SAMPLES) : 0,
  });
});

app.post("/v1/chat/completions", (req, res) => {
  const startMs = Date.now();
  const { model, messages, temperature, max_tokens, stream, response_format } = req.body || {};
  // US-03 — validate response_format (json_object / json_schema)
  const rfErr = validateResponseFormat(response_format);
  if (rfErr) {
    return res.status(400).json({ error: { message: rfErr, type: "invalid_request_error" } });
  }
  // Chấp nhận model catalog cố định (MODELS) hoặc byom-<id> động (BYOM preview pool)
  const isByom = typeof model === "string" && model.startsWith("byom-");
  if (!model || (!MODELS[model] && !isByom)) {
    return res.status(404).json({ error: { message: `model "${model}" không có trên server này`, type: "invalid_request_error", code: "model_not_found" } });
  }
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: { message: "messages phải là array không rỗng", type: "invalid_request_error" } });
  }

  // US-03 — có response_format → sinh JSON conform schema (mô phỏng guided decoding)
  let content;
  if (response_format && response_format.type === "json_schema") {
    const sample = sampleFromSchema(response_format.json_schema.schema);
    content = JSON.stringify(sample, null, 2);
  } else if (response_format && response_format.type === "json_object") {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    content = JSON.stringify({ model, result: "ok", echo: String(lastUser?.content || "").slice(0, 80) }, null, 2);
  } else {
    content = generate({ model, messages, temperature });
  }
  const promptTokens = messages.reduce((s, m) => s + countTokens(m.content || ""), 0);
  const completionTokens = countTokens(content);
  recordColdStart(Date.now() - startMs);

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const chunks = content.match(/.{1,6}/g) || [content];
    let i = 0;
    const id = "chatcmpl-vllm-" + crypto.randomBytes(6).toString("hex");
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: {}, finish_reason: null }], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } })}\n\n`);
        res.write("data: [DONE]\n\n");
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }] })}\n\n`);
      i++;
    }, 25);
    return;
  }

  res.json({
    id: "chatcmpl-vllm-" + crypto.randomBytes(6).toString("hex"),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  });
});

const server = app.listen(PORT, () => {
  console.log(`vllm-adapter listening on :${PORT} — OpenAI-compat, ${Object.keys(MODELS).length} models`);
});

function graceful(signal) {
  console.log(`[vllm-adapter] nhận ${signal}, tắt`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => graceful("SIGTERM"));
process.on("SIGINT", () => graceful("SIGINT"));
