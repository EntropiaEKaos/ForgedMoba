import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type { MatchMode } from '../../src/shared/protocol.ts';
import type { AuthoritativeHeroId } from '../../src/shared/authoritativeContent.ts';

export const DEFAULT_RANKED_MMR = 1000;
const RANKED_K_FACTOR = 32;

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  level: number;
  createdAt: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  rankedMmr: number;
  rankedGames: number;
  rankedWins: number;
  rankedLosses: number;
}

export interface StoredSession {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

export interface StoredMatchParticipant {
  userId: string;
  username: string;
  team: 0 | 1;
  slot: number;
  heroId?: AuthoritativeHeroId;
  mmrBefore: number;
  mmrAfter: number;
}

export interface StoredMatch {
  id: string;
  mode: MatchMode;
  contentVersion: string;
  createdAt: number;
  completedAt: number;
  durationTicks: number;
  winner: 0 | 1 | null;
  participants: StoredMatchParticipant[];
}

export interface PlayerProfile {
  id: string;
  username: string;
  level: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  rankedMmr: number;
  rankedGames: number;
  rankedWins: number;
  rankedLosses: number;
}

export interface CreateUserInput {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  level?: number;
}

export interface CompletedMatchInput {
  id: string;
  mode: MatchMode;
  contentVersion: string;
  createdAt: number;
  completedAt?: number;
  durationTicks: number;
  winner: 0 | 1 | null;
  players: Array<{
    userId: string;
    username: string;
    team: 0 | 1;
    slot: number;
    heroId?: AuthoritativeHeroId;
  }>;
}

export interface PersistenceStats {
  mode: 'memory' | 'json-file';
  durable: boolean;
  users: number;
  activeSessions: number;
  matches: number;
}

export interface PersistenceStore {
  initialize(): Promise<void>;
  createUser(input: CreateUserInput): Promise<StoredUser>;
  findUserById(id: string): Promise<StoredUser | null>;
  findUserByUsername(username: string): Promise<StoredUser | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  createSession(userId: string, ttlMs: number): Promise<StoredSession>;
  findActiveSession(id: string): Promise<StoredSession | null>;
  revokeSession(id: string): Promise<boolean>;
  recordCompletedMatch(input: CompletedMatchInput): Promise<StoredMatch>;
  recentMatches(userId: string, limit?: number): Promise<StoredMatch[]>;
  leaderboard(limit?: number): Promise<PlayerProfile[]>;
  stats(): PersistenceStats;
}

export class DuplicateIdentityError extends Error {
  readonly field: 'username' | 'email';

  constructor(field: 'username' | 'email') {
    super(field === 'username' ? 'Usuário já existe.' : 'E-mail já cadastrado.');
    this.field = field;
  }
}

interface PersistedStateV1 {
  version: 1;
  users: StoredUser[];
  sessions: StoredSession[];
  matches: StoredMatch[];
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function toPlayerProfile(user: StoredUser): PlayerProfile {
  return {
    id: user.id,
    username: user.username,
    level: user.level,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    losses: user.losses,
    rankedMmr: user.rankedMmr,
    rankedGames: user.rankedGames,
    rankedWins: user.rankedWins,
    rankedLosses: user.rankedLosses,
  };
}

export class MemoryPersistenceStore implements PersistenceStore {
  protected readonly users = new Map<string, StoredUser>();
  protected readonly usersByName = new Map<string, string>();
  protected readonly usersByEmail = new Map<string, string>();
  protected readonly sessions = new Map<string, StoredSession>();
  protected readonly matches = new Map<string, StoredMatch>();
  protected readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  async initialize(): Promise<void> {}

  protected async afterMutation(): Promise<void> {}

