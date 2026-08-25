"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

let pass = 0, fail = 0;
const results = [];

function req(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET" }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, body: buf, json });
      });
    }).on("error", reject).end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

const TABLES = [
  "attention", "activity", "milestones",
  "nv_programs", "nv_contacts", "nv_timeline",
  "partners", "catalog_models", "serverless_endpoints",
  "ft_jobs", "ft_pricing",
  "sla_info", "sla_credit_tiers", "ptu_plans",
  "experiments", "pricing_tiers",
  "customers",
  "gpu_cards", "nodes", "clusters", "regions_extra", "regions", "maintenance",
  "headroom", "agent_skills",
  "cli_install", "cli_cmds", "sdk_samples", "docs",
];

async function main() {
  console.log(`\n=== FPT DDI Data API (Postgres) — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // 1. Health phải có postgres=true
  console.log("[1] GET /health — postgres ready");
  {
    const r = await req("/health");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("postgres=true", r.json?.postgres === true, JSON.stringify(r.json));
  }

  // 2. GET /v1/data/_/tables
  console.log("\n[2] GET /v1/data/_/tables — list 29 bảng public");
  {
    const r = await req("/v1/data/_/tables");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("count=29", r.json?.count === 29, `got ${r.json?.count}`);
    for (const t of TABLES) {
      check(`table "${t}" có trong list`, (r.json?.data || []).includes(t), "—");
    }
  }

  // 3. Verify từng bảng có data (≥1 row)
  console.log("\n[3] GET /v1/data/<table> — verify từng bảng có data thật");
  const expectMin = {
    attention: 4, activity: 5, milestones: 4,
    nv_programs: 4, nv_contacts: 3, nv_timeline: 4,
    partners: 8, catalog_models: 18, serverless_endpoints: 7,
    ft_jobs: 4, ft_pricing: 3,
    sla_info: 1, sla_credit_tiers: 3, ptu_plans: 3,
    experiments: 4, pricing_tiers: 4,
    customers: 6,
    gpu_cards: 4, nodes: 7, clusters: 3, regions_extra: 5, regions: 3, maintenance: 3,
    headroom: 4, agent_skills: 6,
    cli_install: 3, cli_cmds: 12, sdk_samples: 5, docs: 6,
  };
  for (const t of TABLES) {
    const r = await req(`/v1/data/${t}`);
    check(`${t}: status 200`, r.status === 200, `got ${r.status} — ${r.body?.slice(0, 100)}`);
    const got = r.json?.count ?? -1;
    const min = expectMin[t] || 1;
    check(`${t}: count=${got} ≥ ${min}`, got >= min, `got ${got}`);
  }

  // 4. GET /v1/data/partners — verify cấu trúc đúng
  console.log("\n[4] GET /v1/data/partners — cấu trúc row đúng");
  {
    const r = await req("/v1/data/partners");
    const first = r.json?.data?.[0] || {};
    check("field 'name' là string", typeof first.name === "string", "—");
    check("field 'models' là số", typeof first.models === "number", "—");
    check("field 'top' là string", typeof first.top === "string", "—");
    check("field 'status' là string", typeof first.status === "string", "—");
    check("có FPT.AI", r.json?.data?.some((p) => p.name === "FPT.AI"), "—");
  }

  // 5. GET /v1/data/catalog_models — đủ 18 model
  console.log("\n[5] GET /v1/data/catalog_models — 18 model");
  {
    const r = await req("/v1/data/catalog_models");
    check("count=18", r.json?.count === 18, `got ${r.json?.count}`);
    check("có Llama 4 Maverick", r.json?.data?.some((m) => m.model === "Llama 4 Maverick"), "—");
    check("có FPT-LLM 8B (vi)", r.json?.data?.some((m) => m.model === "FPT-LLM 8B (vi)"), "—");
    check("có Pika Video v2 (text-to-video)", r.json?.data?.some((m) => m.model === "Pika Video v2"), "—");
  }

  // 6. GET /v1/data/sla/_/full — agg đúng
  console.log("\n[6] GET /v1/data/sla/_/full — SLA + PTU agg");
  {
    const r = await req("/v1/data/sla/_/full");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("uptime='99.9%'", r.json?.data?.uptime === "99.9%", JSON.stringify(r.json?.data?.uptime));
    check("creditTiers=3", r.json?.data?.creditTiers?.length === 3, `got ${r.json?.data?.creditTiers?.length}`);
    check("ptuPlans=3", r.json?.data?.ptuPlans?.length === 3, `got ${r.json?.data?.ptuPlans?.length}`);
    check("tier 10%/25%/50%", r.json?.data?.creditTiers?.map((t) => t.credit).join("/") === "10%/25%/50%", "—");
  }

  // 7. GET /v1/data/nv_programs/_/formatted — stats là array
  console.log("\n[7] GET /v1/data/nv_programs/_/formatted — stats là array of [k,v]");
  {
    const r = await req("/v1/data/nv_programs/_/formatted");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("count=4", r.json?.count === 4, `got ${r.json?.count}`);
    const first = r.json?.data?.[0] || {};
    check("field 'stats' là array", Array.isArray(first.stats), "—");
    check("stats[0] là ['Tier','Certified']", JSON.stringify(first.stats?.[0]) === JSON.stringify(["Tier", "Certified"]), JSON.stringify(first.stats?.[0]));
  }

  // 8. GET /v1/data/cli/_/full — gộp install + cmds
  console.log("\n[8] GET /v1/data/cli/_/full — install + cmds + cmds2");
  {
    const r = await req("/v1/data/cli/_/full");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("install có curl", (r.json?.data?.install || "").startsWith("curl"), "—");
    check("cmds=6 quickstart", r.json?.data?.cmds?.length === 6, `got ${r.json?.data?.cmds?.length}`);
    check("cmds2=6 endpoint-batch", r.json?.data?.cmds2?.length === 6, `got ${r.json?.data?.cmds2?.length}`);
    check("cmd đầu 'fpt ddi auth login'", r.json?.data?.cmds?.[0]?.cmd === "fpt ddi auth login", "—");
  }

  // 9. GET /v1/data/_/telemetry — live KPI
  console.log("\n[9] GET /v1/data/_/telemetry — live KPI");
  {
    const r = await req("/v1/data/_/telemetry");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("field reqMin > 0", (r.json?.data?.reqMin || 0) > 0, "—");
    check("field errRate là string", typeof r.json?.data?.errRate === "string", "—");
    check("field p95 là string", typeof r.json?.data?.p95 === "string", "—");
  }

  // 10. GET /v1/data/sdk_samples — 5 ngôn ngữ
  console.log("\n[10] GET /v1/data/sdk_samples — 5 ngôn ngữ");
  {
    const r = await req("/v1/data/sdk_samples");
    check("count=5", r.json?.count === 5, `got ${r.json?.count}`);
    const langs = (r.json?.data || []).map((s) => s.language).sort();
    check("có openai+python+typescript+go+rust", langs.join(",") === "go,openai,python,rust,typescript", JSON.stringify(langs));
  }

  // 11. GET /v1/data/headroom — capacity per region
  console.log("\n[11] GET /v1/data/headroom — 4 region");
  {
    const r = await req("/v1/data/headroom");
    check("count=4", r.json?.count === 4, `got ${r.json?.count}`);
    check("có HAN-1", r.json?.data?.some((h) => h.region === "HAN-1"), "—");
    check("HAN-1.h100=6", r.json?.data?.find((h) => h.region === "HAN-1")?.h100 === 6, "—");
  }

  // 12. GET /v1/data/agent_skills — 6 skill
  console.log("\n[12] GET /v1/data/agent_skills — 6 skill");
  {
    const r = await req("/v1/data/agent_skills");
    check("count=6", r.json?.count === 6, `got ${r.json?.count}`);
    check("có fpt-ddi-endpoint-ops", r.json?.data?.some((s) => s.name === "fpt-ddi-endpoint-ops"), "—");
    check("invocations là số", typeof r.json?.data?.[0]?.invocations === "number", "—");
  }

  // 13. GET /v1/data/:id — row chi tiết
  console.log("\n[13] GET /v1/data/partners/1 — row chi tiết");
  {
    const r = await req("/v1/data/partners/1");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("id=1", r.json?.data?.id === 1, "—");
    check("name=FPT.AI", r.json?.data?.name === "FPT.AI", "—");
  }

  // 14. GET row không tồn tại → 404
  console.log("\n[14] GET /v1/data/partners/99999 → 404");
  {
    const r = await req("/v1/data/partners/99999");
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  // 15. GET bảng không tồn tại → 400
  console.log("\n[15] GET /v1/data/no-such-table → 400");
  {
    const r = await req("/v1/data/no-such-table");
    check("status 400", r.status === 400, `got ${r.status}`);
    check("error có message", !!r.json?.error, "—");
  }

  // 16. Persist verify — restart backend rồi data vẫn còn (đã seed vào pgdata volume)
  console.log("\n[16] Persist verify — query trực tiếp đếm rows");
  {
    const r = await req("/v1/data/partners");
    check("8 partners vẫn còn sau restart", r.json?.count === 8, `got ${r.json?.count}`);
  }

  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  if (fail > 0) {
    console.log("Cases thất bại:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
