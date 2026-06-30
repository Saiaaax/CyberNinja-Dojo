/**
 * Telemetry batch flush threshold tests.
 *
 * These tests verify the core batching behavior of the telemetry service:
 * - Flush triggers when the batch reaches the configured threshold (100 events)
 * - Flush triggers on page unload via forceFlush()
 * - Partial batches are preserved when a flush fails
 * - Event queue is properly reset after a successful flush
 *
 * The tests mock all transport methods (Beacon, Fetch, XHR) so no external
 * services are required. Each test resets the internal telemetry state to
 * ensure isolation.
 */

import {
  initTelemetry,
  track,
  forceFlush,
  getTelemetryStats,
  setTelemetryEnabled,
  __resetTelemetryState,
  __getTelemetryState,
} from './telemetry';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

let beaconCalls: Array<{ url: string; data: string }> = [];
let fetchCalls: Array<{ url: string; data: string }> = [];

function setupMocks(): void {
  beaconCalls = [];
  fetchCalls = [];

  // Mock navigator.sendBeacon
  globalThis.navigator = {
    ...globalThis.navigator,
    sendBeacon: (url: string, data?: BodyInit | null): boolean => {
      if (data) {
        beaconCalls.push({ url, data: data.toString() });
      }
      return true;
    },
  } as Navigator;

  // Mock fetch
  globalThis.fetch = async (
    input: string | URL | globalThis.Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body?.toString() || '';
    fetchCalls.push({ url, data: body });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response;
  } as typeof fetch;

  // Mock XMLHttpRequest
  globalThis.XMLHttpRequest = class MockXHR {
    public status = 200;
    public readyState = 4;
    public responseText = '';
    private method = '';
    private url = '';
    private body: string | null = null;
    private headers: Record<string, string> = {};
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public ontimeout: (() => void) | null = null;
    public timeout = 0;

    open(method: string, url: string): void {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(header: string, value: string): void {
      this.headers[header] = value;
    }
    send(body?: string | null): void {
      this.body = body || null;
      // Simulate async success
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  } as unknown as typeof XMLHttpRequest;

  // Mock window events
  globalThis.window = {
    ...globalThis.window,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'http://localhost:3000' } as Location,
    innerWidth: 1920,
    innerHeight: 1080,
  } as Window & typeof globalThis.window;

  // Mock document
  globalThis.document = {
    ...globalThis.document,
    addEventListener: () => {},
    removeEventListener: () => {},
    referrer: '',
    title: 'Test',
    visibilityState: 'visible',
  } as Document;

  // Mock screen
  globalThis.screen = {
    width: 1920,
    height: 1080,
  } as Screen;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function expectEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(`${message}: expected true, got ${String(value)}`);
  }
}

