const sql = require('mssql');
const config = require('./config/db.config.mssql');

async function searchColumns() {
    try {
        await sql.connect(config);

        const keywords = ['PRODUCT', 'PACKING', 'WEIGHT', 'TARGET', 'COUNTER', 'GROSS', 'NETT'];

        console.log("Searching for columns matching keywords: " + keywords.join(', '));

        const query = `
            SELECT t.name AS TableName, c.name AS ColumnName
            FROM sys.columns c
            JOIN sys.tables t ON c.object_id = t.object_id
            WHERE 
                ${keywords.map(k => `c.name LIKE '%${k}%'`).join(' OR ')}
            ORDER BY t.name, c.name;
        `;

        const result = await sql.query(query);
        console.table(result.recordset);

    } catch (err) {
        console.error(err);
    }
}

searchColumns();
