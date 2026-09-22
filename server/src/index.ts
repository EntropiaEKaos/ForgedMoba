/**
 * Pixel Rift Online Server (Fase 2)
 * --------------------------------
 * Servidor mínimo e funcional: auth (JWT, em memória) + matchmaking (Socket.io).
 * Não requer Postgres/Redis — usa armazenamento em memória para facilitar testes.
 *
 * Como rodar:
 *   cd server
 *   npm install
 *   npm run dev          # http://localhost:3001
 *
 * O cliente detecta o servidor via GET /api/health e habilita o modo online.
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'pixel-rift-dev-secret';

// ---------- Armazenamento em memória ----------
interface DbUser { id: string; username: string; email: string; password: string; level: number; }
const users = new Map<string, DbUser>();          // id -> user
const usersByName = new Map<string, string>();     // username -> id
const queue: { userId: string; username: string; socketId: string }[] = [];
const activeMatches = new Map<string, any>();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGIN, credentials: true } });

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ---------- Auth ----------
function sign(user: DbUser) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', players: io.engine.clientsCount, queueSize: queue.length });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  if (username.length < 3) return res.status(400).json({ error: 'Usuário muito curto' });
  if (usersByName.has(username)) return res.status(409).json({ error: 'Usuário já existe' });
  const id = crypto.randomUUID();
  const user: DbUser = { id, username, email, password, level: 1 };
  users.set(id, user);
  usersByName.set(username, id);
  res.json({ user: { id, username, email, level: 1 }, token: sign(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const id = usersByName.get(username);
  if (!id) return res.status(401).json({ error: 'Usuário não encontrado' });
  const user = users.get(id)!;
  if (user.password !== password) return res.status(401).json({ error: 'Senha incorreta' });
  res.json({ user: { id: user.id, username: user.username, email: user.email, level: user.level }, token: sign(user) });
});

// ---------- Socket.io: matchmaking ----------
io.on('connection', (socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  socket.on('queue:join', () => {
    if (queue.some(q => q.socketId === socket.id)) return;
    queue.push({ userId: socket.id, username: socket.id.slice(0, 6), socketId: socket.id });
    socket.emit('queue:joined', { position: queue.length, estimatedTime: Math.max(10, queue.length * 30) });
    console.log(`[queue] +1 (total: ${queue.length})`);
    // Quando houver 10 jogadores, monta a partida
    if (queue.length >= 10) {
      const players = queue.splice(0, 10);
      const matchId = crypto.randomUUID();
      activeMatches.set(matchId, { players, createdAt: Date.now() });
      for (const p of players) {
        io.to(p.socketId).emit('queue:found', { matchId });
      }
      console.log(`[match] criada ${matchId} com 10 jogadores`);
    }
  });

  socket.on('queue:leave', () => {
    const i = queue.findIndex(q => q.socketId === socket.id);
    if (i >= 0) { queue.splice(i, 1); console.log(`[queue] -1 (total: ${queue.length})`); }
    socket.emit('queue:left');
  });

  // Encaminhamento de inputs/state para sincronização de partida (placeholder p/ Fase 2)
  socket.on('game:input', (data) => socket.to(data.matchId).emit('game:input', { playerId: socket.id, ...data }));
  socket.on('game:state', (data) => socket.to(data.matchId).emit('game:state', data));

  socket.on('disconnect', () => {
    const i = queue.findIndex(q => q.socketId === socket.id);
    if (i >= 0) queue.splice(i, 1);
    console.log(`[socket] desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  🎮 Pixel Rift Server (Fase 2) rodando em http://localhost:${PORT}`);
  console.log(`  📡 CORS: ${CORS_ORIGIN}`);
  console.log(`  💾 Modo: memória (sem DB) — pronto para testes\n`);
});
