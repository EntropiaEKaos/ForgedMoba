import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation } from '../simulation/core.ts';
import { nearestAttackableEntityId } from './targeting.ts';

test('targeting ignores allies and selects nearest attackable enemy', () => {
  const state = createSimulation({
    seed: 1,
    players: [
      { playerId: 'local', team: 0, x: 1000, y: 1000 },
      { playerId: 'ally', team: 0, x: 1020, y: 1000 },
      { playerId: 'enemy', team: 1, x: 1050, y: 1000 },
    ],
  });
  assert.equal(nearestAttackableEntityId(state, 'local', 1050, 1000), 3);
});
