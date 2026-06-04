@echo off
title SRIBOGA SCADA - One-Click Deployment
cd /d "%~dp0"

setlocal enabledelayedexpansion

:: ============================================================
::  SRIBOGA - Weighing SCADA Dashboard
::  One-Click Deployment Script for Windows
::  Automates: PostgreSQL setup, .env config, npm install,
::  admin seeding, PM2 startup, and auto-start on boot.
:: ============================================================

echo ╔══════════════════════════════════════════════════════════╗
echo ║       SRIBOGA - WeIGHING SCADA DASHBOARD               ║
echo ║       PIONEER IN FLOUR INNOVATION                      ║
echo ║       One-Click Deployment                             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo [INFO] Starting deployment at %DATE% %TIME%
echo.

:: ============================================================
:: STEP 0: Check Administrator Privileges
:: ============================================================
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ⚠  This script needs Administrator privileges.
    echo    Please right-click and select "Run as Administrator".
    echo.
    pause
    exit /b 1
)
echo [✓] Administrator privilege detected.
echo.

:: ============================================================
:: STEP 1: Check Node.js
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 1/8: Checking Node.js ...
echo ────────────────────────────────────────────────────────

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo [✗] Node.js is NOT installed!
    echo.
    echo    Please install Node.js v18 or later from:
    echo    https://nodejs.org/
    echo.
    echo    After installation, restart this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1-3 delims=v." %%a in ('node -v') do set NODE_VER=%%b
if !NODE_VER! LSS 18 (
    echo [✗] Node.js v%NODE_VER% detected. Minimum required: v18.
    echo    Please upgrade from https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js v%NODE_VER% detected.
echo.

:: ============================================================
:: STEP 2: Check / Install PM2 Globally
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 2/8: Setting up PM2 process manager ...
echo ────────────────────────────────────────────────────────

where pm2 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] PM2 not found. Installing PM2 globally...
    call npm install -g pm2
    if !ERRORLEVEL! neq 0 (
        echo [✗] Failed to install PM2. Check npm and internet.
        pause
        exit /b 1
    )
    echo [✓] PM2 installed globally.
) else (
    echo [✓] PM2 already installed.
)
echo.

:: ============================================================
:: STEP 3: Check PostgreSQL
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 3/8: Checking PostgreSQL ...
echo ────────────────────────────────────────────────────────

set PG_INSTALLED=0
where psql >nul 2>&1
if !ERRORLEVEL! equ 0 set PG_INSTALLED=1

if !PG_INSTALLED! equ 1 (
    echo [✓] PostgreSQL (psql) detected.
) else (
    echo [⚠] PostgreSQL CLI (psql) not found in PATH.
    echo.
    echo    Checking PostgreSQL service ...
    
    sc query postgresql-x64-16 >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo [✓] PostgreSQL service detected (may still need psql in PATH).
        set PG_INSTALLED=1
    ) else (
        sc query postgresql-x64-15 >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            echo [✓] PostgreSQL service detected.
            set PG_INSTALLED=1
        )
    )
)

if !PG_INSTALLED! equ 0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════╗
    echo ║  POSTGRESQL NOT FOUND                                   ║
    echo ║                                                        ║
    echo ║  This application requires PostgreSQL for user          ║
    echo ║  authentication. Please install it first:               ║
    echo ║                                                        ║
    echo ║  1. Download from: https://www.postgresql.org/download/ ║
    echo ║  2. Install with default port (5432)                    ║
    echo ║  3. Set password for 'postgres' user (remember it!)     ║
    echo ║  4. Run this script again after installation            ║
    echo ╚══════════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)
echo.

:: ============================================================
:: STEP 4: Ask for PostgreSQL superuser password
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 4/8: PostgreSQL Database Setup ...
echo ────────────────────────────────────────────────────────

echo.
echo    We will now create:
echo      - Database  : scada_db
echo      - User      : scada_user
echo      - Password  : (auto-generated if not provided)
echo.
echo    Enter the PostgreSQL superuser (postgres) password below.
echo    ⚠  The password will NOT be visible while typing.
echo.

:: Generate a random password for scada_user
set "PG_SCADA_PASSWORD="
for /f "delims=" %%a in ('powershell -Command "Write-Host -NoNewline ([char[]](46..57 + 65..90 + 97..122) ^| Get-Random -Count 16 ^| ForEach-Object {[char]$_}) -join ''"') do set "PG_SCADA_PASSWORD=%%a"
if "!PG_SCADA_PASSWORD!"=="" set "PG_SCADA_PASSWORD=ScadaUser@2026!"

:: Ask for postgres admin password
set "PG_SUPER_PASSWORD="
set /P PG_SUPER_PASSWORD=Enter postgres superuser password (leave empty for default 'postgres'): 

