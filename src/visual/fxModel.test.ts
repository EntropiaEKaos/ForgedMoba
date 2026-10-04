import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import { captureVisualProbe, deriveCombatFx, fxSeed, nextVisualRandom } from './fxModel.ts';

test('damage/death FX are derived from state deltas only', () => {
  const state = createSimulation({
    seed: 10,
    players: [
      { playerId: 'a', team: 0, x: 1000, y: 1000 },
      { playerId: 'b', team: 1, x: 1040, y: 1000 },
    ],
  });
  const before = captureVisualProbe(state);
  state.entities['2'].hp = 0;
  state.entities['2'].dead = true;
  state.tick = 1;
  const events = deriveCombatFx(before, captureVisualProbe(state));
  assert.ok(events.some((event) => event.type === 'damage'));
  assert.ok(events.some((event) => event.type === 'death'));
});

test('authoritative ability casts and crowd-control status produce visual events', () => {
  const state = createSimulation({
    seed: 11,
    players: [
      { playerId: 'a', team: 0, x: 1000, y: 1000, heroId: 'gareth' },
      { playerId: 'b', team: 1, x: 1060, y: 1000, heroId: 'luxana' },
    ],
  });
  const before = captureVisualProbe(state);
  stepSimulation(state, [{ type: 'cast', playerId: 'a', seq: 1, tick: 0, slot: 'Q', targetId: 2 }]);
  const events = deriveCombatFx(before, captureVisualProbe(state));
  assert.ok(events.some((event) => event.type === 'ability-cast' && event.entityId === 1 && event.slot === 'Q'));
  assert.ok(events.some((event) => event.type === 'status-impact' && event.entityId === 2));
});

test('visual PRNG is repeatable for the same event seed', () => {
  const event = { type: 'damage', tick: 5, entityId: 3, x: 0, y: 0, amount: 10 } as const;
  let a = fxSeed(event);
  let b = fxSeed(event);
  for (let i = 0; i < 20; i += 1) {
    const ra = nextVisualRandom(a);
    const rb = nextVisualRandom(b);
    assert.equal(ra.value, rb.value);
    a = ra.state;
    b = rb.state;
  }
});


test('expanded visual events cover progression, equipment, shield and basic attacks', () => {
  const state = createSimulation({
    seed: 12,
    players: [
      { playerId: 'a', team: 0, x: 1000, y: 1000, heroId: 'gareth' },
      { playerId: 'b', team: 1, x: 1060, y: 1000, heroId: 'luxana' },
    ],
  });
  state.entities['1'].hp = 500;
  const before = captureVisualProbe(state);

  state.entities['1'].hp = 540;
  state.entities['1'].shieldHp = 120;
  state.entities['1'].level += 1;
  state.entities['1'].inventory.push('longsword');
  state.entities['1'].attackTargetId = 2;
  state.entities['1'].attackCooldownRemaining = 12;
  state.tick += 1;

  const events = deriveCombatFx(before, captureVisualProbe(state));
  assert.ok(events.some((event) => event.type === 'heal'));
  assert.ok(events.some((event) => event.type === 'shield-gain'));
  assert.ok(events.some((event) => event.type === 'level-up'));
  assert.ok(events.some((event) => event.type === 'item-equip' && event.itemId === 'longsword'));
  assert.ok(events.some((event) => event.type === 'basic-attack' && event.targetId === 2));
});

test('new authoritative ward entity becomes a visual spawn event', () => {
  const state = createSimulation({
    seed: 13,
    players: [{ playerId: 'a', team: 0, x: 1000, y: 1000, heroId: 'gareth' }],
  });
  const before = captureVisualProbe(state);
  stepSimulation(state, [{ type: 'place-ward', playerId: 'a', seq: 1, tick: state.tick, x: 1100, y: 1000 }]);
  const events = deriveCombatFx(before, captureVisualProbe(state));
  assert.ok(events.some((event) => event.type === 'ward-spawn' && event.team === 0));
});
