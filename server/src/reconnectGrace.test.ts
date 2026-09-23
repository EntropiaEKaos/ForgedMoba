import assert from 'node:assert/strict';
import test from 'node:test';
import { ReconnectGraceRegistry } from './reconnectGrace.ts';

test('reconnect grace expires only after the configured deadline', () => {
  const registry = new ReconnectGraceRegistry(30_000);
  const lease = registry.markDisconnected('m1', 'blue-1', 0, 1_000);
  assert.equal(lease.expiresAt, 31_000);
  assert.deepEqual(registry.consumeExpired(30_999), []);
  assert.equal(registry.size, 1);
  assert.deepEqual(registry.consumeExpired(31_000), [lease]);
  assert.equal(registry.size, 0);
});

test('reconnect cancels the pending disconnect lease', () => {
  const registry = new ReconnectGraceRegistry(30_000);
  registry.markDisconnected('m1', 'blue-1', 0, 1_000);
  assert.equal(registry.resolveReconnect('m1', 'blue-1', 20_000), 'reconnected');
  assert.deepEqual(registry.consumeExpired(100_000), []);
});

test('clearMatch removes every lease owned by the completed match only', () => {
  const registry = new ReconnectGraceRegistry(30_000);
  registry.markDisconnected('m1', 'a', 0, 1_000);
  registry.markDisconnected('m1', 'b', 1, 1_000);
  registry.markDisconnected('m2', 'c', 0, 1_000);
  registry.clearMatch('m1');
  assert.equal(registry.get('m1', 'a'), null);
  assert.equal(registry.get('m1', 'b'), null);
  assert.ok(registry.get('m2', 'c'));
});


test('forMatch returns active leases in stable deadline/player order', () => {
  const registry = new ReconnectGraceRegistry(30_000);
  registry.markDisconnected('m1', 'z-player', 0, 2_000);
  registry.markDisconnected('m1', 'a-player', 1, 1_000);
  registry.markDisconnected('m2', 'other', 0, 500);
  assert.deepEqual(
    registry.forMatch('m1').map((lease) => lease.playerId),
    ['a-player', 'z-player'],
  );
});


test('resume at or after deadline is rejected even before the sweep runs', () => {
  const registry = new ReconnectGraceRegistry(30_000);
  registry.markDisconnected('m1', 'blue-1', 0, 1_000);
  assert.equal(registry.resolveReconnect('m1', 'blue-1', 31_000), 'expired');
  assert.equal(registry.size, 0);
});
