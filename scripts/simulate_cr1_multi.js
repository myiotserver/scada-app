// Simulation script for CR1 sensor + weight - multiple triggers
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
            opc._emitUpdate('S1', { value: true });
        }, 20);
        
        setTimeout(() => {
            opc._emitUpdate('S1', { value: false });
        }, 120);
    }, delay);
}

// Triggers are spaced past SENSOR_MIN_GAP_MS (default 1500ms), measured from
// falling edge to falling edge.
doTrigger(50, 1);
doTrigger(1700, 2);
doTrigger(3350, 3);

// Print snapshot after all triggers
setTimeout(() => {
    snap = controller.getSnapshot();
    console.log(`\n--- Final CR1 snapshot ---`);
    console.log(`counter: ${snap[1].data.counter} (should be 3)`);
    console.log(`_localCounterIs1Based: ${snap[1].data._localCounterIs1Based}`);
    console.log(`lastGross: ${snap[1].data.lastGross}`);
    console.log('--- Simulation end ---');
    process.exit(0);
}, 4200);
