@echo off
chcp 65001 >nul
title ZangWang API Server

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js not found. Please install Node.js or add it to PATH.
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    echo [Error] Build failed.
    pause
    exit /b 1
)

echo Starting ZangWang API server...
start "ZangWangAPI" node server\api.js

echo Waiting for API server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 1; if($r.status -eq 'ok'){ $ok=$true; break } } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ok){ exit 1 }"
if %errorlevel% neq 0 (
    echo [Error] API server did not start. Please check the ZangWangAPI window.
    pause
    exit /b 1
)

start http://localhost:3000
exit /b 0
