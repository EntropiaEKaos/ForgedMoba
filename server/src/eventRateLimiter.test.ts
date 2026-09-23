import assert from 'node:assert/strict';
import test from 'node:test';
import { EventRateLimiter } from './eventRateLimiter.ts';

test('token bucket allows burst up to capacity then rejects', () => {
  const limiter = new EventRateLimiter();
  const policy = { capacity: 3, refillPerSecond: 1 };
  assert.equal(limiter.allow('socket:game', policy, 1_000), true);
  assert.equal(limiter.allow('socket:game', policy, 1_000), true);
  assert.equal(limiter.allow('socket:game', policy, 1_000), true);
  assert.equal(limiter.allow('socket:game', policy, 1_000), false);
});

test('token bucket refills deterministically with elapsed time', () => {
  const limiter = new EventRateLimiter();
  const policy = { capacity: 2, refillPerSecond: 2 };
  assert.equal(limiter.allow('socket:game', policy, 1_000), true);
  assert.equal(limiter.allow('socket:game', policy, 1_000), true);
  assert.equal(limiter.allow('socket:game', policy, 1_249), false);
  assert.equal(limiter.allow('socket:game', policy, 1_500), true);
});

test('clearPrefix removes all buckets owned by a disconnected socket', () => {
  const limiter = new EventRateLimiter();
  limiter.allow('s1:game', { capacity: 1, refillPerSecond: 1 }, 1_000);
  limiter.allow('s1:draft', { capacity: 1, refillPerSecond: 1 }, 1_000);
  limiter.allow('s2:game', { capacity: 1, refillPerSecond: 1 }, 1_000);
  limiter.clearPrefix('s1:');
  assert.equal(limiter.size, 1);
});
