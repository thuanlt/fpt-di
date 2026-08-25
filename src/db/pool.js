"use strict";

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432", 10),
  database: process.env.PG_DB || "ddi",
  user: process.env.PG_USER || "ddi",
  password: process.env.PG_PASSWORD || "ddi",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (e) => console.error("[pg] pool error", e.message));

async function query(text, params) {
  return pool.query(text, params);
}

async function ready() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (_) {
    return false;
  }
}

async function shutdown() {
  await pool.end().catch(() => {});
}

module.exports = { pool, query, ready, shutdown };
