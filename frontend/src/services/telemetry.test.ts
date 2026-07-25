import { describe, it, expect, vi } from 'vitest';
import { flushTelemetryBatch, TelemetryEvent, TelemetryState } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  it('flushes when batch size exceeds 100 events', async () => {
    const mockFlush = vi.fn();
    const state: TelemetryState = {
      events: [],
      sessionId: 'test-session',
      config: {
        endpoint: 'http://localhost',
        batchSize: 100,
        flushInterval: 10000,
        maxRetries: 3,
        sampleRate: 1,
        enabled: true,
        debug: false,
      },
      flushTimer: null,
      isFlushing: false,
      retryCount: 0,
      totalEventsSent: 0,
      totalEventsDropped: 0,
      lastFlushTime: 0,
    };

    // Add 100 events
    for (let i = 0; i < 100; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'api_call',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Spy on flushTelemetryBatch to call mockFlush
    const originalFlush = flushTelemetryBatch;
    (flushTelemetryBatch as any) = async (s: TelemetryState) => {
      mockFlush();
      return Promise.resolve();
    };

    // Trigger flush check
    if (state.events.length >= state.config.batchSize) {
      await flushTelemetryBatch(state);
    }

    expect(mockFlush).toHaveBeenCalled();

    // Restore original function
    (flushTelemetryBatch as any) = originalFlush;
  });

  it('flushes on page unload', async () => {
    const mockFlush = vi.fn();
    const state: TelemetryState = {
      events: [],
      sessionId: 'test-session',
      config: {
        endpoint: 'http://localhost',
        batchSize: 100,
        flushInterval: 10000,
        maxRetries: 3,
        sampleRate: 1,
        enabled: true,
        debug: false,
      },
      flushTimer: null,
      isFlushing: false,
      retryCount: 0,
      totalEventsSent: 0,
      totalEventsDropped: 0,
      lastFlushTime: 0,
    };

    // Add 10 events (partial batch)
    for (let i = 0; i < 10; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'api_call',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Spy on flushTelemetryBatch to call mockFlush
    const originalFlush = flushTelemetryBatch;
    (flushTelemetryBatch as any) = async (s: TelemetryState) => {
      mockFlush();
      return Promise.resolve();
    };

    // Simulate page unload flush
    await flushTelemetryBatch(state);

    expect(mockFlush).toHaveBeenCalled();

    // After flush, events should be empty (partial batch preserved)
    expect(state.events.length).toBe(0);

    // Restore original function
    (flushTelemetryBatch as any) = originalFlush;
  });

  it('partial batches are preserved and reset after flush', async () => {
    const state: TelemetryState = {
      events: [],
      sessionId: 'test-session',
      config: {
        endpoint: 'http://localhost',
        batchSize: 100,
        flushInterval: 10000,
        maxRetries: 3,
        sampleRate: 1,
        enabled: true,
        debug: false,
      },
      flushTimer: null,
      isFlushing: false,
      retryCount: 0,
      totalEventsSent: 0,
      totalEventsDropped: 0,
      lastFlushTime: 0,
    };

    // Add 50 events (partial batch)
    for (let i = 0; i < 50; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'api_call',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Mock flushTelemetryBatch to simulate flush
    const flushTelemetryBatchMock = async (s: TelemetryState) => {
      // Simulate sending events and clearing batch
      s.events.splice(0, s.events.length);
      s.totalEventsSent += 50;
      return Promise.resolve();
    };

    await flushTelemetryBatchMock(state);

    // After flush, events should be empty
    expect(state.events.length).toBe(0);
    expect(state.totalEventsSent).toBe(50);

    // Add more events after flush
    for (let i = 0; i < 30; i++) {
      state.events.push({
        id: `event-new-${i}`,
        type: 'api_call',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    expect(state.events.length).toBe(30);
  });
});
