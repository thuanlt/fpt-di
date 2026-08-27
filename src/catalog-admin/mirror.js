"use strict";

// Model Catalog Admin — mirror worker.
// Poll mc_mirror_jobs (queued → downloading → mirrored/failed), pull weights từ HF về mirror root.
// Tái dụng pattern download từ src/byom/processor.js (fetch stream + progress).
// Checksum SHA-256 trên manifest (tên file + size) — không hash toàn bộ weights (model hàng GB).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");
const store = require("./store");

const SKIP_PATTERNS = [
  /\.(onnx|pt|pth|h5|msgpack|tflite|ckpt|pb)$/i,
  /\/cache\//, /\/\.git\//, /__pycache__/, /\/logs\//,
  /\.(log|tmp|lock)$/i,
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let running = false;
let timer = null;

// slug hóa hf_model_id cho path: "nvidia/Llama-3.3-70B" → "nvidia__Llama-3.3-70B"
function mirrorDir(entry) {
  const slug = entry.hfModelId.replace(/\//g, "__");
  const rev = entry.revision ? entry.revision.slice(0, 12) : "main";
  return path.join(cfg.mirror.root, slug, rev);
}

async function hfFetch(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(cfg.hf.timeoutMs, 300000));
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchFileList(repo, revision) {
  const url = `${cfg.hf.apiBase}/models/${repo}/tree/${revision || "main"}?recursive=true&expand=true`;
  const resp = await hfFetch(url, cfg.hf.token);
  if (!resp.ok) throw new Error(`HF tree ${resp.status}`);
  const arr = await resp.json();
  return arr
    .filter((f) => f.type === "file")
    .filter((f) => !SKIP_PATTERNS.some((re) => re.test(f.path)))
    .filter((f) => (f.size || 0) <= cfg.mirror.maxFileBytes)
    .map((f) => ({ path: f.path, size: f.size || 0 }));
}

async function downloadFile(repo, revision, filePath, destPath, onProgress) {
  const url = `${cfg.hf.fileBase}/${repo}/resolve/${revision || "main"}/${filePath}`;
  const resp = await hfFetch(url, cfg.hf.token);
  if (!resp.ok) throw new Error(`HF download ${resp.status} ${filePath}`);
  const total = parseInt(resp.headers.get("content-length") || "0", 10);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const out = fs.createWriteStream(destPath);
  let received = 0;
  const reader = resp.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out.write(value);
    if (onProgress && total) onProgress(received, total);
  }
  await new Promise((res, rej) => out.end((err) => (err ? rej(err) : res())));
  return received;
}

// runJob(job) — chạy 1 mirror job. Trả { ok, mirrorPath, checksum, files, totalBytes }
async function runJob(job) {
  const entry = await store.getEntry(job.entry_id);
  if (!entry) throw new Error(`entry ${job.entry_id} không tồn tại`);
  const dir = mirrorDir(entry);
  const files = await fetchFileList(entry.hfModelId, entry.revision);
  if (files.length > cfg.mirror.maxFiles) throw new Error(`repo có ${files.length} files — vượt giới hạn ${cfg.mirror.maxFiles}`);
  if (!files.some((f) => f.path === "config.json" || f.path.endsWith("/config.json"))) {
    throw new Error("repo thiếu config.json — không phải model hợp lệ");
  }

  let totalBytes = 0;
  for (const f of files) totalBytes += f.size;
  let doneBytes = 0;
  let doneFiles = 0;
  for (const f of files) {
    const dest = path.join(dir, f.path);
    await downloadFile(entry.hfModelId, entry.revision, f.path, dest);
    doneFiles++;
    doneBytes += f.size;
    const pct = totalBytes ? Math.min(99, Math.round((doneBytes / totalBytes) * 100)) : 100;
    await store.updateMirrorJob(job.id, { progressPct: pct });
  }

  // manifest + checksum (tên file + size) — verify toàn vẹn
  const manifest = files.map((f) => `${f.size}  ${f.path}`).sort();
  const checksum = "sha256:" + crypto.createHash("sha256").update(manifest.join("\n")).digest("hex");
  fs.writeFileSync(path.join(dir, ".mirror-manifest.json"), JSON.stringify({
    hfModelId: entry.hfModelId,
    revision: entry.revision || "main",
    files: files.length,
    totalBytes,
    checksum,
    mirroredAt: new Date().toISOString(),
  }, null, 2));

  return { ok: true, mirrorPath: `s3://mirror/${entry.hfModelId.replace(/\//g, "__")}/${(entry.revision || "main").slice(0, 12)}`, checksum, files: files.length, totalBytes };
}

// pollOnce — claim 1 job queued → chạy → cập nhật entry + job
async function pollOnce() {
  if (running) return;
  running = true;
  try {
    const active = await store.activeMirrorJobCount();
    if (active >= cfg.mirror.maxConcurrent) return;
    const job = await store.claimNextMirrorJob();
    if (!job) return;
    console.log(`[mc-mirror] bắt đầu job ${job.id} entry=${job.entry_id} rev=${job.revision || "main"}`);
    try {
      const result = await runJob(job);
      await store.updateMirrorJob(job.id, { status: "mirrored", progressPct: 100 });
      await store.setWeightStatus(job.entry_id, "mirrored", { mirrorPath: result.mirrorPath, checksum: result.checksum });
      console.log(`[mc-mirror] job ${job.id} MIRRORED — ${result.files} files, ${(result.totalBytes / 1024 / 1024).toFixed(1)}MB`);
    } catch (e) {
      const attempts = (job.attempts || 0) + 1;
      const fail = attempts >= cfg.mirror.maxAttempts;
      await store.updateMirrorJob(job.id, {
        status: fail ? "failed" : "queued",
        attempts,
        error: e.message,
        progressPct: 0,
      });
      if (fail) {
        await store.setWeightStatus(job.entry_id, "mirror_failed");
        console.error(`[mc-mirror] job ${job.id} FAILED sau ${attempts} lần: ${e.message}`);
      } else {
        console.warn(`[mc-mirror] job ${job.id} lỗi (lần ${attempts}/${cfg.mirror.maxAttempts}): ${e.message} — xếp lại queue`);
        await sleep(5000 * attempts);
      }
    }
  } finally {
    running = false;
  }
}

function start() {
  if (!cfg.worker.enabled) {
    console.log("[mc-mirror] worker TẮT (MC_WORKER_ENABLED=false)");
    return;
  }
  fs.mkdirSync(cfg.mirror.root, { recursive: true });
  timer = setInterval(pollOnce, cfg.mirror.pollIntervalMs);
  timer.unref();
  console.log(`[mc-mirror] worker chạy — root=${cfg.mirror.root}, poll=${cfg.mirror.pollIntervalMs}ms`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function status() {
  return { running, root: cfg.mirror.root, enabled: cfg.worker.enabled };
}

module.exports = { start, stop, status, runJob, pollOnce };