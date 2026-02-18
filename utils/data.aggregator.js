const cron = require('node-cron');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(__dirname, '../config/scada-settings.json');

class DataAggregator {
    constructor() {
        this.aggregatedData = {}; // { productId: { min, max, avg } }
        this.onUpdate = null; // Callback
    }

    start() {
        console.log("[Aggregator] Starting 10-minute aggregation task...");

        // Schedule task: every 10 minutes
        cron.schedule('*/10 * * * *', async () => {
            console.log("[Aggregator] Running calculation...");
            await this.calculateStats();
        });

        // Run immediately on start
        this.calculateStats();
    }

    async calculateStats() {
        try {
            // Load settings dynamically
            let appSettings = {};
            if (fs.existsSync(settingsPath)) {
                appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            } else {
                console.warn("[Aggregator] Settings file not found, skipping.");
                return;
            }

            if (!appSettings.sql_server) return;

            const config = {
                user: appSettings.sql_uid || 'sa',
                password: appSettings.sql_pass || 'VPS@thinkcentre',
                server: appSettings.sql_server || 'columba.s-net.id',
                database: appSettings.sql_db || 'WEIGHING',
                port: 1433,
                options: {
                    encrypt: false,
                    trustServerCertificate: true,
                    enableArithAbort: true
                },
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            };

            const pool = await new sql.ConnectionPool(config).connect();

            // Query: Get Min, Max, Avg for last 10 minutes grouped by ProductId
            // Using NETT_WEIGHT as the metric
            const result = await pool.request().query(`
                SELECT 
                    PRODUCT_ID,
                    MIN(NETT_WEIGHT) as min_val,
                    MAX(NETT_WEIGHT) as max_val,
                    AVG(NETT_WEIGHT) as avg_val
                FROM dbo.WEIGHT_DATA
                WHERE TIMESTAMP >= DATEADD(minute, -10, SYSDATETIMEOFFSET())
                GROUP BY PRODUCT_ID
            `);

            // Transform result
            const newData = {};
            result.recordset.forEach(row => {
                newData[row.PRODUCT_ID] = {
                    min: row.min_val,
                    max: row.max_val,
                    avg: row.avg_val
                };
            });

            this.aggregatedData = newData;
            console.log(`[Aggregator] Updated stats for ${Object.keys(newData).length} products.`);

            if (this.onUpdate) {
                this.onUpdate(this.aggregatedData);
            }

            await pool.close();

        } catch (err) {
            console.error("[Aggregator] Calculation Failed:", err.message);
        }
    }

    getData(productId) {
        return this.aggregatedData[productId] || { min: 0, max: 0, avg: 0 };
    }
}

module.exports = new DataAggregator();
