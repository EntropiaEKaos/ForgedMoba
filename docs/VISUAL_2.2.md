# ForgedMoba — Visual 2.2 HUD Art Pass & Ability Identity

Visual 2.2 upgrades the certified Visual 2.1.1 Premium HUD without replacing it.

## Goal

Remove the remaining prototype cues visible in the Chromium proof:

- Unicode ability glyphs;
- text-abbreviation item slots;
- overly blocky top scoreboard;
- oversized cinematic event banner;
- flat battlefield ground indicators.

## Versioned UI pack

The release introduces:

`public/assets/ui/v2/manifest.json`

Pack id:

`forged-ui-v2.2.0`

The pack contains bespoke SVG art for:

- Gareth Q / Judgment;
- Luxana Q / Prism;
- locked W;
- locked E;
- locked R;
- Ward;
- Longsword;
- Ruby;
- Boots;
- Pickaxe.

All UI assets are reviewable source SVGs with viewBox declarations. CI validates path ownership, existence and size budgets.

## HUD integration

The Premium HUD now consumes the versioned art pack directly:

- ability slots display production art;
- inventory slots display item art;
- shop cards display item art;
- empty inventory slots use a restrained forged-rune placeholder;
- the top scoreboard is smaller, more transparent and more ornamental;
- the main command dock receives a brighter forged-material edge pass;
- the minimap gets an inset material frame.

Locked W/E/R remain visibly locked because these abilities are not yet authoritative. Visual 2.2 does not imply gameplay support that does not exist.

## Cinematic pass

Event banners are reduced in footprint and moved higher to preserve battlefield visibility.

The plaque now uses:

- tapered geometry;
- lighter material opacity;
- animated highlight sweep;
- smaller typography;
- retained event tone semantics.

## Pixi battlefield presence

Presentation-only ground sigils are added:

- rotating segmented sigil for the local hero;
- concentric rotating rings for the epic objective;
- subtle energy arcs for towers.

The new Graphics layers are presentation-only. They do not modify collision, targeting, movement, damage, vision or simulation state.

## Chromium proof

The deterministic visual proof equips the local hero with Longsword, Ruby and Boots so production item art is visible in CI screenshots.

Certification requires:

1. exact branch HEAD CI green;
2. real Chromium screenshot inspected;
3. PR merge-ref CI green;
4. protected squash merge with expected HEAD SHA;
5. new main SHA post-merge CI green.
