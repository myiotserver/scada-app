// Simulation script for CR1 sensor + weight
process.env.SCADA_SQL_AUTO_CONNECT = 'false';

const controller = require('../controllers/scada.controller');
const opc = require('../utils/opcua.manager');

console.log('--- Simulation start ---');

// Emit a gross weight (raw value: 2500 -> with scale 0.01 becomes 25.00 kg)
opc._emitUpdate('CR1', { value: 2500 });

// Small delay before sensor pulse
setTimeout(() => {
    console.log('Emitting S1 = true (rising)');
    opc._emitUpdate('S1', { value: true });
}, 20);

// Falling edge after 80ms
setTimeout(() => {
    console.log('Emitting S1 = false (falling)');
    opc._emitUpdate('S1', { value: false });
}, 120);

// Wait for capture to finish then dump snapshot
setTimeout(() => {
    const snap = controller.getSnapshot();
    console.log('--- CR1 snapshot after capture ---');
    console.log(JSON.stringify(snap[1], null, 2));
    console.log('--- Simulation end ---');
    process.exit(0);
}, 800);
