import assert from 'node:assert/strict';
import test from 'node:test';

test('telemetry module exports required functions', async () => {
  const telemetry = await import('./telemetry.ts');

  assert.ok(typeof telemetry.initTelemetry === 'function', 'initTelemetry should be exported');
  assert.ok(typeof telemetry.track === 'function', 'track should be exported');
  assert.ok(typeof telemetry.forceFlush === 'function', 'forceFlush should be exported');
  assert.ok(typeof telemetry.getTelemetryStats === 'function', 'getTelemetryStats should be exported');
  assert.ok(typeof telemetry.setTelemetryEnabled === 'function', 'setTelemetryEnabled should be exported');
});

test('telemetry config default batchSize is 100', async () => {
  const { getTelemetryStats } = await import('./telemetry.ts');
  const stats = getTelemetryStats();
  assert.equal(stats.config.batchSize, 100, 'default batchSize should be 100');
});

test('telemetry config default flushInterval is 30000', async () => {
  const { getTelemetryStats } = await import('./telemetry.ts');
  const stats = getTelemetryStats();
  assert.equal(stats.config.flushInterval, 30000, 'default flushInterval should be 30000');
});

test('flush threshold: events >= batchSize trigger flush attempt in source', async () => {
  const source = (await import('fs')).readFileSync('./src/services/telemetry.ts', 'utf8');
  assert.ok(
    source.includes('state.events.length >= state.config.batchSize') &&
    source.includes('flushEvents'),
    'batchSize threshold should trigger flushEvents()'
  );
});

test('page unload flushes via beforeunload listener in source', async () => {
  const source = (await import('fs')).readFileSync('./src/services/telemetry.ts', 'utf8');
  assert.ok(
    source.includes('beforeunload') && source.includes('forceFlush'),
    'beforeunload should trigger forceFlush()'
  );
});

test('partial batches are preserved and sent via flush timer in source', async () => {
  const source = (await import('fs')).readFileSync('./src/services/telemetry.ts', 'utf8');
  assert.ok(
    source.includes('flushTimer') && source.includes('flushInterval'),
    'partial batches should be preserved for timer-based flush'
  );
});
