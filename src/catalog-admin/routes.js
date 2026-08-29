"use strict";

// Model Catalog Admin — routes.
// Mount: app.use('/v1', catalogAdminRouter) → /v1/admin/catalog/*
// Auth: scope 'admin' (gate ở server.js) + role gate (admin / approver).

const express = require("express");
const store = require("./store");
const hf = require("./hf");
const publish = require("./publish");
const cfg = require("./config");

const router = express.Router();

function actorOf(req) {
  return (req.apiKey && (req.apiKey.name || req.apiKey.id)) || "unknown";
}
function roleOf(req) {
  return (req.apiKey && req.apiKey.role) || "viewer";
}

// ── Validation ─────────────────────────────────────────────────

const REQUIRED_FIELDS = ["id", "hfModelId", "displayName", "license"];

function validateEntry(body, { partial = false } = {}) {
  const errors = [];
  const e = body || {};
  if (!partial) {
    for (const f of REQUIRED_FIELDS) {
      if (!e[f] || String(e[f]).trim() === "") errors.push(`thiếu trường bắt buộc: ${f}`);
    }
  }
  if (e.catalogType !== undefined && !store.CATALOG_TYPES.includes(e.catalogType)) {
    errors.push(`catalogType phải là ${store.CATALOG_TYPES.join("/")}`);
  }
  if (e.hardwareProfiles !== undefined) {
    if (!Array.isArray(e.hardwareProfiles) || e.hardwareProfiles.length === 0) {
      errors.push("hardwareProfiles phải là mảng ≥ 1 profile");
    } else {
      const recommended = e.hardwareProfiles.filter((p) => p.is_recommended).length;
      if (recommended !== 1) errors.push("phải có đúng 1 hardware profile is_recommended=true");
      for (const p of e.hardwareProfiles) {
        if (p.per_gpu_hourly_price_usd_micros !== undefined && p.per_gpu_hourly_price_usd_micros < 0) {
          errors.push("giá GPU phải ≥ 0");
        }
      }
    }
  }
  if (e.categories !== undefined && !Array.isArray(e.categories)) errors.push("categories phải là mảng");
  if (e.fromPrice !== undefined && e.fromPrice !== null && (isNaN(e.fromPrice) || e.fromPrice < 0)) {
    errors.push("fromPrice phải là số ≥ 0");
  }
  return errors;
}

function httpError(res, status, code, message) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

// ── Entries ────────────────────────────────────────────────────

