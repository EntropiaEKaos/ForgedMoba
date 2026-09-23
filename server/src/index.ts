/**
 * ForgedMoba Online Server — foundation matchmaking/auth transport.
 *
 * This server is still development-only: user persistence remains in memory.
 * Match simulation authority will be introduced after the deterministic core slice.
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'pixel-rift-dev-secret';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  level: number;
}

interface TokenClaims {
  userId: string;
  username: string;
}

interface QueueEntry {
  userId: string;
  username: string;
  socketId: string;
}

interface ActiveMatch {
  matchId: string;
  players: QueueEntry[];
  createdAt: number;
}

const users = new Map<string, DbUser>();
const usersByName = new Map<string, string>();
const queue: QueueEntry[] = [];
const activeMatches = new Map<string, ActiveMatch>();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '32kb' }));

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function passwordMatches(password: string, encoded: string): boolean {
  const [saltHex, hashHex] = encoded.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(user: DbUser) {
  return jwt.sign(
    { userId: user.id, username: user.username } satisfies TokenClaims,
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function verifyToken(token: unknown): TokenClaims | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.userId === 'string' &&
      typeof payload.username === 'string'
    ) {
      return { userId: payload.userId, username: payload.username };
    }
  } catch {
    return null;
  }
  return null;
}

function removeSocketFromQueue(socketId: string) {
  const i = queue.findIndex(entry => entry.socketId === socketId);
  if (i >= 0) queue.splice(i, 1);
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.1.0-foundation',
    players: io.engine.clientsCount,
    queueSize: queue.length,
    activeMatches: activeMatches.size,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ error: 'Usuário deve ter entre 3 e 24 caracteres' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Senha deve ter entre 6 e 128 caracteres' });
  }
  if (usersByName.has(username)) return res.status(409).json({ error: 'Usuário já existe' });

  const id = crypto.randomUUID();
  const user: DbUser = { id, username, email, passwordHash: hashPassword(password), level: 1 };
  users.set(id, user);
  usersByName.set(username, id);
  return res.json({ user: { id, username, email, level: 1 }, token: sign(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Credenciais inválidas' });
  }

  const id = usersByName.get(username);
  if (!id) return res.status(401).json({ error: 'Usuário não encontrado' });
  const user = users.get(id);
  if (!user || !passwordMatches(password, user.passwordHash)) return res.status(401).json({ error: 'Senha incorreta' });

  return res.json({
    user: { id: user.id, username: user.username, email: user.email, level: user.level },
    token: sign(user),
  });
});

io.use((socket, next) => {
  const claims = verifyToken(socket.handshake.auth?.token);
  if (!claims) return next(new Error('unauthorized'));
  socket.data.userId = claims.userId;
  socket.data.username = claims.username;
  return next();
});

function authenticatedIdentity(socket: Socket): QueueEntry {
  return {
    userId: String(socket.data.userId),
    username: String(socket.data.username),
    socketId: socket.id,
  };
}

function createMatchIfReady() {
  while (queue.length >= 10) {
    const players = queue.splice(0, 10);
    const matchId = crypto.randomUUID();
    const match: ActiveMatch = { matchId, players, createdAt: Date.now() };
    activeMatches.set(matchId, match);

    players.forEach((player, index) => {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (!playerSocket) return;
      playerSocket.join(matchId);
      playerSocket.data.matchId = matchId;
      playerSocket.emit('queue:found', {
        matchId,
        team: index < 5 ? 0 : 1,
        slot: index % 5,
        players: players.map(p => ({ userId: p.userId, username: p.username })),
      });
    });

    console.log(`[match] created ${matchId} with ${players.length} players`);
  }
}

io.on('connection', socket => {
  console.log(`[socket] connected: ${socket.id} user=${socket.data.username}`);

  socket.on('queue:join', () => {
    if (queue.some(entry => entry.socketId === socket.id)) return;
    if (socket.data.matchId) return;

    queue.push(authenticatedIdentity(socket));
    socket.emit('queue:joined', {
      position: queue.length,
      estimatedTime: Math.max(10, queue.length * 30),
    });
    createMatchIfReady();
  });

  socket.on('queue:leave', () => {
    removeSocketFromQueue(socket.id);
    socket.emit('queue:left');
  });

  socket.on('game:input', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const payload = data as { matchId?: unknown; command?: unknown };
    const matchId = typeof payload.matchId === 'string' ? payload.matchId : '';
    if (!matchId || socket.data.matchId !== matchId || !activeMatches.has(matchId)) return;

    socket.to(matchId).emit('game:input', {
      playerId: socket.data.userId,
      command: payload.command,
    });
  });

  // Transitional transport only. The authoritative simulation runner will replace this event.
  socket.on('game:state', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const payload = data as { matchId?: unknown; state?: unknown };
    const matchId = typeof payload.matchId === 'string' ? payload.matchId : '';
    if (!matchId || socket.data.matchId !== matchId || !activeMatches.has(matchId)) return;
    socket.to(matchId).emit('game:state', { state: payload.state });
  });

  socket.on('disconnect', () => {
    removeSocketFromQueue(socket.id);
    const matchId = typeof socket.data.matchId === 'string' ? socket.data.matchId : null;
    if (matchId) {
      socket.to(matchId).emit('game:player-disconnected', { playerId: socket.data.userId });
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ForgedMoba server running at http://localhost:${PORT}`);
  console.log(`  CORS: ${CORS_ORIGIN}`);
  console.log('  Mode: in-memory development foundation\n');
});
