"use strict";

const store = require("./store");

let isRunning = false;
let timer = null;

const STEPS = [
  { from: "queued", to: "deploying", after: 800, msg: "validate config → generate manifests" },
  { from: "deploying", to: "running", after: 2500, msg: "pods scheduled + weights warming → ready" },
];

// US-09 — TensorRT-LLM: build engine tối ưu + warm KV cache (deploying dài hơn, mô phỏng compile)
const STEPS_TENSORRT = [
  { from: "queued", to: "deploying", after: 800, msg: "validate config → build TensorRT engine" },
  { from: "deploying", to: "running", after: 4000, msg: "engine compiled + KV cache warmed → ready" },
];

function stepsForEngine(engine) {
  return engine === "tensorrt-llm" ? STEPS_TENSORRT : STEPS;
}

// P0 — SLO-driven autoscaling (Gap #3): đọc metric thật rồi scale min→max dần
const AUTOSCALE_COOLDOWN_MS = 8000;
const SCALE_STEP = 1;

function readMetric(ep, m) {
  const met = store.metrics(ep.id);
  if (!met) return null;
  if (m === "inflight") return met.inflight;
  if (m === "gpu_util") return met.gpuUtil;
  if (m === "e2e_latency") return met.p95;
  return null;
}

async function autoscale(ep) {
  if (ep.mode !== "k8s") return; // container mode không autoscale
  if (ep.status !== "running") return;
  const min = 1;
  const max = ep.maxReplicas || 1;
  if (max <= min) return; // fixed size
  const metric = readMetric(ep, ep.scalingMetric || "inflight");
  if (metric == null) return;
  const target = ep.scalingTarget || 2000;
  const cur = ep.desiredReplicas || min;
  const now = Date.now();
  const lastScale = ep._lastAutoscaleAt || 0;
  if (now - lastScale < AUTOSCALE_COOLDOWN_MS) return;

  let next = cur;
  if (metric > target) next = Math.min(max, cur + SCALE_STEP);       // vượt target → scale up
  else if (metric < target * 0.5 && cur > min) next = Math.max(min, cur - SCALE_STEP); // dưới 50% target → scale down

  if (next !== cur) {
    try {
      await store.scale(ep.id, next);
      ep._lastAutoscaleAt = now;
      console.log(`[endpoint-worker] autoscale ${ep.name}: ${ep.scalingMetric}=${metric} (target ${target}) → replicas ${cur}→${next}`);
    } catch (e) {
      console.error(`[endpoint-worker] autoscale ${ep.name} lỗi:`, e.message);
    }
  }
}

async function reconcile() {
  const all = await store.list();
  for (const ep of all) {
    // US-09 — engine tensorrt-llm có bước build engine + cache riêng
    const steps = stepsForEngine(ep.engine);
    const next = steps.find((s) => s.from === ep.status);
    if (!next) continue;
    const elapsed = Date.now() - new Date(ep.updatedAt).getTime();
    if (elapsed < next.after) continue;
    try {
      await store.transition(ep.id, next.to, next.msg);
    } catch (e) {
      console.error(`[endpoint-worker] transition lỗi:`, e.message);
      continue;
    }
    // P0 — autoscaling cho endpoint running
    await autoscale(ep).catch((e) => console.error(`[endpoint-worker] autoscale ${ep.name} lỗi:`, e.message));
  }
}

function start() {
  if (isRunning) return;
  isRunning = true;
  console.log("[endpoint-worker] starting — poll mỗi 2s");
  timer = setInterval(reconcile, 2000);
  reconcile().catch((e) => console.error("[endpoint-worker] reconcile lỗi:", e.message));
}

function stop() {
  isRunning = false;
  if (timer) { clearInterval(timer); timer = null; }
}

function status() { return isRunning; }

module.exports = { start, stop, status };
