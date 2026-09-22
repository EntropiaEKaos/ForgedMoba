export type PlayerId = string;
export type EntityId = number;

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
  | UpgradeSkillCommand
  | RecallCommand;

export type CoreMovementCommand = MoveCommand | AttackCommand | StopCommand;

export interface MatchFoundPayload {
  matchId: string;
  team: 0 | 1;
  slot: number;
  playerId: PlayerId;
  contentVersion: string;
  serverTickRate: number;
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
