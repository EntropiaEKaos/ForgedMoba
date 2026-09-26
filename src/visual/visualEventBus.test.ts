import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import { VisualEventBus } from './visualEventBus.ts';

test('visual event bus publishes authoritative state-delta events', () => {
  const state = createSimulation({
    seed: 233,
    players: [
      { playerId: 'a', team: 0, x: 1000, y: 1000, heroId: 'gareth' },
      { playerId: 'b', team: 1, x: 1060, y: 1000, heroId: 'luxana' },
    ],
  });
  const bus = new VisualEventBus();
  const received: string[] = [];
  bus.subscribe((event) => received.push(event.type));
  bus.observe(state);
  stepSimulation(state, [{ type: 'cast', playerId: 'a', seq: 1, tick: 0, slot: 'Q', targetId: 2 }]);
  bus.observe(state);
  assert.ok(received.includes('q-cast'));
  assert.ok(received.includes('status-impact'));
});
