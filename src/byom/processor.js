"use strict";

// Real HF + S3 fetch — Together.ai parity.
// Tải files thật về /data/byom/<jobId>/weights/, validate theo HF format.

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const cfg = require("./config");
const store = require("./store");

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Hugging Face ──────────────────────────────────────────────

const HF_SKIP_PATTERNS = [
  /\.(onnx|pt|pth|h5|msgpack|tflite|ckpt|pb|safetensors\.index\.json)$/i,
  /\/cache\//, /\/\.git\//, /__pycache__/, /\/logs\//,
  /\.(log|tmp|lock)$/i,
];

function shouldSkipHfFile(filename, sizeBytes) {
  if (sizeBytes > cfg.hf.maxFilePerFileBytes) return true;
  for (const re of HF_SKIP_PATTERNS) if (re.test(filename)) return true;
  return false;
}

async function fetchHfRepoInfo({ repo, hfToken }) {
  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : {};
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(`${cfg.hf.apiBase}/models/${repo}`, { headers, signal: controller.signal });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      const err = new Error(`HF API ${resp.status}: ${txt.slice(0, 200)}`);
      err.code = resp.status === 404 ? "HF_REPO_NOT_FOUND"
        : resp.status === 401 || resp.status === 403 ? "HF_AUTH_FAILED" : "HF_API_FAILED";
      throw err;
    }
    return await resp.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchHfFileList({ repo, revision = "main", hfToken }) {
  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : {};
  const url = `${cfg.hf.apiBase}/models/${repo}/tree/${revision}?recursive=true&expand=true`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HF tree ${resp.status}: ${txt.slice(0, 200)}`);
    }
    const arr = await resp.json();
    return arr.filter((f) => f.type === "file").map((f) => ({
      path: f.path,
      size: f.size || 0,
      lfs: !!f.lfs,
      oid: f.oid,
    }));
  } finally {
    clearTimeout(t);
  }
}

async function downloadHfFile({ repo, revision, filePath, destPath, hfToken, onProgress }) {
  const url = `${cfg.hf.fileBase}/${repo}/resolve/${revision}/${filePath}`;
  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : {};
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.hf.timeoutMs);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HF download ${resp.status} ${filePath}: ${txt.slice(0, 100)}`);
    }
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
    await new Promise((res, rej) => out.end((err) => err ? rej(err) : res()));
    return { bytes: received, total };
  } finally {
    clearTimeout(t);
  }
}

async function processHfSource({ jobId, modelSource, hfToken, modelName, onUpdate }) {
  await onUpdate({ status: "downloading", statusMsg: `crawling HF ${modelSource}` });
  let repoInfo;
  try {
    repoInfo = await fetchHfRepoInfo({ repo: modelSource, hfToken });
  } catch (e) {
    throw e;
  }
  const revision = (repoInfo.tagsFilter && repoInfo.sha) || "main";
  const files = await fetchHfFileList({ repo: modelSource, revision, hfToken });
  if (files.length > cfg.hf.maxFilesPerRepo) {
    throw new Error(`repo có ${files.length} files — vượt giới hạn ${cfg.hf.maxFilesPerRepo}`);
  }
  const destDir = store.weightsDir(jobId);
  let totalBytes = 0;
  let downloaded = 0;
  let skipped = 0;
  for (const f of files) {
    if (shouldSkipHfFile(f.path, f.size)) { skipped++; continue; }
    const dest = path.join(destDir, f.path);
    await downloadHfFile({
      repo: modelSource, revision, filePath: f.path, destPath: dest, hfToken,
      onProgress: (rec, tot) => {},
    });
    totalBytes += f.size;
    downloaded++;
    if (downloaded % 5 === 0) {
      await onUpdate({
        status: "downloading",
        statusMsg: `downloaded ${downloaded}/${files.length} files`,
        progress: { downloaded, total: files.length, skipped, totalBytes },
      });
    }
  }
  return { type: "huggingface", repo: modelSource, revision, files: downloaded, skipped, totalBytes };
}

// ── S3 archive ───────────────────────────────────────────────

async function downloadS3Archive({ url, destPath, onProgress }) {
  if (!/^https?:\/\//.test(url)) throw new Error("S3 source phải là URL https");
  if (!cfg.storage.allowedArchiveExts.some((ext) => url.split("?")[0].toLowerCase().endsWith(ext))) {
    throw new Error(`archive phải có đuôi ${cfg.storage.allowedArchiveExts.join(", ")}`);
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.s3.timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`S3 fetch ${resp.status}: ${txt.slice(0, 150)}`);
    }
    const total = parseInt(resp.headers.get("content-length") || "0", 10);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const out = fs.createWriteStream(destPath);
    let received = 0;
    const reader = resp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > cfg.storage.maxModelSizeBytes) {
        out.destroy();
        throw new Error(`archive vượt ${cfg.storage.maxModelSizeBytes} bytes`);
      }
      out.write(value);
      if (onProgress && total) onProgress(received, total);
    }
    await new Promise((res, rej) => out.end((err) => err ? rej(err) : res()));
    return { bytes: received, total };
  } finally {
    clearTimeout(t);
  }
}

