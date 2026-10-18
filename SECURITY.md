# Security status

ForgedMoba now has deterministic authoritative multiplayer and a durable single-node progression backend. This document lists the current security boundary without overstating production readiness.

## Current protections

- Passwords are hashed with Node scrypt plus a per-user random salt.
- Production startup requires an explicit `JWT_SECRET`.
- Login/registration create a server-side session ID (`sid`) persisted separately from the JWT.
- HTTP authenticated routes and Socket.IO verify both JWT validity and an active non-revoked session.
- Logout revokes the active server session.
- Client-authored world state is rejected; clients send only gameplay intent.
- Matchmaking uses authenticated identities, explicit rooms and content-version checks.
- Reconnect replaces the previous controlling socket instead of allowing dual control.
- JSON and Socket.IO payload sizes are bounded at the transport level.
- Auth endpoints use a coarse in-process rate limiter.
- The file persistence adapter writes state through temp-file + atomic rename and creates the state file with mode `0600`.
- Production refuses volatile memory persistence and requires an explicit durable file path when using the file adapter.

## Important remaining limitations

- The browser still stores the bearer JWT in `localStorage`; an XSS bug could therefore expose the token.
- Session records are durable, but there is no refresh-token rotation/device-management flow yet.
- File persistence is single-node. It is not safe as a shared store for horizontally scaled server replicas.
- Matchmaking, reconnect leases, active draft rooms and active simulations remain process-local runtime state.
- Auth rate limiting is process-local rather than distributed.
- Structured security/audit telemetry is still limited.
- PostgreSQL/Neon, Redis/shared coordination, migrations and automated backup/restore are not implemented yet.

## Production scale-out prerequisites

Before broad public deployment, add a transactional database adapter, shared matchmaking/session coordination, refresh-token rotation, centralized rate limiting, HTTPS-only deployment, secret rotation, structured audit logs/metrics/tracing, backup/restore drills, dependency scanning and an XSS-focused review of the web client.
