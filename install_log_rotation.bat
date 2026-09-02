@echo off
title SCADA Log Rotation Installer (Windows Task Scheduler)
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo  SCADA Monthly Log Rotation - Installer
echo ============================================================
echo.

REM ============================================================
REM STEP 0: Require Administrator
REM ============================================================
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Script ini harus dijalankan sebagai Administrator
    echo         (Task Scheduler butuh hak admin untuk membuat task).
    echo.
    echo  Klik kanan file ini -^> Run as administrator
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "ROTATE_SCRIPT=%SCRIPT_DIR%rotate_logs_monthly.bat"
set "TASK_NAME=SCADA-LogRotation-Monthly"

if not exist "%ROTATE_SCRIPT%" (
    echo [ERROR] File rotate_logs_monthly.bat tidak ditemukan di:
    echo         %ROTATE_SCRIPT%
    pause
    exit /b 1
)

echo [INFO] Rotate script : %ROTATE_SCRIPT%
echo [INFO] Task name     : %TASK_NAME%
echo.

REM ============================================================
REM STEP 1: Remove existing task if present (clean reinstall)
REM ============================================================
echo [STEP 1/3] Removing old task (if any)...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
echo   [OK] Old task removed (or none existed)
echo.

REM ============================================================
REM STEP 2: Create new scheduled task
REM  - Runs on the 1st of every month at 00:30
REM  - Runs as SYSTEM (no password prompts)
REM  - Highest privileges
REM ============================================================
echo [STEP 2/3] Creating scheduled task (1st of each month, 00:30)...
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
    pause
    exit /b 1
)
echo   [OK] Task created successfully
echo.

REM ============================================================
REM STEP 3: Verify task
REM ============================================================
echo [STEP 3/3] Verifying task...
schtasks /query /tn "%TASK_NAME%" /v /fo list 2>nul | findstr /C:"Task To Run:" /C:"Schedule Type:" /C:"Start Time:" /C:"Days:"
echo.

REM ============================================================
REM STEP 4: Test run (optional)
REM ============================================================
echo ============================================================
echo  Apakah ingin menjalankan rotasi SEKARANG untuk testing?
echo  (kosongkan / ketik N untuk skip)
echo ============================================================
set /p "TEST=Run test rotation now? [Y/N]: "
if /i "!TEST!"=="Y" (
    echo.
    echo [TEST] Running rotate_logs_monthly.bat ...
    echo.
    call "%ROTATE_SCRIPT%"
) else (
    echo   [SKIP] Test tidak dijalankan. Task akan berjalan otomatis tanggal 1.
)

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
echo  Log di Windows Event Viewer:
echo   Applications and Services Logs -^> Microsoft -^> Windows -^> TaskScheduler
echo ============================================================
echo.
pause
endlocal
exit /b 0
