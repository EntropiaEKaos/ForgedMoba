import type { EntityId } from '../shared/protocol.ts';
import type { SimEntity } from './types.ts';

export interface SpatialHash {
  cellSize: number;
  cells: Map<string, EntityId[]>;
}

function key(cx: number, cy: number): string {
  return cx + ':' + cy;
}

export function buildSpatialHash(entities: Record<string, SimEntity>, cellSize = 128): SpatialHash {
  const size = Math.max(16, Math.trunc(cellSize));
  const cells = new Map<string, EntityId[]>();
  const ids = Object.keys(entities).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const entity = entities[String(id)];
    if (entity.dead) continue;
    const cx = Math.floor(entity.x / size);
    const cy = Math.floor(entity.y / size);
    const k = key(cx, cy);
    const bucket = cells.get(k);
    if (bucket) bucket.push(id);
    else cells.set(k, [id]);
  }
  return { cellSize: size, cells };
}

export function querySpatialHash(index: SpatialHash, x: number, y: number, radius: number): EntityId[] {
  const minX = Math.floor((x - radius) / index.cellSize);
  const maxX = Math.floor((x + radius) / index.cellSize);
  const minY = Math.floor((y - radius) / index.cellSize);
  const maxY = Math.floor((y + radius) / index.cellSize);
  const result: EntityId[] = [];

  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const bucket = index.cells.get(key(cx, cy));
      if (bucket) result.push(...bucket);
    }
  }

  result.sort((a, b) => a - b);
  return result;
}
