
// Mocking the environment
let carousels = {
    5: { data: { counter: 0 } }
};

const mockRow = {
    CAROUSEL: 5,
    PACKING_ORDER: '72260217002'
};

const mockCountResult = {
    recordset: [{ lastCount: 2 }]
};

async function testInitLogic() {
    console.log("Testing initialization logic...");
    const carouselId = mockRow.CAROUSEL;
    const packingOrder = mockRow.PACKING_ORDER;

    console.log(`Before: counter=${carousels[carouselId].data.counter}`);

    // Simulating the logic from fetchCarouselConfig
    if (mockCountResult.recordset[0] && mockCountResult.recordset[0].lastCount !== null) {
        const count = mockCountResult.recordset[0].lastCount;
        if (carousels[carouselId]) {
            carousels[carouselId].data.counter = count;
            console.log(`[INIT] Loaded counter for CR${carouselId}: ${count} (PO: ${packingOrder})`);
        }
    }

    console.log(`After: counter=${carousels[carouselId].data.counter}`);
}

testInitLogic();
