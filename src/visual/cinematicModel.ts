import type { SimEntity, SimulationState } from '../simulation/types.ts';

interface EntityProbe {
  id: number;
  kind: SimEntity['kind'];
  team: SimEntity['team'];
  ownerPlayerId: string | null;
  level: number;
  dead: boolean;
  x: number;
  y: number;
}

export interface CinematicProbe {
  tick: number;
  width: number;
  height: number;
  score: readonly [number, number];
  objectiveScore: readonly [number, number];
  entities: Readonly<Record<number, EntityProbe>>;
}

export type CinematicEvent =
  | {
      type: 'ace';
      key: string;
      tick: number;
      team: 0 | 1;
      x: number;
      y: number;
    }
  | {
      type: 'hero-kill';
      key: string;
      tick: number;
      team: 0 | 1;
      victimId: number | null;
      x: number;
      y: number;
    }
  | {
      type: 'objective-kill';
      key: string;
      tick: number;
      team: 0 | 1;
      entityId: number | null;
      x: number;
      y: number;
    }
  | {
      type: 'tower-destroyed';
      key: string;
      tick: number;
      team: 0 | 1;
      entityId: number;
      x: number;
      y: number;
    }
  | {
      type: 'level-up';
      key: string;
      tick: number;
      team: 0 | 1;
      entityId: number;
      ownerPlayerId: string | null;
      level: number;
      x: number;
      y: number;
    }
  | {
      type: 'respawn';
      key: string;
      tick: number;
      team: 0 | 1;
      entityId: number;
      ownerPlayerId: string | null;
      x: number;
      y: number;
    };

export interface CinematicCameraCue {
  x: number;
  y: number;
  durationMs: number;
  zoomBoost: number;
  priority: number;
}

export function captureCinematicProbe(state: SimulationState): CinematicProbe {
  const entities: Record<number, EntityProbe> = {};
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (
      entity.kind !== 'hero' &&
      entity.kind !== 'tower' &&
      entity.kind !== 'objective'
    ) continue;
    entities[entity.id] = {
      id: entity.id,
      kind: entity.kind,
      team: entity.team,
      ownerPlayerId: entity.ownerPlayerId,
      level: entity.level,
      dead: entity.dead,
      x: entity.x,
      y: entity.y,
    };
  }
  return {
    tick: state.tick,
    width: state.width,
    height: state.height,
    score: [state.score[0], state.score[1]],
    objectiveScore: [state.objectiveScore[0], state.objectiveScore[1]],
    entities,
  };
}

function newlyDead(
  previous: CinematicProbe,
  current: CinematicProbe,
  kind: EntityProbe['kind'],
): EntityProbe[] {
  return Object.values(current.entities)
    .filter((entity) => {
      if (entity.kind !== kind || !entity.dead) return false;
      const before = previous.entities[entity.id];
      return Boolean(before && !before.dead);
    })
    .sort((a, b) => a.id - b.id);
}

