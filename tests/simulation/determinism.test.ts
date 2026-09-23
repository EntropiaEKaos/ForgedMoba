import assert from 'node:assert/strict';
import test from 'node:test';
import { hashState } from '../../src/simulation/hash.js';
import { Simulation } from '../../src/simulation/simulation.js';
import type { InputCommand } from '../../src/shared/protocol.js';

function run(seed: number, ticks: number): string[] {
  const sim = new Simulation(seed);
  const a = sim.addPlayer('alpha', 0, 200, 200);
  const b = sim.addPlayer('bravo', 1, 600, 200);
  const hashes: string[] = [];
  let seqA = 0;
  let seqB = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    const commands: InputCommand[] = [];
    if (tick === 0) {
      commands.push({ type: 'move', seq: ++seqA, playerId: 'alpha', tick, x: 500, y: 200 });
      commands.push({ type: 'move', seq: ++seqB, playerId: 'bravo', tick, x: 500, y: 200 });
    }
    if (tick === 100) {
      commands.push({ type: 'attack', seq: ++seqA, playerId: 'alpha', tick, targetId: b });
      commands.push({ type: 'attack', seq: ++seqB, playerId: 'bravo', tick, targetId: a });
    }
    sim.step(commands);
    hashes.push(hashState(sim.state));
  }
  return hashes;
}

test('same seed + same command stream remains deterministic for 10k ticks', () => {
  const left = run(123456, 10_000);
  const right = run(123456, 10_000);
  assert.deepEqual(left, right);
});

test('different seed is represented in canonical authoritative state', () => {
  const a = new Simulation(1);
  const b = new Simulation(2);
  assert.notEqual(hashState(a.state), hashState(b.state));
});

test('duplicate command sequence numbers are idempotent', () => {
  const sim = new Simulation(7);
  sim.addPlayer('alpha', 0, 0, 0);
  const command: InputCommand = { type: 'move', seq: 1, playerId: 'alpha', tick: 0, x: 300, y: 0 };
  sim.step([command, command]);
  assert.equal(sim.state.lastProcessedSeq.alpha, 1);
});
