// ============ WARDS + FOG OF WAR ============
import { WORLD, isWalkable, nearestWalkable } from './map';

export interface Ward {
  x: number; y: number; team: 0 | 1; until: number; kind: 'sentry' | 'normal';
}

// grade de visão: 1 célula = 80px
export const VISION_CELL = 80;
export const VISION_GRID = Math.ceil(WORLD / VISION_CELL);

// visão revelada por cada time (0 ou 1). Bit 0 = azul, bit 1 = vermelho.
// valor 0 = escuro, 1 = azul viu, 2 = vermelho viu, 3 = ambos
export class FogOfWar {
  cells: Uint8Array;
  // cache de "já visto" (memória do terreno)
  seen: Uint8Array;
  constructor() {
    this.cells = new Uint8Array(VISION_GRID * VISION_GRID);
    this.seen = new Uint8Array(VISION_GRID * VISION_GRID);
  }
  idx(cx: number, cy: number) { return cy * VISION_GRID + cx; }
  reveal(x: number, y: number, r: number, team: 0 | 1) {
    const bit = team === 0 ? 1 : 2;
    const c0 = Math.max(0, Math.floor((x - r) / VISION_CELL));
    const c1 = Math.min(VISION_GRID - 1, Math.floor((x + r) / VISION_CELL));
    const r0 = Math.max(0, Math.floor((y - r) / VISION_CELL));
    const r1 = Math.min(VISION_GRID - 1, Math.floor((y + r) / VISION_CELL));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const px = cx * VISION_CELL + VISION_CELL / 2, py = cy * VISION_CELL + VISION_CELL / 2;
      if ((px - x) ** 2 + (py - y) ** 2 <= r * r) {
        this.cells[cy * VISION_GRID + cx] |= bit;
        this.seen[cy * VISION_GRID + cx] |= bit;
      }
    }
  }
  isVisible(x: number, y: number, team: 0 | 1): boolean {
    const cx = Math.floor(x / VISION_CELL), cy = Math.floor(y / VISION_CELL);
    if (cx < 0 || cy < 0 || cx >= VISION_GRID || cy >= VISION_GRID) return false;
    return (this.cells[cy * VISION_GRID + cx] & (team === 0 ? 1 : 2)) !== 0;
  }
  wasSeen(x: number, y: number, team: 0 | 1): boolean {
    const cx = Math.floor(x / VISION_CELL), cy = Math.floor(y / VISION_CELL);
    if (cx < 0 || cy < 0 || cx >= VISION_GRID || cy >= VISION_GRID) return false;
    return (this.seen[cy * VISION_GRID + cx] & (team === 0 ? 1 : 2)) !== 0;
  }
  reset() { this.cells.fill(0); }
}

export function placeWard(x: number, y: number, team: 0 | 1, now: number, kind: 'sentry' | 'normal' = 'normal'): Ward {
  const [wx, wy] = isWalkable(x, y) ? [x, y] : nearestWalkable(x, y);
  return { x: wx, y: wy, team, until: now + (kind === 'sentry' ? 180 : 120), kind };
}
