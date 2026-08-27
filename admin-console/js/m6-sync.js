/* M6 — Sync & Mirror: bảng mirror jobs (progress, retry, cancel) + pending updates (Phase 2). */
"use strict";

const M6 = {
  timer: null,

  async render(view) {
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Sync & Mirror</h1><div class="sub">Theo dõi pull weights về mirror nội bộ</div></div>
        <button class="btn btn-ghost" id="btnRefresh">⟳ Refresh</button>
      </div>
      <div class="tabs" id="sTabs">
        <button data-tab="jobs" class="active">Mirror jobs</button>
        <button data-tab="updates">Pending updates (Phase 2)</button>
      </div>
      <div id="sBody"></div>
    `;
    document.querySelectorAll("#sTabs button").forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll("#sTabs button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        this.load(b.dataset.tab);
      };
    });
    document.getElementById("btnRefresh").onclick = () => this.load(document.querySelector("#sTabs .active").dataset.tab);
    this.load("jobs");
    this.timer = setInterval(() => this.load(document.querySelector("#sTabs .active")?.dataset.tab || "jobs"), 5000);
  },

  destroy() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  async load(tab) {
    const body = document.getElementById("sBody");
    if (!body) return;
    try {
      if (tab === "jobs") {
        const r = await api("GET", "/admin/catalog/mirror-jobs?limit=100");
        const rows = r.data || [];
        body.innerHTML = rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Model</th><th>Revision</th><th>Tiến độ</th><th>Trạng thái</th><th>Lần thử</th><th>Lỗi</th><th></th></tr></thead>
          <tbody>${rows.map((j) => `
            <tr>
              <td>${esc(j.displayName)}<div class="dim mono">${esc(j.hfModelId)}</div></td>
              <td class="mono dim">${esc((j.revision || "main").slice(0, 12))}</td>
              <td style="min-width:140px">${progressBar(j.progressPct)}<span class="dim" style="font-size:11px">${j.progressPct}%</span></td>
              <td>${badge(j.status, STATUS_LABELS[j.status])}</td>
              <td>${j.attempts}</td>
              <td class="dim" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(j.error || "")}">${esc(j.error || "—")}</td>
              <td class="btn-row" style="justify-content:flex-end">
                ${j.status === "failed" ? `<button class="btn btn-sm" data-retry="${j.id}">Retry</button>` : ""}
                ${["queued", "downloading"].includes(j.status) ? `<button class="btn btn-sm btn-danger" data-cancel="${j.id}">Hủy</button>` : ""}
              </td>
            </tr>`).join("")}
          </tbody></table></div>`
          : `<div class="table-wrap"><div class="empty"><div class="big">📦</div>Chưa có mirror job nào.<br>Job được tạo tự động khi entry được approve.</div></div>`;
        body.querySelectorAll("[data-retry]").forEach((b) => {
          b.onclick = async () => {
            try { await api("POST", `/admin/catalog/mirror-jobs/${b.dataset.retry}/retry`); toast("Đã xếp lại queue.", "ok"); this.load("jobs"); }
            catch (e) { toast(e.message, "error"); }
          };
        });
        body.querySelectorAll("[data-cancel]").forEach((b) => {
          b.onclick = async () => {
            const ok = await confirmModal("Hủy mirror job?", "Job sẽ dừng, trạng thái weights về not_mirrored.", { confirmLabel: "Hủy job" });
            if (!ok) return;
            try { await api("POST", `/admin/catalog/mirror-jobs/${b.dataset.cancel}/cancel`); toast("Đã hủy.", "ok"); this.load("jobs"); }
            catch (e) { toast(e.message, "error"); }
          };
        });
      } else {
        const r = await api("GET", "/admin/catalog/pending-updates");
        const rows = r.data || [];
        body.innerHTML = rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Model</th><th>Revision cũ → mới</th><th>Phát hiện</th><th></th></tr></thead>
          <tbody>${rows.map((u) => `
            <tr>
              <td>${esc(u.displayName)}</td>
              <td class="mono dim">${esc((u.oldRevision || "—").slice(0, 8))} → ${esc((u.newRevision || "—").slice(0, 8))}</td>
              <td class="dim">${timeAgo(u.detectedAt)}</td>
              <td class="btn-row" style="justify-content:flex-end">
                <button class="btn btn-sm btn-primary" data-app="${u.id}">Approve</button>
                <button class="btn btn-sm btn-danger" data-rej="${u.id}">Reject</button>
              </td>
            </tr>`).join("")}
          </tbody></table></div>`
          : `<div class="table-wrap"><div class="empty"><div class="big">🔄</div>Chưa có đề xuất revision mới.<br>Auto-sync chạy hàng ngày (Phase 2).</div></div>`;
        body.querySelectorAll("[data-app]").forEach((b) => {
          b.onclick = async () => {
            try { await api("POST", `/admin/catalog/pending-updates/${b.dataset.app}/approve`); toast("Đã approve — đang re-mirror.", "ok"); this.load("updates"); }
            catch (e) { toast(e.message, "error"); }
          };
        });
        body.querySelectorAll("[data-rej]").forEach((b) => {
          b.onclick = async () => {
            try { await api("POST", `/admin/catalog/pending-updates/${b.dataset.rej}/reject`); toast("Đã reject.", "ok"); this.load("updates"); }
            catch (e) { toast(e.message, "error"); }
          };
        });
      }
    } catch (e) {
      body.innerHTML = `<div class="banner error">${esc(e.message)}</div>`;
    }
  },
};