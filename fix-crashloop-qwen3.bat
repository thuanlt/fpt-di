@echo off
setlocal EnableExtensions

set NS=gc-qwen3-0-6b-3980-jihb7ves
set DEPLOY=qwen3-0-6b-3980-jihb7ves

echo ================================================================
echo  Buoc 0: Kiem tra command hien tai (de xac nhan chua duoc ap)
echo ================================================================
kubectl get deploy %DEPLOY% -n %NS% -o jsonpath="{.spec.template.spec.containers[0].command}"
echo.
echo ================================================================

if not exist patch.json (
  echo KHONG TIM THAY patch.json trong thu muc nay!
  echo Dat patch.json vao cung thu muc voi file bat roi chay lai.
  pause
  exit /b 1
)

echo [1/3] Ap patch vao deployment ...
kubectl patch deploy %DEPLOY% -n %NS% --type=json --patch-file patch.json
if errorlevel 1 (
  echo PATCH THAT BAI!
  pause
  exit /b 1
)

echo [2/3] Cho rollout hoan tat ...
kubectl rollout status deploy %DEPLOY% -n %NS%

echo [3/3] Trang thai pod hien tai:
kubectl get pods -n %NS%

echo.
echo Neu pod chua Running, chay:
echo   kubectl logs -n %NS% -f ^<ten-pod^> --tail=50
pause
endlocal
