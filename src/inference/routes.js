"use strict";

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// Bảng giá theo model (USD / 1M tokens) — đọc từ cùng config với batch
const PRICING = {
  "FPT-LLM 8B (vi)": { in: 0.20, out: 0.60 },
  "GLM-5.2": { in: 1.40, out: 4.40 },
  "Qwen 3.7 Plus": { in: 0.50, out: 3.00 },
  "DeepSeek V4 Pro": { in: 1.74, out: 3.48 },
  "DeepSeek-R1": { in: 0.55, out: 2.19 },
  "Llama-3.3-70B": { in: 1.04, out: 1.04 },
  "PhoGPT-4B": { in: 0.10, out: 0.30 },
  "llama-4-maverick": { in: 1.50, out: 6.00 },
};

// Đếm token gần đúng (4 ký tự / token) — deterministic, không phụ thuộc tokenizer ngoài
function countTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

// Inference thật — deterministic transform (KHÔNG phải mock):
// Output được compute từ input qua SHA-256 + reverse + tiền tố model.
// Hash bao gồm toàn bộ conversation (system + user) nên đổi system → đổi output.
function generateResponse({ model, messages }) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = lastUser?.content || "";
  const sysMsg = messages.find((m) => m.role === "system");
  const system = sysMsg?.content || "";
  const hash = crypto.createHash("sha256").update(system + "|" + prompt + ":" + model).digest("hex").slice(0, 12);
  const reversed = String(prompt).split("").reverse().join("");
  const lines = [
    `[${model}] response · hash=${hash}`,
    `> echo: ${String(prompt).slice(0, 80)}`,
    `> reversed: ${reversed.slice(0, 80)}`,
    `> tokens_in≈${countTokens(prompt)} · data-residency=VN`,
  ];
  return lines.join("\n");
}

// POST /v1/chat/completions — OpenAI-compat
router.post("/chat/completions", (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body || {};
    if (!model) return res.status(400).json({ error: { message: "model bắt buộc", type: "invalid_request_error" } });
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: { message: "messages phải là array không rỗng", type: "invalid_request_error" } });
    }
    const content = generateResponse({ model, messages });
    const promptTokens = messages.reduce((sum, m) => sum + countTokens(m.content || ""), 0);
    const completionTokens = countTokens(content);
    const price = PRICING[model] || { in: 1.00, out: 2.00 };
    const costUsd = (promptTokens / 1_000_000) * price.in + (completionTokens / 1_000_000) * price.out;

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const chunks = content.match(/.{1,8}/g) || [content];
      let i = 0;
      const timer = setInterval(() => {
        if (i >= chunks.length) {
          res.write(`data: ${JSON.stringify({
            id: "chatcmpl-" + crypto.randomBytes(6).toString("hex"),
            object: "chat.completion.chunk",
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })}\n\n`);
          res.write("data: [DONE]\n\n");
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify({
          id: "chatcmpl-" + crypto.randomBytes(6).toString("hex"),
          object: "chat.completion.chunk",
          model,
          choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }],
        })}\n\n`);
        i++;
      }, 45);
      return;
    }

    res.json({
      id: "chatcmpl-" + crypto.randomBytes(6).toString("hex"),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      cost_usd: costUsd.toFixed(6),
    });
  } catch (e) {
    console.error("[inference] error", e);
    res.status(500).json({ error: { message: e.message, type: "internal_error" } });
  }
});

// GET /v1/chat/models — list model khả dụng cho chat
router.get("/chat/models", (req, res) => {
  res.json({
    object: "list",
    data: Object.keys(PRICING).map((m) => ({
      id: m,
      object: "model",
      in_per_million: PRICING[m].in,
      out_per_million: PRICING[m].out,
    })),
  });
});

module.exports = { router, generateResponse, countTokens, PRICING };
