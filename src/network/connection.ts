/**
 * Gerenciador de conexão online.
 * Mantém fallback offline, autenticação, matchmaking e snapshots autoritativos.
 */
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  AuthoritativeSnapshot,
  CoreSimulationCommand,
  MatchFoundPayload,
  MatchMode,
} from '../shared/protocol.ts';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent.ts';
import type { SimulationState } from '../simulation/types.ts';
import { SnapshotInterpolationBuffer, type InterpolatedFrame } from './interpolation.ts';
import { ClientPrediction } from './prediction.ts';
import { NetworkTelemetry, type NetworkMetricsSnapshot } from './telemetry.ts';

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
export const LOCAL_CONTENT_VERSION = CURRENT_AUTHORITATIVE_CONTENT.contentVersion;

type Listener = () => void;
type StripCommandEnvelope<T> = T extends unknown ? Omit<T, 'playerId' | 'seq' | 'tick'> : never;
type LocalSimulationCommand = StripCommandEnvelope<CoreSimulationCommand>;
type QueueJoinedPayload = {
  mode: MatchMode;
  position: number;
  requiredPlayers: number;
  estimatedTime: number;
};
type GameErrorPayload = { code?: string };

class ConnectionManager {
  status: ConnStatus = 'checking';
  mode: AuthMode = 'guest';
  user: SessionUser | null = null;
  socket: Socket | null = null;
  serverInfo: {
    version?: string;
    players?: number;
    activeMatches?: number;
    contentVersion?: string;
    tickRate?: number;
    skirmishQueueSize?: number;
    reconnectGraceMs?: number;
  } | null = null;
  inQueue = false;
  queuePos: number | null = null;
  queueEta = 0;
  queueMode: MatchMode | null = null;
  queueRequiredPlayers = 0;
  match: MatchFoundPayload | null = null;
  matchResult: { winner: 0 | 1 | null } | null = null;
  lastNetworkError: string | null = null;
  authoritativeSnapshot: AuthoritativeSnapshot<SimulationState> | null = null;
  predictedState: SimulationState | null = null;
  disconnectedPlayers: Record<string, number> = {};

