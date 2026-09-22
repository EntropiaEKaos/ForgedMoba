import type { EntityId, PlayerId } from '../shared/protocol.ts';

export const SIM_TICK_RATE = 30;
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;
export const WAVE_INTERVAL_TICKS = SIM_TICK_RATE * 30;

export type SimTeam = 0 | 1;
export type SimEntityKind = 'hero' | 'minion' | 'tower';

export interface SimVec {
  x: number;
  y: number;
}

export interface SimEntity {
  id: EntityId;
  kind: SimEntityKind;
  team: SimTeam;
  ownerPlayerId: PlayerId | null;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  radius: number;
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
  aggroRange: number;
  dead: boolean;
  respawnAtTick: number | null;
  bountyGold: number;
  xpBounty: number;
  level: number;
  xp: number;
  gold: number;
  cs: number;
}

export interface SimulationState {
  version: 2;
  contentVersion: string;
  tick: number;
  seed: number;
  rngState: number;
  width: number;
  height: number;
  nextEntityId: number;
  entities: Record<string, SimEntity>;
  score: [number, number];
  lastAcceptedSeq: Record<PlayerId, number>;
  laneEnabled: boolean;
  nextWaveTick: number | null;
  waveNumber: number;
  winner: SimTeam | null;
}

export interface SimulationPlayerSeed {
  playerId: PlayerId;
  team: SimTeam;
  x: number;
  y: number;
}

export interface CreateSimulationOptions {
  seed: number;
  contentVersion?: string;
  width?: number;
  height?: number;
  players: SimulationPlayerSeed[];
  withLane?: boolean;
}
