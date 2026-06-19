@echo off
setlocal

set "APP_DIR=%~dp0"
set "LOG_DIR=%APP_DIR%logs"
set "LOG_FILE=%LOG_DIR%\pm2-startup.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ====================================================== >> "%LOG_FILE%"
echo Startup attempt: %DATE% %TIME% >> "%LOG_FILE%"
echo App dir: %APP_DIR% >> "%LOG_FILE%"
echo Waiting 45 seconds for Windows services/network... >> "%LOG_FILE%"
timeout /t 45 /nobreak >nul

cd /d "%APP_DIR%"

echo Running as user: %USERNAME% >> "%LOG_FILE%"
where pm2.cmd >> "%LOG_FILE%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pm2.cmd not found in Task Scheduler environment. >> "%LOG_FILE%"
    exit /b 1
)

echo Running pm2 resurrect... >> "%LOG_FILE%"
call pm2.cmd resurrect >> "%LOG_FILE%" 2>&1
set "RESURRECT_RC=%ERRORLEVEL%"

echo pm2 resurrect exit code: %RESURRECT_RC% >> "%LOG_FILE%"
echo Current pm2 status: >> "%LOG_FILE%"
call pm2.cmd status >> "%LOG_FILE%" 2>&1

exit /b %RESURRECT_RC%
