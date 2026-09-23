# Authoritative Duel 0.5

## Goal

Make the server-authoritative vertical slice directly playable with two real accounts, while preserving the 5v5 queue and all authority rules established in phases 0.1–0.4.

## Match modes

The shared protocol now defines:

- `duel1v1`: exactly 2 players, one per team;
- `ranked5v5`: exactly 10 players, five per team.

They use isolated queues and create the same deterministic `MatchRunner` with different player counts.

## Duel lifecycle

```text
account A → duel queue ┐
                       ├→ 2 players → match room → MatchRunner @30Hz
account B → duel queue ┘                       ↓
                                      10Hz snapshots
                                             ↓
                              prediction/reconciliation
                                             ↓
                                   authoritative result
```

The Duel currently validates the certified single-lane slice:

- server-authoritative movement;
- attack;
- Gareth/Luxana Q;
- minion waves;
- XP/gold/CS;
- tower targeting;
- tower destruction victory;
- prediction + reconciliation;
- remote interpolation;
- reconnect;
- forfeit.

## Queue integrity

`MatchmakingQueues` is a pure tested module.

Rules:

- one socket cannot occupy two queues;
- one account cannot occupy multiple queue slots via multiple tabs;
- Duel and Ranked queues never share entries;
- disconnect removes queued sockets;
- Duel readiness is 2 players;
- Ranked readiness is 10 players.

## Reconnect and single-control guarantee

An authenticated user reconnecting to an active match resumes the same player slot.

If an older socket still exists:

1. its match identity is cleared;
2. it receives `session:replaced`;
3. it is disconnected;
4. the new socket becomes the single controlling socket;
5. the new socket joins the room and receives a fresh authoritative snapshot.

This prevents two tabs from issuing competing command sequences for one player.

## Forfeit

Leaving an active match is an authoritative action.

`MatchRunner.forfeit(playerId)` determines the opposing team as winner, emits the final snapshot and completes the match. The server emits `game:complete`; the client shows the server-confirmed victory/defeat result.

A raw network disconnect is not a forfeit because reconnect is supported.

## Completion cleanup

On completion:

- final snapshot is emitted exactly once;
- `game:complete` is broadcast;
- participant socket match identities are cleared;
- sockets leave the match room;
- the active match record is removed.

## Certification

The phase is not merged until the exact HEAD passes:

- architecture boundary gate;
- strict root TypeScript;
- 100k deterministic simulation suite;
- network prediction/reconciliation suite;
- production build;
- server TypeScript;
- MatchRunner tests including forfeit;
- matchmaking queue tests;
- PR CI;
- post-merge main CI.
