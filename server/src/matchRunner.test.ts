import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthoritativeSnapshot } from '../../src/shared/protocol.ts';
import type { SimulationState } from '../../src/simulation/index.ts';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../../src/shared/authoritativeContent.ts';
import { MatchRunner, stableSeedFromMatchId } from './matchRunner.ts';

function createRunner(onSnapshot?: (snapshot: AuthoritativeSnapshot<SimulationState>) => void) {
  return new MatchRunner({
    matchId: 'match-test-001',
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
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


test('1v1 forfeit is server authoritative and completes with the opponent winner', () => {
  let completedWinner: 0 | 1 | null = null;
  const runner = new MatchRunner({
    matchId: 'duel-forfeit',
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    seed: stableSeedFromMatchId('duel-forfeit'),
    players: [
      { playerId: 'blue-1', team: 0, slot: 0 },
      { playerId: 'red-1', team: 1, slot: 0 },
    ],
    onComplete: (state) => { completedWinner = state.winner; },
  });
  assert.equal(runner.forfeit('blue-1'), true);
  assert.equal(runner.state.winner, 1);
  assert.equal(completedWinner, 1);
  assert.equal(runner.forfeit('blue-1'), false);
  assert.equal(runner.forfeit('missing'), false);
});


test('team-level forfeit completes a 3v3 match with the opposite team winner', () => {
  let completedWinner: 0 | 1 | null = null;
  const runner = new MatchRunner({
    matchId: 'skirmish-team-forfeit',
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    seed: stableSeedFromMatchId('skirmish-team-forfeit'),
    players: [
      { playerId: 'b1', team: 0, slot: 0 },
      { playerId: 'b2', team: 0, slot: 1 },
      { playerId: 'b3', team: 0, slot: 2 },
      { playerId: 'r1', team: 1, slot: 0 },
      { playerId: 'r2', team: 1, slot: 1 },
      { playerId: 'r3', team: 1, slot: 2 },
    ],
    onComplete: (state) => { completedWinner = state.winner; },
  });
  assert.equal(runner.forfeitTeam(1), true);
  assert.equal(runner.state.winner, 0);
  assert.equal(completedWinner, 0);
  assert.equal(runner.forfeitTeam(1), false);
});


test('runner rejects a content version that does not match its published pack', () => {
  assert.throws(
    () => new MatchRunner({
      matchId: 'bad-content',
      contentVersion: 'wrong+deadbeef',
      seed: 1,
      players: [
        { playerId: 'blue-1', team: 0, slot: 0 },
        { playerId: 'red-1', team: 1, slot: 0 },
      ],
    }),
    /content mismatch/,
  );
});

test('runner accepts authoritative buy commands and applies published item stats', () => {
  const runner = createRunner();
  const hero = runner.state.entities['1'];
  const beforeDamage = hero.attackDamage;
  assert.deepEqual(
    runner.enqueue('blue-1', {
      type: 'buy',
      playerId: 'spoof',
      seq: 1,
      tick: 0,
      itemId: 'longsword',
    }),
    { ok: true },
  );
  runner.advanceOneTick();
  assert.deepEqual(hero.inventory, ['longsword']);
  assert.equal(hero.gold, CURRENT_AUTHORITATIVE_CONTENT.payload.rules.startingGold - 350);
  assert.equal(hero.attackDamage, beforeDamage + 10);
});


test('runner enables published jungle and accepts authoritative ward commands', () => {
  const runner = createRunner();
  assert.equal(runner.state.jungleEnabled, true);
  assert.equal(
    Object.values(runner.state.entities).filter((entity) => entity.kind === 'monster').length,
    2,
  );
  assert.equal(
    Object.values(runner.state.entities).filter((entity) => entity.kind === 'objective').length,
    1,
  );

  const hero = runner.state.entities['1'];
  assert.deepEqual(
    runner.enqueue('blue-1', {
      type: 'place-ward',
      playerId: 'spoof',
      seq: 1,
      tick: 0,
      x: hero.x + 200,
      y: hero.y,
    }),
    { ok: true },
  );
  runner.advanceOneTick();
  const ward = Object.values(runner.state.entities).find((entity) => entity.kind === 'ward');
  assert.ok(ward);
  assert.equal(ward.ownerPlayerId, 'blue-1');
});


test('MatchRunner preserves authoritative hero picks from ranked draft players', () => {
  const runner = new MatchRunner({
    matchId: 'draft-hero-picks',
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    content: CURRENT_AUTHORITATIVE_CONTENT,
    seed: stableSeedFromMatchId('draft-hero-picks'),
    players: [
      { playerId: 'blue-1', team: 0, slot: 0, heroId: 'luxana' },
      { playerId: 'red-1', team: 1, slot: 0, heroId: 'gareth' },
    ],
  });
  const blue = Object.values(runner.state.entities).find((entity) => entity.ownerPlayerId === 'blue-1');
  const red = Object.values(runner.state.entities).find((entity) => entity.ownerPlayerId === 'red-1');
  assert.equal(blue?.heroId, 'luxana');
  assert.equal(red?.heroId, 'gareth');
});
