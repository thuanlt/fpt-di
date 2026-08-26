"use strict";

// Endpoints store — 2 backend qua env ENDPOINTS_BACKEND:
//   - file    (mặc định): JSON trên disk (hành vi cũ, preview/dev)
//   - postgres: bảng endpoint_entities + endpoint_events (Gap 1, prod scale)
// Giữ nguyên signatures của tất cả hàm exported để callers (endpoints/routes.js,
// endpoints/worker.js, endpoints/invoke.js, byom/routes.js) không đổi.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BACKEND = (process.env.ENDPOINTS_BACKEND || "file").toLowerCase();

const GPU_TIERS = ["A30", "H100", "H200", "B300"];
const REGIONS = ["HAN-1", "HAN-2", "SGN-1"];
const MODES = ["k8s", "container"];
const COMMITS = ["on-demand", "7-30", "91-180"];
// US-01 — segment + engine (NIM deploy)
// US-01 — segment + engine (NIM deploy)
// US-03 — thêm "securities" (chứng khoán — structured output, SLA p95 ≤500ms)
const SEGMENTS = ["general", "coding", "banking", "securities", "insurance", "retail", "manufacturing", "telecom"];
const ENGINES = ["vllm", "nim", "tensorrt-llm", "triton"];
const DATA_RESIDENCIES = ["VN", "SG", "US"];
// US-02 — guardrails template (NeMo) — rules mặc định theo template
const GUARDRAIL_TEMPLATES = {
  banking: {
    rules: [
      { id: "pii_cccd", pattern: "\\b\\d{9}\\b|\\b\\d{12}\\b", severity: "high", reason: "PII: CCCD/CMND" },
      { id: "pii_phone", pattern: "\\b(?:\\+?84|0)[3-9]\\d{8}\\b", severity: "high", reason: "PII: số điện thoại" },
      { id: "prompt_injection", pattern: "ignore\\s+(previous|prior|above)|system\\s+prompt|disregard\\s+(all\\s+)?(previous|prior)", severity: "critical", reason: "Prompt injection" },
      { id: "financial_advice", pattern: "guarantee|risk.?free|chắc chắn sinh lời|lãi suất đảm bảo|bảo đảm lợi nhuận", severity: "medium", reason: "Tư vấn tài chính không phù hợp" },
    ],
  },
  insurance: {
    rules: [
      { id: "pii_cccd", pattern: "\\b\\d{9}\\b|\\b\\d{12}\\b", severity: "high", reason: "PII: CCCD/CMND" },
      { id: "pii_phone", pattern: "\\b(?:\\+?84|0)[3-9]\\d{8}\\b", severity: "high", reason: "PII: số điện thoại" },
      { id: "medical", pattern: "\\b(?:diagnosis|prescription|bệnh án|chẩn đoán)\\b", severity: "high", reason: "Thông tin y tế nhạy cảm" },
      { id: "prompt_injection", pattern: "ignore\\s+(previous|prior|above)|system\\s+prompt|disregard\\s+(all\\s+)?(previous|prior)", severity: "critical", reason: "Prompt injection" },
    ],
  },
  general: {
    rules: [
      { id: "pii_cccd", pattern: "\\b\\d{9}\\b|\\b\\d{12}\\b", severity: "high", reason: "PII: CCCD/CMND" },
      { id: "prompt_injection", pattern: "ignore\\s+(previous|prior|above)|system\\s+prompt|disregard\\s+(all\\s+)?(previous|prior)", severity: "critical", reason: "Prompt injection" },
    ],
  },
};

// resolveRules(template, customRules) — rules hiệu lực = template + custom (override theo id)
function resolveRules(template, customRules) {
  const base = (GUARDRAIL_TEMPLATES[template] && GUARDRAIL_TEMPLATES[template].rules) || [];
  const map = new Map(base.map((r) => [r.id, r]));
  if (Array.isArray(customRules)) {
    for (const r of customRules) {
      if (r && r.id) map.set(r.id, { ...map.get(r.id), ...r });
    }
  }
  return Array.from(map.values());
}
// P0 — SLO-driven autoscaling: scaling metric + target (Gap #3)
const SCALING_METRICS = ["inflight", "gpu_util", "e2e_latency"];
const SCALING_DEFAULT_TARGET = { inflight: 2000, gpu_util: 70, e2e_latency: 750 };
// P1 — GPU count (tensor parallel) + quantization (immutable — đổi phải redeploy)
const GPU_COUNTS = [1, 2, 4, 8];
const QUANTIZATIONS = ["bf16", "fp8", "awq"];
// P2 — host KV cache (immutable — đổi phải redeploy) + sampling defaults (hot-update)
const SAMPLING_DEFAULTS = { temperature: 1.0, top_p: 1.0, max_tokens: 1024 };

const GPU_BASE_RATE = { A30: 0.9, H100: 2.5, H200: 3.3, B300: 5.5 };
const COMMIT_MULT = { "on-demand": 1, "7-30": 0.91, "91-180": 0.73 };
const COMMIT_LABEL = { "on-demand": "On-demand", "7-30": "7–30d", "91-180": "91–180d" };
// Sprint 3 (O3 song song) — carryover + GPU swap
// COMMIT_HOURS: giờ tối đa của mỗi commit term (cho phép tính quota còn lại khi stop)
// CARRYOVER_CAP: chỉ được carryover tối đa 20% quota còn lại (giảm lạm dụng)
const COMMIT_HOURS = { "on-demand": 0, "7-30": 30 * 24, "91-180": 180 * 24 };
const CARRYOVER_CAP = 0.20;

// US-09 — mô hình benchmark throughput A/B (engine mặc định vllm vs engine tối ưu)
// Baseline tokens/sec theo GPU (1 replica, engine mặc định vllm); engine khác nhân hệ số.
// TensorRT-LLM: build engine tối ưu + cache → throughput +35% (đạt NFR-PERF-002 ≥20%).
const BASELINE_TPS = { A30: 4000, H100: 10000, H200: 12000, B300: 15000 };
const ENGINE_TPS_MULT = { vllm: 1.0, nim: 1.1, triton: 1.15, "tensorrt-llm": 1.35 };
function engineBenchmark(gpu, engine, replicas = 1) {
  const base = (BASELINE_TPS[gpu] || 10000) * Math.max(1, parseInt(replicas, 10) || 1);
  const mult = ENGINE_TPS_MULT[engine] || 1.0;
  const baselineTps = Math.round(base * ENGINE_TPS_MULT.vllm);
  const tps = Math.round(base * mult);
  const improvementPct = baselineTps > 0 ? Math.round(((tps - baselineTps) / baselineTps) * 1000) / 10 : 0;
  return { baseline_tps: baselineTps, tps, improvement_pct: improvementPct };
}

