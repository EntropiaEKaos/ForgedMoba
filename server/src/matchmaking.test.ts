import assert from 'node:assert/strict';
import test from 'node:test';
import { MatchmakingQueues } from './matchmaking.ts';

test('duel becomes ready with exactly two players and stays isolated from ranked', () => {
  const queues = new MatchmakingQueues();
  assert.deepEqual(
    queues.join({ userId: 'a', username: 'A', socketId: 'sa' }, 'duel1v1'),
    { joined: true, position: 1, requiredPlayers: 2, mode: 'duel1v1' },
  );
  queues.join({ userId: 'b', username: 'B', socketId: 'sb' }, 'ranked5v5');
  assert.equal(queues.takeReady('duel1v1'), null);

  queues.join({ userId: 'c', username: 'C', socketId: 'sc' }, 'duel1v1');
  const duel = queues.takeReady('duel1v1');
  assert.deepEqual(duel?.map((entry) => entry.userId), ['a', 'c']);
  assert.equal(queues.size('duel1v1'), 0);
  assert.equal(queues.size('ranked5v5'), 1);
});

test('one socket cannot join two queues simultaneously', () => {
  const queues = new MatchmakingQueues();
  queues.join({ userId: 'a', username: 'A', socketId: 'sa' }, 'duel1v1');
  const second = queues.join({ userId: 'a', username: 'A', socketId: 'sa' }, 'ranked5v5');
  assert.equal(second.joined, false);
  assert.equal(second.mode, 'duel1v1');
  assert.equal(queues.size('ranked5v5'), 0);
});

test('disconnect cleanup removes socket from its queue', () => {
  const queues = new MatchmakingQueues();
  queues.join({ userId: 'a', username: 'A', socketId: 'sa' }, 'ranked5v5');
  assert.equal(queues.leaveBySocket('sa'), true);
  assert.equal(queues.size('ranked5v5'), 0);
  assert.equal(queues.leaveBySocket('missing'), false);
});


test('same account cannot occupy multiple queue slots through different sockets', () => {
  const queues = new MatchmakingQueues();
  queues.join({ userId: 'same-user', username: 'A', socketId: 'tab-1' }, 'duel1v1');
  const duplicate = queues.join({ userId: 'same-user', username: 'A', socketId: 'tab-2' }, 'duel1v1');
  assert.equal(duplicate.joined, false);
  assert.equal(queues.size('duel1v1'), 1);
});


test('3v3 skirmish becomes ready with exactly six players and stays isolated', () => {
  const queues = new MatchmakingQueues();
  for (let i = 0; i < 5; i += 1) {
    queues.join(
      { userId: 's' + i, username: 'S' + i, socketId: 'ss' + i },
      'skirmish3v3',
    );
  }
  queues.join({ userId: 'duel-a', username: 'DA', socketId: 'duel-a' }, 'duel1v1');
  assert.equal(queues.takeReady('skirmish3v3'), null);

  queues.join({ userId: 's5', username: 'S5', socketId: 'ss5' }, 'skirmish3v3');
  const ready = queues.takeReady('skirmish3v3');
  assert.equal(ready?.length, 6);
  assert.deepEqual(ready?.map((entry) => entry.userId), ['s0', 's1', 's2', 's3', 's4', 's5']);
  assert.equal(queues.size('skirmish3v3'), 0);
  assert.equal(queues.size('duel1v1'), 1);
  assert.equal(queues.requiredPlayers('skirmish3v3'), 6);
});
