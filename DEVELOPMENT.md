# ForgedMoba — Engineering Roadmap

Baseline audited: `main@9afa67738ab9e5217fac73d19917086d63f32923`.

## Playable legacy baseline

The current browser game remains preserved while the multiplayer architecture is extracted incrementally.

Verified content at the audit baseline:
- 23 unique hero IDs
- 39 unique item IDs
- three-lane map, jungle/objectives, towers/inhibitors/nexus
- bots, fog/wards, runes, summoner spells, skins, VFX and admin prototyping
- React HUD + Canvas 2D gameplay

## Foundation 0.1 — in progress

- [x] Protected feature branch
- [x] Repository CI
- [x] TypeScript verification gate
- [x] Architecture boundary gate
- [x] Deterministic headless simulation skeleton
- [x] 30 Hz fixed simulation tick
- [x] Seeded RNG
- [x] Canonical state hash
- [x] 10k-tick determinism test
- [x] Shared command/snapshot protocol
- [x] JWT-authenticated Socket.io transport
- [x] Real Socket.io match rooms
- [x] Queue-listener lifecycle cleanup
- [x] Password hashing for development auth
- [ ] CI certification of the branch

## Simulation 0.2

- [ ] Migrate movement/collision primitives
- [ ] Migrate basic attacks and damage pipeline
- [ ] Migrate death/respawn
- [ ] Migrate cooldown/status-effect representation
- [ ] Eliminate object references/callbacks from authoritative state
- [ ] 100k-tick determinism soak

## Lane Slice 0.3

- [ ] Minion waves
- [ ] Lane pathing
- [ ] Tower aggro
- [ ] Last-hit / XP / gold
- [ ] First complete headless win condition

## Authoritative Server 0.4

- [ ] Match process/session runner
- [ ] Server-owned simulation state
- [ ] Command validation
- [ ] Snapshot/delta transport
- [ ] Input acknowledgements
- [ ] Match lifecycle and cleanup

## Network Client 0.5

- [ ] Local input prediction
- [ ] Server reconciliation
- [ ] Remote interpolation
- [ ] Latency/jitter simulation harness
- [ ] Reconnect session token

## Multiplayer progression

1. 1v1 vertical slice
2. 2v2
3. 3v3
4. 5v5 with bots filling slots
5. 5v5 players
6. jungle/objectives/wards/draft
7. replay + spectator
8. ranked/MMR + telemetry + anti-cheat analytics

## Networking principle

The client sends intentions, never outcomes. Damage, gold, cooldowns, deaths, objectives and victory are server-authoritative.

Rollback is intentionally not the first milestone. ForgedMoba will first use fixed-tick server authority with prediction, reconciliation and interpolation.