// GET /admin/catalog/entries — list + filter (FR-MC-001)
router.get("/admin/catalog/entries", async (req, res) => {
  try {
    const { status, catalog_type, category, query, weight_status, limit, offset } = req.query || {};
    const data = await store.listEntries({ status, catalogType: catalog_type, category, query, weightStatus: weight_status, limit, offset });
    const total = await store.countEntries({ status, catalogType: catalog_type });
    res.json({ ok: true, count: data.length, total, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// GET /admin/catalog/entries/:id — detail + history (FR-MC-001, 008)
router.get("/admin/catalog/entries/:id", async (req, res) => {
  try {
    const entry = await store.getEntry(req.params.id);
    if (!entry) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    const history = await store.entryHistory(entry.id);
    res.json({ ok: true, data: { ...entry, history } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/hf-fetch — fetch metadata HF (FR-MC-002)
router.post("/admin/catalog/hf-fetch", async (req, res) => {
  try {
    const { hf_model_id } = req.body || {};
    const r = await hf.fetchHfMetadata(hf_model_id);
    if (!r.ok) {
      const status = r.code === "HF_REPO_NOT_FOUND" || r.code === "INVALID_REPO_ID" || r.code === "HF_MISSING_CONFIG" ? 400 : 502;
      return httpError(res, status, r.code, r.message);
    }
    res.json({ ok: true, data: r.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries — create (draft) (FR-MC-002, 003)
router.post("/admin/catalog/entries", async (req, res) => {
  try {
    const errors = validateEntry(req.body || {});
    if (errors.length) return httpError(res, 400, "VALIDATION_FAILED", errors.join("; "));
    const existing = await store.getEntry(req.body.id);
    if (existing) return httpError(res, 409, "DUPLICATE_ID", `entry ${req.body.id} đã tồn tại`);
    const entry = await store.createEntry(req.body, actorOf(req));
    res.status(201).json({ ok: true, data: entry });
  } catch (e) {
    if (e.code === "23505") return httpError(res, 409, "DUPLICATE_ID", "id đã tồn tại");
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// ── Import helpers ─────────────────────────────────────────────

// normalizeEntry — chấp nhận cả schema nội bộ (camelCase) lẫn payload BFF
// (snake_case, ddi.model-catalog-create). hardware_profiles/benchmarks giữ nguyên.
function normalizeEntry(raw) {
  const e = raw || {};
  return {
    id: e.id,
    hfModelId: e.hfModelId ?? e.hf_model_id,
    displayName: e.displayName ?? e.display_name,
    shortDescription: e.shortDescription ?? e.short_description ?? null,
    parametersDisplay: e.parametersDisplay ?? e.parameters_display ?? null,
    contextLengthDisplay: e.contextLengthDisplay ?? e.context_length_display ?? null,
    license: e.license,
    badgeCode: e.badgeCode ?? e.badge_code ?? null,
    catalogType: e.catalogType ?? e.catalog_type ?? "public",
    sortOrder: e.sortOrder ?? e.sort_order ?? 0,
    fromPrice: e.fromPrice ?? e.from_price ?? null,
    categories: e.categories ?? [],
    benchmarks: e.benchmarks ?? [],
    hardwareProfiles: e.hardwareProfiles ?? e.hardware_profiles ?? [],
    revision: e.revision ?? null,
  };
}

// extractFromMarkdown — lấy payload JSON từ code block `curl ... --data '{...}'`
function extractFromMarkdown(text) {
  const out = [];
  const re = /--data\s+'([\s\S]*?)'/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const o = JSON.parse(m[1].trim());
      out.push(o.payload || o);
    } catch (_) { /* bỏ qua block không phải JSON */ }
  }
  return out;
}

// parseImportBody — trả { entries, error } từ body import
function parseImportBody(body) {
  body = body || {};
  let list = null;
  if (Array.isArray(body.entries)) list = body.entries;
  else if (Array.isArray(body)) list = body;
  else if (typeof body.content === "string") {
    const fmt = String(body.format || "auto").toLowerCase();
    const text = body.content;
    if (fmt === "md" || fmt === "markdown") {
      list = extractFromMarkdown(text);
    } else {
      try {
        const o = JSON.parse(text);
        list = Array.isArray(o) ? o : (o && Array.isArray(o.entries)) ? o.entries : (o && o.payload) ? [o.payload] : null;
      } catch (_) {
        if (fmt === "json") return { error: "file không phải JSON hợp lệ" };
        list = extractFromMarkdown(text); // auto: JSON fail → thử markdown
      }
    }
  }
  if (!Array.isArray(list) || !list.length) {
    return { error: "không tìm thấy entry nào — file phải là JSON (mảng / {entries} / {payload}) hoặc Markdown chứa payload curl" };
  }
  return { entries: list.map(normalizeEntry) };
}

// POST /admin/catalog/import — import entries từ file JSON/MD (tạo draft, tối đa 50/lần)
// Body: { entries: [...] }  hoặc  { content: "<nội dung file>", format: "json"|"md"|"auto", dryRun?: true }
router.post("/admin/catalog/import", async (req, res) => {
  try {
    const { entries, error } = parseImportBody(req.body);
    if (error) return httpError(res, 400, "VALIDATION_FAILED", error);
    if (entries.length > 50) return httpError(res, 400, "TOO_MANY", "tối đa 50 entry mỗi lần import");

    const dryRun = req.body && req.body.dryRun === true;
    const created = [], skipped = [], failed = [];
    for (const e of entries) {
      const errors = validateEntry(e);
      if (errors.length) { failed.push({ id: e.id || "?", errors }); continue; }
      const existing = await store.getEntry(e.id);
      if (existing) { skipped.push({ id: e.id, reason: "đã tồn tại" }); continue; }
      if (dryRun) { created.push({ id: e.id, displayName: e.displayName }); continue; }
      try {
        const entry = await store.createEntry(e, actorOf(req));
        created.push({ id: entry.id, displayName: entry.displayName });
      } catch (err) {
        if (err.code === "23505") skipped.push({ id: e.id, reason: "đã tồn tại" });
        else failed.push({ id: e.id || "?", errors: [err.message] });
      }
    }
    res.json({ ok: true, dryRun, data: { total: entries.length, created: created.length, skipped: skipped.length, failed: failed.length, created, skipped, failed } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// GET /admin/catalog/export — export catalog ra JSON (theo tab catalog_type + status hiện tại)
router.get("/admin/catalog/export", async (req, res) => {
  try {
    const { catalog_type, status } = req.query || {};
    const all = [];
    const PAGE = 200;
    for (let off = 0; off < 1000; off += PAGE) {
      const page = await store.listEntries({ catalogType: catalog_type, status, limit: PAGE, offset: off });
      all.push(...page);
      if (page.length < PAGE) break;
    }
    res.json({ ok: true, count: all.length, data: all });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// PUT /admin/catalog/entries/:id — update (draft/inactive) (FR-MC-006)
router.put("/admin/catalog/entries/:id", async (req, res) => {
  try {
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status === "pending_review") return httpError(res, 409, "PENDING_REVIEW", "entry đang chờ duyệt — không thể sửa");
    if (cur.status === "active") return httpError(res, 409, "ACTIVE", "entry đang active — disable trước khi sửa");
    const errors = validateEntry(req.body || {}, { partial: true });
    if (errors.length) return httpError(res, 400, "VALIDATION_FAILED", errors.join("; "));
    const entry = await store.updateEntry(req.params.id, req.body, actorOf(req));
    res.json({ ok: true, data: entry });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries/:id/submit — draft → pending_review (FR-MC-005)
router.post("/admin/catalog/entries/:id/submit", async (req, res) => {
  try {
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status !== "draft") return httpError(res, 409, "NOT_DRAFT", `chỉ draft được submit (hiện: ${cur.status})`);
    if (!cur.hardwareProfiles.length) return httpError(res, 400, "NO_HARDWARE", "entry chưa có hardware profile");
    if (cur.fromPrice === null && !cur.hardwareProfiles.some((p) => p.per_gpu_hourly_price_usd_micros > 0)) {
      return httpError(res, 400, "NO_PRICE", "entry chưa có giá — nhập giá cho ít nhất 1 GPU profile");
    }
    const entry = await store.setStatus(cur.id, "pending_review", actorOf(req));
    res.json({ ok: true, data: entry });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries/:id/approve — pending_review → active + publish + mirror (FR-MC-005, 012)
router.post("/admin/catalog/entries/:id/approve", async (req, res) => {
  try {
    const actor = actorOf(req);
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status !== "pending_review") return httpError(res, 409, "NOT_PENDING", `chỉ pending_review được approve (hiện: ${cur.status})`);
    if (cfg.strictApproval && cur.createdBy === actor) {
      return httpError(res, 403, "SELF_APPROVE", "Chế độ duyệt chặt đang bật — người tạo không thể tự duyệt");
    }
    const entry = await store.setStatus(cur.id, "active", actor, { approver: actor });
    // publish sang BFF (best-effort — fail không rollback duyệt)
    const pub = await publish.publish(entry).catch((e) => ({ ok: false, detail: e.message }));
    if (pub.ok) await store.markPublished(cur.id).catch(() => {});
    // kick mirror job cho entry nguồn HF
    if (entry.catalogType === "public" || entry.hfModelId) {
      await store.createMirrorJob(cur.id, entry.revision, actor);
    }
    res.json({ ok: true, data: entry, publish: pub });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries/:id/reject — pending_review → draft + lý do (FR-MC-005)
router.post("/admin/catalog/entries/:id/reject", async (req, res) => {
  try {
    const actor = actorOf(req);
    const { reason } = req.body || {};
    if (!reason || String(reason).trim().length < 5) {
      return httpError(res, 400, "REASON_REQUIRED", "lý do từ chối bắt buộc (≥ 5 ký tự)");
    }
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status !== "pending_review") return httpError(res, 409, "NOT_PENDING", `chỉ pending_review được reject (hiện: ${cur.status})`);
    const entry = await store.setStatus(cur.id, "draft", actor, { reason: String(reason).trim() });
    res.json({ ok: true, data: entry });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries/:id/disable — active → inactive (FR-MC-006)
router.post("/admin/catalog/entries/:id/disable", async (req, res) => {
  try {
    const actor = actorOf(req);
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status !== "active") return httpError(res, 409, "NOT_ACTIVE", `chỉ active được disable (hiện: ${cur.status})`);
    const entry = await store.setStatus(cur.id, "inactive", actor);
    const pub = await publish.unpublish(entry).catch((e) => ({ ok: false, detail: e.message }));
    res.json({ ok: true, data: entry, publish: pub });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /admin/catalog/entries/:id/enable — inactive → active (FR-MC-006)
router.post("/admin/catalog/entries/:id/enable", async (req, res) => {
  try {
    const actor = actorOf(req);
    const cur = await store.getEntry(req.params.id);
    if (!cur) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    if (cur.status !== "inactive") return httpError(res, 409, "NOT_INACTIVE", `chỉ inactive được enable (hiện: ${cur.status})`);
    const entry = await store.setStatus(cur.id, "active", actor);
    const pub = await publish.publish(entry).catch((e) => ({ ok: false, detail: e.message }));
    res.json({ ok: true, data: entry, publish: pub });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// DELETE /admin/catalog/entries/:id — chỉ draft (FR-MC-006)
router.delete("/admin/catalog/entries/:id", async (req, res) => {
  try {
    const ok = await store.deleteEntry(req.params.id, actorOf(req));
    if (!ok) return httpError(res, 404, "NOT_FOUND", "entry không tồn tại");
    res.json({ ok: true, data: { deleted: req.params.id } });
  } catch (e) {
    if (e.code === "NOT_DRAFT") return httpError(res, 409, "NOT_DRAFT", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// ── Categories ─────────────────────────────────────────────────

router.get("/admin/catalog/categories", async (req, res) => {
  try {
    const data = await store.listCategories();
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.post("/admin/catalog/categories", async (req, res) => {
  try {
    const { code, display_name, sort_order } = req.body || {};
    if (!code || !display_name) return httpError(res, 400, "VALIDATION_FAILED", "thiếu code hoặc display_name");
    if (!/^[a-z0-9-]+$/.test(code)) return httpError(res, 400, "VALIDATION_FAILED", "code phải là slug (chữ thường, số, gạch)");
    const rec = await store.createCategory({ code, displayName: display_name, sortOrder: sort_order }, actorOf(req));
    res.status(201).json({ ok: true, data: { code: rec.code, displayName: rec.display_name, sortOrder: rec.sort_order } });
  } catch (e) {
    if (e.code === "23505") return httpError(res, 409, "DUPLICATE", `category ${req.body?.code || ""} đã tồn tại`);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.put("/admin/catalog/categories/:code", async (req, res) => {
  try {
    const rec = await store.updateCategory(req.params.code, { displayName: req.body?.display_name, sortOrder: req.body?.sort_order }, actorOf(req));
    if (!rec) return httpError(res, 404, "NOT_FOUND", "category không tồn tại");
    res.json({ ok: true, data: { code: rec.code, displayName: rec.display_name, sortOrder: rec.sort_order } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.delete("/admin/catalog/categories/:code", async (req, res) => {
  try {
    await store.deleteCategory(req.params.code, actorOf(req));
    res.json({ ok: true, data: { deleted: req.params.code } });
  } catch (e) {
    if (e.code === "CATEGORY_IN_USE") return httpError(res, 409, "CATEGORY_IN_USE", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// ── Mirror jobs ────────────────────────────────────────────────

router.get("/admin/catalog/mirror-jobs", async (req, res) => {
  try {
    const data = await store.listMirrorJobs(req.query.limit);
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.post("/admin/catalog/mirror-jobs/:id/retry", async (req, res) => {
  try {
    const jobs = await store.listMirrorJobs(200);
    const job = jobs.find((j) => j.id === req.params.id);
    if (!job) return httpError(res, 404, "NOT_FOUND", "job không tồn tại");
    if (job.status !== "failed") return httpError(res, 409, "NOT_FAILED", `chỉ job failed được retry (hiện: ${job.status})`);
    await store.updateMirrorJob(job.id, { status: "queued", attempts: 0, error: null, progressPct: 0 });
    await store.setWeightStatus(job.entryId, "not_mirrored");
    res.json({ ok: true, data: { id: job.id, status: "queued" } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.post("/admin/catalog/mirror-jobs/:id/cancel", async (req, res) => {
  try {
    const jobs = await store.listMirrorJobs(200);
    const job = jobs.find((j) => j.id === req.params.id);
    if (!job) return httpError(res, 404, "NOT_FOUND", "job không tồn tại");
    if (!["queued", "downloading"].includes(job.status)) return httpError(res, 409, "NOT_RUNNING", `chỉ job queued/downloading được hủy (hiện: ${job.status})`);
    await store.updateMirrorJob(job.id, { status: "cancelled" });
    await store.setWeightStatus(job.entryId, "not_mirrored");
    res.json({ ok: true, data: { id: job.id, status: "cancelled" } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// ── Audit (theo entry) ─────────────────────────────────────────

router.get("/admin/catalog/audit", async (req, res) => {
  try {
    const { entry_id, limit } = req.query || {};
    if (!entry_id) return httpError(res, 400, "VALIDATION_FAILED", "thiếu entry_id");
    const data = await store.entryHistory(entry_id, limit);
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// ── Pending updates (Phase 2) ──────────────────────────────────

router.get("/admin/catalog/pending-updates", async (req, res) => {
  try {
    const data = await store.listPendingUpdates();
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.post("/admin/catalog/pending-updates/:id/approve", async (req, res) => {
  try {
    const rec = await store.decidePendingUpdate(req.params.id, "approved", actorOf(req));
    if (!rec) return httpError(res, 404, "NOT_FOUND", "pending update không tồn tại hoặc đã được xử lý");
    // re-mirror: reset weight_status + job mới
    await store.setWeightStatus(rec.entry_id, "mirroring");
    await store.createMirrorJob(rec.entry_id, rec.new_revision, actorOf(req));
    res.json({ ok: true, data: { id: rec.id, status: "approved", reMirroring: true } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

router.post("/admin/catalog/pending-updates/:id/reject", async (req, res) => {
  try {
    const rec = await store.decidePendingUpdate(req.params.id, "rejected", actorOf(req));
    if (!rec) return httpError(res, 404, "NOT_FOUND", "pending update không tồn tại hoặc đã được xử lý");
    res.json({ ok: true, data: { id: rec.id, status: "rejected" } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

module.exports = router;
module.exports.roleOf = roleOf;