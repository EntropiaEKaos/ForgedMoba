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

## Network Client 0.4 — certified and merged

- [x] local prediction reusing the deterministic authoritative simulation.
- [x] reconciliation from server input acknowledgements with pending-input replay.
- [x] interpolation buffer for remote entity position/HP.
- [x] RTT/jitter/snapshot-gap/correction telemetry.
- [x] online authoritative match screen separated from the legacy offline renderer.
- [x] reconnect resumes an active in-memory match and sends a fresh authoritative snapshot.
- [x] network client regression suite added to CI.
- [x] content manifest advanced to simulation v3/core-0.3.
- [x] branch CI + PR CI + post-merge main CI green on main @ ca0dbcc6b2c64156852ec0bb29909b77fa6c9217.
- [ ] follow-up security/dependency audit for the npm vulnerabilities surfaced by CI; no forced upgrade will be merged without compatibility verification.

## Multiplayer 0.5 — certified and merged

- [x] explicit `duel1v1` and `ranked5v5` protocol modes.
- [x] isolated/tested matchmaking queues with exact readiness thresholds (2 / 10).
- [x] duplicate socket and duplicate-account queue occupancy prevention.
- [x] same MatchRunner powers Duel and Ranked foundation.
- [x] Duel is selectable directly from the multiplayer lobby.
- [x] authoritative forfeit lifecycle and server-owned winner.
- [x] game-complete result screen before returning to lobby.
- [x] reconnect replaces the previous controlling socket instead of creating dual control.
- [x] match room membership and identity are cleaned on completion.
- [x] branch CI + PR CI + post-merge main CI green on main @ e80131633d162f2ba6daae67c11344f723aee4c3.

## Multiplayer 0.6 — certified and merged

- [x] explicit `skirmish3v3` protocol mode.
- [x] isolated six-player matchmaking queue with exact 3v3 readiness.
- [x] 30-second server-owned reconnect grace registry.
- [x] reconnect cancels the disconnect lease and restores the same match slot.
- [x] reconnect expiry triggers authoritative team forfeit.
- [x] stale/replaced sockets cannot create a second controlling session.
- [x] client HUD exposes reconnect grace and disconnected-player countdown.
- [x] Duel 1v1 and Ranked 5v5 remain available alongside 3v3.
- [x] unit tests cover reconnect expiry/cancel/cleanup and exact 3v3 matchmaking.
- [x] branch CI + PR CI + post-merge main CI green on main @ 412d8b0b0b381591b240684c1ed28264c3b2f4c0.

## Authoritative Content 0.7 — certified and merged

- [x] validated authoritative content schema with deterministic publication hash.
- [x] immutable published pack separated from browser-local Admin drafts.
- [x] Gareth/Luxana authoritative base stats and Q values come from the published pack.
- [x] initial authoritative item catalog with server-owned prices/stat effects.
- [x] `buy` promoted into the authoritative command protocol.
- [x] server validates shop radius, gold and inventory limit.
- [x] client prediction/reconciliation supports purchases through the same simulation core.
- [x] Socket.IO handshake and matchmaking declare the local content hash.
- [x] server rejects mismatched client content before authoritative matchmaking.
- [x] `/api/content/current` exposes the active published pack/manifest.
- [x] Admin panel clearly distinguishes local drafts from published online authority.
- [x] tests prove gameplay changes alter the content hash and published packs are immutable.
- [x] branch CI + PR CI + post-merge main CI green on main @ 2e467044df2e956d3a1cacb1aa8b99f29766c7da.

## Simulation / Map Authority 0.8 — certified and merged

- [x] published jungle camps/objective rules are content-hash bound.
- [x] neutral camps and epic objective spawn inside the deterministic simulation.
- [x] neutral AI uses the existing spatial/attack pipeline with leash behavior.
- [x] camp and objective respawn timing is server-authoritative.
- [x] jungle rewards, team objective gold and objective score are server-owned.
- [x] `place-ward` is an authoritative command with range/cooldown/team cap.
- [x] ward duration and team vision radius are deterministic state.
- [x] local prediction/reconciliation supports ward placement.
- [x] online diagnostics render jungle entities, objective score and ward cooldown.
- [x] tests cover jungle/objective/ward determinism, rewards, visibility and transport.
- [x] branch CI + PR CI + post-merge main CI green on main @ d6cccf4af9375a7b6fea161cd2538aae88325fab.

## Multiplayer 0.9 — certified and merged

