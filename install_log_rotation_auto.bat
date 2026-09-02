@echo off
title SCADA Log Rotation Installer (Windows Task Scheduler) - AUTO MODE
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo  SCADA Monthly Log Rotation - Installer (NON-INTERACTIVE)
echo ============================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROTATE_SCRIPT=%SCRIPT_DIR%rotate_logs_monthly.bat"
set "TASK_NAME=SCADA-LogRotation-Monthly"

if not exist "%ROTATE_SCRIPT%" (
    echo [ERROR] File rotate_logs_monthly.bat tidak ditemukan di:
    echo         %ROTATE_SCRIPT%
    exit /b 1
)

echo [INFO] Rotate script : %ROTATE_SCRIPT%
echo [INFO] Task name     : %TASK_NAME%
echo.

echo [STEP 1/2] Removing old task (if any)...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
echo   [OK] Old task removed (or none existed)
echo.

echo [STEP 2/2] Creating scheduled task (1st of each month, 00:30)...
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%ROTATE_SCRIPT%\"" ^
    /sc monthly ^
    /d 1 ^
    /st 00:30 ^
    /ru SYSTEM ^
    /rl HIGHEST ^
    /f

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gagal membuat scheduled task.
    echo         Pastikan dijalankan sebagai Administrator.
    exit /b 1
)
echo   [OK] Task created successfully
echo.

echo ============================================================
echo  INSTALLATION COMPLETE
echo ============================================================
echo.
echo  Ringkasan:
echo  ---------------------------------------------------
echo   Schedule        : Setiap tanggal 1, jam 00:30
echo   Script          : %ROTATE_SCRIPT%
echo   Archive folder  : %SCRIPT_DIR%logs\archive
echo   Retention       : 1 bulan (file bulan lalu otomatis dihapus)
echo   Action          : Archive + truncate pm2-out.log & pm2-error.log
echo.
echo  Perintah Berguna:
echo  ---------------------------------------------------
echo   Lihat task      : schtasks /query /tn "%TASK_NAME%" /v
echo   Hapus task      : schtasks /delete /tn "%TASK_NAME%" /f
echo   Run manual      : schtasks /run /tn "%TASK_NAME%"
echo   Lihat arsip     : dir "%SCRIPT_DIR%logs\archive"
echo.
endlocal
exit /b 0
