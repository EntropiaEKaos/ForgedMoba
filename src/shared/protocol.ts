export type PlayerId = string;
export type EntityId = number;
export type TeamId = 0 | 1;

export type InputCommand =
  | { type: 'move'; seq: number; playerId: PlayerId; tick: number; x: number; y: number }
  | { type: 'attack'; seq: number; playerId: PlayerId; tick: number; targetId: EntityId }
  | { type: 'cast'; seq: number; playerId: PlayerId; tick: number; slot: 'Q' | 'W' | 'E' | 'R'; x: number; y: number; targetId?: EntityId }
  | { type: 'buy'; seq: number; playerId: PlayerId; tick: number; itemId: string }
  | { type: 'upgrade'; seq: number; playerId: PlayerId; tick: number; slot: 'Q' | 'W' | 'E' | 'R' }
  | { type: 'recall'; seq: number; playerId: PlayerId; tick: number };

export interface MatchIdentity {
  matchId: string;
  seed: number;
  contentVersion: string;
}

export interface AuthoritativeSnapshot<TState = unknown> {
  matchId: string;
  tick: number;
  ackSeqByPlayer: Record<PlayerId, number>;
  stateHash: string;
  state: TState;
}
