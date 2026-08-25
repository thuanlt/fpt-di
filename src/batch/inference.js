"use strict";

const cfg = require("./config");

async function callInference({ model, messages, temperature = 0.7, maxTokens = 512 }) {
  const baseUrl = cfg.inference.baseUrl;
  const apiKey = cfg.inference.apiKey;

  if (!baseUrl) {
    const err = new Error("FPT_DDI_INFERENCE_URL chưa cấu hình — worker không thể gọi inference thật");
    err.code = "INFERENCE_UNCONFIGURED";
    throw err;
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.inference.timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`inference HTTP ${resp.status}: ${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      finishReason: data.choices?.[0]?.finish_reason || "stop",
      model: data.model || model,
    };
  } finally {
    clearTimeout(t);
  }
}

function priceFor({ model, promptTokens, completionTokens }) {
  const inRate = cfg.pricing.ratePerMillionIn[model] || 0;
  const outRate = cfg.pricing.ratePerMillionOut[model] || 0;
  const full = (promptTokens / 1_000_000) * inRate + (completionTokens / 1_000_000) * outRate;
  const batched = full * cfg.pricing.batchDiscount;
  return { full, batched, savings: full - batched };
}

module.exports = { callInference, priceFor };
