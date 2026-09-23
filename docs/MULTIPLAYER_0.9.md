# Multiplayer 0.9 — Ranked Draft + 5v5 Load Gate

## Goal

0.9 separates ranked matchmaking from gameplay startup.

A tenth queued player no longer causes a 5v5 MatchRunner to start immediately. Ranked players first enter a server-owned draft room. The authoritative match is created only after the lobby is complete and valid.

Duel 1v1 and Skirmish 3v3 remain direct-to-match modes.

## Ranked draft lifecycle

```text
ranked5v5 queue
      ↓
10 players matched
      ↓
RankedDraftRoom
      ↓
roles + published hero picks + ready locks
      ↓
10 connected / 10 picked / 10 ready
      ↓
MatchRunner 5v5
```

### Stable team roles

Each team has one stable slot for:

- TOP
- JUNGLE
- MID
- CARRY
- SUPPORT

Roles are assigned by server-owned slot order. Reconnect preserves the same team, slot and role.

### Hero selection

A pick is accepted only when the hero ID exists in the active published authoritative content pack.

The current online authoritative catalog contains Gareth and Luxana, so duplicate picks are temporarily allowed. Competitive unique-pick / ban rules should only be enabled after the authoritative hero catalog is large enough to support them safely.

A player cannot change a pick while individually marked READY.

### Ready gate

The server launches the match only when all ten players are:

- connected;
- holding a valid published hero pick;
- READY.

Immediately before launch, the Socket.IO server verifies that all ten controlling sockets still exist. This avoids creating an authoritative match from a stale final-ready race.

### Reconnect and timeout

Draft state is held server-side.

A reconnecting authenticated player:

- replaces the previous draft socket;
- keeps the same team/slot/role;
- keeps the selected hero;
- keeps READY state;
- receives the newest full draft snapshot.

The current draft deadline is 120 seconds. An expired or explicitly abandoned draft is cancelled before any MatchRunner state is created.

## Client

The ranked draft screen is a projection of `DraftStatePayload`.

It shows:

- both five-player teams;
- role assignment;
- connection state;
- selected hero;
- READY state;
- room deadline;
- published hero choices.

The browser sends only pick/ready/leave intentions. It does not assign teams, roles or launch the match.

## Match launch

Draft-selected hero IDs are passed into `MatchRunnerPlayer`.

A regression test verifies that the selected authoritative hero becomes the hero owned by that player in the simulation state.

## 5v5 load probe

0.9 adds a repeatable headless concurrency probe.

The probe creates multiple independent 10-player MatchRunners and applies periodic movement command pressure while advancing all simulations.

Outputs include:

- concurrent match count;
- ticks per match;
- total simulated ticks;
- accepted command count;
- elapsed wall-clock time;
- aggregate simulated ticks/second;
- final state hash for every match.

### CI gate

The normal server CI runs:

```text
50 concurrent 5v5 matches
× 900 ticks each
= 45,000 authoritative match ticks
```

Movement commands are injected for all 10 players every 15 ticks.

The probe also keeps the production snapshot cadence of one authoritative snapshot every 3 ticks. For the CI gate this means:

```text
50 matches
× 900 ticks
÷ 3 ticks per snapshot
= 15,000 hashed/cloned authoritative snapshots
```

The smoke suite additionally repeats identical probes and requires identical final state hashes, so the load harness also protects deterministic state evolution.

The load probe is a regression baseline, not a production capacity claim. Real capacity planning still requires deployed multi-process tests, real Socket.IO traffic, persistence, observability and target hardware measurements.

## Certification

0.9 is not mergeable until the exact branch HEAD passes:

- architecture boundaries;
- strict client TypeScript;
- 100k deterministic simulation suite;
- network prediction/reconciliation suite;
- production build;
- server TypeScript;
- authoritative server tests;
- ranked draft state-machine tests;
- 50-match 5v5 load probe.

The same gates must pass again on the PR merge ref and on the final `main` SHA.
