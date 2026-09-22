/**
 * ============ FASE 2: Gerenciador de Conexão Online ============
 * Conecta ao servidor Pixel Rift quando disponível, e cai graciosamente
 * para o modo Convidado (offline) quando o servidor estiver offline.
 */
import { useState, useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

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

class ConnectionManager {
  status: ConnStatus = 'checking';
  mode: AuthMode = 'guest';
  user: SessionUser | null = null;
  socket: Socket | null = null;
  serverInfo: { version?: string; players?: number } | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    // tenta restaurar sessão salva
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) this.user = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(l => l()); }

  /** Verifica se o servidor está online (health check). */
  async checkServer(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
      clearTimeout(to);
      if (res.ok) {
        const data = await res.json();
        this.serverInfo = { version: data.version, players: data.players };
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Fluxo de inicialização: tenta conectar, define status. */
  async init() {
    this.status = 'checking';
    this.emit();
    const up = await this.checkServer();
    if (up) {
      this.status = 'online';
      // se já tem token, tenta reconectar websocket
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && this.user?.mode === 'account') this.connectSocket(token);
    } else {
      this.status = 'offline';
      if (this.user?.mode !== 'guest') this.enterGuest();
    }
    this.emit();
  }

  /** Conecta o socket WebSocket para matchmaking/jogo em tempo real. */
  connectSocket(token?: string) {
    if (this.socket?.connected) return;
    try {
      this.socket = io(WS_URL, { auth: { token }, reconnection: true, timeout: 5000 });
    } catch { /* ignore */ }
  }

  disconnectSocket() {
    try { this.socket?.disconnect(); } catch { /* ignore */ }
    this.socket = null;
  }

  /** Entra como convidado (offline / vs bots). */
  enterGuest(name?: string) {
    this.mode = 'guest';
    this.user = { id: 'guest', username: name || this.user?.username || 'Convidado', mode: 'guest' };
    localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    this.emit();
  }

  /** Login numa conta real (requer servidor online). */
  async login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (this.status !== 'online') return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Falha no login' };
      this.applyAccount(data.token, { id: data.user.id, username: data.user.username, mode: 'account', level: data.user.level });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de rede' };
    }
  }

  /** Registro de conta nova (requer servidor online). */
  async register(username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (this.status !== 'online') return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Falha no registro' };
      this.applyAccount(data.token, { id: data.user.id, username: data.user.username, mode: 'account', level: data.user.level });
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

  get isOnline() { return this.status === 'online'; }

  // ---------- Matchmaking (Fila online) ----------
  inQueue = false;
  queuePos: number | null = null;
  queueEta = 0;

  joinQueue() {
    if (!this.isOnline || !this.socket) return;
    this.inQueue = true; this.queuePos = 0; this.emit();
    this.socket.emit('queue:join', {});
    this.socket.on('queue:joined', (d: { position: number; estimatedTime: number }) => {
      this.queuePos = d.position; this.queueEta = d.estimatedTime; this.emit();
    });
    this.socket.on('queue:found', () => {
      this.inQueue = false; this.queuePos = null; this.emit();
      this.onMatchFound?.();
    });
    this.socket.on('queue:left', () => { this.inQueue = false; this.queuePos = null; this.emit(); });
  }

  leaveQueue() {
    if (!this.socket) return;
    this.socket.emit('queue:leave');
    this.inQueue = false; this.queuePos = null; this.emit();
  }

  /** Callback quando uma partida online é encontrada (setado pela UI). */
  onMatchFound: (() => void) | null = null;
}

export const conn = new ConnectionManager();

/** Hook React para componentes reagirem ao estado de conexão. */
export function useConnection() {
  const [, set] = useState(0);
  useEffect(() => {
    const unsub = conn.subscribe(() => set((n: number) => n + 1));
    return () => { unsub(); };
  }, []);
  return { conn, status: conn.status, user: conn.user, serverInfo: conn.serverInfo };
}
