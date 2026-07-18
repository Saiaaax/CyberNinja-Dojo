import { TelemetryService } from './telemetry';

describe('TelemetryService', () => {
  let telemetryService: TelemetryService;

  beforeEach(() => {
    telemetryService = new TelemetryService();
  });

  it('should flush when batch size exceeds 100', () => {
    const flushSpy = jest.spyOn(telemetryService, 'flush');
    for (let i = 0; i < 100; i++) {
      telemetryService.recordEvent({ name: `event${i}` });
    }
    expect(flushSpy).not.toHaveBeenCalled();
    telemetryService.recordEvent({ name: 'event100' });
    expect(flushSpy).toHaveBeenCalled();
  });

  it('should trigger flush on page unload', () => {
    const flushSpy = jest.spyOn(telemetryService, 'flush');
    window.dispatchEvent(new Event('beforeunload'));
    expect(flushSpy).toHaveBeenCalled();
  });

  it('should preserve partial batches after flush', () => {
    const flushSpy = jest.spyOn(telemetryService, 'flush');
    for (let i = 0; i < 100; i++) {
      telemetryService.recordEvent({ name: `event${i}` });
    }
    telemetryService.recordEvent({ name: 'event100' });
    expect(flushSpy).toHaveBeenCalled();
    flushSpy.mockClear();
    telemetryService.recordEvent({ name: 'event101' });
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('should reset batch after flush', () => {
    const flushSpy = jest.spyOn(telemetryService, 'flush');
    for (let i = 0; i < 100; i++) {
      telemetryService.recordEvent({ name: `event${i}` });
    }
    telemetryService.recordEvent({ name: 'event100' });
    expect(flushSpy).toHaveBeenCalled();
    flushSpy.mockClear();
    for (let i = 0; i < 100; i++) {
      telemetryService.recordEvent({ name: `event${i + 101}` });
    }
    telemetryService.recordEvent({ name: 'event200' });
    expect(flushSpy).toHaveBeenCalled();
  });
});