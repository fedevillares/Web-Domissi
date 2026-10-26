@echo off
chcp 65001 >nul
echo Actualizando fotos de productos...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\tools\fotos.ps1"
echo.
pause
