/**
 * Telemetry Batch Flush Threshold Tests
 *
 * Tests for the batch flush threshold behavior in telemetry.ts:
 * 1. Flush triggers at 100 events (batch size threshold)
 * 2. Flush triggers on page unload via forceFlush()
 * 3. Partial batches are preserved on flush failure (retry behavior)
 * 4. Reset after flush (queue cleared, counters updated)
 *
 * These tests mock transport methods (Beacon, Fetch, XHR) and do not
 * require external services.
 */

import {
  initTelemetry,
  track,
  forceFlush,
  __resetTelemetryState,
  __getTelemetryState,
  type TelemetryEvent,
} from './telemetry';

// === Mock Setup ===

let beaconCalls: any[] = [];
let fetchCalls: any[] = [];
let xhrSent: any[] = [];

// Mock navigator.sendBeacon
const mockSendBeacon = (url: string, data: string): boolean => {
  beaconCalls.push({ url, data });
  return true;
};

// Mock fetch
const mockFetch = async (url: string, options: any): Promise<Response> => {
  fetchCalls.push({ url, options });
  return new Response('{}', { status: 200 });
};

// Mock XMLHttpRequest
class MockXHR {
  timeout = 0;
  readyState = 0;
  status = 0;
  responseText = '';
  onreadystatechange: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open(_method: string, _url: string) { this.readyState = 1; }
  setRequestHeader(_key: string, _val: string) {}
  send(data: any) {
    xhrSent.push(data);
    this.status = 200;
    this.readyState = 4;
    this.responseText = '{}';
    if (this.onreadystatechange) this.onreadystatechange();
  }
  abort() {}
}

function setupMocks(): void {
  // @ts-ignore
  globalThis.navigator = globalThis.navigator || {};
  // @ts-ignore
  globalThis.navigator.sendBeacon = mockSendBeacon;
  // @ts-ignore
  globalThis.fetch = mockFetch;
  // @ts-ignore
  globalThis.XMLHttpRequest = MockXHR;
  // @ts-ignore
  globalThis.window = globalThis.window || globalThis;
  // @ts-ignore
  globalThis.window.setInterval = (fn: () => void, _ms: number) => 0;
  // @ts-ignore
  globalThis.window.clearInterval = (_id: number) => {};
  // @ts-ignore
  globalThis.window.addEventListener = (_event: string, _fn: () => void) => {};
  beaconCalls = [];
  fetchCalls = [];
  xhrSent = [];
}

function makeEvent(type: string = 'test'): TelemetryEvent {
  return {
    type: type as any,
    timestamp: Date.now(),
    sessionId: 'test-session',
    url: '/test',
    data: {},
  } as TelemetryEvent;
}

// === Tests ===

let testsPassed = 0;
let testsTotal = 4;

async function test1_FlushAtBatchThreshold(): Promise<void> {
  setupMocks();
  __resetTelemetryState();
  initTelemetry({ endpoint: 'https://test.example/telemetry', batchSize: 100 });

  // Track 99 events - should not flush yet
  for (let i = 0; i < 99; i++) {
    track('test' as any, { index: i });
  }
  const stateBefore = __getTelemetryState();
  if (stateBefore.events.length !== 99) {
    throw new Error(`Test 1 FAILED: expected 99 queued events, got ${stateBefore.events.length}`);
  }
  if (stateBefore.totalFlushes !== 0) {
    throw new Error(`Test 1 FAILED: expected 0 flushes, got ${stateBefore.totalFlushes}`);
  }

  // Track 100th event - should trigger flush
  track('test' as any, { index: 99 });

  // Wait for async flush
  await new Promise(resolve => setTimeout(resolve, 100));

  const stateAfter = __getTelemetryState();
  if (stateAfter.totalFlushes !== 1) {
    throw new Error(`Test 1 FAILED: expected 1 flush after 100 events, got ${stateAfter.totalFlushes}`);
  }
  if (stateAfter.totalEventsSent !== 100) {
    throw new Error(`Test 1 FAILED: expected 100 events sent, got ${stateAfter.totalEventsSent}`);
  }

  console.log('  Test 1: Flush triggers at 100 events (batch size threshold) - PASSED');
  testsPassed++;
}

