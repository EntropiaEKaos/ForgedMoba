import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface IdentityUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  level: number;
}

export interface IdentitySession {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

interface IdentityState {
  schemaVersion: 1;
  users: IdentityUser[];
  sessions: IdentitySession[];
}

export interface IdentityStore {
  readonly kind: 'memory' | 'file';
  findUserById(id: string): Promise<IdentityUser | null>;
  findUserByUsername(username: string): Promise<IdentityUser | null>;
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  createUser(user: IdentityUser): Promise<void>;
  createSession(session: IdentitySession): Promise<void>;
  getActiveSession(id: string, now?: number): Promise<IdentitySession | null>;
  revokeSession(id: string, now?: number): Promise<boolean>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function emptyState(): IdentityState {
  return { schemaVersion: 1, users: [], sessions: [] };
}

function validateState(value: unknown): IdentityState {
  if (!value || typeof value !== 'object') throw new Error('invalid identity store state');
  const state = value as Partial<IdentityState>;
  if (state.schemaVersion !== 1 || !Array.isArray(state.users) || !Array.isArray(state.sessions)) {
    throw new Error('unsupported identity store schema');
  }
  return clone(state as IdentityState);
}

export class MemoryIdentityStore implements IdentityStore {
  readonly kind: 'memory' | 'file' = 'memory';
  protected state: IdentityState;

  constructor(initial?: IdentityState) {
    this.state = initial ? validateState(initial) : emptyState();
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    const user = this.state.users.find((entry) => entry.id === id);
    return user ? clone(user) : null;
  }

  async findUserByUsername(username: string): Promise<IdentityUser | null> {
    const key = normalizeIdentity(username);
    const user = this.state.users.find((entry) => normalizeIdentity(entry.username) === key);
    return user ? clone(user) : null;
  }

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const key = normalizeIdentity(email);
    const user = this.state.users.find((entry) => normalizeIdentity(entry.email) === key);
    return user ? clone(user) : null;
  }

  async createUser(user: IdentityUser): Promise<void> {
    const usernameKey = normalizeIdentity(user.username);
    const emailKey = normalizeIdentity(user.email);
    if (this.state.users.some((entry) => entry.id === user.id)) throw new Error('duplicate-user-id');
    if (this.state.users.some((entry) => normalizeIdentity(entry.username) === usernameKey)) {
      throw new Error('duplicate-username');
    }
    if (this.state.users.some((entry) => normalizeIdentity(entry.email) === emailKey)) {
      throw new Error('duplicate-email');
    }
    this.state.users.push(clone(user));
    await this.persist();
  }

  async createSession(session: IdentitySession): Promise<void> {
    if (this.state.sessions.some((entry) => entry.id === session.id)) throw new Error('duplicate-session-id');
    if (!this.state.users.some((entry) => entry.id === session.userId)) throw new Error('unknown-session-user');
    this.state.sessions.push(clone(session));
    await this.persist();
  }

  async getActiveSession(id: string, now = Date.now()): Promise<IdentitySession | null> {
    const session = this.state.sessions.find((entry) => entry.id === id);
    if (!session || session.revokedAt !== null || session.expiresAt <= now) return null;
    return clone(session);
  }

  async revokeSession(id: string, now = Date.now()): Promise<boolean> {
    const session = this.state.sessions.find((entry) => entry.id === id);
    if (!session || session.revokedAt !== null) return false;
    session.revokedAt = Math.trunc(now);
    await this.persist();
    return true;
  }

  protected async persist(): Promise<void> {
    // Memory store intentionally has no external persistence.
  }

  protected snapshot(): IdentityState {
    return clone(this.state);
  }
}

export class FileIdentityStore extends MemoryIdentityStore {
  override readonly kind: 'memory' | 'file' = 'file';
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(filePath: string, initial: IdentityState) {
    super(initial);
    this.filePath = filePath;
  }

  static async open(filePathInput: string): Promise<FileIdentityStore> {
    const filePath = path.resolve(filePathInput);
    let initial = emptyState();
    try {
      initial = validateState(JSON.parse(await readFile(filePath, 'utf8')));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
    return new FileIdentityStore(filePath, initial);
  }

  protected async persist(): Promise<void> {
    const snapshot = this.snapshot();
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = this.filePath + '.' + process.pid + '.tmp';
      await writeFile(temp, JSON.stringify(snapshot), 'utf8');
      await rename(temp, this.filePath);
    });
    await this.writeChain;
  }
}

export async function createIdentityStore(filePath?: string): Promise<IdentityStore> {
  return filePath?.trim()
    ? FileIdentityStore.open(filePath)
    : new MemoryIdentityStore();
}