const LIFECYCLE = ["queued", "deploying", "running", "degraded", "paused", "stopped", "failed"];

function rate(gpu, commit) {
  return GPU_BASE_RATE[gpu] * COMMIT_MULT[commit];
}

// US-06 — resolve price pack theo (segment, gpu, region).
// Lazy-require pricing store để tránh circular dependency (pricing store require endpoints store
// ở top-level để lấy enums). Trả về pack hoặc null; lỗi DB (file mode không có DB) → null.
let _pricingStore = null;
function pricingStore() {
  if (!_pricingStore) _pricingStore = require("../pricing/store");
  return _pricingStore;
}
async function resolvePricePack(segment, gpu, region) {
  try {
    return await pricingStore().getBySegmentGpuRegion(segment, gpu, region);
  } catch (e) {
    console.warn("[endpoints] resolve price pack lỗi (dùng rate mặc định):", e.message);
    return null;
  }
}

// Tính giờ quota còn lại cho endpoint đang stop (dựa trên commit term + startedAt)
function _remainingHours(ep) {
  const cap = COMMIT_HOURS[ep.commit] || 0;
  if (!cap || !ep.startedAt) return 0;
  const elapsed = (Date.now() - Date.parse(ep.startedAt)) / 3600000;
  return Math.max(0, cap - elapsed);
}

// ─────────────── FILE BACKEND (mặc định) ───────────────
const DATA_DIR = process.env.ENDPOINTS_STORAGE_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "endpoints.json");

