import type { SimulationState } from './state';

function stableEntity(state: SimulationState, id: number) {
  const e = state.entities[id];
  if (!e) return null;
  return {
    id: e.id,
    kind: e.kind,
    team: e.team,
    ownerPlayerId: e.ownerPlayerId ?? null,
    position: [round(e.position.x), round(e.position.y)],
    velocity: [round(e.velocity.x), round(e.velocity.y)],
    moveTarget: e.moveTarget ? [round(e.moveTarget.x), round(e.moveTarget.y)] : null,
    hp: round(e.hp),
    maxHp: round(e.maxHp),
    moveSpeed: round(e.moveSpeed),
    attackDamage: round(e.attackDamage),
    attackRange: round(e.attackRange),
    attackCooldownTicks: e.attackCooldownTicks,
    attackCooldownRemaining: e.attackCooldownRemaining,
    attackTargetId: e.attackTargetId,
    dead: e.dead,
    respawnTick: e.respawnTick,
  };
}

function round(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}

export function canonicalState(state: SimulationState): string {
  const entityIds = Object.keys(state.entities).map(Number).sort((a, b) => a - b);
  const players = Object.keys(state.playerEntity).sort();
  return JSON.stringify({
    version: state.version,
    tick: state.tick,
    seed: state.seed,
    rngState: state.rngState,
    nextEntityId: state.nextEntityId,
    worldSize: state.worldSize,
    entities: entityIds.map(id => stableEntity(state, id)),
    playerEntity: players.map(playerId => [playerId, state.playerEntity[playerId]]),
    lastProcessedSeq: Object.keys(state.lastProcessedSeq)
      .sort()
      .map(playerId => [playerId, state.lastProcessedSeq[playerId]]),
  });
}

export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashState(state: SimulationState): string {
  return fnv1a32(canonicalState(state));
}
