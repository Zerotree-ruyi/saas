@echo off
chcp 65001 >nul
title ZangWang API Server

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js not found
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    echo [Error] Build failed
    pause
    exit /b 1
)

start "ZangWangAPI" node server\api.js
start http://localhost:3000
exit
