import assert from 'node:assert/strict';
import test from 'node:test';
import type { CoreMovementCommand } from '../shared/protocol.ts';
import { createSimulation, stepSimulation } from './core.ts';
import { runDeterminismProbe } from './determinism.ts';
import { hashSimulationState } from './hash.ts';
import { buildSpatialHash, querySpatialHash } from './spatialHash.ts';

const options = {
  seed: 0xC0FFEE,
  contentVersion: 'test-content',
  players: [
    { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000 },
    { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000 },
  ],
};

function scenarioCommands(tick: number): readonly CoreMovementCommand[] {
  const commands: CoreMovementCommand[] = [];
  if (tick === 0) {
    commands.push({ type: 'attack', playerId: 'blue-1', seq: 1, tick, targetId: 2 });
    commands.push({ type: 'attack', playerId: 'red-1', seq: 1, tick, targetId: 1 });
  }
  if (tick === 300) commands.push({ type: 'move', playerId: 'blue-1', seq: 2, tick, x: 1200, y: 1100 });
  if (tick === 600) commands.push({ type: 'move', playerId: 'red-1', seq: 2, tick, x: 1180, y: 1100 });
  if (tick === 900) commands.push({ type: 'stop', playerId: 'blue-1', seq: 3, tick });
  return commands;
}

test('same seed + same inputs stays deterministic for 100k ticks', () => {
  const probe = runDeterminismProbe(options, 100_000, scenarioCommands);
  assert.equal(probe.ok, true, 'divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});

test('lane simulation stays deterministic across waves and AI', () => {
  const probe = runDeterminismProbe({ ...options, withLane: true }, 5_000, () => []);
  assert.equal(probe.ok, true, 'lane divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});

test('input sequence rejects duplicates and stale commands', () => {
  const state = createSimulation(options);
  stepSimulation(state, [
    { type: 'move', playerId: 'blue-1', seq: 1, tick: 0, x: 1100, y: 1000 },
    { type: 'move', playerId: 'blue-1', seq: 1, tick: 0, x: 2000, y: 2000 },
  ]);
  assert.equal(state.lastAcceptedSeq['blue-1'], 1);
  assert.notEqual(state.entities['1'].moveTarget?.x, 2000);
});

test('state hash changes when authoritative state changes', () => {
  const state = createSimulation(options);
  const before = hashSimulationState(state);
  stepSimulation(state, []);
  const after = hashSimulationState(state);
  assert.notEqual(before, after);
});

test('lane starts with towers and deterministic minion wave', () => {
  const state = createSimulation({ ...options, withLane: true });
  assert.equal(Object.values(state.entities).filter((entity) => entity.kind === 'tower').length, 2);
  stepSimulation(state, []);
  assert.equal(state.waveNumber, 1);
  assert.equal(Object.values(state.entities).filter((entity) => entity.kind === 'minion').length, 6);
});

test('hero last-hit awards gold, xp and cs authoritatively', () => {
  const state = createSimulation({ ...options, withLane: true });
  stepSimulation(state, []);
  const hero = state.entities['1'];
  const minion = Object.values(state.entities).find((entity) => entity.kind === 'minion' && entity.team === 1);
  assert.ok(minion);
  minion.x = hero.x + 20;
  minion.y = hero.y;
  minion.hp = 1;
  const goldBefore = hero.gold;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: state.tick, targetId: minion.id }]);
  assert.equal(minion.dead, true);
  assert.equal(hero.cs, 1);
  assert.equal(hero.gold, goldBefore + minion.bountyGold);
  assert.ok(hero.xp > 0);
});

test('destroying enemy lane tower produces a deterministic winner', () => {
  const state = createSimulation({ ...options, withLane: true });
  const hero = state.entities['1'];
  const tower = Object.values(state.entities).find((entity) => entity.kind === 'tower' && entity.team === 1);
  assert.ok(tower);
  tower.x = hero.x + 20;
  tower.y = hero.y;
  tower.hp = 1;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: 0, targetId: tower.id }]);
  assert.equal(tower.dead, true);
  assert.equal(state.winner, 0);
});

test('spatial hash returns stable sorted candidate IDs', () => {
  const state = createSimulation({ ...options, withLane: true });
  stepSimulation(state, []);
  const index = buildSpatialHash(state.entities, 128);
  const ids = querySpatialHash(index, 1500, 1500, 2000);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.ok(ids.length >= 10);
});
