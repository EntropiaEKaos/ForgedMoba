import type { EntityId, PlayerId } from '../shared/protocol.ts';

export const SIM_TICK_RATE = 30;
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;
export const WAVE_INTERVAL_TICKS = SIM_TICK_RATE * 30;

export type SimTeam = 0 | 1;
export type SimEntityKind = 'hero' | 'minion' | 'tower' | 'monster' | 'objective' | 'ward';
export type SimHeroId = string;
export type SimAbilitySlot = 'Q' | 'W' | 'E' | 'R';
export type SimStatusKind = 'stun' | 'root' | 'slow' | 'silence' | 'haste' | 'damage-reduction';

export interface SimVec {
  x: number;
  y: number;
}

export interface SimStatus {
  kind: SimStatusKind;
  sourceId: EntityId;
  expiresAtTick: number;
  magnitudePermille: number;
}

export interface SimEntity {
  id: EntityId;
  kind: SimEntityKind;
  team: SimTeam;
  ownerPlayerId: PlayerId | null;
  heroId: SimHeroId | null;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  radius: number;
  moveTarget: SimVec | null;
  attackTargetId: EntityId | null;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  shieldHp: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  magicPenPermille: number;
  attackRange: number;
  baseAttackCooldownTicks: number;
  attackCooldownTicks: number;
  attackCooldownRemaining: number;
  attackSpeedPermille: number;
  abilityCooldowns: Record<SimAbilitySlot, number>;
  moveSpeedPerTick: number;
  critChancePermille: number;
  lifestealPermille: number;
  hpRegenPerSecond: number;
  manaRegenPerSecond: number;
  aggroRange: number;
  statuses: SimStatus[];
  towerAggroUntilTick: number;
  neutral: boolean;
  campId: string | null;
  leashRadius: number;
  visionRadius: number;
  expiresAtTick: number | null;
  wardCooldownRemaining: number;
  dead: boolean;
  respawnAtTick: number | null;
  bountyGold: number;
  xpBounty: number;
  level: number;
  xp: number;
  gold: number;
  inventory: string[];
  cs: number;
}

export interface SimulationState {
  version: 4;
  contentVersion: string;
  tick: number;
  seed: number;
  rngState: number;
  width: number;
  height: number;
  nextEntityId: number;
  entities: Record<string, SimEntity>;
  score: [number, number];
  objectiveScore: [number, number];
  lastAcceptedSeq: Record<PlayerId, number>;
  laneEnabled: boolean;
  jungleEnabled: boolean;
  nextWaveTick: number | null;
  waveNumber: number;
  winner: SimTeam | null;
}

export interface SimulationPlayerSeed {
  playerId: PlayerId;
  team: SimTeam;
  x: number;
  y: number;
  heroId?: SimHeroId;
}

export interface CreateSimulationOptions {
  seed: number;
  contentVersion?: string;
  width?: number;
  height?: number;
  players: SimulationPlayerSeed[];
  withLane?: boolean;
  withJungle?: boolean;
}
