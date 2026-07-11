let beaconPayloads: string[] = [];

function installGlobals(): void {
  const sendBeacon = (_url: string, data?: BodyInit | null) => {
    beaconPayloads.push(String(data ?? ''));
    return true;
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'node-test',
      language: 'en-US',
      sendBeacon,
      hardwareConcurrency: 4,
    },
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { href: 'http://localhost/' },
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: () => undefined,
      setInterval: () => 1,
      clearInterval: () => undefined,
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      title: 'test',
      referrer: '',
      addEventListener: () => undefined,
      visibilityState: 'visible',
    },
  });

  Object.defineProperty(globalThis, 'screen', {
    configurable: true,
    value: { width: 1920, height: 1080 },
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });
}

function expectEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectGte(actual: number, expected: number, message: string): void {
  if (actual < expected) {
    throw new Error(`${message}: expected >= ${expected}, got ${actual}`);
  }
}

async function waitForFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function run(): Promise<void> {
  installGlobals();
  const telemetry = await import('./telemetry.ts');

  const {
    forceFlush,
    getTelemetryStats,
    resetTelemetryForTests,
    track,
  } = telemetry;

  async function testFlushAtBatchThreshold(): Promise<void> {
    beaconPayloads = [];
    resetTelemetryForTests({ batchSize: 100, sampleRate: 1 });

    for (let i = 0; i < 99; i += 1) {
      track('custom_event', { index: i });
    }
    expectEqual(getTelemetryStats().queued, 99, 'partial batch stays queued below threshold');

    track('custom_event', { index: 99 });
    await waitForFlush();

    const stats = getTelemetryStats();
    expectEqual(stats.queued, 0, 'queue clears after batch threshold flush');
    expectEqual(stats.sent, 100, 'sent count includes full flushed batch');
    expectGte(beaconPayloads.length, 1, 'beacon transport used for flush');
  }

  async function testPageUnloadForceFlush(): Promise<void> {
    beaconPayloads = [];
    resetTelemetryForTests({ batchSize: 100, sampleRate: 1 });

    for (let i = 0; i < 12; i += 1) {
      track('custom_event', { index: i });
    }
    expectEqual(getTelemetryStats().queued, 12, 'partial batch preserved before unload flush');

    forceFlush();
    await waitForFlush();

    const stats = getTelemetryStats();
    expectEqual(stats.queued, 0, 'unload flush drains partial batch');
    expectEqual(stats.sent, 12, 'partial batch counted as sent');
  }

  async function testPartialBatchPreservedUntilFlush(): Promise<void> {
    resetTelemetryForTests({ batchSize: 100, sampleRate: 1 });

    for (let i = 0; i < 37; i += 1) {
      track('custom_event', { index: i });
    }

    const before = getTelemetryStats();
    expectEqual(before.queued, 37, 'partial batch preserved without auto flush');
    expectEqual(before.sent, 0, 'nothing sent before threshold or manual flush');
  }

  async function testQueueResetsAfterSuccessfulFlush(): Promise<void> {
    resetTelemetryForTests({ batchSize: 100, sampleRate: 1 });

    for (let i = 0; i < 100; i += 1) {
      track('custom_event', { index: i });
    }
    await waitForFlush();
    expectEqual(getTelemetryStats().queued, 0, 'queue empty after flush');

    track('custom_event', { index: 'after-flush' });
    const stats = getTelemetryStats();
    expectEqual(stats.queued, 1, 'new events start a fresh batch after flush');
    expectEqual(stats.sent, 100, 'previous flush total preserved');
  }

  await testFlushAtBatchThreshold();
  await testPageUnloadForceFlush();
  await testPartialBatchPreservedUntilFlush();
  await testQueueResetsAfterSuccessfulFlush();
  console.log('telemetry batch flush tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
