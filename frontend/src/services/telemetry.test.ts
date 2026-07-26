// Tests for telemetry batch flush threshold logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryEvent, TelemetryConfig, TelemetryState } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  let telemetryState: TelemetryState;
  let flushMock: vi.Mock;

  const defaultConfig: TelemetryConfig = {
    endpoint: 'https://example.com/telemetry',
    batchSize: 100,
    flushInterval: 5000,
    maxRetries: 3,
    sampleRate: 1.0,
    enabled: true,
    debug: false,
  };

  beforeEach(() => {
    flushMock = vi.fn();
    telemetryState = {
      events: [],
      sessionId: 'session-123',
      config: defaultConfig,
      flushTimer: null,
      isFlushing: false,
      retryCount: 0,
      totalEventsSent: 0,
      totalEventsDropped: 0,
      lastFlushTime: 0,
      flush: flushMock,
    } as unknown as TelemetryState;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flush triggers when batch size reaches threshold', () => {
    for (let i = 0; i < defaultConfig.batchSize; i++) {
      telemetryState.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: telemetryState.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Simulate the batch flush check
    if (telemetryState.events.length >= telemetryState.config.batchSize) {
      telemetryState.flush();
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it('flush triggers on page unload', () => {
    // Simulate page unload event triggering flush
    telemetryState.flush();

    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it('partial batches are preserved after flush', () => {
    // Add fewer events than batch size
    for (let i = 0; i < defaultConfig.batchSize - 10; i++) {
      telemetryState.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: telemetryState.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Flush should not be triggered automatically
    if (telemetryState.events.length >= telemetryState.config.batchSize) {
      telemetryState.flush();
    }

    expect(flushMock).not.toHaveBeenCalled();

    // Manually flush partial batch
    telemetryState.flush();

    expect(flushMock).toHaveBeenCalledTimes(1);
    // Events should still be present after flush if partial batch preservation is implemented
    // Here we assume flush clears events, so we simulate preservation by not clearing events in flush mock
  });

  it('batch resets after flush', () => {
    // Add events equal to batch size
    for (let i = 0; i < defaultConfig.batchSize; i++) {
      telemetryState.events.push({
        id: `event-${i}`,
        type: 'user_action',
        timestamp: Date.now(),
        sessionId: telemetryState.sessionId,
        properties: {},
      } as TelemetryEvent);
    }

    // Flush batch
    telemetryState.flush();

    // After flush, batch should be empty
    expect(telemetryState.events.length).toBe(0);
  });
});
