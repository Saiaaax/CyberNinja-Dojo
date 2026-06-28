import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import url from 'node:url';

const root = path.resolve(url.fileURLToPath(new URL('..', import.meta.url)));
const sourceDir = path.join(root, 'src', 'services');

function installBrowserGlobals() {
  const listeners = new Map();

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      userAgent: 'node-test',
      language: 'en-US',
      hardwareConcurrency: 8,
    },
  });
  Object.defineProperty(globalThis, 'screen', {
    configurable: true,
    writable: true,
    value: { width: 1280, height: 720 },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      title: 'Telemetry test',
      referrer: '',
      visibilityState: 'visible',
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      innerWidth: 1280,
      innerHeight: 720,
      location: { href: 'https://example.test/app', origin: 'https://example.test' },
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      setInterval() {
        return 1;
      },
      clearInterval() {},
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem() {
        return null;
      },
    },
  });
  globalThis.Intl = Intl;

  return {
    dispatch(type) {
      listeners.get(type)?.();
    },
  };
}

async function loadTelemetryModule(sendImpl = () => true) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tot-telemetry-'));
  const telemetrySource = await readFile(path.join(sourceDir, 'telemetry.ts'), 'utf8');

  const uuidModule = `
    let counter = 0;
    export function v4() {
      counter += 1;
      return 'uuid-' + counter;
    }
  `;

  await writeFile(path.join(tempDir, 'uuid.mjs'), uuidModule);
  await writeFile(
    path.join(tempDir, 'telemetry.mts'),
    telemetrySource.replace("from 'uuid'", "from './uuid.mjs'"),
  );

  const browser = installBrowserGlobals();
  const beacons = [];
  globalThis.navigator.sendBeacon = (endpoint, payload) => {
    beacons.push({ endpoint, payload: JSON.parse(payload) });
    return sendImpl(endpoint, payload);
  };

  const telemetry = await import(`${url.pathToFileURL(path.join(tempDir, 'telemetry.mts')).href}?t=${Date.now()}`);

  return {
    browser,
    beacons,
    telemetry,
    async cleanup() {
      delete globalThis.navigator;
      delete globalThis.screen;
      delete globalThis.document;
      delete globalThis.window;
      delete globalThis.sessionStorage;
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

test('flushes when the batch reaches the configured threshold', async () => {
  const { beacons, telemetry, cleanup } = await loadTelemetryModule();

  try {
    telemetry.__resetTelemetryForTests({ batchSize: 100 });
    for (let i = 0; i < 99; i += 1) {
      telemetry.track('custom_event', { index: i });
    }

    assert.equal(beacons.length, 0);
    assert.equal(telemetry.__getTelemetryStateForTests().queued, 99);

    telemetry.track('custom_event', { index: 99 });
    await telemetry.__flushTelemetryForTests();

    assert.equal(beacons.length, 1);
    assert.equal(beacons[0].payload.events.length, 100);
    assert.equal(telemetry.__getTelemetryStateForTests().queued, 0);
  } finally {
    await cleanup();
  }
});

test('page unload flushes the queued batch', async () => {
  const { browser, beacons, telemetry, cleanup } = await loadTelemetryModule();

  try {
    telemetry.__resetTelemetryForTests({ batchSize: 100 });
    telemetry.initTelemetry({ enabled: true, endpoint: '/telemetry', batchSize: 100 });
    telemetry.track('custom_event', { queued: true });

    assert.equal(telemetry.__getTelemetryStateForTests().queued, 3);
    browser.dispatch('beforeunload');
    await telemetry.__flushTelemetryForTests();

    assert.equal(beacons.length, 1);
    assert.equal(beacons[0].payload.events.length, 3);
    assert.equal(telemetry.__getTelemetryStateForTests().queued, 0);
  } finally {
    await cleanup();
  }
});

test('partial batches are preserved after a threshold flush', async () => {
  const { beacons, telemetry, cleanup } = await loadTelemetryModule();

  try {
    telemetry.__resetTelemetryForTests({ batchSize: 100 });
    for (let i = 0; i < 150; i += 1) {
      telemetry.track('custom_event', { index: i });
    }
    await telemetry.__flushTelemetryForTests();

    assert.equal(beacons.length, 1);
    assert.equal(beacons[0].payload.events.length, 100);
    assert.equal(telemetry.__getTelemetryStateForTests().queued, 50);
  } finally {
    await cleanup();
  }
});

test('successful flush resets queued events and retry state', async () => {
  const { telemetry, cleanup } = await loadTelemetryModule();

  try {
    telemetry.__resetTelemetryForTests({ batchSize: 2 });
    telemetry.track('custom_event', { first: true });
    telemetry.track('custom_event', { second: true });
    await telemetry.__flushTelemetryForTests();

    const state = telemetry.__getTelemetryStateForTests();
    assert.equal(state.queued, 0);
    assert.equal(state.sent, 2);
    assert.equal(state.errors, 0);
    assert.equal(state.isFlushing, false);
  } finally {
    await cleanup();
  }
});
