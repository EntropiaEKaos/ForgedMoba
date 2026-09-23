import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FileIdentityStore,
  MemoryIdentityStore,
  type IdentityUser,
} from './identityStore.ts';

function user(id = 'u1'): IdentityUser {
  return {
    id,
    username: 'Player_' + id,
    email: id + '@example.test',
    passwordHash: 'hash-' + id,
    passwordSalt: 'salt-' + id,
    level: 1,
  };
}

test('memory identity store enforces normalized username and email uniqueness', async () => {
  const store = new MemoryIdentityStore();
  await store.createUser(user());
  await assert.rejects(
    store.createUser({ ...user('u2'), username: 'player_U1' }),
    /duplicate-username/,
  );
  await assert.rejects(
    store.createUser({ ...user('u3'), email: 'U1@EXAMPLE.TEST' }),
    /duplicate-email/,
  );
});

test('sessions are active until expiry or explicit revocation', async () => {
  const store = new MemoryIdentityStore();
  await store.createUser(user());
  await store.createSession({
    id: 's1',
    userId: 'u1',
    createdAt: 1_000,
    expiresAt: 10_000,
    revokedAt: null,
  });
  assert.equal((await store.getActiveSession('s1', 9_999))?.userId, 'u1');
  assert.equal(await store.getActiveSession('s1', 10_000), null);

  await store.createSession({
    id: 's2',
    userId: 'u1',
    createdAt: 1_000,
    expiresAt: 20_000,
    revokedAt: null,
  });
  assert.equal(await store.revokeSession('s2', 5_000), true);
  assert.equal(await store.getActiveSession('s2', 5_001), null);
});

test('file identity store survives reopen with users and revocation state intact', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forged-identity-'));
  const file = path.join(dir, 'identity.json');
  try {
    const first = await FileIdentityStore.open(file);
    await first.createUser(user());
    await first.createSession({
      id: 's1',
      userId: 'u1',
      createdAt: 1_000,
      expiresAt: 10_000,
      revokedAt: null,
    });
    await first.revokeSession('s1', 5_000);

    const reopened = await FileIdentityStore.open(file);
    assert.equal((await reopened.findUserByUsername('PLAYER_U1'))?.id, 'u1');
    assert.equal((await reopened.findUserByEmail('U1@example.test'))?.id, 'u1');
    assert.equal(await reopened.getActiveSession('s1', 5_001), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
