# Visual 1.1 — Combat FX

## Goal

Add high-impact combat presentation on top of the certified Pixi battlefield without introducing a second gameplay simulation.

## Event model

Combat FX are derived from consecutive visual probes of the authoritative/predicted state.

The FX model observes:

- HP deltas;
- death transitions;
- Q cooldown transitions;
- newly applied root/slow/stun statuses and their authoritative source entity;
- objective score transitions.

These transitions create disposable visual events. They are never sent back to the server and are never treated as gameplay truth.

## Effects

Visual 1.1 adds:

- GPU particle bursts through Pixi ParticleContainer;
- deterministic visual trails from authoritative status source to target;
- damage impact rings;
- floating damage text;
- hit flash;
- Q cast bursts for Gareth and Luxana;
- root/slow/stun impact colors;
- death bursts;
- objective capture burst;
- camera shake.

## Deterministic visual randomness

FX variation uses a visual-only xorshift PRNG seeded from event tick/entity IDs. It never uses Math.random() and never changes simulation state.

This makes visual regression scenarios repeatable without requiring particles themselves to be part of the server hash.

## Quality scaling

Particle counts and camera shake scale with the Visual 1.0 quality preset. Low mode limits particles aggressively; Ultra increases burst density without changing gameplay.

## Layering

The Pixi scene order is:

1. terrain;
2. combat particles;
3. entities;
4. combat overlay (rings/text).

## Authority boundary

Combat FX may read SimulationState and transform it into presentation events.

Combat FX may not:

- mutate SimulationState;
- call stepSimulation;
- emit damage/gold/cooldown outcomes;
- use legacy game-engine authority.

## Certification

The phase requires branch, PR and post-merge CI green for:

- simulation boundary;
- visual authority boundary;
- strict TypeScript;
- 100k determinism;
- network suite;
- visual suite including FX derivation/PRNG;
- production build;
- server tests;
- realistic 5v5 load gate.
