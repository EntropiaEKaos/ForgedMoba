import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileMatchArchiveStore, MemoryMatchArchiveStore } from './matchArchive.ts';
import type { MatchReplayRecord } from './replay.ts';

function record(matchId = 'archive-test'): MatchReplayRecord {
  return {
    schemaVersion: 1,
    matchId,
    contentVersion: 'authority-test+abc',
    seed: 7,
    players: [],
    frames: [],
    finalTick: 0,
    winner: null,
    finalHash: 'deadbeef',
    terminal: null,
  };
}

test('memory archive clones records on save and read', async () => {
  const store = new MemoryMatchArchiveStore();
  const source = record();
  await store.save(source);
  source.finalHash = 'mutated';
  const restored = await store.read('archive-test');
  assert.equal(restored?.finalHash, 'deadbeef');
  if (restored) restored.finalHash = 'changed-again';
  assert.equal((await store.read('archive-test'))?.finalHash, 'deadbeef');
});

test('file archive persists one atomic JSON record per match', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forged-moba-archive-'));
  try {
    const store = new FileMatchArchiveStore(dir);
    await store.save(record('match-file-1'));
    assert.deepEqual(await store.read('match-file-1'), record('match-file-1'));
    assert.equal(await store.read('missing'), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
