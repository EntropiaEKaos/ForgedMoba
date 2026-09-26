import type { SimEntity, SimulationState } from '../simulation/types.ts';

export type CombatFxEvent =
  | { type: 'damage'; tick: number; entityId: number; x: number; y: number; amount: number }
  | { type: 'heal'; tick: number; entityId: number; x: number; y: number; amount: number }
  | { type: 'death'; tick: number; entityId: number; x: number; y: number; kind: SimEntity['kind'] }
  | { type: 'basic-attack'; tick: number; entityId: number; targetId: number; sourceX: number; sourceY: number; x: number; y: number; heroId: SimEntity['heroId'] }
  | { type: 'q-cast'; tick: number; entityId: number; x: number; y: number; heroId: SimEntity['heroId'] }
  | { type: 'ability-cast'; tick: number; entityId: number; x: number; y: number; heroId: SimEntity['heroId']; slot: 'W' | 'E' | 'R' }
  | { type: 'level-up'; tick: number; entityId: number; x: number; y: number; level: number }
  | { type: 'item-equip'; tick: number; entityId: number; x: number; y: number; itemId: string }
  | { type: 'ward-spawn'; tick: number; entityId: number; x: number; y: number; team: 0 | 1 }
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
  abilityCooldowns: { Q: number; W: number; E: number; R: number };
  attackCooldown: number;
  attackTargetId: number | null;
  level: number;
  inventory: string[];
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
      abilityCooldowns: { ...entity.abilityCooldowns },
      attackCooldown: entity.attackCooldownRemaining,
      attackTargetId: entity.attackTargetId,
      level: entity.level,
      inventory: [...entity.inventory],
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
    if (!before) {
      if (now.kind === 'ward') {
        events.push({
          type: 'ward-spawn',
          tick: current.tick,
          entityId: id,
          x: now.x,
          y: now.y,
          team: now.team,
        });
      }
      continue;
    }

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

    if (now.hp > before.hp && !now.dead) {
      events.push({
        type: 'heal',
        tick: current.tick,
        entityId: id,
        x: now.x,
        y: now.y,
        amount: Math.max(0, now.hp - before.hp),
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

    if (now.kind === 'hero') {
      if (now.qCooldown > before.qCooldown + 1) {
        events.push({
          type: 'q-cast',
          tick: current.tick,
          entityId: id,
          x: now.x,
          y: now.y,
          heroId: now.heroId,
        });
      }
      for (const slot of ['W', 'E', 'R'] as const) {
        if (now.abilityCooldowns[slot] > before.abilityCooldowns[slot] + 1) {
          events.push({
            type: 'ability-cast',
            tick: current.tick,
            entityId: id,
            x: now.x,
            y: now.y,
            heroId: now.heroId,
            slot,
          });
        }
      }
      if (now.attackCooldown > before.attackCooldown + 1 && now.attackTargetId !== null) {
        const target = current.entities[now.attackTargetId];
        if (target) {
          events.push({
            type: 'basic-attack',
            tick: current.tick,
            entityId: id,
            targetId: now.attackTargetId,
            sourceX: now.x,
            sourceY: now.y,
            x: target.x,
            y: target.y,
            heroId: now.heroId,
          });
        }
      }
      if (now.level > before.level) {
        events.push({
          type: 'level-up',
          tick: current.tick,
          entityId: id,
          x: now.x,
          y: now.y,
          level: now.level,
        });
      }

      const beforeCounts = new Map<string, number>();
      for (const item of before.inventory) beforeCounts.set(item, (beforeCounts.get(item) ?? 0) + 1);
      for (const itemId of now.inventory) {
        const count = beforeCounts.get(itemId) ?? 0;
        if (count > 0) {
          beforeCounts.set(itemId, count - 1);
          continue;
        }
        events.push({
          type: 'item-equip',
          tick: current.tick,
          entityId: id,
          x: now.x,
          y: now.y,
          itemId,
        });
      }
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
