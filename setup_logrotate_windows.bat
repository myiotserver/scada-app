@echo off
title SCADA Log Rotation Setup (Windows)
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔══════════════════════════════════════════════════════════╗
echo ║       SCADA - Log Rotation Setup (Windows)             ║
echo ║       Rollover Bulanan via PM2 Logrotate               ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo [INFO] Memeriksa PM2...

where pm2 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PM2 tidak ditemukan.
    echo         Jalankan setup_windows.bat terlebih dahulu.
    pause
    exit /b 1
)

:: ============================================================
:: STEP 1: Cek / Install pm2-logrotate
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 1/2: Memeriksa pm2-logrotate ...
echo ────────────────────────────────────────────────────────

pm2 show pm2-logrotate >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] Menginstall pm2-logrotate...
    call pm2 install pm2-logrotate
    if !ERRORLEVEL! neq 0 (
        echo [✗] Gagal menginstall pm2-logrotate.
        echo     Pastikan:
        echo      1. Koneksi internet aktif
        echo      2. Jalankan sebagai Administrator
        pause
        exit /b 1
    )
    echo [✓] pm2-logrotate berhasil diinstall.
) else (
    echo [✓] pm2-logrotate sudah terinstall.
)

:: ============================================================
:: STEP 2: Konfigurasi Rotasi Bulanan
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 2/2: Mengkonfigurasi rotasi bulanan ...
echo ────────────────────────────────────────────────────────

:: Retensi: simpan 12 file arsip (12 bulan)
call pm2 set pm2-logrotate:retain 12
echo [✓] Retensi: 12 bulan

:: Kompresi file lama dengan gzip
call pm2 set pm2-logrotate:compress true
echo [✓] Kompresi: aktif (.gz)

:: Format tanggal untuk file hasil rotasi
call pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
echo [✓] Format tanggal: YYYY-MM-DD

:: Rotasi paksa setiap bulan (cron: tiap tanggal 1 jam 00:00)
call pm2 set pm2-logrotate:rotateInterval "0 0 1 * *"
echo [✓] Rotasi terjadwal: setiap tanggal 1

:: Maks ukuran file sebelum rotasi paksa (100MB)
call pm2 set pm2-logrotate:max_size 100M
echo [✓] Max ukuran file: 100 MB

:: Interval pengecekan tiap 1 jam
call pm2 set pm2-logrotate:workerInterval 3600
echo [✓] Interval pengecekan: setiap 1 jam

:: ============================================================
:: SELESAI
:: ============================================================
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       KONFIGURASI SELESAI                              ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo  Ringkasan Konfigurasi:
echo  ───────────────────────────────────────────────
echo   Metode       : pm2-logrotate (module PM2)
echo   Rotasi       : Bulanan (tiap tanggal 1)
echo   Retensi      : 12 file arsip
echo   Kompresi     : Ya (format .gz)
echo   Max file     : 100 MB (rotasi otomatis jika penuh)
echo   Output       : pm2-out.log.2026-01-01.gz
echo                  pm2-error.log.2026-01-01.gz
echo.
echo  Perintah Berguna:
echo  ───────────────────────────────────────────────
echo   Lihat konfigurasi  : pm2 conf pm2-logrotate
echo   Test rotasi manual : pm2 rotate
echo   Lihat status modul : pm2 show pm2-logrotate
echo.
echo  [✓] Selesai! Log akan dirotasi otomatis setiap bulan.
echo.
pause
