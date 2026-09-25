import type { SimEntity, SimulationState } from '../simulation/types.ts';

export type CombatFxEvent =
  | { type: 'damage'; tick: number; entityId: number; x: number; y: number; amount: number }
  | { type: 'death'; tick: number; entityId: number; x: number; y: number; kind: SimEntity['kind'] }
  | { type: 'q-cast'; tick: number; entityId: number; x: number; y: number; heroId: SimEntity['heroId'] }
  | {
      type: 'status-impact';
      tick: number;
      entityId: number;
      sourceId: number;
      sourceX: number;
      sourceY: number;
      x: number;
      y: number;
      status: 'slow' | 'root' | 'stun';
    }
  | { type: 'objective'; tick: number; team: 0 | 1; x: number; y: number };

export interface VisualEntityProbe {
  hp: number;
  dead: boolean;
  x: number;
  y: number;
  kind: SimEntity['kind'];
  heroId: SimEntity['heroId'];
  qCooldown: number;
  statuses: { kind: string; sourceId: number }[];
}

export interface VisualStateProbe {
  tick: number;
  objectiveScore: [number, number];
  entities: Record<number, VisualEntityProbe>;
}

export function captureVisualProbe(state: SimulationState): VisualStateProbe {
  const entities: Record<number, VisualEntityProbe> = {};
  for (const entity of Object.values(state.entities)) {
    entities[entity.id] = {
      hp: entity.hp,
      dead: entity.dead,
      x: entity.x,
      y: entity.y,
      kind: entity.kind,
      heroId: entity.heroId,
      qCooldown: entity.abilityCooldowns.Q,
      statuses: entity.statuses
        .map((status) => ({ kind: status.kind, sourceId: status.sourceId }))
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceId - b.sourceId),
    };
  }
  return {
    tick: state.tick,
    objectiveScore: [...state.objectiveScore] as [number, number],
    entities,
  };
}

export function deriveCombatFx(
  previous: VisualStateProbe | null,
  current: VisualStateProbe,
): CombatFxEvent[] {
  if (!previous || current.tick <= previous.tick) return [];
  const events: CombatFxEvent[] = [];

  const ids = Object.keys(current.entities).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const now = current.entities[id];
    const before = previous.entities[id];
    if (!before) continue;

    if (now.hp < before.hp) {
      events.push({
        type: 'damage',
        tick: current.tick,
        entityId: id,
        x: now.x,
        y: now.y,
        amount: Math.max(0, before.hp - now.hp),
      });
    }

    if (!before.dead && now.dead) {
      events.push({
        type: 'death',
        tick: current.tick,
        entityId: id,
        x: before.x,
        y: before.y,
        kind: now.kind,
      });
    }

    if (now.kind === 'hero' && now.qCooldown > before.qCooldown + 1) {
      events.push({
        type: 'q-cast',
        tick: current.tick,
        entityId: id,
        x: now.x,
        y: now.y,
        heroId: now.heroId,
      });
    }

    const beforeStatuses = new Set(before.statuses.map((status) => status.kind + ':' + status.sourceId));
    for (const status of now.statuses) {
      if (beforeStatuses.has(status.kind + ':' + status.sourceId)) continue;
      if (status.kind === 'slow' || status.kind === 'root' || status.kind === 'stun') {
        const source = current.entities[status.sourceId];
        events.push({
          type: 'status-impact',
          tick: current.tick,
          entityId: id,
          sourceId: status.sourceId,
          sourceX: source?.x ?? now.x,
          sourceY: source?.y ?? now.y,
          x: now.x,
          y: now.y,
          status: status.kind,
        });
      }
    }
  }

  for (const team of [0, 1] as const) {
    if (current.objectiveScore[team] > previous.objectiveScore[team]) {
      events.push({
        type: 'objective',
        tick: current.tick,
        team,
        x: 1500,
        y: 540,
      });
    }
  }

  return events;
}

export function fxSeed(event: CombatFxEvent): number {
  let seed = (event.tick * 2654435761) >>> 0;
  if ('entityId' in event) seed ^= Math.imul(event.entityId, 2246822519);
  if (event.type === 'objective') seed ^= event.team === 0 ? 0x13579bdf : 0x2468ace0;
  return seed >>> 0 || 1;
}

export function nextVisualRandom(state: number): { state: number; value: number } {
  let x = state >>> 0 || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}
