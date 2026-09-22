export function normalizeSeed(seed: number): number {
  const value = seed >>> 0;
  return value === 0 ? 0x6d2b79f5 : value;
}

/**
 * Xorshift32: pequeno, rápido e, principalmente, reproduzível.
 * Nunca use Math.random() dentro do simulation core autoritativo.
 */
export function nextRng(state: number): { state: number; value: number } {
  let x = normalizeSeed(state);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}

export function rollPermille(state: number, chancePermille: number): { state: number; hit: boolean } {
  const next = nextRng(state);
  const threshold = Math.max(0, Math.min(1000, Math.trunc(chancePermille)));
  return { state: next.state, hit: Math.floor(next.value * 1000) < threshold };
}
