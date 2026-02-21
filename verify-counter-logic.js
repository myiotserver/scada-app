
// Mock carousels state
let carousels = {
    1: {
        id: 1,
        state: 'RUN',
        data: {
            counter: 100,
            target: 100
        }
    },
    2: {
        id: 2,
        state: 'RUN',
        data: {
            counter: 50,
            target: 100
        }
    }
};

function testCounterLogic(carouselId, command) {
    const val = command;
    console.log(`\nTesting Carousel ${carouselId} with command: ${val}`);
    console.log(`Before: counter=${carousels[carouselId].data.counter}, target=${carousels[carouselId].data.target}`);

    // Logic from scada.controller.js
    if (val === 'STOP' && carousels[carouselId]) {
        const cData = carousels[carouselId].data;
        if ((cData.counter || 0) >= (cData.target || 0)) {
            cData.counter = 0;
            console.log(`[STOP] CR${carouselId} counter reset (Target reached: ${cData.target})`);
        } else {
            console.log(`[STOP] CR${carouselId} counter maintained (Target not reached: ${cData.counter}/${cData.target})`);
        }
    }

    console.log(`After: counter=${carousels[carouselId].data.counter}`);
}

// Case 1: PRODUCT_COUNT >= TARGET_COUNT
testCounterLogic(1, 'STOP');

// Case 2: PRODUCT_COUNT < TARGET_COUNT
testCounterLogic(2, 'STOP');

// Case 3: Other command (e.g. PAUSE)
testCounterLogic(1, 'PAUSE');
