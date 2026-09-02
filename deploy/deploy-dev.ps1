# FPT DDI - Full DevOps deploy to Gardener NCP dev K8s cluster
# Run in PowerShell on YOUR machine (repo root):
#   ./deploy/deploy-dev.ps1 -KubeConfig C:\kube\dev-k8s.yaml [-Tag v2.1.0] [-SkipBuild]
#
# Flow (matches zenflow-workflows/fpt-ddi-devops-deploy.yaml):
#   preflight -> build -> push -> helm lint -> helm upgrade -> verify rollout -> health -> smoke
param(
  [Parameter(Mandatory=$true)][string]$KubeConfig,
  [string]$Tag = "v2.1.0",
  [switch]$SkipBuild,
  [string]$Registry = "docker.io/thuanlt11",
  [string]$Namespace = "ddi",
  [string]$Release = "fpt-ddi"
)
$ErrorActionPreference = "Stop"

$CHART_DIR    = "deploy/helm"
$VALUES_DEV   = "deploy/helm/values.fpt-dev.yaml"
$VALUES_DEPLOY= "deploy/helm/values.deploy.yaml"
$BACKEND_IMG  = "$Registry/ddi-backend:$Tag"
$VLLM_IMG     = "$Registry/ddi-vllm-adapter:$Tag"

# ---- 1. PREFLIGHT -----------------------------------------------------------
Write-Host "==> [1/8] Preflight tools..." -ForegroundColor Cyan
foreach ($t in @("helm","kubectl","docker","git")) {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
    Write-Host "MISSING tool: $t" -ForegroundColor Red; exit 1
  }
}
Write-Host "    helm=$(helm version --short)  docker=$(docker --version)"

Write-Host "==> [2/8] Point kubectl at your kubeconfig..." -ForegroundColor Cyan
$env:KUBECONFIG = $KubeConfig
kubectl config current-context
kubectl cluster-info | Select-Object -First 3

# ---- 2. BUILD ---------------------------------------------------------------
if (-not $SkipBuild) {
  Write-Host "==> [3/8] Build images..." -ForegroundColor Cyan
  docker build -f Dockerfile.backend      -t $BACKEND_IMG .
  docker build -f Dockerfile.vllm-adapter -t $VLLM_IMG .
} else {
  Write-Host "==> [3/8] Skip build (-SkipBuild)..." -ForegroundColor DarkGray
}

# ---- 3. PUSH ----------------------------------------------------------------
Write-Host "==> [4/8] Push images..." -ForegroundColor Cyan
docker push $BACKEND_IMG
docker push $VLLM_IMG

# ---- 4. VALIDATE CHART ------------------------------------------------------
Write-Host "==> [5/8] helm lint + template..." -ForegroundColor Cyan
helm lint $CHART_DIR
helm template $Release $CHART_DIR -n $Namespace `
  -f $CHART_DIR/values.yaml -f $VALUES_DEV -f $VALUES_DEPLOY `
  --set image.backend=$BACKEND_IMG --set image.vllmAdapter=$VLLM_IMG `
  | Out-Null
Write-Host "    template render OK"

# ---- 5. DEPLOY --------------------------------------------------------------
Write-Host "==> [6/8] helm upgrade --install $Release (ns $Namespace)..." -ForegroundColor Cyan
helm upgrade --install $Release $CHART_DIR -n $Namespace --create-namespace `
  -f $CHART_DIR/values.yaml -f $VALUES_DEV -f $VALUES_DEPLOY `
  --set image.backend=$BACKEND_IMG --set image.vllmAdapter=$VLLM_IMG `
  --atomic --timeout 240s

# ---- 6. VERIFY ROLLOUT ------------------------------------------------------
Write-Host "==> [7/8] Verify rollout + health..." -ForegroundColor Cyan
kubectl rollout status deployment/fpt-ddi-web -n $Namespace --timeout=180s
kubectl get pods -n $Namespace -o wide | Select-String "fpt-ddi-(web|worker)"

$LB_IP = kubectl get svc fpt-ddi-web -n $Namespace -o jsonpath="{.status.loadBalancer.ingress[0].ip}"
if ([string]::IsNullOrWhiteSpace($LB_IP)) {
  $LB_IP = kubectl get svc fpt-ddi-web -n $Namespace -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
}
Write-Host "    LoadBalancer IP/host: $LB_IP" -ForegroundColor Green
$APP_URL = "http://${LB_IP}:3000"

# ---- 7. SMOKE TEST ----------------------------------------------------------
Write-Host "==> [8/8] Smoke test ($APP_URL)..." -ForegroundColor Cyan
$ok = $false
for ($i=1; $i -le 12; $i++) {
  try { $code = (Invoke-WebRequest -Uri "$APP_URL/health" -UseBasicParsing -TimeoutSec 5).StatusCode } catch { $code = 0 }
  Write-Host "    health poll $i : $code"
  if ($code -eq 200) { $ok = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $ok) { Write-Host "HEALTH FAIL sau 60s" -ForegroundColor Red; exit 1 }

$health = Invoke-RestMethod -Uri "$APP_URL/health" -TimeoutSec 10
Write-Host "    status=$($health.status)  workers.mode=$($health.workers.mode)" -ForegroundColor Green

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " FPT DDI DEVOPS DEPLOY - HOAN TAT" -ForegroundColor Green
Write-Host "   image:   $BACKEND_IMG / $VLLM_IMG"
Write-Host "   release: $Release (ns $Namespace)"
Write-Host "   url:     $APP_URL"
Write-Host "==============================================" -ForegroundColor Green