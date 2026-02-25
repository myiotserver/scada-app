const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'scada-settings.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsPath)) return {};
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (err) {
        console.warn('[db.config.weighing] Failed to read scada-settings.json:', err.message);
        return {};
    }
}

function buildConfig() {
    const settings = loadSettings();

    return {
        user: process.env.MSSQL_USER || settings.sql_uid || '',
        password: process.env.MSSQL_PASSWORD || settings.sql_pass || '',
        server: process.env.MSSQL_SERVER || settings.sql_server || '',
        database: process.env.MSSQL_DATABASE || settings.sql_db || '',
        port: Number(process.env.MSSQL_PORT || 1433),
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
}

module.exports = buildConfig();
module.exports.getConfig = buildConfig;
