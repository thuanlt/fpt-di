# Task Breakdown + Ước công — Hệ thống Admin Model Catalog (DDI)

**Phiên bản:** 1.0
**Ngày:** 27/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Căn cứ:** `docs/srs-ddi-model-catalog-admin.md` (14 FR + 9 NFR), `docs/brd-ddi-model-catalog-admin.md`
**Phạm vi:** Phase 1 (MVP) + Phase 2. Tái sử dụng API BFF DDI hiện có (folder 9. Model Catalog (Admin)).

---

## Nguyên tắc tách task

- **Tái sử dụng trước** — mọi CRUD catalog đi qua endpoint BFF có sẵn (`model-catalog-*`), chỉ build phần **gap**.
- **Xếp theo phụ thuộc** — backend foundation trước (migration, RBAC, audit), sau đó UI, cuối cùng approval + mirror.
- **Mỗi task ≤ 16 giờ**, có tiêu chí hoàn thành (definition of done).
- Ước công tính theo **1 dev full-time** (8h/ngày); có thể chạy song song 2 dev (frontend + backend) để rút ngắn.

---

## Phase 1 — MVP (HF + manual + approval + mirror + RBAC)

### Sprint 1 — Backend foundation: status, RBAC, audit (tuần 1-2)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T1.1: Migration DB — mở rộng `status_code` (draft/pending_review/inactive) + thêm `catalog_type`, `weight_status`, `mirror_path`, `mirror_checksum`, `revision`, `sync_enabled` | 8 | — | ALTER TABLE cho bảng catalog model; default `draft`; backward-compatible với entry `active` hiện có |
| T1.2: RBAC roles `catalog_admin` + `catalog_approver` trong BFF | 8 | — | Gán role qua JWT claims; middleware chặn 403 cho role không đủ; `catalog_admin` tạo/sửa, `catalog_approver` duyệt |
| T1.3: Audit log service (append-only) | 10 | T1.1 | Bảng audit log; ghi mọi CRUD + duyệt (ai, khi nào, trường cũ → mới); không có endpoint sửa/xóa log |
| T1.4: Guard delete/disable ở BFF | 6 | T1.1 | Entry `active` chỉ được disable (set `inactive`), không delete; delete chỉ cho `draft`; cảnh báo khi entry có endpoint active |
| T1.5: Test Sprint 1 (migration, RBAC 403, audit append-only, guard delete) | 8 | T1.1-T1.4 | Test tự động + test phân quyền (user không role → 403; creator không tự duyệt) |

**Cộng sprint 1: ~40 giờ (~5 ngày dev).**

### Sprint 2 — Admin UI: danh sách + form nhập (tuần 3-4)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T2.1: Màn hình danh sách catalog (list) | 10 | T1.1 | Gọi `model-catalog-list`; cột theo FR-MC-001.1; lọc status/category/query; phân trang; tab Public/Proprietary (FR-MC-009.2) |
| T2.2: Form nhập model manual | 12 | T1.2 | Form đầy đủ fields (id, hf_model_id bắt buộc, display_name, license, categories, hardware_profiles, benchmarks, from_price); validate client + server; gọi `model-catalog-create` |
| T2.3: HF fetch service (backend) | 8 | — | Gọi HF Hub API theo `hf_model_id`; validate repo + `config.json`; prefill metadata (display_name, parameters, context length, license); rate-limit backoff; timeout ≤ 10s (NFR-MC-005) |
| T2.4: Form nhập model từ HF | 12 | T2.3 | Nhập repo ID → prefill form → admin bổ sung GPU profile/giá → submit; lỗi HF hiển thị ≤ 5s (FR-MC-002.2) |
| T2.5: Màn hình quản lý Category | 6 | — | Reuse `model-catalog-category-*`; chặn xóa category đang có model (FR-MC-014.3) |
| T2.6: Test UI Sprint 2 (Playwright) | 8 | T2.1-T2.5 | Test: tạo manual → hiện trong list; nhập HF repo hợp lệ/lỗi; phân trang; lọc |

