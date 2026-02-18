/**
 * SCADA Data Simulator
 * Generates realistic industrial process data simulating a factory production line.
 * Replaces VCS backend from WinCC Unified.
 */

class DataSimulator {
    constructor() {
        this.tags = {};
        this.listeners = new Map();
        this.interval = null;
        this.tickCount = 0;

        // Initialize process tags with realistic ranges
        this._initTags();
    }

    _initTags() {
        this.tags = {
            // === Hydraulic System ===
            'HYD.Pressure_PT001': { value: 25.0, min: 18, max: 35, unit: 'bar', area: 'Hydraulic', noise: 0.5, trend: 0, alarmHH: 32, alarmH: 30, alarmL: 20, alarmLL: 18 },
            'HYD.Pressure_PT002': { value: 22.0, min: 15, max: 30, unit: 'bar', area: 'Hydraulic', noise: 0.3, trend: 0, alarmHH: 28, alarmH: 26, alarmL: 17, alarmLL: 15 },
            'HYD.Temperature_TT001': { value: 45.0, min: 20, max: 80, unit: '°C', area: 'Hydraulic', noise: 0.2, trend: 0, alarmHH: 75, alarmH: 65, alarmL: 25, alarmLL: 20 },
            'HYD.FlowRate_FT001': { value: 520.0, min: 0, max: 800, unit: 'L/min', area: 'Hydraulic', noise: 5, trend: 0, alarmHH: 750, alarmH: 700, alarmL: 100, alarmLL: 50 },
            'HYD.Level_LT001': { value: 75.0, min: 0, max: 100, unit: '%', area: 'Hydraulic', noise: 0.5, trend: 0, alarmHH: 95, alarmH: 90, alarmL: 20, alarmLL: 10 },
            'HYD.Pump_P001_Status': { value: 1, min: 0, max: 1, unit: '', area: 'Hydraulic', digital: true },
            'HYD.Pump_P002_Status': { value: 1, min: 0, max: 1, unit: '', area: 'Hydraulic', digital: true },
            'HYD.Valve_V001_Pos': { value: 65.0, min: 0, max: 100, unit: '%', area: 'Hydraulic', noise: 0.1, trend: 0 },

            // === Cooling System ===
            'COOL.Temperature_TT010': { value: 28.0, min: 15, max: 50, unit: '°C', area: 'Cooling', noise: 0.3, trend: 0, alarmHH: 45, alarmH: 40, alarmL: 18, alarmLL: 15 },
            'COOL.Temperature_TT011': { value: 32.0, min: 15, max: 50, unit: '°C', area: 'Cooling', noise: 0.2, trend: 0, alarmHH: 45, alarmH: 40, alarmL: 18, alarmLL: 15 },
            'COOL.FlowRate_FT010': { value: 320.0, min: 0, max: 500, unit: 'L/min', area: 'Cooling', noise: 3, trend: 0, alarmHH: 480, alarmH: 450, alarmL: 50, alarmLL: 20 },
            'COOL.Pressure_PT010': { value: 4.5, min: 0, max: 10, unit: 'bar', area: 'Cooling', noise: 0.1, trend: 0, alarmHH: 8, alarmH: 7, alarmL: 2, alarmLL: 1 },
            'COOL.Fan_F001_Status': { value: 1, min: 0, max: 1, unit: '', area: 'Cooling', digital: true },
            'COOL.Fan_F002_Status': { value: 0, min: 0, max: 1, unit: '', area: 'Cooling', digital: true },

            // === Electrical System ===
            'ELEC.Voltage_L1': { value: 398.0, min: 360, max: 440, unit: 'V', area: 'Electrical', noise: 2, trend: 0, alarmHH: 430, alarmH: 420, alarmL: 370, alarmLL: 360 },
            'ELEC.Voltage_L2': { value: 400.0, min: 360, max: 440, unit: 'V', area: 'Electrical', noise: 2, trend: 0, alarmHH: 430, alarmH: 420, alarmL: 370, alarmLL: 360 },
            'ELEC.Voltage_L3': { value: 401.0, min: 360, max: 440, unit: 'V', area: 'Electrical', noise: 2, trend: 0, alarmHH: 430, alarmH: 420, alarmL: 370, alarmLL: 360 },
            'ELEC.Current_L1': { value: 125.0, min: 0, max: 250, unit: 'A', area: 'Electrical', noise: 3, trend: 0, alarmHH: 230, alarmH: 200, alarmL: 0, alarmLL: 0 },
            'ELEC.Current_L2': { value: 118.0, min: 0, max: 250, unit: 'A', area: 'Electrical', noise: 3, trend: 0, alarmHH: 230, alarmH: 200, alarmL: 0, alarmLL: 0 },
            'ELEC.Current_L3': { value: 122.0, min: 0, max: 250, unit: 'A', area: 'Electrical', noise: 3, trend: 0, alarmHH: 230, alarmH: 200, alarmL: 0, alarmLL: 0 },
            'ELEC.Frequency': { value: 50.0, min: 49, max: 51, unit: 'Hz', area: 'Electrical', noise: 0.05, trend: 0, alarmHH: 50.5, alarmH: 50.3, alarmL: 49.7, alarmLL: 49.5 },
            'ELEC.PowerFactor': { value: 0.95, min: 0.8, max: 1.0, unit: '', area: 'Electrical', noise: 0.01, trend: 0 },
            'ELEC.TotalPower': { value: 145.0, min: 0, max: 300, unit: 'kW', area: 'Electrical', noise: 5, trend: 0 },

            // === Production Line ===
            'PROD.Speed_M001': { value: 1450.0, min: 0, max: 3000, unit: 'RPM', area: 'Production', noise: 10, trend: 0, alarmHH: 2800, alarmH: 2500, alarmL: 500, alarmLL: 0 },
            'PROD.Conveyor_Speed': { value: 2.5, min: 0, max: 5, unit: 'm/s', area: 'Production', noise: 0.05, trend: 0 },
            'PROD.Counter_Total': { value: 15420, min: 0, max: 999999, unit: 'pcs', area: 'Production', counter: true },
            'PROD.Counter_Good': { value: 15280, min: 0, max: 999999, unit: 'pcs', area: 'Production', counter: true },
            'PROD.Counter_Reject': { value: 140, min: 0, max: 999999, unit: 'pcs', area: 'Production', counter: true },
            'PROD.Line_Status': { value: 1, min: 0, max: 1, unit: '', area: 'Production', digital: true },
            'PROD.Emergency_Stop': { value: 0, min: 0, max: 1, unit: '', area: 'Production', digital: true },

            // === Tank System ===
            'TANK.Level_LT100': { value: 68.0, min: 0, max: 100, unit: '%', area: 'Tank', noise: 0.3, trend: -0.01, alarmHH: 95, alarmH: 85, alarmL: 15, alarmLL: 5 },
            'TANK.Level_LT101': { value: 42.0, min: 0, max: 100, unit: '%', area: 'Tank', noise: 0.3, trend: 0.02, alarmHH: 95, alarmH: 85, alarmL: 15, alarmLL: 5 },
            'TANK.Temperature_TT100': { value: 55.0, min: 20, max: 90, unit: '°C', area: 'Tank', noise: 0.2, trend: 0, alarmHH: 85, alarmH: 75, alarmL: 25, alarmLL: 20 },
            'TANK.Agitator_M100_Status': { value: 1, min: 0, max: 1, unit: '', area: 'Tank', digital: true },
            'TANK.InletValve_V100': { value: 80.0, min: 0, max: 100, unit: '%', area: 'Tank', noise: 0.1, trend: 0 },
            'TANK.OutletValve_V101': { value: 45.0, min: 0, max: 100, unit: '%', area: 'Tank', noise: 0.1, trend: 0 },
        };

        // Store history for trend charts
        this.history = {};
        for (const tagName in this.tags) {
            this.history[tagName] = [];
        }
    }

