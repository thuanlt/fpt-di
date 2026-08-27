"use strict";

// Model Catalog Admin — publish entry sang BFF portal (ddi.model-catalog-*).
// Idempotent: gọi create với cùng `id` — nếu BFF trả lỗi "đã tồn tại" thì fallback update.
// DRY_RUN (mặc định dev): chỉ log, không gọi BFF thật (chờ service credential — blocker B1).

const cfg = require("./config");

function bffUrl(action) {
  const base = cfg.bff.baseUrl.replace(/\/$/, "");
  return `${base}/ddi/${cfg.bff.org}/workspaces/${cfg.bff.ws}/${action}`;
}

function bffHeaders() {
  const h = { "Content-Type": "application/json" };
  if (cfg.bff.authHeader && cfg.bff.authToken) h[cfg.bff.authHeader] = cfg.bff.authToken;
  return h;
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

async function callBff(action, payload) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.bff.timeoutMs);
  try {
    const resp = await fetch(bffUrl(action), {
      method: "POST",
      headers: bffHeaders(),
      body: JSON.stringify({ payload }),
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
  const res = await callBff("ddi.model-catalog-update", payload);
  return { ok: res.ok, dryRun: false, action: "update", detail: res.ok ? res.json : `BFF lỗi ${res.status}: ${String(res.text || "").slice(0, 200)}` };
}

module.exports = { publish, unpublish, entryToBffPayload };