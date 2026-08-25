"use strict";

// US-04 — Document extraction (mock OCR trong preview, giống vllm-adapter mock).
// Nhận file (text/JSON/PDF-mock), trích xuất trường theo doc_type,
// guardrails y tế (redact nếu gặp thông tin nhạy cảm), ghi audit_log.

const cfg = require("./config");
const store = require("./store");
const audit = require("../audit/store");

// Trường trích xuất theo doc_type
const CONTRACT_FIELDS = ["party_name", "policy_number", "sum_insured", "term_start", "term_end", "premium", "insurer"];
const CLAIM_FIELDS = ["claim_number", "claimant_name", "incident_date", "amount_claimed", "status"];

// Patterns trích xuất (mock — regex trên text, hỗ trợ cả tiếng Anh/Việt)
const FIELD_PATTERNS = {
  party_name: [/party name:\s*(.+)/i, /insured party:\s*(.+)/i, /bên được bảo hiểm:\s*(.+)/i],
  policy_number: [/policy number:\s*(.+)/i, /policy no:?\s*(.+)/i, /số hợp đồng:\s*(.+)/i],
  sum_insured: [/sum insured:\s*([\d.,]+)/i, /số tiền bảo hiểm:\s*([\d.,]+)/i],
  term_start: [/term start:\s*(.+)/i, /effective date:\s*(.+)/i, /ngày hiệu lực:\s*(.+)/i],
  term_end: [/term end:\s*(.+)/i, /expiry date:\s*(.+)/i, /ngày hết hạn:\s*(.+)/i],
  premium: [/premium:\s*([\d.,]+)/i, /phí bảo hiểm:\s*([\d.,]+)/i],
  insurer: [/insurer:\s*(.+)/i, /insurance company:\s*(.+)/i, /công ty bảo hiểm:\s*(.+)/i],
  claim_number: [/claim number:\s*(.+)/i, /claim no:?\s*(.+)/i, /số yêu cầu bồi thường:\s*(.+)/i],
  claimant_name: [/claimant name:\s*(.+)/i, /claimant:\s*(.+)/i, /người yêu cầu bồi thường:\s*(.+)/i],
  incident_date: [/incident date:\s*(.+)/i, /ngày sự kiện:\s*(.+)/i],
  amount_claimed: [/amount claimed:\s*([\d.,]+)/i, /số tiền yêu cầu:\s*([\d.,]+)/i],
  status: [/status:\s*(.+)/i, /trạng thái:\s*(.+)/i],
};

// Patterns y tế nhạy cảm (FR-SEG-005.2) — gặp → redact + redacted=true
const MEDICAL_PATTERNS = [
  /\bdiagnosis\b/i, /\bprescription\b/i, /bệnh án/i, /chẩn đoán/i,
  /medical record/i, /medical history/i, /tiền sử bệnh/i,
  /\bmedication\b/i, /\bdosage\b/i,
  /\bcancer\b/i, /\btumor\b/i, /\bhiv\b/i, /\baids\b/i, /\bdiabetes\b/i,
];

// Tỉ lệ byte không in được cao → file binary (không đọc được)
function isBinary(buf) {
  const sample = buf.slice(0, 8000);
  if (!sample.length) return true;
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    const printable = (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 128);
    if (!printable) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.30;
}

function extractFromText(text, docType) {
  const fieldNames = docType === "claim" ? CLAIM_FIELDS : CONTRACT_FIELDS;
  const fields = {};
  for (const name of fieldNames) {
    const patterns = FIELD_PATTERNS[name] || [];
    let value = null;
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) { value = m[1].trim(); break; }
    }
    fields[name] = value;
  }
  return fields;
}

function extractFromJson(obj, docType) {
  const fieldNames = docType === "claim" ? CLAIM_FIELDS : CONTRACT_FIELDS;
  const fields = {};
  for (const name of fieldNames) {
    fields[name] = (obj && obj[name] != null) ? String(obj[name]) : null;
  }
  return fields;
}

// PDF mock — không parse thật; regex trên text nếu đọc được, không thì trả fields mẫu
function extractPdfMock(text, docType) {
  const fields = extractFromText(text, docType);
  const found = Object.values(fields).filter(Boolean).length;
  if (found === 0) {
    if (docType === "claim") {
      return { claim_number: "CLM-0000", claimant_name: "Sample Claimant", incident_date: "2026-01-01", amount_claimed: "0", status: "pending" };
    }
    return { party_name: "Sample Party", policy_number: "POL-0000", sum_insured: "0", term_start: "2026-01-01", term_end: "2026-12-31", premium: "0", insurer: "Sample Insurer" };
  }
  return fields;
}

function detectMedical(text) {
  const hits = [];
  for (const re of MEDICAL_PATTERNS) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}

// Redact toàn bộ field values khi tài liệu chứa thông tin y tế nhạy cảm
function redactFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = v == null ? null : "[REDACTED]";
  }
  return out;
}

// confidence = tỉ lệ trường có giá trị (trước khi redact)
function computeConfidence(fields) {
  const vals = Object.values(fields);
  const filled = vals.filter((v) => v != null && v !== "").length;
  return vals.length ? filled / vals.length : 0;
}

async function processJob(jobId) {
  const job = await store.getById(jobId);
  if (!job) throw new Error(`job ${jobId} không tồn tại`);
  await store.update(jobId, { status: "processing" });

  try {
    const buf = store.readFile(jobId, job.filename);
    if (!buf) throw new Error(`file "${job.filename}" không tìm thấy`);
    if (buf.length === 0) throw new Error("file rỗng — không có nội dung để trích xuất");
    if (isBinary(buf)) throw new Error("file không đọc được (nội dung binary)");

    const text = buf.toString("utf8");
    const docType = job.docType || "contract";
    let fields;
    const isPdf = /\.pdf$/i.test(job.filename) || text.startsWith("%PDF");
    const isJson = /^\s*[{[]/.test(text);
    if (isJson) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error("JSON không hợp lệ: " + e.message); }
      fields = extractFromJson(obj, docType);
    } else if (isPdf) {
      fields = extractPdfMock(text, docType);
    } else {
      fields = extractFromText(text, docType);
    }

    // confidence tính trên fields gốc (trước redact)
    const confidence = Math.round(computeConfidence(fields) * 10000) / 10000;

    // Guardrails y tế (FR-SEG-005.2) — che thông tin nhạy cảm
    const medicalHits = detectMedical(text);
    let redacted = false;
    if (medicalHits.length) {
      redacted = true;
      fields = redactFields(fields);
    }

    const updated = await store.update(jobId, {
      status: "completed",
      fields,
      confidence,
      redacted,
      error: null,
    });

    await audit.record({
      actor: "documents-worker", role: "system", action: "document.extract_completed",
      entityId: jobId, entityType: "document_job", result: "success",
      meta: { docType, filename: job.filename, confidence, redacted, medicalHits: medicalHits.length },
    });
    return updated;
  } catch (e) {
    await store.update(jobId, { status: "failed", error: e.message });
    await audit.record({
      actor: "documents-worker", role: "system", action: "document.extract_failed",
      entityId: jobId, entityType: "document_job", result: "failure",
      meta: { docType: job.docType, filename: job.filename, error: e.message },
    });
    throw e;
  }
}

module.exports = { processJob, CONTRACT_FIELDS, CLAIM_FIELDS, MEDICAL_PATTERNS, detectMedical, isBinary };