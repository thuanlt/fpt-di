"use strict";

const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

const ZENFLOW_BIN = process.env.ZENFLOW_BIN || "/usr/local/bin/zenflow";
const WORKFLOWS_DIR = process.env.ZENFLOW_WORKFLOWS_DIR || "/app/zenflow-workflows";
const WORKDIR_ROOT = process.env.ZENFLOW_WORKDIR_ROOT || "/tmp/zenflow-runs";
const ZENFLOW_MODEL = process.env.ZENFLOW_MODEL || "google/gemini-2.0-flash";

const SKILL_REGISTRY = [
  { name: "fpt-ddi-endpoint-ops", file: "fpt-ddi-endpoint-ops.yaml" },
  { name: "fpt-ddi-batch-runner", file: "fpt-ddi-batch-runner.yaml" },
  { name: "fpt-ddi-ft-pipeline", file: "fpt-ddi-ft-pipeline.yaml" },
  { name: "fpt-ddi-cost-watch", file: "fpt-ddi-cost-watch.yaml" },
  { name: "fpt-ddi-capacity-planner", file: "fpt-ddi-capacity-planner.yaml" },
  { name: "fpt-ddi-experiment-runner", file: "fpt-ddi-experiment-runner.yaml" },
  { name: "fpt-ddi-qc-autotest", file: "fpt-ddi-qc-autotest.yaml" },
];

const runs = new Map();

function findSkill(name) {
  return SKILL_REGISTRY.find((s) => s.name === name);
}

function safeId() {
  return "r-" + crypto.randomBytes(6).toString("hex");
}

router.get("/skills", (req, res) => {
  res.json({
    count: SKILL_REGISTRY.length,
    data: SKILL_REGISTRY.map((s) => ({ id: s.name, workflow: s.file, available: fs.existsSync(path.join(WORKFLOWS_DIR, s.file)) })),
  });
});

router.get("/skills/:name/invoke", (req, res) => {
  const skill = findSkill(req.params.name);
  if (!skill) return res.status(404).json({ error: "Không tìm thấy skill" });
  const yamlPath = path.join(WORKFLOWS_DIR, skill.file);
  if (!fs.existsSync(yamlPath)) return res.status(404).json({ error: "Workflow YAML không tồn tại", path: yamlPath });
  if (!fs.existsSync(ZENFLOW_BIN)) return res.status(503).json({ error: "zenflow binary chưa cài", path: ZENFLOW_BIN });

  const runId = safeId();
  const workdir = path.join(WORKDIR_ROOT, runId);
  fs.mkdirSync(workdir, { recursive: true });

  const args = [
    "flow", yamlPath,
    "--quiet",
    "--no-mcp",
    "--json",
    "--allow", "bash",
    "--workdir", workdir,
    "--model", ZENFLOW_MODEL,
  ];

  const child = spawn(ZENFLOW_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
  const events = [];
  let stdoutBuf = "";

  runs.set(runId, { id: runId, skill: skill.name, status: "running", startedAt: new Date().toISOString(), events, child });

  const pushEvent = (obj) => {
    events.push(obj);
    runs.get(runId).lastEventAt = obj.timestamp || new Date().toISOString();
  };

  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, idx).trim();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        pushEvent(obj);
        if (obj.type === "workflow_end") {
          runs.get(runId).status = "completed";
          runs.get(runId).completedAt = obj.timestamp || new Date().toISOString();
        }
      } catch (_) {
        pushEvent({ type: "raw", message: line, timestamp: new Date().toISOString() });
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    pushEvent({ type: "stderr", message: chunk.toString(), timestamp: new Date().toISOString() });
  });

  child.on("error", (e) => {
    runs.get(runId).status = "failed";
    runs.get(runId).error = e.message;
    pushEvent({ type: "error", message: `spawn error: ${e.message}`, timestamp: new Date().toISOString() });
  });

  child.on("close", (code) => {
    const r = runs.get(runId);
    if (r.status === "running") {
      r.status = code === 0 ? "completed" : "failed";
      r.completedAt = new Date().toISOString();
      r.exitCode = code;
    }
    pushEvent({ type: "process_exit", exitCode: code, timestamp: new Date().toISOString() });
    try { fs.rmSync(workdir, { recursive: true, force: true }); } catch (_) {}
  });

  res.status(202).json({
    id: runId,
    skill: skill.name,
    status: "running",
    startedAt: runs.get(runId).startedAt,
    pollUrl: `/v1/skills/runs/${runId}`,
  });
});

router.get("/skills/runs/:id", (req, res) => {
  const r = runs.get(req.params.id);
  if (!r) return res.status(404).json({ error: "Không tìm thấy run" });
  res.json({ data: r });
});

router.get("/skills/runs/:id/events", (req, res) => {
  const r = runs.get(req.params.id);
  if (!r) return res.status(404).json({ error: "Không tìm thấy run" });
  res.json({ count: r.events.length, data: r.events });
});

router.get("/skills/runs", (req, res) => {
  const all = Array.from(runs.values()).map((r) => ({
    id: r.id, skill: r.skill, status: r.status, startedAt: r.startedAt, completedAt: r.completedAt, eventCount: r.events.length,
  }));
  all.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  res.json({ count: all.length, data: all });
});

module.exports = router;
