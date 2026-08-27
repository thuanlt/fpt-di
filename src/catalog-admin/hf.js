"use strict";

// Model Catalog Admin — HF Hub metadata fetch.
// Fetch repo info + config.json, map về fields catalog (prefill form M2).
// Timeout 10s (NFR-MC-005), cache in-memory 24h, backoff khi rate-limit.

const cfg = require("./config");

const cache = new Map(); // hfModelId -> { at, data }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithTimeout(url, { headers = {}, timeoutMs } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// fetchHfMetadata(hfModelId) → { ok, data | error }
// data: { hfModelId, revision, displayName, parametersDisplay, contextLengthDisplay, license, shortDescription, suggestedCategories }
async function fetchHfMetadata(hfModelId) {
  const id = String(hfModelId || "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(id)) {
    return { ok: false, code: "INVALID_REPO_ID", message: "HF Model ID phải có dạng publisher/model-name" };
  }
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < cfg.hf.cacheTtlMs) return { ok: true, data: hit.data, cached: true };

  const headers = cfg.hf.token ? { Authorization: `Bearer ${cfg.hf.token}` } : {};
  let repoInfo;
  try {
    const resp = await fetchWithTimeout(`${cfg.hf.apiBase}/models/${id}`, { headers, timeoutMs: cfg.hf.timeoutMs });
    if (resp.status === 404) return { ok: false, code: "HF_REPO_NOT_FOUND", message: `Không tìm thấy repo HF: ${id}` };
    if (resp.status === 401 || resp.status === 403) return { ok: false, code: "HF_AUTH_FAILED", message: "Repo HF cần token (gated) — cấu hình MC_HF_TOKEN" };
    if (resp.status === 429) {
      // rate limit — backoff 1 lần
      await sleep(2000);
      const retry = await fetchWithTimeout(`${cfg.hf.apiBase}/models/${id}`, { headers, timeoutMs: cfg.hf.timeoutMs });
      if (!retry.ok) return { ok: false, code: "HF_RATE_LIMITED", message: "HF đang giới hạn tốc độ — thử lại sau ít phút" };
      repoInfo = await retry.json();
    } else if (!resp.ok) {
      return { ok: false, code: "HF_API_FAILED", message: `HF API lỗi ${resp.status}` };
    } else {
      repoInfo = await resp.json();
    }
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, code: "HF_TIMEOUT", message: "HF phản hồi chậm (>10s) — thử lại sau" };
    return { ok: false, code: "HF_API_FAILED", message: `Không kết nối được HF: ${e.message}` };
  }

  // config.json — lấy context_length + params (best-effort, không chặn nếu lỗi)
  let config = {};
  try {
    const cresp = await fetchWithTimeout(`${cfg.hf.apiBase}/models/${id}/resolve/main/config.json`, { headers, timeoutMs: cfg.hf.timeoutMs });
    if (cresp.ok) config = await cresp.json();
  } catch (_) { /* config optional */ }

  // Validate: repo phải có config.json (FR-MC-002.2)
  const hasConfig = Object.keys(config).length > 0 || (repoInfo.siblings || []).some((f) => f.rfilename === "config.json");
  if (!hasConfig) {
    return { ok: false, code: "HF_MISSING_CONFIG", message: `Repo ${id} thiếu config.json — không phải model serving được` };
  }

  const data = mapHfToCatalog({ id, repoInfo, config });
  cache.set(id, { at: Date.now(), data });
  return { ok: true, data };
}

// mapHfToCatalog — mapping field HF → fields catalog (bảng mapping G4)
function mapHfToCatalog({ id, repoInfo, config }) {
  const tags = repoInfo.tags || [];
  const license = (repoInfo.cardData && Array.isArray(repoInfo.cardData.license))
    ? repoInfo.cardData.license[0]
    : (repoInfo.cardData && repoInfo.cardData.license) || tags.find((t) => t.includes("license")) || "unknown";

  // params display: từ config (num_parameters chưa có sẵn ở HF API — dùng tag hoặc ước lượng)
  const paramTag = tags.find((t) => /^[\d.]+[bm]$/i.test(t));
  const parametersDisplay = paramTag
    ? paramTag.toUpperCase().replace("B", "B").replace("M", "M")
    : (config.hidden_size ? `hidden=${config.hidden_size}` : null);

  const contextLengthDisplay = config.max_position_embeddings
    ? formatContext(config.max_position_embeddings)
    : (config.model_max_length ? formatContext(config.model_max_length) : null);

  const suggestedCategories = [];
  if (tags.includes("text-generation") || config.architectures?.some((a) => /ForCausalLM|Llama|Qwen/i.test(a))) suggestedCategories.push("chat");
  if (tags.includes("code-generation") || tags.includes("code")) suggestedCategories.push("code");
  if (tags.includes("multimodal") || tags.includes("vision") || tags.includes("image-text")) suggestedCategories.push("vision");
  if (tags.includes("conversational")) suggestedCategories.push("chat");
  if (tags.includes("reinforcement-learning") || tags.includes("agents")) suggestedCategories.push("agent");

  return {
    hfModelId: id,
    revision: repoInfo.sha || null,
    displayName: (repoInfo.modelId || id).split("/").pop().replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortDescription: (repoInfo.cardData && repoInfo.cardData.description) || null,
    parametersDisplay,
    contextLengthDisplay,
    license: String(license),
    suggestedCategories: [...new Set(suggestedCategories)],
  };
}

function formatContext(n) {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

module.exports = { fetchHfMetadata, mapHfToCatalog };