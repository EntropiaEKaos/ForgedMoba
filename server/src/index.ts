/**
 * ForgedMoba Online Foundation 0.2
 * --------------------------------
 * Auth + matchmaking + authoritative deterministic single-lane match runners.
 * Accounts and match metadata are still in-memory development infrastructure.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { Server as SocketServer, type Socket } from 'socket.io';
import cors from 'cors';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { MatchMode, PlayerCommand } from '../../src/shared/protocol.ts';
import { createContentManifest } from '../../src/shared/contentVersion.ts';
import { SIM_TICK_RATE } from '../../src/simulation/index.ts';
import { MatchRunner, stableSeedFromMatchId } from './matchRunner.ts';
import { MatchmakingQueues, type MatchmakingEntry } from './matchmaking.ts';
import { ReconnectGraceRegistry } from './reconnectGrace.ts';

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const SERVER_VERSION = '2.5.0';
const RECONNECT_GRACE_MS = 30_000;
const CONTENT_MANIFEST = createContentManifest('core-0.3', {
  simulationVersion: 3,
  tickRate: SIM_TICK_RATE,
  mode: 'single-lane-authority-v2',
  minionWaveSeconds: 30,
});
const CONTENT_VERSION = CONTENT_MANIFEST.version + '+' + CONTENT_MANIFEST.hash;

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET é obrigatório em produção.');
  return 'pixel-rift-dev-secret';
}
const JWT_SECRET = resolveJwtSecret();

interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  level: number;
}
interface QueueEntry extends MatchmakingEntry {}
interface MatchPlayer extends QueueEntry { team: 0 | 1; slot: number; }
interface ActiveMatch {
  id: string;
  mode: MatchMode;
  players: MatchPlayer[];
  createdAt: number;
  runner: MatchRunner;
}
interface AuthedSocketData { userId: string; username: string; matchId?: string; }
interface GameInputPayload { matchId?: unknown; command?: unknown; }

const users = new Map<string, DbUser>();
const usersByName = new Map<string, string>();
const usersByEmail = new Map<string, string>();
const matchmaking = new MatchmakingQueues();
const activeMatches = new Map<string, ActiveMatch>();
const reconnectGrace = new ReconnectGraceRegistry(RECONNECT_GRACE_MS);

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  maxHttpBufferSize: 64 * 1024,
});
app.disable('x-powered-by');
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '32kb' }));

const authRate = new Map<string, { count: number; resetAt: number }>();
function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = authRate.get(key);
  if (!current || current.resetAt <= now) {
    authRate.set(key, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  current.count += 1;
  if (current.count > 20) {
    res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    return;
  }
  next();
}

function normalizeIdentity(value: string): string { return value.trim().toLowerCase(); }
function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(value.trim());
}
function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}
function hashPassword(password: string, salt = randomBytes(16).toString('hex')): { hash: string; salt: string } {
  return { hash: scryptSync(password, salt, 64).toString('hex'), salt };
}
function verifyPassword(password: string, user: DbUser): boolean {
  const actual = Buffer.from(scryptSync(password, user.passwordSalt, 64));
  const expected = Buffer.from(user.passwordHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function sign(user: DbUser): string {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
function removeSocketFromQueue(socketId: string): void {
  matchmaking.leaveBySocket(socketId);
}

function parseMatchMode(value: unknown): MatchMode | null {
  return value === 'duel1v1' || value === 'skirmish3v3' || value === 'ranked5v5' ? value : null;
}
function socketIdentity(socket: Socket): AuthedSocketData { return socket.data as AuthedSocketData; }

function parsePlayerCommand(value: unknown, playerId: string): PlayerCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== 'string' || raw.type.length > 32) return null;
  if (!Number.isSafeInteger(raw.seq) || (raw.seq as number) < 0) return null;
  if (!Number.isSafeInteger(raw.tick) || (raw.tick as number) < 0) return null;
  return { ...raw, playerId } as PlayerCommand;
}

function matchForUser(userId: string): { match: ActiveMatch; player: MatchPlayer } | null {
  for (const match of activeMatches.values()) {
    const player = match.players.find((entry) => entry.userId === userId);
    if (player) return { match, player };
  }
  return null;
}

function foundPayload(match: ActiveMatch, player: MatchPlayer) {
  return {
    matchId: match.id,
    mode: match.mode,
    team: player.team,
    slot: player.slot,
    playerId: player.userId,
    contentVersion: CONTENT_VERSION,
    serverTickRate: SIM_TICK_RATE,
    reconnectGraceMs: RECONNECT_GRACE_MS,
  };
}

function createMatch(players: QueueEntry[], mode: MatchMode): ActiveMatch {
  const id = randomUUID();
  const teamSize = Math.max(1, Math.ceil(players.length / 2));
  const assigned = players.map<MatchPlayer>((player, index) => ({
    ...player,
    team: index < teamSize ? 0 : 1,
    slot: index < teamSize ? index : index - teamSize,
  }));
  const runner = new MatchRunner({
    matchId: id,
    contentVersion: CONTENT_VERSION,
    seed: stableSeedFromMatchId(id),
    players: assigned.map((player) => ({ playerId: player.userId, team: player.team, slot: player.slot })),
    onSnapshot: (snapshot) => io.to(id).emit('game:snapshot', snapshot),
    onComplete: (state) => {
      console.log('[match] concluída ' + id + ' vencedor=' + state.winner);
      io.to(id).emit('game:complete', { matchId: id, winner: state.winner });
      const completed = activeMatches.get(id);
      if (completed) {
        for (const participant of completed.players) {
          const participantSocket = io.sockets.sockets.get(participant.socketId);
          if (participantSocket) {
            delete socketIdentity(participantSocket).matchId;
            participantSocket.leave(id);
          }
        }
      }
      reconnectGrace.clearMatch(id);
      activeMatches.delete(id);
    },
  });
  const match: ActiveMatch = { id, mode, players: assigned, createdAt: Date.now(), runner };
  activeMatches.set(id, match);

  for (const player of assigned) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (!playerSocket) continue;
    playerSocket.join(id);
    socketIdentity(playerSocket).matchId = id;
    playerSocket.emit('queue:found', foundPayload(match, player));
  }
  io.to(id).emit('game:snapshot', runner.snapshot());
  runner.start();
  return match;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: SERVER_VERSION,
    mode: 'ephemeral-authoritative-slice',
    contentVersion: CONTENT_VERSION,
    tickRate: SIM_TICK_RATE,
    players: io.engine.clientsCount,
    queueSize: matchmaking.size('ranked5v5'),
    duelQueueSize: matchmaking.size('duel1v1'),
    skirmishQueueSize: matchmaking.size('skirmish3v3'),
    reconnectGraceMs: RECONNECT_GRACE_MS,
    activeMatches: activeMatches.size,
  });
});

const reconnectSweep = setInterval(() => {
  for (const lease of reconnectGrace.consumeExpired()) {
    const match = activeMatches.get(lease.matchId);
    if (!match) continue;
    const participant = match.players.find((entry) => entry.userId === lease.playerId);
    if (!participant) continue;
    console.log(
      '[reconnect] grace expirou match=' + lease.matchId +
      ' player=' + lease.playerId + ' team=' + lease.team,
    );
    match.runner.forfeitTeam(lease.team);
  }
}, 1_000);
reconnectSweep.unref();

app.post('/api/auth/register', authRateLimit, (req, res) => {
  const { username, email, password } = req.body as Record<string, unknown>;
  if (!isValidUsername(username)) return res.status(400).json({ error: 'Usuário deve ter 3-24 caracteres alfanuméricos/_.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Senha deve ter 8-128 caracteres.' });
  const nameKey = normalizeIdentity(username);
  const emailKey = normalizeIdentity(email);
  if (usersByName.has(nameKey)) return res.status(409).json({ error: 'Usuário já existe.' });
  if (usersByEmail.has(emailKey)) return res.status(409).json({ error: 'E-mail já cadastrado.' });
  const id = randomUUID();
  const secured = hashPassword(password);
  const user: DbUser = {
    id,
    username: username.trim(),
    email: email.trim(),
    passwordHash: secured.hash,
    passwordSalt: secured.salt,
    level: 1,
  };
  users.set(id, user);
  usersByName.set(nameKey, id);
  usersByEmail.set(emailKey, id);
  return res.status(201).json({
    user: { id, username: user.username, email: user.email, level: user.level },
    token: sign(user),
  });
});

app.post('/api/auth/login', authRateLimit, (req, res) => {
  const { username, password } = req.body as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Credenciais inválidas.' });
  const id = usersByName.get(normalizeIdentity(username));
  const user = id ? users.get(id) : undefined;
  if (!user || !verifyPassword(password, user)) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  return res.json({
    user: { id: user.id, username: user.username, email: user.email, level: user.level },
    token: sign(user),
  });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) return next(new Error('unauthorized'));
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId?: string };
    if (typeof decoded.userId !== 'string') return next(new Error('unauthorized'));
    const user = users.get(decoded.userId);
    if (!user) return next(new Error('unauthorized'));
    socket.data = { userId: user.id, username: user.username } satisfies AuthedSocketData;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const identity = socketIdentity(socket);
  const resumable = matchForUser(identity.userId);
  if (resumable) {
    const reconnectStatus = reconnectGrace.resolveReconnect(resumable.match.id, identity.userId);
    if (reconnectStatus === 'expired') {
      resumable.match.runner.forfeitTeam(resumable.player.team);
      socket.emit('game:error', { code: 'reconnect-window-expired' });
    } else {
    const previousSocketId = resumable.player.socketId;
    if (previousSocketId && previousSocketId !== socket.id) {
      const previousSocket = io.sockets.sockets.get(previousSocketId);
      if (previousSocket) {
        delete socketIdentity(previousSocket).matchId;
        previousSocket.emit('session:replaced');
        previousSocket.disconnect(true);
      }
    }
    resumable.player.socketId = socket.id;
    identity.matchId = resumable.match.id;
    socket.join(resumable.match.id);
    socket.emit('game:resumed', foundPayload(resumable.match, resumable.player));
    socket.emit('game:snapshot', resumable.match.runner.snapshot());
    for (const lease of reconnectGrace.forMatch(resumable.match.id)) {
      socket.emit('game:player-disconnected', {
        matchId: resumable.match.id,
        playerId: lease.playerId,
        reconnectDeadline: lease.expiresAt,
      });
    }
    socket.to(resumable.match.id).emit('game:player-reconnected', {
      matchId: resumable.match.id,
      playerId: identity.userId,
    });
    }
  }

  socket.on('net:ping', (_clientSentAt: unknown, ack?: () => void) => {
    if (typeof ack === 'function') ack();
  });

  console.log('[socket] conectado: ' + identity.username + ' (' + socket.id + ')');

  socket.on('queue:join', (payload?: { mode?: unknown }) => {
    if (identity.matchId) return;
    const mode = parseMatchMode(payload?.mode ?? 'ranked5v5');
    if (!mode) {
      socket.emit('game:error', { code: 'invalid-match-mode' });
      return;
    }

    const joined = matchmaking.join(
      { userId: identity.userId, username: identity.username, socketId: socket.id },
      mode,
    );
    socket.emit('queue:joined', {
      mode: joined.mode,
      position: joined.position,
      requiredPlayers: joined.requiredPlayers,
      estimatedTime: Math.max(
        5,
        joined.position * (joined.mode === 'duel1v1' ? 10 : joined.mode === 'skirmish3v3' ? 15 : 30),
      ),
    });

    const ready = matchmaking.takeReady(joined.mode);
    if (ready) {
      const match = createMatch(ready, joined.mode);
      console.log(
        '[match] criada ' + match.id + ' mode=' + joined.mode +
        ' jogadores=' + match.players.length + '; tick=' + SIM_TICK_RATE + 'Hz',
      );
    }
  });

  socket.on('queue:leave', () => {
    removeSocketFromQueue(socket.id);
    socket.emit('queue:left');
  });

  socket.on('game:input', (payload: GameInputPayload) => {
    const matchId = identity.matchId;
    const command = parsePlayerCommand(payload?.command, identity.userId);
    const match = matchId ? activeMatches.get(matchId) : undefined;
    if (!matchId || payload?.matchId !== matchId || !match || !command) {
      socket.emit('game:error', { code: 'invalid-input' });
      return;
    }
    const result = match.runner.enqueue(identity.userId, command);
    if (!result.ok) socket.emit('game:error', { code: result.code });
  });

  socket.on('game:state', () => socket.emit('game:error', { code: 'client-state-rejected' }));

  socket.on('game:leave', (payload?: { matchId?: unknown }) => {
    const matchId = identity.matchId;
    const match = matchId ? activeMatches.get(matchId) : undefined;
    if (!matchId || payload?.matchId !== matchId || !match) {
      socket.emit('game:error', { code: 'invalid-leave' });
      return;
    }
    match.runner.forfeit(identity.userId);
  });

  socket.on('disconnect', () => {
    removeSocketFromQueue(socket.id);
    const matchId = identity.matchId;
    const match = matchId ? activeMatches.get(matchId) : undefined;
    const participant = match?.players.find((entry) => entry.userId === identity.userId);
    if (matchId && match && participant && participant.socketId === socket.id) {
      const lease = reconnectGrace.markDisconnected(matchId, identity.userId, participant.team);
      socket.to(matchId).emit('game:player-disconnected', {
        matchId,
        playerId: identity.userId,
        reconnectDeadline: lease.expiresAt,
      });
    }
    console.log('[socket] desconectado: ' + identity.username + ' (' + socket.id + ')');
  });
});

httpServer.listen(PORT, () => {
  console.log('\n  ForgedMoba Server ' + SERVER_VERSION + ' em http://localhost:' + PORT);
  console.log('  Conteúdo: ' + CONTENT_VERSION + ' | simulação: ' + SIM_TICK_RATE + 'Hz');
  console.log('  CORS: ' + CORS_ORIGIN);
  console.log('  Persistência: memória (ambiente de desenvolvimento)\n');
});
