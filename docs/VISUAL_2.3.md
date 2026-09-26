# ForgedMoba — Visual 2.3 Full Game Visual Integration

Visual 2.3 changes the visual architecture from a small set of hand-wired effects into a reusable presentation system driven by authoritative game state.

## Why this milestone exists

The legacy ForgedMoba already contains far more gameplay/content identity than the online visual client was exposing. The correct response is not to replace PixiJS with another game engine. The correct response is to connect the existing content vocabulary to a strict visual pipeline while preserving the authoritative multiplayer boundary.

The renderer must never infer gameplay outcomes or import the legacy engine.

## Architecture

```
Authoritative Simulation / Snapshots
        |
        v
Visual Event Bus
        |
        +--> Capability / Material Registry
        +--> Skin Visual Contract
        |
        v
Combat FX Runtime + Environment Runtime
        |
        +--> GPU ParticleContainer
        +--> MeshSimple beams / ribbons / pillars
        +--> Glow / AdvancedBloom filters
        +--> custom GlProgram energy shader
        |
        v
PixiJS Battlefield
        +
React / Motion Premium HUD
```

## Full legacy capability catalog

A generated, reviewable catalog lives at:

`public/assets/visual/v2.3/legacy-capabilities.json`

Pack:

`forged-visual-capabilities-v2.3.0`

Current indexed coverage:

- 48 heroes;
- 39 items;
- 15 runes;
- 8 summoner spells;
- 20 skins;
- 235 ability/effect keys.

This catalog is visual/content metadata. It does **not** make legacy mechanics server-authoritative.

Online FX are emitted only when the current deterministic simulation exposes a matching authoritative state change.

## Visual Event Bus

`src/visual/visualEventBus.ts`

The bus observes deterministic simulation snapshots and produces presentation-only events. The current vocabulary includes:

- damage;
- healing;
- basic attack;
- Q cast;
- W/E/R cast when those slots become authoritative;
- slow/root/stun impact;
- level-up;
- item equip;
- ward spawn;
- death;
- objective completion.

This keeps the visual layer extensible without adding gameplay rules to Pixi.

## Semantic material registry

`src/visual/capabilityRegistry.ts`

Visual identities are grouped into reusable material families:

- steel;
- radiant;
- arcane;
- void;
- fire;
- frost;
- storm;
- nature;
- blood;
- shadow;
- neutral.

A family owns its particle intensity, trail width, glow identity, secondary color and camera-shake weight.

Legacy ability keys can be classified into these families without executing legacy gameplay code.

## GPU FX

`CombatFxRuntime` now combines several Pixi paths:

### ParticleContainer

Used for high-volume bursts, trails and ambient combat particles.

### MeshSimple

Used for geometry that should read as energy rather than dots:

- attack streaks;
- source-to-target status beams;
- light pillars;
- future projectile ribbons.

### Filters

Visual 2.3 adds `pixi-filters@6.1.5`:

- `GlowFilter` on overlay/light effects;
- `AdvancedBloomFilter` on mesh energy.

High-cost filters are quality-gated.

### Custom shader

`src/visual/energyPulseFilter.ts` implements a Pixi v8 `GlProgram` filter with animated uniforms.

The shader is presentation-only and does not modify world state.

## Reactive environment

The environment runtime now adds filtered/pulsing light around:

- the epic objective;
- towers;
- the local hero;
- allied ward vision.

The existing river, vegetation, mist, torches and ambient GPU particles remain intact.

## Skin visual bridge

`src/visual/skinVisualContract.ts`

A skin may override:

- aura color;
- trail color;
- particle color;
- glow color;
- rarity intensity.

The Pixi battlefield accepts these selections separately from simulation state.

The Chromium proof uses `gareth_ember` to verify the bridge.

No skin changes hitboxes, stats, damage, movement, targeting, vision or authority.

## Skeletal animation / Spine readiness

`src/visual/skeletalAnimationContract.ts`

Visual 2.3 defines a stable animation driver vocabulary:

- idle;
- run;
- attack;
- cast Q/W/E/R;
- hit;
- stun;
- death;
- recall.

The existing production sprite-sheet driver remains the default path.

A future licensed `spine-pixi-v8` adapter can implement the same contract without changing simulation or HUD code. Spine is intentionally **not** made a mandatory dependency in this milestone.

## Authority boundary

The visual directory continues to be guarded against importing `src/game/`.

That rule is intentional.

The legacy game is mined into static/versioned visual metadata, but online presentation remains driven by:

- authoritative/predicted simulation state;
- content version;
- deterministic state deltas.

## CI guard

The production-art validator now also requires a healthy Visual 2.3 capability catalog and minimum preserved coverage for heroes/items/runes/summoners/skins/ability keys.

The visual boundary gate includes every new Visual 2.3 runtime module.

## Chromium proof scenario

The deterministic proof now deliberately shows several systems in one frame window:

1. objective completion;
2. local level-up;
3. new item equipped;
4. new allied ward;
5. authoritative Gareth Q;
6. combat/status impact;
7. Gareth Ember skin material;
8. full-game bridge coverage panel.

The screenshot remains a real Chromium capture at 1440×900.

## Certification rules

Visual 2.3 may only be called certified after:

1. exact final branch HEAD CI is green;
2. Chromium proof from that HEAD is downloaded and visually inspected;
3. PR merge-ref repeats the gates;
4. protected squash merge uses the expected HEAD SHA;
5. the resulting main SHA passes a fresh post-merge CI cycle.

No green status from an earlier HEAD can be reused.
