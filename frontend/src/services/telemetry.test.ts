import { flushBatch, addEvent, getBatch, resetBatch } from './telemetry';

describe('Telemetry batch flush threshold', () => {
  beforeEach(() => {
    resetBatch();
  });

  test('flush triggers at 100 events', () => {
    const flushMock = jest.fn();
    // Replace the real flushBatch with a mock to track calls
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = () => {
      flushMock();
      originalFlushBatch();
    };

    for (let i = 0; i < 100; i++) {
      addEvent({ type: 'test_event', id: i.toString(), timestamp: Date.now(), properties: {} });
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
    expect(getBatch().length).toBe(0);

    // Restore original flushBatch
    (global as any).flushBatch = originalFlushBatch;
  });

  test('flush triggers on page unload', () => {
    const flushMock = jest.fn();
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = () => {
      flushMock();
      originalFlushBatch();
    };

    addEvent({ type: 'test_event', id: '1', timestamp: Date.now(), properties: {} });
    // Simulate page unload event
    window.dispatchEvent(new Event('beforeunload'));

    expect(flushMock).toHaveBeenCalledTimes(1);

    (global as any).flushBatch = originalFlushBatch;
  });

  test('partial batches are preserved after flush', () => {
    const flushMock = jest.fn();
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = () => {
      flushMock();
      originalFlushBatch();
    };

    for (let i = 0; i < 150; i++) {
      addEvent({ type: 'test_event', id: i.toString(), timestamp: Date.now(), properties: {} });
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
    expect(getBatch().length).toBe(50);

    (global as any).flushBatch = originalFlushBatch;
  });

  test('batch resets after flush', () => {
    const flushMock = jest.fn();
    const originalFlushBatch = flushBatch;
    (global as any).flushBatch = () => {
      flushMock();
      originalFlushBatch();
    };

    for (let i = 0; i < 100; i++) {
      addEvent({ type: 'test_event', id: i.toString(), timestamp: Date.now(), properties: {} });
    }

    expect(flushMock).toHaveBeenCalledTimes(1);
    expect(getBatch().length).toBe(0);

    // Add more events after flush
    addEvent({ type: 'test_event', id: '101', timestamp: Date.now(), properties: {} });
    expect(getBatch().length).toBe(1);

    (global as any).flushBatch = originalFlushBatch;
  });
});
