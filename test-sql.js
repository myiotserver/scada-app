const sql = require('mssql');
const dbConfig = require('./config/db.config.mssql');

async function testConnection() {
    try {
        console.log('Connecting to SQL Server...');
        const config = dbConfig.getConfig ? dbConfig.getConfig() : dbConfig;
        let pool = await sql.connect(config);
        console.log('Connected!');

        console.log('Querying tables...');
        const result = await pool.request().query`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `;

        console.log('Tables found:');
        console.table(result.recordset);

        // If there's a table that looks like 'Production', 'Log', or 'History', inspect it
        const relevantTable = result.recordset.find(t =>
            t.TABLE_NAME.toLowerCase().includes('prod') ||
            t.TABLE_NAME.toLowerCase().includes('log') ||
            t.TABLE_NAME.toLowerCase().includes('data')
        );

        if (relevantTable) {
            console.log(`Inspecting table: ${relevantTable.TABLE_NAME}`);
            const preview = await pool.request().query(`SELECT TOP 5 * FROM ${relevantTable.TABLE_NAME}`);
            console.table(preview.recordset);
        }

        pool.close();
    } catch (err) {
        console.error('SQL Error:', err);
    }
}

testConnection();
