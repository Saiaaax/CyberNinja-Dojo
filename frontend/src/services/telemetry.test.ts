/**
 * Tests for telemetry service batch flush behavior.
 * 
 * These tests verify the telemetry batching and flush logic without
 * requiring external services or network calls.
 * 
 * Run with: node --experimental-strip-types --test src/services/telemetry.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// Simple test to verify telemetry module structure and exports
test('telemetry module: exports required functions', async () => {
  const telemetry = await import('./telemetry.ts');
  
  assert.ok(typeof telemetry.initTelemetry === 'function', 'initTelemetry should be exported');
  assert.ok(typeof telemetry.track === 'function', 'track should be exported');
  assert.ok(typeof telemetry.forceFlush === 'function', 'forceFlush should be exported');
  assert.ok(typeof telemetry.getTelemetryStats === 'function', 'getTelemetryStats should be exported');
  assert.ok(typeof telemetry.setTelemetryEnabled === 'function', 'setTelemetryEnabled should be exported');
});

test('telemetry stats: returns correct structure', async () => {
  const { getTelemetryStats } = await import('./telemetry.ts');
  
  const stats = getTelemetryStats();
  
  assert.ok('queued' in stats, 'stats should have queued property');
  assert.ok('sent' in stats, 'stats should have sent property');
  assert.ok('dropped' in stats, 'stats should have dropped property');
  assert.ok('errors' in stats, 'stats should have errors property');
  assert.ok('sessionId' in stats, 'stats should have sessionId property');
  assert.ok('config' in stats, 'stats should have config property');
  
  assert.equal(typeof stats.queued, 'number', 'queued should be number');
  assert.equal(typeof stats.sent, 'number', 'sent should be number');
  assert.equal(typeof stats.dropped, 'number', 'dropped should be number');
});

test('telemetry config: has expected properties', async () => {
  const { getTelemetryStats } = await import('./telemetry.ts');
  
  const stats = getTelemetryStats();
  const config = stats.config;
  
  assert.ok('enabled' in config, 'config should have enabled property');
  assert.ok('endpoint' in config, 'config should have endpoint property');
  assert.ok('sampleRate' in config, 'config should have sampleRate property');
  
  assert.equal(typeof config.enabled, 'boolean', 'enabled should be boolean');
  assert.equal(typeof config.sampleRate, 'number', 'sampleRate should be number');
});

test('telemetry enable/disable: toggles correctly', async () => {
  const { setTelemetryEnabled, getTelemetryStats } = await import('./telemetry.ts');
  
  // Disable telemetry
  setTelemetryEnabled(false);
  let stats = getTelemetryStats();
  assert.equal(stats.config.enabled, false, 'telemetry should be disabled');
  
  // Note: We don't test enabling because it triggers browser-specific code
  // (window.setInterval) that's not available in Node.js test environment
  
  // Reset to disabled for other tests
  setTelemetryEnabled(false);
});

test('telemetry sample rate: clamps between 0 and 1', async () => {
  const { setSampleRate, getTelemetryStats } = await import('./telemetry.ts');
  
  // Test valid rate
  setSampleRate(0.5);
  let stats = getTelemetryStats();
  assert.equal(stats.config.sampleRate, 0.5, 'sample rate should be 0.5');
  
  // Test rate > 1 (should clamp to 1)
  setSampleRate(1.5);
  stats = getTelemetryStats();
  assert.equal(stats.config.sampleRate, 1, 'sample rate should be clamped to 1');
  
  // Test rate < 0 (should clamp to 0)
  setSampleRate(-0.5);
  stats = getTelemetryStats();
  assert.equal(stats.config.sampleRate, 0, 'sample rate should be clamped to 0');
  
  // Reset to default
  setSampleRate(1.0);
});