async function extractArchive({ archivePath, destDir, archiveType }) {
  fs.mkdirSync(destDir, { recursive: true });
  if (archiveType === ".zip") {
    await execFileAsync("unzip", ["-o", "-q", archivePath, "-d", destDir]);
  } else if (archiveType === ".tar.gz" || archiveType === ".tgz") {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", destDir]);
  } else if (archiveType === ".tar") {
    await execFileAsync("tar", ["-xf", archivePath, "-C", destDir]);
  } else {
    throw new Error(`không hỗ trợ đuôi ${archiveType}`);
  }
  const entries = fs.readdirSync(destDir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    const nested = path.join(destDir, entries[0].name);
    for (const e of fs.readdirSync(nested, { withFileTypes: true })) {
      fs.renameSync(path.join(nested, e.name), path.join(destDir, e.name));
    }
    fs.rmdirSync(nested);
  }
}

async function processS3Source({ jobId, modelSource, modelName, onUpdate }) {
  await onUpdate({ status: "downloading", statusMsg: `downloading archive from S3` });
  const archiveUrl = modelSource.split("?")[0];
  const archiveType = cfg.storage.allowedArchiveExts.find((ext) => archiveUrl.toLowerCase().endsWith(ext));
  if (!archiveType) throw new Error(`S3 archive phải có đuôi ${cfg.storage.allowedArchiveExts.join(", ")}`);
  if (archiveType === ".tar.gz" && !archiveUrl.endsWith(".tar.gz")) {
    throw new Error("không xác định được loại archive");
  }
  const archivePath = path.join(store.tmpDir(jobId), `model${archiveType}`);
  const destDir = store.weightsDir(jobId);
  await downloadS3Archive({ url: modelSource, destPath: archivePath });
  const stat = fs.statSync(archivePath);
  await onUpdate({
    status: "downloading",
    statusMsg: `extracting archive (${(stat.size / 1024 / 1024).toFixed(1)} MB)`,
  });
  await extractArchive({ archivePath, destDir, archiveType });
  try { fs.unlinkSync(archivePath); } catch (_) {}
  const w = store.weightsInfo(jobId);
  return { type: "s3", archiveUrl, totalBytes: w.totalBytes, files: w.count };
}

// ── Validation ───────────────────────────────────────────────

function validateWeights(jobId) {
  const dir = store.weightsDir(jobId);
  const w = store.weightsInfo(jobId);
  const missing = [];
  const found = {};
  if (!w.files.some((f) => f.name === "config.json" || f.name.endsWith("/config.json"))) {
    missing.push("config.json");
  } else { found["config.json"] = true; }
  const tokenizerVariants = [
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "spiece.model",
    "tokenizer.model",
    "merges.txt",
  ];
  const hasTokenizer = w.files.some((f) =>
    tokenizerVariants.includes(f.name) || tokenizerVariants.some((v) => f.name.endsWith("/" + v))
  );
  if (!hasTokenizer) { missing.push("tokenizer (tokenizer.json / tokenizer_config.json / vocab.json / spiece.model / tokenizer.model / merges.txt)"); }
  else { found["tokenizer"] = true; }
  const hasWeight = w.files.some((f) => {
    const lower = f.name.toLowerCase();
    return cfg.storage.allowedWeightExts.some((ext) => lower.endsWith(ext));
  });
  if (!hasWeight) missing.push("weights file (.safetensors/.bin/.pt/.gguf/.onnx)");
  if (missing.length) {
    const err = new Error(`thiếu file: ${missing.join(", ")}`);
    err.code = "VALIDATION_FAILED";
    err.missing = missing;
    throw err;
  }
  return { valid: true, files: w.count, totalBytes: w.totalBytes };
}

async function processJob({ jobId, payload }) {
  console.log(`[byom] processing job ${jobId} source=${payload.type} ${payload.modelSource}`);
  const onUpdate = async (patch) => {
    console.log(`[byom] ${jobId} → ${patch.status}: ${patch.statusMsg || ""}`);
    store.updateMeta(jobId, patch);
  };

  try {
    let downloadInfo;
    if (payload.type === "huggingface") {
      downloadInfo = await processHfSource({
        jobId, modelSource: payload.modelSource, hfToken: payload.hfToken, modelName: payload.modelName, onUpdate,
      });
    } else if (payload.type === "s3") {
      downloadInfo = await processS3Source({
        jobId, modelSource: payload.modelSource, modelName: payload.modelName, onUpdate,
      });
    } else {
      throw new Error(`source type không hợp lệ: ${payload.type}`);
    }

    await onUpdate({
      status: "validating",
      statusMsg: `validating weights (${downloadInfo.files} files, ${(downloadInfo.totalBytes / 1024 / 1024).toFixed(1)} MB)`,
    });
    const validation = validateWeights(jobId);

    const meta = store.updateMeta(jobId, {
      status: "ready",
      statusMsg: `ready to deploy — ${validation.files} files validated`,
      download: downloadInfo,
      validation,
      readyAt: new Date().toISOString(),
    });
    console.log(`[byom] job ${jobId} ready — ${validation.files} files, ${(validation.totalBytes / 1024 / 1024).toFixed(1)} MB`);
    return meta;
  } catch (e) {
    console.error(`[byom] job ${jobId} failed — ${e.message}`);
    store.updateMeta(jobId, {
      status: "failed",
      statusMsg: e.message,
      error: { code: e.code || "BYOM_FAILED", message: e.message, missing: e.missing },
      failedAt: new Date().toISOString(),
    });
    throw e;
  }
}

module.exports = { processJob, fetchHfRepoInfo, validateWeights };
