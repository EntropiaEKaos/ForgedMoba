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
