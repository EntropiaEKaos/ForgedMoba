import type { EntityId, PlayerId, TeamId } from '../shared/protocol.js';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SimEntity {
  id: EntityId;
  kind: 'hero' | 'minion' | 'tower';
  team: TeamId;
  ownerPlayerId?: PlayerId;
  position: Vec2;
  velocity: Vec2;
  moveTarget: Vec2 | null;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldownTicks: number;
  attackCooldownRemaining: number;
  attackTargetId: EntityId | null;
  dead: boolean;
  respawnTick: number | null;
}

export interface SimulationState {
  version: 1;
  tick: number;
  seed: number;
  rngState: number;
  nextEntityId: number;
  worldSize: number;
  entities: Record<EntityId, SimEntity>;
  playerEntity: Record<PlayerId, EntityId>;
  lastProcessedSeq: Record<PlayerId, number>;
}

export function createInitialState(seed: number, worldSize = 3000): SimulationState {
  return {
    version: 1,
    tick: 0,
    seed,
    rngState: seed >>> 0,
    nextEntityId: 1,
    worldSize,
    entities: {},
    playerEntity: {},
    lastProcessedSeq: {},
  };
}
