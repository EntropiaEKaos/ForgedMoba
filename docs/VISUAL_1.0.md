# Visual 1.0 — Pixi Battlefield Renderer

## Goal

Replace the authoritative online diagnostic Canvas renderer with a production-oriented PixiJS renderer while keeping game authority entirely in the deterministic simulation/server.

## Boundary

The visual runtime may:

- read predicted local state;
- read interpolated remote state;
- transform world coordinates into screen coordinates;
- render terrain/entities/labels/health;
- collect pointer/keyboard intent and call ConnectionManager commands.

The visual runtime may not:

- apply damage;
- mutate gold/XP/items/cooldowns;
- decide deaths, objectives or winners;
- advance simulation ticks;
- use random gameplay state;
- alter authoritative entity coordinates.

## Runtime

PixiJS 8 is pinned as the primary renderer. The renderer owns persistent layers:

1. terrain;
2. entity world;
3. shadows/selection;
4. health/name overlays.

Entities use persistent display objects keyed by authoritative entity ID. Missing/dead entities are removed deterministically from the visual scene.

The initial renderer uses WebGL explicitly. A future renderer preference may evaluate WebGPU separately after browser/device qualification.

## Camera

Camera math lives in pure functions and is tested independently.

The camera follows the locally predicted hero with smoothing while all authoritative coordinates remain untouched.

## Quality presets

Low / Medium / High / Ultra define render budgets for:

- DPR cap;
- antialiasing;
- particle budget;
- environment particle budget;
- dynamic light budget;
- shadow samples;
- bloom/distortion eligibility;
- screen shake scale.

Quality preferences are stored locally and never become gameplay state.

## Safety fallback

If Pixi/WebGL cannot initialize, a functional Canvas fallback remains available. It preserves move, attack, Q, ward and stop controls.

## UI animation dependency

Motion is pinned in Visual 1.0 so later phases can animate React HUD/draft/result surfaces without coupling those animations to the battlefield simulation.

## Certification

Visual 1.0 is not mergeable until the exact branch HEAD passes:

- simulation boundary check;
- strict TypeScript;
- 100k determinism;
- network suite;
- visual camera/quality/targeting tests;
- production build with PixiJS;
- server tests and 5v5 load probe.

The same gates must pass on the PR merge-ref and merged main SHA.
