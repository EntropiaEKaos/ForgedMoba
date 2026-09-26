# Visual 2.1 — Production World Assets

## Goal

Replace the remaining primitive battlefield silhouettes with manifest-driven Pixi assets while preserving the authoritative simulation boundary introduced in the 0.x multiplayer core.

Visual 2.1 focuses on **world readability and production presentation**. It does not alter collision, navigation, targeting, combat timing, rewards, vision, respawn or objective logic.

## Art pack

The production art pack advances to:

`forged-art-v2.1.0`

The existing hero and terrain contract remains compatible. A new shared world atlas is added at:

`/assets/art/v2/world/world-sheet.svg`

A single world sheet is intentionally used so the renderer can reuse one source texture for the high-frequency battlefield entity classes.

## World atlas coverage

The v2.1 world manifest requires all of the following keys:

- `blue-minion`
- `red-minion`
- `blue-tower`
- `red-tower`
- `jungle-monster`
- `epic-objective`
- `blue-ward`
- `red-ward`

Each entry declares:

- source frame;
- anchor;
- render scale;
- shadow scale.

The frame selection is based only on authoritative entity kind/team.

## Pixi runtime

`ArtAssetRegistry` now loads the shared world sheet once and exposes cropped Pixi textures for each world key.

`PixiBattlefieldRuntime` resolves:

`SimEntity -> WorldArtKey -> manifest definition -> Pixi Texture`

When production art exists, the Sprite owns the entity silhouette. The previous Graphics geometry remains available as a safety fallback if the manifest or texture fails.

## Presentation-only animation

The initial world animation remains deliberately presentation-only:

- epic objective receives a subtle scale pulse;
- wards receive a smaller scale pulse;
- combat hit-flash applies to production world sprites;
- shadow footprint uses manifest-defined presentation scale.

These effects never modify the entity's radius, coordinates, vision, HP or simulation timing.

## Authority boundary

World assets may change:

- silhouette;
- sprite scale;
- anchor;
- shadow footprint presentation;
- glow/pulse;
- hit-flash presentation.

World assets may not change:

- collision radius;
- attack range;
- aggro;
- team ownership;
- pathing;
- ward vision radius;
- ward duration;
- objective rewards;
- neutral leash;
- respawn timing;
- win condition.

## CI gates

Visual 2.1 is certifiable only if the exact HEAD passes:

- simulation boundary guard;
- visual authority boundary guard;
- production art asset validator;
- art manifest tests with all eight world keys;
- strict TypeScript;
- 100k determinism;
- network prediction/reconciliation suite;
- complete visual suite;
- production build;
- authoritative server tests;
- realistic 5v5 load probe;
- real Chromium visual proof.

The Chromium proof is mandatory on branch and PR so visual regressions in the world pack can be inspected before promotion.

## Next visual layer

Once 2.1 is certified, the next production art layer should focus on:

- skin atlas mapping;
- higher-fidelity structures/base presentation;
- optimized raster export pipeline;
- expanded authoritative hero art coverage;
- richer spell materials and battlefield lighting.

The renderer architecture does not need to change again for those additions; they extend the same manifest/registry contract.


## Visual 2.1.1 — Premium HUD & Battlefield Presence

This follow-up keeps the complete Visual 2.1 world atlas and upgrades the battlefield presentation around it.

### Premium HUD

The combat surface now includes:

- competitive top scoreboard with team/objective score;
- blue/red team portrait strips;
- large local hero portrait and combat status panel;
- authoritative HP, gold and CS;
- Q/W/E/R/ward command dock;
- cooldown and ready-state feedback;
- six-slot inventory display;
- tactical Rift minimap driven by authoritative entity coordinates;
- compact shop drawer and network diagnostics;
- integrated combat-event feed;
- viewport corner chrome and cinematic vignette.

### Pixi presence

The battlefield renderer now adds presentation-only:

- blue/red/local hero halos;
- animated local selection arcs;
- epic-objective aura;
- tower base glow;
- quality-safe aura pulse.

Visual 2.1.1 does not modify authoritative positions, hitboxes, targeting, vision, damage, movement or objective logic.

### Visual proof

The existing deterministic Chromium proof route must show the premium HUD together with the Visual 2.1 world atlas before merge.
