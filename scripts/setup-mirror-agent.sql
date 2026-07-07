-- ============================================================================
-- PRESET_TABLE Mirror Agent Setup
-- Deploy ke MS-SQL Container (target) untuk mirroring dari source MSSQL
-- ============================================================================
-- Cara deploy via Node.js (pakai mssql package):
--   node -e "const sql=require('mssql');(async()=>{const p=await sql.connect({...});await p.request().query(require('fs').readFileSync('scripts/setup-mirror-agent.sql','utf8'));await p.close()})()"
-- ============================================================================

SET NOCOUNT ON;

-- ----------------------------------------------------------------------------
-- CONFIG: Sesuaikan nilai di bawah
-- ----------------------------------------------------------------------------
DECLARE @SourceServer   NVARCHAR(128) = '100.127.239.116,1433';
DECLARE @SourceUser     NVARCHAR(128) = 'sa';
DECLARE @SourcePass     NVARCHAR(128) = 'VPS@thinkcentre';
DECLARE @DatabaseName   NVARCHAR(128) = DB_NAME();
DECLARE @LinkedServer   NVARCHAR(128) = 'SRC_MSSQL';
DECLARE @JobName        NVARCHAR(128) = 'PRESET_TABLE_MIRROR';
DECLARE @ScheduleName   NVARCHAR(128) = 'PRESET_TABLE_MIRROR_SCHEDULE';
DECLARE @SyncIntervalSec INT = 30;

-- Helper: execute dynamic SQL with error handling
DECLARE @SQL NVARCHAR(MAX);
DECLARE @ErrMsg NVARCHAR(MAX);

-- ----------------------------------------------------------------------------
-- 1. Enable SQL Server Agent
-- ----------------------------------------------------------------------------
DECLARE @agent_enabled INT;
EXEC master.dbo.xp_instance_regread
    N'HKEY_LOCAL_MACHINE',
    N'SYSTEM\CurrentControlSet\Services\SQLSERVERAGENT',
    N'Start',
    @agent_enabled OUTPUT;

IF (@agent_enabled IS NULL OR @agent_enabled <> 2)
BEGIN
    EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
    EXEC sp_configure 'Agent XPs', 1; RECONFIGURE;
END

-- ----------------------------------------------------------------------------
-- 2. Setup Linked Server ke Source MSSQL
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = @LinkedServer)
BEGIN
    EXEC sp_addlinkedserver
        @server       = @LinkedServer,
        @srvproduct   = '',
        @provider     = 'SQLNCLI',
        @datasrc      = @SourceServer;

    EXEC sp_addlinkedsrvlogin
        @rmtsrvname   = @LinkedServer,
        @useself      = 'false',
        @rmtuser      = @SourceUser,
        @rmtpassword  = @SourcePass;

    EXEC sp_serveroption @LinkedServer, 'connect timeout', '15';
    EXEC sp_serveroption @LinkedServer, 'query timeout', '60';
    EXEC sp_serveroption @LinkedServer, 'rpc', 'true';
    EXEC sp_serveroption @LinkedServer, 'rpc out', 'true';

    PRINT '[OK] Linked server [' + @LinkedServer + '] created to ' + @SourceServer + '.';
END
ELSE
    PRINT '[OK] Linked server [' + @LinkedServer + '] already exists.';

-- ----------------------------------------------------------------------------
-- 3. Test Linked Server Connection
-- ----------------------------------------------------------------------------
BEGIN TRY
    DECLARE @test INT;
    SET @SQL = 'SELECT @v = 1 FROM [' + @LinkedServer + '].master.sys.tables WHERE name = ''spt_values''';
    EXEC sp_executesql @SQL, N'@v INT OUTPUT', @v = @test OUTPUT;
    PRINT '[OK] Linked server connection test passed.';
END TRY
BEGIN CATCH
    PRINT '[WARN] Linked server connection test failed: ' + ERROR_MESSAGE();
END CATCH

