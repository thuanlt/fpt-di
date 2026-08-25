# Technical Note — Khả năng Serving Model trên GPU A30 (FPT DDI)

**Phiên bản:** 1.0
**Ngày:** 18/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** Xác định các model có thể serving trên GPU **NVIDIA A30 (24GB HBM2)** trong dịch vụ FPT DDI — để định hướng Model Catalog và phân khúc giá.
**Liên quan:** `docs/market-research-fpt-ddi.md`, `docs/srs-ddi-my-endpoints.md`

---

## 1. Thông số GPU A30

| Thông số | Giá trị |
|----------|---------|
| **VRAM** | 24GB HBM2 |
| **Băng thông bộ nhớ** | 933 GB/s |
| **Kiến trúc** | Ampere (tương tự A100 nhưng giảm cấu hình) |
| **FP16/BF16** | Hỗ trợ |
| **INT8 / INT4** | Hỗ trợ (quantization) |
| **Vị trí trong DDI** | **Entry-level** — phù hợp SME, model nhỏ, chi phí thấp |

> **Vai trò chiến lược:** A30 là điểm vào (entry-point) giá rẻ để thu hút SME, sau đó upsell lên H100/H200/B300.

---

## 2. Nguyên tắc tính dung lượng VRAM

Công thức ước tính nhu cầu VRAM khi serving:

```
VRAM cần = Trọng số model (weights) + KV cache + Activations + Overhead hệ thống
```

| Quantization | Bytes/param | Model 7B | Model 8B | Model 13B |
|--------------|-------------|----------|----------|-----------|
| **FP16/BF16** | 2 bytes | ~14 GB | ~16 GB | ~26 GB |
| **INT8** | 1 byte | ~7–8 GB | ~8 GB | ~13 GB |
| **INT4 (GPTQ/AWQ)** | 0,5 byte | ~4 GB | ~4–5 GB | ~7 GB |

> **Kết luận:** Với 24GB VRAM, A30 thoải mái serving model **≤ 8–10B ở FP16**, và model **20–30B khi quantized (INT8/INT4)** với vLLM (PagedAttention, FP8 KV cache, prefix caching).

---

## 3. Bảng model serving được trên A30

### 3.1 Model phổ biến (khuyến nghị cho Model Catalog)

| Model | Params | FP16 | INT8 | INT4 | Khuyến nghị trên A30 |
|-------|:---:|:---:|:---:|:---:|:---:|
| **Llama 3.1 8B Instruct** | 8B | ⚠️ Chật (16GB weights) | ✅ Thoải mái | ✅ Rất thoải mái | ✅ **Khuyến nghị chính** |
| **Qwen 2.5 7B** | 7,6B | ⚠️ Khó (context dài) | ✅ Thoải mái | ✅ | ✅ **Khuyến nghị** |
| **Gemma 2 9B** | 9B | ⚠️ Chật | ✅ | ✅ | ✅ |
| **Mistral 7B** | 7,3B | ✅ | ✅ | ✅ | ✅ |
| **Phi-3 Mini** | 3,8B | ✅ | ✅ | ✅ | ✅ Rất thoải mái |
| **Llama 3.2 3B** | 3,2B | ✅ | ✅ | ✅ | ✅ Rất thoải mái |
| **Qwen 2.5 14B** | 14,8B | ❌ Không đủ | ⚠️ Chật (13GB) | ✅ | ⚠️ Chỉ INT4 |
| **CodeLlama 7B** | 7B | ✅ | ✅ | ✅ | ✅ |
| **DeepSeek Coder 6.7B** | 6,7B | ✅ | ✅ | ✅ | ✅ |
| **FPT.AI model nhỏ (tiếng Việt)** | <7B | ✅ | ✅ | ✅ | ✅ **Điểm khác biệt** |

### 3.2 Model KHÔNG phù hợp A30

| Model | Params | Lý do không phù hợp |
|-------|:---:|---------------------|
| Llama 3.1 70B | 70B | Cần ≥ 140GB FP16 — dùng H200 (141GB) |
| Qwen 2.5 72B | 72B | Cần ≥ 144GB FP16 — dùng H200 |
| DeepSeek V3 | 671B (MoE) | Cần H100/H200 cluster |
| Mixtral 8x7B | 47B (MoE) | Quá lớn cho A30 |
| Model > 30B (INT4) | >30B | Vượt 24GB kể cả quantized mạnh |

> **Nguyên tắc:** A30 dành cho model **≤ 8–10B (FP16)** hoặc **≤ 30B (INT4)**. Model lớn hơn → chuyển sang **H100 (80GB) / H200 (141GB) / B300**.

