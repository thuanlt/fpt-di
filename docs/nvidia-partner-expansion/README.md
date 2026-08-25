# Bộ tài liệu BA — Mở rộng FPT DDI Partner Console với đối tác NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)

---

## Mục tiêu

Tài liệu yêu cầu & phân tích cho chiến lược mở rộng FPT DDI Partner Console với **NVIDIA** làm đối tác chiến lược, nhắm tới **4 phân khúc khách hàng tiềm năng cao**: **coding, banking, chứng khoán, bảo hiểm** — nhằm mở rộng thị trường, thu hút user và tăng doanh thu.

## Danh mục tài liệu

| # | Tài liệu | Nội dung | Đọc khi nào |
|---|----------|----------|-------------|
| 1 | `brd-nvidia-partner-expansion.md` | Business Requirements — bối cảnh, mục tiêu SMART, persona, phạm vi, BR-01..08, rủi ro, KPI, roadmap | Bắt đầu, để hiểu "tại sao" |
| 2 | `srs-nvidia-partner-expansion.md` | SRS — yêu cầu chức năng FR-XXX + phi chức năng NFR-XXX, traceability | Trước khi thiết kế/estimate |
| 3 | `user-stories-nvidia-partner-expansion.md` | 10 user stories + acceptance criteria (Given/When/Then) | Trước khi chia task |
| 4 | `process-flows-nvidia-partner-expansion.md` | 6 quy trình BPMN (Mermaid) + business rules + exceptions | Khi cần hiểu luồng |
| 5 | `data-dictionary-rtm-nvidia-partner-expansion.md` | Data dictionary, glossary, RTM (BR↔FR↔US↔PF), chuẩn/quy định | Khi thiết kế DB/API |
| 6 | `wireframes-nvidia-partner-expansion.md` | 7 wireframe màn hình chính (ASCII) + checklist FE | Trước khi code FE |
| 7 | `estimation-nvidia-partner-expansion.md` | Ước lượng story points/man-day, theo pha, phân bổ vai trò, sprint | Trước khi lập kế hoạch |
| 8 | `api-spec-nvidia-partner-expansion.md` | Đặc tả API (hợp đồng), request/response, mã lỗi, ma trận scope | Trước khi code BE/FE |
| 9 | `test-plan-nvidia-partner-expansion.md` | Kế hoạch kiểm thử, test case theo story, phi chức năng, regression | Trước khi QA |

## Thứ tự đọc đề xuất cho đội phát triển

1. **BRD** → nắm bối cảnh, mục tiêu, phạm vi, ưu tiên.
2. **SRS** → nắm yêu cầu chức năng/phi chức năng chi tiết.
3. **User Stories** → nắm từng tính năng + tiêu chí chấp nhận.
4. **Process Flows** → nắm luồng nghiệp vụ.
5. **Data Dictionary & RTM** → nắm cấu trúc dữ liệu + truy vết.
6. **Wireframes** → blueprint UI cho đội FE.
7. **API Spec** → hợp đồng API cho đội BE/FE.
8. **Estimation** → kế hoạch công việc.
9. **Test Plan** → checklist cho QA.

## Tóm tắt nhanh

### 4 phân khúc mục tiêu
- **Coding**: model code low-latency, code privacy, playground code.
- **Banking**: guardrails PII, audit trail, data residency VN, tuân thủ NHNN/PDPA.
- **Chứng khoán**: low-latency, structured output (JSON Schema).
- **Bảo hiểm**: trích xuất tài liệu, guardrails thông tin y tế.

### 4 trụ cột NVIDIA
- **NIM catalog** — deploy model NVIDIA 1-click.
- **Triton / TensorRT-LLM** — tối ưu hiệu năng (throughput +20%).
- **NeMo Guardrails** — rào chắn an toàn theo phân khúc.
- **DGX Cloud** — roadmap pha 2.

### Ưu tiên triển khai (MoSCoW)
- **Must (Pha 1)**: US-01 NIM deploy, US-02 Guardrails banking, US-05 Audit trail, US-08 Code privacy, US-10 Phân quyền.
- **Should (Pha 2)**: US-03 Structured output, US-06 Gói giá, US-07 Dashboard, US-09 TensorRT-LLM.
- **Should (Pha 3)**: US-04 Trích xuất bảo hiểm.

## Liên hệ
- **Chủ sở hữu:** Thuan Luu Thi (BA/PO)
- **Trạng thái:** Draft — chờ review & approve trước khi chuyển đội phát triển.