if "!PG_SUPER_PASSWORD!"=="" set "PG_SUPER_PASSWORD=postgres"

echo.
echo [*] Creating database and user... (this may take a moment)

:: Find psql path for pipe
set "PSQL_PATH="
where psql >nul 2>&1
if !ERRORLEVEL! equ 0 (
    for /f "delims=" %%a in ('where psql') do set "PSQL_PATH=%%a"
)

if "!PSQL_PATH!"=="" (
    :: Try common install paths
    for %%p in (
        "C:\Program Files\PostgreSQL\16\bin\psql.exe"
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
        "C:\Program Files\PostgreSQL\13\bin\psql.exe"
    ) do (
        if exist "%%~p" set "PSQL_PATH=%%~p"
    )
)

if "!PSQL_PATH!"=="" (
    echo [✗] Cannot find psql.exe. Please add PostgreSQL bin folder to PATH.
    pause
    exit /b 1
)

echo [*] Using psql: !PSQL_PATH!
echo.

:: Create the database, user, and grant privileges using psql
(
    echo SELECT 'CREATE DATABASE scada_db'
    echo WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'scada_db'^)\gexec
    echo.
    echo DO $do$
    echo BEGIN
    echo    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'scada_user'^) THEN
    echo        CREATE ROLE scada_user LOGIN PASSWORD '!PG_SCADA_PASSWORD!';
    echo    ELSE
    echo        ALTER ROLE scada_user WITH PASSWORD '!PG_SCADA_PASSWORD!';
    echo    END IF;
    echo END
    echo $do$;
    echo.
    echo GRANT ALL PRIVILEGES ON DATABASE scada_db TO scada_user;
    echo GRANT ALL ON SCHEMA public TO scada_user;
    echo ALTER SCHEMA public OWNER TO scada_user;
) > "%TEMP%\scada_setup.sql"

"!PSQL_PATH!" -h localhost -U postgres -d postgres -f "%TEMP%\scada_setup.sql" < nul
if !ERRORLEVEL! neq 0 (
    echo.
    echo [⚠] PostgreSQL setup may have failed. This could mean:
    echo      - The database/user already exists (OK!^)
    echo      - Wrong postgres password
    echo      - PostgreSQL service is not running
    echo.
    echo    Attempting to continue anyway...
    echo
    echo    ⚠  NOTE: If database/user creation failed, you will need to
    echo       create them manually or fix PostgreSQL access.
    echo.
)

del "%TEMP%\scada_setup.sql" 2>nul

echo [✓] PostgreSQL database and user configured.
echo.

:: ============================================================
:: STEP 5: Generate .env file
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 5/8: Generating .env configuration ...
echo ────────────────────────────────────────────────────────

:: Generate a strong JWT secret
set "JWT_SECRET="
for /f "delims=" %%a in ('powershell -Command "$s = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64); Write-Host -NoNewline (($s ^| ForEach-Object {$_.ToString('x2')}) -join '')"') do set "JWT_SECRET=%%a"

if "!JWT_SECRET!"=="" set "JWT_SECRET=53f1ca800741353c5ae7a34a11f98413642445df90ba9fe37d6fc4575e23bf0b422d949fcd3f1caae28c6c75699e256e0aed96a0234656b22bc7e485d970c2a0"

(
echo # SRIBOGA SCADA - Environment Configuration
echo # Auto-generated by deploy_windows.bat on %DATE% %TIME%
echo.
echo # --- Application ---
echo NODE_ENV=production
echo PORT=3001
echo JWT_SECRET=!JWT_SECRET!
echo.
echo # --- PostgreSQL (User Authentication^) ---
echo PGHOST=localhost
echo PGUSER=scada_user
echo PGPASSWORD=!PG_SCADA_PASSWORD!
echo PGDATABASE=scada_db
echo POSTGRES_HOST=localhost
echo POSTGRES_USER=scada_user
echo POSTGRES_PASSWORD=!PG_SCADA_PASSWORD!
echo POSTGRES_DB=scada_db
echo.
echo # --- MSSQL (Weighing Data^) ---
echo # ⚠  Change these values according to your SQL Server configuration!
echo MSSQL_SERVER=100.127.239.116
echo MSSQL_USER=sa
echo MSSQL_PASSWORD=VPS@thinkcentre
echo MSSQL_DATABASE=SFM Main
echo MSSQL_PORT=1433
echo MSSQL_ENCRYPT=false
echo MSSQL_TRUST_CERT=true
echo.
echo # --- SCADA Default Admin ---
echo SCADA_AUTO_SEED_ADMIN=true
echo SCADA_DEFAULT_ADMIN_USER=admin
echo SCADA_DEFAULT_ADMIN_PASSWORD=12345678
echo SCADA_DEFAULT_ADMIN_EMAIL=admin@scada.local
echo.
echo # --- OPC UA ---
echo OPCUA_AUTO_CONNECT=true
echo.
echo # --- SQL Auto-Reconnect ---
echo SCADA_SQL_AUTO_CONNECT=true
echo.
echo # --- Sensor Configuration ---
echo SENSOR_WEIGHT_CAPTURE_DELAY_MS=100
echo SENSOR_MIN_GAP_MS=1500
echo MIN_VALID_GROSS_KG=1
echo ZEROING_CAPTURE_DELAY_MS=500
) > ".env"

