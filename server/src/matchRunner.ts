import type {
  AuthoritativeSnapshot,
  CoreSimulationCommand,
  PlayerCommand,
  PlayerId,
} from '../../src/shared/protocol.ts';
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
}

export interface MatchRunnerOptions {
  matchId: string;
  contentVersion: string;
  seed: number;
  players: MatchRunnerPlayer[];
  snapshotEveryTicks?: number;
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
  if (raw.type === 'cast') {
    if (raw.slot !== 'Q') return null;
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
      slot: 'Q',
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

  private readonly playerIds: Set<PlayerId>;
  private readonly queued = new Map<number, CoreSimulationCommand[]>();
  private readonly lastQueuedSeq = new Map<PlayerId, number>();
  private readonly onSnapshot?: MatchRunnerOptions['onSnapshot'];
  private readonly onComplete?: MatchRunnerOptions['onComplete'];
  private timer: ReturnType<typeof setInterval> | null = null;
  private completed = false;

  constructor(options: MatchRunnerOptions) {
    this.matchId = options.matchId;
    this.contentVersion = options.contentVersion;
    this.snapshotEveryTicks = Math.max(1, Math.trunc(options.snapshotEveryTicks ?? 3));
    this.playerIds = new Set(options.players.map((player) => player.playerId));
    this.onSnapshot = options.onSnapshot;
    this.onComplete = options.onComplete;
    this.state = createSimulation({
      seed: options.seed,
      contentVersion: options.contentVersion,
      withLane: true,
      players: options.players.map((player) => ({
        playerId: player.playerId,
        team: player.team,
        ...spawnFor(player.team, player.slot),
      })),
    });
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
    if (!['move', 'attack', 'stop', 'cast'].includes(command.type)) return { ok: false, code: 'unsupported-command' };
    if (command.type === 'cast' && command.slot !== 'Q') return { ok: false, code: 'unsupported-command' };
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

  advanceOneTick(): void {
    if (this.completed) return;
    const tick = this.state.tick;
    const commands = this.queued.get(tick) ?? [];
    this.queued.delete(tick);
    stepSimulation(this.state, commands);

    if (this.state.tick % this.snapshotEveryTicks === 0 || this.state.winner !== null) {
      this.emitSnapshot();
    }
    if (this.state.winner !== null) {
      this.completed = true;
      this.stop();
      this.onComplete?.(this.state);
    }
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

  private emitSnapshot(): void {
    this.onSnapshot?.(this.snapshot());
  }
}
