import type {
  AuthoritativeSnapshot,
  CoreSimulationCommand,
  PlayerCommand,
  PlayerId,
} from '../../src/shared/protocol.ts';
import {
  CURRENT_AUTHORITATIVE_CONTENT,
  type AuthoritativeHeroId,
  type PublishedAuthoritativeContent,
} from '../../src/shared/authoritativeContent.ts';
import {
  SIM_TICK_RATE,
  createSimulation,
  hashSimulationState,
  stepSimulation,
  type SimulationState,
} from '../../src/simulation/index.ts';

export type MatchInputRejectCode =
  | 'unknown-player'
  | 'unsupported-command'
  | 'invalid-command'
  | 'invalid-seq'
  | 'stale-tick'
  | 'future-tick';

export type MatchInputResult = { ok: true } | { ok: false; code: MatchInputRejectCode };

export interface MatchRunnerPlayer {
  playerId: PlayerId;
  team: 0 | 1;
  slot: number;
  heroId?: AuthoritativeHeroId;
}

export interface MatchRunnerOptions {
  matchId: string;
  contentVersion: string;
  seed: number;
  players: MatchRunnerPlayer[];
  snapshotEveryTicks?: number;
  content?: PublishedAuthoritativeContent;
  onSnapshot?: (snapshot: AuthoritativeSnapshot<SimulationState>) => void;
  onComplete?: (state: SimulationState) => void;
}

function finiteInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function normalizeCoreCommand(playerId: PlayerId, raw: PlayerCommand): CoreSimulationCommand | null {
  const seq = finiteInt(raw.seq);
  const tick = finiteInt(raw.tick);
  if (seq === null || seq < 0 || tick === null || tick < 0) return null;
  if (raw.type === 'move') {
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
    return { type: 'move', playerId, seq, tick, x: Math.trunc(raw.x), y: Math.trunc(raw.y) };
  }
  if (raw.type === 'attack') {
    const targetId = finiteInt(raw.targetId);
    if (targetId === null || targetId <= 0) return null;
    return { type: 'attack', playerId, seq, tick, targetId };
  }
  if (raw.type === 'stop') return { type: 'stop', playerId, seq, tick };
  if (raw.type === 'buy') {
    if (typeof raw.itemId !== 'string' || raw.itemId.length === 0 || raw.itemId.length > 64) return null;
    return { type: 'buy', playerId, seq, tick, itemId: raw.itemId };
  }
  if (raw.type === 'place-ward') {
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
    return {
      type: 'place-ward',
      playerId,
      seq,
      tick,
      x: Math.trunc(raw.x),
      y: Math.trunc(raw.y),
    };
  }
  if (raw.type === 'cast') {
    if (!['Q', 'W', 'E', 'R'].includes(raw.slot)) return null;
    let targetId: number | undefined;
    if (raw.targetId !== undefined) {
      const parsedTargetId = finiteInt(raw.targetId);
      if (parsedTargetId === null || parsedTargetId <= 0) return null;
      targetId = parsedTargetId;
    }
    if (raw.x !== undefined && !Number.isFinite(raw.x)) return null;
    if (raw.y !== undefined && !Number.isFinite(raw.y)) return null;
    return {
      type: 'cast',
      playerId,
      seq,
      tick,
      slot: raw.slot,
      x: raw.x === undefined ? undefined : Math.trunc(raw.x),
      y: raw.y === undefined ? undefined : Math.trunc(raw.y),
      targetId: targetId ?? undefined,
    };
  }
  return null;
}

function spawnFor(team: 0 | 1, slot: number): { x: number; y: number } {
  const baseX = team === 0 ? 720 : 2280;
  const baseY = 1500;
  const row = Math.floor(slot / 3);
  const column = slot % 3;
  return {
    x: baseX + (team === 0 ? column * 18 : -column * 18),
    y: baseY + (row * 2 + (column % 2 === 0 ? -1 : 1)) * 24,
  };
}