-- ----------------------------------------------------------------------------
-- 4. Buat PRESET_TABLE di target (copy schema dari source jika belum ada)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PRESET_TABLE')
BEGIN
    SET @SQL = '
        SELECT TOP 0 * INTO [dbo].[PRESET_TABLE]
        FROM [' + @LinkedServer + '].[' + @DatabaseName + '].[dbo].[PRESET_TABLE]';

    BEGIN TRY
        EXEC sp_executesql @SQL;
        PRINT '[OK] PRESET_TABLE created (schema copied from source).';
    END TRY
    BEGIN CATCH
        PRINT '[WARN] Could not copy schema from source: ' + ERROR_MESSAGE();

        -- Fallback: buat dengan schema dasar (kolom sesuai aplikasi SCADA)
        CREATE TABLE [dbo].[PRESET_TABLE] (
            [ID]               INT IDENTITY(1,1),
            [CAROUSEL]         INT,
            [PACKING_ORDER]    NVARCHAR(100),
            [PRODUCT_ID]       NVARCHAR(50),
            [PRODUCT_NAME]     NVARCHAR(100),
            [PACKAGING_MATERIAL] NVARCHAR(100),
            [TARGET_COUNT]     INT,
            [TOLERANCE_MIN]    DECIMAL(18, 2),
            [TOLERANCE_MAX]    DECIMAL(18, 2),
            [PACKAGING_WEIGHT] DECIMAL(18, 2),
            [MACHINE_STATE]    NVARCHAR(50),
            [CREATED_DATETIME] DATETIME,
            CONSTRAINT [PK_PRESET_TABLE] PRIMARY KEY CLUSTERED ([ID])
        );
        PRINT '[OK] PRESET_TABLE created (fallback schema).';
    END CATCH
END
ELSE
    PRINT '[OK] PRESET_TABLE already exists.';

-- ----------------------------------------------------------------------------
-- 5. Buat Log Table
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mirror_sync_log')
BEGIN
    CREATE TABLE [dbo].[mirror_sync_log] (
        [id]             INT IDENTITY(1,1) PRIMARY KEY,
        [run_at]         DATETIME DEFAULT GETDATE(),
        [rows_inserted]  INT DEFAULT 0,
        [rows_updated]   INT DEFAULT 0,
        [status]         NVARCHAR(20) DEFAULT 'SUCCESS',
        [error_message]  NVARCHAR(MAX) NULL
    );
    PRINT '[OK] mirror_sync_log table created.';
END
ELSE
    PRINT '[OK] mirror_sync_log already exists.';

-- ----------------------------------------------------------------------------
-- 6. Buat Stored Procedure untuk Sync Logic (pakai dynamic SQL krn harus batch sendiri)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_PresetTableSync', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_PresetTableSync;

SET @SQL = '
CREATE PROCEDURE dbo.sp_PresetTableSync
    @LinkedServer   NVARCHAR(128),
    @DatabaseName   NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @inserted INT = 0;
    DECLARE @updated  INT = 0;
    DECLARE @srcTable NVARCHAR(512) = QUOTENAME(@LinkedServer) + ''.'' + QUOTENAME(@DatabaseName) + ''.[dbo].[PRESET_TABLE]'';
    DECLARE @sqlCmd   NVARCHAR(MAX);

    -- Phase A: INSERT baris baru dari source yang belum ada di target
    SET @sqlCmd = ''
        INSERT INTO [dbo].[PRESET_TABLE] (
            [CAROUSEL], [PACKING_ORDER], [PRODUCT_ID], [PRODUCT_NAME],
            [PACKAGING_MATERIAL], [TARGET_COUNT], [TOLERANCE_MIN], [TOLERANCE_MAX],
            [PACKAGING_WEIGHT], [MACHINE_STATE], [CREATED_DATETIME]
        )
        SELECT
            s.[CAROUSEL], s.[PACKING_ORDER], s.[PRODUCT_ID], s.[PRODUCT_NAME],
            s.[PACKAGING_MATERIAL], s.[TARGET_COUNT], s.[TOLERANCE_MIN], s.[TOLERANCE_MAX],
            s.[PACKAGING_WEIGHT], s.[MACHINE_STATE], s.[CREATED_DATETIME]
        FROM '' + @srcTable + '' s
        WHERE NOT EXISTS (
            SELECT 1 FROM [dbo].[PRESET_TABLE] t
            WHERE t.[CAROUSEL] = s.[CAROUSEL]
              AND t.[CREATED_DATETIME] = s.[CREATED_DATETIME]
        );'';

    EXEC sp_executesql @sqlCmd;
    SET @inserted = @@ROWCOUNT;

    -- Phase B: UPDATE MACHINE_STATE untuk baris yang MACHINE_STATE-nya berbeda
    SET @sqlCmd = ''
        UPDATE t
        SET t.[MACHINE_STATE] = s.[MACHINE_STATE]
        FROM [dbo].[PRESET_TABLE] t
        INNER JOIN '' + @srcTable + '' s
            ON t.[CAROUSEL] = s.[CAROUSEL]
           AND t.[CREATED_DATETIME] = s.[CREATED_DATETIME]
        WHERE ISNULL(t.[MACHINE_STATE], '''''''') != ISNULL(s.[MACHINE_STATE], '''''''');'';

    EXEC sp_executesql @sqlCmd;
    SET @updated = @@ROWCOUNT;

    -- Log hasil
    INSERT INTO [dbo].[mirror_sync_log] ([rows_inserted], [rows_updated], [status])
    VALUES (@inserted, @updated, ''SUCCESS'');
