# Visual 2.0 — Production Art Pipeline

## Goal

Move the online Pixi renderer from shape/procedural presentation toward a versioned production-art workflow without coupling art files to authoritative gameplay.

Visual 2.0 introduces an asset contract, runtime registry, real hero animation sheets and a terrain asset while preserving every existing correctness and fallback boundary.

## Art pack

The first production pack lives under:

`public/assets/art/v2/`

The pack is identified as:

`forged-art-v2.0.0`

It contains:

- a versioned JSON manifest;
- Rift terrain art;
- Gareth animation sheet;
- Luxana animation sheet.

The initial source format is SVG so source art remains reviewable in Git, resolution independent and binary-tool independent. The same manifest/runtime contract can later point at optimized PNG/WebP/AVIF textures exported by the art build pipeline.

## Hero atlas contract

Each hero atlas declares:

- hero ID;
- source asset;
- frame dimensions;
- anchor;
- render scale;
- shadow scale;
- animation frame sequences;
- animation FPS;
- looping behavior.

Required animation states:

- `idle`
- `run`
- `attack`
- `cast`

The renderer crops the published sheet into Pixi textures and switches poses from presentation-only state observation.

No animation frame can alter authoritative movement, attack timing, cast timing or damage.

## Runtime registry

`ArtAssetRegistry`:

1. fetches and validates the v2 manifest;
2. loads terrain/hero textures through Pixi Assets;
3. creates frame textures from each sheet;
4. exposes animation frames to the battlefield renderer;
5. records a recoverable failure if an asset cannot be loaded.

An art failure never prevents the match from running.

If manifest/texture loading fails, the renderer keeps the existing Graphics-based entity fallback.

## Terrain

The first Rift production terrain is a versioned vector map with:

- jungle clearings;
- center lane;
- river;
- bases;
- tower landmarks;
- neutral camp markings;
- epic objective pit;
- rocks/terrain silhouettes;
- team glows.

The terrain texture is scaled into authoritative world coordinates. It does not define collision, navmesh, objective positions or simulation geometry.

## Existing skin migration

The legacy skin system currently stores palette/look modifiers rather than production textures.

Visual 2.0 deliberately keeps those definitions intact.

The next skin migration can map a `skinId` to:

- a separate atlas source;
- tint/material overrides;
- VFX trail/aura overrides.

This prevents the current skin catalog from being discarded while allowing production skins to replace procedural recolors incrementally.

## CI gates

`lint:art-assets` validates:

- manifest presence;
- all referenced files;
- asset path namespace;
- SVG `viewBox`;
- per-asset source-size budget;
- total pack source-size budget;
- minimum authoritative hero coverage.

The normal visual suite also validates manifest schema and required animation states.

## Screenshot proof

The existing deterministic Chromium proof route uses `PixiBattlefieldRuntime`.

Therefore every Visual 2.x branch screenshot automatically exercises:

- manifest loading;
- terrain asset loading;
- hero sheet loading/cropping;
- renderer integration;
- Pixi build/runtime compatibility.

A screenshot artifact is evidence of the real build, not a generated marketing mock.

## Boundary

Art may change:

- silhouette;
- texture;
- animation frames;
- color/material presentation;
- shadows;
- camera presentation;
- VFX.

Art may not change:

- authoritative coordinates;
- collision radii;
- move speed;
- cast/attack timing;
- hitboxes;
- HP;
- damage;
- gold/XP;
- objective logic;
- winner.

## Certification

Visual 2.0 is mergeable only after the exact HEAD passes:

- simulation boundary guard;
- visual authority guard;
- production art asset validator;
- strict TypeScript;
- 100k determinism;
- network suite;
- visual + art-manifest tests;
- production build;
- server tests;
- realistic 5v5 load probe;
- real Chromium visual proof screenshot.

The same gates must pass again on the PR merge-ref and the merged main SHA.
