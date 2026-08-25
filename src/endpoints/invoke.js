"use strict";

const express = require("express");
const crypto = require("crypto");
const store = require("../endpoints/store");
const db = require("../db/pool");
const audit = require("../audit/store");
const { countTokens } = require("../inference/routes");

const router = express.Router();

// US-02 — ghi guardrail_event (append-only)
async function recordGuardrailEvent({ endpointId, rule, severity, blocked, reason }) {
  try {
    await db.query(
      `INSERT INTO guardrail_event (id, endpoint_id, rule, severity, blocked, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ["gr-" + crypto.randomBytes(8).toString("hex"), endpointId, rule, severity || "warn", blocked !== false, reason || null]
    );
  } catch (e) {
    console.error("[guardrail] ghi event lỗi:", e.message);
  }
}

// US-02 — kiểm tra guardrails trên messages. Trả { blocked, rule, severity, reason } nếu chặn, ngược lại null.
function checkGuardrails(ep, messages) {
  if (!ep.guardrailsEnabled || !Array.isArray(ep.guardrailsRules) || ep.guardrailsRules.length === 0) return null;
  const text = (messages || [])
    .filter((m) => m && typeof m.content === "string")
    .map((m) => m.content)
    .join("\n");
  for (const rule of ep.guardrailsRules) {
    if (!rule || !rule.pattern) continue;
    try {
      const re = new RegExp(rule.pattern, "i");
      if (re.test(text)) {
        return { blocked: true, rule: rule.id, severity: rule.severity || "warn", reason: rule.reason || rule.id };
      }
    } catch (_) { /* pattern lỗi — bỏ qua */ }
  }
  return null;
}

// US-08 — prompt để ghi audit (redact nếu code_privacy)
function promptForAudit(ep, messages) {
  const plain = (messages || []).map((m) => m && m.content).filter((x) => typeof x === "string").join("\n");
  if (ep.codePrivacy) return "[REDACTED]";
  return plain;
}

// Giá theo model (USD / 1M tokens) — không giảm 50% như batch
const PRICING = {
  "FPT-LLM 8B (vi)": { in: 0.20, out: 0.60 },
  "GLM-5.2": { in: 1.40, out: 4.40 },
  "Qwen 3.7 Plus": { in: 0.50, out: 3.00 },
  "DeepSeek V4 Pro": { in: 1.74, out: 3.48 },
  "DeepSeek-R1": { in: 0.55, out: 2.19 },
  "Llama-3.3-70B": { in: 1.04, out: 1.04 },
  "PhoGPT-4B": { in: 0.10, out: 0.30 },
  "GLM-4.6": { in: 1.40, out: 4.40 },
  "Mistral-Large-2": { in: 2.00, out: 6.00 },
};

const VLLM_BASE = process.env.VLLM_BASE_URL || "";
const VLLM_TIMEOUT_MS = parseInt(process.env.VLLM_TIMEOUT_MS || "120000", 10);

async function recordUsage({ endpointId, model, promptTokens, completionTokens, costUsd, latencyMs, statusCode }) {
  try {
    await db.query(
      `INSERT INTO endpoint_usage (endpoint_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, status_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [endpointId, model, promptTokens, completionTokens, promptTokens + completionTokens, costUsd, latencyMs, statusCode]
    );
  } catch (e) {
    console.error("[endpoint-usage] ghi usage lỗi:", e.message);
  }
}

// Kiểm tra inference server sẵn sàng
async function vllmHealthy() {
  if (!VLLM_BASE) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${VLLM_BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch (_) {
    return false;
  }
}

// Gọi inference server (không stream) — trả content + usage
async function callVllm({ model, messages, temperature, maxTokens, maxModelLen, topP }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), VLLM_TIMEOUT_MS);
  try {
    const body = { model, messages, temperature, top_p: topP, max_tokens: maxTokens, stream: false };
    if (maxModelLen != null) body.max_model_len = maxModelLen;
    const r = await fetch(`${VLLM_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw Object.assign(new Error(`inference HTTP ${r.status}: ${txt.slice(0, 200)}`), { statusCode: r.status });
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// POST /v1/endpoints/:id/chat/completions — proxy sang inference server thật
router.post("/endpoints/:id/chat/completions", async (req, res) => {
  const t0 = Date.now();
  try {
    const ep = await store.getById(req.params.id);
    if (!ep) {
      await recordUsage({ endpointId: req.params.id, model: "?", promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: 404 }).catch(() => {});
      return res.status(404).json({ error: { message: `Không tìm thấy endpoint "${req.params.id}"`, type: "invalid_request_error" } });
    }
    if (ep.status !== "running") {
      await recordUsage({ endpointId: ep.id, model: ep.model, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: 409 }).catch(() => {});
      return res.status(409).json({ error: { message: `Endpoint "${ep.name}" hiện ${ep.status} — chỉ invoke được khi running`, type: "invalid_request_error" } });
    }
    const { model, messages, temperature, max_tokens, stream, max_model_len, top_p } = req.body || {};
    const useModel = model || ep.model;
    // P0 — context length: ưu tiên per-request, fallback config endpoint, fallback null (vLLM tự suy)
    const useMaxModelLen = max_model_len != null ? max_model_len : (ep.maxModelLen != null ? ep.maxModelLen : null);
    // P2 — sampling defaults: request không truyền thì dùng default endpoint, request truyền thì override
    const sd = ep.samplingDefaults || { temperature: 1.0, top_p: 1.0, max_tokens: 1024 };
    const useTemp = temperature !== undefined ? temperature : sd.temperature;
    const useTopP = top_p !== undefined ? top_p : sd.top_p;
    const useMaxTokens = max_tokens !== undefined ? max_tokens : sd.max_tokens;
    if (!Array.isArray(messages) || !messages.length) {
      await recordUsage({ endpointId: ep.id, model: useModel, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: 400 }).catch(() => {});
      return res.status(400).json({ error: { message: "messages phải là array không rỗng", type: "invalid_request_error" } });
    }

    // US-02 — kiểm tra guardrails trước khi forward
    const gr = checkGuardrails(ep, messages);
    if (gr) {
      await recordGuardrailEvent({ endpointId: ep.id, rule: gr.rule, severity: gr.severity, blocked: true, reason: gr.reason });
      await audit.record({
        actor: (req.apiKey && req.apiKey.name) || "unknown",
        role: (req.apiKey && req.apiKey.role) || "viewer",
        action: "endpoint.invoke.blocked",
        entityId: ep.id, entityType: "endpoint", result: "blocked", ip: req.ip || null,
        meta: { model: useModel, rule: gr.rule, reason: gr.reason, prompt: promptForAudit(ep, messages) },
      });
      return res.json({
        id: "chatcmpl-" + Math.random().toString(36).slice(2, 14),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: useModel,
        endpoint: { id: ep.id, name: ep.name },
        choices: [{ index: 0, message: { role: "assistant", content: `Request blocked by guardrail [${gr.rule}]: ${gr.reason}` }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        guardrail: { blocked: true, rule: gr.rule, severity: gr.severity, reason: gr.reason },
      });
    }

    // Inference server chưa cấu hình → báo rõ 503
    if (!VLLM_BASE) {
      await recordUsage({ endpointId: ep.id, model: useModel, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: 503 }).catch(() => {});
      return res.status(503).json({ error: { message: "Inference server chưa cấu hình (VLLM_BASE_URL trống)", type: "server_error" } });
    }
    const healthy = await vllmHealthy();
    if (!healthy) {
      await recordUsage({ endpointId: ep.id, model: useModel, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: 503 }).catch(() => {});
      return res.status(503).json({ error: { message: `Inference server không phản hồi tại ${VLLM_BASE}`, type: "server_error" } });
    }

    // ---- Stream: passthrough SSE từ inference server ----
    if (stream) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), VLLM_TIMEOUT_MS);
      const upstream = await fetch(`${VLLM_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: useModel, messages, temperature: useTemp, top_p: useTopP, max_tokens: useMaxTokens, max_model_len: useMaxModelLen, stream: true }),
        signal: ctrl.signal,
      }).catch((e) => {
        clearTimeout(t);
        throw e;
      });

      if (!upstream.ok) {
        clearTimeout(t);
        const txt = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({ error: { message: `inference HTTP ${upstream.status}: ${txt.slice(0, 200)}`, type: "server_error" } });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Endpoint-Id", ep.id);
      res.setHeader("X-Endpoint-Name", ep.name);

      // Đo usage + ghi DB khi stream xong
      let promptTokens = messages.reduce((s, m) => s + countTokens(m.content || ""), 0);
      let completionTokens = 0;
      const price = PRICING[useModel] || { in: 1.0, out: 2.0 };
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const tStart = Date.now();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            buf += text;
            // Trích usage từ chunk cuối nếu có
            for (const line of buf.split("\n")) {
              if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
              try {
                const obj = JSON.parse(line.slice(6));
                if (obj.usage) {
                  promptTokens = obj.usage.prompt_tokens ?? promptTokens;
                  completionTokens = obj.usage.completion_tokens ?? completionTokens;
                }
              } catch (_) {}
            }
            buf = buf.slice(-4096);
            res.write(text);
          }
        } catch (_) {
          // upstream đứt giữa chừng
        } finally {
          res.write("data: [DONE]\n\n");
          res.end();
          clearTimeout(t);
          const latencyMs = Date.now() - tStart;
          const costUsd = (promptTokens / 1e6) * price.in + (completionTokens / 1e6) * price.out;
          await recordUsage({ endpointId: ep.id, model: useModel, promptTokens, completionTokens, costUsd, latencyMs, statusCode: 200 });
        }
      })();
      return;
    }

    // ---- Không stream: proxy + ghi usage ----
    const data = await callVllm({ model: useModel, messages, temperature: useTemp, maxTokens: useMaxTokens, maxModelLen: useMaxModelLen, topP: useTopP });
    const content = data.choices?.[0]?.message?.content || "";
    const promptTokens = data.usage?.prompt_tokens ?? messages.reduce((s, m) => s + countTokens(m.content || ""), 0);
    const completionTokens = data.usage?.completion_tokens ?? countTokens(content);
    const price = PRICING[useModel] || { in: 1.0, out: 2.0 };
    const costUsd = (promptTokens / 1e6) * price.in + (completionTokens / 1e6) * price.out;
    const latencyMs = Date.now() - t0;

    await recordUsage({ endpointId: ep.id, model: useModel, promptTokens, completionTokens, costUsd, latencyMs, statusCode: 200 });
    // US-08 — ghi audit invoke; prompt redact nếu code_privacy
    await audit.record({
      actor: (req.apiKey && req.apiKey.name) || "unknown",
      role: (req.apiKey && req.apiKey.role) || "viewer",
      action: "endpoint.invoke",
      entityId: ep.id, entityType: "endpoint", result: "success", ip: req.ip || null,
      meta: { model: useModel, prompt: promptForAudit(ep, messages), codePrivacy: !!ep.codePrivacy },
    });

    res.json({
      id: data.id || "chatcmpl-" + Math.random().toString(36).slice(2, 14),
      object: "chat.completion",
      created: data.created || Math.floor(Date.now() / 1000),
      model: useModel,
      endpoint: { id: ep.id, name: ep.name },
      choices: data.choices || [],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
      cost_usd: costUsd.toFixed(6),
      latency_ms: latencyMs,
    });
  } catch (e) {
    console.error("[endpoint-invoke] lỗi:", e.message);
    const status = e.statusCode || 500;
    await recordUsage({ endpointId: req.params.id, model: "?", promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - t0, statusCode: status }).catch(() => {});
    res.status(status).json({ error: { message: e.message, type: status >= 500 ? "server_error" : "invalid_request_error" } });
  }
});

