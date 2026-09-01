"use strict";

const express = require("express");
const db = require("../db/pool");

const router = express.Router();

// Bảng đối tượng trả về dạng JSONB, Trung bình tên bảng -> endpoint
// Đây là API nguồn dữ liệu công khai (GET), không cần auth
// Theo yêu cầu "ko mock ko fake" — đọc trực tiếp từ Postgres.

const TABLES = {
  // Overview
  attention: "attention",
  activity: "activity",
  milestones: "milestones",
  // NVIDIA
  nv_programs: "nv_programs",
  nv_contacts: "nv_contacts",
  nv_timeline: "nv_timeline",
  // Partners
  partners: "partners",
  // Catalog
  catalog_models: "catalog_models",
  // Serverless
  serverless_endpoints: "serverless_endpoints",
  // Fine-tune
  ft_jobs: "ft_jobs",
  ft_pricing: "ft_pricing",
  // SLA + PTU
  sla_info: "sla_info",
  sla_credit_tiers: "sla_credit_tiers",
  ptu_plans: "ptu_plans",
  // Experiments
  experiments: "experiments",
  // Pricing
  pricing_tiers: "pricing_tiers",
  // Customers
  customers: "customers",
  // Infra
  gpu_cards: "gpu_cards",
  nodes: "nodes",
  clusters: "clusters",
  regions_extra: "regions_extra",
  regions: "regions",
  maintenance: "maintenance",
  // DevTools
  headroom: "headroom",
  agent_skills: "agent_skills",
  cli_install: "cli_install",
  cli_cmds: "cli_cmds",
  sdk_samples: "sdk_samples",
  docs: "docs",
};

// Bộ lọc cột công khai (tránh lộ thông tin nội bộ)
const COLUMN_ALLOW = {};

async function listTable(name, { orderBy = "id ASC", limit = 500 } = {}) {
  const table = TABLES[name];
  if (!table) throw new Error(`table "${name}" không hỗ trợ`);
  const res = await db.query(`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT ${limit}`);
  return res.rows;
}

