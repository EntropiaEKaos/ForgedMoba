# ForgedMoba Authoritative Server 4.0

Servidor autoritativo para autenticação, matchmaking 1v1/3v3/5v5, draft ranqueado, reconnect, simulação determinística e progressão online.

## Rodar localmente

    cd server
    npm install
    npm run dev

Cliente padrão: `http://localhost:5173`
Servidor padrão: `http://localhost:3001`

## Persistência

Por padrão o servidor usa o adapter `json-file` e grava `.data/forged-moba.json`.

Variáveis:

    FORGED_PERSISTENCE_MODE=file
    FORGED_DATA_FILE=/data/forged-moba.json
    JWT_SECRET=troque-isto-em-producao
    CORS_ORIGIN=https://seu-cliente.example

`FORGED_PERSISTENCE_MODE=memory` serve apenas para testes/ambientes descartáveis e é bloqueado quando `NODE_ENV=production`.

Para produção com file persistence, `FORGED_DATA_FILE` é obrigatório. Use volume persistente e backup. O adapter foi desenhado para ser substituído depois por PostgreSQL/Neon sem alterar MatchRunner ou o protocolo de jogo.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Saúde, filas, matches, versão de conteúdo e persistência |
| GET | `/api/content/current` | Pacote autoritativo publicado |
| POST | `/api/auth/register` | Cria conta e sessão |
| POST | `/api/auth/login` | Cria nova sessão |
| POST | `/api/auth/logout` | Revoga a sessão atual |
| GET | `/api/me/profile` | Perfil online + MMR |
| GET | `/api/me/history` | Histórico persistido |
| GET | `/api/leaderboard` | Ranking público 5v5 |

Rotas `/api/me/*` e logout usam `Authorization: Bearer <JWT>`.

## Segurança de sessão

O JWT contém um `sid`. A assinatura do token sozinha não basta: HTTP autenticado e Socket.IO também consultam a sessão persistida. Logout e expiração tornam a sessão inválida no servidor.

## Multiplayer

- Duel 1v1: 2 jogadores
- Skirmish 3v3: 6 jogadores
- Ranked 5v5: 10 jogadores + draft autoritativo
- Reconnect grace: 30s
- Snapshot autoritativo: 10 Hz sobre simulação a 30 Hz
- Clientes enviam apenas intenções; estado final é do servidor

## Qualidade

    npm run typecheck
    npm test
    npm run load:5v5

O CI da raiz executa também determinismo, rede, visual, build de produção e o load probe 5v5.