END';

EXEC sp_executesql @SQL;
PRINT '[OK] Stored procedure sp_PresetTableSync created.';

-- ----------------------------------------------------------------------------
-- 7. Hapus Job lama jika ada (biar idempotent)
-- ----------------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @JobName)
BEGIN
    EXEC msdb.dbo.sp_delete_job @job_name = @JobName, @delete_unused_schedule = 1;
    PRINT '[OK] Existing job [' + @JobName + '] dropped.';
END

-- ----------------------------------------------------------------------------
-- 8. Buat SQL Agent Job
-- ----------------------------------------------------------------------------
DECLARE @jobDesc NVARCHAR(512) = 'Mirror PRESET_TABLE dari source MSSQL setiap ' + CAST(@SyncIntervalSec AS NVARCHAR) + ' detik';

EXEC msdb.dbo.sp_add_job
    @job_name        = @JobName,
    @enabled         = 1,
    @description     = @jobDesc,
    @category_name   = '[Uncategorized (Local)]',
    @owner_login_name = 'sa';

DECLARE @stepCmd NVARCHAR(MAX) =
    'EXEC dbo.sp_PresetTableSync @LinkedServer = ''' + @LinkedServer + ''', @DatabaseName = ''' + @DatabaseName + ''';';

-- Step 1: Sync
EXEC msdb.dbo.sp_add_jobstep
    @job_name        = @JobName,
    @step_name       = 'Sync PRESET_TABLE',
    @subsystem       = 'TSQL',
    @command         = @stepCmd,
    @database_name   = @DatabaseName,
    @on_fail_action  = 2;

-- Step 2: Log error (hanya jalan jika step 1 gagal)
EXEC msdb.dbo.sp_add_jobstep
    @job_name        = @JobName,
    @step_name       = 'Log Error',
    @subsystem       = 'TSQL',
    @command         = 'INSERT INTO [dbo].[mirror_sync_log] ([rows_inserted], [rows_updated], [status], [error_message]) VALUES (0, 0, ''ERROR'', ''Sync step failed.'');',
    @database_name   = @DatabaseName,
    @on_success_action = 1;

-- Step 1 failure → Step 2
EXEC msdb.dbo.sp_update_jobstep
    @job_name        = @JobName,
    @step_id         = 1,
    @on_fail_step_id = 2;

-- Schedule: tiap N detik
EXEC msdb.dbo.sp_add_schedule
    @schedule_name         = @ScheduleName,
    @freq_type             = 4,
    @freq_interval         = 1,
    @freq_subday_type      = 2,
    @freq_subday_interval  = @SyncIntervalSec,
    @freq_relative_interval = 0,
    @active_start_time     = 0;

EXEC msdb.dbo.sp_attach_schedule
    @job_name       = @JobName,
    @schedule_name  = @ScheduleName;

EXEC msdb.dbo.sp_add_jobserver
    @job_name   = @JobName,
    @server_name = @@SERVERNAME;

PRINT '[OK] SQL Agent job [' + @JobName + '] created with ' + CAST(@SyncIntervalSec AS NVARCHAR) + 's interval.';

-- ----------------------------------------------------------------------------
-- 9. Jalankan sync pertama kali
-- ----------------------------------------------------------------------------
PRINT '[INFO] Running initial sync...';
EXEC dbo.sp_PresetTableSync @LinkedServer = @LinkedServer, @DatabaseName = @DatabaseName;

-- ----------------------------------------------------------------------------
-- 10. Verifikasi
-- ----------------------------------------------------------------------------
DECLARE @targetCount INT;
SELECT @targetCount = COUNT(*) FROM [dbo].[PRESET_TABLE];
PRINT '[INFO] PRESET_TABLE row count on target: ' + CAST(@targetCount AS NVARCHAR);

DECLARE @jobEnabled INT;
SELECT @jobEnabled = [enabled] FROM msdb.dbo.sysjobs WHERE name = @JobName;
IF @jobEnabled = 1
    PRINT '[OK] Job [' + @JobName + '] is ENABLED and running every ' + CAST(@SyncIntervalSec AS NVARCHAR) + ' seconds.';
ELSE
    PRINT '[WARN] Job [' + @JobName + '] is DISABLED.';

PRINT '';
PRINT '==============================================';
PRINT 'Mirror Agent Setup Complete';
PRINT '  Source   : ' + @SourceServer;
PRINT '  Database : ' + @DatabaseName;
PRINT '  Interval : ' + CAST(@SyncIntervalSec AS NVARCHAR) + ' seconds';
PRINT '  Job      : ' + @JobName;
PRINT '  Cek log  : SELECT * FROM [dbo].[mirror_sync_log] ORDER BY id DESC';
PRINT '==============================================';
