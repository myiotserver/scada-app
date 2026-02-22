@echo off
title Stop SRIBOGA SCADA (PM2)
echo [INFO] Stopping PM2 process scada-app...
pm2 stop scada-app
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to stop process. Check pm2 status manually.
    pause
    exit /b 1
)

pm2 save
echo [SUCCESS] Process stopped and PM2 state saved.
pause