function fileEnsure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
}
function fileReadAll() { fileEnsure(); return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function fileWriteAll(items) {
  fileEnsure();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

const fileBackend = {
  list({ status, mode } = {}) {
    let items = fileReadAll();
    if (status) items = items.filter((e) => e.status === status);
    if (mode) items = items.filter((e) => e.mode === mode);
    return items;
  },
  getById(id) { return fileReadAll().find((e) => e.id === id) || null; },
  getByName(name) { return fileReadAll().find((e) => e.name === name) || null; },
  async create({ name, model, gpu, region, mode, commit, minReplicas, maxReplicas, image, port, allowGpuSwap, scalingMetric, scalingTarget, maxModelLen, gpuCount, quantization, hostKvCache, samplingDefaults, segment, engine, codePrivacy, guardrailsEnabled, guardrailsTemplate, dataResidency }) {
    if (!name || typeof name !== "string") throw new Error("name bắt buộc");
    const norm = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(norm)) throw new Error("name chỉ chứa chữ thường, số, gạch nối");
    if (fileBackend.getByName(norm)) throw new Error(`endpoint "${norm}" đã tồn tại`);
    if (!model) throw new Error("model bắt buộc");
    if (!GPU_TIERS.includes(gpu)) throw new Error(`gpu phải thuộc ${GPU_TIERS.join(", ")}`);
    if (!REGIONS.includes(region)) throw new Error(`region phải thuộc ${REGIONS.join(", ")}`);
    if (!MODES.includes(mode)) throw new Error(`mode phải thuộc ${MODES.join(", ")}`);
    if (!COMMITS.includes(commit)) throw new Error(`commit phải thuộc ${COMMITS.join(", ")}`);
    // US-01 — validate segment/engine + data residency
    const seg = segment || "general";
    if (!SEGMENTS.includes(seg)) throw new Error(`segment phải thuộc ${SEGMENTS.join(", ")}`);
    const eng = engine || "vllm";
    if (!ENGINES.includes(eng)) throw new Error(`engine phải thuộc ${ENGINES.join(", ")}`);
    const dr = dataResidency || "VN";
    if (!DATA_RESIDENCIES.includes(dr)) throw new Error(`dataResidency phải thuộc ${DATA_RESIDENCIES.join(", ")}`);
    if ((seg === "banking" || seg === "insurance") && dr !== "VN") {
      throw new Error("segment banking/insurance chỉ cho phép dataResidency=VN");
    }
    const gt = guardrailsEnabled && guardrailsTemplate ? guardrailsTemplate : null;
    if (gt && !GUARDRAIL_TEMPLATES[gt]) throw new Error(`guardrailsTemplate phải thuộc ${Object.keys(GUARDRAIL_TEMPLATES).join(", ")}`);
    if (scalingMetric && !SCALING_METRICS.includes(scalingMetric)) throw new Error(`scalingMetric phải thuộc ${SCALING_METRICS.join(", ")}`);
    if (gpuCount != null && !GPU_COUNTS.includes(parseInt(gpuCount, 10))) throw new Error(`gpuCount phải thuộc ${GPU_COUNTS.join(", ")}`);
    if (quantization && !QUANTIZATIONS.includes(quantization)) throw new Error(`quantization phải thuộc ${QUANTIZATIONS.join(", ")}`);
    const min = mode === "k8s" ? Math.max(1, parseInt(minReplicas, 10) || 1) : 1;
    const maxd = mode === "k8s" ? Math.max(min, parseInt(maxReplicas, 10) || 1) : 1;
    const sm = scalingMetric || "inflight";
    const st = scalingTarget != null ? parseInt(scalingTarget, 10) : SCALING_DEFAULT_TARGET[sm];
    const gc = gpuCount != null ? parseInt(gpuCount, 10) : 1;
    const qz = quantization || "bf16";
    // P2 — host KV cache (immutable) + sampling defaults (hot-update)
    const sd = samplingDefaults && typeof samplingDefaults === "object"
      ? {
          temperature: samplingDefaults.temperature != null ? parseFloat(samplingDefaults.temperature) : SAMPLING_DEFAULTS.temperature,
          top_p: samplingDefaults.top_p != null ? parseFloat(samplingDefaults.top_p) : SAMPLING_DEFAULTS.top_p,
          max_tokens: samplingDefaults.max_tokens != null ? parseInt(samplingDefaults.max_tokens, 10) : SAMPLING_DEFAULTS.max_tokens,
        }
      : { ...SAMPLING_DEFAULTS };
    // US-06 — resolve price pack theo (segment, gpu, region); có gói → rate = rate_per_hour của gói
    const pack = await resolvePricePack(seg, gpu, region);
    const rateStr = pack ? Number(pack.ratePerHour).toFixed(2) : rate(gpu, commit).toFixed(2);
    const id = "ep-" + crypto.randomBytes(4).toString("hex");
    const now = new Date().toISOString();
    const ep = {
      id, name: norm, model, gpu, region, mode, commit,
      replicas: `${min}/${maxd}`, desiredReplicas: min, maxReplicas: maxd,
      rate: rateStr, commitLabel: COMMIT_LABEL[commit],
      image: image || (mode === "container" ? `registry.fpt.vn/ddi/${norm}:v1` : null),
      port: port || (mode === "container" ? 8000 : null),
      // P0 — SLO-driven autoscaling (Gap #3)
      scalingMetric: sm, scalingTarget: st,
      // P0 — context length (max_model_len)
      maxModelLen: maxModelLen != null ? parseInt(maxModelLen, 10) : null,
      // P1 — GPU count (tensor parallel) + quantization (immutable)
      gpuCount: gc, quantization: qz,
      // P2 — host KV cache (immutable) + sampling defaults (hot-update)
      hostKvCache: !!hostKvCache, samplingDefaults: sd,
      // Sprint 3 (O3) — carryover + GPU swap (mặc định false)
      carryoverQuotaHours: 0,
      allowGpuSwap: !!allowGpuSwap,
      // US-01 — segment/engine/NIM + data residency
      segment: seg, engine: eng, dataResidency: dr,
      // US-06 — price pack đã resolve
      pricePackId: pack ? pack.id : null,
      pricePack: pack || null,
      // US-08 — code privacy
      codePrivacy: !!codePrivacy,
      // US-02 — guardrails
      guardrailsEnabled: !!guardrailsEnabled,
      guardrailsTemplate: gt,
      guardrailsRules: gt ? resolveRules(gt) : null,
      status: "queued", createdAt: now, updatedAt: now,
      events: [{ at: now, from: null, to: "queued", msg: "queued for deploy" }],
    };
    const items = fileReadAll();
    items.unshift(ep);
    fileWriteAll(items);
    return ep;
  },
  transition(id, to, msg) {
    if (!LIFECYCLE.includes(to)) throw new Error(`status không hợp lệ: ${to}`);
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    const now = new Date().toISOString();
    ep.events.push({ at: now, from: ep.status, to, msg });
    ep.status = to;
    ep.updatedAt = now;
    if (to === "running") ep.startedAt = now;
    if (to === "stopped") ep.stoppedAt = now;
    if (to === "failed") ep.failedAt = now;
    fileWriteAll(items);
    return ep;
  },
  scale(id, replicas) {
    const n = Math.max(1, parseInt(replicas, 10) || 1);
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    if (ep.status !== "running") throw new Error(`chỉ scale được endpoint running (hiện ${ep.status})`);
    if (n > ep.maxReplicas) throw new Error(`replicas=${n} vượt max=${ep.maxReplicas}`);
    ep.desiredReplicas = n;
    ep.replicas = `${n}/${ep.maxReplicas}`;
    ep.updatedAt = new Date().toISOString();
    ep.events.push({ at: ep.updatedAt, from: ep.status, to: ep.status, msg: `scaled to ${n} replicas` });
    fileWriteAll(items);
    return ep;
  },
  start(id) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    if (items[idx].status === "stopped" || items[idx].status === "paused") {
      return fileBackend.transition(id, "running", "manual start");
    }
    throw new Error(`không thể start endpoint ở trạng thái ${items[idx].status}`);
  },
  stop(id) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    if (items[idx].status === "running" || items[idx].status === "degraded") {
      // Sprint 3 (O3) — tính giờ quota còn lại, lưu carryoverQuotaHours (cap 20%)
      const remaining = _remainingHours(items[idx]);
      const carryover = Math.round(remaining * CARRYOVER_CAP * 100) / 100;
      items[idx].carryoverQuotaHours = carryover;
      const msg = carryover > 0
        ? `manual stop · credited ${carryover}h carryover (quota còn ${Math.round(remaining)}h × ${Math.round(CARRYOVER_CAP * 100)}%)`
        : "manual stop · no carryover (on-demand hoặc hết quota)";
      return fileBackend.transition(id, "stopped", msg);
    }
    throw new Error(`không thể stop endpoint ở trạng thái ${items[idx].status}`);
  },
  remove(id) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    fileWriteAll(items);
    return true;
  },
  // P0 — cấu hình sau deploy: đổi scaling metric/target + context length (hot-update, không downtime)
  // P2 — thêm sampling defaults (temperature/top_p/max_tokens) — hot-update
  config(id, { scalingMetric, scalingTarget, maxModelLen, samplingDefaults }) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    const now = new Date().toISOString();
    const changes = [];
    if (scalingMetric !== undefined) {
      if (!SCALING_METRICS.includes(scalingMetric)) throw new Error(`scalingMetric phải thuộc ${SCALING_METRICS.join(", ")}`);
      if (ep.scalingMetric !== scalingMetric) { ep.scalingMetric = scalingMetric; changes.push(`scalingMetric→${scalingMetric}`); }
    }
    if (scalingTarget !== undefined) {
      const t = parseInt(scalingTarget, 10);
      if (!(t > 0)) throw new Error("scalingTarget phải là số dương");
      if (ep.scalingTarget !== t) { ep.scalingTarget = t; changes.push(`scalingTarget→${t}`); }
    }
    if (maxModelLen !== undefined) {
      const m = maxModelLen === null || maxModelLen === "" ? null : parseInt(maxModelLen, 10);
      if (m !== null && !(m > 0)) throw new Error("maxModelLen phải là số dương hoặc null");
      if (ep.maxModelLen !== m) { ep.maxModelLen = m; changes.push(`maxModelLen→${m ?? "default"}`); }
    }
    if (samplingDefaults !== undefined && samplingDefaults !== null) {
      const sd = ep.samplingDefaults || { ...SAMPLING_DEFAULTS };
      if (typeof samplingDefaults !== "object") throw new Error("samplingDefaults phải là object");
      const parts = [];
      if (samplingDefaults.temperature !== undefined) {
        const v = parseFloat(samplingDefaults.temperature);
        if (!(v >= 0 && v <= 2)) throw new Error("temperature phải trong [0,2]");
        if (sd.temperature !== v) { sd.temperature = v; parts.push(`temperature→${v}`); }
      }
      if (samplingDefaults.top_p !== undefined) {
        const v = parseFloat(samplingDefaults.top_p);
        if (!(v > 0 && v <= 1)) throw new Error("top_p phải trong (0,1]");
        if (sd.top_p !== v) { sd.top_p = v; parts.push(`top_p→${v}`); }
      }
      if (samplingDefaults.max_tokens !== undefined) {
        const v = parseInt(samplingDefaults.max_tokens, 10);
        if (!(v > 0)) throw new Error("max_tokens phải là số dương");
        if (sd.max_tokens !== v) { sd.max_tokens = v; parts.push(`max_tokens→${v}`); }
      }
      if (parts.length) { ep.samplingDefaults = sd; changes.push(`samplingDefaults(${parts.join(",")})`); }
    }
    if (!changes.length) throw new Error("không có thay đổi cấu hình hợp lệ");
    ep.updatedAt = now;
    ep.events.push({ at: now, from: ep.status, to: ep.status, msg: `config: ${changes.join(", ")}` });
    fileWriteAll(items);
    return ep;
  },
  // P1 — đổi GPU count (tensor parallel) / quantization — immutable, bắt redeploy
  // P2 — thêm host KV cache (immutable)
  redeployConfig(id, { gpuCount, quantization, hostKvCache }) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    const now = new Date().toISOString();
    const changes = [];
    if (gpuCount !== undefined) {
      const g = parseInt(gpuCount, 10);
      if (!GPU_COUNTS.includes(g)) throw new Error(`gpuCount phải thuộc ${GPU_COUNTS.join(", ")}`);
      if (ep.gpuCount !== g) { ep.gpuCount = g; changes.push(`gpuCount→${g}`); }
    }
    if (quantization !== undefined) {
      if (!QUANTIZATIONS.includes(quantization)) throw new Error(`quantization phải thuộc ${QUANTIZATIONS.join(", ")}`);
      if (ep.quantization !== quantization) { ep.quantization = quantization; changes.push(`quantization→${quantization}`); }
    }
    if (hostKvCache !== undefined) {
      const h = !!hostKvCache;
      if (ep.hostKvCache !== h) { ep.hostKvCache = h; changes.push(`hostKvCache→${h}`); }
    }
    if (!changes.length) throw new Error("không có thay đổi cấu hình hợp lệ");
    ep.updatedAt = now;
    // immutable → phải redeploy: đưa về deploying rồi worker sẽ đẩy lên running
    ep.status = "deploying";
    ep.events.push({ at: now, from: ep.status, to: "deploying", msg: `redeploy: ${changes.join(", ")}` });
    fileWriteAll(items);
    return ep;
  },
  // Sprint 3 (T3.3) — swap GPU giữa kỳ, chỉ endpoint running + allowGpuSwap=true
  swapGpu(id, newGpu) {
    if (!GPU_TIERS.includes(newGpu)) throw new Error(`gpu phải thuộc ${GPU_TIERS.join(", ")}`);
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    if (!ep.allowGpuSwap) throw new Error("endpoint không bật allowGpuSwap — không thể đổi GPU");
    if (ep.status !== "running") throw new Error(`chỉ swap GPU được endpoint running (hiện ${ep.status})`);
    if (ep.gpu === newGpu) throw new Error(`endpoint đã ở GPU ${newGpu} — không cần swap`);
    const oldGpu = ep.gpu;
    const oldRate = ep.rate;
    const newRate = rate(newGpu, ep.commit).toFixed(2);
    const now = new Date().toISOString();
    ep.gpu = newGpu;
    ep.rate = newRate;
    ep.updatedAt = now;
    ep.events.push({ at: now, from: ep.status, to: ep.status, msg: `GPU swap ${oldGpu}→${newGpu} · $${oldRate}/hr→$${newRate}/hr` });
    fileWriteAll(items);
    return ep;
  },
  metrics(id) {
    const ep = fileBackend.getById(id);
    if (!ep) return null;
    return {
      id, name: ep.name, status: ep.status, replicas: ep.replicas,
      gpuUtil: ep.status === "running" ? 40 + Math.floor(Math.random() * 40) : 0,
      p95: ep.status === "running" ? 100 + Math.floor(Math.random() * 200) : 0,
      tpm: ep.status === "running" ? (ep.desiredReplicas || 1) * (20000 + Math.floor(Math.random() * 80000)) : 0,
      inflight: ep.status === "running" ? Math.floor(Math.random() * 500) : 0,
    };
  },
  // US-08 — cập nhật code privacy
  updateCodePrivacy(id, codePrivacy) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    items[idx].codePrivacy = !!codePrivacy;
    items[idx].updatedAt = new Date().toISOString();
    fileWriteAll(items);
    return items[idx];
  },
  // US-02 — cấu hình guardrails
  updateGuardrails(id, { enabled, template, rules } = {}) {
    const items = fileReadAll();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const ep = items[idx];
    const en = enabled !== undefined ? !!enabled : ep.guardrailsEnabled;
    let tmpl = template !== undefined ? template : ep.guardrailsTemplate;
    if (tmpl && !GUARDRAIL_TEMPLATES[tmpl]) throw new Error(`guardrailsTemplate phải thuộc ${Object.keys(GUARDRAIL_TEMPLATES).join(", ")}`);
    if (!en) tmpl = null;
    ep.guardrailsEnabled = en;
    ep.guardrailsTemplate = tmpl;
    ep.guardrailsRules = en && tmpl ? resolveRules(tmpl, rules) : null;
    ep.updatedAt = new Date().toISOString();
    fileWriteAll(items);
    return ep;
  },
};