  protected loadState(state: PersistedStateV1): void {
    this.users.clear();
    this.usersByName.clear();
    this.usersByEmail.clear();
    this.sessions.clear();
    this.matches.clear();

    for (const user of state.users) {
      const normalized: StoredUser = {
        ...user,
        createdAt: Number.isFinite(user.createdAt) ? user.createdAt : this.now(),
        gamesPlayed: Number.isFinite(user.gamesPlayed) ? user.gamesPlayed : 0,
        wins: Number.isFinite(user.wins) ? user.wins : 0,
        losses: Number.isFinite(user.losses) ? user.losses : 0,
        rankedMmr: Number.isFinite(user.rankedMmr) ? user.rankedMmr : DEFAULT_RANKED_MMR,
        rankedGames: Number.isFinite(user.rankedGames) ? user.rankedGames : 0,
        rankedWins: Number.isFinite(user.rankedWins) ? user.rankedWins : 0,
        rankedLosses: Number.isFinite(user.rankedLosses) ? user.rankedLosses : 0,
      };
      this.users.set(normalized.id, normalized);
      this.usersByName.set(normalizeIdentity(normalized.username), normalized.id);
      this.usersByEmail.set(normalizeIdentity(normalized.email), normalized.id);
    }
    for (const session of state.sessions) this.sessions.set(session.id, clone(session));
    for (const match of state.matches) this.matches.set(match.id, clone(match));
  }

  protected exportState(): PersistedStateV1 {
    return {
      version: 1,
      users: [...this.users.values()].map(clone),
      sessions: [...this.sessions.values()].map(clone),
      matches: [...this.matches.values()].map(clone),
    };
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const nameKey = normalizeIdentity(input.username);
    const emailKey = normalizeIdentity(input.email);
    if (this.usersByName.has(nameKey)) throw new DuplicateIdentityError('username');
    if (this.usersByEmail.has(emailKey)) throw new DuplicateIdentityError('email');
    if (this.users.has(input.id)) throw new Error('User id already exists.');

    const user: StoredUser = {
      id: input.id,
      username: input.username.trim(),
      email: input.email.trim(),
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      level: input.level ?? 1,
      createdAt: this.now(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      rankedMmr: DEFAULT_RANKED_MMR,
      rankedGames: 0,
      rankedWins: 0,
      rankedLosses: 0,
    };
    this.users.set(user.id, user);
    this.usersByName.set(nameKey, user.id);
    this.usersByEmail.set(emailKey, user.id);
    await this.afterMutation();
    return clone(user);
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const id = this.usersByName.get(normalizeIdentity(username));
    return id ? this.findUserById(id) : null;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const id = this.usersByEmail.get(normalizeIdentity(email));
    return id ? this.findUserById(id) : null;
  }

  async createSession(userId: string, ttlMs: number): Promise<StoredSession> {
    if (!this.users.has(userId)) throw new Error('Cannot create session for unknown user.');
    const createdAt = this.now();
    const session: StoredSession = {
      id: randomUUID(),
      userId,
      createdAt,
      expiresAt: createdAt + Math.max(1_000, Math.trunc(ttlMs)),
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    await this.afterMutation();
    return clone(session);
  }

  async findActiveSession(id: string): Promise<StoredSession | null> {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt !== null || session.expiresAt <= this.now()) return null;
    return clone(session);
  }

  async revokeSession(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt !== null) return false;
    session.revokedAt = this.now();
    await this.afterMutation();
    return true;
  }

  async recordCompletedMatch(input: CompletedMatchInput): Promise<StoredMatch> {
    const existing = this.matches.get(input.id);
    if (existing) return clone(existing);

    const users = input.players.map((player) => {
      const user = this.users.get(player.userId);
      if (!user) throw new Error('Cannot record match for unknown user: ' + player.userId);
      return { player, user };
    });

    const before = new Map(users.map(({ user }) => [user.id, user.rankedMmr]));
    if (input.mode === 'ranked5v5' && input.winner !== null) {
      const team0 = users.filter(({ player }) => player.team === 0);
      const team1 = users.filter(({ player }) => player.team === 1);
      const avg0 = team0.reduce((sum, entry) => sum + entry.user.rankedMmr, 0) / Math.max(1, team0.length);
      const avg1 = team1.reduce((sum, entry) => sum + entry.user.rankedMmr, 0) / Math.max(1, team1.length);
      const expected0 = 1 / (1 + 10 ** ((avg1 - avg0) / 400));
      const score0 = input.winner === 0 ? 1 : 0;
      const delta0 = Math.round(RANKED_K_FACTOR * (score0 - expected0));
      const delta1 = -delta0;

      for (const { player, user } of users) {
        user.rankedMmr = Math.max(0, user.rankedMmr + (player.team === 0 ? delta0 : delta1));
        user.rankedGames += 1;
        if (player.team === input.winner) user.rankedWins += 1;
        else user.rankedLosses += 1;
      }
    }

    for (const { player, user } of users) {
      user.gamesPlayed += 1;
      if (input.winner !== null) {
        if (player.team === input.winner) user.wins += 1;
        else user.losses += 1;
      }
    }

    const record: StoredMatch = {
      id: input.id,
      mode: input.mode,
      contentVersion: input.contentVersion,
      createdAt: input.createdAt,
      completedAt: input.completedAt ?? this.now(),
      durationTicks: Math.max(0, Math.trunc(input.durationTicks)),
      winner: input.winner,
      participants: users.map(({ player, user }) => ({
        userId: user.id,
        username: user.username,
        team: player.team,
        slot: player.slot,
        heroId: player.heroId,
        mmrBefore: before.get(user.id) ?? user.rankedMmr,
        mmrAfter: user.rankedMmr,
      })),
    };

    this.matches.set(record.id, record);
    await this.afterMutation();
    return clone(record);
  }

