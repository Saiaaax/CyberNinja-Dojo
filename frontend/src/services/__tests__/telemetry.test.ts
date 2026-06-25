/**
 * Tests for telemetry batch flush threshold behavior.
 *
 * Tests cover:
 * - Flush triggers at batch size (100 events)
 * - Flush triggers on page unload (beforeunload)
 * - Partial batches are preserved
 * - Events reset after flush
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock uuid before importing the module
vi.mock('uuid', () => ({
  v4: () => '00000000-0000-0000-0000-000000000000',
}));

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_TELEMETRY_ENDPOINT: 'https://telemetry.test/api/events',
      VITE_TELEMETRY_ENABLED: 'true',
      VITE_TELEMETRY_DEBUG: 'false',
    },
  },
});

// Mock window and navigator
const mockSendBeacon = vi.fn(() => true);

beforeEach(() => {
  vi.useFakeTimers();

  // Reset mocks
  mockSendBeacon.mockClear();

  // Set up window globals
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      sendBeacon: mockSendBeacon,
      userAgent: 'test-agent',
      language: 'en-US',
      hardwareConcurrency: 4,
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'screen', {
    value: { width: 1920, height: 1080 },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      referrer: '',
      title: 'Test Page',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    },
    writable: true,
    configurable: true,
  });

  // Mock location
  delete (globalThis as any).location;
  Object.defineProperty(globalThis, 'location', {
    value: {
      href: 'https://example.com/test',
      origin: 'https://example.com',
      search: '',
      protocol: 'https:',
      host: 'example.com',
      pathname: '/test',
    },
    writable: true,
    configurable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  // Mock Intl
  Object.defineProperty(globalThis, 'Intl', {
    value: {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'UTC' }),
      }),
    },
    writable: true,
    configurable: true,
  });

  // Mock PerformanceObserver
  Object.defineProperty(globalThis, 'PerformanceObserver', {
    value: class {
      constructor() {}
      observe() {}
    },
    writable: true,
    configurable: true,
  });

  // Mock fetch for fallback
  Object.defineProperty(globalThis, 'fetch', {
    value: vi.fn().mockRejectedValue(new Error('not used')),
    writable: true,
    configurable: true,
  });

  // Mock setInterval/clearInterval
  globalThis.setInterval = vi.fn(() => 123 as any);
  globalThis.clearInterval = vi.fn();
  globalThis.setTimeout = vi.fn((fn) => {
    fn();
    return 456 as any;
  });
  globalThis.clearTimeout = vi.fn();

  // Mock console
  globalThis.console = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
});

afterEach(() => {
  vi.useRealTimers();
});

// Import after mocks are set up
// We'll test the logic by reimporting fresh each time
async function getTelemetryModule() {
  // Dynamic import with cache busting
  return await import('../telemetry.ts');
}

describe('Telemetry Batch Flush Threshold', () => {
  it('flushes when batch size reaches 100 events', async () => {
    const telemetry = await getTelemetryModule();
    expect(telemetry).toBeDefined();

    // Track 99 events - no flush yet
    for (let i = 0; i < 99; i++) {
      telemetry.track('test_event', { index: i });
    }

    // 100th event should trigger flush
    telemetry.track('test_event', { index: 99 });

    // sendBeacon should have been called once
    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
  });

  it('flushes on page unload via forceFlush', async () => {
    const telemetry = await getTelemetryModule();

    // Track 10 events (partial batch)
    for (let i = 0; i < 10; i++) {
      telemetry.track('test_event', { index: i });
    }

    // Simulate page unload
    telemetry.forceFlush();

    // sendBeacon should have been called
    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
  });

  it('partial batches are preserved when not reaching threshold', async () => {
    const telemetry = await getTelemetryModule();

    // Track 50 events (below threshold)
    for (let i = 0; i < 50; i++) {
      telemetry.track('test_event', { index: i });
    }

    // No flush should have occurred
    expect(mockSendBeacon).not.toHaveBeenCalled();
  });

  it('events reset after successful flush', async () => {
    const telemetry = await getTelemetryModule();

    // Fill to threshold
    for (let i = 0; i < 100; i++) {
      telemetry.track('test_event', { index: i });
    }

    // Reset the beacon mock so we can detect the next call separately
    mockSendBeacon.mockClear();

    // Track more events - the queue should have been emptied by the flush
    telemetry.track('test_event', { index: 100 });
    telemetry.track('test_event', { index: 101 });

    // These 2 events alone should NOT trigger another flush (below 100)
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Now fill up again to verify the queue is clean
    for (let i = 3; i <= 100; i++) {
      telemetry.track('test_event', { index: i });
    }

    // 100th event after reset should flush
    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
  });
});
