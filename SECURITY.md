# Security status

ForgedMoba is currently an early development project.

## Important limitations

- Server accounts and matches are still stored in memory and disappear on restart.
- The browser currently stores the development JWT in localStorage.
- The authoritative match simulation is not connected yet; the server currently validates and relays input commands only.
- The admin/content system is local-browser tooling and must not be treated as a production authority.

## Protections introduced by the multiplayer foundation

- Passwords are hashed with Node scrypt plus a per-user random salt.
- Socket.IO JWTs are verified before a realtime connection is accepted.
- Auth endpoints have a small in-memory rate limiter.
- Production startup requires an explicit JWT_SECRET.
- Match sockets are joined to explicit rooms.
- Client-supplied world state is rejected.
- JSON and Socket.IO payload sizes are bounded at a coarse transport level.

## Production prerequisites

Before public production deployment, add a persistent database/session model, robust rate limiting, HTTPS-only deployment, secret management, session revocation/rotation, content signing/versioning, authoritative simulation, abuse telemetry and dependency/security scanning.