**Cộng sprint 2: ~56 giờ (~7 ngày dev).**

### Sprint 3 — Approval workflow + Mirror pull (tuần 5-6)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T3.1: Endpoint submit/approve/reject (BFF) | 8 | T1.1, T1.2 | `model-catalog-submit` (draft → pending_review), `model-catalog-approve` (→ active), `model-catalog-reject` (→ draft + lý do bắt buộc); chặn creator tự duyệt (FR-MC-005.5) |
| T3.2: UI duyệt entry | 8 | T3.1 | Danh sách pending_review; chi tiết entry; nút approve/reject + lý do; chỉ hiện cho role `catalog_approver` |
| T3.3: Mirror pull service | 16 | T1.1 | Pull weights từ HF về S3 nội bộ theo `hf_model_id` + revision; tiến trình queued → downloading → mirrored → failed; retry 3 lần; checksum SHA-256; path `s3://<bucket>/ddi-models/{hf_model_id}/{revision}/` (FR-MC-012) |
| T3.4: State machine weight_status + gate active | 8 | T3.3 | Entry chỉ active khi `weight_status=mirrored`; `mirror_failed` ẩn khỏi khách, hiện lý do cho admin; reset về mirroring khi đổi revision (FR-MC-013) |
| T3.5: Màn hình theo dõi mirror | 6 | T3.3 | Progress bar pull, trạng thái, nút retry khi failed, lý do lỗi |
| T3.6: Test Sprint 3 (approval + mirror) | 10 | T3.1-T3.5 | Test: submit → approve → pull → active; reject → draft + lý do; pull fail → retry → mirror_failed; entry chưa mirrored không deploy được |

**Cộng sprint 3: ~56 giờ (~7 ngày dev).**

### Sprint 4 — Tích hợp + UAT (tuần 7)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T4.1: Test end-to-end full flow | 10 | Sprint 1-3 | Tạo model (HF + manual) → submit → approve → mirror → active → khách thấy trong catalog → deploy endpoint |
| T4.2: Test NFR (hiệu năng, bảo mật) | 8 | T4.1 | Danh sách ≤ 2s với 5.000 entry (NFR-MC-001); RBAC 403 (NFR-MC-003); audit log không sửa được (NFR-MC-004); HF timeout/rate-limit (NFR-MC-005) |
| T4.3: Tài liệu hướng dẫn admin | 6 | T4.1 | Hướng dẫn sử dụng admin UI cho đội FPT (tạo model, duyệt, theo dõi mirror, quản lý category) |
| T4.4: UAT với đội admin FPT + sửa lỗi | 16 | T4.1-T4.3 | 3-5 admin nội bộ dùng thật; thu thập phản hồi; sửa lỗi ưu tiên cao |

**Cộng sprint 4: ~40 giờ (~5 ngày dev).**

### Tổng Phase 1 (MVP)

- **Tổng giờ dev:** 40 + 56 + 56 + 40 = **192 giờ (~24 ngày dev).**
- **Thời gian:** 7 tuần với 1 dev; **~4 tuần với 2 dev** (backend + frontend song song từ sprint 2).
- **Milestones:**
  - **Tuần 2:** Backend foundation xong (status mới, RBAC, audit, guard) — T1.x
  - **Tuần 4:** Admin UI danh sách + form (HF + manual) xong — T2.x
  - **Tuần 6:** Approval + mirror pull chạy thông — T3.x
  - **Tuần 7:** UAT pass → MVP sẵn sàng

---

## Phase 2 — Mở rộng (sau MVP)

### Sprint 5 — Batch import + Auto-sync (tuần 8-9)

