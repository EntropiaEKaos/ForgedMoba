# ForgedMoba — Target Architecture

## Layers

ForgedMoba is being separated into these layers:

- src/shared/: protocol, IDs, schemas, content/version contracts.
- src/simulation/: deterministic headless authoritative gameplay.
- src/game/: legacy gameplay + renderer during migration.
- src/network/: client transport, prediction/reconciliation adapters.
- src/screens/: React application flow.
- server/: auth, matchmaking, authoritative match runners.

## Authoritative flow

player input -> client command + sequence -> optional local prediction -> transport -> server validation -> fixed-tick simulation -> authoritative hash/snapshot -> client reconciliation -> interpolation/rendering

## Time model

- Simulation target: 30 ticks/second.
- Rendering: independent from simulation, normally requestAnimationFrame.
- Cooldowns and authoritative timers: integer ticks.
- Wall-clock time must not decide simulation outcomes.

## Determinism contract

For a given simulation build/content version, initial seed, initial state and ordered command log, the simulation must produce the same authoritative hash at every tick.

A divergence must be diagnosable by the first divergent tick, not merely by a final replay mismatch.

## State rules

Authoritative state:

- contains IDs instead of references to live JS objects,
- contains data instead of callbacks/functions,
- does not depend on Canvas/DOM/React/audio,
- does not call Math.random(),
- is serializable for snapshots/reconnect/replay.

Presentation state may remain richer and non-deterministic because it is never the source of truth.

## Networking strategy

Default strategy:

- dedicated authoritative match server,
- client-side movement prediction,
- server reconciliation using input sequence acknowledgements,
- interpolation for remote entities,
- snapshot/delta cadence lower than render cadence.

Rollback is reserved for mechanics that prove they need it after measurement. It is not a prerequisite for the first reliable 5v5 implementation.

## Migration sequence

1. Infrastructure/CI.
2. Deterministic movement/combat slice.
3. Lane/minions/towers/economy.
4. Ability runtime and content contracts.
5. Headless server runner.
6. Prediction/reconciliation.
7. 1v1 network vertical slice.
8. 3v3 reliability/reconnect.
9. 5v5, objectives, jungle, wards, draft.
10. Replay/spectator/ranked/telemetry.
