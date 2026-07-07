// Simulation script for CR1 sensor + weight — rising edge trigger
process.env.SCADA_SQL_AUTO_CONNECT = 'false';

const controller = require('../controllers/scada.controller');
const opc = require('../utils/opcua.manager');

console.log('--- Simulation start ---');

// Emit a gross weight (raw value: 2500 -> with scale 0.01 becomes 25.00 kg)
opc._emitUpdate('CR1', { value: 2500 });

// Sensor rising edge (OFF→ON) triggers weight capture after 550ms settle delay
setTimeout(() => {
    console.log('Emitting S1 = true (rising edge → triggers capture)');
    opc._emitUpdate('S1', { value: true });
}, 20);

// Wait for capture to finish (550ms delay + processing) then dump snapshot
setTimeout(() => {
    const snap = controller.getSnapshot();
    console.log('--- CR1 snapshot after capture ---');
    console.log(JSON.stringify(snap[1], null, 2));
    console.log('--- Simulation end ---');
    process.exit(0);
}, 1200);
