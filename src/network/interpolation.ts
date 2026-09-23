import type { AuthoritativeSnapshot } from '../shared/protocol.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';

export interface InterpolatedEntity {
  id: number;
  kind: SimEntity['kind'];
  team: SimEntity['team'];
  ownerPlayerId: string | null;
  heroId: SimEntity['heroId'];
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export interface InterpolatedFrame {
  renderTick: number;
  fromTick: number;
  toTick: number;
  alpha: number;
  entities: InterpolatedEntity[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toEntity(entity: SimEntity): InterpolatedEntity {
  return {
    id: entity.id,
    kind: entity.kind,
    team: entity.team,
    ownerPlayerId: entity.ownerPlayerId,
    heroId: entity.heroId,
    x: entity.x,
    y: entity.y,
    hp: entity.hp,
    maxHp: entity.maxHp,
    dead: entity.dead,
  };
}

export class SnapshotInterpolationBuffer {
  private readonly capacity: number;
  private snapshots: AuthoritativeSnapshot<SimulationState>[] = [];

  constructor(capacity = 20) {
    this.capacity = Math.max(2, Math.trunc(capacity));
  }

  clear(): void {
    this.snapshots = [];
  }

  push(snapshot: AuthoritativeSnapshot<SimulationState>): void {
    const copy = structuredClone(snapshot);
    const existing = this.snapshots.findIndex((entry) => entry.serverTick === copy.serverTick);
    if (existing >= 0) this.snapshots[existing] = copy;
    else this.snapshots.push(copy);
    this.snapshots.sort((a, b) => a.serverTick - b.serverTick);
    if (this.snapshots.length > this.capacity) {
      this.snapshots.splice(0, this.snapshots.length - this.capacity);
    }
  }

  sample(renderTick: number): InterpolatedFrame | null {
    if (this.snapshots.length === 0) return null;
    const tick = Number.isFinite(renderTick) ? renderTick : this.snapshots[this.snapshots.length - 1].serverTick;

    let before = this.snapshots[0];
    let after = this.snapshots[this.snapshots.length - 1];

    for (let i = 0; i < this.snapshots.length; i += 1) {
      const snapshot = this.snapshots[i];
      if (snapshot.serverTick <= tick) before = snapshot;
      if (snapshot.serverTick >= tick) {
        after = snapshot;
        break;
      }
    }

    const span = Math.max(1, after.serverTick - before.serverTick);
    const alpha = before.serverTick === after.serverTick ? 0 : clamp01((tick - before.serverTick) / span);
    const ids = new Set([...Object.keys(before.state.entities), ...Object.keys(after.state.entities)]);
    const entities = [...ids]
      .map(Number)
      .sort((a, b) => a - b)
      .map((id): InterpolatedEntity | null => {
        const a = before.state.entities[String(id)];
        const b = after.state.entities[String(id)];
        if (!a && !b) return null;
        if (!a) return toEntity(b);
        if (!b) return toEntity(a);
        return {
          id,
          kind: b.kind,
          team: b.team,
          ownerPlayerId: b.ownerPlayerId,
          heroId: b.heroId,
          x: a.x + (b.x - a.x) * alpha,
          y: a.y + (b.y - a.y) * alpha,
          hp: a.hp + (b.hp - a.hp) * alpha,
          maxHp: b.maxHp,
          dead: alpha < 0.5 ? a.dead : b.dead,
        };
      })
      .filter((entity): entity is InterpolatedEntity => entity !== null);

    return {
      renderTick: tick,
      fromTick: before.serverTick,
      toTick: after.serverTick,
      alpha,
      entities,
    };
  }

  get latestTick(): number | null {
    return this.snapshots.at(-1)?.serverTick ?? null;
  }

  get size(): number {
    return this.snapshots.length;
  }
}
