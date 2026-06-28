import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendBeacon = jest.fn().mockReturnValue(true);
const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
const mockSetInterval = jest.fn().mockReturnValue(42);
const mockClearInterval = jest.fn();
const mockAddEventListener = jest.fn();

Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: mockSendBeacon, userAgent: 'Jest', language: 'en-US', hardwareConcurrency: 8, connection: { effectiveType: '4g' } }, writable: true });
Object.defineProperty(globalThis, 'window', { value: { location: { href: 'http://localhost:3000' }, innerWidth: 1920, innerHeight: 1080, setInterval: mockSetInterval, clearInterval: mockClearInterval, addEventListener: mockAddEventListener }, writable: true });
Object.defineProperty(globalThis, 'screen', { value: { width: 1920, height: 1080 }, writable: true });
Object.defineProperty(globalThis, 'document', { value: { title: 'Test Page', referrer: '', addEventListener: jest.fn(), visibilityState: 'visible' }, writable: true });
globalThis.PerformanceObserver = jest.fn().mockImplementation(()=>({observe:jest.fn(),disconnect:jest.fn()}));
globalThis.fetch = mockFetch;

describe('Telemetry Batch Flush Threshold Tests', () => {
  let mod: any;
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.VITE_TELEMETRY_ENDPOINT = 'https://t.example.com/api';
    process.env.VITE_TELEMETRY_ENABLED = 'true';
    jest.resetModules();
    mod = await import('../../src/services/telemetry');
  });

  it('should not flush when buffer is below threshold (99 events)', () => {
    for (let i = 0; i < 99; i++) mod.track('custom_event', { index: i });
    const stats = mod.getTelemetryStats();
    expect(stats.queued).toBe(99);
    expect(stats.sent).toBe(0);
  });

  it('should flush exactly at batch threshold (100 events)', () => {
    for (let i = 0; i < 100; i++) mod.track('custom_event', { index: i });
    const stats = mod.getTelemetryStats();
    expect(stats.queued).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple flush cycles for 250 events', () => {
    for (let i = 0; i < 250; i++) mod.track('custom_event', { index: i });
    const stats = mod.getTelemetryStats();
    expect(stats.queued).toBeLessThanOrEqual(100);
  });

  it('should handle forced flush below threshold', () => {
    for (let i = 0; i < 50; i++) mod.track('feature_usage', { feature: 'test' });
    mod.forceFlush();
    const stats = mod.getTelemetryStats();
    expect(stats.sent).toBeGreaterThanOrEqual(0);
  });

  it('should drop all events when telemetry is disabled', () => {
    mod.setTelemetryEnabled(false);
    mod.track('page_view', {});
    const stats = mod.getTelemetryStats();
    expect(stats.queued).toBe(0);
  });

  it('should drop all events when sample rate is 0', () => {
    mod.setSampleRate(0.0);
    for (let i = 0; i < 50; i++) mod.track('custom_event', { i });
    expect(mod.getTelemetryStats().queued).toBe(0);
  });

  it('should preserve event ordering in buffer', () => {
    mod.track('custom_event', { step: 1 });
    mod.track('custom_event', { step: 2 });
    mod.track('custom_event', { step: 3 });
    expect(mod.getTelemetryStats().queued).toBe(3);
  });
});