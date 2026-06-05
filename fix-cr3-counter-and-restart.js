/**
 * fix-cr3-counter-and-restart.js
 * 
 * 1. Renumber PRODUCT_COUNT for CR3's current PACKING_ORDER starting from 1
 * 2. Restart the PM2 scada-app
 * 
 * Scheduled to run at 07:50 WIB before restart.
 */

const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const settingsPath = path.join(__dirname, 'config/scada-settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const config = {
    user: settings.sql_uid,
    password: settings.sql_pass,
    server: settings.sql_server,
    database: settings.sql_db,
    options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
    console.log('========================================');
    console.log('CR3 Counter Fix & Restart Script');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('========================================');
    
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('[1] Connected to SQL Server');

        // Step 1: Get CR3's current packing order
        const presetResult = await pool.request()
            .query(`SELECT TOP 1 PACKING_ORDER, TARGET_COUNT FROM [${settings.table_main}] WHERE CAROUSEL = 3 ORDER BY CREATED_DATETIME DESC`);
        
        const currentPO = presetResult.recordset[0]?.PACKING_ORDER;
        const targetCount = presetResult.recordset[0]?.TARGET_COUNT;
        
        if (!currentPO) {
            console.error('[ERROR] No preset found for CR3');
            process.exit(1);
        }
        
        console.log(`[2] CR3 Current PACKING_ORDER: ${currentPO}, TARGET: ${targetCount}`);

        // Step 2: Get all records info for this PO
        const recordsResult = await pool.request()
            .input('po', sql.NVarChar, currentPO)
            .query(`SELECT COUNT(*) AS total, MIN(PRODUCT_COUNT) AS minCount, MAX(PRODUCT_COUNT) AS maxCount FROM [${settings.table_weight}] WHERE PACKING_ORDER = @po AND CAROUSEL = 'CR3'`);
        
        const { total, minCount, maxCount } = recordsResult.recordset[0];
        console.log(`[3] Found ${total} records for CR3 / ${currentPO} (current range: ${minCount} - ${maxCount})`);
        
        if (total > 0) {
            // Step 3: Renumber PRODUCT_COUNT sequentially using CTE
            console.log('[4] Renumbering PRODUCT_COUNT from 1...');
            
            await pool.request()
                .input('po', sql.NVarChar, currentPO)
                .query(`
                    WITH cte AS (
                        SELECT 
                            TIMESTAMP,
                            PRODUCT_COUNT,
                            ROW_NUMBER() OVER (ORDER BY TIMESTAMP ASC) AS new_count
                        FROM [${settings.table_weight}]
                        WHERE PACKING_ORDER = @po AND CAROUSEL = 'CR3'
                    )
                    UPDATE wt
                    SET PRODUCT_COUNT = cte.new_count
                    FROM [${settings.table_weight}] wt
                    INNER JOIN cte ON wt.TIMESTAMP = cte.TIMESTAMP AND wt.PACKING_ORDER = @po AND wt.CAROUSEL = 'CR3'
                `);
            
            console.log(`    ✓ ${total} records renumbered from 1 to ${total}`);
        } else {
            console.log('[4] No records to update. Skipping renumber.');
        }

        await pool.close();
        console.log('[5] Database updated successfully.');
        
    } catch (err) {
        console.error(`[ERROR] ${err.message}`);
        process.exit(1);
    }

    // Step 4: Restart PM2 app
    console.log('[6] Restarting scada-app via PM2...');
    try {
        execSync('pm2 restart scada-app', { cwd: __dirname, stdio: 'inherit' });
        console.log('[7] scada-app restarted successfully.');
    } catch (err) {
        console.error(`[ERROR] Failed to restart PM2: ${err.message}`);
        process.exit(1);
    }

    console.log('========================================');
    console.log('Script completed successfully.');
    console.log(`Finished at: ${new Date().toISOString()}`);
    console.log('========================================');
}

main();
