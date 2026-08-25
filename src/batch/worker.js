"use strict";

const cfg = require("./config");
const storage = require("./storage");
const queue = require("./queue");
const { callInference, priceFor } = require("./inference");

const isRunning = { value: false };

// Retry per-request với exponential backoff — Together.ai parity.
// Retry cho lỗi tạm thời (timeout, 5xx, network). Không retry cho lỗi cấu hình (4xx invalid_request).
async function callInferenceWithRetry({ model, messages, temperature, maxTokens, jobId, lineId }) {
  const maxRetries = cfg.inference.maxRetries;
  const baseBackoff = cfg.inference.retryBackoffMs;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callInference({ model, messages, temperature, maxTokens });
      return { ...result, retries: attempt };
    } catch (e) {
      lastErr = e;
      const retryable = isRetryableError(e);
      if (!retryable || attempt === maxRetries) {
        e.retries = attempt;
        throw e;
      }
      const backoff = baseBackoff * Math.pow(2, attempt) + Math.floor(Math.random() * baseBackoff);
      console.warn(`[worker] job ${jobId} line ${lineId} retry ${attempt + 1}/${maxRetries} sau ${backoff}ms — ${e.message}`);
      await sleep(backoff);
    }
  }
  lastErr.retries = maxRetries;
  throw lastErr;
}

function isRetryableError(e) {
  if (!e) return false;
  const msg = String(e.message || "");
  if (e.code === "INFERENCE_UNCONFIGURED") return false;
  if (msg.includes("HTTP 4")) return false;
  if (msg.includes("model_not_found")) return false;
  if (msg.includes("invalid_request_error")) return false;
  return true;
}

function start() {
  if (isRunning.value) return;
  isRunning.value = true;
  console.log(`[worker] starting — consumer=${cfg.queue.consumerName} concurrency=${cfg.inference.concurrent} maxRetries=${cfg.inference.maxRetries} watchdog=${cfg.inference.watchdogIntervalMs}ms`);
  runWorkers(cfg.inference.concurrent).catch((e) => console.error("[worker] fatal", e.message));
  startWatchdog();
}

async function runWorkers(count) {
  await queue.ensureGroup();
  for (let i = 0; i < count; i++) {
    workerLoop(i).catch((e) => console.error(`[worker:${i}] crashed`, e.message));
  }
}

async function workerLoop(idx) {
  const consumerName = `${cfg.queue.consumerName}-${idx}`;
  while (isRunning.value) {
    let entries = [];
    try {
      entries = await queue.readPendingForConsumer(consumerName);
    } catch (e) {
      console.error(`[worker:${idx}] read error`, e.message);
      await sleep(2000);
      continue;
    }
    if (!entries.length) continue;
    for (const entry of entries) {
      try {
        await processJob(entry);
        await queue.ack(entry.id);
      } catch (e) {
        console.error(`[worker:${idx}] job ${entry.jobId} failed`, e.message);
        await queue.ack(entry.id).catch(() => {});
      }
    }
  }
}