    /**
     * Start real-time simulation
     */
    start(intervalMs = 1000) {
        if (this.interval) return;

        this.interval = setInterval(() => {
            this.tickCount++;
            this._simulateTick();
        }, intervalMs);

        console.log(`[SCADA Simulator] Started with ${Object.keys(this.tags).length} tags @ ${intervalMs}ms interval`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    _simulateTick() {
        const timestamp = Date.now();
        const updates = {};

        for (const [name, tag] of Object.entries(this.tags)) {
            if (tag.digital) {
                // Random digital state changes (rare)
                if (Math.random() < 0.002 && name !== 'PROD.Emergency_Stop') {
                    tag.value = tag.value === 1 ? 0 : 1;
                }
            } else if (tag.counter) {
                // Counters increment
                if (this.tags['PROD.Line_Status']?.value === 1) {
                    if (name === 'PROD.Counter_Total') {
                        tag.value += Math.random() < 0.7 ? 1 : 0;
                    } else if (name === 'PROD.Counter_Good') {
                        const total = this.tags['PROD.Counter_Total']?.value || 0;
                        const reject = this.tags['PROD.Counter_Reject']?.value || 0;
                        tag.value = total - reject;
                    } else if (name === 'PROD.Counter_Reject') {
                        tag.value += Math.random() < 0.01 ? 1 : 0;
                    }
                }
            } else {
                // Analog values with noise + slow drift
                const noise = (Math.random() - 0.5) * 2 * (tag.noise || 0);
                const drift = tag.trend || 0;

                // Add sinusoidal component for realism
                const sinComp = Math.sin(this.tickCount * 0.01 + name.length) * (tag.noise || 0) * 0.5;

                tag.value += noise + drift + sinComp;

                // Clamp to range
                tag.value = Math.max(tag.min, Math.min(tag.max, tag.value));

                // Reverse trend at boundaries
                if (tag.trend && (tag.value >= tag.max * 0.95 || tag.value <= tag.min + (tag.max - tag.min) * 0.05)) {
                    tag.trend = -tag.trend;
                }
            }

            // Store in history (keep last 600 points = 10 min at 1s interval)
            if (this.history[name]) {
                this.history[name].push({ t: timestamp, v: tag.value });
                if (this.history[name].length > 600) {
                    this.history[name].shift();
                }
            }

            updates[name] = {
                value: tag.digital || tag.counter ? tag.value : parseFloat(tag.value.toFixed(2)),
                unit: tag.unit,
                area: tag.area,
                quality: 'good',
                timestamp
            };
        }

        // Notify all listeners
        for (const [, callback] of this.listeners) {
            callback(updates);
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribe(id, callback) {
        this.listeners.set(id, callback);
    }

    unsubscribe(id) {
        this.listeners.delete(id);
    }

    /**
     * Get current snapshot of all tags
     */
    getSnapshot() {
        const snapshot = {};
        const timestamp = Date.now();
        for (const [name, tag] of Object.entries(this.tags)) {
            snapshot[name] = {
                value: tag.digital || tag.counter ? tag.value : parseFloat(tag.value.toFixed(2)),
                unit: tag.unit,
                area: tag.area,
                min: tag.min,
                max: tag.max,
                alarmHH: tag.alarmHH,
                alarmH: tag.alarmH,
                alarmL: tag.alarmL,
                alarmLL: tag.alarmLL,
                digital: !!tag.digital,
                counter: !!tag.counter,
                quality: 'good',
                timestamp
            };
        }
        return snapshot;
    }

    /**
     * Get tag history for trends
     */
    getHistory(tagName, count = 300) {
        if (!this.history[tagName]) return [];
        return this.history[tagName].slice(-count);
    }

    /**
     * Get all tag names grouped by area
     */
    getTagList() {
        const areas = {};
        for (const [name, tag] of Object.entries(this.tags)) {
            if (!areas[tag.area]) areas[tag.area] = [];
            areas[tag.area].push({
                name,
                unit: tag.unit,
                digital: !!tag.digital,
                counter: !!tag.counter
            });
        }
        return areas;
    }
}

module.exports = DataSimulator;
