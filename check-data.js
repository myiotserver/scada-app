const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'config', 'scada-settings.json');
let settings = {};
if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

const config = {
    user: settings.sql_uid || '',
    password: settings.sql_pass || '',
    server: settings.sql_server || '',
    database: settings.sql_db || '',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkData() {
    console.log(`Checking data on ${config.server}/${config.database}...`);
    try {
        let pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT TOP 5 * FROM ${settings.table_weight || 'WEIGHT_DATA'} ORDER BY TIMESTAMP DESC`);
        console.table(result.recordset);
        pool.close();
    } catch (err) {
        console.error("SQL Error:", err.message);
    }
}

checkData();
