/**
 * Export WEIGHT_TABLE history to data/weight-history-export.json
 * Usage: node export-weight-history.js
 */
require('dotenv').config();

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'config', 'scada-settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const OUT = path.join(__dirname, 'data', 'weight-history-export.json');

const cfg = {
    user: process.env.MSSQL_USER || settings.sql_uid,
    password: process.env.MSSQL_PASSWORD || settings.sql_pass,
    server: process.env.MSSQL_SERVER || settings.sql_server,
    database: process.env.MSSQL_DATABASE || settings.sql_db,
    options: { encrypt: false, trustServerCertificate: true }
};

function toIso(ts) {
    return new Date(ts).toISOString();
}

function wib(ts) {
    return new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function round2(n) {
    return Math.round(Number(n) * 100) / 100;
}

async function exportHistory() {
    const pool = await sql.connect(cfg);
    const table = settings.table_weight || 'WEIGHT_TABLE';

    const result = await pool.request().query(`
        SELECT TIMESTAMP, PACKING_ORDER, PRODUCT_ID, PRODUCT_NAME, CAROUSEL,
               PRODUCT_COUNT, TARGET_COUNT, GROSS_WEIGHT, NETT_WEIGHT,
               TOLERANCE_MIN, TOLERANCE_MAX, THRESHOLD_MIN, THRESHOLD_MAX, STATUS
        FROM [${table}]
        ORDER BY CAROUSEL, PACKING_ORDER, PRODUCT_COUNT, TIMESTAMP
    `);

    const rows = result.recordset;
    const groups = {};

    for (const row of rows) {
        const key = `${row.CAROUSEL}|${row.PACKING_ORDER || 'UNKNOWN'}`;
        if (!groups[key]) {
            groups[key] = {
                carousel: row.CAROUSEL,
                packingOrder: row.PACKING_ORDER,
                productId: row.PRODUCT_ID,
                productName: row.PRODUCT_NAME,
                targetCount: row.TARGET_COUNT,
                records: []
            };
        }
        groups[key].records.push(row);
    }

    const batches = Object.values(groups).map(g => {
        g.records.sort((a, b) => {
            const ca = a.PRODUCT_COUNT ?? 0;
            const cb = b.PRODUCT_COUNT ?? 0;
            if (ca !== cb) return ca - cb;
            return new Date(a.TIMESTAMP) - new Date(b.TIMESTAMP);
        });

        const records = g.records.map((row, idx, arr) => {
            const ts = new Date(row.TIMESTAMP);
            const prev = idx > 0 ? new Date(arr[idx - 1].TIMESTAMP) : null;
            const gapMs = prev ? ts - prev : null;

            return {
                counter: row.PRODUCT_COUNT,
                timestampUtc: toIso(row.TIMESTAMP),
                timestampWib: wib(row.TIMESTAMP),
                grossKg: round2(row.GROSS_WEIGHT),
                nettKg: round2(row.NETT_WEIGHT),
                toleranceMin: Number(row.TOLERANCE_MIN),
                toleranceMax: Number(row.TOLERANCE_MAX),
                thresholdMin: Number(row.THRESHOLD_MIN),
                thresholdMax: Number(row.THRESHOLD_MAX),
                status: row.STATUS,
                gapFromPreviousSec: gapMs != null ? round2(gapMs / 1000) : null,
                gapFromPreviousMs: gapMs
            };
        });

        const gaps = records.map(r => r.gapFromPreviousSec).filter(v => v != null);

        return {
            carousel: g.carousel,
            packingOrder: g.packingOrder,
            productId: g.productId,
            productName: g.productName,
            targetCount: g.targetCount,
            recordCount: records.length,
            firstTimestampWib: records[0]?.timestampWib,
            lastTimestampWib: records[records.length - 1]?.timestampWib,
            avgGapSec: gaps.length ? round2(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
            minGapSec: gaps.length ? Math.min(...gaps) : null,
            maxGapSec: gaps.length ? Math.max(...gaps) : null,
            records
        };
    });

    const exportDoc = {
        exportedAt: new Date().toISOString(),
        exportedAtWib: wib(new Date()),
        source: { server: cfg.server, database: cfg.database, table },
        summary: {
            totalRecords: rows.length,
            batchCount: batches.length,
            carousels: [...new Set(rows.map(r => r.CAROUSEL))].sort()
        },
        batches,
        flatRecords: rows.map(row => ({
            carousel: row.CAROUSEL,
            packingOrder: row.PACKING_ORDER,
            productId: row.PRODUCT_ID,
            productName: row.PRODUCT_NAME,
            counter: row.PRODUCT_COUNT,
            targetCount: row.TARGET_COUNT,
            timestampUtc: toIso(row.TIMESTAMP),
            timestampWib: wib(row.TIMESTAMP),
            grossKg: round2(row.GROSS_WEIGHT),
            nettKg: round2(row.NETT_WEIGHT),
            status: row.STATUS
        }))
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(exportDoc, null, 2), 'utf8');
    await pool.close();

    console.log(`Exported ${exportDoc.summary.totalRecords} records to ${OUT}`);
}

exportHistory().catch(err => {
    console.error('Export failed:', err.message);
    process.exit(1);
});
