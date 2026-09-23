import type { CoreSimulationCommand, PlayerId } from '../../src/shared/protocol.ts';
import {
  CURRENT_AUTHORITATIVE_CONTENT,
  type AuthoritativeHeroId,
  type PublishedAuthoritativeContent,
} from '../../src/shared/authoritativeContent.ts';
import {
  createSimulation,
  hashSimulationState,
  stepSimulation,
  type SimulationState,
} from '../../src/simulation/index.ts';

export interface MatchReplayPlayer {
  playerId: PlayerId;
  team: 0 | 1;
  slot: number;
  heroId?: AuthoritativeHeroId;
  x: number;
  y: number;
}

export interface MatchReplayFrame {
  tick: number;
  commands: CoreSimulationCommand[];
}

export interface MatchReplayTerminal {
  type: 'forfeit-team';
  team: 0 | 1;
  tick: number;
}

export interface MatchReplayRecord {
  schemaVersion: 1;
  matchId: string;
  contentVersion: string;
  seed: number;
  players: MatchReplayPlayer[];
  frames: MatchReplayFrame[];
  finalTick: number;
  winner: 0 | 1 | null;
  finalHash: string;
  terminal: MatchReplayTerminal | null;
}

export interface ReplayVerification {
  ok: boolean;
  finalHash: string;
  expectedHash: string;
  state: SimulationState;
}

export function replayMatchRecord(
  record: MatchReplayRecord,
  content: PublishedAuthoritativeContent = CURRENT_AUTHORITATIVE_CONTENT,
): ReplayVerification {
  if (record.schemaVersion !== 1) throw new Error('unsupported replay schema');
  if (record.contentVersion !== content.contentVersion) {
    throw new Error(
      'replay content mismatch: expected ' + content.contentVersion +
      ', received ' + record.contentVersion,
    );
  }

  const state = createSimulation({
    seed: record.seed,
    contentVersion: record.contentVersion,
    withLane: true,
    withJungle: true,
    players: record.players.map((player) => ({
      playerId: player.playerId,
      team: player.team,
      heroId: player.heroId,
      x: player.x,
      y: player.y,
    })),
  }, content.payload);

  const byTick = new Map<number, CoreSimulationCommand[]>();
  for (const frame of record.frames) {
    if (!Number.isInteger(frame.tick) || frame.tick < 0) throw new Error('invalid replay frame tick');
    byTick.set(frame.tick, structuredClone(frame.commands));
  }

  while (state.tick < record.finalTick) {
    const commands = byTick.get(state.tick) ?? [];
    stepSimulation(state, commands, content.payload);
    if (state.winner !== null && state.tick < record.finalTick) {
      throw new Error('replay reached terminal simulation state before recorded finalTick');
    }
  }

  if (record.terminal?.type === 'forfeit-team') {
    if (record.terminal.tick !== state.tick) throw new Error('forfeit tick mismatch');
    state.winner = record.terminal.team === 0 ? 1 : 0;
  }

  const finalHash = hashSimulationState(state);
  return {
    ok: finalHash === record.finalHash && state.winner === record.winner,
    finalHash,
    expectedHash: record.finalHash,
    state,
  };
}
