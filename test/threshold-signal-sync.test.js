const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSync() {
    const source = fs.readFileSync(path.join(__dirname, '../controllers/scada.controller.js'), 'utf8');
    const start = source.indexOf('async function writeTolerancesToOpc(');
    const end = source.indexOf('\n/** Debounce map', start);
    assert(start >= 0 && end > start, 'Real controller sync function must be found');
    const calls = [];
    const errors = [];
    const context = {
        lastWrittenTolerances: {},
        getDeviationThreshold: () => 0.05,
        getDeviationThresholdMax: () => 0.12,
        notifyToleranceWriteFailure: (...args) => errors.push(args),
        logger: { warn: (...args) => errors.push(args), error: (...args) => errors.push(args) },
        opcUaManager: {
            getStatus: () => ({ connected: true }),
            writeToNodesBySignalType: async (signalType, carouselId, value) => {
                calls.push({ signalType, carouselId, value });
                return [{ success: true }];
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    return { context, calls, errors };
}

test('CR1-5 synchronize only current tolerance and threshold signal types', async () => {
    const { context, calls, errors } = loadSync();
    for (let id = 1; id <= 5; id++) {
        await context.writeTolerancesToOpc(id, { toleranceMin: 25, toleranceMax: 25.25 }, true);
        assert.deepEqual(calls.filter(c => c.carouselId === id), [
            { signalType: 'TOLERANCE_MIN', carouselId: id, value: 25 },
            { signalType: 'TOLERANCE_MAX', carouselId: id, value: 25.25 },
            { signalType: 'THRESHOLD_MIN', carouselId: id, value: 0.05 },
            { signalType: 'THRESHOLD_MAX', carouselId: id, value: 0.12 }
        ]);
    }
    assert.deepEqual(errors, []);
});

test('current signal sync still caches successes and honors force', async () => {
    const { context, calls, errors } = loadSync();
    const data = { toleranceMin: 25, toleranceMax: 25.25 };
    await context.writeTolerancesToOpc(1, data);
    calls.length = 0;
    await context.writeTolerancesToOpc(1, data);
    assert.equal(calls.length, 0);
    await context.writeTolerancesToOpc(1, data, true);
    assert.deepEqual(calls.map(c => c.signalType), ['TOLERANCE_MIN', 'TOLERANCE_MAX', 'THRESHOLD_MIN', 'THRESHOLD_MAX']);
    assert.deepEqual(errors, []);
});
