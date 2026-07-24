// Tests for telemetry batch flush threshold logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService } from './telemetry';

describe('TelemetryService batch flush threshold', () => {
  let telemetry: TelemetryService;
  let flushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    telemetry = new TelemetryService({
      batchSize: 100,
      flushInterval: 10000,
      maxRetries: 3,
      enabled: true,
      debug: false,
      endpoint: 'https://example.com/telemetry',
      sampleRate: 1.0,
    });
    flushSpy = vi.spyOn(telemetry, 'flush').mockImplementation(async () => Promise.resolve());
  });

  afterEach(() => {
    flushSpy.mockRestore();
  });

  it('flushes when batch size reaches threshold', async () => {
    for (let i = 0; i < 100; i++) {
      telemetry.addEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }
    // flush should be called once after reaching batch size
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes on page unload', async () => {
    // Simulate adding some events less than batch size
    for (let i = 0; i < 50; i++) {
      telemetry.addEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }
    // flush should not be called yet
    expect(flushSpy).toHaveBeenCalledTimes(0);

    // Simulate page unload event
    window.dispatchEvent(new Event('beforeunload'));

    // flush should be called once on unload
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves partial batch after flush', async () => {
    // Add 150 events, which should trigger flush twice (at 100 and 150)
    for (let i = 0; i < 150; i++) {
      telemetry.addEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }
    // flush should be called twice
    expect(flushSpy).toHaveBeenCalledTimes(2);

    // The internal batch should have 50 events left after flushes
    expect(telemetry.events.length).toBe(50);
  });

  it('resets batch after flush', async () => {
    for (let i = 0; i < 100; i++) {
      telemetry.addEvent({ id: `event-${i}`, type: 'user_action', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }
    expect(flushSpy).toHaveBeenCalledTimes(1);

    // After flush, batch should be empty
    expect(telemetry.events.length).toBe(0);
  });
});
