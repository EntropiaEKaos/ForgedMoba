# 🖥️ Pixel Rift Server (Fase 2)

Servidor minimalista e funcional para multiplayer: **auth (JWT)** + **matchmaking (Socket.io)**.
Usa armazenamento **em memória** (não precisa de Docker/Postgres/Redis) para facilitar testes.

## ▶ Como rodar

```bash
cd server
npm install
npm run dev          # inicia em http://localhost:3001
```

O cliente (em `http://localhost:5173`) detecta o servidor via `GET /api/health` e liga o **modo online**.

## 🔌 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status do servidor + nº de jogadores online |
| POST | `/api/auth/register` | Criar conta (`{username, email, password}`) |
| POST | `/api/auth/login` | Entrar (`{username, password}`) → retorna `token` JWT |

## 📡 Eventos Socket.io

- `queue:join` → entra na fila (quando 10 jogadores, cria partida)
- `queue:joined` → posição e tempo estimado
- `queue:found` → partida encontrada (`{matchId}`)
- `queue:leave` → sai da fila
- `game:input` / `game:state` → sincronização de partida (placeholder)

## 🔄 Para produção (futuro)

Substitua o armazenamento em memória por:
- **PostgreSQL** (tabelas: users, matches, player_stats, rankings)
- **Redis** (fila de matchmaking persistente)
- **Bcrypt** para hash de senhas
- Validação com Zod + rate limiting

O schema SQL completo está documentado no `README.md` principal do projeto.
