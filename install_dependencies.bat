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
    echo You can now use start_scada.bat to run the application.
) else (
    echo [ERROR] Dependency installation failed.
    echo Please check your internet connection and Node.js installation.
)
echo.
pause
