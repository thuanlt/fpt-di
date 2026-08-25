-- FPT DDI Partner Console — schema + seed thật
-- Chạy tự động khi Postgres container khởi động lần đầu (qua docker-entrypoint-initdb.d)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===================== Overview widgets =====================
CREATE TABLE IF NOT EXISTS attention (
  id SERIAL PRIMARY KEY,
  sev TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO attention (sev, text) VALUES
  ('high', 'sg1-gpu-007 at 92% utilization — capacity review needed before Retail peak season (Nov).'),
  ('high', 'Cohere integration on hold — SOC2 scope letter outstanding for 12 days.'),
  ('med',  'deepseek-r1 endpoint degraded — p95 at 640 ms, above 300 ms target.'),
  ('low',  'H200/B300 list pricing still awaiting final approval before Phase 2 launch.');

CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY,
  time TEXT NOT NULL,
  text TEXT NOT NULL
);
INSERT INTO activity (time, text) VALUES
  ('09:42', '<b>Qwen3-235B-A22B</b> scaled to 6 replicas on SGN-1'),
  ('09:15', '<b>Mistral AI</b> trial endpoint deployed for EU-customer evaluation'),
  ('08:50', '<b>NVIDIA NIM</b> bundle passed compliance review for BFSI tier'),
  ('08:31', 'New savings plan committed — <b>FinSaaS JSC</b>, 6-month H200 reservation'),
  ('07:58', '<b>GLM-4.6</b> added to the serverless catalog (HAN-2)');

CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  text TEXT NOT NULL
);
INSERT INTO milestones (date, text) VALUES
  ('SEP 30', 'Phase 1 exit review — 10 pilot customers, 20 models'),
  ('OCT 15', 'Data residency certification audit (Decree 13/2023)'),
  ('NOV 01', 'Retail peak-season capacity freeze'),
  ('Q1 2027', 'Phase 2 launch — H200/B300 general availability');

-- ===================== NVIDIA =====================
CREATE TABLE IF NOT EXISTS nv_programs (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  stats JSONB NOT NULL DEFAULT '[]'
);
INSERT INTO nv_programs (tag, title, body, stats) VALUES
  ('NCP', 'NVIDIA Cloud Partner', 'Certified cloud partner since 2025. DDI fleet eligible for NVIDIA enterprise support and early-release drivers.', '[["Tier","Certified"],["Renewal","2027-01"]]'),
  ('AI FACTORY', 'FPT AI Factory', '$200M joint investment with NVIDIA. 43 cloud AI services launched on Green architecture.', '[["Investment","$200M"],["Services","43"]]'),
  ('NGC', 'NGC Catalog Access', 'Private registry mirror in Vietnam for containerized AI workloads — NGC containers serve from HAN-2.', '[["Mirror","HAN-2"],["Containers","118"]]'),
  ('NIM', 'NVIDIA NIM Rollout', 'NIM microservices bundled with dedicated deployments for BFSI customers in compliance mode.', '[["Pilots","3"],["GA","Phase 2"]]');

CREATE TABLE IF NOT EXISTS nv_contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL
);
INSERT INTO nv_contacts (name, role) VALUES
  ('Alan Tsai', 'Alliance Manager, NVIDIA APAC'),
  ('Priya Nair', 'Cloud Partner Engineering'),
  ('Minh Vo', 'FPT × NVIDIA Program Office');

CREATE TABLE IF NOT EXISTS nv_timeline (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  text TEXT NOT NULL
);
INSERT INTO nv_timeline (date, text) VALUES
  ('SEP 2026', 'B300 nodes enter enterprise pilot'),
  ('NOV 2026', 'NIM microservices GA for BFSI tier'),
  ('Q1 2027',  'GB200 rack evaluation with AI Factory team'),
  ('2027',     'Multi-region ASEAN expansion review');

