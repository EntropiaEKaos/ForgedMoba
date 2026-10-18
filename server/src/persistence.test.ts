import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  DEFAULT_RANKED_MMR,
  DuplicateIdentityError,
  JsonFilePersistenceStore,
  MemoryPersistenceStore,
} from './persistence.ts';

test('accounts are indexed case-insensitively and reject duplicate identities', async () => {
  const store = new MemoryPersistenceStore(() => 1_000);
  await store.initialize();
  const user = await store.createUser({
    id: 'u1',
    username: 'ForgedPlayer',
    email: 'player@example.com',
    passwordHash: 'hash',
    passwordSalt: 'salt',
  });

  assert.equal(user.rankedMmr, DEFAULT_RANKED_MMR);
  assert.equal((await store.findUserByUsername('forgedplayer'))?.id, 'u1');
  assert.equal((await store.findUserByEmail('PLAYER@example.com'))?.id, 'u1');

  await assert.rejects(
    () => store.createUser({
      id: 'u2',
      username: 'FORGEDPLAYER',
      email: 'other@example.com',
      passwordHash: 'hash',
      passwordSalt: 'salt',
    }),
    (error: unknown) => error instanceof DuplicateIdentityError && error.field === 'username',
  );
});

test('sessions are revocable and expire server-side', async () => {
  let now = 10_000;
  const store = new MemoryPersistenceStore(() => now);
  await store.createUser({
    id: 'u1',
    username: 'p1',
    email: 'p1@example.com',
    passwordHash: 'hash',
    passwordSalt: 'salt',
  });

  const session = await store.createSession('u1', 5_000);
  assert.equal((await store.findActiveSession(session.id))?.userId, 'u1');

  assert.equal(await store.revokeSession(session.id), true);
  assert.equal(await store.findActiveSession(session.id), null);

  const expiring = await store.createSession('u1', 1_000);
  now = 12_000;
  assert.equal(await store.findActiveSession(expiring.id), null);
});

test('ranked 5v5 records one idempotent result and updates MMR', async () => {
  const store = new MemoryPersistenceStore(() => 50_000);
  for (let index = 0; index < 10; index += 1) {
    await store.createUser({
      id: 'u' + index,
      username: 'player' + index,
      email: 'player' + index + '@example.com',
      passwordHash: 'hash',
      passwordSalt: 'salt',
    });
  }

  const players = Array.from({ length: 10 }, (_, index) => ({
    userId: 'u' + index,
    username: 'player' + index,
    team: (index < 5 ? 0 : 1) as 0 | 1,
    slot: index % 5,
  }));

  const record = await store.recordCompletedMatch({
    id: 'match-1',
    mode: 'ranked5v5',
    contentVersion: 'test-content',
    createdAt: 40_000,
    durationTicks: 9_000,
    winner: 0,
    players,
  });

  assert.equal(record.participants.length, 10);
  assert.equal((await store.findUserById('u0'))?.rankedMmr, 1016);
  assert.equal((await store.findUserById('u5'))?.rankedMmr, 984);
  assert.equal((await store.findUserById('u0'))?.rankedWins, 1);
  assert.equal((await store.findUserById('u5'))?.rankedLosses, 1);

  await store.recordCompletedMatch({
    id: 'match-1',
    mode: 'ranked5v5',
    contentVersion: 'test-content',
    createdAt: 40_000,
    durationTicks: 9_000,
    winner: 0,
    players,
  });
  assert.equal((await store.findUserById('u0'))?.rankedMmr, 1016);
  assert.equal((await store.recentMatches('u0')).length, 1);
});

test('json-file persistence survives a fresh store instance', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forged-moba-'));
  const file = path.join(dir, 'state.json');

  try {
    const first = new JsonFilePersistenceStore(file, () => 100_000);
    await first.initialize();
    await first.createUser({
      id: 'persisted',
      username: 'PersistedPlayer',
      email: 'persisted@example.com',
      passwordHash: 'hash',
      passwordSalt: 'salt',
    });
    const session = await first.createSession('persisted', 60_000);

    const raw = JSON.parse(await readFile(file, 'utf8')) as { version: number };
    assert.equal(raw.version, 1);

    const second = new JsonFilePersistenceStore(file, () => 100_500);
    await second.initialize();
    assert.equal((await second.findUserByUsername('persistedplayer'))?.id, 'persisted');
    assert.equal((await second.findActiveSession(session.id))?.userId, 'persisted');
    assert.equal(second.stats().durable, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
