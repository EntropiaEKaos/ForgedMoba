# ForgedMoba — Production Backend 4.0

Production Backend 4.0 removes the largest remaining single-process prototype limitation from account progression without touching the certified deterministic match simulation.

## Scope

This phase introduces:

- a persistence interface isolated from Express, Socket.IO and MatchRunner;
- an in-memory adapter for tests;
- an atomic JSON-file adapter for durable single-node deployments;
- persistent accounts and password hashes;
- persistent revocable server sessions;
- JWTs bound to server-side session IDs;
- ranked 5v5 MMR and W/L progression;
- idempotent completed-match recording;
- authenticated online profile and match-history endpoints;
- public ranked leaderboard endpoint;
- automatic client profile refresh after authoritative match completion;
- UI visibility for MMR and persistence mode.

## Persistence model

The default development mode is `json-file`.

Default path: `server/.data/forged-moba.json` when the server is started from the `server` directory.

Configuration:

- `FORGED_PERSISTENCE_MODE=file`
- `FORGED_DATA_FILE=/absolute/or/mounted/path/forged-moba.json`

`FORGED_PERSISTENCE_MODE=memory` remains available for tests and disposable development environments.

Production explicitly refuses memory mode. Production file mode requires `FORGED_DATA_FILE` so deployment cannot silently write progression into an ephemeral working directory.

## Durability behavior

The file adapter:

1. keeps indexed state in memory for low-latency reads;
2. serializes each mutation;
3. writes a complete snapshot to a temporary file;
4. creates the file with mode `0600`;
5. atomically renames the temp file over the active state file.

This prevents partial JSON from becoming the canonical state if the process stops during a write.

This is a **durable single-node baseline**, not the final horizontally-scaled persistence layer. The persistence interface is intentionally designed so PostgreSQL/Neon can replace the JSON adapter without changing auth, matchmaking or simulation APIs.

## Sessions

A login or registration creates a persistent session record.

The JWT now carries `userId`, `username` and `sid` (server session ID). Socket.IO and authenticated HTTP endpoints require both a valid JWT and an active, non-revoked, non-expired server session with the same user ID.

`POST /api/auth/logout` revokes the session server-side. Deleting the token only in the browser is no longer the security boundary.

## Ranked progression

Initial ranked MMR: `1000`.

Ranked 5v5 uses a team-average Elo expectation with K=32. The completed match record stores each participant's team/slot, hero ID when available, MMR before and MMR after.

Recording is idempotent by `matchId`, so replaying a completion callback cannot double-award rating.

Duel and 3v3 are persisted in overall match history but do not modify ranked MMR in this phase.

## HTTP surface

- `GET /api/health` includes persistence mode/durability/counters.
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me/profile`
- `GET /api/me/history?limit=20`
- `GET /api/leaderboard?limit=50`

Authenticated routes use `Authorization: Bearer <token>`.

## Client behavior

On startup, an account token is validated through `/api/me/profile` before Socket.IO connects. After `game:complete`, the client refreshes the online profile so MMR/W/L changes are visible without re-login. Logout performs a best-effort server revocation before clearing local state.

## What remains after 4.0

For public scale-out production: PostgreSQL/Neon adapter, Redis or equivalent shared matchmaking/session coordination, refresh-token rotation/device session management, centralized distributed rate limiting, structured logs/metrics/tracing, migrations and backup/restore automation.

Those can now be added behind stable interfaces instead of being mixed into gameplay code.