-- ===================== Model partners =====================
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  models INT NOT NULL,
  top TEXT NOT NULL,
  share NUMERIC NOT NULL,
  integration TEXT NOT NULL,
  status TEXT NOT NULL,
  contact TEXT NOT NULL,
  since TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO partners (name, models, top, share, integration, status, contact, since, note) VALUES
  ('FPT.AI', 14, 'FPT-LLM 8B (vi)', 22, 'Native', 'active', 'ai-partners@fpt.com', '2024-03', 'Flagship Vietnamese LLM family. Tightest latency integration in catalog.'),
  ('Qwen (Alibaba)', 9, 'Qwen3-235B-A22B', 18, 'vLLM + OpenAI API', 'active', 'partners@qwen.org', '2024-07', 'Highest-volume open-weights family. Batch discount program applies.'),
  ('Meta Llama', 6, 'Llama-3.3-70B', 15, 'Triton + vLLM', 'active', 'llama-ops@meta.com', '2024-05', 'Community license verified for all deployment sizes.'),
  ('DeepSeek', 4, 'DeepSeek-R1', 11, 'SGLang', 'active', 'bd@deepseek.com', '2025-02', 'Reasoning workloads. Long-context KV cache tuning in progress.'),
  ('Mistral AI', 5, 'Mistral-Large-2', 8, 'vLLM', 'trialing', 'partnerships@mistral.ai', '2026-06', 'Trial for EU-headquartered customers in Vietnam.'),
  ('Cohere', 3, 'Command-R+', 5, 'Pending', 'on hold', 'apac@cohere.com', '2026-07', 'On hold pending enterprise compliance pack (SOC2 scope review).'),
  ('Zhipu GLM', 4, 'GLM-4.6', 6, 'vLLM', 'active', 'bd@zhipuai.ai', '2025-09', 'Strong coding + agent benchmarks. Growing in dev-tool segment.'),
  ('VinAI', 3, 'PhoGPT-4B', 4, 'Native', 'active', 'api@vinai.io', '2024-11', 'Vietnamese specialist models for on-prem edge deployments.');

