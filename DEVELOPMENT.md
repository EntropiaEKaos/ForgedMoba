# ForgedMoba — Engineering Roadmap

Baseline audited: main @ 9afa67738ab9e5217fac73d19917086d63f32923 (2026-09-22).
Foundation 0.1 certified and merged: main @ 0426c0c0c5902c0368d5d68b4e7cb6bdaed43587.

The existing game is a feature-rich offline prototype. The migration strategy is incremental: preserve the legacy playable engine while authoritative systems move into a deterministic headless simulation.

## Existing playable prototype

- 23 hero definitions in the audited codebase.
- 39 item definitions in the audited codebase.
- 5v5 offline match with bots.
- lane/jungle AI, towers, inhibitors/objectives, fog/wards.
- runes, summoner spells, skins, draft, buyback/deny and local career data.
- Canvas 2D rendering, VFX, WebAudio and React HUD.
- local admin/content editing workflow.

## Foundation 0.1 — certified

- [x] CI: simulation boundary check, client TypeScript, deterministic tests, production build and server TypeScript.
- [x] src/shared/ protocol contracts.
- [x] src/simulation/ fixed-tick deterministic skeleton.
- [x] seeded RNG and canonical state hashing.
- [x] 10,000-tick regression test.
- [x] Socket.IO matchmaking rooms + safe listener lifecycle.
- [x] JWT verification and development password hashing.
- [x] reject client-authored game state.
- [x] post-merge CI green on main.

## Simulation / Lane Authority 0.2 — certified and merged

- [x] simulation state v2 with contentVersion.
- [x] canonical content hash/version manifest.
- [x] 100,000-tick deterministic stress probe.
- [x] deterministic spatial hash for nearby-entity queries.
- [x] single-lane towers and deterministic 30-second minion waves.
- [x] minion and tower authoritative target acquisition.
- [x] authoritative hero last-hit gold, XP and CS.
- [x] deterministic tower-destruction win condition for the vertical slice.
- [x] headless MatchRunner at 30 simulation ticks/second.
- [x] bounded input tick window and monotonic input sequence guard.
- [x] snapshots every 3 ticks (10 Hz) with state hash and ackSeqByPlayer.
- [x] server no longer relays client-authored game state or raw peer authority.
- [x] client stores authoritative snapshots and can emit move/attack/stop commands.
- [x] GitHub branch CI + PR CI + post-merge CI certified the merged phase.

## Combat / Lane parity 0.3 — certified and merged

- [x] client transport adapter for authoritative Q commands.
- [x] deterministic unit separation and world-bound movement constraints.
- [x] authoritative Q runtime for Gareth and Luxana.
- [x] deterministic Q cooldowns plus slow/root status representation.
- [x] tower provocation when an enemy hero damages an allied hero in range.
- [x] deterministic lane XP sharing between nearby allied heroes.
- [x] command-log fixture for reproduced combat scenarios.
- [x] MatchRunner accepts Q while continuing to reject unsupported W/E/R authority.
- [x] branch CI + PR CI + post-merge CI green on main @ 50c4ff6622ac69bd07e2b344b9e7f42018131924.

## Network Client 0.4 — current branch

- [x] local prediction reusing the deterministic authoritative simulation.
- [x] reconciliation from server input acknowledgements with pending-input replay.
- [x] interpolation buffer for remote entity position/HP.
- [x] RTT/jitter/snapshot-gap/correction telemetry.
- [x] online authoritative match screen separated from the legacy offline renderer.
- [x] reconnect resumes an active in-memory match and sends a fresh authoritative snapshot.
- [x] network client regression suite added to CI.
- [x] content manifest advanced to simulation v3/core-0.3.
- [ ] branch CI + PR CI + post-merge main CI certification.
- [ ] follow-up security/dependency audit for the npm vulnerabilities surfaced by CI; no forced upgrade will be merged without compatibility verification.

## Multiplayer milestones

- [ ] 0.5: real authoritative 1v1 vertical slice in the game UI.
- [ ] 0.6: 3v3 reliability + reconnect.
- [ ] 0.7: abilities/items/content publishing bound to content hash.
- [ ] 0.8: jungle/objectives/wards under server authority.
- [ ] 0.9: full draft/lobby and 5v5 load testing.
- [ ] 1.0: production-ready authoritative 5v5 match architecture.

## Post-1.0 platform

- replay from seed/content-version/command log,
- spectator mode,
- ranked/MMR,
- persistent account/session/match store,
- server-owned admin/content publishing,
- anti-cheat analytics,
- load tests and autoscaling,
- telemetry/observability,
- expanded hero/item content after core certification.

See docs/AUDIT_2026-09-22.md, docs/ARCHITECTURE_TARGET.md and docs/NETWORK_PROTOCOL.md.
