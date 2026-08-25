"use strict";

// US-04 — Documents worker — poll job queued → processing → completed/failed.
// Không dùng Redis (giữ đơn giản cho preview); in-memory poll qua store,
// pattern như byom worker.

const cfg = require("./config");
const store = require("./store");
const { processJob } = require("./processor");

let isRunning = false;
let pollTimer = null;
let inFlight = 0;

async function pollOnce() {
  if (!isRunning) return;
  if (inFlight >= cfg.worker.concurrent) return;
  const jobs = await store.list({ status: "queued" });
  for (const job of jobs.slice(0, cfg.worker.concurrent - inFlight)) {
    inFlight++;
    runJob(job.id)
      .catch((e) => console.error(`[documents-worker] ${job.id} crashed`, e.message))
      .finally(() => inFlight--);
  }
}

async function runJob(jobId) {
  const job = await store.getById(jobId);
  if (!job || job.status !== "queued") return;
  try {
    await processJob(jobId);
  } catch (_) {
    // đã set status "failed" trong processor
  }
}

function start() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[documents-worker] started — poll=${cfg.worker.pollIntervalMs}ms concurrency=${cfg.worker.concurrent}`);
  pollTimer = setInterval(pollOnce, cfg.worker.pollIntervalMs);
  setTimeout(pollOnce, 500);
}

function stop() {
  isRunning = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  console.log("[documents-worker] stopped");
}

function status() { return isRunning; }

module.exports = { start, stop, status };