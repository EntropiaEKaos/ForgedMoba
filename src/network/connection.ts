/**
 * ForgedMoba online connection manager.
 * Keeps transport/session concerns outside the game simulation.
 */
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type ConnStatus = 'checking' | 'online' | 'offline';
export type AuthMode = 'guest' | 'account';

export interface SessionUser {
  id: string;
  username: string;
  mode: AuthMode;
  level?: number;
}

export interface MatchFoundInfo {
  matchId: string;
  team: 0 | 1;
  slot: number;
  players: { userId: string; username: string }[];
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'http://localhost:3001';
const TOKEN_KEY = 'pixelrift_token';
const USER_KEY = 'pixelrift_user';

type Listener = () => void;

class ConnectionManager {
  status: ConnStatus = 'checking';
  mode: AuthMode = 'guest';
  user: SessionUser | null = null;
  socket: Socket | null = null;
  serverInfo: { version?: string; players?: number; queueSize?: number; activeMatches?: number } | null = null;

  inQueue = false;
  queuePos: number | null = null;
  queueEta = 0;
  activeMatch: MatchFoundInfo | null = null;

  private listeners = new Set<Listener>();
  private queueHandlersBound = false;

  onMatchFound: ((match: MatchFoundInfo) => void) | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) this.user = JSON.parse(raw);
      this.mode = this.user?.mode ?? 'guest';
    } catch {
      // Storage is optional; guest mode remains available.
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }

  async checkServer(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
      clearTimeout(timeout);
      if (!res.ok) return false;

      const data = await res.json();
      this.serverInfo = {
        version: data.version,
        players: data.players,
        queueSize: data.queueSize,
        activeMatches: data.activeMatches,
      };
      return true;
    } catch {
      return false;
    }
  }

  async init() {
    this.status = 'checking';
    this.emit();

    const up = await this.checkServer();
    if (!up) {
      this.status = 'offline';
      if (this.user?.mode !== 'guest') this.enterGuest();
      this.emit();
      return;
    }

    this.status = 'online';
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && this.user?.mode === 'account') this.connectSocket(token);
    this.emit();
  }

  connectSocket(token?: string) {
    if (this.socket?.connected) return;

    this.disconnectSocket();
    const socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      timeout: 5000,
      autoConnect: true,
    });
    this.socket = socket;

    socket.on('connect_error', () => {
      this.inQueue = false;
      this.queuePos = null;
      this.emit();
    });

    this.bindQueueHandlers();
  }

  disconnectSocket() {
    if (this.socket) {
      this.unbindQueueHandlers();
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        // Ignore transport shutdown errors.
      }
    }
    this.socket = null;
    this.queueHandlersBound = false;
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.activeMatch = null;
  }

  enterGuest(name?: string) {
    this.disconnectSocket();
    this.mode = 'guest';
    this.user = {
      id: 'guest',
      username: name || this.user?.username || 'Convidado',
      mode: 'guest',
    };
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    this.emit();
  }

  async login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (this.status !== 'online') {
      return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Falha no login' };

      this.applyAccount(data.token, {
        id: data.user.id,
        username: data.user.username,
        mode: 'account',
        level: data.user.level,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de rede' };
    }
  }

  async register(username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (this.status !== 'online') {
      return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Falha no registro' };

      this.applyAccount(data.token, {
        id: data.user.id,
        username: data.user.username,
        mode: 'account',
        level: data.user.level,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de rede' };
    }
  }

  private applyAccount(token: string, user: SessionUser) {
    this.mode = 'account';
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.connectSocket(token);
    this.emit();
  }

  logout() {
    this.disconnectSocket();
    localStorage.removeItem(TOKEN_KEY);
    this.enterGuest('Convidado');
  }

  get isOnline() {
    return this.status === 'online';
  }

  joinQueue() {
    if (!this.isOnline || !this.socket?.connected || this.user?.mode !== 'account') return;
    if (this.inQueue || this.activeMatch) return;

    this.bindQueueHandlers();
    this.inQueue = true;
    this.queuePos = 0;
    this.emit();
    this.socket.emit('queue:join');
  }

  leaveQueue() {
    if (!this.socket) return;
    this.socket.emit('queue:leave');
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.emit();
  }

  clearActiveMatch() {
    this.activeMatch = null;
    this.emit();
  }

  private readonly handleQueueJoined = (data: { position: number; estimatedTime: number }) => {
    this.queuePos = data.position;
    this.queueEta = data.estimatedTime;
    this.emit();
  };

  private readonly handleQueueFound = (data: MatchFoundInfo) => {
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.activeMatch = data;
    this.emit();
    this.onMatchFound?.(data);
  };

  private readonly handleQueueLeft = () => {
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.emit();
  };

  private bindQueueHandlers() {
    if (!this.socket || this.queueHandlersBound) return;
    this.socket.on('queue:joined', this.handleQueueJoined);
    this.socket.on('queue:found', this.handleQueueFound);
    this.socket.on('queue:left', this.handleQueueLeft);
    this.queueHandlersBound = true;
  }

  private unbindQueueHandlers() {
    if (!this.socket || !this.queueHandlersBound) return;
    this.socket.off('queue:joined', this.handleQueueJoined);
    this.socket.off('queue:found', this.handleQueueFound);
    this.socket.off('queue:left', this.handleQueueLeft);
    this.queueHandlersBound = false;
  }
}

export const conn = new ConnectionManager();

export function useConnection() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = conn.subscribe(() => setVersion(version => version + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    conn,
    status: conn.status,
    user: conn.user,
    serverInfo: conn.serverInfo,
    activeMatch: conn.activeMatch,
  };
}
