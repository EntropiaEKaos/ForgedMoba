# ForgedMoba Architecture

## Direction

ForgedMoba is migrating from a rich client-authoritative prototype to a server-authoritative multiplayer architecture without discarding the existing game.

The legacy `src/game/engine.ts` remains the playable reference implementation while systems move incrementally into a deterministic, headless simulation core.

## Non-negotiable boundaries

- `src/simulation/**` is deterministic and headless.
- No DOM, Canvas, WebAudio, localStorage, React, or browser APIs in authoritative simulation.
- No `Math.random()` in authoritative simulation. Use `SeededRng`.
- Cross-network references use IDs, not object references or callbacks.
- Clients send intentions/commands; the authoritative server computes outcomes.
- Rendering is a consumer of state, not an owner of game truth.
- Every production match is pinned to a content version and seed.

## Target topology

```text
Client Input
   ↓
Prediction
   ↓
Command Protocol
   ↓
Authoritative Match Server
   ↓
Deterministic Simulation
   ↓
Snapshots / acknowledgements
   ↓
Reconciliation + Interpolation
   ↓
Renderer / VFX / HUD
```

## Tick model

- Simulation: 30 Hz fixed tick.
- Client rendering: independent frame rate.
- Inputs carry monotonically increasing sequence numbers.
- Server snapshots acknowledge the last processed sequence per player.
- Replays are based on seed + content version + ordered input log.

## Migration sequence

1. Foundation gates and deterministic skeleton.
2. Movement and basic combat.
3. Lane/minion/tower slice.
4. Headless server runner.
5. 1v1 network slice.
6. Prediction/reconciliation.
7. 3v3 and reconnect.
8. 5v5, objectives, jungle, wards and draft.
9. Replay/spectator/ranked/telemetry.

## Current legacy hotspots

The initial audit identified two intentionally preserved monoliths:
- `src/game/engine.ts`: simulation, AI, input, renderer, VFX and local networking.
- `src/App.tsx`: screen flow and large portions of HUD/UI.

They are migration sources, not immediate rewrite targets.
