@echo off
title SRIBOGA SCADA Application
echo =======================================================
echo    SRIBOGA - Weighing SCADA Dashboard
echo    Pioneer in Flour Innovation
echo =======================================================
echo.

REM Ensure dependencies are installed (only if node_modules is missing/empty)
set "NEED_INSTALL=0"
if not exist "node_modules" (
    set "NEED_INSTALL=1"
) else (
    dir /b "node_modules" 2>nul | findstr . >nul || set "NEED_INSTALL=1"
)

if "%NEED_INSTALL%"=="1" (
    echo [INFO] node_modules not found or empty. Installing dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Dependencies already installed.
)

echo.
echo [INFO] Running admin seed...
node seed-admin.js
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to run seed-admin.js.
    pause
    exit /b 1
)

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