export function deriveCinematicEvents(
  previous: CinematicProbe | null,
  current: CinematicProbe,
): CinematicEvent[] {
  if (!previous || current.tick <= previous.tick) return [];

  const events: CinematicEvent[] = [];
  const center = { x: current.width / 2, y: current.height / 2 };

  const deadHeroes = newlyDead(previous, current, 'hero');
  for (const team of [0, 1] as const) {
    const delta = current.score[team] - previous.score[team];
    if (delta <= 0) continue;

    const victims = deadHeroes.filter((entity) => entity.team !== team);
    for (let i = 0; i < delta; i += 1) {
      const victim = victims[i] ?? victims.at(-1) ?? null;
      events.push({
        type: 'hero-kill',
        key: 'kill:' + current.tick + ':' + team + ':' + (victim?.id ?? i),
        tick: current.tick,
        team,
        victimId: victim?.id ?? null,
        x: victim?.x ?? center.x,
        y: victim?.y ?? center.y,
      });
    }
  }

  for (const team of [0, 1] as const) {
    if (current.score[team] <= previous.score[team]) continue;
    const enemyHeroes = Object.values(current.entities)
      .filter((entity) => entity.kind === 'hero' && entity.team !== team)
      .sort((a, b) => a.id - b.id);
    if (enemyHeroes.length < 3 || !enemyHeroes.every((entity) => entity.dead)) continue;
    const x = enemyHeroes.reduce((sum, entity) => sum + entity.x, 0) / enemyHeroes.length;
    const y = enemyHeroes.reduce((sum, entity) => sum + entity.y, 0) / enemyHeroes.length;
    events.push({
      type: 'ace',
      key: 'ace:' + current.tick + ':' + team,
      tick: current.tick,
      team,
      x,
      y,
    });
  }

  const objectives = Object.values(current.entities)
    .filter((entity) => entity.kind === 'objective')
    .sort((a, b) => a.id - b.id);
  const deadObjectives = newlyDead(previous, current, 'objective');

  for (const team of [0, 1] as const) {
    const delta = current.objectiveScore[team] - previous.objectiveScore[team];
    if (delta <= 0) continue;
    for (let i = 0; i < delta; i += 1) {
      const objective = deadObjectives[i] ?? deadObjectives.at(-1) ?? objectives[0] ?? null;
      events.push({
        type: 'objective-kill',
        key: 'objective:' + current.tick + ':' + team + ':' + (objective?.id ?? i),
        tick: current.tick,
        team,
        entityId: objective?.id ?? null,
        x: objective?.x ?? center.x,
        y: objective?.y ?? center.y,
      });
    }
  }

  for (const tower of newlyDead(previous, current, 'tower')) {
    events.push({
      type: 'tower-destroyed',
      key: 'tower:' + current.tick + ':' + tower.id,
      tick: current.tick,
      team: tower.team === 0 ? 1 : 0,
      entityId: tower.id,
      x: tower.x,
      y: tower.y,
    });
  }

  for (const entity of Object.values(current.entities).sort((a, b) => a.id - b.id)) {
    if (entity.kind !== 'hero') continue;
    const before = previous.entities[entity.id];
    if (!before) continue;

    if (entity.level > before.level) {
      events.push({
        type: 'level-up',
        key: 'level:' + current.tick + ':' + entity.id + ':' + entity.level,
        tick: current.tick,
        team: entity.team,
        entityId: entity.id,
        ownerPlayerId: entity.ownerPlayerId,
        level: entity.level,
        x: entity.x,
        y: entity.y,
      });
    }

    if (before.dead && !entity.dead) {
      events.push({
        type: 'respawn',
        key: 'respawn:' + current.tick + ':' + entity.id,
        tick: current.tick,
        team: entity.team,
        entityId: entity.id,
        ownerPlayerId: entity.ownerPlayerId,
        x: entity.x,
        y: entity.y,
      });
    }
  }

  return events.sort((a, b) => eventPriority(b) - eventPriority(a) || a.key.localeCompare(b.key));
}

export function eventPriority(event: CinematicEvent): number {
  if (event.type === 'objective-kill') return 100;
  if (event.type === 'ace') return 90;
  if (event.type === 'tower-destroyed') return 80;
  if (event.type === 'hero-kill') return 70;
  if (event.type === 'level-up') return 50;
  return 30;
}

export function eventDurationMs(event: CinematicEvent): number {
  if (event.type === 'objective-kill') return 2200;
  if (event.type === 'ace') return 2000;
  if (event.type === 'tower-destroyed') return 1700;
  if (event.type === 'hero-kill') return 1450;
  if (event.type === 'level-up') return 1250;
  return 900;
}

export function cameraCueForEvent(
  event: CinematicEvent,
  localPlayerId?: string,
): CinematicCameraCue | null {
  if (
    (event.type === 'level-up' || event.type === 'respawn') &&
    event.ownerPlayerId !== localPlayerId
  ) return null;

  return {
    x: event.x,
    y: event.y,
    durationMs:
      event.type === 'objective-kill' ? 1050 :
      event.type === 'ace' ? 920 :
      event.type === 'tower-destroyed' ? 850 :
      event.type === 'hero-kill' ? 620 :
      500,
    zoomBoost:
      event.type === 'objective-kill' ? 0.16 :
      event.type === 'ace' ? 0.14 :
      event.type === 'tower-destroyed' ? 0.12 :
      event.type === 'hero-kill' ? 0.08 :
      0.06,
    priority: eventPriority(event),
  };
}

export class CinematicObserver {
  private previous: CinematicProbe | null = null;

  reset(state?: SimulationState): void {
    this.previous = state ? captureCinematicProbe(state) : null;
  }

  observe(state: SimulationState): CinematicEvent[] {
    const current = captureCinematicProbe(state);
    if (this.previous && current.tick < this.previous.tick) {
      this.previous = current;
      return [];
    }
    const events = deriveCinematicEvents(this.previous, current);
    this.previous = current;
    return events;
  }
}
