# Multiplayer 0.6 — 3v3 Reliability + Reconnect

## Scope

This phase expands the authoritative multiplayer slice from Duel 1v1 to a six-player 3v3 mode while making disconnect/reconnect behavior explicit and server-owned.

## Match modes

The shared protocol now recognizes:

- `duel1v1` — 2 players
- `skirmish3v3` — 6 players
- `ranked5v5` — 10 players

Each mode owns an isolated matchmaking queue with an exact readiness threshold.

## Reconnect policy

A disconnect does **not** immediately end the match.

The server creates a reconnect lease with:

- match ID
- player ID
- team
- disconnect timestamp
- expiry timestamp

The current development grace window is 30 seconds.

If the same authenticated player reconnects before expiry:

1. the new socket replaces the previous controlling socket;
2. the player rejoins the same Socket.IO room;
3. the reconnect lease is cancelled;
4. a fresh authoritative snapshot is sent;
5. active disconnect leases for teammates/opponents are rehydrated to the client;
6. the room receives a player-reconnected event.

If the lease expires:

1. the server consumes the lease;
2. the MatchRunner receives a team-level authoritative forfeit;
3. the opposing team is declared winner;
4. the final authoritative snapshot and game-complete event are emitted;
5. match reconnect state is cleaned.

## Why team forfeit in 0.6

The current single-lane vertical slice does not yet support safe bot takeover or persistent player substitution. Allowing a team to continue permanently shorthanded would make early reliability tests ambiguous.

For 0.6, expiry of one player's reconnect window therefore forfeits that team. This is explicit, deterministic at the match-lifecycle level, and easy to replace later with bot takeover or substitute policies.

## Session integrity

A user may not:

- occupy two matchmaking slots;
- join multiple queues simultaneously;
- control the same match slot from two sockets.

On resume, the newest authenticated socket becomes the single controller. The previous socket is notified and disconnected without producing a false forfeit.

## Client UX

The multiplayer lobby exposes 1v1, 3v3 and 5v5 foundations side by side.

The authoritative match HUD displays:

- active mode;
- reconnect grace duration;
- disconnected player IDs;
- countdown until reconnect expiry;
- existing RTT/jitter/reconciliation telemetry.

## Verification

The branch is not considered complete until all of the following pass on the exact HEAD, again on the PR merge ref, and again on the merged main SHA:

- simulation boundary check;
- strict root TypeScript;
- 100k deterministic simulation suite;
- network client suite;
- production build;
- server TypeScript;
- MatchRunner tests;
- matchmaking tests;
- reconnect grace tests.
