/* FPT DDI Model Catalog Admin — UI helpers (toast, modal, badge, escape). */
"use strict";

function toast(msg, kind) {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

const _ESC_MAP = { "&": "\u0026amp;", "<": "\u0026lt;", ">": "\u0026gt;", '"': "\u0026quot;", "'": "\u0026#39;" };
function esc(s) {
  return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => _ESC_MAP[c]);
}

function badge(status, label) {
  return `<span class="badge badge--${esc(status)}">${esc(label || status)}</span>`;
}

const STATUS_LABELS = {
  draft: "draft", pending_review: "pending review", active: "active", inactive: "inactive",
  not_mirrored: "not mirrored", mirroring: "mirroring", mirrored: "mirrored", mirror_failed: "mirror failed",
  queued: "queued", downloading: "downloading", failed: "failed", cancelled: "cancelled", mirrored: "mirrored",
};

function money(v) {
  if (v === null || v === undefined) return "—";
  return "$" + Number(v).toFixed(2);
}

function timeAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* Modal xác nhận — trả Promise<true/false> */
function confirmModal(title, body, { confirmLabel = "Xác nhận", danger = false } = {}) {
  return new Promise((resolve) => {
    const host = document.getElementById("modalHost");
    const t = document.getElementById("modalTitle");
    const b = document.getElementById("modalBody");
    const cancel = document.getElementById("modalCancel");
    const confirm = document.getElementById("modalConfirm");
    t.textContent = title;
    b.textContent = body;
    confirm.textContent = confirmLabel;
    confirm.className = "btn " + (danger ? "btn-danger" : "btn-primary");
    host.hidden = false;
    const close = (val) => {
      host.hidden = true;
      cancel.onclick = null;
      confirm.onclick = null;
      resolve(val);
    };
    cancel.onclick = () => close(false);
    confirm.onclick = () => close(true);
    host.querySelector(".modal-backdrop").onclick = () => close(false);
  });
}

/* Progress bar HTML */
function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `<div class="progress"><div class="bar" style="width:${p}%"></div></div>`;
}