---

## 4. Ma trận GPU theo quy mô model (định hướng Model Catalog)

| GPU | VRAM | Model phù hợp | Phân khúc |
|-----|------|---------------|-----------|
| **A30** | 24GB | ≤ 8–10B FP16 · ≤ 30B INT4 | Entry / SME |
| **H100** | 80GB | ≤ 40B FP16 · ≤ 70B INT4 | Phổ thông / Enterprise |
| **H200** | 141GB | ≤ 70B FP16 · model 100B+ | LLM lớn / context dài |
| **B300** | HBM3e | Frontier model, hiệu năng đỉnh | Cao cấp |

---

## 5. Yêu cầu chức năng đề xuất (cho Model Catalog)

### FR-A30-001: Phân loại model theo GPU phù hợp

**Ưu tiên:** Must Have

**Mô tả:** Hệ thống **phải** gắn nhãn mỗi model trong Model Catalog với danh sách GPU type tương thích (bao gồm A30), dựa trên kích thước model và quantization.

**Tiêu chí chấp nhận:**
1. Mỗi model hiển thị rõ GPU type hỗ trợ (vd `A30 · H100 · H200`).
2. Model không tương thích A30 (vd 70B) **không** hiển thị A30 như lựa chọn deploy.
3. Hệ thống gợi ý GPU tối ưu (cost-performance) cho model đã chọn.

### FR-A30-002: Lựa chọn quantization khi deploy

**Ưu tiên:** Should Have

**Mô tả:** Hệ thống **phải** cho phép người dùng chọn mức quantization (FP16 / INT8 / INT4) khi deploy model lên A30, và hiển thị ảnh hưởng tới chất lượng/chi phí.

**Tiêu chí chấp nhận:**
1. Người dùng chọn quantization → hệ thống hiển thị VRAM ước tính và model có chạy được trên A30 hay không.
2. Hệ thống cảnh báo nếu quantization INT4 có thể giảm chất lượng output.

### FR-A30-003: Giới hạn context & concurrency theo GPU

**Ưu tiên:** Should Have

**Mô tả:** Hệ thống **phải** áp dụng giới hạn context length và số request đồng thời phù hợp với VRAM A30 để tránh OOM.

**Tiêu chí chấp nhận:**
1. Deploy model 8B FP16 trên A30 → hệ thống giới hạn context ≤ 8K và concurrency hợp lý.
2. Khi vượt giới hạn, hệ thống hiển thị cảnh báo rõ ràng thay vì để request fail OOM.

---

## 6. Kết luận & Khuyến nghị

### 6.1 Tóm tắt

- **A30 (24GB)** là GPU **entry-level** phù hợp serving model **≤ 8–10B ở FP16** hoặc **≤ 30B ở INT4/INT8**.
- Model phổ biến **Llama 3.1 8B, Qwen 2.5 7B, Gemma 2 9B, Mistral 7B, Phi-3, Llama 3.2 3B** đều chạy tốt trên A30 (đặc biệt INT8).
- Model **≥ 70B** không phù hợp A30 → chuyển sang **H200 (141GB)**.

### 6.2 Khuyến nghị cho FPT DDI

| Ưu tiên | Khuyến nghị |
|---------|-------------|
| **Must** | Đưa model 7–9B (Llama 3.1 8B, Qwen 2.5 7B, Gemma 2 9B) vào catalog A30 — phân khúc SME |
| **Must** | Thêm model tiếng Việt FPT.AI nhỏ (<7B) làm điểm khác biệt trên A30 |
| **Should** | Hỗ trợ chọn quantization (INT8/INT4) để tối đa hóa model chạy được trên A30 |
| **Should** | Hiển thị ma trận GPU-model rõ ràng trong Model Catalog |
| **Could** | Dùng MIG/GPU sharing để chạy nhiều model nhỏ trên 1 A30, tối ưu chi phí |

---

## PHỤ LỤC — Nguồn dữ liệu

- vLLM documentation — PagedAttention, FP8 KV cache, quantization, memory optimization
- Local AI Master, GigaGPU, JarvisLabs — VRAM requirements theo model/quantization
- NVIDIA A30 spec sheet — 24GB HBM2, 933 GB/s, Ampere architecture

> **Lưu ý:** Con số VRAM là ước tính lý thuyết, thực tế phụ thuộc context length, batch size, serving framework (vLLM/TensorRT-LLM) và overhead hệ thống. Nên benchmark thực tế trên hạ tầng FPT trước khi chốt Model Catalog chính thức.