// ─────────────── POSTGRES BACKEND (Gap 1) ───────────────
const pgBackend = (() => {
  let _db = null;
  function db() { if (!_db) _db = require("../db/pool"); return _db; }
  function rowToEp(r) {
    return {
      id: r.id, name: r.name, model: r.model, gpu: r.gpu, region: r.region, mode: r.mode,
      commit: r.commit, replicas: r.replicas, desiredReplicas: r.desired_replicas,
      maxReplicas: r.max_replicas, rate: String(r.rate), commitLabel: r.commit_label,
      image: r.image, port: r.port, status: r.status,
      // P0 — SLO-driven autoscaling + context length
      scalingMetric: r.scaling_metric || "inflight",
      scalingTarget: r.scaling_target != null ? Number(r.scaling_target) : SCALING_DEFAULT_TARGET[r.scaling_metric || "inflight"],
      maxModelLen: r.max_model_len != null ? Number(r.max_model_len) : null,
      // P1 — GPU count (tensor parallel) + quantization
      gpuCount: r.gpu_count != null ? Number(r.gpu_count) : 1,
      quantization: r.quantization || "bf16",
      // P2 — host KV cache (immutable) + sampling defaults (hot-update)
      hostKvCache: !!r.host_kv_cache,
      samplingDefaults: r.sampling_defaults && typeof r.sampling_defaults === "object"
        ? { temperature: r.sampling_defaults.temperature ?? SAMPLING_DEFAULTS.temperature, top_p: r.sampling_defaults.top_p ?? SAMPLING_DEFAULTS.top_p, max_tokens: r.sampling_defaults.max_tokens ?? SAMPLING_DEFAULTS.max_tokens }
        : { ...SAMPLING_DEFAULTS },
      // Sprint 3 (O3) — carryover + GPU swap
      carryoverQuotaHours: r.carryover_quota_hours != null ? Number(r.carryover_quota_hours) : 0,
      allowGpuSwap: !!r.allow_gpu_swap,
      // US-01 — segment/engine/NIM + data residency
      segment: r.segment || "general",
      engine: r.engine || "vllm",
      dataResidency: r.data_residency || "VN",
      // US-06 — price pack
      pricePackId: r.price_pack_id || null,
      // US-08 — code privacy
      codePrivacy: !!r.code_privacy,
      // US-02 — guardrails
      guardrailsEnabled: !!r.guardrails_enabled,
      guardrailsTemplate: r.guardrails_template || null,
      guardrailsRules: r.guardrails_rules || null,
      createdAt: r.created_at, updatedAt: r.updated_at,
      startedAt: r.started_at, stoppedAt: r.stopped_at, failedAt: r.failed_at,
      events: r.__events || [],
    };
  }
  async function loadEvents(id) {
    const { rows } = await db().query(
      `SELECT at, from_state AS "from", to_state AS "to", msg FROM endpoint_events WHERE endpoint_id=$1 ORDER BY id`, [id]
    );
    return rows.map((r) => ({ at: r.at, from: r.from, to: r.to, msg: r.msg || "" }));
  }
  return {
    async list({ status, mode } = {}) {
      let sql = `SELECT * FROM endpoint_entities`;
      const cond = [], args = [];
      if (status) { cond.push(`status=$${cond.length + 1}`); args.push(status); }
      if (mode) { cond.push(`mode=$${cond.length + 1}`); args.push(mode); }
      if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
      sql += ` ORDER BY created_at DESC`;
      const { rows } = await db().query(sql, args);
      const out = [];
      for (const r of rows) {
        const ep = rowToEp(r);
        ep.events = await loadEvents(r.id);
        out.push(ep);
      }
      return out;
    },
    async getById(id) {
      const { rows } = await db().query(`SELECT * FROM endpoint_entities WHERE id=$1`, [id]);
      if (!rows[0]) return null;
      const ep = rowToEp(rows[0]);
      ep.events = await loadEvents(id);
      return ep;
    },
    async getByName(name) {
      const { rows } = await db().query(`SELECT * FROM endpoint_entities WHERE name=$1`, [name]);
      if (!rows[0]) return null;
      const ep = rowToEp(rows[0]);
      ep.events = await loadEvents(rows[0].id);
      return ep;
    },
    async create({ name, model, gpu, region, mode, commit, minReplicas, maxReplicas, image, port, allowGpuSwap, scalingMetric, scalingTarget, maxModelLen, gpuCount, quantization, hostKvCache, samplingDefaults, segment, engine, codePrivacy, guardrailsEnabled, guardrailsTemplate, dataResidency }) {
      if (!name || typeof name !== "string") throw new Error("name bắt buộc");
      const norm = name.trim().toLowerCase().replace(/\s+/g, "-");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(norm)) throw new Error("name chỉ chứa chữ thường, số, gạch nối");
      if (await pgBackend.getByName(norm)) throw new Error(`endpoint "${norm}" đã tồn tại`);
      if (!model) throw new Error("model bắt buộc");
      if (!GPU_TIERS.includes(gpu)) throw new Error(`gpu phải thuộc ${GPU_TIERS.join(", ")}`);
      if (!REGIONS.includes(region)) throw new Error(`region phải thuộc ${REGIONS.join(", ")}`);
      if (!MODES.includes(mode)) throw new Error(`mode phải thuộc ${MODES.join(", ")}`);
      if (!COMMITS.includes(commit)) throw new Error(`commit phải thuộc ${COMMITS.join(", ")}`);
      // US-01 — validate segment/engine + data residency
      const seg = segment || "general";
      if (!SEGMENTS.includes(seg)) throw new Error(`segment phải thuộc ${SEGMENTS.join(", ")}`);
      const eng = engine || "vllm";
      if (!ENGINES.includes(eng)) throw new Error(`engine phải thuộc ${ENGINES.join(", ")}`);
      const dr = dataResidency || "VN";
      if (!DATA_RESIDENCIES.includes(dr)) throw new Error(`dataResidency phải thuộc ${DATA_RESIDENCIES.join(", ")}`);
      if ((seg === "banking" || seg === "insurance") && dr !== "VN") {
        throw new Error("segment banking/insurance chỉ cho phép dataResidency=VN");
      }
      const gt = guardrailsEnabled && guardrailsTemplate ? guardrailsTemplate : null;
      if (gt && !GUARDRAIL_TEMPLATES[gt]) throw new Error(`guardrailsTemplate phải thuộc ${Object.keys(GUARDRAIL_TEMPLATES).join(", ")}`);
      if (scalingMetric && !SCALING_METRICS.includes(scalingMetric)) throw new Error(`scalingMetric phải thuộc ${SCALING_METRICS.join(", ")}`);
      if (gpuCount != null && !GPU_COUNTS.includes(parseInt(gpuCount, 10))) throw new Error(`gpuCount phải thuộc ${GPU_COUNTS.join(", ")}`);
      if (quantization && !QUANTIZATIONS.includes(quantization)) throw new Error(`quantization phải thuộc ${QUANTIZATIONS.join(", ")}`);
      const min = mode === "k8s" ? Math.max(1, parseInt(minReplicas, 10) || 1) : 1;
      const maxd = mode === "k8s" ? Math.max(min, parseInt(maxReplicas, 10) || 1) : 1;
      const sm = scalingMetric || "inflight";
      const st = scalingTarget != null ? parseInt(scalingTarget, 10) : SCALING_DEFAULT_TARGET[sm];
      const ml = maxModelLen != null && maxModelLen !== "" ? parseInt(maxModelLen, 10) : null;
      const gc = gpuCount != null ? parseInt(gpuCount, 10) : 1;
      const qz = quantization || "bf16";
      // P2 — host KV cache (immutable) + sampling defaults (hot-update)
      const hkv = !!hostKvCache;
      const sd = samplingDefaults && typeof samplingDefaults === "object"
        ? { temperature: samplingDefaults.temperature != null ? parseFloat(samplingDefaults.temperature) : SAMPLING_DEFAULTS.temperature, top_p: samplingDefaults.top_p != null ? parseFloat(samplingDefaults.top_p) : SAMPLING_DEFAULTS.top_p, max_tokens: samplingDefaults.max_tokens != null ? parseInt(samplingDefaults.max_tokens, 10) : SAMPLING_DEFAULTS.max_tokens }
        : { ...SAMPLING_DEFAULTS };
      const id = "ep-" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();
      // US-06 — resolve price pack theo (segment, gpu, region); có gói → rate = rate_per_hour của gói
      const pack = await resolvePricePack(seg, gpu, region);
      const rateStr = pack ? Number(pack.ratePerHour).toFixed(2) : rate(gpu, commit).toFixed(2);
      const img = image || (mode === "container" ? `registry.fpt.vn/ddi/${norm}:v1` : null);
      const pt = port || (mode === "container" ? 8000 : null);
      try {
        await db().query(
`INSERT INTO endpoint_entities (id,name,model,gpu,region,mode,commit,replicas,desired_replicas,max_replicas,rate,commit_label,image,port,carryover_quota_hours,allow_gpu_swap,scaling_metric,scaling_target,max_model_len,gpu_count,quantization,host_kv_cache,sampling_defaults,status,created_at,updated_at,segment,engine,code_privacy,guardrails_enabled,guardrails_template,data_residency,guardrails_rules,price_pack_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$16,$17,$18,$19,$20,$21,$22,$23,'queued',$15,$15,$24,$25,$26,$27,$28,$29,$30,$31)`,
          [id, norm, model, gpu, region, mode, commit, `${min}/${maxd}`, min, maxd, rateStr, COMMIT_LABEL[commit], img, pt, now, !!allowGpuSwap, sm, st, ml, gc, qz, hkv, JSON.stringify(sd), seg, eng, !!codePrivacy, !!guardrailsEnabled, gt, dr, gt ? JSON.stringify(resolveRules(gt)) : null, pack ? pack.id : null]
        );
        await db().query(
          `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,NULL,'queued','queued for deploy')`,
          [id, now]
        );
      } catch (e) {
        if (e.code === "23505") throw new Error(`endpoint "${norm}" đã tồn tại`);
        throw e;
      }
      return {
        id, name: norm, model, gpu, region, mode, commit, replicas: `${min}/${maxd}`,
        desiredReplicas: min, maxReplicas: maxd, rate: rateStr, commitLabel: COMMIT_LABEL[commit],
        image: img, port: pt, status: "queued", createdAt: now, updatedAt: now,
        scalingMetric: sm, scalingTarget: st, maxModelLen: ml,
        gpuCount: gc, quantization: qz,
        hostKvCache: hkv, samplingDefaults: sd,
        carryoverQuotaHours: 0, allowGpuSwap: !!allowGpuSwap,
        segment: seg, engine: eng, dataResidency: dr,
        // US-06 — price pack đã resolve
        pricePackId: pack ? pack.id : null,
        pricePack: pack || null,
        codePrivacy: !!codePrivacy,
        guardrailsEnabled: !!guardrailsEnabled, guardrailsTemplate: gt,
        guardrailsRules: gt ? resolveRules(gt) : null,
        events: [{ at: now, from: null, to: "queued", msg: "queued for deploy" }],
      };
    },
    async transition(id, to, msg) {
      if (!LIFECYCLE.includes(to)) throw new Error(`status không hợp lệ: ${to}`);
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      const now = new Date().toISOString();
      const sets = [`status=$2`, `updated_at=$3`];
      const args = [id, to, now];
      if (to === "running") { sets.push(`started_at=$${args.length + 1}`); args.push(now); }
      if (to === "stopped") { sets.push(`stopped_at=$${args.length + 1}`); args.push(now); }
      if (to === "failed") { sets.push(`failed_at=$${args.length + 1}`); args.push(now); }
      await db().query(`UPDATE endpoint_entities SET ${sets.join(", ")} WHERE id=$1`, args);
      await db().query(
        `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,$4,$5)`,
        [id, now, cur.status, to, msg || ""]
      );
      return {
        ...cur, status: to, updatedAt: now,
        startedAt: to === "running" ? now : cur.startedAt,
        stoppedAt: to === "stopped" ? now : cur.stoppedAt,
        failedAt: to === "failed" ? now : cur.failedAt,
        events: [...cur.events, { at: now, from: cur.status, to, msg: msg || "" }],
      };
    },
    async scale(id, replicas) {
      const n = Math.max(1, parseInt(replicas, 10) || 1);
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status !== "running") throw new Error(`chỉ scale được endpoint running (hiện ${cur.status})`);
      if (n > cur.maxReplicas) throw new Error(`replicas=${n} vượt max=${cur.maxReplicas}`);
      const now = new Date().toISOString();
      await db().query(
        `UPDATE endpoint_entities SET desired_replicas=$2, replicas=$3, updated_at=$4 WHERE id=$1`,
        [id, n, `${n}/${cur.maxReplicas}`, now]
      );
      await db().query(
        `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,$4,$5)`,
        [id, now, cur.status, cur.status, `scaled to ${n} replicas`]
      );
      return {
        ...cur, desiredReplicas: n, replicas: `${n}/${cur.maxReplicas}`, updatedAt: now,
        events: [...cur.events, { at: now, from: cur.status, to: cur.status, msg: `scaled to ${n} replicas` }],
      };
    },
    async start(id) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status === "stopped" || cur.status === "paused") {
        return pgBackend.transition(id, "running", "manual start");
      }
      throw new Error(`không thể start endpoint ở trạng thái ${cur.status}`);
    },
    async stop(id) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status === "running" || cur.status === "degraded") {
        // Sprint 3 (O3) — tính giờ quota còn lại, lưu carryoverQuotaHours (cap 20%)
        const remaining = _remainingHours(cur);
        const carryover = Math.round(remaining * CARRYOVER_CAP * 100) / 100;
        const msg = carryover > 0
          ? `manual stop · credited ${carryover}h carryover (quota còn ${Math.round(remaining)}h × ${Math.round(CARRYOVER_CAP * 100)}%)`
          : "manual stop · no carryover (on-demand hoặc hết quota)";
        const now = new Date().toISOString();
        await db().query(
          `UPDATE endpoint_entities SET status='stopped', stopped_at=$2, carryover_quota_hours=$3, updated_at=$4 WHERE id=$1`,
          [id, now, carryover, now]
        );
        if (carryover > 0) {
          await db().query(
            `INSERT INTO endpoint_carryover_events (endpoint_id, type, hours, msg) VALUES ($1,'carryover_credited',$2,$3)`,
            [id, carryover, msg]
          );
        }
        await db().query(
          `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,'stopped',$4)`,
          [id, now, cur.status, msg]
        );
        return { ...cur, status: "stopped", stoppedAt: now, carryoverQuotaHours: carryover, updatedAt: now,
          events: [...cur.events, { at: now, from: cur.status, to: "stopped", msg }] };
      }
      throw new Error(`không thể stop endpoint ở trạng thái ${cur.status}`);
    },
    async remove(id) {
      const { rowCount } = await db().query(`DELETE FROM endpoint_entities WHERE id=$1`, [id]);
      return rowCount > 0;
    },
    // P0 — cấu hình sau deploy (hot-update): đổi scaling metric/target + context length
    // P2 — thêm sampling defaults (temperature/top_p/max_tokens) — hot-update
    async config(id, { scalingMetric, scalingTarget, maxModelLen, samplingDefaults }) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      const now = new Date().toISOString();
      const sets = [`updated_at=$2`];
      const args = [id, now];
      const changes = [];
      if (scalingMetric !== undefined) {
        if (!SCALING_METRICS.includes(scalingMetric)) throw new Error(`scalingMetric phải thuộc ${SCALING_METRICS.join(", ")}`);
        if (cur.scalingMetric !== scalingMetric) { sets.push(`scaling_metric=$${args.length + 1}`); args.push(scalingMetric); changes.push(`scalingMetric→${scalingMetric}`); }
      }
      if (scalingTarget !== undefined) {
        const t = parseInt(scalingTarget, 10);
        if (!(t > 0)) throw new Error("scalingTarget phải là số dương");
        if (cur.scalingTarget !== t) { sets.push(`scaling_target=$${args.length + 1}`); args.push(t); changes.push(`scalingTarget→${t}`); }
      }
      if (maxModelLen !== undefined) {
        const m = maxModelLen === null || maxModelLen === "" ? null : parseInt(maxModelLen, 10);
        if (m !== null && !(m > 0)) throw new Error("maxModelLen phải là số dương hoặc null");
        if (cur.maxModelLen !== m) { sets.push(`max_model_len=$${args.length + 1}`); args.push(m); changes.push(`maxModelLen→${m ?? "default"}`); }
      }
      if (samplingDefaults !== undefined && samplingDefaults !== null) {
        if (typeof samplingDefaults !== "object") throw new Error("samplingDefaults phải là object");
        const sd = cur.samplingDefaults || { ...SAMPLING_DEFAULTS };
        const parts = [];
        if (samplingDefaults.temperature !== undefined) {
          const v = parseFloat(samplingDefaults.temperature);
          if (!(v >= 0 && v <= 2)) throw new Error("temperature phải trong [0,2]");
          if (sd.temperature !== v) { sd.temperature = v; parts.push(`temperature→${v}`); }
        }
        if (samplingDefaults.top_p !== undefined) {
          const v = parseFloat(samplingDefaults.top_p);
          if (!(v > 0 && v <= 1)) throw new Error("top_p phải trong (0,1]");
          if (sd.top_p !== v) { sd.top_p = v; parts.push(`top_p→${v}`); }
        }
        if (samplingDefaults.max_tokens !== undefined) {
          const v = parseInt(samplingDefaults.max_tokens, 10);
          if (!(v > 0)) throw new Error("max_tokens phải là số dương");
          if (sd.max_tokens !== v) { sd.max_tokens = v; parts.push(`max_tokens→${v}`); }
        }
        if (parts.length) { sets.push(`sampling_defaults=$${args.length + 1}`); args.push(JSON.stringify(sd)); changes.push(`samplingDefaults(${parts.join(",")})`); }
      }
      if (!changes.length) throw new Error("không có thay đổi cấu hình hợp lệ");
      await db().query(`UPDATE endpoint_entities SET ${sets.join(", ")} WHERE id=$1`, args);
      const msg = `config: ${changes.join(", ")}`;
      await db().query(
        `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,$4,$5)`,
        [id, now, cur.status, cur.status, msg]
      );
      const patched = { ...cur, updatedAt: now,
        events: [...cur.events, { at: now, from: cur.status, to: cur.status, msg }] };
      if (scalingMetric !== undefined) patched.scalingMetric = scalingMetric;
      if (scalingTarget !== undefined) patched.scalingTarget = parseInt(scalingTarget, 10);
      if (maxModelLen !== undefined) patched.maxModelLen = maxModelLen === null || maxModelLen === "" ? null : parseInt(maxModelLen, 10);
      if (samplingDefaults !== undefined && samplingDefaults !== null) {
        const sd = patched.samplingDefaults || { ...SAMPLING_DEFAULTS };
        if (samplingDefaults.temperature !== undefined) sd.temperature = parseFloat(samplingDefaults.temperature);
        if (samplingDefaults.top_p !== undefined) sd.top_p = parseFloat(samplingDefaults.top_p);
        if (samplingDefaults.max_tokens !== undefined) sd.max_tokens = parseInt(samplingDefaults.max_tokens, 10);
        patched.samplingDefaults = sd;
      }
      return patched;
    },
    // P1 — đổi GPU count (tensor parallel) / quantization — immutable, bắt redeploy
    // P2 — thêm host KV cache (immutable)
    async redeployConfig(id, { gpuCount, quantization, hostKvCache }) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      const now = new Date().toISOString();
      const sets = [`updated_at=$2`];
      const args = [id, now];
      const changes = [];
      if (gpuCount !== undefined) {
        const g = parseInt(gpuCount, 10);
        if (!GPU_COUNTS.includes(g)) throw new Error(`gpuCount phải thuộc ${GPU_COUNTS.join(", ")}`);
        if (cur.gpuCount !== g) { sets.push(`gpu_count=$${args.length + 1}`); args.push(g); changes.push(`gpuCount→${g}`); }
      }
      if (quantization !== undefined) {
        if (!QUANTIZATIONS.includes(quantization)) throw new Error(`quantization phải thuộc ${QUANTIZATIONS.join(", ")}`);
        if (cur.quantization !== quantization) { sets.push(`quantization=$${args.length + 1}`); args.push(quantization); changes.push(`quantization→${quantization}`); }
      }
      if (hostKvCache !== undefined) {
        const h = !!hostKvCache;
        if (cur.hostKvCache !== h) { sets.push(`host_kv_cache=$${args.length + 1}`); args.push(h); changes.push(`hostKvCache→${h}`); }
      }
      if (!changes.length) throw new Error("không có thay đổi cấu hình hợp lệ");
      const msg = `redeploy: ${changes.join(", ")}`;
      await db().query(`UPDATE endpoint_entities SET ${sets.join(", ")}, status='deploying' WHERE id=$1`, args);
      await db().query(
        `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,'deploying',$4)`,
        [id, now, cur.status, msg]
      );
      const patched = { ...cur, status: "deploying", updatedAt: now,
        events: [...cur.events, { at: now, from: cur.status, to: "deploying", msg }] };
      if (gpuCount !== undefined) patched.gpuCount = parseInt(gpuCount, 10);
      if (quantization !== undefined) patched.quantization = quantization;
      if (hostKvCache !== undefined) patched.hostKvCache = !!hostKvCache;
      return patched;
    },
    // Sprint 3 (T3.3) — swap GPU giữa kỳ, chỉ endpoint running + allowGpuSwap=true
    async swapGpu(id, newGpu) {
      if (!GPU_TIERS.includes(newGpu)) throw new Error(`gpu phải thuộc ${GPU_TIERS.join(", ")}`);
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (!cur.allowGpuSwap) throw new Error("endpoint không bật allowGpuSwap — không thể đổi GPU");
      if (cur.status !== "running") throw new Error(`chỉ swap GPU được endpoint running (hiện ${cur.status})`);
      if (cur.gpu === newGpu) throw new Error(`endpoint đã ở GPU ${newGpu} — không cần swap`);
      const oldGpu = cur.gpu;
      const oldRate = cur.rate;
      const newRate = rate(newGpu, cur.commit).toFixed(2);
      const now = new Date().toISOString();
      await db().query(
        `UPDATE endpoint_entities SET gpu=$2, rate=$3, updated_at=$4 WHERE id=$1`,
        [id, newGpu, newRate, now]
      );
      const msg = `GPU swap ${oldGpu}→${newGpu} · $${oldRate}/hr→$${newRate}/hr`;
      await db().query(
        `INSERT INTO endpoint_carryover_events (endpoint_id, type, from_gpu, to_gpu, old_rate, new_rate, msg) VALUES ($1,'gpu_swap',$2,$3,$4,$5,$6)`,
        [id, oldGpu, newGpu, oldRate, newRate, msg]
      );
      await db().query(
        `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg) VALUES ($1,$2,$3,$4,$5)`,
        [id, now, cur.status, cur.status, msg]
      );
      return { ...cur, gpu: newGpu, rate: newRate, updatedAt: now,
        events: [...cur.events, { at: now, from: cur.status, to: cur.status, msg }] };
    },
    async metrics(id) {
      const ep = await pgBackend.getById(id);
      if (!ep) return null;
      return {
        id, name: ep.name, status: ep.status, replicas: ep.replicas,
        gpuUtil: ep.status === "running" ? 40 + Math.floor(Math.random() * 40) : 0,
        p95: ep.status === "running" ? 100 + Math.floor(Math.random() * 200) : 0,
        tpm: ep.status === "running" ? (ep.desiredReplicas || 1) * (20000 + Math.floor(Math.random() * 80000)) : 0,
        inflight: ep.status === "running" ? Math.floor(Math.random() * 500) : 0,
      };
    },
    // US-08 — cập nhật code privacy
    async updateCodePrivacy(id, codePrivacy) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      const now = new Date().toISOString();
      await db().query(
        `UPDATE endpoint_entities SET code_privacy=$2, updated_at=$3 WHERE id=$1`,
        [id, !!codePrivacy, now]
      );
      return { ...cur, codePrivacy: !!codePrivacy, updatedAt: now };
    },
    // US-02 — cấu hình guardrails
    async updateGuardrails(id, { enabled, template, rules } = {}) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      const en = enabled !== undefined ? !!enabled : cur.guardrailsEnabled;
      let tmpl = template !== undefined ? template : cur.guardrailsTemplate;
      if (tmpl && !GUARDRAIL_TEMPLATES[tmpl]) throw new Error(`guardrailsTemplate phải thuộc ${Object.keys(GUARDRAIL_TEMPLATES).join(", ")}`);
      if (!en) tmpl = null;
      const rs = en && tmpl ? resolveRules(tmpl, rules) : null;
      const now = new Date().toISOString();
      await db().query(
        `UPDATE endpoint_entities SET guardrails_enabled=$2, guardrails_template=$3, guardrails_rules=$4, updated_at=$5 WHERE id=$1`,
        [id, en, tmpl, rs ? JSON.stringify(rs) : null, now]
      );
      return { ...cur, guardrailsEnabled: en, guardrailsTemplate: tmpl, guardrailsRules: rs, updatedAt: now };
    },
  };
})();