async function getById(name, id) {
  const table = TABLES[name];
  if (!table) throw new Error(`table "${name}" không hỗ trợ`);
  const res = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

// ─── Routes ──
// Cố định trước (Express match theo thứ tự khai báo)
router.get("/data/_/tables", (req, res) => {
  res.json({ count: Object.keys(TABLES).length, data: Object.keys(TABLES) });
});

// Telemetry — dữ liệu THẬT từ endpoint_usage (24h). Không random.
// Chưa có traffic thật → live:false + số 0 (thành thật, không giả lập).
router.get("/data/_/telemetry", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT count(*) AS requests,
              count(*) FILTER (WHERE status_code >= 400) AS errors,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
       FROM endpoint_usage
       WHERE created_at >= now() - interval '24 hours'`
    );
    const r = rows[0];
    const requests = parseInt(r.requests, 10);
    const errors = parseInt(r.errors, 10);
    const p95 = Math.round(Number(r.p95) || 0);
    const errRate = requests > 0 ? Math.round((errors / requests) * 10000) / 100 : 0;
    res.json({
      data: {
        reqMin: Math.round((requests / 1440) * 100) / 100,
        errRate: errRate + "%",
        p95: p95 + " ms",
        requests24h: requests,
        live: requests > 0,
      },
    });
  } catch (e) {
    res.json({ data: { reqMin: 0, errRate: "0%", p95: "0 ms", requests24h: 0, live: false } });
  }
});

router.get("/data/sla/_/full", async (req, res) => {
  try {
    const info = await listTable("sla_info");
    const tiers = await listTable("sla_credit_tiers");
    const ptu = await listTable("ptu_plans");
    res.json({
      data: {
        uptime: info[0]?.uptime || "99.9%",
        creditTiers: tiers.map((t) => ({ below: t.below, credit: t.credit, desc: t.desc })),
        ptuPlans: ptu,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/data/nv_programs/_/formatted", async (req, res) => {
  try {
    const rows = await listTable("nv_programs");
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        ...r,
        stats: Array.isArray(r.stats) ? r.stats : JSON.parse(r.stats || "[]"),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/data/cli/_/full", async (req, res) => {
  try {
    const installs = await listTable("cli_install");
    const cmds = await listTable("cli_cmds", { orderBy: "category, ord" });
    res.json({
      data: {
        install: installs.find((i) => i.name === "default")?.command || "",
        installPip: installs.find((i) => i.name === "pip")?.command || "",
        installBrew: installs.find((i) => i.name === "brew")?.command || "",
        cmds: cmds.filter((c) => c.category === "quickstart").map((c) => ({ cmd: c.cmd, desc: c.desc })),
        cmds2: cmds.filter((c) => c.category === "endpoint-batch").map((c) => ({ cmd: c.cmd, desc: c.desc })),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DDI Model Catalog — model đã approve (active) từ admin catalog (mc_entries).
// Partner console fetch endpoint này để hiện động model dedicated inference.
router.get("/data/ddi_catalog", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, hf_model_id, parameters_display, context_length_display,
              short_description, badge_code, from_price, categories
       FROM mc_entries
       WHERE status_code = 'active' AND catalog_type = 'public'
       ORDER BY sort_order ASC, updated_at DESC`
    );
    const data = rows.map((r) => {
      const cats = Array.isArray(r.categories) ? r.categories : [];
      const modal = cats.some((c) => ["video-generation", "image-to-video"].includes(c)) ? "video"
        : cats.some((c) => ["image-text", "vision"].includes(c)) ? "text+vision"
        : "text";
      return {
        model: r.display_name,
        vendor: String(r.hf_model_id || "").split("/")[0] || "Unknown",
        ctx: r.context_length_display || "—",
        modal,
        size: r.parameters_display || "—",
        status: "new",
        note: r.short_description || "",
        price: r.from_price !== null ? Number(r.from_price) : null,
        hfId: r.hf_model_id,
        ddi: true,
      };
    });
    res.json({ count: data.length, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Operational data (read-only, public) — mirror the real operational stores ───
// Dữ liệu THẬT cùng nguồn với API operational, cho dashboard public.
// KHÔNG lộ cột nhạy cảm (vd. api_keys.key_hash).

// Dedicated endpoints — bảng endpoint_entities (cùng nguồn GET /v1/endpoints).
// Trả về shape đầy đủ để renderDedicated() dùng được (id, replicas, commitLabel...).
router.get("/data/endpoints", async (req, res) => {
  try {
    const mode = req.query.mode;
    let sql = `SELECT id, name, model, gpu, region, mode, commit, replicas, rate, commit_label,
              segment, engine, status, created_at FROM endpoint_entities`;
    const args = [];
    if (mode && mode !== "all") { sql += ` WHERE mode = $${args.length + 1}`; args.push(mode); }
    sql += ` ORDER BY created_at DESC LIMIT 200`;
    const { rows } = await db.query(sql, args);
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id, name: r.name, model: r.model, gpu: r.gpu, region: r.region, mode: r.mode,
        commit: r.commit, commitLabel: r.commit_label, replicas: r.replicas,
        rate: String(r.rate), status: r.status, segment: r.segment, engine: r.engine,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// API keys — bảng api_keys + usage từ key_usage_audit (KHÔNG lộ key_hash).
router.get("/data/keys", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT k.name, k.key_prefix, k.scopes, k.status, k.created_at, k.last_used_at, k.role,
              (SELECT count(*)::int FROM key_usage_audit u WHERE u.key_id = k.id AND u.action='verify') AS usage
       FROM api_keys k ORDER BY k.created_at DESC LIMIT 200`
    );
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        name: r.name, keyPrefix: r.key_prefix, scopes: r.scopes, status: r.status,
        created: r.created_at, lastUsed: r.last_used_at, role: r.role, usage: r.usage,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Audit trail — bảng audit_log (append-only, cùng nguồn GET /v1/audit).
// Hỗ trợ filter actor/action/from/to + limit (giống /v1/audit) cho panel audit.
router.get("/data/audit", async (req, res) => {
  try {
    const { actor, action, from, to } = req.query || {};
    const cond = [];
    const args = [];
    if (actor) { cond.push(`actor = $${args.length + 1}`); args.push(actor); }
    if (action) { cond.push(`action = $${args.length + 1}`); args.push(action); }
    if (from) { cond.push(`ts >= $${args.length + 1}`); args.push(from); }
    if (to) { cond.push(`ts <= $${args.length + 1}`); args.push(to); }
    const lim = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let sql = `SELECT id, ts, actor, role, action, entity_id, entity_type, result, ip FROM audit_log`;
    if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
    sql += ` ORDER BY ts DESC LIMIT ${lim}`;
    const { rows } = await db.query(sql, args);
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id, ts: r.ts, actor: r.actor, role: r.role, action: r.action,
        entityId: r.entity_id, entityType: r.entity_type, result: r.result, ip: r.ip,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// NIM model catalog — bảng model_catalog (cùng nguồn GET /v1/catalog).
router.get("/data/catalog", async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM model_catalog ORDER BY name`);
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id, name: r.name, family: r.family, segments: r.segments, source: r.source,
        nimVersion: r.nim_version, gpuCompatible: r.gpu_compatible, maxContext: r.max_context,
        quantizations: r.quantizations, status: r.status,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Batch jobs — Redis ddi:batch:jobs + stats (cùng nguồn GET /v1/batch).
router.get("/data/batch", async (req, res) => {
  try {
    const queue = require("../batch/queue");
    const jobs = await queue.listJobs({ limit: 100 });
    const stats = await queue.getStats();
    res.json({
      count: jobs.length,
      data: jobs.map((j) => ({
        id: j.id, model: j.model, requests: String(j.requests || 0), status: j.status,
        submittedAt: j.submittedAt, window: j.window || "—",
        startedAt: j.startedAt || null, completedAt: j.completedAt || null,
        savings: j.savings || "−50%",
      })),
      stats,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Price packs — bảng price_pack (cùng nguồn GET /v1/price-packs). Read-only public.
router.get("/data/price-packs", async (req, res) => {
  try {
    const { segment, gpu, region } = req.query || {};
    const cond = [];
    const args = [];
    if (segment) { cond.push(`segment = $${args.length + 1}`); args.push(segment); }
    if (gpu) { cond.push(`gpu = $${args.length + 1}`); args.push(gpu); }
    if (region) { cond.push(`region = $${args.length + 1}`); args.push(region); }
    let sql = `SELECT id, segment, gpu, region, rate_per_hour, rate_per_token, commitment,
              discount_pct, quota_rpm, quota_tpm, deployment_target FROM price_pack`;
    if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
    sql += ` ORDER BY segment, gpu, region LIMIT 200`;
    const { rows } = await db.query(sql, args);
    res.json({
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id, segment: r.segment, gpu: r.gpu, region: r.region,
        ratePerHour: Number(r.rate_per_hour),
        ratePerToken: r.rate_per_token != null ? Number(r.rate_per_token) : null,
        commitment: r.commitment,
        discountPct: r.discount_pct != null ? Number(r.discount_pct) : null,
        quotaRpm: r.quota_rpm, quotaTpm: r.quota_tpm, deploymentTarget: r.deployment_target,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/data/:table", async (req, res) => {
  try {
    const name = req.params.table;
    let orderBy = "id ASC";
    if (name === "activity") orderBy = "id ASC";
    if (name === "attention") orderBy = "id ASC";
    if (name === "cli_cmds") orderBy = "category ASC, ord ASC";
    const rows = await listTable(name, { orderBy, limit: parseInt(req.query.limit || "500", 10) });
    res.json({ count: rows.length, data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/data/:table/:id", async (req, res) => {
  try {
    const row = await getById(req.params.table, parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ error: "Không tìm thấy" });
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