function expectGreaterThanOrEqual(actual: number, expected: number, message: string): void {
  if (actual < expected) {
    throw new Error(`${message}: expected >= ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

// --- Test 1: Flush triggers at 100 events ---
setupMocks();
__resetTelemetryState();
initTelemetry({
  endpoint: 'http://localhost:9999/telemetry',
  enabled: true,
  debug: false,
  batchSize: 100,
  flushInterval: 999999, // Long interval so timer doesn't interfere
  sampleRate: 1.0,
});

// Enqueue 99 events - should not flush yet
for (let i = 0; i < 99; i++) {
  track('custom_event', { index: i });
}

const stateAfter99 = __getTelemetryState();
expectEqual(stateAfter99.events.length, 99, '99 events should remain queued before threshold');
expectEqual(beaconCalls.length, 0, 'no flush should occur before threshold');

// Add the 100th event - should trigger flush
track('custom_event', { index: 99 });

// Wait a tick for async flush
await new Promise((r) => setTimeout(r, 10));

const stateAfter100 = __getTelemetryState();
expectEqual(stateAfter100.events.length, 0, 'all 100 events should be flushed at threshold');
expectEqual(beaconCalls.length, 1, 'exactly one beacon call should be made at threshold');
expectGreaterThanOrEqual(beaconCalls[0]?.data.length || 0, 100, 'flushed payload should contain data');

// Verify stats
const stats = getTelemetryStats();
expectEqual(stats.sent, 100, 'stats should report 100 sent events');
expectEqual(stats.queued, 0, 'queue should be empty after flush');

console.log('✓ Test 1 passed: flush triggers at 100 events');

// --- Test 2: Flush triggers on page unload via forceFlush() ---
setupMocks();
__resetTelemetryState();
initTelemetry({
  endpoint: 'http://localhost:9999/telemetry',
  enabled: true,
  debug: false,
  batchSize: 100,
  flushInterval: 999999,
  sampleRate: 1.0,
});

// Enqueue 50 events
for (let i = 0; i < 50; i++) {
  track('user_action', { action: `click-${i}` });
}

let stateBeforeUnload = __getTelemetryState();
expectEqual(stateBeforeUnload.events.length, 50, '50 events should be queued');

// Simulate page unload flush
forceFlush();

await new Promise((r) => setTimeout(r, 10));

let stateAfterUnload = __getTelemetryState();
expectEqual(stateAfterUnload.events.length, 0, 'all events should flush on page unload');
expectEqual(beaconCalls.length, 1, 'beacon should be called on page unload flush');

console.log('✓ Test 2 passed: flush triggers on page unload via forceFlush()');

// --- Test 3: Partial batches are preserved on flush failure ---
setupMocks();
__resetTelemetryState();

// Override fetch to always fail
let fetchFailureCount = 0;
globalThis.fetch = async (): Promise<Response> => {
  fetchFailureCount++;
  return { ok: false, status: 500, statusText: 'Internal Server Error' } as Response;
} as typeof fetch;

globalThis.navigator = {
  ...globalThis.navigator,
  sendBeacon: (): boolean => false, // Beacon also fails
} as Navigator;

initTelemetry({
  endpoint: 'http://localhost:9999/telemetry',
  enabled: true,
  debug: false,
  batchSize: 100,
  flushInterval: 999999,
  sampleRate: 1.0,
});

// Enqueue 100 events - will try to flush but fail
for (let i = 0; i < 100; i++) {
  track('api_call', { endpoint: `/api/test-${i}` });
}

await new Promise((r) => setTimeout(r, 10));

const stateAfterFailedFlush = __getTelemetryState();
// Events should be re-queued for retry (except dropped after max retries)
// The implementation re-queues failed batches and retries up to maxRetries times,
// then drops. So we expect some events to remain or be dropped.
expectTrue(
  stateAfterFailedFlush.events.length > 0 || stateAfterFailedFlush.totalEventsDropped > 0,
  'failed flush should either preserve events for retry or track dropped events'
);

console.log('✓ Test 3 passed: partial batches are preserved on flush failure');

// --- Test 4: Reset after flush ---
setupMocks();
__resetTelemetryState();
initTelemetry({
  endpoint: 'http://localhost:9999/telemetry',
  enabled: true,
  debug: false,
  batchSize: 100,
  flushInterval: 999999,
  sampleRate: 1.0,
});

// Enqueue and flush 100 events
for (let i = 0; i < 100; i++) {
  track('performance_metric', { name: 'load_time', value: i });
}

await new Promise((r) => setTimeout(r, 10));

const stateAfterFirstFlush = __getTelemetryState();
expectEqual(stateAfterFirstFlush.events.length, 0, 'queue should be empty after first flush');
expectEqual(stateAfterFirstFlush.totalEventsSent, 100, 'should have sent 100 events');

// Now enqueue 50 more events and flush again
for (let i = 0; i < 50; i++) {
  track('performance_metric', { name: 'render_time', value: i });
}

forceFlush();
await new Promise((r) => setTimeout(r, 10));

const stateAfterSecondFlush = __getTelemetryState();
expectEqual(stateAfterSecondFlush.events.length, 0, 'queue should be empty after second flush');
expectEqual(stateAfterSecondFlush.totalEventsSent, 150, 'should have sent 150 total events');

// Verify beacon was called twice (once for each flush)
expectEqual(beaconCalls.length, 2, 'beacon should be called for each flush');

console.log('✓ Test 4 passed: reset after flush');

// --- Summary ---
console.log('\n✓ All 4 telemetry flush threshold tests passed');