// ─────────────── DISPATCH ───────────────
function pick(name) {
  return BACKEND === "postgres" ? pgBackend[name] : fileBackend[name];
}

module.exports = {
  GPU_TIERS, REGIONS, MODES, COMMITS, LIFECYCLE,
  SCALING_METRICS, SCALING_DEFAULT_TARGET,
  GPU_COUNTS, QUANTIZATIONS,
  COMMIT_HOURS, CARRYOVER_CAP,
  SEGMENTS, ENGINES, DATA_RESIDENCIES,
  GUARDRAIL_TEMPLATES,
  // US-09 — benchmark throughput A/B
  BASELINE_TPS, ENGINE_TPS_MULT, engineBenchmark,
  backend: BACKEND,
  list: (...a) => pick("list")(...a),
  getById: (...a) => pick("getById")(...a),
  getByName: (...a) => pick("getByName")(...a),
  create: (...a) => pick("create")(...a),
  transition: (...a) => pick("transition")(...a),
  scale: (...a) => pick("scale")(...a),
  start: (...a) => pick("start")(...a),
  stop: (...a) => pick("stop")(...a),
  config: (...a) => pick("config")(...a),
  redeployConfig: (...a) => pick("redeployConfig")(...a),
  swapGpu: (...a) => pick("swapGpu")(...a),
  remove: (...a) => pick("remove")(...a),
  metrics: (...a) => pick("metrics")(...a),
  updateCodePrivacy: (...a) => pick("updateCodePrivacy")(...a),
  updateGuardrails: (...a) => pick("updateGuardrails")(...a),
  rate,
};
