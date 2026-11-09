@echo off
setlocal
cd /d "%~dp0"

echo Starting GameNet Plus Manager...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\start-gamenet.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Check logs\launcher.log and logs\server-error.log
  pause
)
