"use strict";

// Model Catalog Admin — config (env-driven, khớp pattern src/byom/config.js)

const cfg = {
  // Publish sang BFF portal (ddi.model-catalog-*)
  bff: {
    baseUrl: process.env.MC_BFF_BASE_URL || "", // VD: https://ai-v2-api-dev.fci.vn/api/bff/v1
    org: process.env.MC_BFF_ORG || "",
    ws: process.env.MC_BFF_WS || "",
    // Auth gọi BFF: header name + token (JWT phiên đăng nhập BFF)
    authHeader: process.env.MC_BFF_AUTH_HEADER || "Cookie",
    authToken: process.env.MC_BFF_AUTH_TOKEN || "", // JWT (gửi dạng Cookie: auth_token=<JWT>)
    refreshToken: process.env.MC_BFF_REFRESH_TOKEN || "", // refresh JWT khi 401
    region: process.env.MC_BFF_REGION || "", // header X-Region
    refreshPath: process.env.MC_BFF_REFRESH_PATH || "auth/token/refresh",
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
  // HF Auto-Sync — tự động fetch model mới + kiểm tra revision theo định kỳ
  hfsync: {
    enabled: process.env.MC_HF_SYNC_ENABLED !== "false",
    pollIntervalMs: parseInt(process.env.MC_HF_SYNC_POLL_MS || String(6 * 3600 * 1000), 10),
    discoverLimit: parseInt(process.env.MC_HF_SYNC_DISCOVER_LIMIT || "20", 10),
    discoverSort: process.env.MC_HF_SYNC_DISCOVER_SORT || "trendingScore",
    revisionCheckEnabled: process.env.MC_HF_SYNC_REVCHECK !== "false",
    minAgeHours: parseInt(process.env.MC_HF_SYNC_MIN_AGE_HOURS || "0", 10),
    // Default hardware profile + giá cho model discover (HF không trả info này)
    defaultGpu: process.env.MC_HF_SYNC_DEFAULT_GPU || "h100",
    defaultGpuPriceMicros: parseInt(process.env.MC_HF_SYNC_DEFAULT_GPU_PRICE_MICROS || "3700000", 10), // $3.70/GPU·h
    defaultPrecision: process.env.MC_HF_SYNC_DEFAULT_PRECISION || "bf16",
    defaultVramGb: parseInt(process.env.MC_HF_SYNC_DEFAULT_VRAM_GB || "80", 10),
  },
  // Chế độ duyệt chặt (segregation of duties): true = chặn creator tự duyệt kể cả admin.
  // Mặc định false — theo quyết định PO: admin có toàn quyền, được tự duyệt entry mình tạo.
  strictApproval: process.env.MC_STRICT_APPROVAL === "true",
};

module.exports = cfg;