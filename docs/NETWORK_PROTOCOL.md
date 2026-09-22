# ForgedMoba — Authoritative Network Protocol

## Trust model

The server is the source of truth for online simulation. Clients send intent, never final gameplay state.

Client intent currently accepted by the 0.2 vertical slice:

- move,
- attack target,
- stop.

Defined in the shared protocol but intentionally rejected until their authoritative runtimes exist:

- cast ability,
- buy item,
- upgrade skill,
- recall.

Never trusted from clients:

- damage dealt,
- HP after damage,
- gold balance,
- kill/death ownership,
- cooldown completion,
- objective death,
- world snapshots.

## Content identity

Every match is bound to a deterministic `contentVersion` composed from an explicit semantic version and a canonical FNV-1a hash of the simulation rules manifest. Match-found payloads and authoritative snapshots carry the same value. A client reports `content-version-mismatch` instead of silently consuming a snapshot from a different rule package.

## Matchmaking

When ten authenticated sockets are queued, the server:

1. removes ten entries from the queue,
2. creates a match ID and deterministic seed,
3. assigns team and slot,
4. joins each socket to the Socket.IO room,
5. creates a headless `MatchRunner`,
6. emits `queue:found` with match ID, team, slot, player ID, content version and tick rate,
7. emits the initial authoritative tick-0 snapshot,
8. starts the 30 Hz match runner.

Accounts and active-match metadata are still ephemeral in 0.2 and disappear on server restart.

## Input envelope

Each client command carries:

- matchId,
- type,
- seq,
- tick,
- command-specific fields.

The authenticated socket identity overwrites client player identity. `MatchRunner` currently accepts only move/attack/stop, requires strictly increasing sequence numbers and accepts ticks only from the current server tick through current+6. Stale, duplicate and excessively future commands are rejected with protocol error codes.

## Fixed-tick authority

`MatchRunner` owns the authoritative `SimulationState` and advances it at 30 ticks/second. Wall-clock time schedules ticks but never participates in gameplay calculations. Gameplay time remains integer simulation ticks.

Commands are queued by target tick, deterministically ordered in the simulation core, then applied to the state. Clients do not relay input authority to peers.

## Authoritative snapshots

The 0.2 runner emits a snapshot every three simulation ticks (~10 Hz) and on terminal game state. A snapshot contains:

- matchId,
- contentVersion,
- serverTick,
- ackSeqByPlayer,
- stateHash,
- serializable simulation state.

The browser stores the latest authoritative snapshot and estimates the current server tick only for command stamping. Prediction and reconciliation are deliberately deferred until the 0.4 client-network phase.

## Security foundation

Socket.IO requires a verified JWT. Development passwords use scrypt with random per-user salts. Client `game:state` messages are rejected. Payload sizes are bounded at transport level and auth endpoints have a small in-memory rate limiter.

This is not yet a production identity system: persistent sessions, revocation, durable rate limiting, database constraints and operational secret management remain prerequisites.

## Next protocol gates

- online UI adapter consuming snapshots,
- movement prediction and reconciliation,
- remote interpolation,
- reconnect token/slot reclamation,
- ability/item command schemas with server validation,
- per-event abuse budgets,
- delta compression,
- persistent account/session/match metadata,
- command-log replay and spectator transport.
