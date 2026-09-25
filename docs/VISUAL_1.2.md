# Visual 1.2 — Environment

## Goal

Make the authoritative map feel alive without creating gameplay state inside the renderer.

## Environment layers

Visual 1.2 adds deterministic presentation layers for:

- animated river ribbons;
- vegetation clusters with subtle sway;
- mist patches;
- torch/firelight decoration;
- GPU ambient dust/firefly particles;
- jungle camp aura;
- epic objective pulse;
- allied ward vision rings.

## Deterministic decoration

Permanent environment decoration is generated from world dimensions and a visual-only deterministic PRNG.

This means visual regression scenarios are reproducible while environment decoration remains completely outside the authoritative simulation hash.

## Quality scaling

Low / Medium / High / Ultra affect:

- decoration count;
- ambient particle count;
- vegetation animation;
- dynamic light decoration;
- ward vision presentation;
- objective aura density.

Low mode intentionally removes expensive ambient presentation first.

## Runtime layering

Pixi world ordering:

1. base terrain;
2. environment background;
3. ambient particles;
4. combat particles;
5. gameplay entities;
6. environment foreground/aura;
7. combat overlay.

## Authority boundary

The environment runtime reads entity kind/team/position/vision data to render presentation only.

It cannot:

- mutate entity positions;
- reveal hidden gameplay information beyond what the development snapshot already contains;
- calculate aggro/rewards/vision gameplay;
- advance ticks.

Server-side snapshot redaction/fog-of-war remains a later anti-cheat hardening milestone.

## Certification

Visual 1.2 requires branch, PR and post-merge CI green for:

- simulation boundary;
- visual authority boundary;
- strict TypeScript;
- 100k determinism;
- network suite;
- visual suite including deterministic environment generation;
- production build;
- server tests;
- 5v5 load probe.
