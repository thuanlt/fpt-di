@echo off
cd /d "C:\Users\DELL\Downloads\ngrok-v3-stable-windows-amd64"
echo === Dang dung authtoken cho ngrok ===
"C:\Users\DELL\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" config add-authtoken 3IRyTiIf6JgBs9Y1lfDpSikvtWG_775z34eNFPhS9HChEL8o8
echo.
echo === Dang mo tunnel http://localhost:3000 ===
echo === Ctrl+C de dang, giang cua so nay mo ===
echo.
"C:\Users\DELL\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 3000
pause
