import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthoritativeSnapshot } from '../../src/shared/protocol.ts';
import type { SimulationState } from '../../src/simulation/index.ts';
import { MatchRunner, stableSeedFromMatchId } from './matchRunner.ts';

function createRunner(onSnapshot?: (snapshot: AuthoritativeSnapshot<SimulationState>) => void) {
  return new MatchRunner({
    matchId: 'match-test-001',
    contentVersion: 'core-0.2+deadbeef',
    seed: stableSeedFromMatchId('match-test-001'),
    snapshotEveryTicks: 3,
    players: [
      { playerId: 'blue-1', team: 0, slot: 0 },
      { playerId: 'red-1', team: 1, slot: 0 },
    ],
    onSnapshot,
  });
}

test('runner accepts monotonic commands inside bounded tick window', () => {
  const runner = createRunner();
  assert.deepEqual(runner.enqueue('blue-1', { type: 'move', playerId: 'spoof', seq: 1, tick: 0, x: 900, y: 1500 }), { ok: true });
  assert.deepEqual(runner.enqueue('blue-1', { type: 'stop', playerId: 'spoof', seq: 1, tick: 0 }), { ok: false, code: 'invalid-seq' });
  assert.deepEqual(runner.enqueue('blue-1', { type: 'stop', playerId: 'spoof', seq: 2, tick: 7 }), { ok: false, code: 'future-tick' });
  runner.advanceOneTick();
  assert.equal(runner.state.lastAcceptedSeq['blue-1'], 1);
  assert.deepEqual(runner.enqueue('blue-1', { type: 'stop', playerId: 'spoof', seq: 2, tick: 0 }), { ok: false, code: 'stale-tick' });
});

test('runner accepts authoritative Q and still rejects unsupported ability slots', () => {
  const runner = createRunner();
  assert.deepEqual(
    runner.enqueue('blue-1', { type: 'cast', playerId: 'spoof', seq: 1, tick: 0, slot: 'Q', targetId: 2 }),
    { ok: true },
  );
  assert.deepEqual(
    runner.enqueue('blue-1', { type: 'cast', playerId: 'blue-1', seq: 2, tick: 0, slot: 'W', x: 1000, y: 1500 }),
    { ok: false, code: 'unsupported-command' },
  );
  runner.advanceOneTick();
  assert.equal(runner.state.lastAcceptedSeq['blue-1'], 1);
});

test('runner emits authoritative hashed snapshots at configured cadence', () => {
  const snapshots: AuthoritativeSnapshot<SimulationState>[] = [];
  const runner = createRunner((snapshot) => snapshots.push(snapshot));
  runner.advanceOneTick();
  runner.advanceOneTick();
  assert.equal(snapshots.length, 0);
  runner.advanceOneTick();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].serverTick, 3);
  assert.equal(snapshots[0].matchId, 'match-test-001');
  assert.match(snapshots[0].stateHash, /^[0-9a-f]{8}$/);
  assert.notEqual(snapshots[0].state, runner.state);
});

test('stable match ID seed is deterministic', () => {
  assert.equal(stableSeedFromMatchId('abc'), stableSeedFromMatchId('abc'));
  assert.notEqual(stableSeedFromMatchId('abc'), stableSeedFromMatchId('abd'));
});