  async recentMatches(userId: string, limit = 20): Promise<StoredMatch[]> {
    const capped = Math.max(1, Math.min(100, Math.trunc(limit)));
    return [...this.matches.values()]
      .filter((match) => match.participants.some((participant) => participant.userId === userId))
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, capped)
      .map(clone);
  }

  async leaderboard(limit = 50): Promise<PlayerProfile[]> {
    const capped = Math.max(1, Math.min(100, Math.trunc(limit)));
    return [...this.users.values()]
      .sort((a, b) =>
        b.rankedMmr - a.rankedMmr ||
        b.rankedWins - a.rankedWins ||
        a.username.localeCompare(b.username),
      )
      .slice(0, capped)
      .map(toPlayerProfile)
      .map(clone);
  }

  stats(): PersistenceStats {
    const now = this.now();
    const activeSessions = [...this.sessions.values()]
      .filter((session) => session.revokedAt === null && session.expiresAt > now)
      .length;
    return {
      mode: 'memory',
      durable: false,
      users: this.users.size,
      activeSessions,
      matches: this.matches.size,
    };
  }
}

export class JsonFilePersistenceStore extends MemoryPersistenceStore {
  readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath: string, now?: () => number) {
    super(now);
    this.filePath = filePath;
  }

  override async initialize(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedStateV1>;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.users) ||
        !Array.isArray(parsed.sessions) ||
        !Array.isArray(parsed.matches)
      ) {
        throw new Error('Unsupported or invalid ForgedMoba persistence file.');
      }
      this.loadState(parsed as PersistedStateV1);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') throw error;
      await this.flush();
    }
  }

  protected override async afterMutation(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    const snapshot = JSON.stringify(this.exportState(), null, 2) + '\n';
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = this.filePath + '.' + process.pid + '.' + randomUUID() + '.tmp';
      await writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await rename(tempPath, this.filePath);
    });
    await this.writeChain;
  }

  override stats(): PersistenceStats {
    const base = super.stats();
    return { ...base, mode: 'json-file', durable: true };
  }
}

export function createPersistenceFromEnv(env: NodeJS.ProcessEnv = process.env): PersistenceStore {
  const mode = (env.FORGED_PERSISTENCE_MODE || 'file').trim().toLowerCase();
  if (mode === 'memory') {
    if (env.NODE_ENV === 'production') {
      throw new Error('FORGED_PERSISTENCE_MODE=memory is forbidden in production.');
    }
    return new MemoryPersistenceStore();
  }
  if (mode !== 'file') {
    throw new Error('Unsupported FORGED_PERSISTENCE_MODE: ' + mode);
  }

  const configuredPath = env.FORGED_DATA_FILE?.trim();
  if (env.NODE_ENV === 'production' && !configuredPath) {
    throw new Error('FORGED_DATA_FILE is required in production when using file persistence.');
  }
  return new JsonFilePersistenceStore(
    path.resolve(configuredPath || path.join('.data', 'forged-moba.json')),
  );
}
