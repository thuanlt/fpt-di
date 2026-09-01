"use strict";

// Model Catalog Admin — HF Auto-Sync worker.
// Định kỳ: (A) discover model mới từ HuggingFace → tạo entry draft;
//         (B) revision check các entry active → sinh đề xuất mc_pending_updates.
// Pattern giống mirror.js: guard running, setInterval, start/stop/status.

const cfg = require("./config");
const store = require("./store");
const hf = require("./hf");

let running = false;
let timer = null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function hfGet(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(cfg.hf.timeoutMs, 30000));
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// discoverModels — quét HF tìm model mới, tạo entry draft (dedupe theo hf_model_id)
async function discoverModels() {
  const existing = new Set(await store.listHfIds());
  const sort = cfg.hfsync.discoverSort;
  const url = `${cfg.hf.apiBase}/models?sort=${encodeURIComponent(sort)}&limit=${cfg.hfsync.discoverLimit}&filter=text-generation`;
  const resp = await hfGet(url, cfg.hf.token);
  if (!resp.ok) throw new Error(`HF models list ${resp.status}`);
  const list = await resp.json();

  let created = 0;
  const detail = [];
  for (const m of list) {
    const id = m.modelId || m.id;
    if (!id || existing.has(id)) continue;
    // chỉ nhận model có config.json + library hợp lệ (best-effort qua fetchHfMetadata)
    let meta;
    try {
      meta = await hf.fetchHfMetadata(id);
    } catch (_) { continue; }
    if (!meta.ok) { detail.push({ id, error: meta.message }); continue; }
    const d = meta.data;
    const entry = {
      id: "mc-" + id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60),
      catalogType: "public",
      hfModelId: id,
      revision: d.revision || null,
      displayName: d.displayName || id.split("/").pop(),
      shortDescription: d.shortDescription || null,
      parametersDisplay: d.parametersDisplay || null,
      contextLengthDisplay: d.contextLengthDisplay || null,
      license: d.license || "unknown",
      categories: d.suggestedCategories || [],
      benchmarks: [],
      // Default hardware profile + giá (HF không trả info này) — để submit được ngay
      hardwareProfiles: [{
        gpu_sku_code: cfg.hfsync.defaultGpu,
        gpus_per_instance: 1,
        is_recommended: true,
        per_gpu_hourly_price_usd_micros: cfg.hfsync.defaultGpuPriceMicros,
        sort_order: 0,
        precision: cfg.hfsync.defaultPrecision,
        vram_required_gb: cfg.hfsync.defaultVramGb,
      }],
      fromPrice: Number((cfg.hfsync.defaultGpuPriceMicros / 1e6).toFixed(2)),
      syncEnabled: true,
      hfDiscovered: true,
    };
    try {
      await store.createEntry(entry, "hf-sync");
      await store.markHfChecked(entry.id);
      created++;
      detail.push({ id, action: "created" });
    } catch (e) {
      detail.push({ id, error: e.message });
    }
  }
  return { created, detail };
}

// revisionCheck — kiểm tra sha HF của entry active, sinh đề xuất nếu đổi
async function revisionCheck() {
  const entries = await store.listEntriesForSync();
  let newRevisions = 0;
  const detail = [];
  for (const e of entries) {
    try {
      const resp = await hfGet(`${cfg.hf.apiBase}/models/${e.hfModelId}`, cfg.hf.token);
      if (!resp.ok) { detail.push({ id: e.id, error: `HF ${resp.status}` }); continue; }
      const info = await resp.json();
      const sha = info.sha || null;
      await store.markHfChecked(e.id);
      if (sha && sha !== e.revision) {
        const pu = await store.createPendingUpdate(e.id, e.revision, sha);
        if (pu) { newRevisions++; detail.push({ id: e.id, from: e.revision, to: sha, action: "pending" }); }
      }
    } catch (err) {
      detail.push({ id: e.id, error: err.message });
    }
  }
  return { newRevisions, detail };
}

// runOnce — một chu kỳ đầy đủ, ghi mc_sync_runs
async function runOnce() {
  if (running) return { ok: true, skipped: true, reason: "đang chạy" };
  running = true;
  const detail = [];
  let discovered = 0, newRevisions = 0, errors = 0;
  try {
    try {
      const r = await discoverModels();
      discovered = r.created;
      detail.push({ phase: "discover", ...r.detail.length ? { items: r.detail } : {} });
    } catch (e) {
      errors++;
      detail.push({ phase: "discover", error: e.message });
    }
    if (cfg.hfsync.revisionCheckEnabled) {
      try {
        const r = await revisionCheck();
        newRevisions = r.newRevisions;
        detail.push({ phase: "revision", ...r.detail.length ? { items: r.detail } : {} });
      } catch (e) {
        errors++;
        detail.push({ phase: "revision", error: e.message });
      }
    }
    await store.recordSyncRun({ discovered, newRevisions, errors, detail });
    console.log(`[mc-hfsync] run xong — discovered=${discovered} newRevisions=${newRevisions} errors=${errors}`);
  } finally {
    running = false;
  }
  return { ok: true, discovered, newRevisions, errors };
}

function start() {
  if (!cfg.worker.enabled || !cfg.hfsync.enabled) {
    console.log(`[mc-hfsync] worker TẮT (MC_WORKER_ENABLED=${cfg.worker.enabled}, MC_HF_SYNC_ENABLED=${cfg.hfsync.enabled})`);
    return;
  }
  timer = setInterval(runOnce, cfg.hfsync.pollIntervalMs);
  timer.unref();
  setTimeout(runOnce, 1500);
  console.log(`[mc-hfsync] worker chạy — poll=${cfg.hfsync.pollIntervalMs}ms, discover=${cfg.hfsync.discoverLimit} (${cfg.hfsync.discoverSort}), revcheck=${cfg.hfsync.revisionCheckEnabled}`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function status() {
  return { running, enabled: cfg.worker.enabled && cfg.hfsync.enabled, pollIntervalMs: cfg.hfsync.pollIntervalMs };
}

module.exports = { start, stop, status, runOnce };