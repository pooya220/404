@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\GameNet Plus Manager.lnk') -Force -ErrorAction SilentlyContinue; Write-Host 'GameNet Plus Manager autostart removed.'"
pause
