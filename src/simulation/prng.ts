/**
 * Small deterministic PRNG for simulation-only randomness.
 * Never replace this with Math.random() inside authoritative simulation code.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  nextUint32(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  next(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('SeededRng.pick requires a non-empty array');
    return values[Math.floor(this.next() * values.length)]!;
  }

  snapshot(): number {
    return this.state >>> 0;
  }

  restore(state: number): void {
    this.state = state >>> 0;
  }
}
