# DevOps Deploy Runbook — FPT DDI lên cluster dev (Gardener NCP K8s)

Runbook ghi lại quy trình deploy tự động FPT DDI lên cluster dev
`gardener-ncp-dev-k8s-...-mycluster-95dt5zso`, kèm các lỗi gặp phải và cách xử lý.

- Cluster API: `https://api.95dt5zso.prd.m.fke.fptcloud.com`
- Namespace: `ddi` · Release: `fpt-ddi` · Chart version: `2.1.0`
- Node có External IP: `192.223.13.245` (worker `nvplg`)

---

## 1. Chuẩn bị trên máy Windows

| Công cụ | Yêu cầu | Kiểm tra |
|---|---|---|
| `kubectl` | đã cài | `kubectl version` |
| `helm` | ≥ 3.16 | `helm version` |
| `docker` | Docker Desktop đang chạy | `docker info` |
| kubeconfig | file `mycluster-95dt5zso-kubeconfig` | `kubectl config current-context` |

**Helm không nằm trong PATH** — thêm thủ công mỗi phiên PowerShell:
```powershell
$env:Path = "$env:LOCALAPPDATA\helm\windows-amd64;$env:Path"
helm version
```

**Trỏ kubeconfig:**
```powershell
$env:KUBECONFIG = "C:\Users\DELL\Downloads\mycluster-95dt5zso-kubeconfig"
kubectl config current-context
# => garden-ncp-dev-k8s-...-mycluster-95dt5zso-external
```

> Lưu ý: `kubectl cluster-info` phải hiện server, không phải lỗi `localhost:8080`
> (lỗi đó = kubeconfig trống/chưa trỏ đúng).

---

## 2. Deploy

Script `deploy/deploy-dev.ps1` chạy 8 bước: preflight → build → push → lint →
upgrade → rollout → health → smoke.

```powershell
cd C:\Users\DELL\Downloads\fpt-di
$env:KUBECONFIG = "C:\Users\DELL\Downloads\mycluster-95dt5zso-kubeconfig"
$env:Path = "$env:LOCALAPPDATA\helm\windows-amd64;$env:Path"
./deploy/deploy-dev.ps1 -KubeConfig C:\Users\DELL\Downloads\mycluster-95dt5zso-kubeconfig
```

Nếu image đã push rồi, dùng `-SkipBuild`.

---

## 3. Các lỗi gặp phải & cách xử lý

### 3.1 Docker daemon chưa chạy
- Triệu chứng: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- Xử lý: mở **Docker Desktop**, đợi "Engine running", kiểm tra `docker info`.

### 3.2 Helm "MISSING tool"
- Triệu chứng: `MISSING tool: helm` dù đã cài.
- Xử lý: helm nằm ở `%LOCALAPPDATA%\helm\windows-amd64` nhưng không trong PATH.
  Thêm PATH như mục 1.

### 3.3 `helm upgrade` báo "another operation in progress"
- Triệu chứng: upgrade fail `context deadline exceeded`, release rơi vào
  `pending-rollback`, mọi lệnh upgrade sau bị chặn.
- Nguyên nhân: dùng `--atomic` → khi timeout tự rollback → rollback kẹt.
- Xử lý:
  ```powershell
  helm status fpt-ddi -n ddi        # xác nhận pending-rollback
  helm rollback fpt-ddi 2 -n ddi --timeout 300s   # hoàn tất rollback về rev 2
  ```
  Sau đó upgrade **KHÔNG dùng `--atomic`**, timeout dài hơn:
  ```powershell
  helm upgrade fpt-ddi deploy/helm -n ddi `
    -f deploy/helm/values.fpt-dev.yaml -f deploy/helm/values.deploy.yaml `
    --set image.backend=docker.io/thuanlt11/ddi-backend:v2.1.0 `
    --set image.vllmAdapter=docker.io/thuanlt11/ddi-vllm-adapter:v2.1.0 `
    --timeout 480s
  ```

### 3.4 Image cùng tag không tạo pod mới
- Triệu chứng: rollout thành công nhưng pod web vẫn AGE cũ (5d+).
- Nguyên nhân: image vẫn `v2.1.0` (cùng tag rev cũ), `imagePullPolicy: IfNotPresent`
  nên K8s không pull lại.
