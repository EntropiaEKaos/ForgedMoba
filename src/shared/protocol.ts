export type PlayerId = string;
export type EntityId = number;
export type MatchMode = 'duel1v1' | 'skirmish3v3' | 'ranked5v5';
export type RankedRole = 'top' | 'jungle' | 'mid' | 'carry' | 'support';
export type DraftStatus = 'draft' | 'ready' | 'cancelled' | 'launched';

export interface DraftPlayerSnapshot {
  playerId: PlayerId;
  username: string;
  team: 0 | 1;
  slot: number;
  role: RankedRole;
  heroId: string | null;
  ready: boolean;
  connected: boolean;
}

export interface DraftStatePayload {
  draftId: string;
  mode: 'ranked5v5';
  contentVersion: string;
  status: DraftStatus;
  deadlineAt: number;
  players: DraftPlayerSnapshot[];
}

export interface CommandBase {
  playerId: PlayerId;
  seq: number;
  tick: number;
}

export interface MoveCommand extends CommandBase {
  type: 'move';
  x: number;
  y: number;
}

export interface AttackCommand extends CommandBase {
  type: 'attack';
  targetId: EntityId;
}

export interface StopCommand extends CommandBase {
  type: 'stop';
}

export interface CastCommand extends CommandBase {
  type: 'cast';
  slot: 'Q' | 'W' | 'E' | 'R';
  x?: number;
  y?: number;
  targetId?: EntityId;
}

export interface BuyCommand extends CommandBase {
  type: 'buy';
  itemId: string;
}

export interface PlaceWardCommand extends CommandBase {
  type: 'place-ward';
  x: number;
  y: number;
}

export interface UpgradeSkillCommand extends CommandBase {
  type: 'upgrade-skill';
  slot: 'Q' | 'W' | 'E' | 'R';
}

export interface RecallCommand extends CommandBase {
  type: 'recall';
}

export type PlayerCommand =
  | MoveCommand
  | AttackCommand
  | StopCommand
  | CastCommand
  | BuyCommand
  | PlaceWardCommand
  | UpgradeSkillCommand
  | RecallCommand;

export type CoreMovementCommand = MoveCommand | AttackCommand | StopCommand;
export type CoreSimulationCommand = CoreMovementCommand | CastCommand | BuyCommand | PlaceWardCommand;

export interface MatchFoundPayload {
  matchId: string;
  mode: MatchMode;
  team: 0 | 1;
  slot: number;
  playerId: PlayerId;
  contentVersion: string;
  serverTickRate: number;
  reconnectGraceMs: number;
}

export interface InputEnvelope {
  matchId: string;
  command: PlayerCommand;
}

export interface AuthoritativeSnapshot<TState = unknown> {
  matchId: string;
  contentVersion: string;
  serverTick: number;
  ackSeqByPlayer: Record<PlayerId, number>;
  stateHash: string;
  state: TState;
}
