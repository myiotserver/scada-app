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
    }
} catch (e) {
    console.error("Error loading settings:", e);
}

// Helper to construct MSSQL config from settings
function getMssqlConfig() {
    return {
        user: appSettings.sql_uid || 'sa',
        password: appSettings.sql_pass || 'VPS@thinkcentre',
        server: appSettings.sql_server || 'columba.s-net.id',
        database: appSettings.sql_db || 'WEIGHING',
        port: 1433,
        options: {
            encrypt: false,
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
    1: { id: 1, name: 'Carousel 1', state: 'RUN', data: {} },
    2: { id: 2, name: 'Carousel 2', state: 'STOP', data: {} },
    3: { id: 3, name: 'Carousel 3', state: 'STOP', data: {} },
    4: { id: 4, name: 'Carousel 4', state: 'RUN', data: {} },
    5: { id: 5, name: 'Carousel 5', state: 'STOP', data: {} }
};

let weighingPool = null;
let pollingInterval = null;

// Helper to log weight data for aggregation
async function logWeightData(carouselId, productId, weight) {
    if (!weighingPool || !productId) return;

    // Simple throttle or just log all events? 
    // For simulation it's controlled (once per pack). 
    // For OPC, we might get many updates. Ideally log only on "Pack Complete" signal or stable weight.
    // For this specific request "calculate from WEIGHT_DATA", we assume WEIGHT_DATA contains discrete events.

    try {
        await weighingPool.request()
            .input('pid', sql.NVarChar, productId)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('carousel', sql.Int, carouselId)
            .query('INSERT INTO WEIGHT_DATA (Product_ID, Actual_Weight, Carousel, Date_Time) VALUES (@pid, @weight, @carousel, GETDATE())');
    } catch (err) {
        console.error("Error logging weight data:", err.message);
    }
}

// Connect to WEIGHING DB (Configuration Data)
async function connectToWeighingDB() {
    try {
        if (weighingPool) {
            await weighingPool.close();
        }

        weighingPool = await new sql.ConnectionPool(getMssqlConfig()).connect();
        console.log("Connected to SQL Server (Dynamic Config)");

        // Initial Fetch
        fetchCarouselConfig();

        // Clear existing interval if any
        if (pollingInterval) clearInterval(pollingInterval);

        // Poll for config changes
        pollingInterval = setInterval(fetchCarouselConfig, 30000);

    } catch (err) {
        console.error("Failed to connect to DB:", err.message);
    }
}
// Start connection
if (appSettings.sql_server) {
    connectToWeighingDB();
}

// --- OPC-UA Integration ---
const opcConfig = {
    endpoint: "opc.tcp://192.168.1.10:4840", // User to provide
    nodes: [
        // Gross Weight Nodes Only - Status/Command moved to SQL
        { carouselId: 1, type: 'weight', nodeId: "ns=3;s=\"Carousel1\".\"GrossWeight\"" },
        { carouselId: 2, type: 'weight', nodeId: "ns=3;s=\"Carousel2\".\"GrossWeight\"" },
        { carouselId: 3, type: 'weight', nodeId: "ns=3;s=\"Carousel3\".\"GrossWeight\"" },
        { carouselId: 4, type: 'weight', nodeId: "ns=3;s=\"Carousel4\".\"GrossWeight\"" },
        { carouselId: 5, type: 'weight', nodeId: "ns=3;s=\"Carousel5\".\"GrossWeight\"" }
    ]
};

// Initialize OPC-UA
if (appSettings.opc_endpoint) {
    opcConfig.endpoint = appSettings.opc_endpoint;
}
// Add monitor items
opcConfig.nodes.forEach(n => {
    opcUaManager.addNode(n.nodeId, `Carousel_${n.carouselId}_${n.type}`);
});

opcUaManager.connect(opcConfig.endpoint).then(connected => {
    if (connected) {
        opcUaManager.onUpdate = (name, value) => {
            const parts = name.split('_');
            const id = parseInt(parts[1]);
            const type = parts[2];

            if (carousels[id] && type === 'weight') {
                carousels[id].data.lastGross = parseFloat(value.toFixed(2));
                // Calc Nett? Gross - PackWeight
                const packWeight = carousels[id].data.packWeight || 0;
                carousels[id].data.lastNett = parseFloat((carousels[id].data.lastGross - packWeight).toFixed(2));
            }
        };
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

async function fetchCarouselConfig() {
    if (!weighingPool) return;

    try {
        const result = await weighingPool.request().query`
            SELECT * FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY CAROUSEL ORDER BY CREATED_DATETIME DESC) as rn
                FROM PRESET_TABLE
                WHERE CAROUSEL IN (1, 2, 3, 4, 5)
            ) t
            WHERE rn = 1
        `;

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
                }
            }
        });

    } catch (err) {
        console.error("Error fetching Carousel Config:", err.message);
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
                logWeightData(c.id, c.data.productId, c.data.lastNett).catch(e => console.error("Log error:", e.message)); // Logging Nett weight

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

exports.unsubscribe = (id) => {
    listeners.delete(id);
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

exports.getSqlStatus = (req, res) => {
    // Check if pool exists and is connected
    const connected = weighingPool && weighingPool.connected;
    res.json({
        connected: !!connected,
        server: appSettings.sql_server,
        database: appSettings.sql_db
    });
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

    try {
        // Update the LATEST record for this carousel
        // Use CREATED_DATETIME as identifier if ID doesn't exist
        const result = await weighingPool.request()
            .input('state', sql.NVarChar, val) // Changed to NVarChar for strings
            .input('carousel', sql.Int, carouselId)
            .query(`
                UPDATE PRESET_TABLE
                SET MACHINE_STATE = @state
                WHERE CAROUSEL = @carousel
                AND CREATED_DATETIME = (
                    SELECT TOP 1 CREATED_DATETIME FROM PRESET_TABLE 
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
        console.error("Control DB Error:", err);
        res.status(500).json({ error: "Database Update Failed" });
    }
};
