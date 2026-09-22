import assert from 'node:assert/strict';
import test from 'node:test';
import type { CoreMovementCommand } from '../shared/protocol.ts';
import { createSimulation, stepSimulation } from './core.ts';
import { runDeterminismProbe } from './determinism.ts';
import { hashSimulationState } from './hash.ts';

const options = {
  seed: 0xC0FFEE,
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

test('same seed + same inputs stays deterministic for 10k ticks', () => {
  const probe = runDeterminismProbe(options, 10_000, scenarioCommands);
  assert.equal(probe.ok, true, 'divergiu no tick ' + probe.firstDivergentTick);
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
