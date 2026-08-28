"use strict";

// Model Catalog Admin — publish entry sang BFF portal (ddi.model-catalog-*).
// Idempotent: gọi create với cùng `id` — nếu BFF trả lỗi "đã tồn tại" thì fallback update.
// DRY_RUN (mặc định dev): chỉ log, không gọi BFF thật (chờ service credential — blocker B1).

const cfg = require("./config");

// JWT hiện hành — có thể được refresh tại runtime khi BFF trả 401
let currentAuthToken = cfg.bff.authToken;

function bffUrl(action) {
  const base = cfg.bff.baseUrl.replace(/\/$/, "");
  return `${base}/ddi/${cfg.bff.org}/workspaces/${cfg.bff.ws}/${action}`;
}

function bffRefreshUrl() {
  const base = cfg.bff.baseUrl.replace(/\/$/, "");
  return `${base}/${cfg.bff.refreshPath}`;
}

function bffHeaders() {
  const h = { "Content-Type": "application/json" };
  if (currentAuthToken) {
    const val = /cookie/i.test(cfg.bff.authHeader) ? `auth_token=${currentAuthToken}` : currentAuthToken;
    h[cfg.bff.authHeader] = val;
  }
  if (cfg.bff.region) h["X-Region"] = cfg.bff.region;
  return h;
}

// doFetch — POST JSON có timeout, trả { ok, status, json, text }
async function doFetch(url, body) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.bff.timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: bffHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text().catch(() => "");
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: resp.ok, status: resp.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

// refreshAuthToken() — gọi auth/token/refresh bằng refresh_token để lấy JWT mới.
// Thành công → cập nhật currentAuthToken, trả true.
async function refreshAuthToken() {
  if (!cfg.bff.refreshToken) return false;
  try {
    const r = await doFetch(bffRefreshUrl(), { payload: { refresh_token: cfg.bff.refreshToken } });
    if (!r.ok) {
      console.log(`[mc-publish] refresh token lỗi HTTP ${r.status}`);
      return false;
    }
    const d = (r.json && (r.json.data || r.json)) || {};
    const dd = (r.json && r.json.data && typeof r.json.data === "object") ? r.json.data : {};
    const newToken = d.auth_token || d.token || d.jwt || dd.auth_token || dd.token || dd.jwt || null;
    if (!newToken) {
      console.log("[mc-publish] refresh: không tìm thấy JWT mới trong response");
      return false;
    }
    currentAuthToken = String(newToken);
    console.log("[mc-publish] ✓ refresh JWT thành công");
    return true;
  } catch (e) {
    console.log(`[mc-publish] refresh token lỗi: ${e.message}`);
    return false;
  }
}

async function callBff(action, payload) {
  let r = await doFetch(bffUrl(action), { payload });
  // 401 → refresh JWT rồi gọi lại 1 lần
  if (r.status === 401 && cfg.bff.refreshToken) {
    const refreshed = await refreshAuthToken();
    if (refreshed) r = await doFetch(bffUrl(action), { payload });
  }
  return r;
}

// entryToBffPayload — map entry admin → payload BFF (khớp Postman collection)
function entryToBffPayload(e) {
  return {
    id: e.id,
    hf_model_id: e.hfModelId,
    display_name: e.displayName,
    short_description: e.shortDescription || "",
    parameters_display: e.parametersDisplay || "",
    context_length_display: e.contextLengthDisplay || "",
    license: e.license,
    badge_code: e.badgeCode || null,
    sort_order: e.sortOrder || 0,
    from_price: e.fromPrice !== null ? e.fromPrice : null,
    status_code: e.status === "active" ? "active" : "inactive",
    categories: e.categories || [],
    benchmarks: e.benchmarks || [],
    hardware_profiles: e.hardwareProfiles || [],
  };
}

// publish(entry) — create, nếu "đã tồn tại" → update. Trả { ok, dryRun, action, detail }
async function publish(entry) {
  const payload = entryToBffPayload(entry);
  if (cfg.bff.dryRun) {
    console.log(`[mc-publish] DRY_RUN — ${entry.id} (${payload.status_code}) → BFF ddi.model-catalog-create`);
    return { ok: true, dryRun: true, action: "create", detail: "dry-run" };
  }
  if (!cfg.bff.baseUrl || !cfg.bff.org || !cfg.bff.ws) {
    return { ok: false, dryRun: false, action: "create", detail: "BFF chưa cấu hình (MC_BFF_BASE_URL/ORG/WS)" };
  }
  if (!currentAuthToken) {
    return { ok: false, dryRun: false, action: "create", detail: "BFF chưa cấu hình token (MC_BFF_AUTH_TOKEN)" };
  }
  const createRes = await callBff("ddi.model-catalog-create", payload);
  if (createRes.ok) return { ok: true, dryRun: false, action: "create", detail: createRes.json };
  // idempotent fallback: đã tồn tại → update
  const txt = String(createRes.text || "");
  if (createRes.status === 409 || /exist|tồn tại|duplicate/i.test(txt)) {
    const updRes = await callBff("ddi.model-catalog-update", payload);
    if (updRes.ok) return { ok: true, dryRun: false, action: "update", detail: updRes.json };
    return { ok: false, dryRun: false, action: "update", detail: `BFF update lỗi ${updRes.status}: ${txt.slice(0, 200)}` };
  }
  return { ok: false, dryRun: false, action: "create", detail: `BFF create lỗi ${createRes.status}: ${txt.slice(0, 200)}` };
}

// unpublish(entry) — set status inactive ở BFF (disable)
async function unpublish(entry) {
  const payload = entryToBffPayload({ ...entry, status: "inactive" });
  if (cfg.bff.dryRun) {
    console.log(`[mc-publish] DRY_RUN — ${entry.id} → BFF ddi.model-catalog-update (inactive)`);
    return { ok: true, dryRun: true, action: "update" };
  }
  if (!cfg.bff.baseUrl) return { ok: false, dryRun: false, action: "update", detail: "BFF chưa cấu hình" };
  if (!currentAuthToken) return { ok: false, dryRun: false, action: "update", detail: "BFF chưa cấu hình token (MC_BFF_AUTH_TOKEN)" };
  const res = await callBff("ddi.model-catalog-update", payload);
  return { ok: res.ok, dryRun: false, action: "update", detail: res.ok ? res.json : `BFF lỗi ${res.status}: ${String(res.text || "").slice(0, 200)}` };
}

module.exports = { publish, unpublish, entryToBffPayload };