- Xử lý nếu muốn ép dùng code mới nhất:
  ```powershell
  kubectl rollout restart deployment/fpt-ddi-web -n ddi
  kubectl rollout status deployment/fpt-ddi-web -n ddi --timeout=300s
  ```

### 3.5 LoadBalancer `<pending>` — không có External IP
- Triệu chứng: `kubectl get svc fpt-ddi-web` EXTERNAL-IP = `<pending>`.
- Nguyên nhân: cluster dev không cấp IP LoadBalancer.
- Xử lý: dùng **NodePort 30403** qua node có External IP, hoặc **port-forward**:
  ```powershell
  kubectl port-forward svc/fpt-ddi-web -n ddi 3000:3000
  # PowerShell thứ 2:
  curl http://localhost:3000/health
  ```

---

## 4. Xác nhận deploy thành công

```powershell
kubectl get pods -n ddi -o wide
kubectl port-forward svc/fpt-ddi-web -n ddi 3000:3000   # giữ phiên
# PowerShell thứ 2:
curl http://localhost:3000/health
```

Kết quả mong đợi:
```json
{"status":"ok","workers":{"batch":true,"byom":true,"endpoint":true,"documents":true,"mode":"all"},
 "postgres":true,"redis":true,"storage":{"byom":true,"batch":true,"documents":true}}
```

---

## 5. Admin Console — Model Catalog Admin trên port riêng

Admin console được deploy thành deployment/service riêng (`fpt-ddi-admin`) chạy Caddy
trên port riêng, serve static admin-console + proxy `/v1/*` → backend. Không sửa code
admin-console.

Cấu hình trong Helm:
- `values.yaml`: block `adminConsole` (default `enabled: false`, port `8080`)
- `values.fpt-dev.yaml`: bật `enabled: true`, port `9090`, `serviceType: NodePort`

Template mới:
- `templates/admin-console-configmap.yaml` — static admin-console
- `templates/admin-caddyfile-configmap.yaml` — Caddyfile (proxy `/v1` + serve static)
- `templates/deployment-admin.yaml` — Deployment Caddy
- `templates/service-admin.yaml` — Service

### Truy cập admin console

**Cách 1 — Port-forward (ưu tiên, firewall không chặn):**
```powershell
kubectl port-forward svc/fpt-ddi-admin -n ddi 9090:9090
# PowerShell thứ 2:
#   http://localhost:9090/admin/
```

**Cách 2 — NodePort** (lấy port được cấp):
```powershell
kubectl get svc fpt-ddi-admin -n ddi -o wide
# Ví dụ PORT(S)=9090:31000/TCP → truy cập http://<NODE-IP>:31000/admin/
# Node có External IP: 192.223.13.245 (nvplg)
```
> Lưu ý: như web, NodePort admin cũng có thể bị firewall chặn từ internet → ưu tiên port-forward.

**Cách 3 — ClusterIP** (nếu `serviceType: ClusterIP`, chỉ truy cập trong cluster):
```powershell
kubectl run -it --rm curl --image=curlimages/curl -n ddi -- sh
# rồi: curl http://fpt-ddi-admin:9090/admin/
```

### Xác nhận admin console hoạt động
```powershell
kubectl port-forward svc/fpt-ddi-admin -n ddi 9090:9090
# PowerShell thứ 2:
curl http://localhost:9090/admin/
# Mong đợi: HTML trang "FPT DDI — Model Catalog Admin" (200)
```

---

## 6. Ghi chú

- Cluster có 2 context: `external` (mặc định) và `internal`. Dùng external để truy cập
  qua API public.
- Node duy nhất có External IP là `nvplg` (`192.223.13.245`); NodePort 30403 bị
  firewall chặn từ internet → ưu tiên port-forward.
- Admin console dùng key riêng (`fptDdiAdminKey` trong localStorage), tự tạo demo key
  scope=admin khi dev (`keysAdminRequired: "false"`).
- Không commit kubeconfig hoặc secret vào repo.