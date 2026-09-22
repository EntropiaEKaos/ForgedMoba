# ForgedMoba — Network Protocol Foundation

This document describes the direction of the online protocol while the legacy game remains offline-authoritative.

## Trust model

The server is the future source of truth. A client may request actions but may never author final combat/economy state.

Allowed client intent examples:

- move,
- attack target,
- cast ability,
- buy item,
- upgrade skill,
- recall.

Not trusted from clients:

- damage dealt,
- HP after damage,
- gold balance,
- kill/death ownership,
- cooldown completion,
- objective death,
- final world snapshot.

## Matchmaking

When ten authenticated sockets are queued, the server:

1. removes ten entries atomically from the in-memory queue,
2. creates a match ID,
3. assigns team and slot,
4. joins each socket to the Socket.IO room for that match,
5. emits queue:found with matchId, team, slot and playerId.

The current server remains ephemeral: account and match metadata are lost on restart.

## Socket authentication

Socket.IO connection requires a JWT in handshake.auth.token. The server verifies it and resolves the associated in-memory user before accepting the socket.

The development JWT fallback secret must never be used with NODE_ENV=production; production startup requires JWT_SECRET.

## Input envelope

Target fields:

- matchId
- command.type
- command.seq
- command.tick
- command-specific fields

The server overwrites/attaches player identity from the authenticated socket; it does not trust a player ID supplied by the client.

## State transport

game:state sent by a client is rejected by the foundation server. When authoritative match runners are connected, only the server will emit authoritative snapshots/deltas.

Target snapshot metadata:

- matchId
- serverTick
- ackSeqByPlayer
- stateHash
- state

## Next protocol gates

- per-player monotonic input sequence validation server-side,
- bounded future/past tick acceptance window,
- authoritative simulation room runner,
- snapshot delta encoding,
- reconnect token and slot reclamation,
- heartbeat/latency telemetry,
- abuse limits per event type,
- persistent account/session store.
