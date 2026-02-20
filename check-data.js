const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'VPS@thinkcentre',
    server: 'columba.s-net.id',
    database: 'WEIGHER',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkData() {
    try {
        let pool = await sql.connect(config);
        const result = await pool.request().query('SELECT TOP 5 * FROM WEIGHT_DATA ORDER BY TIMESTAMP DESC');
        console.table(result.recordset);
        pool.close();
    } catch (err) {
        console.error("SQL Error:", err);
    }
}

checkData();
