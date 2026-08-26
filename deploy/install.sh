#!/usr/bin/env bash
# FPT DDI — Helm install script cho cụm FPT SmartCloud dev
# Chạy trong terminal Lens (đã có kubecontext):
#   cd ~/fpt-di && bash deploy/install.sh
set -euo pipefail

CHART_DIR="deploy/helm"
NAMESPACE="ddi"
RELEASE="fpt-ddi"
VALUES_DEV="deploy/helm/values.fpt-dev.yaml"
VALUES_DEPLOY="deploy/helm/values.deploy.yaml"

echo "==> Kiểm tra helm..."
command -v helm >/dev/null 2>&1 || {
  echo "helm chưa cài. Cài ngay:"
  echo "  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
  exit 1
}
helm version

echo "==> Kiểm tra kubeconfig (cluster hiện tại)..."
kubectl cluster-info 2>&1 | head -3

echo "==> Helm upgrade --install ${RELEASE} vào ns ${NAMESPACE}..."
helm upgrade --install "${RELEASE}" "${CHART_DIR}" \
  -n "${NAMESPACE}" --create-namespace \
  -f "${VALUES_DEV}" \
  -f "${VALUES_DEPLOY}"

echo
echo "==> Kết quả install:"
helm status "${RELEASE}" -n "${NAMESPACE}" -o table 2>&1 | head -10

echo
echo "==> Pods trong ns ${NAMESPACE} (đợi sang Running):"
kubectl get pods -n "${NAMESPACE}" -o wide

echo
echo "==> Services trong ns ${NAMESPACE} (tìm External IP của fpt-ddi-web):"
kubectl get svc -n "${NAMESPACE}"

echo
echo "==> Theo dõi real-time pods (Ctrl+C để thoát):"
echo "    kubectl get pods -n ${NAMESPACE} -w"
echo
echo "==> Lấy External IP khiReady:"
echo "    kubectl get svc fpt-ddi-web -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
echo
echo "==> Truy cập app:  http://<EXTERNAL-IP>:3000"
