/**
 * ForgedMoba Online Foundation
 * ----------------------------
 * Backend de desenvolvimento para autenticação, fila e salas Socket.IO.
 *
 * IMPORTANTE: usuários/partidas ainda vivem em memória. Este servidor é adequado
 * para integração e testes, não para produção persistente.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { Server as SocketServer, type Socket } from 'socket.io';
import cors from 'cors';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const SERVER_VERSION = '2.1.0';

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }
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

interface QueueEntry {
  userId: string;
  username: string;
  socketId: string;
}

interface MatchPlayer extends QueueEntry {
  team: 0 | 1;
  slot: number;
}

interface ActiveMatch {
  id: string;
  players: MatchPlayer[];
  createdAt: number;
}

interface AuthedSocketData {
  userId: string;
  username: string;
  matchId?: string;
}

interface GameInputPayload {
  matchId?: unknown;
  command?: unknown;
}

interface SafeCommand {
  type: string;
  seq: number;
  tick: number;
  [key: string]: unknown;
}

const users = new Map<string, DbUser>();
const usersByName = new Map<string, string>();
const usersByEmail = new Map<string, string>();
const queue: QueueEntry[] = [];
const activeMatches = new Map<string, ActiveMatch>();

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
  const windowMs = 60_000;
  const maxRequests = 20;
  const current = authRate.get(key);

  if (!current || current.resetAt <= now) {
    authRate.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  current.count += 1;
  if (current.count > maxRequests) {
    res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    return;
  }
  next();
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

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
  const index = queue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) queue.splice(index, 1);
}

function socketIdentity(socket: Socket): AuthedSocketData {
  return socket.data as AuthedSocketData;
}

function parseSafeCommand(value: unknown): SafeCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== 'string' || raw.type.length > 32) return null;
  if (!Number.isSafeInteger(raw.seq) || (raw.seq as number) < 0) return null;
  if (!Number.isSafeInteger(raw.tick) || (raw.tick as number) < 0) return null;
  return { ...raw, type: raw.type, seq: raw.seq as number, tick: raw.tick as number };
}

function createMatch(players: QueueEntry[]): ActiveMatch {
  const id = randomUUID();
  const assigned = players.map<MatchPlayer>((player, index) => ({
    ...player,
    team: index < 5 ? 0 : 1,
    slot: index % 5,
  }));
  const match: ActiveMatch = { id, players: assigned, createdAt: Date.now() };
  activeMatches.set(id, match);

  for (const player of assigned) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (!playerSocket) continue;
    playerSocket.join(id);
    socketIdentity(playerSocket).matchId = id;
    playerSocket.emit('queue:found', {
      matchId: id,
      team: player.team,
      slot: player.slot,
      playerId: player.userId,
    });
  }

  return match;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: SERVER_VERSION,
    mode: 'ephemeral',
    players: io.engine.clientsCount,
    queueSize: queue.length,
    activeMatches: activeMatches.size,
  });
});

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
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Credenciais inválidas.' });
  }

  const id = usersByName.get(normalizeIdentity(username));
  const user = id ? users.get(id) : undefined;
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  return res.json({
    user: { id: user.id, username: user.username, email: user.email, level: user.level },
    token: sign(user),
  });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) return next(new Error('unauthorized'));

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId?: string; username?: string };
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
  console.log('[socket] conectado: ' + identity.username + ' (' + socket.id + ')');

  socket.on('queue:join', () => {
    if (identity.matchId || queue.some((entry) => entry.socketId === socket.id)) return;
    queue.push({ userId: identity.userId, username: identity.username, socketId: socket.id });
    socket.emit('queue:joined', {
      position: queue.length,
      estimatedTime: Math.max(10, queue.length * 30),
    });

    if (queue.length >= 10) {
      const players = queue.splice(0, 10);
      const match = createMatch(players);
      console.log('[match] criada ' + match.id + ' com ' + match.players.length + ' jogadores');
    }
  });

  socket.on('queue:leave', () => {
    removeSocketFromQueue(socket.id);
    socket.emit('queue:left');
  });

  socket.on('game:input', (payload: GameInputPayload) => {
    const matchId = identity.matchId;
    const command = parseSafeCommand(payload?.command);
    if (!matchId || payload?.matchId !== matchId || !activeMatches.has(matchId) || !command) {
      socket.emit('game:error', { code: 'invalid-input' });
      return;
    }

    io.to(matchId).emit('game:input', {
      matchId,
      playerId: identity.userId,
      receivedAt: Date.now(),
      command: { ...command, playerId: identity.userId },
    });
  });

  socket.on('game:state', () => {
    socket.emit('game:error', { code: 'client-state-rejected' });
  });

  socket.on('disconnect', () => {
    removeSocketFromQueue(socket.id);
    const matchId = identity.matchId;
    if (matchId && activeMatches.has(matchId)) {
      socket.to(matchId).emit('game:player-left', { matchId, playerId: identity.userId });
    }
    console.log('[socket] desconectado: ' + identity.username + ' (' + socket.id + ')');
  });
});

httpServer.listen(PORT, () => {
  console.log('\n  ForgedMoba Server ' + SERVER_VERSION + ' em http://localhost:' + PORT);
  console.log('  CORS: ' + CORS_ORIGIN);
  console.log('  Persistência: memória (ambiente de desenvolvimento)\n');
});
