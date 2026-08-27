# Dev Readiness Review — Hệ thống Admin Model Catalog (DDI)

**Phiên bản:** 1.0
**Ngày:** 27/08/2026
**Trạng thái:** Draft — kết quả review
**Reviewer:** Solution Architect (BA)
**Câu hỏi cần trả lời:** Bộ tài liệu hiện có **đã đủ điều kiện để dev FE/BE bắt đầu phát triển chưa?**

---

## 1. Tiêu chí "dev-ready"

Một tính năng được coi là đủ điều kiện dev khi:

| # | Tiêu chí | Ý nghĩa |
|---|----------|---------|
| C1 | **Yêu cầu không mơ hồ** | Mỗi FR có tiêu chí chấp nhận đo được, dev không phải đoán |
| C2 | **Contract rõ** | API request/response, schema DB đủ để code mà không hỏi lại |
| **C3** | **Quyết định kiến trúc đã chốt** | Không còn ADR "chờ duyệt" ảnh hưởng đến code |
| C4 | **Môi trường + quyền truy cập** | Dev có môi trường dev, credential, quyền cần thiết |
| C5 | **Phụ thuộc bên ngoài đã xác nhận** | API hệ thống khác (BFF, HF, S3) đã xác nhận hành vi |
| C6 | **Tham chiếu UI** | Wireframe đủ để FE layout mà không cần hỏi BA mỗi màn |

---

## 2. Hồ sơ tài liệu

| # | Tài liệu | Trạng thái | Đánh giá |
|---|----------|:----------:|----------|
| 1 | `docs/brd-ddi-model-catalog-admin.md` | ✅ | Đủ — 5 quyết định đã chốt |
| 2 | `docs/srs-ddi-model-catalog-admin.md` | ✅ | Đủ — 14 FR + 9 NFR + AC |
| 3 | `docs/task-breakdown-ddi-model-catalog-admin.md` | ✅ | Đủ — 5 sprint, 238h |
| 4 | `docs/prototype-ddi-model-catalog-admin.md` | ✅ | Đủ — 7 màn hình wireframe + ma trận role |
| 5 | `docs/user-stories-ddi-model-catalog-admin.md` | ✅ | Đủ — 19 US + AC Given-When-Then |
| 6 | `docs/system-design-ddi-model-catalog-admin.md` | ✅ | Đủ — 5 ADR, API contract, DB schema, deployment |

---

## 3. Kiểm tra nhất quán xuyên tài liệu

| Điểm kiểm tra | Kết quả |
|---------------|:-------:|
| 14 FR trong SRS đều có user story bao phủ | ✅ (ma trận traceability US ↔ FR) |
| 14 FR đều có task trong breakdown | ✅ (map task ↔ FR) |
| 7 màn hình prototype đều có API contract tương ứng | ✅ |
| 5 quyết định BRD (1 cấp duyệt, tách catalog, giá thủ công, auto-sync, mirror S3) nhất quán trong SRS/US/Design | ✅ |
| DB schema (mc_*) khớp data dictionary SRS | ✅ |
| API contract BE khớp màn hình FE (mọi nút/hành động trong prototype có endpoint) | ✅ |
| Migration numbering (015, 016) không đụng 001–014 hiện có | ✅ |
| Redis (cache HF metadata) có trong Helm values (values.yaml, fpt-dev, prod, deploy) | ✅ |
| Caddyfile: `/v1/*` đã proxy backend:3000 → endpoint `/v1/admin/catalog/*` chạy ngay | ✅ |

**Kết luận:** 6 tài liệu **nhất quán với nhau**, không phát hiện mâu thuẫn yêu cầu.

---

## 4. Đánh giá sẵn sàng theo vai trò

### 4.1 FE Developer

| Hạng mục | Trạng thái | Ghi chú |
|----------|:----------:|---------|
| Wireframe 7 màn hình (M1–M7) | ✅ | Có layout, cột bảng, modal, empty state |
| API contract BE (`/v1/admin/catalog/*`) | ✅ | 17 endpoint + shape response chuẩn |
| Badge legend + ma trận quyền theo role | ✅ | Prototype §1.3, §1.4 |
| Edge cases UI (E1–E10) | ✅ | Prototype §10 |
| Theme/styling | ✅ | Tái dụng styles.css partner-console |
| **Bắt đầu dev được ngay?** | ✅ **CÓ** | Dev FE mock BE theo contract, không chặn bởi gì |

**Điểm trừ (không chặn):**
- Chưa có error code catalog chi tiết (chưa có bảng mã lỗi chuẩn) — FE xử lý theo `error.code` + `error.message` tổng quát, bổ sung bảng mã trong tuần đầu.

### 4.2 BE Developer

