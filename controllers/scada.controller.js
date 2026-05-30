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
const pendingInsertTimers = new Map();
const SQL_ALERT_DEBOUNCE_MS = 8000;

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

// Helper to insert weight data into SQL
async function insertWeightData(carouselId, data) {
    if (!weighingPool) {
        logger.warn('SQL', `Skipping insert for CR${carouselId}: Database pool not ready.`);
        return false;
    }
    if (!data.productId) {
        logger.warn('SQL', `Skipping insert for CR${carouselId}: No Product ID defined in configuration.`);
        return false;
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

        logger.info('SQL', `Inserted data for CR${carouselId}: ${data.lastNett}kg (${status})`);
        return true;
    } catch (err) {
        logger.error('SQL', `Error inserting weight data: ${err.message}`);
        notifySqlInsertFailure({
            message: `Gagal update ${appSettings.table_weight || 'WEIGHT_DATA'} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: appSettings.table_weight || 'WEIGHT_DATA',
            reason: err.message
        });
        return false;
    }
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

// --- OPC-UA Integration ---
function inferOpcMachineId(data) {
    const configuredMachineId = parseInt(data.machineId, 10);
    if (Number.isInteger(configuredMachineId) && configuredMachineId >= 1 && configuredMachineId <= 5) {
        return configuredMachineId;
    }

    const tagName = (data.name || '').toString().trim().toUpperCase();
    const nodeId = (data.nodeId || '').toString().trim().toUpperCase();
    const fromName = tagName.match(/^(?:CR|S)([1-5])$/);
    if (fromName) return parseInt(fromName[1], 10);

    const fromNodeId = nodeId.match(/(?:CR0?([1-5])|SENSOR0?([1-5]))/);
    if (fromNodeId) return parseInt(fromNodeId[1] || fromNodeId[2], 10);

    return null;
}

function inferOpcSignalType(data) {
    const configuredSignalType = (data.signalType || '').toString().trim().toUpperCase();
    if (configuredSignalType) return configuredSignalType;

    const tagName = (data.name || '').toString().trim().toUpperCase();
    const nodeId = (data.nodeId || '').toString().trim().toUpperCase();
    if (/^CR[1-5]$/.test(tagName) || /GR_CR0?[1-5]/.test(nodeId) || /GROSS/.test(nodeId)) return 'GROSS_WEIGHT';
    if (/^S[1-5]$/.test(tagName) || /SENSOR0?[1-5]/.test(nodeId)) return 'PRODUCT_SENSOR';
    if (/^RST$|^RESET$/.test(tagName) || /RESET/.test(nodeId)) return 'RESET';
    return '';
}

function parseOpcBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = (value || '').toString().trim().toLowerCase();
    return ['true', '1', 'on', 'yes'].includes(normalized);
}

// Subscribe to OPC Manager updates
opcUaManager.subscribe('scada-controller', (event, data) => {
    if (event !== 'opcua-value' || !data || !data.name) return;

    const carouselId = inferOpcMachineId(data);
    if (!carouselId || !carousels[carouselId]) return;

    const signalType = inferOpcSignalType(data);

    if (signalType === 'GROSS_WEIGHT') {
        const rawValue = parseFloat(data.value);
        const scale = Number.isFinite(parseFloat(data.scale)) ? parseFloat(data.scale) : 1;
        const val = rawValue * scale;
        if (!Number.isNaN(val)) {
            carousels[carouselId].data.lastGross = parseFloat(val.toFixed(2));
            const packWeight = carousels[carouselId].data.packWeight || 0;
            carousels[carouselId].data.lastNett = parseFloat((val - packWeight).toFixed(2));
        }
        return;
    }

    if (signalType === 'PRODUCT_SENSOR') {
        const newValue = parseOpcBoolean(data.value);
        const oldValue = carousels[carouselId].data.sensorStatus;

        carousels[carouselId].data.sensorStatus = newValue;

        if (!oldValue && newValue) {
            logger.info('SCADA', `Sensor Rising Edge for CR${carouselId}`);

            if (carousels[carouselId].state === 'RUN') {
                const currentCounter = carousels[carouselId].data.counter || 0;
                const nextCounter = currentCounter + 1;
                logger.info('SCADA', `CR${carouselId} rising edge detected, scheduling SQL insert with counter ${nextCounter}`);

                const insertPayload = { ...carousels[carouselId].data, counter: nextCounter };
                if (pendingInsertTimers.has(carouselId)) {
                    clearTimeout(pendingInsertTimers.get(carouselId));
                }

                const timer = setTimeout(async () => {
                    pendingInsertTimers.delete(carouselId);
                    const inserted = await insertWeightData(carouselId, insertPayload);
                    if (inserted) {
                        carousels[carouselId].data.counter = nextCounter;
                        logger.info('SCADA', `CR${carouselId} counter updated to ${nextCounter} after SQL insert`);
                    }
                }, 500);
                pendingInsertTimers.set(carouselId, timer);
                logger.info('SCADA', `Scheduled SQL insert for CR${carouselId} in 500ms`);
            } else {
                logger.info('SCADA', `CR${carouselId} is ${carousels[carouselId].state}, skipping counter increment and SQL write.`);
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
                    logger.info('SQL', `CR${carouselId} PACKING_ORDER changed: ${oldPackingOrder} → ${newPackingOrder}`);
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

                if (carousels[carouselId]) {
                    if (countResult.recordset[0] && countResult.recordset[0].lastCount !== null) {
                        // PO exists in history - load the last counter
                        const count = countResult.recordset[0].lastCount;
                        carousels[carouselId].data.counter = count;
                        logger.info('SQL', `Loaded counter for CR${carouselId}: ${count} (PO: ${packingOrder})`);
                    } else {
                        // ⭐ NEW PO with no history - RESET counter to 0
                        carousels[carouselId].data.counter = 0;
                        logger.info('SQL', `New PACKING_ORDER for CR${carouselId} (PO: ${packingOrder}), counter initialized to 0`);
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
