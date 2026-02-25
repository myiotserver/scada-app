@echo off
title Setup PM2 Auto Start (Windows)
echo =======================================================
echo  Setup PM2 resurrect on Windows logon
echo =======================================================
echo.

where pm2.cmd >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PM2 is not installed. Run start_scada_pm2.bat first.
    pause
    exit /b 1
)

set "TASK_NAME=SCADA_PM2_RESURRECT"
set "TASK_CMD=%ComSpec% /c cd /d \"%CD%\" ^&^& pm2.cmd resurrect"

schtasks /Create /SC ONLOGON /TN "%TASK_NAME%" /TR "%TASK_CMD%" /RL HIGHEST /F >nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] HIGHEST privilege denied. Retrying with LIMITED privilege...
    schtasks /Create /SC ONLOGON /TN "%TASK_NAME%" /TR "%TASK_CMD%" /RL LIMITED /F >nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create startup task.
        echo Try running this script as Administrator.
        pause
        exit /b 1
    )
)

echo [SUCCESS] Task "%TASK_NAME%" created.
echo PM2 apps will be restored at next Windows logon.
echo.
echo Tip:
echo 1. After any PM2 change, run: pm2 save
echo 2. To check task: schtasks /Query /TN "%TASK_NAME%"
pause
