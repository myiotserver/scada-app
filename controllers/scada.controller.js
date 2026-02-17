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
    1: { id: 1, name: 'Carousel 1', state: 'RUNNING', data: {} },
    2: { id: 2, name: 'Carousel 2', state: 'STOPPED', data: {} },
    3: { id: 3, name: 'Carousel 3', state: 'IDLE', data: {} },
    4: { id: 4, name: 'Carousel 4', state: 'RUNNING', data: {} },
    5: { id: 5, name: 'Carousel 5', state: 'MAINTENANCE', data: {} }
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
        { carouselId: 1, nodeId: "ns=3;s=\"Carousel1\".\"GrossWeight\"" },
        { carouselId: 2, nodeId: "ns=3;s=\"Carousel2\".\"GrossWeight\"" },
        { carouselId: 3, nodeId: "ns=3;s=\"Carousel3\".\"GrossWeight\"" },
        { carouselId: 4, nodeId: "ns=3;s=\"Carousel4\".\"GrossWeight\"" },
        { carouselId: 5, nodeId: "ns=3;s=\"Carousel5\".\"GrossWeight\"" }
    ]
};

// Initialize OPC-UA
if (appSettings.opc_endpoint) {
    opcConfig.endpoint = appSettings.opc_endpoint;
}
// Add monitor items
opcConfig.nodes.forEach(n => {
    opcUaManager.addNode(n.nodeId, `Carousel_${n.carouselId}`);
});

opcUaManager.connect(opcConfig.endpoint).then(connected => {
    if (connected) {
        opcUaManager.onUpdate = (name, value) => {
            // name format: Carousel_1
            const parts = name.split('_');
            const id = parseInt(parts[1]);
            if (carousels[id]) {
                carousels[id].data.lastGross = parseFloat(value.toFixed(2));
                // Calc Nett? Gross - PackWeight
                const packWeight = carousels[id].data.packWeight || 0;
                carousels[id].data.lastNett = parseFloat((carousels[id].data.lastGross - packWeight).toFixed(2));

                // DATA LOGGING STRATEGY: 
                // We should log only when valid? 
                // For now, logging every update might be too much. 
                // But without a trigger signal (e.g. "Print"), we can't know when a pack is done.
                // We'll skip logging for OPC real-time stream unless value chages significantly or logic is defined.
                // For this task, user asked to calc from WEIGHT_DATA. 
                // We'll assume the PLC writes to WEIGHT_DATA or we write to it on specific events.
                // I will add a throttle or threshold to log stable weights if needed.
                // For simplicity in this step: NO LOGGING on raw stream, only on Simulation for Demo.
                // If the user wants OPC logging, they need to provide a trigger node (e.g. "PackDone").
                // I'll leave a comment.
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
                    packWeight: row.PACKAGING_WEIGHT
                };
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
                logWeightData(c.id, c.data);

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
