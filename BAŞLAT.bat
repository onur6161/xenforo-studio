@echo off
chcp 65001 >nul
title GUNNERIUS - Gelistirme Modu

:: Eğer arka planda açık kalmış eski bir kopya varsa kapat
taskkill /F /IM turkceyama-studio.exe >nul 2>&1
taskkill /F /IM GUNNERIUS.exe >nul 2>&1

:: WebView kilit dosyasını temizle
if exist "%LOCALAPPDATA%\com.gunnerius.portal\EBWebView\lockfile" (
    del /f /q "%LOCALAPPDATA%\com.gunnerius.portal\EBWebView\lockfile" >nul 2>&1
)

cd /d "C:\Users\Drayq\OneDrive\Desktop\gunnerius"
set "PATH=C:\Users\Drayq\.cargo\bin;C:\Program Files\nodejs;%PATH%"

echo ===================================================
echo     GUNNERIUS - Forum Yonetim Portali Baslatiliyor
echo ===================================================
call npm run tauri dev
pause
