const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(__dirname, '../config/scada-settings.json');
const opcUaManager = require('../utils/opcua.manager');
const dataAggregator = require('../utils/data.aggregator');

// Memory for settings
let appSettings = {};
try {
    if (fs.existsSync(settingsPath)) {
        appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        console.log('[INIT] Settings loaded:', {
            sql_server: appSettings.sql_server,
            sql_db: appSettings.sql_db,
            table_main: appSettings.table_main,
            table_weight: appSettings.table_weight,
            table_zeroing: appSettings.table_zeroing
        });
    }
} catch (e) {
    console.error("Error loading settings:", e);
}

// Helper to construct MSSQL config from settings
function getMssqlConfig() {
    return {
        user: appSettings.sql_uid || '',
        password: appSettings.sql_pass || '',
        server: appSettings.sql_server || '',
        database: appSettings.sql_db || '',
        port: 1433,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

// In-memory state for the Carousels (1-5)
let carousels = {
    1: {
        id: 1,
        name: 'Carousel 1',
        state: 'STOP',
        data: {
            productId: 'PROD001',
            productName: 'Flour 1kg',
            packingOrder: 'PO-001',
            packagingMaterial: 'Plastic 1kg',
            target: 100,
            toleranceMin: 24.0,
            toleranceMax: 26.0,
            packWeight: 0.08,
            counter: 0,
            lastGross: 0,
            lastNett: 0,
            average: 0
        }
    },
    2: {
        id: 2,
        name: 'Carousel 2',
        state: 'StOP',
        data: {
            productId: 'PROD002',
            productName: 'Flour 2kg',
            packingOrder: 'PO-002',
            packagingMaterial: 'Plastic 2kg',
            target: 50,
            toleranceMin: 48.0,
            toleranceMax: 52.0,
            packWeight: 0.10,
            counter: 0,
            lastGross: 0,
            lastNett: 0,
            average: 0
        }
    },
    3: {
        id: 3,
        name: 'Carousel 3',
        state: 'STOP',
        data: {
            productId: 'PROD003',
            productName: 'Flour 5kg',
            packingOrder: 'PO-003',
            packagingMaterial: 'Plastic 5kg',
            target: 20,
            toleranceMin: 120.0,
            toleranceMax: 130.0,
            packWeight: 0.15,
            counter: 0,
            lastGross: 0,
            lastNett: 0,
            average: 0
        }
    },
    4: {
        id: 4,
        name: 'Carousel 4',
        state: 'STOP',
        data: {
            productId: 'PROD004',
            productName: 'Flour 1kg Premium',
            packingOrder: 'PO-004',
            packagingMaterial: 'Paper 1kg',
            target: 100,
            toleranceMin: 24.0,
            toleranceMax: 26.0,
            packWeight: 0.12,
            counter: 0,
            lastGross: 0,
            lastNett: 0,
            average: 0
        }
    },
    5: {
        id: 5,
        name: 'Carousel 5',
        state: 'STOP',
        data: {
            productId: 'PROD005',
            productName: 'Flour 10kg',
            packingOrder: 'PO-005',
            packagingMaterial: 'Sack 10kg',
            target: 10,
            toleranceMin: 240.0,
            toleranceMax: 260.0,
            packWeight: 0.20,
            counter: 0,
            lastGross: 0,
            lastNett: 0,
            average: 0
        }
    }
};

let weighingPool = null;
let pollingInterval = null;
const alertListeners = new Map();
const lastSqlInsertAlertTs = new Map();
const SQL_ALERT_DEBOUNCE_MS = 8000;
const lastGrossCategoryByMachine = {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null
};
const lastGrossCategorySyncTs = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
};
const GROSS_SIGNAL_RESYNC_MS = 5000;
const lastRunSignalByMachine = {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null
};
const lastZeroingSignalByMachine = {
    1: false,
    2: false,
    3: false,
    4: false,
    5: false
};
const zeroingTableColumnsCache = {
    tableName: null,
    columns: null
};

function notifySqlInsertFailure(payload) {
    const now = Date.now();
    const key = payload && payload.carousel ? String(payload.carousel) : 'GLOBAL';
    const lastTs = lastSqlInsertAlertTs.get(key) || 0;
    if (now - lastTs < SQL_ALERT_DEBOUNCE_MS) return;
    lastSqlInsertAlertTs.set(key, now);

    alertListeners.forEach(cb => {
        try {
            cb({
                type: 'sql_insert_failed',
                level: 'error',
                ...payload,
                ts: new Date().toISOString()
            });
        } catch (err) {
            console.error('[Alert] Failed to deliver SQL alert:', err.message);
        }
    });
}

// Helper to insert weight data into SQL
async function insertWeightData(carouselId, data) {
    if (!weighingPool) {
        console.warn(`[SQL] Skipping insert for CR${carouselId}: Database pool not ready.`);
        return;
    }
    if (!data.productId) {
        console.warn(`[SQL] Skipping insert for CR${carouselId}: No Product ID defined in configuration.`);
        return;
    }

    try {
        // Calculate STATUS based on GROSS_WEIGHT
        let status = 'Normal';
        if (data.lastGross < data.toleranceMin) status = 'Underweight';
        else if (data.lastGross > data.toleranceMax) status = 'Overweight';

        await weighingPool.request()
            .input('packingOrder', sql.NVarChar, data.packingOrder)
            .input('productId', sql.NVarChar, data.productId)
            .input('productName', sql.NVarChar, data.productName)
            .input('packagingMaterial', sql.NVarChar, data.packagingMaterial)
            .input('carousel', sql.NVarChar, `CR${carouselId}`)
            .input('grossWeight', sql.Decimal(18, 2), data.lastGross)
            .input('nettWeight', sql.Decimal(18, 2), data.lastNett)
            .input('toleranceMin', sql.Decimal(18, 2), data.toleranceMin)
            .input('toleranceMax', sql.Decimal(18, 2), data.toleranceMax)
            .input('baseTarget', sql.Decimal(18, 2), data.target) // Using target as product count/target count placeholder if needed? No, schema has PRODUCT_COUNT and TARGET_COUNT
            // Schema from image: PRODUCT_COUNT, TARGET_COUNT. Let's assume these are current counters or target settings.
            // data.target is likely TARGET_COUNT. PRODUCT_COUNT is likely the current counter.
            .input('productCount', sql.Int, data.counter || 0)
            .input('targetCount', sql.Int, data.target || 0)
            .input('status', sql.NVarChar, status)
            .query(`
                INSERT INTO ${appSettings.table_weight || 'WEIGHT_DATA'} 
                (TIMESTAMP, PACKING_ORDER, PRODUCT_ID, PRODUCT_NAME, PACKAGING_MATERIAL, CAROUSEL, 
                 GROSS_WEIGHT, NETT_WEIGHT, TOLERANCE_MIN, TOLERANCE_MAX, PRODUCT_COUNT, TARGET_COUNT, STATUS)
                VALUES 
                (GETDATE(), @packingOrder, @productId, @productName, @packagingMaterial, @carousel, 
                 @grossWeight, @nettWeight, @toleranceMin, @toleranceMax, @productCount, @targetCount, @status)
            `);

        console.log(`[SQL] Inserted data for CR${carouselId}: ${data.lastNett}kg (${status})`);
    } catch (err) {
        console.error("Error inserting weight data:", err.message);
        notifySqlInsertFailure({
            message: `Gagal update ${appSettings.table_weight || 'WEIGHT_DATA'} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: appSettings.table_weight || 'WEIGHT_DATA',
            reason: err.message
        });
    }
}

async function getZeroingTableColumns() {
    if (!weighingPool) return [];
    const tableName = (appSettings.table_zeroing || 'ZEROINGPLCDATA').toString();

    if (zeroingTableColumnsCache.tableName === tableName && Array.isArray(zeroingTableColumnsCache.columns)) {
        return zeroingTableColumnsCache.columns;
    }

    const schema = tableName.includes('.') ? tableName.split('.')[0].replace(/[[\]]/g, '') : 'dbo';
    const bareTable = tableName.includes('.') ? tableName.split('.')[1].replace(/[[\]]/g, '') : tableName.replace(/[[\]]/g, '');

    const result = await weighingPool.request()
        .input('tableName', sql.NVarChar, bareTable)
        .input('tableSchema', sql.NVarChar, schema)
        .query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @tableName AND TABLE_SCHEMA = @tableSchema
        `);

    const columns = (result.recordset || []).map(r => String(r.COLUMN_NAME || '').toUpperCase()).filter(Boolean);
    zeroingTableColumnsCache.tableName = tableName;
    zeroingTableColumnsCache.columns = columns;
    return columns;
}

async function insertZeroingData(carouselId) {
    if (!weighingPool) {
        console.warn(`[ZEROING] Skipping insert for CR${carouselId}: Database pool not ready.`);
        return;
    }

    const carousel = carousels[carouselId];
    if (!carousel || !carousel.data) {
        console.warn(`[ZEROING] Skipping insert for CR${carouselId}: Carousel data not available.`);
        return;
    }

    const gross = parseFloat(carousel.data.lastGross);
    if (!Number.isFinite(gross)) {
        console.warn(`[ZEROING] Skipping insert for CR${carouselId}: Invalid gross value.`);
        return;
    }

    const tableName = appSettings.table_zeroing || 'ZEROINGPLCDATA';

    try {
        const columns = await getZeroingTableColumns();
        if (!columns.length) {
            console.warn(`[ZEROING] Skipping insert for CR${carouselId}: No columns found for table ${tableName}.`);
            return;
        }

        const dataMap = {
            CAROUSEL: `CR${carouselId}`,
            GROSS_WEIGHT: parseFloat(gross.toFixed(2)),
            ZERO_WEIGHT: parseFloat(gross.toFixed(2)),
            PACKING_ORDER: carousel.data.packingOrder || null,
            PRODUCT_ID: carousel.data.productId || null,
            PRODUCT_NAME: carousel.data.productName || null,
            PACKAGING_MATERIAL: carousel.data.packagingMaterial || null
        };

        const insertColumns = [];
        const valueSql = [];
        const request = weighingPool.request();

        const timeColumn = columns.includes('TIMESTAMP')
            ? 'TIMESTAMP'
            : (columns.includes('CREATED_DATETIME') ? 'CREATED_DATETIME' : null);
        if (timeColumn) {
            insertColumns.push(`[${timeColumn}]`);
            valueSql.push('GETDATE()');
        }

        const preferredColumns = ['CAROUSEL', 'ZERO_WEIGHT', 'GROSS_WEIGHT', 'PACKING_ORDER', 'PRODUCT_ID', 'PRODUCT_NAME', 'PACKAGING_MATERIAL'];
        preferredColumns.forEach((col) => {
            if (!columns.includes(col)) return;
            const paramName = col.toLowerCase();
            insertColumns.push(`[${col}]`);
            valueSql.push(`@${paramName}`);

            if (col === 'GROSS_WEIGHT') {
                request.input(paramName, sql.Decimal(18, 2), dataMap[col]);
            } else if (col === 'ZERO_WEIGHT') {
                request.input(paramName, sql.Real, dataMap[col]);
            } else {
                request.input(paramName, sql.NVarChar, dataMap[col]);
            }
        });

        // Require at least carousel + weight (ZERO_WEIGHT or GROSS_WEIGHT).
        const hasCarousel = insertColumns.includes('[CAROUSEL]');
        const hasWeight = insertColumns.includes('[ZERO_WEIGHT]') || insertColumns.includes('[GROSS_WEIGHT]');
        if (!(hasCarousel && hasWeight)) {
            console.warn(`[ZEROING] Skipping insert for CR${carouselId}: Table ${tableName} must contain CAROUSEL and ZERO_WEIGHT/GROSS_WEIGHT columns.`);
            return;
        }

        await request.query(`
            INSERT INTO ${tableName} (${insertColumns.join(', ')})
            VALUES (${valueSql.join(', ')})
        `);

        console.log(`[ZEROING] Inserted CR${carouselId} gross=${gross.toFixed(2)} into ${tableName}`);
    } catch (err) {
        console.error(`[ZEROING] Failed insert for CR${carouselId}:`, err.message);
        notifySqlInsertFailure({
            message: `Gagal update ${tableName} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: tableName,
            reason: err.message
        });
    }
}

// Connect to WEIGHING DB (Configuration Data)
async function connectToWeighingDB() {
    try {
        if (weighingPool) {
            await weighingPool.close();
        }

        const config = getMssqlConfig();
        console.log(`[SQL] Connecting to ${config.server}/${config.database} as ${config.user}`);

        weighingPool = await new sql.ConnectionPool(config).connect();
        console.log("✓ Connected to SQL Server (Dynamic Config)");
        console.log(`[SQL] Using table_main: ${appSettings.table_main || 'PRESET_TABLE'}`);

        // Initial Fetch
        fetchCarouselConfig(true);

        // Clear existing interval if any
        if (pollingInterval) clearInterval(pollingInterval);

        // Poll for config changes (quietly in background)
        pollingInterval = setInterval(() => fetchCarouselConfig(false), 30000);

    } catch (err) {
        console.error("✗ Failed to connect to DB:", err.message);
    }
}
// Start connection
if (appSettings.sql_server) {
    connectToWeighingDB();
}

// --- OPC-UA Integration ---
function normalizeSignalType(value) {
    return (value || '').toString().trim().toUpperCase();
}

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const str = String(value || '').trim().toUpperCase();
    return str === '1' || str === 'TRUE' || str === 'ON' || str === 'YES';
}

function toMachineId(value) {
    const machineId = parseInt(value, 10);
    if (!Number.isInteger(machineId)) return null;
    return machineId >= 1 && machineId <= 5 ? machineId : null;
}

function findNodeConfigFromEvent(data) {
    const opcConfig = opcUaManager.getConfig();
    const nodes = Array.isArray(opcConfig.nodes) ? opcConfig.nodes : [];
    if (!data) return null;
    return nodes.find(n => n.nodeId === data.nodeId) || nodes.find(n => n.name === data.name) || null;
}

function resolveNodeMapping(data) {
    const nodeCfg = findNodeConfigFromEvent(data);
    if (nodeCfg) {
        return {
            machineId: toMachineId(nodeCfg.machineId),
            signalType: normalizeSignalType(nodeCfg.signalType),
            scale: Number.isFinite(parseFloat(nodeCfg.scale)) ? parseFloat(nodeCfg.scale) : 1
        };
    }

    // Backward compatibility for legacy nodes without mapping metadata.
    const name = (data.name || '').toString().trim().toUpperCase();
    const grossMatch = name.match(/^CR([1-5])$/);
    if (grossMatch) {
        return {
            machineId: parseInt(grossMatch[1], 10),
            signalType: 'GROSS_WEIGHT',
            scale: 0.01
        };
    }

    const sensorMatch = name.match(/^S([1-5])$/);
    if (sensorMatch) {
        return {
            machineId: parseInt(sensorMatch[1], 10),
            signalType: 'PRODUCT_SENSOR',
            scale: 1
        };
    }

    if (name === 'RST') {
        return {
            machineId: null,
            signalType: 'RESET',
            scale: 1
        };
    }

    const zeroingMatch = name.match(/^ZEROING_?([1-5])$/);
    if (zeroingMatch) {
        return {
            machineId: parseInt(zeroingMatch[1], 10),
            signalType: 'ZEROING',
            scale: 1
        };
    }

    return null;
}

function classifyGrossByTolerance(carouselId, grossValue) {
    const carousel = carousels[carouselId];
    if (!carousel || !carousel.data) return null;
    const toleranceMin = parseFloat(carousel.data.toleranceMin);
    const toleranceMax = parseFloat(carousel.data.toleranceMax);
    if (!Number.isFinite(toleranceMin) || !Number.isFinite(toleranceMax)) return null;

    if (grossValue < toleranceMin) return 'UNDER';
    if (grossValue > toleranceMax) return 'OVER';
    return 'NORMAL';
}

async function writeBooleanToOpc(nodeId, value) {
    let result = await opcUaManager.writeNode(nodeId, !!value, 'Boolean');
    if (result && result.error) {
        result = await opcUaManager.writeNode(nodeId, value ? 1 : 0, 'Int16');
    }
    return result;
}

async function syncGrossCategorySignals(machineId, category) {
    if (!machineId || !category) return;
    const opcStatus = opcUaManager.getStatus();
    if (!opcStatus || !opcStatus.connected) return;

    const cfg = opcUaManager.getConfig();
    const nodes = Array.isArray(cfg.nodes) ? cfg.nodes : [];
    const indicators = nodes.filter((n) => {
        const signalType = (n.signalType || '').toString().trim().toUpperCase();
        const nodeMachineId = parseInt(n.machineId, 10);
        return nodeMachineId === machineId && ['GROSS_NORMAL', 'GROSS_UNDER', 'GROSS_OVER'].includes(signalType);
    });

    for (const node of indicators) {
        if (!node.nodeId) continue;
        const signalType = (node.signalType || '').toString().trim().toUpperCase();
        const expectedValue =
            (signalType === 'GROSS_NORMAL' && category === 'NORMAL') ||
            (signalType === 'GROSS_UNDER' && category === 'UNDER') ||
            (signalType === 'GROSS_OVER' && category === 'OVER');

        try {
            const writeRes = await writeBooleanToOpc(node.nodeId, expectedValue);
            if (writeRes && writeRes.error) {
                console.warn(`[OPC] Failed writing ${signalType} for CR${machineId}: ${writeRes.error}`);
            }
        } catch (err) {
            console.warn(`[OPC] Failed writing ${signalType} for CR${machineId}: ${err.message}`);
        }
    }

    lastGrossCategorySyncTs[machineId] = Date.now();
}

async function syncMachineRunSignal(machineId, state) {
    if (!machineId) return;
    const isRun = String(state || '').toUpperCase() === 'RUN';
    if (lastRunSignalByMachine[machineId] === isRun) return;

    const opcStatus = opcUaManager.getStatus();
    if (!opcStatus || !opcStatus.connected) return;

    const cfg = opcUaManager.getConfig();
    const nodes = Array.isArray(cfg.nodes) ? cfg.nodes : [];
    const runNodes = nodes.filter((n) => {
        const signalType = (n.signalType || '').toString().trim().toUpperCase();
        const nodeMachineId = parseInt(n.machineId, 10);
        return nodeMachineId === machineId && signalType === 'MACHINE_RUN';
    });

    for (const node of runNodes) {
        if (!node.nodeId) continue;
        try {
            const writeRes = await writeBooleanToOpc(node.nodeId, isRun);
            if (writeRes && writeRes.error) {
                console.warn(`[OPC] Failed writing MACHINE_RUN for CR${machineId}: ${writeRes.error}`);
            }
        } catch (err) {
            console.warn(`[OPC] Failed writing MACHINE_RUN for CR${machineId}: ${err.message}`);
        }
    }

    lastRunSignalByMachine[machineId] = isRun;
}

// Subscribe to OPC Manager updates
opcUaManager.subscribe('scada-controller', (event, data) => {
    if (event === 'opcua-status' && data && data.connected) {
        // Force re-sync after reconnect so PLC outputs don't stay stale.
        for (let i = 1; i <= 5; i++) {
            lastGrossCategoryByMachine[i] = null;
            lastGrossCategorySyncTs[i] = 0;
            lastRunSignalByMachine[i] = null;
        }
        return;
    }

    if (event === 'opcua-value' && data && data.name) {
        const mapping = resolveNodeMapping(data);
        if (!mapping || !mapping.signalType) return;

        const carouselId = mapping.machineId;
        const carousel = carouselId ? carousels[carouselId] : null;

        if (mapping.signalType === 'GROSS_WEIGHT') {
            if (!carousel) return;
            const rawVal = parseFloat(data.value);
            if (isNaN(rawVal)) return;
            const scaledVal = rawVal * mapping.scale;
            carousel.data.lastGross = parseFloat(scaledVal.toFixed(2));
            const packWeight = carousel.data.packWeight || 0;
            carousel.data.lastNett = parseFloat((scaledVal - packWeight).toFixed(2));

            const category = classifyGrossByTolerance(carouselId, scaledVal);
            const now = Date.now();
            const mustResync = (now - (lastGrossCategorySyncTs[carouselId] || 0)) >= GROSS_SIGNAL_RESYNC_MS;
            if (category && (lastGrossCategoryByMachine[carouselId] !== category || mustResync)) {
                lastGrossCategoryByMachine[carouselId] = category;
                syncGrossCategorySignals(carouselId, category).catch((err) => {
                    console.warn(`[OPC] syncGrossCategorySignals failed for CR${carouselId}: ${err.message}`);
                });
            }
            return;
        }

        if (mapping.signalType === 'PRODUCT_SENSOR') {
            if (!carousel) return;
            const newValue = toBoolean(data.value);
            const oldValue = !!carousel.data.sensorStatus;
            carousel.data.sensorStatus = newValue;

            if (!oldValue && newValue) {
                console.log(`[OPC] Sensor Rising Edge for CR${carouselId}`);
                if (carousel.state === 'RUN') {
                    carousel.data.counter = (carousel.data.counter || 0) + 1;
                    console.log(`[OPC] CR${carouselId} counter incremented to ${carousel.data.counter}`);
                    insertWeightData(carouselId, carousel.data);
                } else {
                    console.log(`[OPC] CR${carouselId} is ${carousel.state}, skipping counter increment and SQL write.`);
                }
            }
            return;
        }

        if (mapping.signalType === 'CAROUSEL_INTERLOCK') {
            if (!carousel) return;
            carousel.data.interlockStatus = toBoolean(data.value);
            return;
        }

        if (mapping.signalType === 'RESET') {
            const resetActive = toBoolean(data.value);
            if (!resetActive) return;
            if (carousel) {
                carousel.state = 'RESET';
                carousel.data.counter = 0;
                syncMachineRunSignal(carouselId, carousel.state).catch(() => { });
            } else {
                Object.values(carousels).forEach(c => {
                    c.state = 'RESET';
                    c.data.counter = 0;
                    syncMachineRunSignal(c.id, c.state).catch(() => { });
                });
            }
            return;
        }

        if (mapping.signalType === 'ZEROING') {
            if (!carousel) return;
            const zeroingActive = toBoolean(data.value);
            const wasActive = !!lastZeroingSignalByMachine[carouselId];
            lastZeroingSignalByMachine[carouselId] = zeroingActive;

            // Rising edge + machine RUN -> insert current gross value into ZEROING table.
            if (!wasActive && zeroingActive) {
                if (carousel.state === 'RUN') {
                    insertZeroingData(carouselId);
                } else {
                    console.log(`[ZEROING] CR${carouselId} zeroing active but state is ${carousel.state}, skipping insert.`);
                }
            }
        }
    }
});

// --- Data Aggregator Integration ---
dataAggregator.onUpdate = (stats) => {
    // stats: { productId: { min, max, avg } }
    Object.values(carousels).forEach(c => {
        const pId = c.data.productId;
        if (pId && stats[pId]) {
            c.data.minVal = parseFloat(stats[pId].min.toFixed(2));
            c.data.maxVal = parseFloat(stats[pId].max.toFixed(2));
            c.data.average = parseFloat(stats[pId].avg.toFixed(2));
        }
    });
};
dataAggregator.start();


// Fallback simulation is disabled by default to avoid synthetic WEIGHT_DATA inserts on startup.
// Set ENABLE_FALLBACK_SIMULATION=true to re-enable for demo/testing.
const ENABLE_FALLBACK_SIMULATION = process.env.ENABLE_FALLBACK_SIMULATION === 'true';
if (ENABLE_FALLBACK_SIMULATION) {
    // Start fast simulation loop (100ms) - Fallback if no OPC
    setInterval(simulateLiveValues, 100);
}

exports.reloadSettings = () => {
    console.log("Reloading Settings...");
    try {
        if (fs.existsSync(settingsPath)) {
            appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            connectToWeighingDB(); // Reconnect with new settings
            // Reconnect OPC? logic needed in manager
        }
    } catch (e) {
        console.error("Error reloading settings:", e);
    }
};

async function fetchCarouselConfig(showLoading = false) {
    if (!weighingPool) return;

    if (showLoading) {
        // Notify subscribers that loading started
        listeners.forEach(callback => callback({ type: 'config-loading', loading: true }));
    }

    try {
        const tableName = appSettings.table_main || 'PRESET_TABLE';
        console.log(`[DB] Fetching carousel config from table: ${tableName}`);

        // Use raw SQL with table name - mssql supports this
        const query = `
            SELECT * FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY CAROUSEL ORDER BY CREATED_DATETIME DESC) as rn
                FROM [${tableName}]
                WHERE CAROUSEL IN (1, 2, 3, 4, 5)
            ) t
            WHERE rn = 1
        `;

        const result = await weighingPool.request().query(query);

        if (result.recordset.length > 0) {
            console.log(`[DB] Found ${result.recordset.length} carousel configs`);
        } else {
            console.log(`[DB] No carousel configs found in ${tableName}`);
        }

        result.recordset.forEach(row => {
            const carouselId = row.CAROUSEL;
            if (carousels[carouselId]) {
                // Update Static/Config Data
                carousels[carouselId].data = {
                    ...carousels[carouselId].data, // Keep existing live values
                    productId: row.PRODUCT_ID,
                    productName: row.PRODUCT_NAME,
                    packingOrder: row.PACKING_ORDER,
                    packagingMaterial: row.PACKAGING_MATERIAL,
                    target: row.TARGET_COUNT,
                    toleranceMin: row.TOLERANCE_MIN,
                    toleranceMax: row.TOLERANCE_MAX,
                    packWeight: row.PACKAGING_WEIGHT,
                };

                // Map DB State (Strings: RUN, PAUSE, STOP)
                const dbState = row.MACHINE_STATE;
                if (dbState !== undefined && dbState !== null) {
                    // Normalize state
                    let s = 'STOP';
                    const st = String(dbState).toUpperCase().trim();

                    if (st === 'RUN' || st === 'RUNNING' || st === '1') s = 'RUN';
                    else if (st === 'PAUSE' || st === 'PAUSED' || st === '2') s = 'PAUSE';
                    else if (st === 'STOP' || st === 'STOPPED' || st === '0' || st === '3') s = 'STOP';

                    carousels[carouselId].state = s;
                    syncMachineRunSignal(carouselId, s).catch((err) => {
                        console.warn(`[OPC] syncMachineRunSignal failed for CR${carouselId}: ${err.message}`);
                    });

                    // Counter logic for STOP state
                    if (s === 'STOP') {
                        const cData = carousels[carouselId].data;
                        if ((cData.counter || 0) >= (cData.target || 0)) {
                            cData.counter = 0;
                            // console.log(`[POLL] CR${carouselId} counter reset due to STOP state`);
                        }
                    }
                }
            }
        });

        // --- Fetch Last Counter Values based on Packing Order ---
        const weightTable = appSettings.table_weight || 'WEIGHT_DATA';
        const poQueries = result.recordset.map(async (row) => {
            const carouselId = row.CAROUSEL;
            const packingOrder = row.PACKING_ORDER;
            if (!packingOrder) return;

            try {
                const countResult = await weighingPool.request()
                    .input('po', sql.NVarChar, packingOrder)
                    .input('cr', sql.NVarChar, `CR${carouselId}`)
                    .query(`SELECT MAX(PRODUCT_COUNT) as lastCount FROM [${weightTable}] WHERE PACKING_ORDER = @po AND CAROUSEL = @cr`);

                if (countResult.recordset[0] && countResult.recordset[0].lastCount !== null) {
                    const count = countResult.recordset[0].lastCount;
                    if (carousels[carouselId]) {
                        carousels[carouselId].data.counter = count;
                        console.log(`[INIT] Loaded counter for CR${carouselId}: ${count} (PO: ${packingOrder})`);
                    }
                }
            } catch (err) {
                console.error(`[DB] Error fetching last count for CR${carouselId}:`, err.message);
            }
        });

        await Promise.all(poQueries);

    } catch (err) {
        console.error("Error fetching Carousel Config:", err.message);
    } finally {
        if (showLoading) {
            // Notify subscribers that loading ended
            listeners.forEach(callback => callback({ type: 'config-loading', loading: false }));
        }
    }
}

function simulateLiveValues() {

    Object.values(carousels).forEach(c => {
        if (!c.data.productId) return;

        // If OPC is connected, we might still want to simulate "Counter" if OPC doesn't provide it
        // valid check: if (opcUaManager.connected) ...

        const isRunning = [3, 4].includes(c.id);

        // Simulation for Demo purposes (populate charts/counters)
        if (isRunning && !opcUaManager.connected) {

            // Counter Increment (approx 1 per 2-5 seconds)
            if (Math.random() < 0.05) {
                c.data.counter = (c.data.counter || 0) + 1;
                if (c.data.counter > c.data.target) c.data.counter = 0; // Reset loop

                // Update Weight on new pack
                const target = 25.1;
                const noise = (Math.random() - 0.5) * 0.1; // +/- 0.05

                c.data.lastNett = parseFloat((target + noise).toFixed(2));
                c.data.lastGross = parseFloat((c.data.lastNett + (c.data.packWeight || 0.08)).toFixed(2));

                // LOG DATA FOR AGGREGATION
                insertWeightData(c.id, c.data).catch(e => console.error("Log error:", e.message)); // Logging Nett weight

                // Recalc Average (Simple moving average simulation - for immediate feedback)
                // This will be overwritten by Aggregator's SQL query results eventually
                const currentAvg = c.data.average || target;
                c.data.average = parseFloat(((currentAvg * 9 + c.data.lastNett) / 10).toFixed(2));
            }
        }
    });
}

// Subscription logic for Socket.IO
const listeners = new Map();

exports.subscribe = (id, callback) => {
    listeners.set(id, callback);
};

exports.manualRefresh = async () => {
    console.log("[Controller] Manual refresh requested...");
    await fetchCarouselConfig(true);
};

exports.unsubscribe = (id) => {
    listeners.delete(id);
};

exports.subscribeAlerts = (id, callback) => {
    alertListeners.set(id, callback);
};

exports.unsubscribeAlerts = (id) => {
    alertListeners.delete(id);
};

// Broadcast loop
setInterval(() => {
    // Convert carousel object to array or map for frontend
    const snapshot = carousels;
    listeners.forEach(cb => cb(snapshot));
}, 1000); // Send updates every 1s

exports.getSnapshot = () => carousels;

exports.getActiveAlarmsList = () => [];

exports.getActiveAlarms = (req, res) => {
    res.json([]);
};

exports.getTagHistory = (req, res) => {
    res.json([]);
};

// New: Get Weight Data History
exports.getWeightHistory = async (req, res) => {
    if (!weighingPool) {
        return res.status(503).json({ error: "Database not connected" });
    }
    try {
        const parsedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
        const requestedCarousel = (req.query.carousel || '').toString().trim().toUpperCase();
        const carouselFilter = /^CR\d+$/.test(requestedCarousel) ? requestedCarousel : '';

        const request = weighingPool.request();
        let query = `
            SELECT TOP ${limit} *
            FROM ${appSettings.table_weight || 'WEIGHT_DATA'}
        `;

        if (carouselFilter) {
            query += ` WHERE CAROUSEL = @carousel`;
            request.input('carousel', sql.NVarChar, carouselFilter);
        }

        query += ` ORDER BY TIMESTAMP DESC`;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.getSqlStatus = (req, res) => {
    // Check if pool exists and is connected
    const connected = weighingPool && weighingPool.connected;
    res.json({
        connected: !!connected,
        server: appSettings.sql_server,
        database: appSettings.sql_db
    });
};

exports.resetErrorTag = async (req, res) => {
    try {
        const opcStatus = opcUaManager.getStatus();
        if (!opcStatus.connected) {
            return res.status(503).json({ error: "OPC-UA not connected" });
        }

        const opcConfig = opcUaManager.getConfig();
        const nodes = Array.isArray(opcConfig.nodes) ? opcConfig.nodes : [];
        const resetNode = nodes.find((n) => {
            const signalType = (n.signalType || '').toString().trim().toUpperCase();
            const name = (n.name || '').toString().trim().toUpperCase();
            const desc = (n.description || '').toString().trim().toUpperCase();
            return signalType === 'RESET' || name === 'RST' || desc === 'RESET ERROR';
        });

        if (!resetNode || !resetNode.nodeId) {
            return res.status(404).json({ error: "OPC Reset tag (RST / Reset error) not found in configuration" });
        }

        // Write pulse TRUE -> FALSE (common reset pattern for PLC/OPC tag)
        let writeOn = await opcUaManager.writeNode(resetNode.nodeId, true, 'Boolean');
        if (writeOn.error) {
            // Fallback for servers expecting numeric reset signal.
            writeOn = await opcUaManager.writeNode(resetNode.nodeId, 1, 'Int16');
        }
        if (writeOn.error) {
            return res.status(500).json({ error: `Failed writing reset ON: ${writeOn.error}` });
        }

        await new Promise(resolve => setTimeout(resolve, 250));

        let writeOff = await opcUaManager.writeNode(resetNode.nodeId, false, 'Boolean');
        if (writeOff.error) {
            writeOff = await opcUaManager.writeNode(resetNode.nodeId, 0, 'Int16');
        }
        if (writeOff.error) {
            return res.status(500).json({ error: `Reset ON sent but failed writing OFF: ${writeOff.error}` });
        }

        return res.json({
            success: true,
            message: "Reset error signal sent successfully",
            node: {
                name: resetNode.name,
                nodeId: resetNode.nodeId,
                description: resetNode.description || ''
            }
        });
    } catch (err) {
        console.error('[OPC] Reset error tag failed:', err.message);
        return res.status(500).json({ error: `Reset error failed: ${err.message}` });
    }
};

exports.controlCarousel = async (req, res) => {
    const { carouselId, command } = req.body;
    // Command Mapping: RESET (String directly)
    const val = command;

    // Validate command
    const validCommands = ['RESET']; // Only RESET allowed now? Or allow others but only show RESET?
    // User said "Only leave RESET", implying others are removed.
    // However, for safety/legacy, maybe keep them but just hide? No, user said "Hilangkan" (Remove).
    // Let's allow RESET. What about others? If I remove them from UI, they won't be sent.
    // But if I remove them from validCommands, old calls will fail. That's fine.

    if (!['RESET', 'RUN', 'PAUSE', 'STOP'].includes(val) || !carousels[carouselId]) {
        return res.status(400).json({ error: "Invalid command or carousel" });
    }

    if (!weighingPool) {
        return res.status(503).json({ error: "Database Offline. Control disabled." });
    }

    // Logic: If STOP is pressed and target is reached, reset counter
    if (val === 'STOP' && carousels[carouselId]) {
        const cData = carousels[carouselId].data;
        if ((cData.counter || 0) >= (cData.target || 0)) {
            cData.counter = 0;
            console.log(`[STOP] CR${carouselId} counter reset (Target reached: ${cData.target})`);
        } else {
            console.log(`[STOP] CR${carouselId} counter maintained (Target not reached: ${cData.counter}/${cData.target})`);
        }
    }

    try {
        // Update the LATEST record for this carousel
        // Use CREATED_DATETIME as identifier if ID doesn't exist
        const result = await weighingPool.request()
            .input('state', sql.NVarChar, val) // Changed to NVarChar for strings
            .input('carousel', sql.Int, carouselId)
            .query(`
                UPDATE ${appSettings.table_main || 'PRESET_TABLE'}
                SET MACHINE_STATE = @state
                WHERE CAROUSEL = @carousel
                AND CREATED_DATETIME = (
                    SELECT TOP 1 CREATED_DATETIME FROM ${appSettings.table_main || 'PRESET_TABLE'} 
                    WHERE CAROUSEL = @carousel 
                    ORDER BY CREATED_DATETIME DESC
                )
            `);

        if (result.rowsAffected[0] > 0) {
            // Update local state immediately for responsiveness
            // Map directly since now state matches command
            const stateMap = { 'RUN': 'RUN', 'PAUSE': 'PAUSE', 'STOP': 'STOP', 'RESET': 'RESET' };
            if (carousels[carouselId]) {
                carousels[carouselId].state = stateMap[val];
                syncMachineRunSignal(carouselId, carousels[carouselId].state).catch((err) => {
                    console.warn(`[OPC] syncMachineRunSignal failed for CR${carouselId}: ${err.message}`);
                });
            }

            res.json({ success: true, message: `Sent ${command} to DB` });
        } else {
            res.status(404).json({ error: "No active record found to update" });
        }
    } catch (err) {
        console.error("Control DB Error:", err);
        res.status(500).json({ error: "Database Update Failed" });
    }
};
