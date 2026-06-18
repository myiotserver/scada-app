const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(__dirname, '../config/scada-settings.json');
const opcUaManager = require('../utils/opcua.manager');
const dataAggregator = require('../utils/data.aggregator');
const logger = require('../utils/logger');

// Memory for settings
let appSettings = {};
try {
    if (fs.existsSync(settingsPath)) {
        appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        logger.info('SYSTEM', `Settings loaded: server=${appSettings.sql_server}, db=${appSettings.sql_db}`);
    }
} catch (e) {
    logger.error('SYSTEM', `Error loading settings: ${e.message}`);
}

// Helper to construct MSSQL config from settings
function getMssqlConfig() {
    const envServer   = process.env.MSSQL_SERVER;
    const envUser     = process.env.MSSQL_USER;
    const envPassword = process.env.MSSQL_PASSWORD;
    const envDatabase = process.env.MSSQL_DATABASE;
    const envPort     = process.env.MSSQL_PORT;

    const server   = envServer   || appSettings.sql_server || '';
    const user     = envUser     || appSettings.sql_uid    || '';
    const password = envPassword || appSettings.sql_pass   || '';
    const database = envDatabase || appSettings.sql_db     || '';
    const port     = Number(envPort || appSettings.sql_port || 1433);

    // Log the active source for each critical field so operators can diagnose config priority issues
    const src = (envVal, label) => envVal ? `env(${label})` : `settings.json`;
    logger.info('SQL', `Config source — server:${src(envServer,'MSSQL_SERVER')} user:${src(envUser,'MSSQL_USER')} db:${src(envDatabase,'MSSQL_DATABASE')} port:${src(envPort,'MSSQL_PORT')}`);

    return {
        user,
        password,
        server,
        database,
        port: Number.isFinite(port) ? port : 1433,
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

function isSqlStartupAutoConnectEnabled() {
    if (process.env.SCADA_SQL_AUTO_CONNECT !== undefined) {
        return process.env.SCADA_SQL_AUTO_CONNECT === 'true';
    }
    return appSettings.sql_auto_connect !== false;
}

// In-memory state for the Carousels (1-5)
let carousels = {
    1: {
        id: 1,
        name: 'Carousel 1',
        state: 'RUN',
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
        state: 'STOP',
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
        state: 'RUN',
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
let sqlHealthTimer = null;
let sqlReconnectTimer = null;
let sqlReconnectAttempt = 0;
const SQL_RECONNECT_DELAYS = [5000, 10000, 20000, 30000];
const SQL_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const sqlStatusListeners = new Map();
const alertListeners = new Map();
const lastSqlInsertAlertTs = new Map();
const SQL_ALERT_DEBOUNCE_MS = 8000;
const SENSOR_WEIGHT_CAPTURE_DELAY_MS = Number(process.env.SENSOR_WEIGHT_CAPTURE_DELAY_MS) || 50;
/** Ignore sensor rising edges closer than this (bounce / double trigger). */
const SENSOR_MIN_GAP_MS = Number(process.env.SENSOR_MIN_GAP_MS) || 1500;
/** Reject sensor pulses shorter than this (noise / false trigger). */
const SENSOR_MIN_PULSE_MS = Number(process.env.SENSOR_MIN_PULSE_MS) || 500;
/** Reject inserts below this gross (empty scale / noise). */
const MIN_VALID_GROSS_KG = Number(process.env.MIN_VALID_GROSS_KG) || 1;
const pendingWeightInserts = new Set();
const pendingZeroingInserts = new Set();
const captureTimers = new Map();
const zeroingTimers = new Map();
const ZEROING_CAPTURE_DELAY_MS = Number(process.env.ZEROING_CAPTURE_DELAY_MS) || 500;
const CAROUSEL_BROADCAST_DEBOUNCE_MS = 100;
let carouselBroadcastTimer = null;

function emitCarouselSnapshot() {
    listeners.forEach(cb => {
        try { cb(carousels); } catch (e) { /* ignore */ }
    });
}

function scheduleCarouselBroadcast() {
    if (carouselBroadcastTimer) return;
    carouselBroadcastTimer = setTimeout(() => {
        carouselBroadcastTimer = null;
        emitCarouselSnapshot();
    }, CAROUSEL_BROADCAST_DEBOUNCE_MS);
}

function getDbProductCount(data) {
    const counter = parseInt(data.counter, 10);
    // PRODUCT_COUNT in SQL is stored as 1-based.
    // When counter is incremented on sensor edge from 0 to 1, a persistent flag
    // `_localCounterIs1Based` is set to indicate that local counter now represents
    // the 1-based count (not zero-based anymore). This flag persists for all
    // subsequent inserts until counter is reset to 0.
    // - If flag is set: return counter directly (already 1-based)
    // - If flag is not set: return counter + 1 (legacy zero-based behavior)
    if (data && data._localCounterIs1Based) {
        return Number.isInteger(counter) && counter > 0 ? counter : 1;
    }
    return Number.isInteger(counter) ? counter + 1 : 1;
}

function resolveLocalCounterFromProductCount(productCount) {
    const count = parseInt(productCount, 10);
    return Number.isInteger(count) && count > 0 ? count : 0;
}

function weightInsertKey(carouselId, data) {
    const po = (data.packingOrder || '').toString().trim();
    const productCount = getDbProductCount(data);
    return `CR${carouselId}|${po}|${productCount}`;
}

function zeroingInsertKey(carouselId, data) {
    const po = (data.packingOrder || '').toString().trim();
    return `CR${carouselId}|${po}`;
}

function isTruthySignal(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return !!value;
}

function getWorkflowSignals(data) {
    return {
        mdSwitch: isTruthySignal(data && data.mdSwitch),
        systemPaused: isTruthySignal(data && data.systemPaused)
    };
}

function canInsertWeightData(data) {
    const signals = getWorkflowSignals(data);
    // MD_SWITCH check removed — sensor edge is sufficient proof of valid production.
    // Data will be inserted regardless of MD_SWITCH status.
    return !signals.systemPaused;
}

function canInsertZeroingData(carouselId, data) {
    const signals = getWorkflowSignals(data);
    const state = carousels[carouselId] ? carousels[carouselId].state : 'STOP';
    // MD_SWITCH check removed — zeroing event from PLC is sufficient proof.
    return state === 'RUN';
}

function emitSqlStatus() {
    const connected = weighingPool && weighingPool.connected;
    const config = getMssqlConfig();
    const status = {
        connected: !!connected,
        server: config.server,
        database: config.database
    };
    sqlStatusListeners.forEach(cb => {
        try { cb(status); } catch (e) { }
    });
}

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

function finalizeWeightCapture(carouselId, grossAtTrigger, attempt) {
    const current = carousels[carouselId];
    if (!current || current.state !== 'RUN') {
        logger.info('SCADA', `CR${carouselId} weight capture skipped: state is ${current?.state || 'missing'}`);
        return;
    }

    const gross = current.data.lastGross;
    const nett = current.data.lastNett;

    if (!Number.isFinite(gross) || gross < MIN_VALID_GROSS_KG) {
        const currentCounter = current.data.counter || 0;
        logger.warn('SCADA', `CR${carouselId} insert skipped: gross ${gross} below minimum ${MIN_VALID_GROSS_KG} kg (counter=${currentCounter}, nextCounter=${currentCounter + 1})`);
        return;
    }

    const prevCounter = current.data.counter || 0;
    const nextCounter = prevCounter + 1;
    current.data.counter = nextCounter;
    // Mark that counter is now 1-based (incremented from 0 to 1).
    // This flag persists for all subsequent inserts until reset.
    if (prevCounter === 0) current.data._localCounterIs1Based = true;
    logger.info('SCADA', `CR${carouselId} counter incremented to ${nextCounter}`);

    const snapshot = {
        ...current.data,
        counter: nextCounter,
        lastGross: gross,
        lastNett: nett
    };

    const waitedMs = SENSOR_WEIGHT_CAPTURE_DELAY_MS;
    logger.info('SCADA', `CR${carouselId} weight captured after ${waitedMs}ms (settled): trigger gross=${grossAtTrigger} → saved gross=${gross} nett=${nett} counter=${snapshot.counter}`);
    insertWeightData(carouselId, snapshot);
}

function scheduleWeightCapture(carouselId) {
    const carousel = carousels[carouselId];
    if (!carousel) return;

    if (captureTimers.has(carouselId)) {
        logger.warn('SCADA', `CR${carouselId} capture skipped: previous capture still pending.`);
        return;
    }

    const grossAtTrigger = carousel.data.lastGross;

    const timer = setTimeout(() => {
        captureTimers.delete(carouselId);
        finalizeWeightCapture(carouselId, grossAtTrigger, 0);
    }, SENSOR_WEIGHT_CAPTURE_DELAY_MS);

    captureTimers.set(carouselId, timer);
}

// Helper to insert weight data into SQL
async function insertWeightData(carouselId, data) {
    if (!canInsertWeightData(data)) {
        const signals = getWorkflowSignals(data);
        logger.warn('SQL', `Skipping insert for CR${carouselId}: workflow not ready (MD_SWITCH=${signals.mdSwitch}, SYSTEM_PAUSED=${signals.systemPaused}).`);
        return;
    }

    if (!weighingPool) {
        logger.warn('SQL', `Skipping insert for CR${carouselId}: Database pool not ready.`);
        return;
    }
    if (!data.productId) {
        logger.warn('SQL', `Skipping insert for CR${carouselId}: No Product ID defined in configuration.`);
        return;
    }

    const productCount = getDbProductCount(data);
    const insertKey = weightInsertKey(carouselId, data);
    if (pendingWeightInserts.has(insertKey)) {
        logger.warn('SQL', `Skipping duplicate insert (in-flight) for CR${carouselId} PO=${data.packingOrder} counter=${data.counter} dbProductCount=${productCount}`);
        return;
    }

    pendingWeightInserts.add(insertKey);

    try {
        // Calculate STATUS based on GROSS_WEIGHT
        let status = 'Normal';
        if (data.lastGross < data.toleranceMin) status = 'Underweight';
        else if (data.lastGross > data.toleranceMax) status = 'Overweight';

        const result = await weighingPool.request()
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
            .input('productCount', sql.Int, productCount)
            .input('targetCount', sql.Int, data.target || 0)
            .input('status', sql.NVarChar, status)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM [${appSettings.table_weight || 'WEIGHT_DATA'}]
                    WHERE PACKING_ORDER = @packingOrder
                      AND CAROUSEL = @carousel
                      AND PRODUCT_COUNT = @productCount
                )
                BEGIN
                    INSERT INTO ${appSettings.table_weight || 'WEIGHT_DATA'} 
                    (TIMESTAMP, PACKING_ORDER, PRODUCT_ID, PRODUCT_NAME, PACKAGING_MATERIAL, CAROUSEL, 
                     GROSS_WEIGHT, NETT_WEIGHT, TOLERANCE_MIN, TOLERANCE_MAX, PRODUCT_COUNT, TARGET_COUNT, STATUS)
                    VALUES 
                    (DATEADD(HOUR, 7, GETUTCDATE()), @packingOrder, @productId, @productName, @packagingMaterial, @carousel, 
                     @grossWeight, @nettWeight, @toleranceMin, @toleranceMax, @productCount, @targetCount, @status)
                END
            `);

        if (!result.rowsAffected || result.rowsAffected[0] === 0) {
            logger.warn('SQL', `Skipping duplicate insert (already in DB) for CR${carouselId} PO=${data.packingOrder} counter=${data.counter} dbProductCount=${productCount}`);
            return;
        }

        logger.info('SQL', `Inserted data for CR${carouselId}: gross=${data.lastGross}kg nett=${data.lastNett}kg (${status}) PO=${data.packingOrder} counter=${data.counter} dbProductCount=${productCount}`);

        if (carousels[carouselId]) {
            carousels[carouselId].data.lastGross = data.lastGross;
            carousels[carouselId].data.lastNett = data.lastNett;
            carousels[carouselId].data._lastInsertedGross = data.lastGross;
            carousels[carouselId].data._lastInsertedProductCount = productCount;
            emitCarouselSnapshot();
        }
    } catch (err) {
        logger.error('SQL', `Error inserting weight data: ${err.message}`);
        notifySqlInsertFailure({
            message: `Gagal update ${appSettings.table_weight || 'WEIGHT_DATA'} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: appSettings.table_weight || 'WEIGHT_DATA',
            reason: err.message
        });
    } finally {
        pendingWeightInserts.delete(insertKey);
    }
}

async function insertZeroingData(carouselId, data) {
    if (!canInsertZeroingData(carouselId, data)) {
        const signals = getWorkflowSignals(data);
        const state = carousels[carouselId] ? carousels[carouselId].state : 'UNKNOWN';
        logger.warn('SQL', `Skipping zeroing insert for CR${carouselId}: workflow not ready (MD_SWITCH=${signals.mdSwitch}, STATE=${state}).`);
        return;
    }

    if (!weighingPool) {
        logger.warn('SQL', `Skipping zeroing insert for CR${carouselId}: Database pool not ready.`);
        return;
    }
    if (!data.productId) {
        logger.warn('SQL', `Skipping zeroing insert for CR${carouselId}: No Product ID defined in configuration.`);
        return;
    }

    const gross = parseFloat(data.lastGross);
    if (!Number.isFinite(gross)) {
        logger.warn('SQL', `Skipping zeroing insert for CR${carouselId}: Gross weight is not valid (${data.lastGross}).`);
        return;
    }

    const insertKey = zeroingInsertKey(carouselId, data);
    if (pendingZeroingInserts.has(insertKey)) {
        logger.warn('SQL', `Skipping duplicate zeroing insert (in-flight) for CR${carouselId} PO=${data.packingOrder}`);
        return;
    }

    pendingZeroingInserts.add(insertKey);

    try {
        const table = appSettings.table_zeroing || 'ZEROINGPLCDATA';
        await weighingPool.request()
            .input('productId', sql.NVarChar, data.productId)
            .input('packagingMaterial', sql.NVarChar, data.packagingMaterial)
            .input('packingOrder', sql.NVarChar, data.packingOrder)
            .input('carousel', sql.NVarChar, `CR${carouselId}`)
            .input('zeroWeight', sql.Decimal(18, 2), gross)
            .query(`
                INSERT INTO ${table}
                (TIMESTAMP, PRODUCT_ID, PACKAGING_MATERIAL, PACKING_ORDER, CAROUSEL, ZERO_WEIGHT)
                VALUES
                (DATEADD(HOUR, 7, GETUTCDATE()), @productId, @packagingMaterial, @packingOrder, @carousel, @zeroWeight)
            `);

        logger.info('SQL', `Inserted zeroing data for CR${carouselId}: zero=${gross}kg PO=${data.packingOrder}`);
    } catch (err) {
        logger.error('SQL', `Error inserting zeroing data: ${err.message}`);
        notifySqlInsertFailure({
            message: `Gagal update ${appSettings.table_zeroing || 'ZEROINGPLCDATA'} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: appSettings.table_zeroing || 'ZEROINGPLCDATA',
            reason: err.message
        });
    } finally {
        pendingZeroingInserts.delete(insertKey);
    }
}

function scheduleZeroingCapture(carouselId) {
    if (zeroingTimers.has(carouselId)) {
        logger.warn('SCADA', `CR${carouselId} zeroing capture skipped: previous capture still pending.`);
        return;
    }

    const timer = setTimeout(() => {
        zeroingTimers.delete(carouselId);

        const current = carousels[carouselId];
        if (!current) {
            logger.warn('SCADA', `CR${carouselId} zeroing capture skipped: carousel missing.`);
            return;
        }

        logger.info('SCADA', `CR${carouselId} zeroing captured after ${ZEROING_CAPTURE_DELAY_MS}ms: gross=${current.data.lastGross}`);
        insertZeroingData(carouselId, { ...current.data });
    }, ZEROING_CAPTURE_DELAY_MS);

    zeroingTimers.set(carouselId, timer);
}

// Connect to WEIGHING DB (Configuration Data)
async function connectToWeighingDB() {
    try {
        if (weighingPool) {
            try { await weighingPool.close(); } catch (e) { }
        }

        const config = getMssqlConfig();
        logger.info('SQL', `Connecting to ${config.server}/${config.database} as ${config.user}`);

        weighingPool = await new sql.ConnectionPool(config).connect();
        logger.info('SQL', `✓ Connected to SQL Server (${config.database})`);
        logger.info('SQL', `Using table_main: ${appSettings.table_main || 'PRESET_TABLE'}`);

        sqlReconnectAttempt = 0; // Reset backoff on success
        emitSqlStatus();

        // Initial Fetch
        fetchCarouselConfig(true);

        // Clear existing interval if any
        if (pollingInterval) clearInterval(pollingInterval);

        // Poll for config changes (quietly in background)
        pollingInterval = setInterval(() => fetchCarouselConfig(false), 30000);

        // Start SQL health check
        startSqlHealthCheck();

    } catch (err) {
        logger.error('SQL', `✗ Failed to connect to DB: ${err.message}`);
        emitSqlStatus();
        triggerSqlAutoReconnect();
    }
}

// SQL Health Check
function startSqlHealthCheck() {
    stopSqlHealthCheck();
    sqlHealthTimer = setInterval(async () => {
        if (!weighingPool) return;
        try {
            await weighingPool.request().query('SELECT 1');
            // Health OK — silent
        } catch (err) {
            logger.error('SQL', `Health check failed: ${err.message}`);
            emitSqlStatus();
            triggerSqlAutoReconnect();
        }
    }, SQL_HEALTH_CHECK_INTERVAL);
}

function stopSqlHealthCheck() {
    if (sqlHealthTimer) {
        clearInterval(sqlHealthTimer);
        sqlHealthTimer = null;
    }
}

function triggerSqlAutoReconnect() {
    if (!appSettings.sql_auto_reconnect) {
        logger.info('SQL', 'Auto-reconnect disabled. Will not attempt reconnection.');
        return;
    }
    if (sqlReconnectTimer) return; // already scheduled

    stopSqlHealthCheck();
    const delay = SQL_RECONNECT_DELAYS[Math.min(sqlReconnectAttempt, SQL_RECONNECT_DELAYS.length - 1)];
    sqlReconnectAttempt++;

    logger.warn('SQL', `Auto-reconnect attempt #${sqlReconnectAttempt} in ${delay / 1000}s...`);

    sqlReconnectTimer = setTimeout(async () => {
        sqlReconnectTimer = null;
        logger.info('SQL', `Attempting auto-reconnect #${sqlReconnectAttempt}...`);
        await connectToWeighingDB();
    }, delay);
}
// Start connection
const startupSqlConfig = getMssqlConfig();
if (isSqlStartupAutoConnectEnabled() && startupSqlConfig.server) {
    connectToWeighingDB();
} else {
    logger.info('SQL', 'Startup auto-connect is disabled. Waiting for manual connect via settings reload.');
}

function getOpcNodeScale(tagName) {
    const opcConfig = opcUaManager.getConfig();
    const nodes = Array.isArray(opcConfig.nodes) ? opcConfig.nodes : [];
    const normalized = (tagName || '').toString().trim().toUpperCase();
    const node = nodes.find(n => (n.name || '').toString().trim().toUpperCase() === normalized);
    const scale = parseFloat(node?.scale);
    return Number.isFinite(scale) ? scale : 0.01;
}

// --- OPC-UA Integration ---
// Subscribe to OPC Manager updates
opcUaManager.subscribe('scada-controller', (event, data) => {
    if (event === 'opcua-value' && data && data.name) {
        const opcConfig = opcUaManager.getConfig();
        const nodes = Array.isArray(opcConfig.nodes) ? opcConfig.nodes : [];
        const eventName = data.name.toString().trim();
        const node = nodes.find(n => (n.name || '').toString().trim() === eventName);
        const signalType = (node && node.signalType ? String(node.signalType) : '').trim().toUpperCase();

        if (node && ['MD_SWITCH', 'SYSTEM_PAUSED'].includes(signalType) && node.machineId) {
            const carouselId = node.machineId;
            if (carousels[carouselId]) {
                const newValue = isTruthySignal(data.value);
                const dataKey = signalType === 'MD_SWITCH' ? 'mdSwitch' : 'systemPaused';
                const oldValue = isTruthySignal(carousels[carouselId].data[dataKey]);

                carousels[carouselId].data[dataKey] = newValue;

                if (oldValue !== newValue) {
                    logger.info('SCADA', `CR${carouselId} ${signalType}=${newValue}`);
                    scheduleCarouselBroadcast();
                }
            }
        }

        if (node && signalType === 'ZEROING' && node.machineId) {
            const carouselId = node.machineId;
            if (carousels[carouselId]) {
                const newValue = isTruthySignal(data.value);
                const oldValue = isTruthySignal(carousels[carouselId].data.zeroingStatus);

                carousels[carouselId].data.zeroingStatus = newValue;

                if (!oldValue && newValue) {
                    logger.info('SCADA', `Zeroing Rising Edge for CR${carouselId}; capture scheduled in ${ZEROING_CAPTURE_DELAY_MS}ms`);
                    scheduleZeroingCapture(carouselId);
                }
            }
        }

        // Map CR1..CR5 to Carousel 1..5
        const match = data.name.match(/^CR(\d+)$/);
        if (match) {
            const carouselId = parseInt(match[1]);
            if (carousels[carouselId]) {
                const scale = getOpcNodeScale(data.name);
                const val = parseFloat(data.value) * scale;
                if (!isNaN(val)) {
                    const gross = parseFloat(val.toFixed(2));
                    const packWeight = carousels[carouselId].data.packWeight || 0;
                    const nett = parseFloat((val - packWeight).toFixed(2));

                    carousels[carouselId].data.lastGross = gross;
                    carousels[carouselId].data.lastNett = nett;

                    scheduleCarouselBroadcast();
                }
            }
        }

        // Map S1..S5 (Sensors)
        const matchSensor = data.name.match(/^S(\d+)$/);
        if (matchSensor) {
            const carouselId = parseInt(matchSensor[1]);
            if (carousels[carouselId]) {
                const newValue = !!data.value;
                const oldValue = carousels[carouselId].data.sensorStatus;

                // Update status
                carousels[carouselId].data.sensorStatus = newValue;
                if (oldValue !== newValue) {
                    scheduleCarouselBroadcast();
                }

                // RISING EDGE DETECTION (False -> True)
                if (!oldValue && newValue) {
                    // Record when sensor turned ON so we can measure pulse duration at falling edge
                    carousels[carouselId].data._lastSensorRisingTs = Date.now();
                }

                // FALLING EDGE DETECTION (True -> False)
                if (oldValue && !newValue) {
                    logger.info('SCADA', `Sensor Falling Edge for CR${carouselId}`);

                    if (carousels[carouselId].state === 'RUN') {
                        const now = Date.now();
                        const lastEdge = carousels[carouselId].data._lastSensorEdgeTs || 0;

                        // 1) Gap between consecutive falling edges — detect bounce
                        if (now - lastEdge < SENSOR_MIN_GAP_MS) {
                            logger.warn('SCADA', `CR${carouselId} sensor bounce ignored (${now - lastEdge}ms < ${SENSOR_MIN_GAP_MS}ms)`);
                            return;
                        }

                        // 2) Minimum pulse (ON) duration — reject false triggers (noise, mechanical vibration)
                        const risingTs = carousels[carouselId].data._lastSensorRisingTs;
                        if (risingTs) {
                            const pulseDuration = now - risingTs;
                            if (pulseDuration < SENSOR_MIN_PULSE_MS) {
                                logger.warn('SCADA', `CR${carouselId} sensor pulse too short (${pulseDuration}ms < ${SENSOR_MIN_PULSE_MS}ms) — false trigger ignored.`);
                                return;
                            }
                        } else {
                            // No rising edge recorded (e.g. sensor already TRUE at app start).
                            // Allow the trigger but warn about the missing reference.
                            logger.warn('SCADA', `CR${carouselId} no rising edge timestamp found — allowing pulse without duration check.`);
                        }

                        // 3) Pending capture — previous trigger still being processed
                        if (captureTimers.has(carouselId)) {
                            logger.warn('SCADA', `CR${carouselId} sensor bounce ignored (Previous capture still in progress)`);
                            return;
                        }

                        carousels[carouselId].data._lastSensorEdgeTs = now;
                        scheduleWeightCapture(carouselId);
                    } else {
                        logger.info('SCADA', `CR${carouselId} is ${carousels[carouselId].state}, skipping counter increment and SQL write.`);
                    }
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


// Fallback simulation DISABLED — no fake data when OPC is offline
// setInterval(simulateLiveValues, 100);

exports.reloadSettings = () => {
    logger.info('SYSTEM', 'Reloading Settings...');
    try {
        if (fs.existsSync(settingsPath)) {
            appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            connectToWeighingDB(); // Reconnect with new settings
        }
    } catch (e) {
        logger.error('SYSTEM', `Error reloading settings: ${e.message}`);
    }
};

async function fetchCarouselConfig(showLoading = false) {
    if (!weighingPool) return;

    if (showLoading) {
        listeners.forEach(callback => callback({ type: 'config-loading', loading: true }));
    }

    try {
        const tableName = appSettings.table_main || 'PRESET_TABLE';
        const query = `
            SELECT * FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY CAROUSEL ORDER BY CREATED_DATETIME DESC) as rn
                FROM [${tableName}]
                WHERE CAROUSEL IN (1, 2, 3, 4, 5)
            ) t
            WHERE rn = 1
        `;

        const result = await weighingPool.request().query(query);

        if (result.recordset.length === 0) {
            logger.warn('SQL', `No carousel configs found in ${tableName}`);
        }

        result.recordset.forEach(row => {
            const carouselId = row.CAROUSEL;
            if (carousels[carouselId]) {
                // ⭐ Track old Packing Order for change detection
                const oldPackingOrder = carousels[carouselId].data.packingOrder;
                const newPackingOrder = row.PACKING_ORDER;
                
                carousels[carouselId].data = {
                    ...carousels[carouselId].data,
                    productId: row.PRODUCT_ID,
                    productName: row.PRODUCT_NAME,
                    packingOrder: row.PACKING_ORDER,
                    packagingMaterial: row.PACKAGING_MATERIAL,
                    target: row.TARGET_COUNT,
                    toleranceMin: row.TOLERANCE_MIN,
                    toleranceMax: row.TOLERANCE_MAX,
                    packWeight: row.PACKAGING_WEIGHT,
                };
                
                // Log when Packing Order changes
                if (oldPackingOrder && oldPackingOrder !== newPackingOrder) {
                    logger.info('SQL', `CR${carouselId} PACKING_ORDER changed: ${oldPackingOrder} -> ${newPackingOrder}`);
                    // Reset counter to 0 for new packing order — it will be reloaded
                    // from DB below if the new PO already has existing records
                    carousels[carouselId].data.counter = 0;
                    if (carousels[carouselId].data._localCounterIs1Based) {
                        delete carousels[carouselId].data._localCounterIs1Based;
                    }
                }

                const dbState = row.MACHINE_STATE;
                if (dbState !== undefined && dbState !== null) {
                    let s = 'STOP';
                    const st = String(dbState).toUpperCase().trim();

                    if (st === 'RUN' || st === 'RUNNING' || st === '1') s = 'RUN';
                    else if (st === 'PAUSE' || st === 'PAUSED' || st === '2') s = 'PAUSE';
                    else if (st === 'STOP' || st === 'STOPPED' || st === '0' || st === '3') s = 'STOP';

                    carousels[carouselId].state = s;

                    if (s === 'STOP') {
                        const cData = carousels[carouselId].data;
                        if ((cData.counter || 0) >= (cData.target || 0)) {
                            cData.counter = 0;
                            // Clear the 1-based flag when counter resets
                            if (cData._localCounterIs1Based) delete cData._localCounterIs1Based;
                        }
                    }
                }
            }
        });

        // Fetch Last Counter Values based on Packing Order
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

                const lastWeightResult = await weighingPool.request()
                    .input('po', sql.NVarChar, packingOrder)
                    .input('cr', sql.NVarChar, `CR${carouselId}`)
                    .query(`
                        SELECT TOP 1 GROSS_WEIGHT
                        FROM [${weightTable}]
                        WHERE PACKING_ORDER = @po AND CAROUSEL = @cr
                        ORDER BY PRODUCT_COUNT DESC, TIMESTAMP DESC
                    `);

                if (carousels[carouselId]) {
                    const localCounter = carousels[carouselId].data.counter || 0;
                    if (lastWeightResult.recordset[0] && lastWeightResult.recordset[0].GROSS_WEIGHT != null) {
                        carousels[carouselId].data._lastInsertedGross = parseFloat(lastWeightResult.recordset[0].GROSS_WEIGHT);
                    }
                    if (countResult.recordset[0] && countResult.recordset[0].lastCount !== null) {
                        const dbCount = countResult.recordset[0].lastCount;
                        carousels[carouselId].data._lastInsertedProductCount = dbCount;
                        const dbCounter = resolveLocalCounterFromProductCount(dbCount);
                        const nextCounter = Math.max(localCounter, dbCounter);
                        carousels[carouselId].data.counter = nextCounter;
                        if (nextCounter > 0) {
                            carousels[carouselId].data._localCounterIs1Based = true;
                        } else if (carousels[carouselId].data._localCounterIs1Based) {
                            delete carousels[carouselId].data._localCounterIs1Based;
                        }
                        if (nextCounter > dbCounter) {
                            logger.info('SQL', `Counter for CR${carouselId} kept at ${nextCounter} (DB max ${dbCount}, PO: ${packingOrder})`);
                        } else {
                            logger.info('SQL', `Loaded counter for CR${carouselId}: ${nextCounter} (PO: ${packingOrder})`);
                        }
                    } else {
                        // No records exist for this PACKING_ORDER — reset counter to 0
                        carousels[carouselId].data.counter = 0;
                        delete carousels[carouselId].data._lastInsertedProductCount;
                        if (carousels[carouselId].data._localCounterIs1Based) {
                            delete carousels[carouselId].data._localCounterIs1Based;
                        }
                        logger.info('SQL', `New PACKING_ORDER for CR${carouselId} (PO: ${packingOrder}), counter reset to 0`);
                    }
                }
            } catch (err) {
                logger.error('SQL', `Error fetching last count for CR${carouselId}: ${err.message}`);
            }
        });

        await Promise.all(poQueries);

    } catch (err) {
        logger.error('SQL', `Error fetching Carousel Config: ${err.message}`);
    } finally {
        if (showLoading) {
            listeners.forEach(callback => callback({ type: 'config-loading', loading: false }));
        }
    }
}
const listeners = new Map();

exports.subscribe = (id, callback) => {
    listeners.set(id, callback);
};

exports.manualRefresh = async () => {
    logger.info('SYSTEM', 'Manual refresh requested');
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

// Periodic broadcast for config/counter/stats (weight also pushed on OPC change)
setInterval(() => {
    emitCarouselSnapshot();
}, 1000);

exports.getSnapshot = () => carousels;

exports.getActiveAlarmsList = () => [];

exports.getActiveAlarms = (req, res) => {
    res.json([]);
};

exports.getTagHistory = (req, res) => {
    res.json([]);
};

// Weight history — server-side pagination (only fetch one page per request)
exports.getWeightHistory = async (req, res) => {
    if (!weighingPool) {
        return res.status(503).json({ error: "Database not connected" });
    }
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const parsedPageSize = parseInt(req.query.pageSize, 10);
        const pageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0
            ? Math.min(parsedPageSize, 200)
            : 50;
        const offset = (page - 1) * pageSize;

        const requestedCarousel = (req.query.carousel || '').toString().trim().toUpperCase();
        const carouselFilter = /^CR\d+$/.test(requestedCarousel) ? requestedCarousel : '';
        const table = appSettings.table_weight || 'WEIGHT_DATA';

        const request = weighingPool.request();
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, pageSize);

        let query = `
            SELECT
                *,
                COUNT(*) OVER() AS _totalCount
            FROM (
                SELECT TOP 50000
                    TIMESTAMP,
                    CAROUSEL,
                    PRODUCT_ID,
                    PRODUCT_NAME,
                    TARGET_COUNT,
                    PRODUCT_COUNT,
                    GROSS_WEIGHT,
                    NETT_WEIGHT,
                    STATUS
                FROM ${table}
                ORDER BY TIMESTAMP DESC
            ) AS TopRecords
            WHERE 1=1
        `;

        if (carouselFilter) {
            query += ` AND CAROUSEL = @carousel`;
            request.input('carousel', sql.NVarChar, carouselFilter);
        }

        query += `
            ORDER BY TIMESTAMP DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        const result = await request.query(query);
        const rows = result.recordset || [];
        const total = rows.length > 0 ? Number(rows[0]._totalCount) : 0;
        const records = rows.map(({ _totalCount, ...row }) => row);

        res.json({
            records,
            total,
            page,
            pageSize,
            totalPages: total > 0 ? Math.ceil(total / pageSize) : 1
        });
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.getSqlStatus = (req, res) => {
    // Check if pool exists and is connected
    const connected = weighingPool && weighingPool.connected;
    const config = getMssqlConfig();
    res.json({
        connected: !!connected,
        server: config.server,
        database: config.database
    });
};

exports.subscribeSqlStatus = (id, callback) => {
    sqlStatusListeners.set(id, callback);
};

exports.unsubscribeSqlStatus = (id) => {
    sqlStatusListeners.delete(id);
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
            const name = (n.name || '').toString().trim().toUpperCase();
            const desc = (n.description || '').toString().trim().toUpperCase();
            return name === 'RST' || desc === 'RESET ERROR';
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
            logger.info('SCADA', `CR${carouselId} counter reset (Target reached: ${cData.target})`);
        } else {
            logger.info('SCADA', `CR${carouselId} counter maintained (Target not reached: ${cData.counter}/${cData.target})`);
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
            if (carousels[carouselId]) carousels[carouselId].state = stateMap[val];

            res.json({ success: true, message: `Sent ${command} to DB` });
        } else {
            res.status(404).json({ error: "No active record found to update" });
        }
    } catch (err) {
        logger.error('SQL', `Control DB Error: ${err.message}`);
        res.status(500).json({ error: "Database Update Failed" });
    }
};
