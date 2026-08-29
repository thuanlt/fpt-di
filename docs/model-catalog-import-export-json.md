# Model Catalog Admin — Import / Export JSON

Chức năng import model từ file JSON và export catalog ra file JSON cho admin console FPT DDI Model Catalog.

- **Ngày:** 2026-08-29
- **Phạm vi:** `src/catalog-admin/routes.js` (API) + `admin-console/js/m1-list.js` (UI)
- **Auth:** scope `admin`; import yêu cầu role `admin`, export mọi role có scope `admin` đọc được

---

## 1. Export catalog ra JSON

### API

```
GET /v1/admin/catalog/export?catalog_type=public|proprietary&status=<status>
```

| Tham số | Bắt buộc | Giá trị |
|---|---|---|
| `catalog_type` | Không | `public` / `proprietary` (theo tab đang chọn trên UI) |
| `status` | Không | `draft` / `pending_review` / `active` / `inactive` |

**Response:**

```json
{
  "ok": true,
  "count": 1,
  "data": [
    {
      "id": "llama-3-3-70b-instruct-fp8",
      "catalogType": "public",
      "status": "draft",
      "hfModelId": "nvidia/Llama-3.3-70B-Instruct-FP8",
      "revision": null,
      "displayName": "Llama 3.3 70B Instruct",
      "shortDescription": "Mô tả ngắn model…",
      "parametersDisplay": "70B dense",
      "contextLengthDisplay": "128K",
      "license": "llama3.3",
      "badgeCode": null,
      "sortOrder": 0,
      "fromPrice": 3.29,
      "categories": ["llm"],
      "benchmarks": [],
      "hardwareProfiles": [
        {
          "gpu_sku_code": "l40s",
          "gpus_per_instance": 8,
          "precision": "fp8",
          "vram_required_gb": 48,
          "per_gpu_hourly_price_usd_micros": 3290000,
          "is_recommended": true,
          "sort_order": 0
        }
      ],
      "weightStatus": "not_mirrored",
      "syncEnabled": true,
      "version": 0,
      "createdBy": "mc-admin-xxx",
      "createdAt": "2026-08-29T05:00:00Z",
      "updatedAt": "2026-08-29T05:00:00Z"
    }
  ]
}
```

- Trả về tối đa **1000 entry** (phân trang 200/lot phía server).
- Entry xuất ra dùng nguyên schema nội bộ (camelCase) — import chấp nhận đúng schema này.

### UI

Nút **⇩ Export JSON** trên trang danh sách Model Catalog. File tải về theo dạng:

```
model-catalog-<catalog_type>-<YYYY-MM-DD>.json
```

Nội dung file là mảng entries (trường `data` của response).

---

## 2. Import model từ file JSON

### API

```
POST /v1/admin/catalog/import
Content-Type: application/json
Authorization: Bearer <key-role-admin>
```

**Body:** mảng entries trực tiếp, hoặc bọc trong `entries`:

```json
{
  "entries": [
    {
      "id": "test-import-m1",
      "hfModelId": "fpt-internal/test-m1",
      "displayName": "Test Import M1",
      "shortDescription": "model test import",
      "parameters": "1B",
      "contextLength": "8K",
      "license": "mit",
      "catalogType": "public",
      "categories": [],
      "hardwareProfiles": [
        {
          "gpu_sku_code": "l40s",
          "gpus_per_instance": 1,
          "precision": "fp8",
          "per_gpu_hourly_price_usd_micros": 3290000,
          "is_recommended": true,
          "sort_order": 0
        }
      ]
    }
  ]
}
```

> **Lưu ý mapping trường:** validate bắt buộc dùng tên `id`, `hfModelId`, `displayName`, `license` — trùng schema export. Trường `shortDescription`, `parametersDisplay`, `contextLengthDisplay` khuyến nghị dùng đúng tên export để import lại không mất dữ liệu.

**Response:**

```json
{
  "ok": true,
  "data": {
    "total": 2,
    "created": 1,
    "skipped": 1,
    "failed": 0,
    "created": [ { "id": "test-import-m1", "displayName": "Test Import M1" } ],
    "skipped": [ { "id": "dupe-id", "reason": "đã tồn tại" } ],
    "failed": [ { "id": "bad-id", "errors": ["thiếu trường bắt buộc: hfModelId"] } ]
  }
}
```

### Quy tắc xử lý

| Trường hợp | Xử lý |
|---|---|
| Entry hợp lệ, id chưa tồn tại | Tạo mới, status luôn `draft` |
| Entry id đã tồn tại | **Skip** (không ghi đè) |
| Entry thiếu trường bắt buộc / sai validate | **Failed**, kèm danh sách lỗi cụ thể |
| File không phải JSON / không phải mảng | 400 `VALIDATION_FAILED` |
| Hơn 50 entry trong 1 lần | 400 `TOO_MANY` |

**Validate (trùng `validateEntry` của form thủ công):**
- Bắt buộc: `id`, `hfModelId`, `displayName`, `license`
- `catalogType` ∈ `public`/`proprietary` (mặc định `public`)
- `hardwareProfiles`: mảng ≥ 1, **đúng 1** profile `is_recommended: true`, giá ≥ 0
- `categories` phải là mảng; `fromPrice` ≥ 0

### UI

Nút **⇪ Import JSON** trên trang danh sách (chỉ hiện với role `admin`):

1. Chọn file `.json` → hệ thống parse và kiểm tra cấu trúc ngay trên trình duyệt.
2. Modal xác nhận hiển thị số entry + lưu ý về draft/skip.
3. Toast kết quả: `Import xong: X tạo mới, Y bỏ qua, Z lỗi` (kèm chi tiết lỗi đầu tiên nếu có).

---

## 3. Luồng khuyến nghị

1. **Export** catalog hiện tại làm template.
2. Sao chép entry trong file, sửa `id` (phải unique), `displayName`, giá GPU…
3. **Import** file — entry mới vào trạng thái `draft`.
4. Chạy luồng thông thường: Submit → Approve (publish + mirror weights).

## 4. Giới hạn & lưu ý

- Import **không** tạo mirror job, không publish — chỉ tạo draft.
- Không import đè entry đang `active`/`pending_review` (id trùng → skip, không có chế độ upsert).
- File JSON nên < 10MB (giới hạn body API là 100MB nhưng 50 entry/lần là ngưỡng thực dụng).
- Audit: mỗi entry import được ghi audit `mc.create` như tạo thủ công.