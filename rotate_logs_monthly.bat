@echo off
title SCADA Log Rotation - Rotate Monthly, Keep 1 Month
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM SCADA Log Rotation Script (Windows)
REM  - Rotates pm2-out.log and pm2-error.log once per month
REM  - Keeps 1 month of archived logs (1 file each)
REM  - Truncates the active log after archiving
REM  - Designed to be run by Windows Task Scheduler (monthly)
REM ============================================================

echo ============================================================
echo  SCADA Log Rotation - %date% %time%
echo ============================================================

set "LOG_DIR=%~dp0logs"
set "ARCHIVE_DIR=%LOG_DIR%\archive"
set "SCRIPTS_DIR=%~dp0scripts"
set "CLEAN_PS=%SCRIPTS_DIR%\clean_old_archives.ps1"

REM Create archive folder if it doesn't exist
if not exist "%ARCHIVE_DIR%" (
    mkdir "%ARCHIVE_DIR%"
    echo [INFO] Created archive directory: %ARCHIVE_DIR%
)

REM Build timestamp suffix (YYYY-MM) using PowerShell (wmic is deprecated on modern Windows)
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM'"`) do set "STAMP=%%I"

echo [INFO] Archive stamp: %STAMP%
echo.

REM ============================================================
REM STEP 1: Delete archive files older than 1 month
REM  (Delegated to clean_old_archives.ps1 for reliable YYYY-MM parsing
REM   and to avoid batch quoting/escaping issues with paths containing spaces.)
REM ============================================================
echo [STEP 1] Cleaning archives older than 1 month...
set "DEL_LIST=%TEMP%\scada_log_del_%RANDOM%.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "%CLEAN_PS%" -ArchiveDir "%ARCHIVE_DIR%" -CurrentStamp "%STAMP%" > "%DEL_LIST%" 2>nul
set "DELETED=0"
if exist "%DEL_LIST%" (
    for /f "usebackq delims=" %%I in ("%DEL_LIST%") do (
        set "LINE=%%I"
        if /i "!LINE:~0,7!"=="DELETED" (
            echo   [DEL] !LINE:~8!
            set /a DELETED+=1
        )
    )
    del /f /q "%DEL_LIST%" >nul 2>&1
)
echo   [OK] Deleted !DELETED! old archive(s)
echo.

REM ============================================================
REM STEP 2: Ask PM2 to release log handles BEFORE we move the files
REM ============================================================
echo [STEP 2] Asking PM2 to release log handles...
call pm2 reloadLogs >nul 2>&1
echo   [OK] PM2 log handles released
echo.

REM ============================================================
REM STEP 3: Archive current logs (move) and truncate original
REM ============================================================
echo [STEP 3] Archiving current logs...

set "ROTATED=0"

if exist "%LOG_DIR%\pm2-out.log" (
    REM Delete any pre-existing target archive (shouldn't happen, but safe)
    if exist "%ARCHIVE_DIR%\pm2-out.log.%STAMP%" del /f /q "%ARCHIVE_DIR%\pm2-out.log.%STAMP%" >nul 2>&1
    move /y "%LOG_DIR%\pm2-out.log" "%ARCHIVE_DIR%\pm2-out.log.%STAMP%" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        REM Create fresh empty log file
        type nul > "%LOG_DIR%\pm2-out.log"
        echo   [OK] pm2-out.log -^> pm2-out.log.%STAMP%
        set /a ROTATED+=1
    ) else (
        echo   [WARN] Failed to rotate pm2-out.log
    )
)

if exist "%LOG_DIR%\pm2-error.log" (
    if exist "%ARCHIVE_DIR%\pm2-error.log.%STAMP%" del /f /q "%ARCHIVE_DIR%\pm2-error.log.%STAMP%" >nul 2>&1
    move /y "%LOG_DIR%\pm2-error.log" "%ARCHIVE_DIR%\pm2-error.log.%STAMP%" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        type nul > "%LOG_DIR%\pm2-error.log"
        echo   [OK] pm2-error.log -^> pm2-error.log.%STAMP%
        set /a ROTATED+=1
    ) else (
        echo   [WARN] Failed to rotate pm2-error.log
    )
)

echo   [OK] Rotated !ROTATED! file(s)
echo.

REM ============================================================
REM STEP 4: Reload PM2 so it picks up the fresh empty files
REM ============================================================
echo [STEP 4] Reloading PM2 to reopen log handles...
call pm2 reloadLogs >nul 2>&1
echo   [OK] PM2 log handles reopened
echo.

REM ============================================================
REM Summary
REM ============================================================
echo ============================================================
echo  Rotation complete at %time%
echo  Archive folder: %ARCHIVE_DIR%
echo ============================================================
echo.
echo  Current archives:
dir /b "%ARCHIVE_DIR%" 2>nul
echo.
echo  Active log sizes:
for %%F in (pm2-out.log pm2-error.log) do (
    if exist "%LOG_DIR%\%%F" (
        for %%A in ("%LOG_DIR%\%%F") do echo   %%F : %%~zA bytes
    )
)
echo.
endlocal
exit /b 0
