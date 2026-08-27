"use strict";

// Model Catalog Admin — store (Postgres). Khớp pattern src/keys/store.js.
// Audit tái dụng src/audit/store.js (entity_type='mc_entry').

const crypto = require("crypto");
const db = require("../db/pool");
const audit = require("../audit/store");

const STATUSES = ["draft", "pending_review", "active", "inactive"];
const CATALOG_TYPES = ["public", "proprietary"];
const WEIGHT_STATUSES = ["not_mirrored", "mirroring", "mirrored", "mirror_failed"];

function genId(prefix) {
  return prefix + "-" + crypto.randomBytes(8).toString("hex");
}

function rowToEntry(r) {
  return {
    id: r.id,
    catalogType: r.catalog_type,
    status: r.status_code,
    hfModelId: r.hf_model_id,
    revision: r.revision,
    displayName: r.display_name,
    shortDescription: r.short_description,
    parametersDisplay: r.parameters_display,
    contextLengthDisplay: r.context_length_display,
    license: r.license,
    badgeCode: r.badge_code,
    sortOrder: r.sort_order,
    fromPrice: r.from_price !== null ? Number(r.from_price) : null,
    categories: r.categories || [],
    benchmarks: r.benchmarks || [],
    hardwareProfiles: r.hardware_profiles || [],
    weightStatus: r.weight_status,
    mirrorPath: r.mirror_path,
    mirrorChecksum: r.mirror_checksum,
    syncEnabled: r.sync_enabled,
    version: r.version,
    publishedAt: r.published_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Entries ────────────────────────────────────────────────────

// create(entry, actor) — entry mới luôn status=draft
async function createEntry(entry, actor) {
  const id = entry.id || genId("mc");
  const { rows } = await db.query(
    `INSERT INTO mc_entries (
       id, catalog_type, status_code, hf_model_id, revision, display_name,
       short_description, parameters_display, context_length_display, license,
       badge_code, sort_order, from_price, categories, benchmarks, hardware_profiles,
       weight_status, sync_enabled, created_by
     ) VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'not_mirrored',$16,$17)
     RETURNING *`,
    [
      id,
      CATALOG_TYPES.includes(entry.catalogType) ? entry.catalogType : "public",
      entry.hfModelId,
      entry.revision || null,
      entry.displayName,
      entry.shortDescription || null,
      entry.parametersDisplay || null,
      entry.contextLengthDisplay || null,
      entry.license,
      entry.badgeCode || null,
      parseInt(entry.sortOrder, 10) || 0,
      entry.fromPrice !== undefined && entry.fromPrice !== null ? entry.fromPrice : null,
      entry.categories || [],
      JSON.stringify(entry.benchmarks || []),
      JSON.stringify(entry.hardwareProfiles || []),
      entry.syncEnabled !== false,
      actor || "system",
    ]
  );
  const rec = rowToEntry(rows[0]);
  await audit.record({ actor: actor || "system", action: "mc.create", entityId: id, entityType: "mc_entry", meta: { displayName: rec.displayName, hfModelId: rec.hfModelId, catalogType: rec.catalogType } });
  return rec;
}

async function getEntry(id) {
  const { rows } = await db.query(`SELECT * FROM mc_entries WHERE id = $1`, [id]);
  return rows.length ? rowToEntry(rows[0]) : null;
}

// list({ status, catalogType, category, query, weightStatus, limit, offset })
async function listEntries({ status, catalogType, category, query, weightStatus, limit, offset } = {}) {
  const cond = [];
  const args = [];
  if (status && STATUSES.includes(status)) { cond.push(`status_code = $${args.length + 1}`); args.push(status); }
  if (catalogType && CATALOG_TYPES.includes(catalogType)) { cond.push(`catalog_type = $${args.length + 1}`); args.push(catalogType); }
  if (weightStatus && WEIGHT_STATUSES.includes(weightStatus)) { cond.push(`weight_status = $${args.length + 1}`); args.push(weightStatus); }
  if (category) { cond.push(`$${args.length + 1} = ANY(categories)`); args.push(category); }
  if (query) {
    const q = `%${query}%`;
    const n1 = args.length + 1, n2 = args.length + 2, n3 = args.length + 3;
    cond.push(`(id ILIKE $${n1} OR display_name ILIKE $${n2} OR hf_model_id ILIKE $${n3})`);
    args.push(q, q, q);
  }
  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const off = parseInt(offset, 10) || 0;
  let sql = `SELECT * FROM mc_entries`;
  if (cond.length) sql += ` WHERE ${cond.join(" AND ")}`;
  sql += ` ORDER BY sort_order ASC, updated_at DESC LIMIT ${lim} OFFSET ${off}`;
  const { rows } = await db.query(sql, args);
  return rows.map(rowToEntry);
}

async function countEntries({ status, catalogType } = {}) {
  const cond = [];
  const args = [];
  if (status && STATUSES.includes(status)) { cond.push(`status_code = $${args.length + 1}`); args.push(status); }
  if (catalogType && CATALOG_TYPES.includes(catalogType)) { cond.push(`catalog_type = $${args.length + 1}`); args.push(catalogType); }
  let sql = `SELECT COUNT(*)::int AS n FROM mc_entries`;
  if (cond.length) sql += ` WHERE ${cond.join(" AND ")}`;
  const { rows } = await db.query(sql, args);
  return rows[0].n;
}

// update(id, patch, actor) — chỉ draft/inactive được sửa (active chỉ sửa metadata nhẹ)
const UPDATABLE = {
  displayName: "display_name",
  shortDescription: "short_description",
  parametersDisplay: "parameters_display",
  contextLengthDisplay: "context_length_display",
  license: "license",
  badgeCode: "badge_code",
  sortOrder: "sort_order",
  fromPrice: "from_price",
  categories: "categories",
  benchmarks: "benchmarks",
  hardwareProfiles: "hardware_profiles",
  syncEnabled: "sync_enabled",
};

async function updateEntry(id, patch, actor) {
  const cur = await getEntry(id);
  if (!cur) return null;
  const sets = [];
  const args = [];
  const meta = {};
  for (const [k, col] of Object.entries(UPDATABLE)) {
    if (patch[k] === undefined) continue;
    args.push(k === "benchmarks" || k === "hardwareProfiles" ? JSON.stringify(patch[k]) : patch[k]);
    sets.push(`${col} = $${args.length}`);
    meta[k] = { from: cur[k], to: patch[k] };
  }
  if (!sets.length) return cur;
  args.push(id);
  sets.push(`version = version + 1`, `updated_at = now()`);
  const { rows } = await db.query(
    `UPDATE mc_entries SET ${sets.join(", ")} WHERE id = $${args.length} RETURNING *`,
    args
  );
  const rec = rowToEntry(rows[0]);
  await audit.record({ actor: actor || "system", action: "mc.update", entityId: id, entityType: "mc_entry", meta });
  return rec;
}

// setStatus(id, status, actor, metaExtra) — chuyển trạng thái workflow
async function setStatus(id, status, actor, metaExtra = {}) {
  if (!STATUSES.includes(status)) throw new Error(`status không hợp lệ: ${status}`);
  const cur = await getEntry(id);
  if (!cur) return null;
  const { rows } = await db.query(
    `UPDATE mc_entries SET status_code = $1, updated_at = now(), version = version + 1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  const rec = rowToEntry(rows[0]);
  const actionMap = {
    pending_review: "mc.submit",
    active: cur.status === "inactive" ? "mc.enable" : "mc.approve",
    draft: "mc.reject",
    inactive: "mc.disable",
  };
  await audit.record({
    actor: actor || "system",
    action: actionMap[status] || "mc.status",
    entityId: id,
    entityType: "mc_entry",
    meta: { from: cur.status, to: status, ...metaExtra },
  });
  return rec;
}

// deleteEntry(id, actor) — chỉ draft
async function deleteEntry(id, actor) {
  const cur = await getEntry(id);
  if (!cur) return false;
  if (cur.status !== "draft") {
    const err = new Error(`chỉ entry ${cur.status} không thể xóa — chỉ draft được xóa`);
    err.code = "NOT_DRAFT";
    throw err;
  }
  await db.query(`DELETE FROM mc_entries WHERE id = $1`, [id]);
  await audit.record({ actor: actor || "system", action: "mc.delete", entityId: id, entityType: "mc_entry", meta: { displayName: cur.displayName } });
  return true;
}

// ── Categories ─────────────────────────────────────────────────

async function listCategories() {
  const { rows } = await db.query(`SELECT * FROM mc_categories ORDER BY sort_order ASC, code ASC`);
  return rows.map((r) => ({ code: r.code, displayName: r.display_name, sortOrder: r.sort_order }));
}

async function createCategory({ code, displayName, sortOrder }, actor) {
  const { rows } = await db.query(
    `INSERT INTO mc_categories (code, display_name, sort_order) VALUES ($1,$2,$3) RETURNING *`,
    [code, displayName, parseInt(sortOrder, 10) || 0]
  );
  await audit.record({ actor: actor || "system", action: "mc.category.create", entityId: code, entityType: "mc_category" });
  return rows[0];
}

async function updateCategory(code, { displayName, sortOrder }, actor) {
  const { rows } = await db.query(
    `UPDATE mc_categories SET display_name = COALESCE($2, display_name), sort_order = COALESCE($3, sort_order) WHERE code = $1 RETURNING *`,
    [code, displayName || null, sortOrder !== undefined ? sortOrder : null]
  );
  await audit.record({ actor: actor || "system", action: "mc.category.update", entityId: code, entityType: "mc_category", meta: { displayName, sortOrder } });
  return rows[0] || null;
}

async function countModelsInCategory(code) {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM mc_entries WHERE $1 = ANY(categories)`, [code]);
  return rows[0].n;
}

async function deleteCategory(code, actor) {
  const n = await countModelsInCategory(code);
  if (n > 0) {
    const err = new Error(`category đang có ${n} model — không thể xóa`);
    err.code = "CATEGORY_IN_USE";
    throw err;
  }
  await db.query(`DELETE FROM mc_categories WHERE code = $1`, [code]);
  await audit.record({ actor: actor || "system", action: "mc.category.delete", entityId: code, entityType: "mc_category" });
  return true;
}

// ── Mirror jobs ────────────────────────────────────────────────

async function createMirrorJob(entryId, revision, actor) {
  const id = genId("mj");
  await db.query(
    `INSERT INTO mc_mirror_jobs (id, entry_id, revision, status) VALUES ($1,$2,$3,'queued')`,
    [id, entryId, revision || null]
  );
  await audit.record({ actor: actor || "system", action: "mc.mirror.enqueue", entityId: entryId, entityType: "mc_entry", meta: { jobId: id, revision } });
  return id;
}

async function listMirrorJobs(limit = 50) {
  const { rows } = await db.query(
    `SELECT mj.*, e.display_name, e.hf_model_id
     FROM mc_mirror_jobs mj JOIN mc_entries e ON e.id = mj.entry_id
     ORDER BY mj.started_at DESC NULLS LAST, mj.entry_id LIMIT ${Math.min(parseInt(limit, 10) || 50, 200)}`
  );
  return rows.map((r) => ({
    id: r.id,
    entryId: r.entry_id,
    displayName: r.display_name,
    hfModelId: r.hf_model_id,
    revision: r.revision,
    status: r.status,
    progressPct: r.progress_pct,
    attempts: r.attempts,
    error: r.error,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  }));
}

async function updateMirrorJob(id, patch) {
  const sets = [];
  const args = [];
  for (const [k, col] of Object.entries({ status: "status", progressPct: "progress_pct", attempts: "attempts", error: "error" })) {
    if (patch[k] === undefined) continue;
    args.push(patch[k]);
    sets.push(`${col} = $${args.length}`);
  }
  if (patch.status === "downloading" && patch.startedAt === undefined) sets.push(`started_at = COALESCE(started_at, now())`);
  if (["mirrored", "failed", "cancelled"].includes(patch.status)) sets.push(`finished_at = now()`);
  if (!sets.length) return;
  args.push(id);
  await db.query(`UPDATE mc_mirror_jobs SET ${sets.join(", ")} WHERE id = $${args.length}`, args);
}

async function claimNextMirrorJob() {
  // 1 job queued → downloading (atomic)
  const { rows } = await db.query(
    `UPDATE mc_mirror_jobs SET status = 'downloading', started_at = COALESCE(started_at, now())
     WHERE id = (SELECT id FROM mc_mirror_jobs WHERE status = 'queued' ORDER BY started_at NULLS LAST, entry_id LIMIT 1)
     RETURNING *`
  );
  return rows.length ? rows[0] : null;
}

async function activeMirrorJobCount() {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM mc_mirror_jobs WHERE status IN ('queued','downloading')`);
  return rows[0].n;
}

// ── Pending updates (Phase 2) ──────────────────────────────────

async function listPendingUpdates() {
  const { rows } = await db.query(
    `SELECT pu.*, e.display_name, e.hf_model_id
     FROM mc_pending_updates pu JOIN mc_entries e ON e.id = pu.entry_id
     WHERE pu.status = 'pending'
     ORDER BY pu.detected_at DESC`
  );
  return rows.map((r) => ({
    id: r.id, entryId: r.entry_id, displayName: r.display_name, hfModelId: r.hf_model_id,
    oldRevision: r.old_revision, newRevision: r.new_revision, detectedAt: r.detected_at,
  }));
}

async function decidePendingUpdate(id, decision, actor) {
  const { rows } = await db.query(
    `UPDATE mc_pending_updates SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3 AND status = 'pending' RETURNING *`,
    [decision, actor || "system", id]
  );
  if (!rows.length) return null;
  await audit.record({ actor: actor || "system", action: decision === "approved" ? "mc.sync.approve" : "mc.sync.reject", entityId: rows[0].entry_id, entityType: "mc_entry", meta: { updateId: id, from: rows[0].old_revision, to: rows[0].new_revision } });
  return rows[0];
}

// markPublished(id) — đánh dấu thời điểm publish BFF thành công cuối
async function markPublished(id) {
  await db.query(`UPDATE mc_entries SET published_at = now() WHERE id = $1`, [id]);
}

// ── Weight status ──────────────────────────────────────────────

async function setWeightStatus(id, weightStatus, extra = {}) {
  const { rows } = await db.query(
    `UPDATE mc_entries SET weight_status = $1, mirror_path = COALESCE($2, mirror_path),
       mirror_checksum = COALESCE($3, mirror_checksum), updated_at = now()
     WHERE id = $4 RETURNING *`,
    [weightStatus, extra.mirrorPath || null, extra.checksum || null, id]
  );
  return rows.length ? rowToEntry(rows[0]) : null;
}

// ── History (audit theo entry) ─────────────────────────────────

async function entryHistory(id, limit = 100) {
  const { rows } = await db.query(
    `SELECT id, ts, actor, role, action, result, meta FROM audit_log
     WHERE entity_id = $1 AND entity_type = 'mc_entry'
     ORDER BY ts DESC LIMIT ${Math.min(parseInt(limit, 10) || 100, 500)}`,
    [id]
  );
  return rows.map((r) => ({ id: r.id, ts: r.ts, actor: r.actor, role: r.role, action: r.action, result: r.result, meta: r.meta }));
}

module.exports = {
  STATUSES, CATALOG_TYPES, WEIGHT_STATUSES,
  createEntry, getEntry, listEntries, countEntries, updateEntry, setStatus, deleteEntry,
  listCategories, createCategory, updateCategory, deleteCategory, countModelsInCategory,
  createMirrorJob, listMirrorJobs, updateMirrorJob, claimNextMirrorJob, activeMirrorJobCount,
  listPendingUpdates, decidePendingUpdate,
  setWeightStatus, entryHistory, markPublished,
};