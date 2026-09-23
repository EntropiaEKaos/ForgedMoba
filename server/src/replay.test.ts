import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../../src/shared/authoritativeContent.ts';
import { MatchRunner, stableSeedFromMatchId } from './matchRunner.ts';
import { replayMatchRecord } from './replay.ts';

function runner(matchId = 'replay-match') {
  return new MatchRunner({
    matchId,
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    content: CURRENT_AUTHORITATIVE_CONTENT,
    seed: stableSeedFromMatchId(matchId),
    players: [
      { playerId: 'blue-1', team: 0, slot: 0, heroId: 'gareth' },
      { playerId: 'red-1', team: 1, slot: 0, heroId: 'luxana' },
    ],
  });
}

test('applied command log replays to the exact authoritative hash', () => {
  const match = runner('replay-hash');
  assert.deepEqual(match.enqueue('blue-1', {
    type: 'move',
    playerId: 'spoof',
    seq: 1,
    tick: 0,
    x: 1100,
    y: 1400,
  }), { ok: true });
  assert.deepEqual(match.enqueue('red-1', {
    type: 'move',
    playerId: 'spoof',
    seq: 1,
    tick: 0,
    x: 1900,
    y: 1600,
  }), { ok: true });
  for (let i = 0; i < 30; i += 1) match.advanceOneTick();

  const record = match.exportReplay();
  const verification = replayMatchRecord(record, CURRENT_AUTHORITATIVE_CONTENT);
  assert.equal(verification.ok, true);
  assert.equal(verification.finalHash, record.finalHash);
  assert.equal(verification.state.tick, record.finalTick);
});

test('forfeit is represented as an explicit replay terminal event', () => {
  const match = runner('replay-forfeit');
  for (let i = 0; i < 7; i += 1) match.advanceOneTick();
  assert.equal(match.forfeitTeam(1), true);

  const record = match.exportReplay();
  assert.deepEqual(record.terminal, { type: 'forfeit-team', team: 1, tick: 7 });
  assert.equal(record.winner, 0);

  const verification = replayMatchRecord(record, CURRENT_AUTHORITATIVE_CONTENT);
  assert.equal(verification.ok, true);
  assert.equal(verification.state.winner, 0);
});

test('tampering with an applied replay command invalidates the final hash', () => {
  const match = runner('replay-tamper');
  match.enqueue('blue-1', {
    type: 'move',
    playerId: 'spoof',
    seq: 1,
    tick: 0,
    x: 1200,
    y: 1500,
  });
  for (let i = 0; i < 20; i += 1) match.advanceOneTick();

  const record = match.exportReplay();
  assert.equal(record.frames.length, 1);
  const tampered = structuredClone(record);
  const command = tampered.frames[0].commands[0];
  if (command.type !== 'move') throw new Error('expected move command');
  command.x += 333;

  const verification = replayMatchRecord(tampered, CURRENT_AUTHORITATIVE_CONTENT);
  assert.equal(verification.ok, false);
  assert.notEqual(verification.finalHash, tampered.finalHash);
});
