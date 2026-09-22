# ForgedMoba deterministic simulation core

This directory is the migration target for authoritative gameplay.

Rules:

1. No DOM, Canvas, React, WebAudio, localStorage or network calls.
2. No Math.random(); randomness must flow through the seeded RNG state.
3. Time is measured in integer simulation ticks, not wall-clock dt.
4. Authoritative references use IDs, never object/function references.
5. The same seed + content version + ordered command log must produce the same state hash.
6. Rendering/VFX may be non-deterministic, but they live outside this directory.

The legacy src/game/engine.ts remains the playable implementation while systems are migrated incrementally. Do not delete or mass-rewrite it until equivalent behavior is covered by simulation tests.
