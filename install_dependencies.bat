@echo off
title SRIBOGA SCADA Setup
echo =======================================================
echo    SRIBOGA - Weighing SCADA Dashboard
echo    Initial Dependency Installation
echo =======================================================
echo.
echo [INFO] Installing required Node.js packages...
echo.

npm install

echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] All dependencies installed correctly.
    echo.
    echo =======================================================
    echo  NOTE: For a FULL one-click setup including:
    echo    - PostgreSQL database ^& user creation
    echo    - .env configuration file generation
    echo    - Admin user seeding
    echo    - PM2 startup ^& Windows auto-start
    echo.
    echo  Please run:   deploy_windows.bat
    echo =======================================================
    echo.
    echo You can also use start_scada.bat to run the application now.
) else (
    echo [ERROR] Dependency installation failed.
    echo Please check your internet connection and Node.js installation.
)
echo.
pause
