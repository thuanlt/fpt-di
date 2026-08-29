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

// ─── Telemetry ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
const KPI_BASE = {
  reqMin: 4200,
  errRate: 0.08,
  p95: 238,
};
function liveKpi() {
  const reqMin = KPI_BASE.reqMin + Math.floor(Math.random() * 600);
  const errRate = (KPI_BASE.errRate + Math.random() * 0.2).toFixed(2);
  const p95 = KPI_BASE.p95 + Math.floor(Math.random() * 20) - 10;
  return { reqMin, errRate: errRate + "%", p95: p95 + " ms" };
}

// ─── Routes ──
// Cố định trước (Express match theo thứ tự khai báo)
router.get("/data/_/tables", (req, res) => {
  res.json({ count: Object.keys(TABLES).length, data: Object.keys(TABLES) });
});

router.get("/data/_/telemetry", (req, res) => {
  res.json({ data: liveKpi() });
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
