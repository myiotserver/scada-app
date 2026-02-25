const sql = require('mssql');
const dbConfig = require('./config/db.config.weighing');

async function testConnection() {
    try {
        console.log("Connecting...");
        const config = dbConfig.getConfig ? dbConfig.getConfig() : dbConfig;
        const pool = await new sql.ConnectionPool(config).connect();
        console.log("Connected!");

        console.log("Testing WEIGHT_DATA table...");
        try {
            await pool.request().query('SELECT TOP 1 * FROM WEIGHT_DATA');
            console.log("SUCCESS: WEIGHT_DATA table exists and is readable.");
        } catch (e) {
            console.error("ERROR: WEIGHT_DATA table check failed:", e.message);
        }

        console.log("Testing WEIGHT_TABLE table...");
        try {
            await pool.request().query('SELECT TOP 1 * FROM WEIGHT_TABLE');
            console.log("SUCCESS: WEIGHT_TABLE table exists and is readable.");
        } catch (e) {
            console.error("ERROR: WEIGHT_TABLE table check failed:", e.message);
        }

        await pool.close();
    } catch (err) {
        console.error("Connection Failed:", err.message);
    }
}

testConnection();