// GET /v1/endpoints/:id/health — health của endpoint + inference server
router.get("/endpoints/:id/health", async (req, res) => {
  try {
    const ep = await store.getById(req.params.id);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    const healthy = await vllmHealthy();
    res.json({
      data: {
        endpoint: { id: ep.id, name: ep.name, status: ep.status },
        inference: {
          configured: !!VLLM_BASE,
          base_url: VLLM_BASE || null,
          healthy,
        },
        ready: ep.status === "running" && healthy,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /v1/endpoints/:id/usage — usage thật từ Postgres
router.get("/endpoints/:id/usage", async (req, res) => {
  try {
    const ep = await store.getById(req.params.id);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    const summary = await db.query(
      `SELECT count(*) AS requests,
              COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens),0) AS completion_tokens,
              COALESCE(SUM(total_tokens),0) AS total_tokens,
              COALESCE(SUM(cost_usd),0) AS cost_usd,
              COALESCE(AVG(latency_ms),0) AS avg_latency_ms
       FROM endpoint_usage WHERE endpoint_id = $1`,
      [req.params.id]
    );
    const recent = await db.query(
      `SELECT model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, created_at
       FROM endpoint_usage WHERE endpoint_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );
    const s = summary.rows[0];
    res.json({
      data: {
        endpoint: { id: ep.id, name: ep.name, status: ep.status },
        totals: {
          requests: parseInt(s.requests, 10),
          prompt_tokens: parseInt(s.prompt_tokens, 10),
          completion_tokens: parseInt(s.completion_tokens, 10),
          total_tokens: parseInt(s.total_tokens, 10),
          cost_usd: parseFloat(s.cost_usd).toFixed(6),
          avg_latency_ms: Math.round(parseFloat(s.avg_latency_ms)),
        },
        recent: recent.rows.map((r) => ({
          model: r.model,
          prompt_tokens: r.prompt_tokens,
          completion_tokens: r.completion_tokens,
          total_tokens: r.total_tokens,
          cost_usd: parseFloat(r.cost_usd).toFixed(6),
          latency_ms: r.latency_ms,
          created_at: r.created_at,
        })),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /v1/endpoints/:id/metrics — metrics thật từ endpoint_usage (aggregate + series)
// Mô phỏng Together.ai: requests, tokens, latency (avg/p50/p95/p99), error rate, tokens/sec, theo time range
const RANGES = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
router.get("/endpoints/:id/metrics", async (req, res) => {
  try {
    const ep = await store.getById(req.params.id);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    const range = RANGES[req.query.range] ? req.query.range : "24h";
    const since = { "1h": "now() - interval '1 hour'", "24h": "now() - interval '24 hours'", "7d": "now() - interval '7 days'" }[range];

    const agg = await db.query(
      `SELECT count(*) AS requests,
              count(*) FILTER (WHERE status_code >= 400) AS errors,
              COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens),0) AS completion_tokens,
              COALESCE(SUM(total_tokens),0) AS total_tokens,
              COALESCE(SUM(cost_usd),0) AS cost_usd,
              COALESCE(AVG(latency_ms),0) AS avg_latency_ms,
              percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
              percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
              COALESCE(MAX(created_at), MIN(created_at)) AS last_ts
       FROM endpoint_usage WHERE endpoint_id = $1 AND created_at >= ${since}`,
      [req.params.id]
    );
    const a = agg.rows[0];
    const requests = parseInt(a.requests, 10);
    const totalTokens = parseInt(a.total_tokens, 10);
    // tokens/sec: tổng token / số giây trong range (hoặc từ lần đầu gọi)
    const spanSec = requests > 0 ? Math.max(1, ((Date.now() - Date.parse(a.last_ts)) / 1000)) : 0;
    const tokensPerSec = requests > 0 && spanSec > 0 ? totalTokens / spanSec : 0;

    // Series theo thời gian (bucket) — cho chart
    const bucket = range === "1h" ? "minute" : range === "24h" ? "hour" : "day";
    const series = await db.query(
      `SELECT date_trunc('${bucket}', created_at) AS ts,
              count(*) AS requests,
              count(*) FILTER (WHERE status_code >= 400) AS errors,
              COALESCE(SUM(total_tokens),0) AS total_tokens,
              COALESCE(AVG(latency_ms),0) AS avg_latency_ms,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
       FROM endpoint_usage WHERE endpoint_id = $1 AND created_at >= ${since}
       GROUP BY 1 ORDER BY 1`,
      [req.params.id]
    );

    res.json({
      data: {
        endpoint: { id: ep.id, name: ep.name, status: ep.status },
        range,
        totals: {
          requests,
          success: requests - parseInt(a.errors, 10),
          errors: parseInt(a.errors, 10),
          error_rate: requests > 0 ? Math.round((parseInt(a.errors, 10) / requests) * 1000) / 10 : 0,
          prompt_tokens: parseInt(a.prompt_tokens, 10),
          completion_tokens: parseInt(a.completion_tokens, 10),
          total_tokens: totalTokens,
          cost_usd: parseFloat(a.cost_usd).toFixed(6),
          avg_latency_ms: Math.round(parseFloat(a.avg_latency_ms)),
          p50: Math.round(a.p50 || 0),
          p95: Math.round(a.p95 || 0),
          p99: Math.round(a.p99 || 0),
          tokens_per_sec: Math.round(tokensPerSec * 100) / 100,
        },
        series: series.rows.map((r) => ({
          ts: r.ts,
          requests: parseInt(r.requests, 10),
          errors: parseInt(r.errors, 10),
          total_tokens: parseInt(r.total_tokens, 10),
          avg_latency_ms: Math.round(parseFloat(r.avg_latency_ms)),
          p95: Math.round(r.p95 || 0),
        })),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
