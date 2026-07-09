import assert from 'node:assert/strict';

type Listener = () => void;
type TelemetryModule = typeof import('./telemetry.ts');

let importCounter = 0;

function installBrowserStubs(): { listeners: Map<string, Listener[]>; beaconPayloads: string[] } {
  const listeners = new Map<string, Listener[]>();
  const beaconPayloads: string[] = [];

  Object.defineProperty(globalThis, 'screen', {
    value: { width: 1440, height: 900 },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: () => null,
      setItem: () => undefined,
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'telemetry-test',
      language: 'en-US',
      hardwareConcurrency: 8,
      sendBeacon: (_url: string, payload: string) => {
        beaconPayloads.push(payload);
        return true;
      },
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      title: 'Telemetry Test',
      referrer: '',
      visibilityState: 'visible',
      addEventListener: (event: string, listener: Listener) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'window', {
    value: {
      innerWidth: 1280,
      innerHeight: 720,
      location: {
        href: 'https://example.test/app?token=secret',
        origin: 'https://example.test',
      },
      addEventListener: (event: string, listener: Listener) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
      setInterval: () => 1,
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'clearInterval', {
    value: () => undefined,
    configurable: true,
  });

  return { listeners, beaconPayloads };
}

async function loadTelemetry(): Promise<TelemetryModule> {
  importCounter += 1;
  return import(`./telemetry.ts?testCase=${importCounter}`);
}

function initForBatchTests(telemetry: TelemetryModule): void {
  telemetry.initTelemetry({
    enabled: true,
    endpoint: 'https://telemetry.example.test/events',
    batchSize: 100,
    flushInterval: 30_000,
    sampleRate: 1,
  });
}

function payloadEventCount(payload: string): number {
  return JSON.parse(payload).events.length;
}

async function testFlushesWhenQueueReachesBatchSize(): Promise<void> {
  const { beaconPayloads } = installBrowserStubs();
  const telemetry = await loadTelemetry();
  initForBatchTests(telemetry);

  for (let index = 0; index < 98; index += 1) {
    telemetry.track('custom_event', { index });
  }

  assert.equal(beaconPayloads.length, 1, 'queue flushes as soon as it reaches 100 events');
  assert.equal(payloadEventCount(beaconPayloads[0]), 100, 'flush payload contains exactly one full batch');
  assert.equal(telemetry.getTelemetryStats().queued, 0, 'queue is empty after threshold flush');
}

async function testFlushesPartialBatchOnPageUnload(): Promise<void> {
  const { listeners, beaconPayloads } = installBrowserStubs();
  const telemetry = await loadTelemetry();
  initForBatchTests(telemetry);

  const unloadListeners = listeners.get('beforeunload') ?? [];
  assert.equal(unloadListeners.length, 1, 'beforeunload listener is registered');
  unloadListeners[0]();

  assert.equal(beaconPayloads.length, 1, 'page unload flushes queued events');
  assert.equal(payloadEventCount(beaconPayloads[0]), 2, 'partial session_start/page_view batch is sent on unload');
  assert.equal(telemetry.getTelemetryStats().queued, 0, 'partial queue is cleared after unload flush');
}

async function testPartialBatchStaysQueuedBeforeThreshold(): Promise<void> {
  const { beaconPayloads } = installBrowserStubs();
  const telemetry = await loadTelemetry();
  initForBatchTests(telemetry);

  for (let index = 0; index < 97; index += 1) {
    telemetry.track('custom_event', { index });
  }

  assert.equal(beaconPayloads.length, 0, 'partial batches do not flush before threshold or unload');
  assert.equal(telemetry.getTelemetryStats().queued, 99, 'partial batch remains queued');
}

async function testBatchResetsAfterFlush(): Promise<void> {
  const { beaconPayloads } = installBrowserStubs();
  const telemetry = await loadTelemetry();
  initForBatchTests(telemetry);

  for (let index = 0; index < 98; index += 1) {
    telemetry.track('custom_event', { index });
  }
  telemetry.track('custom_event', { afterFlush: true });

  assert.equal(beaconPayloads.length, 1, 'only the full batch was flushed');
  assert.equal(telemetry.getTelemetryStats().queued, 1, 'new events start a fresh batch after flush');
}

await testFlushesWhenQueueReachesBatchSize();
await testFlushesPartialBatchOnPageUnload();
await testPartialBatchStaysQueuedBeforeThreshold();
await testBatchResetsAfterFlush();
