# Combat / Lane Parity 0.3

This slice extends the deterministic server-authoritative core without replacing the legacy offline renderer.

## Authoritative combat added

### Gareth Q

- targeted melee-range Q
- authoritative damage
- deterministic slow status
- deterministic cooldown
- server validates target/range through the simulation

### Luxana Q

- deterministic line query
- first valid enemy in the line is selected by distance then entity ID
- authoritative damage
- deterministic root status
- deterministic cooldown

Only Q is authoritative in this phase. W/E/R remain explicitly rejected by the MatchRunner until their runtime exists.

## Status model

Statuses are plain serializable records:

- kind
- source entity ID
- expiry simulation tick
- magnitude in permille

No callbacks, timers, DOM references or object pointers are stored in authoritative state.

## Lane parity

- nearby allied heroes share minion XP
- last-hit gold and CS remain owned by the killer
- enemy heroes that damage a hero can provoke the allied tower
- towers still fall back to minion-first targeting
- movable entities receive deterministic ID-ordered separation
- movement remains constrained to authoritative world bounds

## Reproduction fixture

`src/simulation/fixtures/combatRepro.ts` is the first command-log regression fixture.

It demonstrates the intended debugging model:

```text
content version + seed + ordered commands
                    ↓
             deterministic replay
                    ↓
              identical state hash
```

Future production bugs should be reduced into fixtures like this whenever possible.

## Certification gates

The phase is not considered merged until the same branch HEAD passes:

- simulation architecture boundary check
- root TypeScript
- deterministic suite including 100k soak
- combat fixture regression
- production build
- server TypeScript
- MatchRunner tests
- PR CI
- post-merge main CI
