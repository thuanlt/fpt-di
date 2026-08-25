"use strict";

const cfg = {
  redis: {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    db: parseInt(process.env.REDIS_DB || "0", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  },
  queue: {
    key: "ddi:batch:queue",
    stream: "ddi:batch:stream",
    consumerGroup: "ddi-workers",
    consumerName: process.env.HOSTNAME || `w-${process.pid}`,
    blockMs: 5000,
    maxRetries: 3,
  },
  storage: {
    root: process.env.BATCH_STORAGE_ROOT || "/data/batch",
    inputDir: "input",
    outputDir: "output",
    maxJobSizeBytes: 100 * 1024 * 1024,
    presignTtlSec: 7 * 24 * 60 * 60,
  },
  limits: {
    maxRequestsPerJob: 50000,
    completionWindowH: 24,
    rateLimitPool: "batch",
  },
  inference: {
    baseUrl: process.env.FPT_DDI_INFERENCE_URL || "",
    apiKey: process.env.FPT_DDI_INFERENCE_KEY || "",
    timeoutMs: parseInt(process.env.FPT_DDI_INFERENCE_TIMEOUT_MS || "60000", 10),
    concurrent: parseInt(process.env.FPT_DDI_BATCH_CONCURRENCY || "4", 10),
    maxRetries: parseInt(process.env.FPT_DDI_BATCH_MAX_RETRIES || "3", 10),
    retryBackoffMs: parseInt(process.env.FPT_DDI_BATCH_RETRY_BACKOFF_MS || "1000", 10),
    cancelWindowMs: parseInt(process.env.FPT_DDI_BATCH_CANCEL_WINDOW_MS || "86400000", 10),
    watchdogIntervalMs: parseInt(process.env.FPT_DDI_BATCH_WATCHDOG_INTERVAL_MS || "60000", 10),
  },
  pricing: {
    batchDiscount: 0.5,
    ratePerMillionIn: { "FPT-LLM 8B (vi)": 0.20, "GLM-5.2": 1.40, "Qwen 3.7 Plus": 0.50, "DeepSeek V4 Pro": 1.74, "DeepSeek-R1": 0.55, "Llama-3.3-70B": 1.04, "PhoGPT-4B": 0.10 },
    ratePerMillionOut: { "FPT-LLM 8B (vi)": 0.60, "GLM-5.2": 4.40, "Qwen 3.7 Plus": 3.00, "DeepSeek V4 Pro": 3.48, "DeepSeek-R1": 2.19, "Llama-3.3-70B": 1.04, "PhoGPT-4B": 0.30 },
  },
  models: ["FPT-LLM 8B (vi)", "GLM-5.2", "Qwen 3.7 Plus", "DeepSeek V4 Pro", "DeepSeek-R1", "Llama-3.3-70B", "PhoGPT-4B"],
  webhook: {
    timeoutMs: 10000,
    retries: 3,
  },
};

Object.freeze(cfg.pricing.ratePerMillionIn);
Object.freeze(cfg.pricing.ratePerMillionOut);
Object.freeze(cfg.models);

module.exports = cfg;
