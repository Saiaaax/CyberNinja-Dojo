import { flushBatchIfNeeded, TelemetryEvent, TelemetryState } from './telemetry';

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

  test('flush triggers at 100 events', () => {
    // Add 99 events, should not flush
    for (let i = 0; i < 99; i++) {
      state.events.push({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    }
    let flushed = flushBatchIfNeeded(state);
    expect(flushed).toBe(false);
    expect(state.events.length).toBe(99);

    // Add 1 more event, should flush
    state.events.push({ id: 'event-100', type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    flushed = flushBatchIfNeeded(state);
    expect(flushed).toBe(true);
    expect(state.events.length).toBe(0);
  });

  test('flush triggers on page unload', () => {
    // Simulate partial batch
    for (let i = 0; i < 50; i++) {
      state.events.push({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    }
    // Simulate page unload flush
    const flushed = flushBatchIfNeeded(state, true);
    expect(flushed).toBe(true);
    expect(state.events.length).toBe(0);
  });

  test('partial batches are preserved if not flushed', () => {
    for (let i = 0; i < 50; i++) {
      state.events.push({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    }
    const flushed = flushBatchIfNeeded(state);
    expect(flushed).toBe(false);
    expect(state.events.length).toBe(50);
  });

  test('reset after flush', () => {
    for (let i = 0; i < 100; i++) {
      state.events.push({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    }
    let flushed = flushBatchIfNeeded(state);
    expect(flushed).toBe(true);
    expect(state.events.length).toBe(0);

    // Add more events after flush
    for (let i = 0; i < 10; i++) {
      state.events.push({ id: `event-new-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: state.sessionId, properties: {} });
    }
    flushed = flushBatchIfNeeded(state);
    expect(flushed).toBe(false);
    expect(state.events.length).toBe(10);
  });
});
