@echo off
chcp 65001 >nul
title GUNNERIUS - Otomatik Sürüm Yayınlayıcı
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish_release.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Bir hata olustu. Detaylar yukaridadir.
    echo.
)
pause
