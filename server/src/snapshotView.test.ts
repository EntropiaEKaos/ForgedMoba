import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../../src/shared/authoritativeContent.ts';
import { createSimulation, hashSimulationState } from '../../src/simulation/index.ts';
import type { AuthoritativeSnapshot } from '../../src/shared/protocol.ts';
import type { SimulationState } from '../../src/simulation/types.ts';
import { createPlayerSnapshot } from './snapshotView.ts';

function fullSnapshot(): AuthoritativeSnapshot<SimulationState> {
  const state = createSimulation({
    seed: 77,
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue', team: 0, x: 700, y: 1500, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 2300, y: 1500, heroId: 'luxana' },
    ],
  });
  state.lastAcceptedSeq.blue = 4;
  state.lastAcceptedSeq.red = 9;
  return {
    matchId: 'view-test',
    contentVersion: state.contentVersion,
    serverTick: state.tick,
    ackSeqByPlayer: { blue: 4, red: 9 },
    stateHash: hashSimulationState(state),
    state,
  };
}

test('player snapshot contains only player ack and fog-safe state hash', () => {
  const full = fullSnapshot();
  const blue = createPlayerSnapshot(full, 'blue');

  assert.deepEqual(blue.ackSeqByPlayer, { blue: 4 });
  assert.equal(blue.stateHash, hashSimulationState(blue.state));
  assert.notEqual(blue.stateHash, full.stateHash);
  assert.equal(blue.state.seed, 0);
  assert.equal(blue.state.rngState, 0);
  assert.equal(Object.values(blue.state.entities).some((entity) => entity.ownerPlayerId === 'red'), false);
});

test('different teams receive independently projected snapshots', () => {
  const full = fullSnapshot();
  const blue = createPlayerSnapshot(full, 'blue');
  const red = createPlayerSnapshot(full, 'red');

  assert.ok(Object.values(blue.state.entities).some((entity) => entity.ownerPlayerId === 'blue'));
  assert.ok(Object.values(red.state.entities).some((entity) => entity.ownerPlayerId === 'red'));
  assert.deepEqual(blue.ackSeqByPlayer, { blue: 4 });
  assert.deepEqual(red.ackSeqByPlayer, { red: 9 });
});
