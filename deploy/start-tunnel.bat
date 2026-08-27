@echo off
REM ============================================================
REM FPT DDI - Mo tunnel cong khai (kubectl port-forward + ngrok)
REM Domain co dinh: preseason-retrieval-abdomen.ngrok-free.dev
REM Yeu cau: kubectl da co kubeconfig (namespace ddi),
REM          ngrok.exe da duoc config authtoken (chay 1 lan truoc do)
REM ============================================================

set NGROK_DIR=C:\Users\DELL\Downloads\ngrok-v3-stable-windows-amd64
set NGROK_URL=preseason-retrieval-abdomen.ngrok-free.dev
set LOCAL_PORT=3000

echo === 1. Kiem tra kubectl ===
where kubectl >nul 2>&1
if errorlevel 1 (
  echo LOI: khong tim thay kubectl trong PATH.
  pause
  exit /b 1
)

echo === 2. Kiem tra pod web dang chay ===
kubectl -n ddi get deploy fpt-ddi-web

echo === 3. Mo cua so moi: port-forward svc/fpt-ddi-web %LOCAL_PORT%:3000 ===
start "fpt-ddi-portforward" cmd /k kubectl -n ddi port-forward svc/fpt-ddi-web %LOCAL_PORT%:3000

echo === Cho port-forward san sang (8 giay) ===
timeout /t 8 /nobreak >nul

echo === 4. Mo ngrok voi domain co dinh ===
echo === Ctrl+C de tat ngrok. Cua so port-forward tu dong tat khi dong ===
echo.
"%NGROK_DIR%\ngrok.exe" http %LOCAL_PORT% --url=%NGROK_URL%

echo.
echo === Tat cua so port-forward ===
taskkill /FI "WINDOWTITLE eq fpt-ddi-portforward*" /T /F >nul 2>&1
pause