export function stableSeedFromMatchId(matchId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < matchId.length; i += 1) {
    hash ^= matchId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

export class MatchRunner {
  readonly state: SimulationState;
  readonly matchId: string;
  readonly contentVersion: string;
  readonly snapshotEveryTicks: number;

  private readonly content: PublishedAuthoritativeContent;
  private readonly playerIds: Set<PlayerId>;
  private readonly playerTeams = new Map<PlayerId, 0 | 1>();
  private readonly queued = new Map<number, CoreSimulationCommand[]>();
  private readonly lastQueuedSeq = new Map<PlayerId, number>();
  private readonly onSnapshot?: MatchRunnerOptions['onSnapshot'];
  private readonly onComplete?: MatchRunnerOptions['onComplete'];
  private timer: ReturnType<typeof setInterval> | null = null;
  private completed = false;

  constructor(options: MatchRunnerOptions) {
    this.matchId = options.matchId;
    this.content = options.content ?? CURRENT_AUTHORITATIVE_CONTENT;
    this.contentVersion = options.contentVersion;
    if (this.contentVersion !== this.content.contentVersion) {
      throw new Error(
        'MatchRunner content mismatch: expected ' + this.content.contentVersion +
        ', received ' + this.contentVersion,
      );
    }
    this.snapshotEveryTicks = Math.max(1, Math.trunc(options.snapshotEveryTicks ?? 3));
    this.playerIds = new Set(options.players.map((player) => player.playerId));
    for (const player of options.players) this.playerTeams.set(player.playerId, player.team);
    this.onSnapshot = options.onSnapshot;
    this.onComplete = options.onComplete;
    this.state = createSimulation({
      seed: options.seed,
      contentVersion: options.contentVersion,
      withLane: true,
      withJungle: true,
      players: options.players.map((player) => ({
        playerId: player.playerId,
        team: player.team,
        heroId: player.heroId,
        ...spawnFor(player.team, player.slot),
      })),
    }, this.content.payload);
    for (const player of options.players) this.lastQueuedSeq.set(player.playerId, -1);
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer || this.completed) return;
    const intervalMs = 1000 / SIM_TICK_RATE;
    this.timer = setInterval(() => this.advanceOneTick(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  enqueue(playerId: PlayerId, command: PlayerCommand): MatchInputResult {
    if (!this.playerIds.has(playerId)) return { ok: false, code: 'unknown-player' };
    if (!['move', 'attack', 'stop', 'cast', 'buy', 'place-ward'].includes(command.type)) return { ok: false, code: 'unsupported-command' };
    const normalized = normalizeCoreCommand(playerId, command);
    if (!normalized) return { ok: false, code: 'invalid-command' };

    const last = this.lastQueuedSeq.get(playerId) ?? -1;
    if (normalized.seq <= last) return { ok: false, code: 'invalid-seq' };
    if (normalized.tick < this.state.tick) return { ok: false, code: 'stale-tick' };
    if (normalized.tick > this.state.tick + 6) return { ok: false, code: 'future-tick' };

    this.lastQueuedSeq.set(playerId, normalized.seq);
    const bucket = this.queued.get(normalized.tick);
    if (bucket) bucket.push(normalized);
    else this.queued.set(normalized.tick, [normalized]);
    return { ok: true };
  }

  forfeit(playerId: PlayerId): boolean {
    const team = this.playerTeams.get(playerId);
    if (team === undefined) return false;
    return this.forfeitTeam(team);
  }

  forfeitTeam(team: 0 | 1): boolean {
    if (this.completed) return false;
    this.state.winner = team === 0 ? 1 : 0;
    this.finish();
    return true;
  }

  advanceOneTick(): void {
    if (this.completed) return;
    const tick = this.state.tick;
    const commands = this.queued.get(tick) ?? [];
    this.queued.delete(tick);
    stepSimulation(this.state, commands, this.content.payload);

    if (this.state.winner !== null) {
      this.finish();
      return;
    }
    if (this.state.tick % this.snapshotEveryTicks === 0) this.emitSnapshot();
  }

  snapshot(): AuthoritativeSnapshot<SimulationState> {
    return {
      matchId: this.matchId,
      contentVersion: this.contentVersion,
      serverTick: this.state.tick,
      ackSeqByPlayer: { ...this.state.lastAcceptedSeq },
      stateHash: hashSimulationState(this.state),
      state: structuredClone(this.state),
    };
  }

  private finish(): void {
    if (this.completed) return;
    this.completed = true;
    this.stop();
    this.emitSnapshot();
    this.onComplete?.(this.state);
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.snapshot());
  }
}