| Tác vụ | Giờ | Phụ thuộc | Mô tả |
|---|---|---|---|
| T5.1: Endpoint batch import (CSV/YAML/JSON) | 12 | Phase 1 | Parse file, validate từng dòng, tạo ≤ 500 entry draft, báo cáo N thành công / M lỗi (FR-MC-004) |
| T5.2: UI batch import + template | 8 | T5.1 | Upload file, tải template, hiển thị báo cáo kết quả |
| T5.3: Scheduler auto-sync revision (hàng ngày) | 10 | Phase 1 | Chạy daily job kiểm tra revision HF cho entry `sync_enabled=true`; tạo `pending_update` (FR-MC-011) |
| T5.4: UI duyệt revision mới | 8 | T5.3 | Danh sách pending_update; approve → reset weight_status về mirroring + pull lại; reject → giữ revision cũ (FR-MC-013.4) |
| T5.5: Test Sprint 5 | 8 | T5.1-T5.4 | Batch file có dòng lỗi; sync phát hiện revision mới; approve → pull lại; endpoint đang chạy không gián đoạn |

**Cộng sprint 5: ~46 giờ (~6 ngày dev).**

### Tổng Phase 2: ~46 giờ (~6 ngày dev, ~1.5 tuần).

---

## Tổng cả 2 phase

| Phase | Giờ | Thời gian (1 dev) | Thời gian (2 dev) |
|-------|:---:|:-----------------:|:-----------------:|
| Phase 1 (MVP) | 192h | 7 tuần | ~4 tuần |
| Phase 2 | 46h | ~1.5 tuần | ~1 tuần |
| **Tổng** | **238h** | **~8.5 tuần** | **~5 tuần** |

---

## Rủi ro + giảm nhẹ

| Rủi ro | Xác suất | Độ tác động | Giảm nhẹ |
|---|---|---|---|
| Team backend BFF chậm mở rộng enum `status_code` + field mới (T1.1) | Trung bình | Cao | Đồng bộ với team backend ngay tuần 1; nếu không được, tạm dùng bảng extension riêng cho catalog admin |
| HF API rate limit / downtime khi fetch metadata (T2.3) | Trung bình | Trung bình | Backoff + cache metadata 24h; mirror nội bộ đã loại bỏ phụ thuộc HF lúc deploy |
| Model lớn (100GB+) pull mirror chậm / tốn chi phí S3 | Cao | Trung bình | Chunked download + resume; ước tính dung lượng trước khi pull; S3 lifecycle policy cho entry inactive > 90 ngày |
| RBAC role mới không khớp hệ thống JWT hiện có | Trung bình | Cao | Xác nhận cơ chế role trong JWT claims với team auth trước sprint 1; fallback: role gán qua bảng mapping trong BFF |
| Admin nội bộ không có thời gian UAT (T4.4) | Trung bình | Trung bình | Đặt lịch UAT trước 2 tuần; thu hẹp UAT xuống 3 admin chính |
| `hf_model_id` bắt buộc gây lúng túng cho model độc quyền không có trên HF | Thấp | Thấp | Quy ước naming identifier nội bộ (VD: `fpt-internal/<model>`) trong tài liệu admin |

---

## Sản phẩm bàn giao

- **Tài liệu:** `docs/task-breakdown-ddi-model-catalog-admin.md` (tài liệu này)
- **Phase 1 (MVP):** Admin UI quản lý Model Catalog (list, form HF + manual, category, approval, mirror tracking) + backend gap (status mới, RBAC, audit, mirror pull)
- **Phase 2:** Batch import + auto-sync revision
- **Đối chiếu:** SRS `docs/srs-ddi-model-catalog-admin.md`, BRD `docs/brd-ddi-model-catalog-admin.md`

## Gate chuyển phase

- **Phase 1 → Phase 2:** UAT pass (T4.4) + ≥ 1 model HF thật được pull mirror + deploy endpoint thành công.
- **Phase 2 → GA:** Batch import + auto-sync test pass (T5.5) + tài liệu admin cập nhật.