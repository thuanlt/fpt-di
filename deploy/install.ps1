# FPT DDI — Helm install script cho cụm FPT SmartCloud dev
# Chạy trong terminal Lens (PowerShell):
#   cd ~/fpt-di; git pull; ./deploy/install.ps1
$ErrorActionPreference = "Stop"

$CHART_DIR = "deploy/helm"
$NAMESPACE = "ddi"
$RELEASE   = "fpt-ddi"
$VALUES_DEV    = "deploy/helm/values.fpt-dev.yaml"
$VALUES_DEPLOY = "deploy/helm/values.deploy.yaml"

Write-Host "==> Kiểm tra helm..." -ForegroundColor Cyan
if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
  Write-Host "helm chưa cài. Cài tại https://helm.sh/docs/intro/install/" -ForegroundColor Red
  exit 1
}
helm version

Write-Host "==> Kiểm tra kubeconfig (cluster hiện tại)..." -ForegroundColor Cyan
kubectl cluster-info | Select-Object -First 3

Write-Host "==> Helm upgrade --install $RELEASE vào ns $NAMESPACE..." -ForegroundColor Cyan
helm upgrade --install $RELEASE $CHART_DIR `
  -n $NAMESPACE --create-namespace `
  -f $VALUES_DEV `
  -f $VALUES_DEPLOY

Write-Host ""
Write-Host "==> Kết quả install:" -ForegroundColor Cyan
helm status $RELEASE -n $NAMESPACE -o table | Select-Object -First 10

Write-Host ""
Write-Host "==> Pods trong ns $NAMESPACE (đợi sang Running):" -ForegroundColor Cyan
kubectl get pods -n $NAMESPACE -o wide

Write-Host ""
Write-Host "==> Services trong ns $NAMESPACE (tìm External IP của fpt-ddi-web):" -ForegroundColor Cyan
kubectl get svc -n $NAMESPACE

Write-Host ""
Write-Host "==> Theo dõi real-time pods (Ctrl+C để thoát):" -ForegroundColor Yellow
Write-Host "    kubectl get pods -n $NAMESPACE -w"
Write-Host ""
Write-Host "==> Truy cập app:  http://<EXTERNAL-IP>:3000" -ForegroundColor Green
