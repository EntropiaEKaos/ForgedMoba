# ForgedMoba — Visual 3.1 Full Authority + GPU FX

Visual 3.1 is the reconciliation release that places the Full Game Visual Integration stack on top of **ForgedMoba 3.0**, which already migrated the complete playable catalog into the deterministic authoritative runtime.

## Base

Visual 3.1 branches from:

`main @ 8a1d155369dc8abe2d5e3d62372e13aab61c44da`

That base is the ForgedMoba 3.0 release from PR #22.

The reconciliation intentionally preserves:

- full authoritative hero catalog;
- full authoritative item catalog;
- authoritative Q/W/E/R execution;
- authoritative ability runtime classification;
- authoritative `visualTag`;
- full-catalog Pixi/procedural hero coverage;
- full-catalog HUD and input support;
- deterministic server simulation and 5v5 load behavior.

## Why 3.1 exists

The older Visual 2.3 branch introduced a strong rendering architecture, but it was created before the 3.0 authority migration landed.

Directly merging that branch would have overwritten newer 3.0 work.

Visual 3.1 therefore rebuilds the visual integration **on top of** 3.0 rather than merging over it.

## Runtime architecture

```
ForgedMoba 3.0 authoritative simulation
        |
        v
Visual state probes
        |
        v
Visual Event Bus
        |
        +--> authoritative ability visualTag
        +--> semantic material registry
        +--> skin visual contract
        |
        v
CombatFxRuntime / EnvironmentRuntime
        |
        +--> ParticleContainer GPU particles
        +--> MeshSimple beams / ribbons / pillars
        +--> GlowFilter
        +--> AdvancedBloomFilter
        +--> custom Pixi v8 GlProgram shader
        |
        v
PixiJS battlefield
        +
React / Motion premium HUD
```

## Authoritative event vocabulary

Visual 3.1 emits presentation events only from deterministic state deltas.

Supported presentation events:

- damage;
- healing;
- shield gain;
- basic attack;
- authoritative Q/W/E/R cast;
- slow;
- root;
- stun;
- silence;
- haste;
- damage reduction;
- level-up;
- item equip;
- ward spawn;
- death;
- objective completion.

No visual event mutates simulation state.

## Ability identity

ForgedMoba 3.0 publishes these authoritative visual tags:

- `blade`;
- `fire`;
- `frost`;
- `arcane`;
- `nature`;
- `shadow`;
- `light`;
- `tech`.

Visual 3.1 maps those tags into richer material families used by particles, trails, meshes, bloom and camera feedback.

This means the renderer no longer needs to know individual gameplay implementations in order to produce coherent visual identity.

## GPU presentation stack

### ParticleContainer

High-volume particle bursts and trails remain batched through Pixi's particle path.

### MeshSimple

Mesh geometry is used for:

- source-to-target control links;
- attack streaks;
- energy ribbons;
- light pillars;
- future projectile bodies.

### Filters

The release adds `pixi-filters@6.1.5` and uses:

- `GlowFilter`;
- `AdvancedBloomFilter`.

High-cost filters are disabled by lower quality presets.

### Custom shader

`src/visual/energyPulseFilter.ts` contains a Pixi 8 `GlProgram` shader with animated uniforms.

The shader is presentation-only.

## Full-catalog hero rendering

ForgedMoba 3.0 already added procedural authoritative hero rendering for heroes without production sprite sheets.

Visual 3.1 preserves that fallback.

The skin bridge then layers visual identity over both paths:

1. production sprite path;
2. procedural full-catalog path.

Skin selection may influence:

- aura;
- tint;
- trail;
- particles;
- glow;
- rarity intensity.

It never changes hitboxes, movement, stats, damage, targeting, mana, cooldowns or vision.

## Environment

The deterministic environment remains composed of:

- terrain;
- river;
- vegetation;
- mist;
- torches/lights;
- ambient particles;
- jungle/objective presence;
- ward vision.

Visual 3.1 adds filtered reactive light around important battlefield entities while retaining quality budgets.

## Skeletal animation readiness

`src/visual/skeletalAnimationContract.ts` defines a stable driver contract for:

- idle;
- run;
- attack;
- Q/W/E/R;
- hit;
- stun;
- death;
- recall.

The current sprite/procedural renderer remains the default.

A future `spine-pixi-v8` adapter can implement the same contract if a licensed Spine content pipeline is adopted. Spine is **not** a mandatory dependency in Visual 3.1.

## Authority boundary

The visual runtime continues to be forbidden from importing gameplay implementation directly from `src/game/`.

Legacy visual metadata is indexed into a versioned static catalog.

Live effects execute only from authoritative simulation state and published authoritative content.

## Chromium proof

The Visual 3.1 proof uses the full 3.0 authority stack.

The capture demonstrates:

- full-authority 3v3 scene;
- full Q/W/E/R HUD;
- Anya local hero with skin visual identity;
- Luxana W support/shield cast;
- Luxana Q root/control cast;
- Anya E defensive cast;
- Anya Q damage cast;
- level-up and item change presentation;
- ward placement;
- objective completion;
- GPU particle/mesh/filter/shader stack;
- authoritative hero/item counts;
- indexed runes/summoners/skins/effect metadata.

Implementation proof:

- CI #380;
- HEAD `a634684713e16bb3bbee66eabe4d4ea12c702a83`;
- all client/server gates green;
- Chromium artifact visually inspected.

## Certification gate

Final release certification still requires:

1. final documentation HEAD CI green;
2. PR merge-ref CI green;
3. protected squash merge with expected HEAD SHA;
4. fresh post-merge CI on the resulting main SHA.