  private snapshotReceivedAt = 0;
  private nextInputSeq = 1;
  private prediction: ClientPrediction | null = null;
  private interpolation = new SnapshotInterpolationBuffer(24);
  private telemetry = new NetworkTelemetry(40);
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly interpolationDelayTicks = 4;
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
      const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
      if (!res.ok) return false;
      const data = await res.json() as {
        version?: string;
        players?: number;
        activeMatches?: number;
        contentVersion?: string;
        tickRate?: number;
        skirmishQueueSize?: number;
        reconnectGraceMs?: number;
      };
      this.serverInfo = {
        version: data.version,
        players: data.players,
        activeMatches: data.activeMatches,
        contentVersion: data.contentVersion,
        tickRate: data.tickRate,
        skirmishQueueSize: data.skirmishQueueSize,
        reconnectGraceMs: data.reconnectGraceMs,
      };
      if (data.contentVersion && data.contentVersion !== LOCAL_CONTENT_VERSION) {
        this.lastNetworkError = 'content-version-mismatch';
      }
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
    this.queueMode = data.mode;
    this.queuePos = data.position;
    this.queueRequiredPlayers = data.requiredPlayers;
    this.queueEta = data.estimatedTime;
    this.emit();
  };

  private onQueueFound = (data: MatchFoundPayload) => {
    if (
      !data?.matchId ||
      (data.mode !== 'duel1v1' && data.mode !== 'skirmish3v3' && data.mode !== 'ranked5v5') ||
      (data.team !== 0 && data.team !== 1) ||
      !Number.isInteger(data.slot) ||
      !data.contentVersion ||
      !Number.isFinite(data.serverTickRate) ||
      data.serverTickRate <= 0 ||
      !Number.isFinite(data.reconnectGraceMs) ||
      data.reconnectGraceMs <= 0
    ) return;
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.queueMode = null;
    this.queueRequiredPlayers = 0;
    this.match = data;
    this.matchResult = null;
    this.disconnectedPlayers = {};
    this.resetNetworkMatchState();
    this.prediction = new ClientPrediction(data.playerId);
    this.nextInputSeq = 1;
    this.emit();
    this.onMatchFound?.(data);
  };

  private onQueueLeft = () => {
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.queueMode = null;
    this.queueRequiredPlayers = 0;
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

  private onGameComplete = (payload: { matchId?: string; winner?: 0 | 1 | null }) => {
    if (!this.match || payload?.matchId !== this.match.matchId) return;
    this.matchResult = {
      winner: payload.winner === 0 || payload.winner === 1 ? payload.winner : null,
    };
    this.disconnectedPlayers = {};
    this.emit();
  };

  private onGameSnapshot = (snapshot: AuthoritativeSnapshot<SimulationState>) => {
    if (!this.match || snapshot?.matchId !== this.match.matchId) return;
    if (snapshot.contentVersion !== this.match.contentVersion) {
      this.lastNetworkError = 'content-version-mismatch';
      this.emit();
      return;
    }

    const now = performance.now();
    this.authoritativeSnapshot = snapshot;
    this.snapshotReceivedAt = now;
    this.interpolation.push(snapshot);
    this.telemetry.recordSnapshot(now, snapshot.serverTick, 3);

    if (!this.prediction) this.prediction = new ClientPrediction(this.match.playerId);
    const reconciliation = this.prediction.acceptSnapshot(snapshot, this.estimatedServerTick());
    this.telemetry.recordCorrection(reconciliation.correctionDistance);
    this.predictedState = this.prediction.predictThrough(this.estimatedServerTick());
    this.emit();
  };

  private onSocketConnect = () => {
    this.startPingLoop();
    this.lastNetworkError = null;
    this.emit();
  };

  private onSocketDisconnect = () => {
    this.stopPingLoop();
    this.emit();
  };

  private onGameResumed = (data: MatchFoundPayload) => {
    this.onQueueFound(data);
  };

  private onPlayerDisconnected = (payload: {
    matchId?: string;
    playerId?: string;
    reconnectDeadline?: number;
  }) => {
    if (
      !this.match ||
      payload.matchId !== this.match.matchId ||
      typeof payload.playerId !== 'string' ||
      !Number.isFinite(payload.reconnectDeadline)
    ) return;
    this.disconnectedPlayers = {
      ...this.disconnectedPlayers,
      [payload.playerId]: Number(payload.reconnectDeadline),
    };
    this.emit();
  };

  private onPlayerReconnected = (payload: { matchId?: string; playerId?: string }) => {
    if (!this.match || payload.matchId !== this.match.matchId || typeof payload.playerId !== 'string') return;
    const next = { ...this.disconnectedPlayers };
    delete next[payload.playerId];
    this.disconnectedPlayers = next;
    this.emit();
  };

  private onSessionReplaced = () => {
    this.lastNetworkError = 'session-replaced-by-newer-connection';
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
    this.emit();
  };

  private bindSocketEvents(socket: Socket) {
    socket.on('connect', this.onSocketConnect);
    socket.on('disconnect', this.onSocketDisconnect);
    socket.on('queue:joined', this.onQueueJoined);
    socket.on('queue:found', this.onQueueFound);
    socket.on('queue:left', this.onQueueLeft);
    socket.on('connect_error', this.onConnectError);
    socket.on('game:error', this.onGameError);
    socket.on('game:snapshot', this.onGameSnapshot);
    socket.on('game:resumed', this.onGameResumed);
    socket.on('game:complete', this.onGameComplete);
    socket.on('game:player-disconnected', this.onPlayerDisconnected);
    socket.on('game:player-reconnected', this.onPlayerReconnected);
    socket.on('session:replaced', this.onSessionReplaced);
  }

  private unbindSocketEvents(socket: Socket) {
    socket.off('connect', this.onSocketConnect);
    socket.off('disconnect', this.onSocketDisconnect);
    socket.off('queue:joined', this.onQueueJoined);
    socket.off('queue:found', this.onQueueFound);
    socket.off('queue:left', this.onQueueLeft);
    socket.off('connect_error', this.onConnectError);
    socket.off('game:error', this.onGameError);
    socket.off('game:snapshot', this.onGameSnapshot);
    socket.off('game:resumed', this.onGameResumed);
    socket.off('game:complete', this.onGameComplete);
    socket.off('game:player-disconnected', this.onPlayerDisconnected);
    socket.off('game:player-reconnected', this.onPlayerReconnected);
    socket.off('session:replaced', this.onSessionReplaced);
  }

  connectSocket(token?: string) {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.lastNetworkError = null;
    const socket = io(WS_URL, {
      auth: { token, contentVersion: LOCAL_CONTENT_VERSION },
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
    this.stopPingLoop();
  }

  private resetNetworkMatchState() {
    this.authoritativeSnapshot = null;
    this.predictedState = null;
    this.snapshotReceivedAt = 0;
    this.prediction?.reset();
    this.prediction = null;
    this.interpolation.clear();
    this.telemetry.reset();
    this.disconnectedPlayers = {};
  }

  private startPingLoop() {
    this.stopPingLoop();
    const measure = () => {
      const socket = this.socket;
      if (!socket?.connected) return;
      const started = performance.now();
      socket.emit('net:ping', Date.now(), () => {
        this.telemetry.recordRtt(performance.now() - started);
        this.emit();
      });
    };
    measure();
    this.pingTimer = setInterval(measure, 2000);
  }

  private stopPingLoop() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  enterGuest(name?: string) {
    this.disconnectSocket();
    this.mode = 'guest';
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
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
    if (this.status !== 'online') return { ok: false, error: 'Servidor offline. Jogue como convidado.' };
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
    this.disconnectSocket();
    this.mode = 'account';
    this.user = user;
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
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
    this.queueMode = null;
    this.queueRequiredPlayers = 0;
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
    this.enterGuest('Convidado');
  }

  get isOnline() {
    return this.status === 'online';
  }

  joinQueue(mode: MatchMode = 'ranked5v5') {
    if (!this.isOnline || !this.socket || this.user?.mode !== 'account') return;
    if (this.serverInfo?.contentVersion !== LOCAL_CONTENT_VERSION) {
      this.lastNetworkError = 'content-version-mismatch';
      this.emit();
      return;
    }
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
    this.lastNetworkError = null;
    this.inQueue = true;
    this.queueMode = mode;
    this.queueRequiredPlayers = mode === 'duel1v1' ? 2 : mode === 'skirmish3v3' ? 6 : 10;
    this.queuePos = 0;
    this.emit();
    this.socket.emit('queue:join', { mode, contentVersion: LOCAL_CONTENT_VERSION });
  }

  leaveQueue() {
    if (!this.socket) return;
    this.socket.emit('queue:leave');
    this.inQueue = false;
    this.queuePos = null;
    this.queueEta = 0;
    this.queueMode = null;
    this.queueRequiredPlayers = 0;
    this.emit();
  }

  leaveMatch() {
    if (!this.socket || !this.match) {
      this.clearMatch();
      return;
    }
    this.socket.emit('game:leave', { matchId: this.match.matchId });
  }

  clearMatch() {
    this.match = null;
    this.matchResult = null;
    this.resetNetworkMatchState();
    this.snapshotReceivedAt = 0;
    this.emit();
  }

  private estimatedServerTick(): number {
    if (!this.match || !this.authoritativeSnapshot) return 0;
    const elapsedMs = Math.max(0, performance.now() - this.snapshotReceivedAt);
    const halfRtt = (this.telemetry.snapshot().rttMs ?? 0) / 2;
    return this.authoritativeSnapshot.serverTick +
      Math.floor((elapsedMs + halfRtt) / (1000 / this.match.serverTickRate));
  }

  private emitGameCommand(command: LocalSimulationCommand) {
    if (!this.socket || !this.match || !this.user || this.user.mode !== 'account') return false;
    const seq = this.nextInputSeq++;
    const tick = this.estimatedServerTick();
    const full = { ...command, playerId: this.user.id, seq, tick } as CoreSimulationCommand;
    this.prediction?.record(full);
    this.predictedState = this.prediction?.predictThrough(tick) ?? this.predictedState;
    this.socket.emit('game:input', {
      matchId: this.match.matchId,
      command: full,
    });
    this.emit();
    return true;
  }

  sendMove(x: number, y: number) {
    return this.emitGameCommand({ type: 'move', x, y });
  }

  sendAttack(targetId: number) {
    return this.emitGameCommand({ type: 'attack', targetId });
  }

  sendStop() {
    return this.emitGameCommand({ type: 'stop' });
  }

  sendBuy(itemId: string) {
    return this.emitGameCommand({ type: 'buy', itemId });
  }

  sendPlaceWard(x: number, y: number) {
    return this.emitGameCommand({ type: 'place-ward', x, y });
  }

  sendCastQ(target: { x?: number; y?: number; targetId?: number }) {
    return this.emitGameCommand({
      type: 'cast',
      slot: 'Q',
      ...(target.x === undefined ? {} : { x: target.x }),
      ...(target.y === undefined ? {} : { y: target.y }),
      ...(target.targetId === undefined ? {} : { targetId: target.targetId }),
    });
  }

  getInterpolatedFrame(): InterpolatedFrame | null {
    const latest = this.interpolation.latestTick;
    if (latest === null) return null;
    return this.interpolation.sample(Math.max(0, this.estimatedServerTick() - this.interpolationDelayTicks));
  }

  getNetworkMetrics(): NetworkMetricsSnapshot {
    return this.telemetry.snapshot();
  }

  get pendingInputs(): number {
    return this.prediction?.pendingCount ?? 0;
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
    matchResult: conn.matchResult,
    networkError: conn.lastNetworkError,
    authoritativeSnapshot: conn.authoritativeSnapshot,
    predictedState: conn.predictedState,
    networkMetrics: conn.getNetworkMetrics(),
    pendingInputs: conn.pendingInputs,
    queueMode: conn.queueMode,
    queueRequiredPlayers: conn.queueRequiredPlayers,
    disconnectedPlayers: conn.disconnectedPlayers,
  };
}
