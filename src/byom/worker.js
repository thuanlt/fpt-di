"use strict";

// BYOM worker — async, tự poll meta.json, process mỗi job queued.
// Không dùng Redis (giữ đơn giản cho preview); in-memory queue qua meta file.

const cfg = require("./config");
const store = require("./store");
const { processJob } = require("./processor");

const isRunning = { value: false };
let pollTimer = null;
let inFlight = 0;

function start() {
  if (isRunning.value) return;
  isRunning.value = true;
  console.log(`[byom-worker] started — poll=${cfg.worker.pollIntervalMs}ms concurrency=${cfg.worker.concurrent}`);
  pollTimer = setInterval(pollOnce, cfg.worker.pollIntervalMs);
  setTimeout(pollOnce, 500);
}

function stop() {
  isRunning.value = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  console.log("[byom-worker] stopped");
}

function status() { return isRunning.value; }

async function pollOnce() {
  if (!isRunning.value) return;
  if (inFlight >= cfg.worker.concurrent) return;
  const jobs = store.listAll().filter((j) => j.status === "queued");
  for (const job of jobs.slice(0, cfg.worker.concurrent - inFlight)) {
    inFlight++;
    runJob(job.id).catch((e) => console.error(`[byom-worker] ${job.id} crashed`, e.message))
      .finally(() => inFlight--);
  }
}

async function runJob(jobId) {
  const meta = store.getById(jobId);
  if (!meta || meta.status !== "queued") return;
  try {
    await processJob({ jobId, payload: meta.payload });
  } catch (_) {
    // đã set status "failed" trong processor
  }
}

module.exports = { start, stop, status };