-- ===================== Serverless endpoints (shared) =====================
CREATE TABLE IF NOT EXISTS serverless_endpoints (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  gpu TEXT NOT NULL,
  region TEXT NOT NULL,
  tpm TEXT NOT NULL,
  p95 INT NOT NULL,
  rep TEXT NOT NULL,
  cost TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO serverless_endpoints (name, model, gpu, region, tpm, p95, rep, cost, status) VALUES
  ('qwen3-235b-a22b', 'Qwen3-235B-A22B', 'H200', 'SGN-1', '1.82M', 212, '6/6', '18.40', 'running'),
  ('fpt-llm-8b-vi', 'FPT-LLM 8B (vi)', 'L40S', 'HAN-1', '960K', 118, '4/4', '4.10', 'running'),
  ('llama-3.3-70b', 'Llama-3.3-70B', 'H100', 'HAN-1', '1.24M', 189, '5/6', '12.75', 'running'),
  ('deepseek-r1', 'DeepSeek-R1', 'H200', 'SGN-1', '415K', 640, '3/4', '9.60', 'degraded'),
  ('glm-4.6', 'GLM-4.6', 'H100', 'HAN-2', '702K', 246, '4/4', '8.50', 'running'),
  ('phogpt-4b', 'PhoGPT-4B', 'A30', 'HAN-2', '184K', 96, '1/2', '1.20', 'paused'),
  ('command-r-plus', 'Command-R+', 'H100', 'SGN-1', '52K', 310, '1/2', '6.30', 'paused');

-- ===================== Model catalog =====================
CREATE TABLE IF NOT EXISTS catalog_models (
  id SERIAL PRIMARY KEY,
  model TEXT NOT NULL,
  vendor TEXT NOT NULL,
  ctx TEXT NOT NULL,
  modal TEXT NOT NULL,
  size TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO catalog_models (model, vendor, ctx, modal, size, status, note) VALUES
  ('Llama 4 Maverick', 'Meta', '524K', 'text+vision', '400B MoE', 'new', 'Frontier multimodal, long context'),
  ('Llama 4 Scout', 'Meta', '327K', 'text+vision', '109B MoE', 'new', 'Faster sibling of Maverick'),
  ('DeepSeek V4 Pro', 'DeepSeek', '512K', 'text', '685B', 'new', '384K output window, reasoning'),
  ('DeepSeek V4 Pro 0813', 'DeepSeek', '512K', 'text', '685B', 'new', 'Latest reasoning refresh'),
  ('Qwen 3.8-Max', 'Alibaba', '1M', 'text', '2.4T-A95B', 'new', 'Largest open-weights, 1M ctx'),
  ('Qwen 3.7 Plus', 'Alibaba', '1M', 'text', '118B', 'active', '1M context budget tier'),
  ('GLM-5.3', 'Zhipu', '1M', 'text+code', '355B', 'new', 'Coding + agent benchmarks'),
  ('GLM-5.2', 'Zhipu', '256K', 'text+code', '320B', 'active', 'Stable coding workhorse'),
  ('Kimi K3', 'Moonshot', '256K', 'text', '671B', 'active', 'Agentic long-horizon'),
  ('MiniMax M3', 'MiniMax', '1M', 'text+audio', '456B', 'active', '1M ctx, voice-native'),
  ('Nemotron 3.5 Lightning', 'NVIDIA', '128K', 'text', '49B', 'new', 'Dedicated-only, low latency'),
  ('Cogito v2.1', 'DeepCognito', '256K', 'text', '671B', 'new', 'Reasoning + agentic'),
  ('Muse Glimmer 30B', 'Meta', '128K', 'image', '30B', 'new', 'Image generation'),
  ('Whisper Large v3', 'OpenAI', '—', 'audio', '1.5B', 'active', 'Speech-to-text'),
  ('Pika Video v2', 'Pika', '—', 'video', '—', 'new', 'Text-to-video generation'),
  ('FPT-LLM 8B (vi)', 'FPT.AI', '128K', 'text', '8B', 'active', 'Vietnamese specialist'),
  ('PhoGPT-4B', 'VinAI', '64K', 'text', '4B', 'active', 'Edge Vietnamese model'),
  ('Gemma 4 31B', 'Google', '256K', 'text', '31B', 'active', 'Efficient open weights');

-- ===================== Fine-tune =====================
CREATE TABLE IF NOT EXISTS ft_jobs (
  id SERIAL PRIMARY KEY,
  job TEXT NOT NULL,
  base TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  target TEXT NOT NULL,
  cost TEXT NOT NULL,
  progress INT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO ft_jobs (job, base, method, status, target, cost, progress, note) VALUES
  ('ft-bfsi-fraud-v3', 'FPT-LLM 8B (vi)', 'LoRA', 'deployed', 'fraud-detect-bfsi', '1.92', 100, 'One-click deployed to dedicated'),
  ('ft-coding-glm', 'GLM-5.2', 'Full', 'running', '—', '28.40', 64, 'Multi-node training, 4 H100'),
  ('ft-rag-qwen', 'Qwen 3.7 Plus', 'DPO', 'running', '—', '6.10', 38, 'Preference alignment for RAG'),
  ('ft-vi-llama', 'Llama 3.3 70B', 'LoRA', 'queued', '—', '0.00', 0, 'Queued — awaiting GPU allocation');

CREATE TABLE IF NOT EXISTS ft_pricing (
  id SERIAL PRIMARY KEY,
  method TEXT NOT NULL,
  small TEXT NOT NULL,
  mid TEXT NOT NULL,
  large TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO ft_pricing (method, small, mid, large, note) VALUES
  ('LoRA', '0.48', '1.20', '2.40', 'Cheapest, most common'),
  ('Full', '2.00', '4.80', '8.00', 'Full weight update'),
  ('DPO', '0.54', '1.34', '2.69', '+~12% over LoRA');

-- ===================== SLA + PTU =====================
CREATE TABLE IF NOT EXISTS sla_info (
  id SERIAL PRIMARY KEY,
  uptime TEXT NOT NULL
);
INSERT INTO sla_info (uptime) VALUES ('99.9%');

CREATE TABLE IF NOT EXISTS sla_credit_tiers (
  id SERIAL PRIMARY KEY,
  below TEXT NOT NULL,
  credit TEXT NOT NULL,
  "desc" TEXT NOT NULL
);
INSERT INTO sla_credit_tiers (below, credit, "desc") VALUES
  ('99.9', '10%', 'Below committed uptime'),
  ('99.0', '25%', 'Material downtime'),
  ('95.0', '50%', 'Major incident');

CREATE TABLE IF NOT EXISTS ptu_plans (
  id SERIAL PRIMARY KEY,
  plan TEXT NOT NULL,
  model TEXT NOT NULL,
  tpm TEXT NOT NULL,
  rate TEXT NOT NULL,
  commit TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO ptu_plans (plan, model, tpm, rate, commit, status) VALUES
  ('BFSI — VietBank', 'FPT-LLM 8B (vi)', '120K', '6.00', '91–180d', 'active'),
  ('Retail — MegaMart', 'GLM-5.2', '200K', '10.00', '31–90d', 'active'),
  ('FinSaaS — Tier', 'Qwen 3.7 Plus', '350K', '17.50', '7–30d', 'trialing');

-- ===================== Experiments =====================
CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  control TEXT NOT NULL,
  variants INT NOT NULL,
  traffic TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO experiments (name, type, control, variants, traffic, status, note) VALUES
  ('fraud-model-ab', 'A/B', 'FPT-LLM 8B (vi)', 4, 'control 50% / 4×12.5%', 'running', 'Ramp variant #2 to 25%'),
  ('rag-rewrite-shadow', 'Shadow', 'GLM-5.2', 1, 'mirror, not served', 'running', 'Safe rollout eval'),
  ('coding-glm-vs-qwen', 'A/B', 'GLM-5.2', 1, '50/50', 'promoted', 'Variant promoted to prod'),
  ('vi-llama-eval', 'Shadow', 'FPT-LLM 8B (vi)', 3, 'mirror, not served', 'paused', 'Paused for dataset refresh');

-- ===================== Pricing =====================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id SERIAL PRIMARY KEY,
  gpu TEXT NOT NULL,
  ondemand TEXT NOT NULL,
  d730 TEXT NOT NULL,
  d3190 TEXT NOT NULL,
  d180 TEXT NOT NULL,
  hyperscaler TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO pricing_tiers (gpu, ondemand, d730, d3190, d180, hyperscaler, note) VALUES
  ('A30', '0.90', '0.82', '—', '—', 'n/a', 'Entry — SME'),
  ('H100', '2.50', '2.28', '2.10', '1.83', '6.16', 'Primary production'),
  ('H200', '3.30', '3.00', '2.77', '2.41', '7.91', 'Long context + reasoning'),
  ('B300', '5.50', '5.01', '4.63', '4.04', '—', 'Premium, reserved');

-- ===================== Customers (social proof) =====================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL
);
INSERT INTO customers (name, sector) VALUES
  ('VietBank', 'BFSI'),
  ('SaigonInsurance', 'BFSI'),
  ('FinSaaS JSC', 'FinTech'),
  ('MegaMart VN', 'Retail'),
  ('Mobifone', 'Telco'),
  ('Hanoi Med', 'Healthcare');

-- ===================== Infra: GPUs + nodes + clusters + regions + maintenance =====================
CREATE TABLE IF NOT EXISTS gpu_cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  nodes INT NOT NULL,
  util INT NOT NULL,
  state TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO gpu_cards (name, nodes, util, state, note) VALUES
  ('H100 SXM', 24, 71, 'Allocated', 'Primary production accelerator'),
  ('H200 SXM', 12, 64, 'Allocated', 'Large-context + reasoning workloads'),
  ('B300', 6, 38, 'Pilot', 'Phase-2 premium tier, enterprise reserved'),
  ('A30', 18, 52, 'Allocated', 'Entry-point tier for SMEs');

CREATE TABLE IF NOT EXISTS nodes (
  id SERIAL PRIMARY KEY,
  node TEXT NOT NULL,
  gpu TEXT NOT NULL,
  region TEXT NOT NULL,
  util INT NOT NULL,
  tenant TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO nodes (node, gpu, region, util, tenant, status) VALUES
  ('hn1-gpu-014', 'H100 ×8', 'HAN-1', 78, 'BFSI — VietBank', 'running'),
  ('hn1-gpu-021', 'H200 ×8', 'HAN-1', 66, 'Mid-tech — FinSaaS JSC', 'running'),
  ('hn2-gpu-003', 'A30 ×8', 'HAN-2', 54, 'Shared — serverless pool', 'running'),
  ('sg1-gpu-007', 'H200 ×8', 'SGN-1', 92, 'BFSI — SaigonInsurance', 'running'),
  ('sg1-gpu-009', 'H100 ×8', 'SGN-1', 88, 'Retail — MegaMart VN', 'running'),
  ('sg1-gpu-011', 'B300 ×8', 'SGN-1', 24, 'Reserved — Phase 2 pilot', 'maint'),
  ('hn2-gpu-006', 'A30 ×8', 'HAN-2', 12, 'Unallocated', 'paused');

CREATE TABLE IF NOT EXISTS clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gpu TEXT NOT NULL,
  fabric TEXT NOT NULL,
  region TEXT NOT NULL,
  util INT NOT NULL,
  status TEXT NOT NULL,
  tenant TEXT NOT NULL
);
INSERT INTO clusters (name, gpu, fabric, region, util, status, tenant) VALUES
  ('hn1-baremetal-01', 'H100 ×8', 'InfiniBand 400G', 'HAN-1', 74, 'running', 'Training — BFSI fraud'),
  ('sg1-baremetal-03', 'H200 ×8', 'InfiniBand 400G', 'SGN-1', 41, 'running', 'Multi-node training'),
  ('jp1-cluster-01', 'B300 ×8', 'NVLink + IB', 'JP-1', 12, 'pilot', 'Reserved — JP pilot');

CREATE TABLE IF NOT EXISTS regions_extra (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT NOT NULL,
  cap TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO regions_extra (name, detail, cap, status) VALUES
  ('Hanoi — HAN-1', 'Primary · AI Factory campus', '24 nodes · 99.95%', 'active'),
  ('Hanoi — HAN-2', 'Secondary · NGC mirror + A30 pool', '14 nodes · 99.9%', 'active'),
  ('Ho Chi Minh — SGN-1', 'Expansion · H200/B300 tier', '10 nodes · 99.9%', 'active'),
  ('Japan — JP-1', 'Phase 3 · ASEAN expansion', '8 nodes · 99.9%', 'pilot'),
  ('Korea — KR-1', 'Phase 3 · planned', '— · planned', 'planned');

CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT NOT NULL,
  cap TEXT NOT NULL
);
INSERT INTO regions (name, detail, cap) VALUES
  ('Hanoi — HAN-1', 'Primary · AI Factory campus', '24 nodes · 99.95%'),
  ('Hanoi — HAN-2', 'Secondary · NGC mirror + A30 pool', '14 nodes · 99.9%'),
  ('Ho Chi Minh — SGN-1', 'Expansion · H200/B300 tier', '10 nodes · 99.9%');

CREATE TABLE IF NOT EXISTS maintenance (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT NOT NULL
);
INSERT INTO maintenance (name, detail) VALUES
  ('hn1-gpu-018 — firmware patch', 'Sep 12 · 02:00–04:00 ICT'),
  ('SGN-1 network fabric upgrade', 'Sep 21 · 01:00–05:00 ICT'),
  ('NGC mirror sync window', 'Weekly · Sunday 03:00 ICT');

-- ===================== Headroom API + Agent skills =====================
CREATE TABLE IF NOT EXISTS headroom (
  id SERIAL PRIMARY KEY,
  region TEXT NOT NULL,
  h100 INT NOT NULL,
  h200 INT NOT NULL,
  b300 INT NOT NULL,
  a30 INT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL
);
INSERT INTO headroom (region, h100, h200, b300, a30, status, note) VALUES
  ('HAN-1', 6, 2, 0, 11, 'active', 'H100 headroom for burst'),
  ('HAN-2', 3, 0, 0, 5,  'active', 'A30 pool available'),
  ('SGN-1', 2, 4, 2, 0,  'active', 'H200/B300 reserved tier'),
  ('JP-1',  0, 0, 6, 0,  'pilot',  'Pilot — B300 only');

CREATE TABLE IF NOT EXISTS agent_skills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  invocations INT NOT NULL DEFAULT 0,
  last_run TEXT NOT NULL
);
INSERT INTO agent_skills (name, description, status, invocations, last_run) VALUES
  ('fpt-ddi-endpoint-ops', 'Agent tự list/run/scale/stop dedicated endpoints', 'available', 12842, '2m ago'),
  ('fpt-ddi-batch-runner', 'Agent gửi & theo dõi batch job, cảnh báo khi xong', 'available', 4910, '14m ago'),
  ('fpt-ddi-ft-pipeline', 'Agent chạy fine-tune → deploy lên dedicated', 'beta', 612, '1h ago'),
  ('fpt-ddi-cost-watch', 'Agent giám sát burn rate & đề xuất commit term', 'beta', 178, '3h ago'),
  ('fpt-ddi-capacity-planner', 'Agent đo headroom & gợi ý region/GPU tối ưu', 'available', 2093, '27m ago'),
  ('fpt-ddi-experiment-runner', 'Agent chạy A/B test, ramp & promote variant', 'beta', 88, 'yesterday');

-- ===================== CLI + SDK + docs (text blobs) =====================
CREATE TABLE IF NOT EXISTS cli_install (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  command TEXT NOT NULL
);
INSERT INTO cli_install (name, command) VALUES
  ('default', 'curl -fsSL https://fpt.ai/ddi/install.sh | sh'),
  ('pip', 'pipx install fpt-ddi'),
  ('brew', 'brew install fpt-ai/tap/fpt-ddi');

CREATE TABLE IF NOT EXISTS cli_cmds (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  cmd TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  ord INT NOT NULL DEFAULT 0
);
INSERT INTO cli_cmds (category, cmd, "desc", ord) VALUES
  ('quickstart', 'fpt ddi auth login', 'Authenticate via FPT ID or API key', 1),
  ('quickstart', 'fpt ddi configure', 'Set default region, project, output format', 2),
  ('quickstart', 'fpt ddi endpoint list', 'List dedicated endpoints', 3),
  ('quickstart', 'fpt ddi endpoint create --model llama-4-maverick --gpu H100 --replicas 2', 'Create a dedicated endpoint', 4),
  ('quickstart', 'fpt ddi endpoint scale --name fraud-bfsi --replicas 4', 'Scale replica count', 5),
  ('quickstart', 'fpt ddi endpoint logs --name fraud-bfsi --tail', 'Stream endpoint logs', 6),
  ('endpoint-batch', 'fpt ddi batch submit --file jobs.jsonl', 'Submit a batch job (−50% pricing)', 1),
  ('endpoint-batch', 'fpt ddi batch status --job batch-rag-ingest', 'Track batch progress', 2),
  ('endpoint-batch', 'fpt ddi ft start --base glm-5.2 --method lora', 'Start a fine-tune job', 3),
  ('endpoint-batch', 'fpt ddi ft deploy --job ft-bfsi-fraud-v3', 'One-click deploy FT model → endpoint', 4),
  ('endpoint-batch', 'fpt ddi cluster create --gpu H200 --nodes 4', 'Provision a bare-metal cluster', 5),
  ('endpoint-batch', 'fpt ddi headroom --gpu H100 --region HAN-1', 'Query capacity headroom', 6);

CREATE TABLE IF NOT EXISTS sdk_samples (
  id SERIAL PRIMARY KEY,
  language TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL
);
INSERT INTO sdk_samples (language, code) VALUES
  ('openai', '# Drop-in for any OpenAI SDK — point at FPT DDI
from openai import OpenAI
client = OpenAI(
    base_url="https://api.ddi.fpt.vn/v1",
    api_key="ddi-••••••••••••••••••••••••••••••"
)
resp = client.chat.completions.create(
    model="llama-4-maverick",
    messages=[{"role": "user", "content": "Xin chào!"}],
    stream=True
)'),
  ('python', 'from fpt_ddi import DDI

client = DDI.from_env()

ep = client.endpoints.create(
    name="fraud-detect-bfsi",
    model="llama-4-maverick",
    gpu="H100",
    replicas=(1, 4),
    region="HAN-1",
)
stream = client.chat.stream(
    endpoint=ep.name,
    messages=[{"role": "user", "content": "Bạn có khỏe không?"}],
)
for chunk in stream:
    print(chunk.choices[0].delta.content, end="", flush=True)'),
  ('typescript', 'import { DDI } from "@fpt-ddi/sdk";

const ddi = new DDI({ apiKey: process.env.FPT_DDI_KEY });

const ep = await ddi.endpoints.create({
  name: "fraud-detect-bfsi",
  model: "llama-4-maverick",
  gpu: "H100",
  replicas: [1, 4],
  region: "HAN-1",
});

const stream = await ddi.chat.stream({
  endpoint: ep.name,
  messages: [{ role: "user", content: "Bạn có khỏe không?" }],
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}'),
  ('go', 'package main

import (
    "context"
    "fmt"
    "fpt.ai/ddi-go"
)

func main() {
    client := ddi.New(os.Getenv("FPT_DDI_KEY"))
    ctx := context.Background()
    ep, _ := client.Endpoints.Create(ctx, &ddi.EndpointSpec{
        Name:  "fraud-detect-bfsi",
        Model: "llama-4-maverick",
        GPU:   "H100",
        Region: "HAN-1",
    })
    fmt.Printf("endpoint %s is %s", ep.Name, ep.Status)
}'),
  ('rust', 'use fpt_ddi::DDI;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = DDI::from_env()?;

    let ep = client
        .endpoints()
        .create("fraud-detect-bfsi", "llama-4-maverick", "H100")
        .region("HAN-1")
        .send()
        .await?;

    println!("endpoint {} is {}", ep.name, ep.status);
    Ok(())
}');

CREATE TABLE IF NOT EXISTS docs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  url TEXT NOT NULL
);
INSERT INTO docs (title, "desc", url) VALUES
  ('Quickstart', 'Deploy your first endpoint in 5 minutes', 'docs.ddi.fpt.vn/quickstart'),
  ('API reference', 'REST + streaming + batch + fine-tune', 'docs.ddi.fpt.vn/api'),
  ('OpenAI compatibility', 'Migrate from OpenAI / Together in ≤1 line', 'docs.ddi.fpt.vn/openai-compat'),
  ('Data residency', 'Nghị định 13/2023 — in-country storage & egress', 'docs.ddi.fpt.vn/residency'),
  ('CLI reference', 'Every fpt-ddi command', 'docs.ddi.fpt.vn/cli'),
  ('Webhooks & events', 'Endpoint lifecycle, batch, fine-tune events', 'docs.ddi.fpt.vn/webhooks');

-- Đánh dấu rằng migration đã chạy xong
CREATE TABLE IF NOT EXISTS _schema_version (
  version INT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO _schema_version (version) VALUES (1);
