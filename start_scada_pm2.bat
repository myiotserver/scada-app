@echo off
title SRIBOGA SCADA Production (PM2)
echo =======================================================
echo    SRIBOGA - Weighing SCADA Dashboard
echo    Production Start via PM2
echo =======================================================
echo.
echo [TIP] For first-time full deployment (PostgreSQL setup, .env,
echo       admin seeding, auto-start), run:  deploy_windows.bat
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
    call npm install
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
where pm2 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] PM2 not found. Installing PM2 globally...
    call npm install -g pm2
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] Failed to install PM2 globally.
        pause
        exit /b 1
    )
)

if not exist "logs" mkdir logs

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
call pm2 describe scada-app >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Process exists. Restarting with updated environment...
    call pm2 restart ecosystem.config.js --only scada-app --update-env
) else (
    echo [INFO] Starting process with PM2...
    call pm2 start ecosystem.config.js --only scada-app --env production
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to start SCADA app in PM2.
    pause
    exit /b 1
)

call pm2 save

echo.
echo [SUCCESS] SCADA is running under PM2.
call pm2 status scada-app
echo.
echo Use "pm2 logs scada-app" to monitor logs.
pause
