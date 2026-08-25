"use strict";

const cfg = {
  storage: {
    root: process.env.BYOM_STORAGE_ROOT || "/data/byom",
    maxModelSizeBytes: 50 * 1024 * 1024 * 1024,
    allowedArchiveExts: [".zip", ".tar.gz", ".tgz", ".tar"],
    allowedWeightExts: [".safetensors", ".bin", ".pt", ".gguf", ".onnx"],
    requiredFiles: ["config.json", "tokenizer.json"],
    tempDir: "tmp",
    weightsDir: "weights",
  },
  hf: {
    apiBase: process.env.BYOM_HF_API_BASE || "https://huggingface.co/api",
    fileBase: process.env.BYOM_HF_FILE_BASE || "https://huggingface.co",
    timeoutMs: parseInt(process.env.BYOM_HF_TIMEOUT_MS || "600000", 10),
    concurrent: parseInt(process.env.BYOM_HF_CONCURRENCY || "4", 10),
    maxFilesPerRepo: parseInt(process.env.BYOM_HF_MAX_FILES || "200", 10),
    maxFilePerFileBytes: 10 * 1024 * 1024 * 1024,
  },
  s3: {
    timeoutMs: parseInt(process.env.BYOM_S3_TIMEOUT_MS || "1800000", 10),
    presignMinExpirySec: 6000,
  },
  worker: {
    pollIntervalMs: parseInt(process.env.BYOM_WORKER_POLL_MS || "3000", 10),
    concurrent: parseInt(process.env.BYOM_WORKER_CONCURRENCY || "2", 10),
  },
  lifecycle: ["queued", "downloading", "validating", "ready", "deploying", "deployed", "failed", "cancelled"],
};

module.exports = cfg;
