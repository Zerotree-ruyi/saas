@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*server\api.js*' -or $_.CommandLine -like '*server/api.js*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo ZangWang API server stopped
pause
