import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveResolution, normalizeVisualQuality, VISUAL_QUALITY } from './quality.ts';

test('quality normalization defaults to high for unknown values', () => {
  assert.equal(normalizeVisualQuality('ultra'), 'ultra');
  assert.equal(normalizeVisualQuality('potato'), 'high');
  assert.equal(normalizeVisualQuality(null), 'high');
});

test('effective resolution respects device ratio and preset cap', () => {
  assert.equal(effectiveResolution('low', 3), 1);
  assert.equal(effectiveResolution('ultra', 3), 2);
  assert.equal(effectiveResolution('high', 1.25), 1.25);
});

test('quality budgets scale monotonically', () => {
  assert.ok(VISUAL_QUALITY.low.particles < VISUAL_QUALITY.medium.particles);
  assert.ok(VISUAL_QUALITY.medium.particles < VISUAL_QUALITY.high.particles);
  assert.ok(VISUAL_QUALITY.high.particles < VISUAL_QUALITY.ultra.particles);
});
