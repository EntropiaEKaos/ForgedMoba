import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation } from '../simulation/core.ts';
import { deriveBattlefieldLights, lightPulse } from './lightingModel.ts';

function scene() {
  return createSimulation({
    seed: 2022,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue', team: 0, x: 900, y: 1500, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 2100, y: 1500, heroId: 'luxana' },
    ],
  });
}

test('lighting is presentation-only and disabled by low quality budget', () => {
  const state = scene();
  assert.deepEqual(deriveBattlefieldLights(state, 'blue', 'low'), []);
});

test('lighting prioritizes objective/local hero and respects quality budget', () => {
  const state = scene();
  const medium = deriveBattlefieldLights(state, 'blue', 'medium');
  const ultra = deriveBattlefieldLights(state, 'blue', 'ultra');
  assert.ok(medium.length <= 4);
  assert.ok(ultra.length <= 16);
  assert.ok(ultra.length >= medium.length);
  assert.equal(ultra[0]?.key.startsWith('objective:'), true);
  assert.ok(ultra.some((light) => light.key === 'hero:1'));
});

test('light pulse is deterministic for the same source and elapsed time', () => {
  const state = scene();
  const light = deriveBattlefieldLights(state, 'blue', 'ultra')[0];
  assert.ok(light);
  assert.equal(lightPulse(light, 1.25), lightPulse(light, 1.25));
  assert.ok(lightPulse(light, 0) > 0);
});
