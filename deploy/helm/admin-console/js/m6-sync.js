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
        <button data-tab="updates">Pending updates</button>
        <button data-tab="hfsync">HF Auto-sync</button>
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
      } else if (tab === "hfsync") {
        await this.loadHfSync(body);
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

  async loadHfSync(body) {
    const [runs, disc, health] = await Promise.all([
      api("GET", "/admin/catalog/sync-runs?limit=50"),
      api("GET", "/admin/catalog/discovered"),
      fetch("/health").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const runRows = runs.data || [];
    const discRows = disc.data || [];
    const worker = health && health.workers && health.workers.mcHfSync;
    const workerOn = !!(worker && worker.enabled);
    const lastRun = runRows[0];

    body.innerHTML = `
      <div class="panel">
        <div class="panel-row">
          <div>
            <div class="panel-title">HF Auto-sync</div>
            <div class="dim" style="font-size:12px;margin-top:4px">
              Tự động fetch model mới từ HuggingFace + kiểm tra revision theo định kỳ.
              Model phát hiện luôn tạo <b>draft</b> — cần người duyệt.
            </div>
          </div>
          <div class="btn-row" style="justify-content:flex-end">
            <button class="btn btn-ghost" id="btnHfRefresh">⟳ Refresh</button>
            <button class="btn btn-primary" id="btnHfRunNow">▶ Chạy ngay</button>
          </div>
        </div>
        <div class="kpi-row" style="margin-top:12px">
          <div class="kpi"><span class="kpi-label">WORKER</span><span class="kpi-value">${workerOn ? "ĐANG BẬT" : "TẮT"}</span><span class="kpi-delta">chu kỳ ${worker && worker.pollIntervalMs ? Math.round(worker.pollIntervalMs / 3600000) + "h" : "—"}</span></div>
          <div class="kpi"><span class="kpi-label">LẦN CHẠY CUỐI</span><span class="kpi-value">${lastRun ? timeAgo(lastRun.startedAt) : "—"}</span><span class="kpi-delta">${lastRun ? lastRun.discovered + " mới · " + lastRun.newRevisions + " rev · " + lastRun.errors + " lỗi" : "chưa chạy"}</span></div>
          <div class="kpi"><span class="kpi-label">PHÁT HIỆN</span><span class="kpi-value">${discRows.length}</span><span class="kpi-delta">draft từ HF</span></div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-title">Model mới phát hiện từ HuggingFace</div>
        ${discRows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Model</th><th>hf_model_id</th><th>Revision</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>${discRows.map((m) => `
            <tr>
              <td>${esc(m.displayName)}</td>
              <td class="mono dim">${esc(m.hfModelId)}</td>
              <td class="mono dim">${esc((m.revision || "main").slice(0, 12))}</td>
              <td class="dim">${timeAgo(m.hfLastCheckedAt || m.createdAt)}</td>
              <td class="btn-row" style="justify-content:flex-end">
                <a class="btn btn-sm" href="#/entry/${encodeURIComponent(m.id)}">Xem & duyệt</a>
              </td>
            </tr>`).join("")}
          </tbody></table></div>`
          : `<div class="empty"><div class="big">🔍</div>Chưa có model nào được phát hiện.<br>Bấm "Chạy ngay" hoặc đợi chu kỳ định kỳ.</div>`}
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-title">Lịch sử lần chạy</div>
        ${runRows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Bắt đầu</th><th>Discovered</th><th>New rev</th><th>Errors</th><th>Thời lượng</th></tr></thead>
          <tbody>${runRows.map((r) => {
            const dur = r.startedAt && r.finishedAt ? Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)) + "s" : "—";
            return `<tr>
              <td class="dim">${timeAgo(r.startedAt)}</td>
              <td>${r.discovered}</td>
              <td>${r.newRevisions}</td>
              <td class="${r.errors ? "err" : ""}">${r.errors}</td>
              <td class="dim">${dur}</td>
            </tr>`;
          }).join("")}
          </tbody></table></div>`
          : `<div class="empty"><div class="big">🕐</div>Chưa có lần chạy nào.</div>`}
      </div>
    `;

    const refresh = () => this.load("hfsync");
    const runNow = document.getElementById("btnHfRunNow");
    if (runNow) runNow.onclick = async () => {
      runNow.disabled = true;
      runNow.textContent = "Đang chạy…";
      try {
        const r = await api("POST", "/admin/catalog/sync/run-now");
        toast(r.message || "Đã kích hoạt.", "ok");
      } catch (e) { toast(e.message, "error"); }
      setTimeout(() => { runNow.disabled = false; runNow.textContent = "▶ Chạy ngay"; refresh(); }, 2500);
    };
    const rf = document.getElementById("btnHfRefresh");
    if (rf) rf.onclick = refresh;
  },
};