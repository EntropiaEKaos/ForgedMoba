import type {
  DraftPlayerSnapshot,
  DraftStatePayload,
  DraftStatus,
  RankedRole,
} from '../../src/shared/protocol.ts';
import type { AuthoritativeHeroId } from '../../src/shared/authoritativeContent.ts';
import type { MatchmakingEntry } from './matchmaking.ts';

const ROLES: readonly RankedRole[] = ['top', 'jungle', 'mid', 'carry', 'support'];

export type DraftActionResult =
  | { ok: true }
  | { ok: false; code: 'unknown-player' | 'invalid-hero' | 'locked' | 'hero-required' | 'draft-closed' };

interface DraftPlayerInternal extends DraftPlayerSnapshot {
  socketId: string;
}

export interface RankedDraftOptions {
  draftId: string;
  entries: MatchmakingEntry[];
  contentVersion: string;
  allowedHeroIds: readonly AuthoritativeHeroId[];
  createdAt?: number;
  timeoutMs?: number;
}

export interface DraftLaunchPlayer {
  userId: string;
  username: string;
  socketId: string;
  team: 0 | 1;
  slot: number;
  role: RankedRole;
  heroId: AuthoritativeHeroId;
}

export class RankedDraftRoom {
  readonly draftId: string;
  readonly contentVersion: string;
  readonly createdAt: number;
  readonly deadlineAt: number;

  private readonly allowedHeroIds: ReadonlySet<string>;
  private readonly players: DraftPlayerInternal[];
  private status: DraftStatus = 'draft';

  constructor(options: RankedDraftOptions) {
    if (options.entries.length !== 10) {
      throw new Error('ranked draft requires exactly 10 players');
    }
    const ids = new Set<string>();
    for (const entry of options.entries) {
      if (ids.has(entry.userId)) throw new Error('ranked draft contains duplicate player: ' + entry.userId);
      ids.add(entry.userId);
    }

    this.draftId = options.draftId;
    this.contentVersion = options.contentVersion;
    this.createdAt = Math.trunc(options.createdAt ?? Date.now());
    const timeoutMs = Math.max(30_000, Math.trunc(options.timeoutMs ?? 120_000));
    this.deadlineAt = this.createdAt + timeoutMs;
    this.allowedHeroIds = new Set(options.allowedHeroIds);

    this.players = options.entries.map((entry, index) => {
      const team: 0 | 1 = index < 5 ? 0 : 1;
      const slot = index % 5;
      return {
        playerId: entry.userId,
        username: entry.username,
        socketId: entry.socketId,
        team,
        slot,
        role: ROLES[slot],
        heroId: null,
        ready: false,
        connected: true,
      };
    });
  }

  get currentStatus(): DraftStatus {
    return this.status;
  }

  get isReadyToLaunch(): boolean {
    return this.status !== 'cancelled' &&
      this.status !== 'launched' &&
      this.players.every((player) => player.connected && player.ready && player.heroId !== null);
  }

  isExpired(now = Date.now()): boolean {
    return this.status === 'draft' && Math.trunc(now) >= this.deadlineAt;
  }

  pickHero(playerId: string, heroId: string): DraftActionResult {
    if (this.status !== 'draft') return { ok: false, code: 'draft-closed' };
    const player = this.playerById(playerId);
    if (!player) return { ok: false, code: 'unknown-player' };
    if (player.ready) return { ok: false, code: 'locked' };
    if (!this.allowedHeroIds.has(heroId)) return { ok: false, code: 'invalid-hero' };
    player.heroId = heroId;
    return { ok: true };
  }

  setReady(playerId: string, ready: boolean): DraftActionResult {
    if (this.status !== 'draft') return { ok: false, code: 'draft-closed' };
    const player = this.playerById(playerId);
    if (!player) return { ok: false, code: 'unknown-player' };
    if (ready && player.heroId === null) return { ok: false, code: 'hero-required' };
    player.ready = ready;
    if (this.isReadyToLaunch) this.status = 'ready';
    return { ok: true };
  }

  replaceSocket(playerId: string, socketId: string): boolean {
    const player = this.playerById(playerId);
    if (!player || this.status === 'cancelled' || this.status === 'launched') return false;
    player.socketId = socketId;
    player.connected = true;
    if (this.players.every((entry) => entry.connected && entry.ready && entry.heroId !== null)) {
      this.status = 'ready';
    }
    return true;
  }

  markDisconnected(socketId: string): string | null {
    const player = this.players.find((entry) => entry.socketId === socketId);
    if (!player || this.status === 'cancelled' || this.status === 'launched') return null;
    player.connected = false;
    if (this.status === 'ready') this.status = 'draft';
    return player.playerId;
  }

  cancel(): void {
    if (this.status !== 'launched') this.status = 'cancelled';
  }

  launchPlayers(): DraftLaunchPlayer[] | null {
    if (!this.isReadyToLaunch && this.status !== 'ready') return null;
    if (!this.players.every((player) => player.connected && player.ready && player.heroId !== null)) return null;
    this.status = 'launched';
    return this.players.map((player) => ({
      userId: player.playerId,
      username: player.username,
      socketId: player.socketId,
      team: player.team,
      slot: player.slot,
      role: player.role,
      heroId: player.heroId as AuthoritativeHeroId,
    }));
  }

  hasPlayer(playerId: string): boolean {
    return this.players.some((player) => player.playerId === playerId);
  }

  socketIdFor(playerId: string): string | null {
    return this.playerById(playerId)?.socketId ?? null;
  }

  snapshot(): DraftStatePayload {
    return {
      draftId: this.draftId,
      mode: 'ranked5v5',
      contentVersion: this.contentVersion,
      status: this.status,
      deadlineAt: this.deadlineAt,
      players: this.players
        .map(({ socketId: _socketId, ...player }) => ({ ...player }))
        .sort((a, b) => a.team - b.team || a.slot - b.slot || a.playerId.localeCompare(b.playerId)),
    };
  }

  private playerById(playerId: string): DraftPlayerInternal | null {
    return this.players.find((player) => player.playerId === playerId) ?? null;
  }
}
