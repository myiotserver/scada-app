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

function emitSqlStatus() {
    const connected = weighingPool && weighingPool.connected;
    const status = {
        connected: !!connected,
        server: appSettings.sql_server,
        database: appSettings.sql_db
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
        return;
    }
    if (!data.productId) {
        logger.warn('SQL', `Skipping insert for CR${carouselId}: No Product ID defined in configuration.`);
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

        logger.info('SQL', `Inserted data for CR${carouselId}: ${data.lastNett}kg (${status})`);
    } catch (err) {
        logger.error('SQL', `Error inserting weight data: ${err.message}`);
        notifySqlInsertFailure({
            message: `Gagal update ${appSettings.table_weight || 'WEIGHT_DATA'} untuk CR${carouselId}`,
            carousel: `CR${carouselId}`,
            table: appSettings.table_weight || 'WEIGHT_DATA',
            reason: err.message
        });
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
if (appSettings.sql_server) {
    connectToWeighingDB();
}

// --- OPC-UA Integration ---
// Subscribe to OPC Manager updates
opcUaManager.subscribe('scada-controller', (event, data) => {
    if (event === 'opcua-value' && data && data.name) {
        // Map CR1..CR5 to Carousel 1..5
        const match = data.name.match(/^CR(\d+)$/);
        if (match) {
            const carouselId = parseInt(match[1]);
            if (carousels[carouselId]) {
                const val = parseFloat(data.value) / 100;
                if (!isNaN(val)) {
                    carousels[carouselId].data.lastGross = parseFloat(val.toFixed(2));
                    // Calc Nett
                    const packWeight = carousels[carouselId].data.packWeight || 0;
                    carousels[carouselId].data.lastNett = parseFloat((val - packWeight).toFixed(2));
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

                // RISING EDGE DETECTION (False -> True)
                if (!oldValue && newValue) {
                    logger.info('SCADA', `Sensor Rising Edge for CR${carouselId}`);

                    // CHECK LOGIC: Only write and increment counter if state is RUN
                    if (carousels[carouselId].state === 'RUN') {
                        // Increment counter
                        carousels[carouselId].data.counter = (carousels[carouselId].data.counter || 0) + 1;
                        logger.info('SCADA', `CR${carouselId} counter incremented to ${carousels[carouselId].data.counter}`);

                        // Use current data snapshot
                        insertWeightData(carouselId, carousels[carouselId].data);
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


// Start fast simulation loop (100ms) - Fallback if no OPC
setInterval(simulateLiveValues, 100);

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
        // Notify subscribers that loading started
        listeners.forEach(callback => callback({ type: 'config-loading', loading: true }));
    }

    try {
        const tableName = appSettings.table_main || 'PRESET_TABLE';
        // Quiet polling — only log on first fetch or errors

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

        if (result.recordset.length === 0) {
            logger.warn('SQL', `No carousel configs found in ${tableName}`);
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
                        logger.info('SQL', `Loaded counter for CR${carouselId}: ${count} (PO: ${packingOrder})`);
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
        // NOTE: This is ONLY for visual dashboard simulation when OPC is offline.
        // SQL inserts are NEVER done from here — only from real OPC sensor rising edge detection.
        if (isRunning && !opcUaManager.connected) {

            // Counter Increment (approx 1 per 2-5 seconds)
            if (Math.random() < 0.05) {
                c.data.counter = (c.data.counter || 0) + 1;
                if (c.data.counter > c.data.target) c.data.counter = 0; // Reset loop

                // Update Weight on new pack (visual only)
                const target = 25.1;
                const noise = (Math.random() - 0.5) * 0.1; // +/- 0.05

                c.data.lastNett = parseFloat((target + noise).toFixed(2));
                c.data.lastGross = parseFloat((c.data.lastNett + (c.data.packWeight || 0.08)).toFixed(2));

                // NO SQL INSERT HERE — inserts only happen from real OPC sensor data

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
    res.json({
        connected: !!connected,
        server: appSettings.sql_server,
        database: appSettings.sql_db
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
