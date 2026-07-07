// Create production tables on local SQL Server container (port 32768)
const sql = require('mssql');

async function createTables() {
    const pool = await sql.connect({
        user: 'sa',
        password: 'VPS@thinkcentre',
        server: 'localhost',
        port: 32768,
        database: 'SFM Main',
        options: { trustServerCertificate: true, enableArithAbort: true }
    });

    console.log('Connected to local SQL Server on port 32768');

    // 1. ZEROINGPLCDATA
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ZEROINGPLCDATA' AND xtype='U')
        CREATE TABLE ZEROINGPLCDATA (
            TIMESTAMP DATETIME,
            PRODUCT_ID VARCHAR(50),
            PACKAGING_MATERIAL VARCHAR(50),
            PACKING_ORDER VARCHAR(50),
            CAROUSEL VARCHAR(20),
            ZERO_WEIGHT REAL
        )
    `);
    console.log('✓ ZEROINGPLCDATA');

    // 2. WEIGHT_TABLE
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WEIGHT_TABLE' AND xtype='U')
        CREATE TABLE WEIGHT_TABLE (
            TIMESTAMP DATETIMEOFFSET,
            PACKING_ORDER VARCHAR(50),
            PRODUCT_ID VARCHAR(12),
            PRODUCT_NAME VARCHAR(100),
            PACKAGING_MATERIAL VARCHAR(50),
            CAROUSEL VARCHAR(50),
            GROSS_WEIGHT REAL,
            NETT_WEIGHT REAL,
            TOLERANCE_MIN REAL,
            TOLERANCE_MAX REAL,
            PRODUCT_COUNT INT,
            TARGET_COUNT INT,
            STATUS VARCHAR(20)
        )
    `);
    console.log('✓ WEIGHT_TABLE');

    // 3. PRESET_TABLE
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PRESET_TABLE' AND xtype='U')
        CREATE TABLE PRESET_TABLE (
            PACKING_ORDER VARCHAR(50),
            PRODUCT_ID VARCHAR(50),
            PRODUCT_NAME VARCHAR(50),
            PACKAGING_MATERIAL VARCHAR(50),
            CAROUSEL VARCHAR(50),
            TOLERANCE_MIN REAL,
            TOLERANCE_MAX REAL,
            TARGET_COUNT INT,
            PACKAGING_WEIGHT REAL,
            CREATED_DATETIME SMALLDATETIME,
            MACHINE_STATE VARCHAR(50)
        )
    `);
    console.log('✓ PRESET_TABLE');

    await pool.close();
    console.log('\nAll tables created successfully.');
}

createTables().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
