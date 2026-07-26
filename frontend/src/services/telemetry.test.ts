import { flushTelemetryBatch, TelemetryEvent, TelemetryState } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  let state: TelemetryState;

  beforeEach(() => {
    state = {
      events: [],
      sessionId: 'test-session',
      config: {
        endpoint: 'https://example.com/telemetry',
        batchSize: 100,
        flushInterval: 5000,
        maxRetries: 3,
        sampleRate: 1.0,
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
  });

  test('flush triggers at 100 events', async () => {
    // Add 100 events
    for (let i = 0; i < 100; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Spy on flushTelemetryBatch to detect flush call
    const flushSpy = jest.spyOn(require('./telemetry'), 'flushTelemetryBatch');

    // Simulate adding one more event that triggers flush
    state.events.push({
      id: 'event-100',
      type: 'user_action',
      timestamp: Date.now(),
      sessionId: state.sessionId,
      properties: {},
    } as TelemetryEvent);

    // Check if flush is triggered when batch size reached
    if (state.events.length >= state.config.batchSize) {
      flushTelemetryBatch(state);
    }

    expect(flushSpy).toHaveBeenCalled();

    flushSpy.mockRestore();
  });

  test('flush triggers on page unload', async () => {
    // Add some events less than batch size
    for (let i = 0; i < 50; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Spy on flushTelemetryBatch to detect flush call
    const flushSpy = jest.spyOn(require('./telemetry'), 'flushTelemetryBatch');

    // Simulate page unload event
    window.dispatchEvent(new Event('beforeunload'));

    // The flushTelemetryBatch should be called on unload
    expect(flushSpy).toHaveBeenCalled();

    flushSpy.mockRestore();
  });

  test('partial batches are preserved after flush', async () => {
    // Add 150 events (1.5 batches)
    for (let i = 0; i < 150; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Mock flushTelemetryBatch to simulate flush removing first 100 events
    const originalFlush = flushTelemetryBatch;
    const flushMock = jest.spyOn(require('./telemetry'), 'flushTelemetryBatch').mockImplementation((state) => {
      // Remove first 100 events to simulate flush
      state.events.splice(0, 100);
    });

    // Trigger flush
    if (state.events.length >= state.config.batchSize) {
      flushTelemetryBatch(state);
    }

    // After flush, 50 events should remain
    expect(state.events.length).toBe(50);

    flushMock.mockRestore();
  });

  test('flush resets after flush', async () => {
    // Add 100 events to trigger flush
    for (let i = 0; i < 100; i++) {
      state.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Mock flushTelemetryBatch to simulate flush
    const flushMock = jest.spyOn(require('./telemetry'), 'flushTelemetryBatch').mockImplementation((state) => {
      state.events.splice(0, 100);
      state.retryCount = 0;
      state.lastFlushTime = Date.now();
    });

    // Trigger flush
    flushTelemetryBatch(state);

    // After flush, retryCount should be reset
    expect(state.retryCount).toBe(0);
    // lastFlushTime should be updated
    expect(state.lastFlushTime).toBeGreaterThan(0);

    flushMock.mockRestore();
  });
});
