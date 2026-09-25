export type EnvironmentDecorKind = 'vegetation' | 'torch' | 'mist';

export interface EnvironmentDecor {
  id: number;
  kind: EnvironmentDecorKind;
  x: number;
  y: number;
  scale: number;
  phase: number;
}

function next(state: number): { state: number; value: number } {
  let x = state >>> 0 || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const value = (x >>> 0) / 0x1_0000_0000;
  return { state: x >>> 0, value };
}

export function environmentSeed(worldWidth: number, worldHeight: number): number {
  return (
    Math.imul(Math.trunc(worldWidth), 73856093) ^
    Math.imul(Math.trunc(worldHeight), 19349663) ^
    0x6f726765
  ) >>> 0 || 1;
}

export function generateEnvironmentDecor(
  worldWidth: number,
  worldHeight: number,
  count = 160,
): EnvironmentDecor[] {
  const result: EnvironmentDecor[] = [];
  let state = environmentSeed(worldWidth, worldHeight);
  const safeCount = Math.max(0, Math.min(1000, Math.trunc(count)));

  for (let id = 0; id < safeCount; id += 1) {
    const rx = next(state); state = rx.state;
    const ry = next(state); state = ry.state;
    const rt = next(state); state = rt.state;
    const rs = next(state); state = rs.state;
    const rp = next(state); state = rp.state;

    const kind: EnvironmentDecorKind =
      rt.value < 0.67 ? 'vegetation' :
      rt.value < 0.82 ? 'torch' :
      'mist';

    let x = rx.value * worldWidth;
    let y = ry.value * worldHeight;

    // Keep permanent decoration mostly outside the central lane and river.
    const laneY = worldHeight * 0.5;
    const riverX = worldWidth * 0.5;
    if (kind === 'vegetation' && Math.abs(y - laneY) < 170) {
      y = y < laneY ? laneY - 190 - ry.value * 180 : laneY + 190 + ry.value * 180;
    }
    if (kind === 'vegetation' && Math.abs(x - riverX) < 110) {
      x += x < riverX ? -130 : 130;
    }

    result.push({
      id,
      kind,
      x: Math.max(10, Math.min(worldWidth - 10, x)),
      y: Math.max(10, Math.min(worldHeight - 10, y)),
      scale: 0.65 + rs.value * 0.85,
      phase: rp.value * Math.PI * 2,
    });
  }

  return result;
}

export function environmentDecorBudget(
  quality: 'low' | 'medium' | 'high' | 'ultra',
): number {
  if (quality === 'low') return 45;
  if (quality === 'medium') return 90;
  if (quality === 'high') return 150;
  return 230;
}
