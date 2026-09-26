import assert from 'node:assert/strict';
import test from 'node:test';
import { VISUAL_MATERIALS } from './capabilityRegistry.ts';
import { resolveSkinVisual } from './skinVisualContract.ts';

test('skin visual mods override material colors without changing gameplay', () => {
  const resolved = resolveSkinVisual(VISUAL_MATERIALS.steel, {
    skinId: 'gareth_ember',
    heroId: 'gareth',
    rarity: 'épica',
    mods: { auraColor: 0xff6020, trailColor: 0xff9050, glowColor: 0xff8040 },
  });
  assert.equal(resolved.aura, 0xff6020);
  assert.equal(resolved.trail, 0xff9050);
  assert.equal(resolved.intensity, 1.2);
});