async function test2_FlushOnPageUnload(): Promise<void> {
  setupMocks();
  __resetTelemetryState();
  initTelemetry({ endpoint: 'https://test.example/telemetry', batchSize: 100 });

  // Track some events (less than batch threshold)
  for (let i = 0; i < 10; i++) {
    track('test' as any, { index: i });
  }

  const stateBefore = __getTelemetryState();
  if (stateBefore.totalFlushes !== 0) {
    throw new Error(`Test 2 FAILED: expected 0 flushes before forceFlush, got ${stateBefore.totalFlushes}`);
  }

  // Trigger forceFlush (simulates page unload)
  forceFlush();
  await new Promise(resolve => setTimeout(resolve, 100));

  const stateAfter = __getTelemetryState();
  if (stateAfter.totalFlushes !== 1) {
    throw new Error(`Test 2 FAILED: expected 1 flush after forceFlush, got ${stateAfter.totalFlushes}`);
  }
  if (stateAfter.totalEventsSent !== 10) {
    throw new Error(`Test 2 FAILED: expected 10 events sent, got ${stateAfter.totalEventsSent}`);
  }

  console.log('  Test 2: Flush triggers on page unload via forceFlush() - PASSED');
  testsPassed++;
}

async function test3_PartialBatchPreservedOnFailure(): Promise<void> {
  setupMocks();
  // Override sendBeacon to fail
  // @ts-ignore
  globalThis.navigator.sendBeacon = (): boolean => false;
  // @ts-ignore
  globalThis.fetch = async (): Promise<Response> => {
    throw new Error('Network error');
  };

  __resetTelemetryState();
  initTelemetry({ endpoint: 'https://test.example/telemetry', batchSize: 5 });

  // Track events to trigger flush (batchSize=5)
  for (let i = 0; i < 5; i++) {
    track('test' as any, { index: i });
  }

  // Wait for flush attempt and retry
  await new Promise(resolve => setTimeout(resolve, 200));

  const state = __getTelemetryState();
  // Events should be re-queued on failure (partial batch preservation)
  if (state.flushErrors === 0) {
    throw new Error('Test 3 FAILED: expected flush errors to be recorded');
  }
  // Events should be preserved (re-queued) after failure
  if (state.events.length === 0 && state.totalEventsSent === 0) {
    throw new Error('Test 3 FAILED: events were lost on flush failure (should be preserved for retry)');
  }

  console.log('  Test 3: Partial batches are preserved on flush failure - PASSED');
  testsPassed++;
}

async function test4_ResetAfterFlush(): Promise<void> {
  setupMocks();
  __resetTelemetryState();
  initTelemetry({ endpoint: 'https://test.example/telemetry', batchSize: 3 });

  // Track events to trigger flush
  for (let i = 0; i < 3; i++) {
    track('test' as any, { index: i });
  }
  await new Promise(resolve => setTimeout(resolve, 100));

  const stateAfterFlush = __getTelemetryState();
  if (stateAfterFlush.totalFlushes !== 1) {
    throw new Error(`Test 4 FAILED: expected 1 flush, got ${stateAfterFlush.totalFlushes}`);
  }
  // Queue should be cleared after successful flush
  if (stateAfterFlush.events.length !== 0) {
    throw new Error(`Test 4 FAILED: expected 0 events in queue after flush, got ${stateAfterFlush.events.length}`);
  }
  // Counters should be updated
  if (stateAfterFlush.totalEventsSent !== 3) {
    throw new Error(`Test 4 FAILED: expected 3 total events sent, got ${stateAfterFlush.totalEventsSent}`);
  }
  if (stateAfterFlush.lastFlushTime === 0) {
    throw new Error('Test 4 FAILED: lastFlushTime should be updated after flush');
  }

  // Track new events after flush
  track('test' as any, { new: true });
  const stateAfterNew = __getTelemetryState();
  if (stateAfterNew.events.length !== 1) {
    throw new Error(`Test 4 FAILED: expected 1 new event after flush, got ${stateAfterNew.events.length}`);
  }

  console.log('  Test 4: Reset after flush (queue cleared, counters updated) - PASSED');
  testsPassed++;
}

// === Run Tests ===

async function runTests(): Promise<number> {
  console.log('\n  Running 4 telemetry batch flush tests...\n');

  try {
    await test1_FlushAtBatchThreshold();
  } catch (e) {
    console.log(`  Test 1 FAILED: ${(e as Error).message}`);
  }

  try {
    await test2_FlushOnPageUnload();
  } catch (e) {
    console.log(`  Test 2 FAILED: ${(e as Error).message}`);
  }

  try {
    await test3_PartialBatchPreservedOnFailure();
  } catch (e) {
    console.log(`  Test 3 FAILED: ${(e as Error).message}`);
  }

  try {
    await test4_ResetAfterFlush();
  } catch (e) {
    console.log(`  Test 4 FAILED: ${(e as Error).message}`);
  }

  console.log(`\n  ${testsPassed}/${testsTotal} tests passed`);
  return testsPassed === testsTotal ? 0 : 1;
}

runTests().then(code => {
  process.exit(code);
});
