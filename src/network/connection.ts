/**
 * Gerenciador de conexão online.
 * Mantém fallback offline, autenticação e matchmaking sem acumular listeners.
 */
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { MatchFoundPayload } from '../shared/protocol.ts';

export type ConnStatus = 'checking' | 'online' | 'offline';
export type AuthMode = 'guest' | 'account';

export interface SessionUser {
  id: string;
  username: string;
  mode: AuthMode;
  level?: number;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'http://localhost:3001';
const TOKEN_KEY = 'pixelrift_token';
const USER_KEY = 'pixelrift_user';

type Listener = () => void;
type QueueJoinedPayload = { position: number; estimatedTime: number };
type GameErrorPayload = { code?: string };

class ConnectionManager {
  status: ConnStatus = 'checking';
  mode: AuthMode = 'guest';
  user: SessionUser | null = null;
  socket: Socket | null = null;
  serverInfo: { version?: string; players?: number; activeMatches?: number } | null = null;
  inQueue = false;
  queuePos: number | null = null;
  queueEta = 0;
  match: MatchFoundPayload | null = null;
  lastNetworkError: string | null = null;

  private listeners = new Set<Listener>();

  constructor() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const restored = JSON.parse(raw) as SessionUser;
        this.user = restored;
        this.mode = restored.mode;
      }
    } catch {
      // sessão inválida é simplesmente ignorada
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  async checkServer(): Promise<boolean> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(API_URL + '/api/health', { signal: ctrl.signal });
      if (!res.ok) return false;
      const data = await res.json() as { version?: string; players?: number; activeMatches?: number };
      this.serverInfo = {
        version: data.version,
        players: data.players,
        activeMatches: data.activeMatches,
      };
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async init() {
    this.status = 'checking';
    this.emit();
    const up = await this.checkServer();
    if (up) {
      this.status = 'online';
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && this.user?.mode === 'account') this.connectSocket(token);
    } else {
      this.status = 'offline';
      if (this.user?.mode !== 'guest') this.enterGuest();
    }
    this.emit();
  }

  private onQueueJoined = (data: QueueJoinedPayload) => {
    this.inQueue = true;
    this.queuePos = data.position;
    this.queueEta = data.estimatedTime;
    this.emit();
  };

  private onQueueFound = (data: MatchFoundPayload) => {
    if (!data?.matchId || (data.team !== 0 && data.team !== 1) || !Number.isInteger(data.slot)) return;
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.match = data;
    this.emit();
    this.onMatchFound?.(data);
  };

  private onQueueLeft = () => {
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.emit();
  };

  private onConnectError = (error: Error) => {
    this.lastNetworkError = error.message || 'Falha na conexão em tempo real.';
    this.inQueue = false;
    this.emit();
  };

  private onGameError = (payload: GameErrorPayload) => {
    this.lastNetworkError = payload?.code || 'Erro de protocolo da partida.';
    this.emit();
  };

  private bindSocketEvents(socket: Socket) {
    socket.on('queue:joined', this.onQueueJoined);
    socket.on('queue:found', this.onQueueFound);
    socket.on('queue:left', this.onQueueLeft);
    socket.on('connect_error', this.onConnectError);
    socket.on('game:error', this.onGameError);
  }

  private unbindSocketEvents(socket: Socket) {
    socket.off('queue:joined', this.onQueueJoined);
    socket.off('queue:found', this.onQueueFound);
    socket.off('queue:left', this.onQueueLeft);
    socket.off('connect_error', this.onConnectError);
    socket.off('game:error', this.onGameError);
  }

  connectSocket(token?: string) {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.lastNetworkError = null;
    const socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      timeout: 5000,
      transports: ['websocket', 'polling'],
    });
    this.socket = socket;
    this.bindSocketEvents(socket);
  }

  disconnectSocket() {
    const socket = this.socket;
    if (!socket) return;
    this.unbindSocketEvents(socket);
    try {
      socket.disconnect();
    } catch {
      // desconexão best-effort
    }
    this.socket = null;
  }

  enterGuest(name?: string) {
    this.disconnectSocket();
    this.mode = 'guest';
    this.match = null;
    this.user = {
      id: 'guest',
      username: name || this.user?.username || 'Convidado',
      mode: 'guest',
    };
    localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    this.emit();
  }

  async login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (this.status !== 'online') return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    try {
      const res = await fetch(API_URL + '/api/auth/login', {
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
    if (this.status !== 'online') return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    try {
      const res = await fetch(API_URL + '/api/auth/register', {
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
    this.disconnectSocket();
    this.mode = 'account';
    this.user = user;
    this.match = null;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.connectSocket(token);
    this.emit();
  }

  logout() {
    this.disconnectSocket();
    localStorage.removeItem(TOKEN_KEY);
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.match = null;
    this.enterGuest('Convidado');
  }

  get isOnline() {
    return this.status === 'online';
  }

  joinQueue() {
    if (!this.isOnline || !this.socket || this.user?.mode !== 'account') return;
    this.match = null;
    this.lastNetworkError = null;
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

  clearMatch() {
    this.match = null;
    this.emit();
  }

  onMatchFound: ((match: MatchFoundPayload) => void) | null = null;
}

export const conn = new ConnectionManager();

export function useConnection() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const unsub = conn.subscribe(() => setVersion((value) => value + 1));
    return () => {
      unsub();
    };
  }, []);
  return {
    conn,
    status: conn.status,
    user: conn.user,
    serverInfo: conn.serverInfo,
    match: conn.match,
    networkError: conn.lastNetworkError,
  };
}
