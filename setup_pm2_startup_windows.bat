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

if not exist "logs" mkdir logs

set "TASK_NAME=SCADA_PM2_RESURRECT"
set "STARTUP_RUNNER=%CD%\run_pm2_resurrect_windows.bat"
set "TASK_CMD=%ComSpec% /c ""%STARTUP_RUNNER%"""

echo [INFO] Writing startup runner: "%STARTUP_RUNNER%"
(
    echo @echo off
    echo setlocal
    echo set "APP_DIR=%%~dp0"
    echo set "LOG_DIR=%%APP_DIR%%logs"
    echo set "LOG_FILE=%%LOG_DIR%%\pm2-startup.log"
    echo if not exist "%%LOG_DIR%%" mkdir "%%LOG_DIR%%"
    echo echo ====================================================== ^>^> "%%LOG_FILE%%"
    echo echo Startup attempt: %%DATE%% %%TIME%% ^>^> "%%LOG_FILE%%"
    echo echo App dir: %%APP_DIR%% ^>^> "%%LOG_FILE%%"
    echo echo Waiting 45 seconds for Windows services/network... ^>^> "%%LOG_FILE%%"
    echo timeout /t 45 /nobreak ^>nul
    echo cd /d "%%APP_DIR%%"
    echo echo Running as user: %%USERNAME%% ^>^> "%%LOG_FILE%%"
    echo where pm2.cmd ^>^> "%%LOG_FILE%%" 2^>^&1
    echo if %%ERRORLEVEL%% neq 0 ^(
    echo     echo [ERROR] pm2.cmd not found in Task Scheduler environment. ^>^> "%%LOG_FILE%%"
    echo     exit /b 1
    echo ^)
    echo echo Running pm2 resurrect... ^>^> "%%LOG_FILE%%"
    echo call pm2.cmd resurrect ^>^> "%%LOG_FILE%%" 2^>^&1
    echo set "RESURRECT_RC=%%ERRORLEVEL%%"
    echo echo pm2 resurrect exit code: %%RESURRECT_RC%% ^>^> "%%LOG_FILE%%"
    echo echo Current pm2 status: ^>^> "%%LOG_FILE%%"
    echo call pm2.cmd status ^>^> "%%LOG_FILE%%" 2^>^&1
    echo exit /b %%RESURRECT_RC%%
) > "%STARTUP_RUNNER%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to write startup runner.
    pause
    exit /b 1
)

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
echo Startup log will be written to: logs\pm2-startup.log
echo.
echo Tip:
echo 1. After any PM2 change, run: pm2 save
echo 2. To check task: schtasks /Query /TN "%TASK_NAME%"
echo 3. To test now: run_pm2_resurrect_windows.bat
pause
