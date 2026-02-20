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

async function createTable() {
    try {
        let pool = await sql.connect(config);

        const query = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WEIGHT_DATA' AND xtype='U')
        CREATE TABLE WEIGHT_DATA (
            ID INT IDENTITY(1,1) PRIMARY KEY,
            TIMESTAMP DATETIME,
            PACKING_ORDER NVARCHAR(100),
            PRODUCT_ID NVARCHAR(50),
            PRODUCT_NAME NVARCHAR(100),
            PACKAGING_MATERIAL NVARCHAR(100),
            CAROUSEL NVARCHAR(20),
            GROSS_WEIGHT DECIMAL(18, 2),
            NETT_WEIGHT DECIMAL(18, 2),
            TOLERANCE_MIN DECIMAL(18, 2),
            TOLERANCE_MAX DECIMAL(18, 2),
            PRODUCT_COUNT INT,
            TARGET_COUNT INT,
            STATUS NVARCHAR(50)
        )`;

        await pool.request().query(query);
        console.log("Table WEIGHT_DATA created or already exists.");

        pool.close();
    } catch (err) {
        console.error("Error creating table:", err);
    }
}

createTable();
