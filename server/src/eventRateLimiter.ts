export interface EventRatePolicy {
  capacity: number;
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  updatedAtMs: number;
}

function normalizePolicy(policy: EventRatePolicy): EventRatePolicy {
  return {
    capacity: Math.max(1, Math.trunc(policy.capacity)),
    refillPerSecond: Math.max(0.001, policy.refillPerSecond),
  };
}

export class EventRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  allow(key: string, policyInput: EventRatePolicy, nowMs = Date.now()): boolean {
    const policy = normalizePolicy(policyInput);
    const now = Math.max(0, Math.trunc(nowMs));
    const previous = this.buckets.get(key);
    if (!previous) {
      this.buckets.set(key, { tokens: policy.capacity - 1, updatedAtMs: now });
      return true;
    }

    const elapsedMs = Math.max(0, now - previous.updatedAtMs);
    const refill = elapsedMs * policy.refillPerSecond / 1000;
    previous.tokens = Math.min(policy.capacity, previous.tokens + refill);
    previous.updatedAtMs = now;

    if (previous.tokens < 1) return false;
    previous.tokens -= 1;
    return true;
  }

  clearPrefix(prefix: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix)) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
