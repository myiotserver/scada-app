// Simulation script for CR1 sensor + weight - multiple triggers (rising edge)
process.env.SCADA_SQL_AUTO_CONNECT = 'false';
process.env.OPCUA_AUTO_CONNECT = 'false';

const controller = require('../controllers/scada.controller');
const opc = require('../utils/opcua.manager');

console.log('--- Multi-trigger simulation start ---');
console.log('Initial snapshot:');
let snap = controller.getSnapshot();
console.log(`CR1 counter: ${snap[1].data.counter}, _localCounterIs1Based: ${snap[1].data._localCounterIs1Based}`);

function doTrigger(delay, triggerNum) {
    setTimeout(() => {
        console.log(`\n=== Trigger ${triggerNum} (should be counter=${triggerNum}) ===`);
        opc._emitUpdate('CR1', { value: 2500 + triggerNum * 10 });
        
        setTimeout(() => {
            // Rising edge (OFF→ON) triggers capture after 550ms settle delay
            opc._emitUpdate('S1', { value: true });
        }, 20);
        
        // Reset sensor to OFF after capture completes (~600ms) so next trigger sees a fresh rising edge
        setTimeout(() => {
            opc._emitUpdate('S1', { value: false });
        }, 700);
    }, delay);
}

// Triggers spaced past SENSOR_MIN_GAP_MS (default 1500ms) between rising edges.
// Each trigger needs ~700ms to complete (20ms pre-delay + 550ms settle + reset).
// 1800ms spacing is safe (> 1500ms debounce, > 700ms processing).
doTrigger(50, 1);
doTrigger(1800, 2);
doTrigger(3550, 3);

// Print snapshot after all triggers
setTimeout(() => {
    snap = controller.getSnapshot();
    console.log(`\n--- Final CR1 snapshot ---`);
    console.log(`counter: ${snap[1].data.counter} (should be 3)`);
    console.log(`_localCounterIs1Based: ${snap[1].data._localCounterIs1Based}`);
    console.log(`lastGross: ${snap[1].data.lastGross}`);
    console.log('--- Simulation end ---');
    process.exit(0);
}, 5000);
