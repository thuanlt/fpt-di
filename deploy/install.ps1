# FPT DDI — Helm install script cho cụm FPT SmartCloud dev
# Chạy trong terminal Lens (PowerShell):
#   cd ~/fpt-di; git pull; ./deploy/install.ps1
$ErrorActionPreference = "Stop"

# Thư mục cài helm user-local (nếu cài qua script ở trên) vào PATH cho phiên này
$helmDir = "$env:LOCALAPPDATA\helm\windows-amd64"
if (Test-Path "$helmDir\helm.exe") {
  $env:Path = "$helmDir;$env:Path"
  Write-Host "==> Đã thêm $helmDir vào PATH (Lens terminal)" -ForegroundColor DarkGray
}

$CHART_DIR = "deploy/helm"
$NAMESPACE = "ddi"
$RELEASE   = "fpt-ddi"
$VALUES_DEV    = "deploy/helm/values.fpt-dev.yaml"
$VALUES_DEPLOY = "deploy/helm/values.deploy.yaml"

Write-Host "==> Kiểm tra helm..." -ForegroundColor Cyan
if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
  Write-Host "helm chưa cài. Cài bằng:" -ForegroundColor Red
  Write-Host "  `$H=`"$env:LOCALAPPDATA\helm`"; New-Item -ItemType Directory -Force -Path `$H | Out-Null"
  Write-Host "  Invoke-WebRequest 'https://get.helm.sh/helm-v3.16.3-windows-amd64.zip' -OutFile `"$H\h.zip`""
  Write-Host "  Expand-Archive `"$H\h.zip`" -DestinationPath `$H -Force; Remove-Item `"$H\h.zip`""
  Write-Host "Rồi chạy lại: cd ~/fpt-di; git pull; ./deploy/install.ps1" -ForegroundColor Yellow
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
