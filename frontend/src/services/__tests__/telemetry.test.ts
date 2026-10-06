import test, { describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('Telemetry Service', () => {
  let telemetry: any;
  let beaconCalls: any[] = [];
  let fetchCalls: any[] = [];
  let originalWindow: any;
  let originalNavigator: any;

  beforeEach(async () => {
    beaconCalls = [];
    fetchCalls = [];
    
    originalWindow = globalThis.window;
    originalNavigator = globalThis.navigator;
    
    let beforeUnloadHandler: any = null;

    globalThis.window = {
      location: { href: 'http://localhost/', origin: 'http://localhost' },
      innerWidth: 1024,
      innerHeight: 768,
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: (evt: string, cb: any) => {
        if (evt === 'beforeunload') beforeUnloadHandler = cb;
      },
      removeEventListener: () => {},
      // Expose the handler for testing
      __triggerBeforeUnload: () => {
        if (beforeUnloadHandler) beforeUnloadHandler();
      }
    } as any;

    globalThis.navigator = {
      userAgent: 'test-agent',
      language: 'en-US',
      hardwareConcurrency: 4,
      sendBeacon: mock.fn((url: string, data: string) => {
        beaconCalls.push({ url, data });
        return true;
      })
    } as any;

    globalThis.screen = { width: 1920, height: 1080 } as any;
    globalThis.document = { 
      referrer: '',
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any;
    globalThis.fetch = mock.fn() as any;
    // mock performance APIs
    globalThis.PerformanceObserver = class {
      observe() {}
      disconnect() {}
    } as any;

    // Set process.env for tsx to potentially pick it up if it maps import.meta.env
    process.env.VITE_TELEMETRY_ENDPOINT = 'http://test-endpoint';

    telemetry = await import(`../telemetry.ts?t=${Date.now()}`);
    // initTelemetry adds a page_view event, so we must clear it right after
    telemetry.initTelemetry({ endpoint: 'http://test-endpoint', enabled: true, sampleRate: 1.0 });
    telemetry.setTelemetryEnabled(false); // Clears the page_view event
    telemetry.setTelemetryEnabled(true);  // Re-enables without triggering page_view
    telemetry.setSampleRate(1.0);
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.navigator = originalNavigator;
  });

  test('batch flushes when hitting exactly 100 events', async () => {
    // Generate 99 events
    for (let i = 0; i < 99; i++) {
      telemetry.track('custom_event', { index: i });
    }
    assert.equal(beaconCalls.length, 0, 'Should not flush on 99 events');
    
    // 100th event
    telemetry.track('custom_event', { index: 99 });
    
    await new Promise(r => setTimeout(r, 10));
    
    assert.equal(beaconCalls.length, 1, 'Should flush exactly on 100 events');
    const parsed = JSON.parse(beaconCalls[0].data);
    assert.equal(parsed.events.length, 100, 'Batch should contain 100 events');
  });

  test('batch flushes on page unload (beforeunload event)', async () => {
    telemetry.track('custom_event', { data: 'test-unload' });
    assert.equal(beaconCalls.length, 0);
    
    globalThis.window.__triggerBeforeUnload();
    await new Promise(r => setTimeout(r, 10));
    
    assert.equal(beaconCalls.length, 1);
    const parsed = JSON.parse(beaconCalls[0].data);
    assert.equal(parsed.events.length, 1);
    assert.equal(parsed.events[0].properties.data, 'test-unload');
  });

  test('partial batch is preserved if flush fails', async () => {
    globalThis.navigator.sendBeacon = mock.fn(() => false);
    
    telemetry.track('custom_event', { id: 1 });
    telemetry.forceFlush();
    
    await new Promise(r => setTimeout(r, 10));
    
    assert.equal(globalThis.navigator.sendBeacon.mock.calls.length, 1);
    
    const stats = telemetry.getTelemetryStats();
    assert.equal(stats.queued, 1, 'Event should be preserved in queue after failure');
    assert.equal(stats.errors, 1, 'Error count should increment');
  });

  test('batch count resets to 0 after successful flush', async () => {
    telemetry.track('custom_event', { id: 1 });
    const statsBefore = telemetry.getTelemetryStats();
    assert.equal(statsBefore.queued, 1);
    
    telemetry.forceFlush();
    await new Promise(r => setTimeout(r, 10));
    
    const statsAfter = telemetry.getTelemetryStats();
    assert.equal(statsAfter.queued, 0, 'Queue should be empty after successful flush');
    assert.equal(statsAfter.sent, 1, 'Sent count should be incremented');
  });
});
