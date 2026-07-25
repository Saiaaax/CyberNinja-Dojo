import { flushBatch, addEvent, getBatchSize, resetBatch } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  beforeEach(() => {
    resetBatch();
  });

  test('flush triggers at 100 events', () => {
    const flushMock = jest.fn();
    // Replace the real flushBatch with our mock
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = flushMock;

    for (let i = 0; i < 100; i++) {
      addEvent({ id: `event-${i}`, type: 'test', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    expect(getBatchSize()).toBe(0);
    expect(flushMock).toHaveBeenCalledTimes(1);

    // Restore original flushBatch
    (global as any).flushBatch = originalFlushBatch;
  });

  test('flush triggers on page unload', () => {
    const flushMock = jest.fn();
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = flushMock;

    addEvent({ id: 'event-1', type: 'test', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    expect(getBatchSize()).toBe(1);

    // Simulate page unload event
    window.dispatchEvent(new Event('beforeunload'));

    expect(flushMock).toHaveBeenCalled();

    (global as any).flushBatch = originalFlushBatch;
  });

  test('partial batches are preserved after flush', () => {
    const flushMock = jest.fn(() => {
      // Simulate flush clearing batch except partial batch
      resetBatch();
      addEvent({ id: 'partial-event', type: 'test', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    });
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = flushMock;

    for (let i = 0; i < 100; i++) {
      addEvent({ id: `event-${i}`, type: 'test', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
    expect(getBatchSize()).toBe(1);
    expect(getBatchSize()).not.toBe(0);

    (global as any).flushBatch = originalFlushBatch;
  });

  test('batch resets after flush', () => {
    const flushMock = jest.fn(() => {
      resetBatch();
    });
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = flushMock;

    for (let i = 0; i < 100; i++) {
      addEvent({ id: `event-${i}`, type: 'test', timestamp: Date.now(), sessionId: 'sess1', properties: {} });
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
    expect(getBatchSize()).toBe(0);

    (global as any).flushBatch = originalFlushBatch;
  });
});