async function processJob({ jobId, payload }) {
  console.log(`[worker] processing job ${jobId} model=${payload.model}`);
  await queue.updateJobMeta(jobId, {
    status: "validating",
    startedAt: new Date().toISOString(),
  });

  let requests;
  try {
    requests = storage.readInputLines(jobId);
  } catch (e) {
    await fail(jobId, `read input failed: ${e.message}`);
    return;
  }

  if (requests.length > cfg.limits.maxRequestsPerJob) {
    await fail(jobId, `exceeds ${cfg.limits.maxRequestsPerJob} requests/job`);
    return;
  }

  await queue.updateJobMeta(jobId, {
    status: "in_progress",
    validationPassed: true,
  });

  let success = 0, failed = 0;
  let totalIn = 0, totalOut = 0;
  let totalFull = 0, totalBatched = 0;

  for (let i = 0; i < requests.length; i++) {
    let req;
    try { req = JSON.parse(requests[i]); }
    catch (e) {
      storage.appendOutput(jobId, JSON.stringify({ id: i + 1, error: "invalid_json", line: requests[i].slice(0, 100) }));
      failed++;
      continue;
    }

    const model = req.model || payload.model;
    const messages = req.messages || (req.prompt ? [{ role: "user", content: req.prompt }] : []);
    if (!messages.length) {
      storage.appendOutput(jobId, JSON.stringify({ id: i + 1, error: "no_messages" }));
      failed++;
      continue;
    }

    try {
      const result = await callInferenceWithRetry({
        model,
        messages,
        temperature: req.temperature ?? payload.temperature ?? 0.7,
        maxTokens: req.max_tokens ?? payload.max_tokens ?? 512,
        jobId,
        lineId: i + 1,
      });
      const price = priceFor({ model, promptTokens: result.promptTokens, completionTokens: result.completionTokens });
      storage.appendOutput(jobId, JSON.stringify({
        id: i + 1,
        model: result.model,
        response: { content: result.content, role: "assistant" },
        usage: { prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens },
        finish_reason: result.finishReason,
        price: { full_usd: price.full.toFixed(6), batch_usd: price.batched.toFixed(6), savings_usd: price.savings.toFixed(6) },
        retries: result.retries,
      }));
      success++;
      totalIn += result.promptTokens;
      totalOut += result.completionTokens;
      totalFull += price.full;
      totalBatched += price.batched;
    } catch (e) {
      storage.appendOutput(jobId, JSON.stringify({ id: i + 1, error: e.code || "inference_failed", message: e.message, retries: e.retries || 0 }));
      failed++;
    }

    if (i > 0 && i % 50 === 0) {
      await queue.updateJobMeta(jobId, {
        progress: { processed: i + 1, total: requests.length, success, failed },
      });
    }
  }

  if (cfg.inference.baseUrl) {
    console.log(`[worker] job ${jobId} done — ${success}/${requests.length} success, failed=${failed}`);
  } else {
    console.log(`[worker] warmup — job ${jobId} đã chạy ${requests.length} lines ngay cả khi inference chưa cấu hình (thất bại controller → log lỗi)`);
  }
  await queue.incrStat("requestsProcessed", 0).catch(() => {});
  await queue.incrStat("requestsProcessed");

  await queue.updateJobMeta(jobId, {
    status: "finalizing",
    progress: { processed: requests.length, total: requests.length, success, failed },
  });

  const completedAt = new Date().toISOString();
  const submittedAt = (await queue.getJobMeta(jobId)).submittedAt;
  const windowH = (Date.parse(completedAt) - Date.parse(submittedAt)) / 3600000;

  await queue.updateJobMeta(jobId, {
    status: failed === requests.length && requests.length > 0 ? "failed" : "completed",
    completedAt,
    window: `${windowH.toFixed(2)}h`,
    progress: { processed: requests.length, total: requests.length, success, failed },
    totals: {
      requests: requests.length,
      success,
      failed,
      promptTokens: totalIn,
      completionTokens: totalOut,
      fullCostUsd: totalFull.toFixed(4),
      batchCostUsd: totalBatched.toFixed(4),
      savingsUsd: (totalFull - totalBatched).toFixed(4),
      savingsPct: totalFull > 0 ? Math.round((1 - totalBatched / totalFull) * 100) + "%" : "0%",
    },
  });
  await queue.incrStat(failed === requests.length ? "failed" : "completed");

  if (payload.webhookUrl) {
    sendWebhook(payload.webhookUrl, { id: jobId, status: failed === requests.length ? "failed" : "completed", totals: (await queue.getJobMeta(jobId)).totals });
  }
}

async function fail(jobId, reason) {
  await queue.updateJobMeta(jobId, { status: "failed", error: reason, completedAt: new Date().toISOString() });
  await queue.incrStat("failed");
}

async function sendWebhook(url, payload) {
  for (let attempt = 1; attempt <= cfg.webhook.retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), cfg.webhook.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "FPT-DDI-Batch/1.0" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (resp.ok) { console.log(`[webhook] ${url} → ${resp.status}`); return; }
      if (resp.status >= 400 && resp.status < 500) return;
      throw new Error(`HTTP ${resp.status}`);
    } catch (e) {
      console.warn(`[webhook] attempt ${attempt}/${cfg.webhook.retries} ${url} — ${e.message}`);
    } finally {
      clearTimeout(t);
    }
    if (attempt < cfg.webhook.retries) await sleep(1000 * attempt);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function stop() { isRunning.value = false; stopWatchdog(); }
function status() { return isRunning.value; }

// Auto-cancel watchdog — Together.ai parity: huỷ job chạy quá 24h.
// Quét list job running định kỳ, nếu startedAt + cancelWindowMs < now → set cancelled.
let watchdogTimer = null;

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    cancelExpiredJobs().catch((e) => console.error("[watchdog] error", e.message));
  }, cfg.inference.watchdogIntervalMs);
  console.log(`[watchdog] started — interval=${cfg.inference.watchdogIntervalMs}ms cancelWindow=${cfg.inference.cancelWindowMs}ms`);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log("[watchdog] stopped");
  }
}

async function cancelExpiredJobs() {
  let jobs;
  try {
    jobs = await queue.listJobs({ status: "running" });
  } catch (e) {
    console.error("[watchdog] listJobs failed", e.message);
    return;
  }
  const now = Date.now();
  const cutoff = now - cfg.inference.cancelWindowMs;
  let cancelled = 0;
  for (const job of jobs) {
    const startedAtMs = job.startedAt ? Date.parse(job.startedAt) : null;
    if (startedAtMs == null) continue;
    if (startedAtMs < cutoff) {
      console.warn(`[watchdog] cancelling expired job ${job.id} — startedAt=${job.startedAt} exceeds ${cfg.inference.cancelWindowMs}ms`);
      await queue.updateJobMeta(job.id, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelReason: `auto-cancelled: exceeded ${Math.round(cfg.inference.cancelWindowMs / 3600000)}h window`,
      });
      await queue.incrStat("failed");
      cancelled++;
    }
  }
  if (cancelled > 0) console.log(`[watchdog] cancelled ${cancelled} expired job(s)`);
}

module.exports = { start, stop, status };
