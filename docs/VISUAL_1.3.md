# Visual 1.3 — Cinematic Polish

## Goal

Add presentation-level cinematics to the authoritative multiplayer client without moving any gameplay decisions into the renderer or React UI.

Visual 1.3 consumes authoritative/predicted state only. It cannot create kills, levels, objective scores, respawns, cooldowns or match results.

## Cinematic event model

`cinematicModel.ts` captures a compact visual probe from `SimulationState` and derives events only from state deltas:

- hero kill;
- ACE for a complete multi-player team wipe;
- epic objective kill;
- tower destruction;
- level up;
- respawn.

Events are stable-keyed, priority ordered and visual-only.

## Camera direction

The Pixi camera now supports:

- opening glide from map center toward the local hero;
- event focus for objective kills, ACE, tower destruction and hero kills;
- local-only level-up/respawn focus;
- quality-scaled cinematic influence.

Low and Medium deliberately reduce camera displacement so competitive readability is preserved.

The camera changes presentation coordinates only. Authoritative entity coordinates remain untouched.

## Motion HUD

The online match UI now uses Motion for:

- match intro/team reveal;
- kill/objective/tower/ACE/level-up/respawn banners;
- reconnect warnings;
- HUD/shop/action-bar entrance;
- cooldown feedback;
- death/respawn presentation;
- premium victory/defeat result screen;
- hold-TAB scoreboard.

## Draft transition

The ranked draft surface now uses Motion for player rows and hero cards.

When all ten players are ready, a draft-complete/loading presentation appears while the server performs the actual authoritative transition into MatchRunner.

## Scoreboard

Holding TAB displays an authoritative snapshot-derived scoreboard:

- team score;
- objectives;
- hero identity;
- level;
- gold;
- CS;
- HP/dead state.

No locally invented combat statistics are displayed.

## Result integrity

The victory/defeat cinematic is driven by `game:complete` / server-owned `matchResult`.

The result layer never computes a winner locally.

## Certification gates

The exact Visual 1.3 HEAD must pass:

- simulation authority boundary guard;
- visual authority boundary guard;
- strict TypeScript;
- 100k deterministic simulation suite;
- network prediction/reconciliation suite;
- visual unit suite including cinematic derivation;
- production Pixi/Motion build;
- server authoritative tests;
- realistic 5v5 load probe.

The same gates must pass on the PR merge-ref and again on the merged `main` SHA.

## Visual proof

When an accessible browser preview is available, the branch should produce real screenshots from the running renderer. Screenshots are documentation evidence only; they are never used as a substitute for automated correctness gates.


## Certified release

Visual 1.3 was merged through PR #14 and certified on:

`main @ 79db8ce62c9c82550242a0d538ee86730402f1cb`

Certification sequence:

- feature branch CI: green;
- PR merge-ref CI: green;
- post-merge `main` CI: green;
- strict TypeScript: green;
- 100k deterministic simulation suite: green;
- network client suite: green;
- visual unit suite: green;
- production build: green;
- authoritative server tests: green;
- realistic concurrent 5v5 load probe: green.

### Visual proof evidence

The Visual 1.3 branch and PR CI both launched the built application with Vite preview, opened the deterministic route `?visual-proof=cinematic` in real Chromium, and captured `visual-proof-cinematic.png`.

The proof scene demonstrates the actual PixiJS + Motion runtime and is generated from the running build rather than from a mocked or generated marketing image.

The screenshot is intentionally an ephemeral CI artifact; the deterministic proof route remains in the application so the evidence can be regenerated on future visual branches.