| Hạng mục | Trạng thái | Ghi chú |
|----------|:----------:|---------|
| Module structure + patterns (khớp src/* hiện có) | ✅ | System design §3.2 |
| DB schema + migration plan | ✅ | 4 bảng mc_*, index rõ |
| API contract (17 endpoint) | ✅ | Method, path, role, FR |
| Mirror pull: tái dụng byom/processor.js | ✅ | ADR-002 |
| Audit append-only (DB grant) | ✅ | §3.3 |
| **BFF service credential + scope** | 🔴 **CHƯA** | Open item #1 — publish.js không test được |
| **Hành vi idempotent của BFF `model-catalog-create`** | 🔴 **CHƯA** | Open item #1 — thiết kế publish phụ thuộc |
| **Cơ chế role trong JWT claims** | 🔴 **CHƯA** | Open item #3 — rbac.js không chốt được |
| **Response shape thực tế của BFF API** | 🔴 **CHƯA** | Postman collection có response trống — cần 1 response mẫu thật |
| **S3 access (bucket + credential)** | 🟡 **CHƯA** | Open item #2 — endpoint gợi ý: `s3-han02.fptcloud.com` (thấy trong CSP Caddyfile) |
| **Mapping field HF API → catalog fields** | 🟡 **CHƯA** | Chưa có bảng mapping cụ thể (VD: `cardData.license` → `license`?) |

---

## 5. Blockers (P0) — phải giải quyết trong tuần đầu dev

| # | Blocker | Chặn gì | Chủ sở hữu | Cách giải quyết |
|---|---------|---------|------------|-----------------|
| B1 | BFF service credential + scope `ddi.model-catalog-*` | BE: publish.js (T3.1) | Team BFF/Portal + PO | Request credential trong tuần 1; dev trước với mock BFF |
| B2 | Xác nhận BFF `model-catalog-create` idempotent (gọi lại cùng `id` = update?) | BE: publish design (ADR-001) | Team BFF | Test 1 request thật trên stg; nếu không idempotent → publish luôn dùng `update` sau `create` |
| B3 | Cơ chế cấp role `catalog_admin`/`catalog_approver` trong JWT | BE: rbac.js (T1.2) | Team Auth + PO | Xác nhận claim name; fallback: bảng mapping role trong BE |
| B4 | Response shape thật của BFF (list/get model) | BE: publish.js; FE: (không chặn — FE gọi BE) | Team BFF | Chạy 1 request thật, lưu response mẫu vào tài liệu |

> **Chiến lược:** B1–B4 **không chặn start dev** — BE dev mock BFF (stub) trong tuần 1–2, song song PO request credential/xác nhận. Chỉ chặn **integration test** (T3.6, T4.1).

## 6. Gaps không chặn (P1/P2) — xử lý trong quá trình dev

| # | Gap | Mức | Xử lý |
|---|-----|:---:|-------|
| G1 | **Catalog proprietary phía khách**: BFF catalog không có khái niệm `catalog_type` — khách whitelist xem model proprietary qua cơ chế nào? | P1 | **Đề xuất Phase 1:** entry proprietary **không publish** sang BFF (chỉ tồn tại trong admin + sau này expose qua API nội bộ riêng). Cần PO xác nhận trong tuần 1 |
| G2 | Concurrent edit (edge case E9) — chưa có field `version` cho optimistic locking | P2 | Thêm `version INT` vào `mc_entries` ở migration 015 (rẻ, làm luôn) |
| G3 | Bảng error code catalog chuẩn | P2 | BE dev đề xuất bảng mã trong tuần 1, BA review |
| G4 | Mapping field HF API → catalog fields chưa cụ thể | P1 | BE dev viết bảng mapping trong T2.3 (spike 2h gọi HF API thật) |
| G5 | Caddy: cần thêm `handle /admin/*` serve static admin-console (handler hiện tại fallback /index.html = partner console) | P2 | Thêm 1 block handle trong Caddyfile (task T4.1) |
| G6 | CSP Caddyfile đã có `connect-src … huggingface.co` — thừa (BE fetch HF, FE không cần) nhưng không hại | P3 | Không cần làm |

---

## 7. Verdict

### **ĐỦ ĐIỀU KIỆN CÓ ĐIỀU KIỆN (Conditionally Ready)**

| Vai trò | Verdict | Ghi chú |
|---------|:-------:|---------|
| **FE dev** | ✅ **Bắt đầu ngay** | Contract + wireframe đầy đủ; mock BE theo `/v1/admin/catalog/*` |
| **BE dev** | ✅ **Bắt đầu ngay (mock BFF)** | S1 (migration, audit, worker) + phần lớn S2 không phụ thuộc BFF; integration chờ B1–B4 |
| **Toàn hệ thống** | 🟡 **Có điều kiện** | 4 blockers P0 (B1–B4) phải close trong **tuần 1** để không chặn integration test T3.6/T4.1 |

### Điều kiện đi kèm

1. **PO action (tuần 1):** request BFF service credential (B1), xác nhận idempotency (B2) + response mẫu (B4) với team BFF; xác nhận JWT role (B3) với team auth; chốt G1 (proprietary không publish) — tổng 4 email/đồng bộ, không cần chờ.
2. **BE dev action (tuần 1):** spike 2h gọi HF API thật → bảng mapping (G4); stub BFF cho test.
3. **Ops action (trước T4.1):** bucket S3 + credential (G5 liên quan), egress HF.

---

## 8. Đề xuất: thêm Sprint 0 (1 tuần, song song)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T0.1: Spike HF API — gọi 3 model thật, lập bảng mapping field | 4 | — | G4 |
| T0.2: Spike BFF — 1 request create/list thật trên stg, ghi response mẫu + xác nhận idempotency | 4 | B1 | B2, B4 |
| T0.3: Stub BFF (mock server) cho BE test | 6 | — | Giải phóng T3.1, T3.6 |
| T0.4: Migration 015/016 + bảng mc_* (làm trước, không phụ thuộc gì) | 8 | — | T1.1 kéo lên |
| T0.5: Request credential/role (PO) | — | — | B1, B3 |

**Cộng Sprint 0: ~22 giờ** — chạy song song với FE dev (FE không phụ thuộc Sprint 0).

---

## 9. Checklist bàn giao dev (final)

- [x] BRD + 5 quyết định chốt
- [x] SRS 14 FR + 9 NFR + AC đo được
- [x] Prototype 7 màn hình + ma trận role + 10 edge cases
- [x] 19 user stories + AC Given-When-Then + 19 business rules
- [x] System design: 5 ADR + API contract 17 endpoint + DB schema + deployment
- [x] Task breakdown 5 sprint + 238h + milestones
- [x] Dev readiness review (tài liệu này) + Sprint 0
- [ ] **PO: close B1–B4 trong tuần 1** (điều kiện duy nhất còn lại)