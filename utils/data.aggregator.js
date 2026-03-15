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
                console.warn("[Aggregator] Settings file not found, using environment variables if available.");
            }

            const sqlAutoConnectEnabled = process.env.SCADA_SQL_AUTO_CONNECT !== undefined
                ? process.env.SCADA_SQL_AUTO_CONNECT === 'true'
                : appSettings.sql_auto_connect !== false;
            if (!sqlAutoConnectEnabled) return;

            const sqlServer = process.env.MSSQL_SERVER || appSettings.sql_server || '';
            if (!sqlServer) return;

            const sqlPort = Number(process.env.MSSQL_PORT || appSettings.sql_port || 1433);

            const config = {
                user: process.env.MSSQL_USER || appSettings.sql_uid || '',
                password: process.env.MSSQL_PASSWORD || appSettings.sql_pass || '',
                server: sqlServer,
                database: process.env.MSSQL_DATABASE || appSettings.sql_db || '',
                port: Number.isFinite(sqlPort) ? sqlPort : 1433,
                options: {
                    encrypt: process.env.MSSQL_ENCRYPT === 'true',
                    trustServerCertificate: process.env.MSSQL_TRUST_CERT !== 'false',
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
                FROM ${appSettings.table_weight || 'WEIGHT_DATA'}
                WHERE TIMESTAMP >= DATEADD(hour, -1, SYSDATETIMEOFFSET())
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