echo [✓] .env file generated.
echo     PostgreSQL user password: !PG_SCADA_PASSWORD!
echo     ⚠  Please save this password for future reference!
echo.

:: ============================================================
:: STEP 6: Install npm dependencies
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 6/8: Installing npm dependencies ...
echo ────────────────────────────────────────────────────────

echo [*] This may take a few minutes. Please wait...
echo.

call npm install
if !ERRORLEVEL! neq 0 (
    echo.
    echo [✗] npm install failed. Check your internet connection.
    pause
    exit /b 1
)

echo [✓] Dependencies installed.
echo.

:: ============================================================
:: STEP 7: Create logs directory and seed admin
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 7/8: Setting up application data ...
echo ────────────────────────────────────────────────────────

if not exist "logs" mkdir logs

echo [*] Seeding default admin user (admin / 12345678)...
node seed-admin.js
if !ERRORLEVEL! neq 0 (
    echo [⚠] Admin seed may have warnings (OK if admin already exists^).
) else (
    echo [✓] Admin seed completed.
)
echo.

:: ============================================================
:: STEP 8: Start with PM2 and setup auto-start
:: ============================================================
echo ────────────────────────────────────────────────────────
echo  STEP 8/8: Starting application with PM2 ...
echo ────────────────────────────────────────────────────────

:: Kill any existing process
call pm2 delete scada-app >nul 2>&1

:: Start with PM2
echo [*] Starting SCADA application...
call pm2 start ecosystem.config.js --only scada-app --env production
if !ERRORLEVEL! neq 0 (
    echo [✗] Failed to start application.
    pause
    exit /b 1
)

:: Save PM2 state
call pm2 save
echo [✓] PM2 state saved.
echo.

:: Setup PM2 auto-start on Windows logon
echo [*] Setting up auto-start on Windows logon...
set "TASK_NAME=SCADA_PM2_RESURRECT"
set "TASK_CMD=%ComSpec% /c cd /d \"%CD%\" ^&^& pm2.cmd resurrect"

schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    schtasks /Delete /TN "%TASK_NAME%" /F >nul
)

schtasks /Create /SC ONLOGON /TN "%TASK_NAME%" /TR "%TASK_CMD%" /RL HIGHEST /F >nul
if !ERRORLEVEL! neq 0 (
    schtasks /Create /SC ONLOGON /TN "%TASK_NAME%" /TR "%TASK_CMD%" /RL LIMITED /F >nul
    if !ERRORLEVEL! neq 0 (
        echo [⚠] Could not create auto-start task (non-admin?^). App will still run now.
    ) else (
        echo [✓] Auto-start task created (limited privilege^).
    )
) else (
    echo [✓] Auto-start task created.
)
echo.

:: ============================================================
:: DONE
:: ============================================================
echo ╔══════════════════════════════════════════════════════════╗
echo ║                    DEPLOYMENT COMPLETE                  ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                        ║
echo ║  SCADA Dashboard is now RUNNING at:                    ║
echo ║                                                        ║
echo ║       http://localhost:3001                             ║
echo ║                                                        ║
echo ║  Login Credentials:                                    ║
echo ║       Username : admin                                 ║
echo ║       Password : 12345678                              ║
echo ║                                                        ║
echo ║  IMPORTANT: Change password after first login!         ║
echo ║                                                        ║
echo ║  PostgreSQL scada_user password: !PG_SCADA_PASSWORD!    ║
echo ║                                                        ║
echo ║  Useful Commands:                                      ║
echo ║       pm2 logs scada-app    - View logs                ║
echo ║       pm2 stop scada-app    - Stop application         ║
echo ║       pm2 restart scada-app - Restart application      ║
echo ║       pm2 status            - Check process status     ║
echo ║                                                        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Show PM2 status
call pm2 status scada-app
echo.

echo Press any key to open the dashboard in your browser ...
pause >nul
start http://localhost:3001

endlocal
