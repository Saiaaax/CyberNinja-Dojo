/**
 * @fileoverview Unit tests for the telemetry batch flush logic.
 *
 * Covers the flush threshold (100 events), the page-unload flush trigger,
 * partial batch preservation below the threshold, and queue reset after
 * a flush completes. These tests do not require any external services -
 * `fetch` and `navigator.sendBeacon` are mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { telemetryService, TelemetryService, FLUSH_THRESHOLD } from './telemetry';

describe('telemetry batch flush logic', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let sendBeaconMock: ReturnType<typeof vi.fn>;
  let service: TelemetryService;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    sendBeaconMock = vi.fn().mockReturnValue(true);

    // Stub globals used by the telemetry service for network delivery.
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      sendBeacon: sendBeaconMock,
    });

    // Use a fresh instance so tests don't leak state via the shared singleton.
    service = new TelemetryService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('flushes automatically once the batch reaches the 100-event threshold', async () => {
    for (let i = 0; i < FLUSH_THRESHOLD; i++) {
      service.track('test_event', { index: i });
    }

    // Allow any microtask-based flush to settle.
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.getPendingEvents().length).toBe(0);
  });

  it('flushes the current batch when the page unload event fires', () => {
    for (let i = 0; i < 10; i++) {
      service.track('partial_event', { index: i });
    }

    expect(service.getPendingEvents().length).toBe(10);

    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(service.getPendingEvents().length).toBe(0);
  });

  it('preserves a partial batch below the flush threshold', async () => {
    const partialCount = FLUSH_THRESHOLD - 1;
    for (let i = 0; i < partialCount; i++) {
      service.track('below_threshold_event', { index: i });
    }

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.getPendingEvents().length).toBe(partialCount);
  });

  it('resets the queue after a flush completes', async () => {
    for (let i = 0; i < FLUSH_THRESHOLD; i++) {
      service.track('reset_event', { index: i });
    }

    await Promise.resolve();
    expect(service.getPendingEvents().length).toBe(0);

    // Tracking new events after a flush should start a fresh batch,
    // not continue accumulating from the pre-flush state.
    service.track('after_reset_event', {});
    expect(service.getPendingEvents().length).toBe(1);
  });
});
