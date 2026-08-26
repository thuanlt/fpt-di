# FPT DDI - Helm install script for FPT SmartCloud dev cluster
# Run in Lens terminal (PowerShell):
#   cd ~/fpt-di; git pull; ./deploy/install.ps1
$ErrorActionPreference = "Stop"

# Add user-local helm dir to PATH for this session (Lens terminal started before PATH update)
$helmDir = "$env:LOCALAPPDATA\helm\windows-amd64"
if (Test-Path "$helmDir\helm.exe") {
  $env:Path = "$helmDir;$env:Path"
  Write-Host "==> Added $helmDir to PATH (Lens terminal)" -ForegroundColor DarkGray
}

$CHART_DIR    = "deploy/helm"
$NAMESPACE    = "ddi"
$RELEASE      = "fpt-ddi"
$VALUES_DEV    = "deploy/helm/values.fpt-dev.yaml"
$VALUES_DEPLOY = "deploy/helm/values.deploy.yaml"

Write-Host "==> Check helm..." -ForegroundColor Cyan
if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
  Write-Host "helm not installed. Install with:" -ForegroundColor Red
  Write-Host '  $H="$env:LOCALAPPDATA\helm"; New-Item -ItemType Directory -Force -Path $H | Out-Null'
  Write-Host '  Invoke-WebRequest "https://get.helm.sh/helm-v3.16.3-windows-amd64.zip" -OutFile "$H\h.zip"'
  Write-Host '  Expand-Archive "$H\h.zip" -DestinationPath $H -Force; Remove-Item "$H\h.zip"'
  Write-Host "Then re-run: cd ~/fpt-di; git pull; ./deploy/install.ps1" -ForegroundColor Yellow
  exit 1
}
helm version

Write-Host "==> Check kubeconfig (current cluster)..." -ForegroundColor Cyan
kubectl cluster-info | Select-Object -First 3

Write-Host "==> Helm upgrade --install $RELEASE into ns $NAMESPACE..." -ForegroundColor Cyan
helm upgrade --install $RELEASE $CHART_DIR `
  -n $NAMESPACE --create-namespace `
  -f $VALUES_DEV `
  -f $VALUES_DEPLOY

Write-Host ""
Write-Host "==> Install status:" -ForegroundColor Cyan
helm status $RELEASE -n $NAMESPACE -o table | Select-Object -First 10

Write-Host ""
Write-Host "==> Pods in ns $NAMESPACE (wait until Running):" -ForegroundColor Cyan
kubectl get pods -n $NAMESPACE -o wide

Write-Host ""
Write-Host "==> Services in ns $NAMESPACE (find External IP of fpt-ddi-web):" -ForegroundColor Cyan
kubectl get svc -n $NAMESPACE

Write-Host ""
Write-Host "==> Watch pods real-time (Ctrl+C to exit):" -ForegroundColor Yellow
Write-Host "    kubectl get pods -n $NAMESPACE -w"
Write-Host ""
Write-Host "==> Get External IP when ready:" -ForegroundColor Yellow
Write-Host "    kubectl get svc fpt-ddi-web -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
Write-Host ""
Write-Host "==> Open app:  http://<EXTERNAL-IP>:3000" -ForegroundColor Green
