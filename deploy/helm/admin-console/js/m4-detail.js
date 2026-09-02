/* M4 — Entry Detail: tabs Details/Hardware/History/Mirror + panel duyệt (approve/reject). */
"use strict";

const M4 = {
  entry: null,

  async render(view, params, id) {
    this.entry = null;
    view.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    let data;
    try {
      const r = await api("GET", `/admin/catalog/entries/${id}`);
      data = r.data;
    } catch (e) {
      view.innerHTML = `<div class="banner error">${esc(e.message)}</div><a class="btn btn-ghost" href="#/">← Quay lại</a>`;
      return;
    }
    this.entry = data;
    this.renderView(view, data);
  },

  renderView(view, e) {
    const isApprover = window.MC_ROLE && ["admin", "approver"].includes(window.MC_ROLE);
    const isAdmin = window.MC_ROLE === "admin";
    view.innerHTML = `
      <a class="btn btn-ghost" href="#/">← Quay lại</a>
      <div class="detail-head mt8">
        <h1>${esc(e.displayName)}</h1>
        ${badge(e.status, STATUS_LABELS[e.status])}
        ${badge(e.weightStatus, STATUS_LABELS[e.weightStatus])}
        ${badge(e.catalogType)}
      </div>
      <div class="detail-meta">${esc(e.id)} · hf: ${esc(e.hfModelId)} · revision: ${esc(e.revision || "—")} · tạo bởi ${esc(e.createdBy)} · v${e.version}</div>

      ${(e.status === "draft" || e.status === "inactive") && e._rejectReason ? `<div class="banner warn">Lý do từ chối gần nhất: ${esc(e._rejectReason)}</div>` : ""}

      <div class="tabs" id="dTabs">
        <button data-tab="details" class="active">Details</button>
        <button data-tab="hardware">Hardware (${e.hardwareProfiles.length})</button>
        <button data-tab="history">History</button>
        <button data-tab="mirror">Mirror</button>
      </div>
      <div id="dTabBody"></div>

      ${e.status === "pending_review" && isApprover ? `
      <div class="approval-panel">
        <h3>⚖ Panel duyệt — entry đang chờ duyệt</h3>
        <textarea id="rejectReason" placeholder="Lý do từ chối (bắt buộc khi Reject, ≥ 5 ký tự)…"></textarea>
        <div class="btn-row">
          <button class="btn btn-danger" id="btnReject">Reject</button>
          <span style="flex:1"></span>
          <button class="btn btn-primary" id="btnApprove">Approve</button>
        </div>
      </div>` : ""}

      <div class="btn-row mt16" id="dActions">
        ${e.status === "draft" && isAdmin ? `<button class="btn btn-primary" id="btnSubmit">Submit để duyệt</button>` : ""}
        ${(e.status === "draft" || e.status === "inactive") && isAdmin ? `<button class="btn" id="btnEdit">Sửa</button>` : ""}
        ${e.status === "active" && isAdmin ? `<button class="btn btn-danger" id="btnDisable">Disable</button>` : ""}
        ${e.status === "inactive" && isAdmin ? `<button class="btn" id="btnEnable">Enable</button>` : ""}
        ${e.status === "draft" && isAdmin ? `<button class="btn btn-danger" id="btnDelete">Xóa</button>` : ""}
      </div>
    `;

    document.querySelectorAll("#dTabs button").forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll("#dTabs button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        this.renderTab(b.dataset.tab);
      };
    });
    this.renderTab("details");

    const bind = (idFn, fn) => { const el = idFn(); if (el) el.onclick = fn; };
    bind(() => document.getElementById("btnSubmit"), async () => {
      try { await api("POST", `/admin/catalog/entries/${e.id}/submit`); toast("Đã submit.", "ok"); this.refresh(); }
      catch (err) { toast(err.message, "error"); }
    });
    bind(() => document.getElementById("btnEdit"), () => { location.hash = `#/entry/${e.id}?edit=1`; });
    bind(() => document.getElementById("btnDisable"), async () => {
      const ok = await confirmModal("Disable model?", "Model sẽ ẩn khỏi catalog khách. Endpoint đang chạy vẫn hoạt động.", { confirmLabel: "Disable" });
      if (!ok) return;
      try { await api("POST", `/admin/catalog/entries/${e.id}/disable`); toast("Đã disable.", "ok"); this.refresh(); }
      catch (err) { toast(err.message, "error"); }
    });
    bind(() => document.getElementById("btnEnable"), async () => {
      try { await api("POST", `/admin/catalog/entries/${e.id}/enable`); toast("Đã enable.", "ok"); this.refresh(); }
      catch (err) { toast(err.message, "error"); }
    });
    bind(() => document.getElementById("btnDelete"), async () => {
      const ok = await confirmModal("Xóa entry?", "Hành động không thể hoàn tác.", { confirmLabel: "Xóa", danger: true });
      if (!ok) return;
      try { await api("DELETE", `/admin/catalog/entries/${e.id}`); toast("Đã xóa.", "ok"); location.hash = "#/"; }
      catch (err) { toast(err.message, "error"); }
    });
    bind(() => document.getElementById("btnApprove"), async () => {
      try {
        const r = await api("POST", `/admin/catalog/entries/${e.id}/approve`);
        toast(`Đã approve. Publish: ${r.publish && r.publish.ok ? (r.publish.dryRun ? "dry-run" : "ok") : "FAIL"}.`, r.publish && r.publish.ok ? "ok" : "error");
        this.refresh();
      } catch (err) { toast(err.message, "error"); }
    });
    bind(() => document.getElementById("btnReject"), async () => {
      const reason = document.getElementById("rejectReason").value.trim();
      if (reason.length < 5) { toast("Lý do từ chối bắt buộc (≥ 5 ký tự).", "error"); return; }
      try { await api("POST", `/admin/catalog/entries/${e.id}/reject`, { reason }); toast("Đã reject.", "ok"); this.refresh(); }
      catch (err) { toast(err.message, "error"); }
    });
  },

  refresh() {
    const id = this.entry.id;
    api("GET", `/admin/catalog/entries/${id}`).then((r) => this.renderView(document.getElementById("view"), r.data)).catch(() => {});
  },

  renderTab(tab) {
    const e = this.entry;
    const body = document.getElementById("dTabBody");
    if (!body) return;
    if (tab === "details") {
      body.innerHTML = `<div class="form-panel"><table class="kv">
        <tr><td>id</td><td class="mono">${esc(e.id)}</td></tr>
        <tr><td>hf_model_id</td><td class="mono">${esc(e.hfModelId)}</td></tr>
        <tr><td>revision</td><td class="mono">${esc(e.revision || "—")}</td></tr>
        <tr><td>catalog_type</td><td>${badge(e.catalogType)}</td></tr>
        <tr><td>short_description</td><td>${esc(e.shortDescription || "—")}</td></tr>
        <tr><td>parameters</td><td>${esc(e.parametersDisplay || "—")}</td></tr>
        <tr><td>context_length</td><td>${esc(e.contextLengthDisplay || "—")}</td></tr>
        <tr><td>license</td><td>${esc(e.license)}</td></tr>
        <tr><td>badge</td><td>${esc(e.badgeCode || "—")}</td></tr>
        <tr><td>categories</td><td>${(e.categories || []).map(esc).join(", ") || "—"}</td></tr>
        <tr><td>from_price</td><td>${money(e.fromPrice)}</td></tr>
        <tr><td>sort_order</td><td>${e.sortOrder}</td></tr>
        <tr><td>sync_enabled</td><td>${e.syncEnabled ? "bật" : "tắt"}</td></tr>
        <tr><td>published_at</td><td>${timeAgo(e.publishedAt)}</td></tr>
        <tr><td>created_at</td><td>${timeAgo(e.createdAt)}</td></tr>
      </table></div>`;
    } else if (tab === "hardware") {
      body.innerHTML = `<div class="form-panel"><div class="table-wrap"><table>
        <thead><tr><th>GPU SKU</th><th>GPUs/instance</th><th>Precision</th><th>VRAM (GB)</th><th>Giá USD/GPU/h</th><th>Recommended</th></tr></thead>
        <tbody>${(e.hardwareProfiles || []).map((p) => `
          <tr><td class="mono">${esc(p.gpu_sku_code)}</td><td>${p.gpus_per_instance}</td><td>${esc(p.precision)}</td>
          <td>${p.vram_required_gb ?? "—"}</td><td>$${((p.per_gpu_hourly_price_usd_micros || 0) / 1e6).toFixed(2)}</td>
          <td>${p.is_recommended ? "✓" : ""}</td></tr>`).join("")}
        </tbody></table></div></div>`;
    } else if (tab === "history") {
      body.innerHTML = `<div class="form-panel"><div class="table-wrap"><table>
        <thead><tr><th>Thời gian</th><th>Người</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
        <tbody>${(e.history || []).map((h) => `
          <tr><td class="dim">${timeAgo(h.ts)}</td><td class="mono">${esc(h.actor)}</td><td>${esc(h.action)}</td>
          <td class="mono dim" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(JSON.stringify(h.meta || {}))}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Chưa có lịch sử.</td></tr>`}
        </tbody></table></div></div>`;
    } else if (tab === "mirror") {
      body.innerHTML = `<div class="form-panel">
        <table class="kv">
          <tr><td>Trạng thái weights</td><td>${badge(e.weightStatus, STATUS_LABELS[e.weightStatus])}</td></tr>
          <tr><td>Mirror path</td><td class="mono">${esc(e.mirrorPath || "—")}</td></tr>
          <tr><td>Checksum</td><td class="mono">${esc(e.mirrorChecksum || "—")}</td></tr>
          <tr><td>Sync revision</td><td>${e.syncEnabled ? "bật (hàng ngày)" : "tắt"}</td></tr>
        </table>
        <div class="hint mt8">Weights được pull từ HF về mirror nội bộ khi entry được approve. Entry chỉ hiển thị cho khách khi Mirrored.</div>
      </div>`;
    }
  },
};