import assert from 'node:assert/strict';
import test from 'node:test';
import { RankedDraftRoom } from './rankedDraft.ts';

function entries() {
  return Array.from({ length: 10 }, (_, index) => ({
    userId: 'p' + index,
    username: 'Player' + index,
    socketId: 's' + index,
  }));
}

function room() {
  return new RankedDraftRoom({
    draftId: 'draft-test',
    entries: entries(),
    contentVersion: 'authority-test+abc',
    allowedHeroIds: ['gareth', 'luxana'],
    createdAt: 1_000,
    timeoutMs: 120_000,
  });
}

test('ranked draft assigns exactly five stable roles per team', () => {
  const snapshot = room().snapshot();
  assert.equal(snapshot.players.length, 10);
  assert.deepEqual(
    snapshot.players.filter((player) => player.team === 0).map((player) => player.role),
    ['top', 'jungle', 'mid', 'carry', 'support'],
  );
  assert.deepEqual(
    snapshot.players.filter((player) => player.team === 1).map((player) => player.role),
    ['top', 'jungle', 'mid', 'carry', 'support'],
  );
});

test('only published heroes can be picked and ready requires a pick', () => {
  const draft = room();
  assert.deepEqual(draft.setReady('p0', true), { ok: false, code: 'hero-required' });
  assert.deepEqual(draft.pickHero('p0', 'unknown'), { ok: false, code: 'invalid-hero' });
  assert.deepEqual(draft.pickHero('p0', 'gareth'), { ok: true });
  assert.deepEqual(draft.setReady('p0', true), { ok: true });
  assert.deepEqual(draft.pickHero('p0', 'luxana'), { ok: false, code: 'locked' });
});

test('draft launches only when all ten picked ready and connected', () => {
  const draft = room();
  for (let i = 0; i < 10; i += 1) {
    assert.deepEqual(draft.pickHero('p' + i, i % 2 === 0 ? 'gareth' : 'luxana'), { ok: true });
    assert.deepEqual(draft.setReady('p' + i, true), { ok: true });
  }
  assert.equal(draft.currentStatus, 'ready');
  const players = draft.launchPlayers();
  assert.equal(players?.length, 10);
  assert.equal(draft.currentStatus, 'launched');
  assert.deepEqual(players?.map((player) => [player.team, player.slot]), [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
  ]);
});

test('disconnect blocks launch and socket replacement restores the same slot', () => {
  const draft = room();
  for (let i = 0; i < 10; i += 1) {
    draft.pickHero('p' + i, 'gareth');
    draft.setReady('p' + i, true);
  }
  assert.equal(draft.currentStatus, 'ready');
  assert.equal(draft.markDisconnected('s4'), 'p4');
  assert.equal(draft.currentStatus, 'draft');
  assert.equal(draft.launchPlayers(), null);
  assert.equal(draft.replaceSocket('p4', 'replacement-s4'), true);
  assert.equal(draft.currentStatus, 'ready');
  assert.equal(draft.socketIdFor('p4'), 'replacement-s4');
  assert.equal(draft.launchPlayers()?.[4].role, 'support');
});

test('draft deadline is explicit and cancellation is terminal', () => {
  const draft = room();
  assert.equal(draft.isExpired(120_999), false);
  assert.equal(draft.isExpired(121_000), true);
  draft.cancel();
  assert.equal(draft.currentStatus, 'cancelled');
  assert.deepEqual(draft.pickHero('p0', 'gareth'), { ok: false, code: 'draft-closed' });
});
