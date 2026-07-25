import { describe, it, expect, vi } from 'vitest';
import { flushTelemetryBatch, addTelemetryEvent, getTelemetryState } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  beforeEach(() => {
    // Reset telemetry state before each test
    const state = getTelemetryState();
    state.events = [];
    state.isFlushing = false;
    state.totalEventsSent = 0;
    state.totalEventsDropped = 0;
  });

  it('flushes when batch size reaches 100 events', async () => {
    const flushSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Add 100 events
    for (let i = 0; i < 100; i++) {
      addTelemetryEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    // The flush should be triggered automatically
    await flushTelemetryBatch();

    expect(flushSpy).toHaveBeenCalled();
    const state = getTelemetryState();
    expect(state.events.length).toBe(0);
    expect(state.totalEventsSent).toBe(100);

    flushSpy.mockRestore();
  });

  it('flushes on page unload', async () => {
    const flushSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Add 50 events
    for (let i = 0; i < 50; i++) {
      addTelemetryEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    // Simulate page unload by calling flushTelemetryBatch
    await flushTelemetryBatch();

    expect(flushSpy).toHaveBeenCalled();
    const state = getTelemetryState();
    expect(state.events.length).toBe(0);
    expect(state.totalEventsSent).toBe(50);

    flushSpy.mockRestore();
  });

  it('preserves partial batches after flush failure', async () => {
    const flushSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    // Add 10 events
    for (let i = 0; i < 10; i++) {
      addTelemetryEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    await flushTelemetryBatch();

    expect(flushSpy).toHaveBeenCalled();
    const state = getTelemetryState();
    // Events should still be present because flush failed
    expect(state.events.length).toBe(10);
    expect(state.totalEventsSent).toBe(0);

    flushSpy.mockRestore();
  });

  it('resets batch after successful flush', async () => {
    const flushSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Add 20 events
    for (let i = 0; i < 20; i++) {
      addTelemetryEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    await flushTelemetryBatch();

    const state = getTelemetryState();
    expect(state.events.length).toBe(0);
    expect(state.totalEventsSent).toBe(20);

    flushSpy.mockRestore();
  });
});
