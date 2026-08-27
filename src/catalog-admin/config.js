"use strict";

// Model Catalog Admin — config (env-driven, khớp pattern src/byom/config.js)

const cfg = {
  // Publish sang BFF portal (ddi.model-catalog-*)
  bff: {
    baseUrl: process.env.MC_BFF_BASE_URL || "", // VD: https://ai-v2-api-dev.fci.vn/api/bff/v1
    org: process.env.MC_BFF_ORG || "",
    ws: process.env.MC_BFF_WS || "",
    // Auth gọi BFF: header name + token (service credential)
    authHeader: process.env.MC_BFF_AUTH_HEADER || "Cookie",
    authToken: process.env.MC_BFF_AUTH_TOKEN || "", // VD: "auth_token=<JWT>"
    timeoutMs: parseInt(process.env.MC_BFF_TIMEOUT_MS || "15000", 10),
    // DRY_RUN=true → không gọi BFF thật, chỉ log (dev/local, chờ service credential)
    dryRun: process.env.MC_BFF_DRY_RUN !== "false",
  },
  hf: {
    apiBase: process.env.MC_HF_API_BASE || "https://huggingface.co/api",
    fileBase: process.env.MC_HF_FILE_BASE || "https://huggingface.co",
    timeoutMs: parseInt(process.env.MC_HF_TIMEOUT_MS || "10000", 10),
    token: process.env.MC_HF_TOKEN || "",
    cacheTtlMs: parseInt(process.env.MC_HF_CACHE_TTL_MS || String(24 * 3600 * 1000), 10),
  },
  mirror: {
    // Root lưu weights mirror (dev: local FS; prod: mount S3/MinIO hoặc đổi sang S3 SDK)
    root: process.env.MC_MIRROR_ROOT || "/data/mirror",
    maxConcurrent: parseInt(process.env.MC_MIRROR_CONCURRENCY || "2", 10),
    maxAttempts: parseInt(process.env.MC_MIRROR_MAX_ATTEMPTS || "3", 10),
    pollIntervalMs: parseInt(process.env.MC_MIRROR_POLL_MS || "5000", 10),
    maxFileBytes: 10 * 1024 * 1024 * 1024, // 10GB/file
    maxFiles: 300,
  },
  worker: {
    enabled: process.env.MC_WORKER_ENABLED !== "false",
  },
  // Chế độ duyệt chặt (segregation of duties): true = chặn creator tự duyệt kể cả admin.
  // Mặc định false — theo quyết định PO: admin có toàn quyền, được tự duyệt entry mình tạo.
  strictApproval: process.env.MC_STRICT_APPROVAL === "true",
};

module.exports = cfg;