const sql = require('mssql');
const dbConfig = require('./config/db.config.mssql');

async function createTable() {
    try {
        const config = dbConfig.getConfig ? dbConfig.getConfig() : dbConfig;
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
            THRESHOLD DECIMAL(18, 4),
            PRODUCT_COUNT INT,
            TARGET_COUNT INT,
            STATUS NVARCHAR(50)
        )`;

        await pool.request().query(query);
        await pool.request().query(`
            IF COL_LENGTH('dbo.WEIGHT_DATA', 'THRESHOLD') IS NULL
                ALTER TABLE dbo.WEIGHT_DATA ADD THRESHOLD DECIMAL(18, 4) NULL
        `);
        console.log("Table WEIGHT_DATA created or already exists.");

        pool.close();
    } catch (err) {
        console.error("Error creating table:", err);
    }
}

createTable();
