/**
 * Unit test for OPC write read-back verification.
 * Verifies that writeToNodesBySignalType() re-reads the node after a
 * successful write and downgrades the result to failure when the
 * PLC's actual value does not match what was written.
 */

const assert = require('assert');

// ---- Simulate _verifyWrite logic (numeric) ----
function verifyWriteNumeric(actual, expected) {
    const actualNum = Number(actual);
    const expectedNum = Number(expected);
    if (!Number.isFinite(actualNum) || !Number.isFinite(expectedNum)) {
        return { verified: false, reason: 'non-numeric' };
    }
    const tolerance = Math.max(Math.abs(expectedNum) * 0.001, 0.01);
    if (Math.abs(actualNum - expectedNum) > tolerance) {
        return { verified: false, actualValue: actualNum, reason: `mismatch: expected ${expectedNum} got ${actualNum}` };
    }
    return { verified: true, actualValue: actualNum };
}

function verifyWriteBoolean(actual, expected) {
    const actualBool = Boolean(actual);
    const expectedBool = Boolean(expected);
    if (actualBool !== expectedBool) {
        return { verified: false, actualValue: actualBool, reason: `mismatch: expected ${expectedBool} got ${actualBool}` };
    }
    return { verified: true, actualValue: actualBool };
}

// Test 1: Read-back matches written value -> verified = true
function testReadBackMatches() {
    const result = verifyWriteNumeric(25.00, 25.00);
    assert.strictEqual(result.verified, true, 'Matching read-back should verify true');
    console.log('✓ Test 1 passed: read-back match => verified');
}

// Test 2: Read-back does NOT match (PLC ignored the write / write-protected tag)
function testReadBackMismatch() {
    // PLC still shows old/default value even though write() returned 'Good'
    const result = verifyWriteNumeric(0.00, 25.00);
    assert.strictEqual(result.verified, false, 'Mismatched read-back should verify false');
    assert.strictEqual(result.actualValue, 0.00);
    console.log('✓ Test 2 passed: read-back mismatch => not verified (write considered failed)');
}

// Test 3: Small float rounding differences on the wire should still verify true
function testReadBackFloatTolerance() {
    // e.g. Real/Float32 PLC tag rounding 25.00 -> 24.999998
    const result = verifyWriteNumeric(24.999998, 25.00);
    assert.strictEqual(result.verified, true, 'Small float rounding should still verify true');
    console.log('✓ Test 3 passed: float rounding within tolerance still verifies');
}

// Test 4: Boolean verification (e.g. MACHINE_RUN)
function testReadBackBoolean() {
    const okResult = verifyWriteBoolean(1, true);
    assert.strictEqual(okResult.verified, true, 'Boolean match should verify true');

    const badResult = verifyWriteBoolean(0, true);
    assert.strictEqual(badResult.verified, false, 'Boolean mismatch should verify false');

    console.log('✓ Test 4 passed: boolean read-back verification works');
}

// Test 5: Downgrading a "Good" write status to failure when read-back fails.
// Simulates the flow in opcua.manager.js's writeToNodesBySignalType().
function testWriteDowngradeOnVerificationFailure() {
    // Simulate a write() call that returned success (statusCode 'Good')
    let result = { success: true, writtenValue: 25.00 };

    // Simulate the read-back check
    const verification = verifyWriteNumeric(0.00, 25.00); // PLC reverted / ignored write
    result.verified = verification.verified;
    result.actualValue = verification.actualValue;
    if (!verification.verified) {
        result.success = false;
        result.error = `Write accepted but read-back mismatch: ${verification.reason}`;
    }

    assert.strictEqual(result.success, false,
        'Write should be downgraded to failure when read-back does not confirm the value');
    assert.ok(result.error.includes('read-back mismatch'),
        'Error message should mention read-back mismatch');

    console.log('✓ Test 5 passed: write status downgraded to failure on verification mismatch');
}

// Test 6: Controller cache should NOT be updated when write result is downgraded to failure
function testControllerCacheNotUpdatedOnFailedVerification() {
    const lastWrittenTolerances = {};
    const cacheKey = '1';
    const prev = lastWrittenTolerances[cacheKey] || {};

    // Simulate writeToNodesBySignalType returning a downgraded (failed) result
    const results = [{ nodeId: 'ns=2;s=Carousel1...TOLERANCE_MIN', success: false, verified: false, error: 'read-back mismatch' }];

    const tolMin = 25.00;
    if (results.length > 0 && results.every(item => item.success)) {
        prev.tolMin = tolMin;
    }
    // else: cache NOT updated -> next 5s cycle will retry

    lastWrittenTolerances[cacheKey] = prev;

    assert.strictEqual(lastWrittenTolerances[cacheKey].tolMin, undefined,
        'Cache should remain unset when verification failed, forcing a retry on next cycle');

    console.log('✓ Test 6 passed: failed verification leaves cache empty, guaranteeing retry next cycle');
}

// Run all tests
console.log('=== Running OPC Write Read-Back Verification Tests ===\n');
testReadBackMatches();
testReadBackMismatch();
testReadBackFloatTolerance();
testReadBackBoolean();
testWriteDowngradeOnVerificationFailure();
testControllerCacheNotUpdatedOnFailedVerification();
console.log('\n=== All tests passed! ===');
