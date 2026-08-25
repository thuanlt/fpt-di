"use strict";

// US-07 — Dashboard KPI theo phân khúc.
//   GET /v1/dashboard?segment=&range=&format=  (scope endpoints)
//   - kpis: requests, cost_usd, p95_latency_ms, error_rate, guardrail_blocks
//   - series: theo bucket thời gian (hour/day) — requests, cost, p95
//   - guardrail_by_rule: số chặn theo rule (cho WF-06)
//   - format=csv → trả CSV (KPI + series)
// Aggregate hiệu quả: join endpoint_entities (index segment),
// endpoint_usage (index endpoint_id+created_at), guardrail_event (index ts).

const express = require("express");
const db = require("../db/pool");

const router = express.Router();

const RANGES = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
const BUCKETS = { "24h": "hour", "7d": "day", "30d": "day" };

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

router.get("/dashboard", async (req, res) => {
  try {
    const segment = req.query.segment || null;
    const range = RANGES[req.query.range] ? req.query.range : "24h";
    const asCsv = req.query.format === "csv";
    const since = `now() - interval '${RANGES[range]}'`;
    const bucket = BUCKETS[range];

    // KPIs — 1 query aggregate (index endpoint_usage.created_at + join segment)
    const kpi = await db.query(
      `SELECT count(*) AS requests,
              count(*) FILTER (WHERE u.status_code >= 400) AS errors,
              COALESCE(SUM(u.cost_usd), 0) AS cost_usd,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY u.latency_ms) AS p95
       FROM endpoint_usage u
       LEFT JOIN endpoint_entities e ON e.id = u.endpoint_id
       WHERE u.created_at >= ${since}
         AND ($1::text IS NULL OR e.segment = $1)`,
      [segment]
    );
    const k = kpi.rows[0];
    const requests = parseInt(k.requests, 10);
    const errors = parseInt(k.errors, 10);
    const costUsd = parseFloat(k.cost_usd);
    const p95 = Math.round(Number(k.p95) || 0);
    const errorRate = requests > 0 ? Math.round((errors / requests) * 10000) / 10000 : 0;

    // Guardrail blocks — tổng + theo rule
    const grTotal = await db.query(
      `SELECT count(*)::int AS blocks
       FROM guardrail_event g
       LEFT JOIN endpoint_entities e ON e.id = g.endpoint_id
       WHERE g.ts >= ${since} AND g.blocked = TRUE
         AND ($1::text IS NULL OR e.segment = $1)`,
      [segment]
    );
    const grByRule = await db.query(
      `SELECT g.rule, count(*)::int AS blocked
       FROM guardrail_event g
       LEFT JOIN endpoint_entities e ON e.id = g.endpoint_id
       WHERE g.ts >= ${since} AND g.blocked = TRUE
         AND ($1::text IS NULL OR e.segment = $1)
       GROUP BY g.rule ORDER BY blocked DESC, g.rule`,
      [segment]
    );
    const guardrailBlocks = grTotal.rows[0].blocks;
    const guardrailByRule = grByRule.rows.map((r) => ({ rule: r.rule, blocked: r.blocked }));

    // Series theo bucket
    const series = await db.query(
      `SELECT to_char(date_trunc('${bucket}', u.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ts,
              count(*)::int AS requests,
              COALESCE(SUM(u.cost_usd), 0) AS cost_usd,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY u.latency_ms) AS p95
       FROM endpoint_usage u
       LEFT JOIN endpoint_entities e ON e.id = u.endpoint_id
       WHERE u.created_at >= ${since}
         AND ($1::text IS NULL OR e.segment = $1)
       GROUP BY 1 ORDER BY 1`,
      [segment]
    );
    const seriesRows = series.rows.map((r) => ({
      ts: r.ts,
      requests: r.requests,
      cost_usd: parseFloat(r.cost_usd).toFixed(6),
      p95_latency_ms: Math.round(Number(r.p95) || 0),
    }));

    if (asCsv) {
      const lines = [
        `# FPT DDI dashboard — segment=${segment || "all"} range=${range}`,
        `# kpis: requests=${requests} cost_usd=${costUsd.toFixed(6)} p95_latency_ms=${p95} error_rate=${errorRate} guardrail_blocks=${guardrailBlocks}`,
        "ts,requests,cost_usd,p95_latency_ms",
        ...seriesRows.map((r) => [r.ts, r.requests, r.cost_usd, r.p95_latency_ms].map(csvEscape).join(",")),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="dashboard-${segment || "all"}-${range}.csv"`);
      return res.send(lines.join("\n") + "\n");
    }

    res.json({
      segment: segment || null,
      range,
      kpis: {
        requests,
        cost_usd: costUsd.toFixed(6),
        p95_latency_ms: p95,
        error_rate: errorRate,
        guardrail_blocks: guardrailBlocks,
      },
      guardrail_by_rule: guardrailByRule,
      series: seriesRows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;