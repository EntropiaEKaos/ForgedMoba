# ForgedMoba — Engineering Roadmap

Baseline audited: main @ 9afa67738ab9e5217fac73d19917086d63f32923 (2026-09-22).

The existing game is a feature-rich offline prototype. Online menus/auth/matchmaking are prototype infrastructure; a real authoritative 5v5 simulation is not yet complete.

## Existing playable prototype

- 23 hero definitions in the current codebase.
- 39 item definitions in the current codebase.
- 5v5 offline match with bots.
- lane/jungle AI, towers, inhibitors/objectives, fog/wards.
- runes, summoner spells, skins, draft, buyback/deny and local career data.
- Canvas 2D rendering, VFX, WebAudio and React HUD.
- local admin/content editing workflow.

Counts above describe the audited commit and should be generated automatically in the future rather than copied into multiple docs.

## Foundation 0.1 — in progress on protected branch

- [x] CI workflow design: boundary check, TypeScript, deterministic tests, production build, server typecheck.
- [x] src/shared/ protocol contracts.
- [x] src/simulation/ headless fixed-tick skeleton.
- [x] seeded deterministic RNG.
- [x] canonical state hashing.
- [x] 10,000-tick determinism regression test.
- [x] input sequence duplicate/stale guard in the new simulation core.
- [x] architecture boundary checker for simulation code.
- [x] matchmaking Socket.IO rooms.
- [x] client queue listener lifecycle fix.
- [x] client stores match ID/team/slot after match found.
- [x] Socket.IO JWT verification.
- [x] password hashing for development accounts.
- [x] reject client-authored game:state.
- [ ] CI must run green on GitHub before merge.

## Simulation Core 0.2

- [x] deterministic movement/combat proof-of-concept.
- [ ] migrate production movement model behind an adapter.
- [ ] entity registry/components for minions/towers/monsters.
- [ ] deterministic collision/spatial hash.
- [ ] authoritative death/respawn/economy events.
- [ ] deterministic buff/cooldown runtime.
- [ ] content-version hash bound to every match.

## Determinism 0.3

- [x] 10k same-seed/same-command probe.
- [ ] 100k stress probe.
- [ ] first-divergent-tick artifact in CI.
- [ ] recorded command fixtures for regression cases.
- [ ] simulation performance budget and benchmark.

## Combat / Lane Vertical Slice 0.4-0.5

- [ ] movement + attack + death + respawn parity with legacy behavior.
- [ ] Q ability runtime for two test heroes.
- [ ] minion waves and aggro.
- [ ] tower targeting/aggro.
- [ ] XP, gold, last hit and deny.
- [ ] one-lane deterministic win condition.

## Authoritative Server 0.6

- [ ] one headless simulation runner per match room.
- [ ] command validation and monotonic seq acknowledgement.
- [ ] server tick window validation.
- [ ] authoritative snapshots/deltas.
- [ ] reconnect and slot reclamation.
- [ ] persistent user/session/match metadata store.

## Network Client 0.7

- [ ] local input prediction.
- [ ] reconciliation from server ack sequence.
- [ ] remote interpolation buffer.
- [ ] latency/jitter/loss telemetry.
- [ ] disconnect/reconnect UX.

## Multiplayer milestones

- [ ] 0.8: real authoritative 1v1 vertical slice.
- [ ] 0.9: 3v3 reliability + reconnect.
- [ ] 1.0: 5v5 authoritative match with draft, jungle, objectives and wards.

## Post-1.0 platform

- replay from seed/content-version/command log,
- spectator mode,
- ranked/MMR,
- server-owned admin/content publishing,
- anti-cheat analytics,
- load tests and autoscaling,
- telemetry/observability,
- expanded hero/item content after core certification.

See docs/AUDIT_2026-09-22.md, docs/ARCHITECTURE_TARGET.md and docs/NETWORK_PROTOCOL.md.