- [x] Ranked 5v5 queue enters an authoritative pre-match draft room instead of launching immediately.
- [x] stable TOP/JUNGLE/MID/CARRY/SUPPORT slot assignment per team.
- [x] hero picks validated against the active published authoritative content.
- [x] player ready-lock required before match launch.
- [x] all 10 players must be connected, picked and ready before MatchRunner creation.
- [x] draft reconnect replaces the socket while preserving slot/pick/ready state.
- [x] two-minute draft deadline with server-owned cancellation.
- [x] authoritative React draft screen driven only by server snapshots.
- [x] selected draft hero IDs are passed into MatchRunner and verified by tests.
- [x] repeatable concurrent 5v5 load probe with command pressure and final state hashes.
- [x] CI load gate runs 50 concurrent 5v5 matches for 900 ticks each with 10 Hz authoritative snapshot hashing/cloning.
- [x] load harness verifies repeatable final hashes across identical concurrent runs.
- [x] branch CI + PR CI + post-merge main CI green on main @ c33c812601cdf72f44a1e1e99c7b64a074e23a45.

## Visual 1.0 — certified and merged

- [x] PixiJS 8 primary authoritative-state renderer.
- [x] persistent entity scene graph and camera transforms.
- [x] Low / Medium / High / Ultra render budgets.
- [x] functional Canvas fallback.
- [x] renderer authority boundary guard.
- [x] visual unit suite.
- [x] branch CI + PR CI + post-merge main CI green on main @ e8980ce53138ea9503054fd01846cbb942e04efc.

## Visual 1.1 — certified and merged

- [x] combat FX derived only from authoritative/predicted state deltas.
- [x] GPU particle bursts.
- [x] Gareth/Luxana Q cast presentation.
- [x] source-aware root/slow/stun trails.
- [x] damage rings and floating damage.
- [x] hit flash.
- [x] death/objective bursts.
- [x] quality-scaled screen shake.
- [x] repeatable visual-only PRNG.
- [x] branch CI + PR CI + post-merge main CI green on main @ f52b7759d8f21215df507ca27dd05910286fac09.

## Visual 1.2 — certified and merged

- [x] deterministic environment decoration generator.
- [x] animated river presentation.
- [x] vegetation sway and mist drift.
- [x] torch/light decoration with quality budgets.
- [x] GPU ambient particles.
- [x] jungle camp and epic objective aura.
- [x] allied ward vision presentation.
- [x] environment layers separated from combat/entity layers.
- [x] visual authority guard covers environment runtime/model.
- [x] branch CI + PR CI + post-merge main CI green on main @ 29e74ef1889f1fe02adf373b1c01cbbe4c722b68.

## Visual 1.3 — certified and merged

- [x] Motion-powered match intro and team reveal.
- [x] Pixi camera intro glide from map center to local hero.
- [x] authoritative-state cinematic observer for kills/objectives/towers/level-up/respawn.
- [x] ACE detection for multi-player team wipes.
- [x] event-priority camera focus with quality-scaled competitive intensity.
- [x] kill/objective/tower/ACE/level-up/respawn banners.
- [x] premium victory/defeat result presentation.
- [x] death screen and authoritative respawn countdown.
- [x] Q and ward cooldown presentation.
- [x] reconnect warning animation.
- [x] Motion shop/HUD entrance transitions.
- [x] hold-TAB authoritative scoreboard overlay.
- [x] Ranked Draft Motion transitions and draft-to-match loading presentation.
- [x] visual-only cinematic tests and boundary guards.
- [x] branch CI + PR CI + post-merge main CI green on main @ 79db8ce62c9c82550242a0d538ee86730402f1cb.
- [x] Chromium visual proof captured in branch and PR CI as `visual-proof-cinematic`.

## Visual 2.0 — current branch

- [x] versioned production art manifest under `public/assets/art/v2`.
- [x] validated runtime art manifest schema.
- [x] production Rift terrain asset.
- [x] Gareth four-pose hero sheet.
- [x] Luxana four-pose hero sheet.
- [x] Pixi asset registry and atlas frame extraction.
- [x] hero `idle/run/attack/cast` presentation states.
- [x] asset-first renderer with Graphics fallback.
- [x] production art path/reference/size budget CI gate.
- [x] nested art-manifest visual tests.
- [x] deterministic Chromium proof automatically exercises the art pack.
- [x] premium MOBA HUD with team frames, minimap, command dock, inventory, shop and event feed.
- [x] network diagnostics moved behind F8 instead of permanently occupying the battlefield.
- [x] W/E/R are explicitly shown as locked until the authoritative core implements them.
- [ ] branch CI + PR CI + post-merge main CI certification.
- [ ] inspect and archive the new real Chromium screenshot.

## Visual milestones
- [ ] 2.1: production skins, structures/minions and optimized texture export.
- [ ] 2.2: full hero roster art coverage and animation authoring workflow.

## Multiplayer milestones
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
