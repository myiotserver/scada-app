@echo off
title SRIBOGA SCADA Application
echo =======================================================
echo    SRIBOGA - Weighing SCADA Dashboard
echo    Pioneer in Flour Innovation
echo =======================================================
echo.
echo [INFO] Starting SCADA server...
echo.

npm start

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Application failed to start or crashed.
    echo Please check if Node.js is installed and ports are free.
    pause
)
