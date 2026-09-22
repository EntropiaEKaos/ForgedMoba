import type { EntityId, PlayerId } from '../shared/protocol.ts';

export const SIM_TICK_RATE = 30;
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

export type SimTeam = 0 | 1;

export interface SimVec {
  x: number;
  y: number;
}

export interface SimEntity {
  id: EntityId;
  kind: 'hero';
  team: SimTeam;
  ownerPlayerId: PlayerId;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  moveTarget: SimVec | null;
  attackTargetId: EntityId | null;
  hp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  attackCooldownTicks: number;
  attackCooldownRemaining: number;
  moveSpeedPerTick: number;
  critChancePermille: number;
  dead: boolean;
  respawnAtTick: number | null;
}

export interface SimulationState {
  version: 1;
  tick: number;
  seed: number;
  rngState: number;
  width: number;
  height: number;
  nextEntityId: number;
  entities: Record<string, SimEntity>;
  score: [number, number];
  lastAcceptedSeq: Record<PlayerId, number>;
}

export interface SimulationPlayerSeed {
  playerId: PlayerId;
  team: SimTeam;
  x: number;
  y: number;
}

export interface CreateSimulationOptions {
  seed: number;
  width?: number;
  height?: number;
  players: SimulationPlayerSeed[];
}
