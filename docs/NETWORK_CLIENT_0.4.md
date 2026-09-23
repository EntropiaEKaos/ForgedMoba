# Network Client 0.4

## Purpose

This phase makes the authoritative simulation usable as a responsive online client without moving gameplay authority back into the browser.

The legacy offline Canvas game remains intact. Online matches use a separate diagnostic screen until prediction/reconciliation and remote interpolation are certified.

## Prediction

The client does not maintain a second movement/combat implementation.

It clones the newest authoritative `SimulationState` and calls the same deterministic `stepSimulation()` used by the server while replaying local inputs that have not yet been acknowledged.

```text
server snapshot
      +
unacknowledged local commands
      ↓
same deterministic simulation
      ↓
predicted local state
```

## Reconciliation

Every authoritative snapshot includes `ackSeqByPlayer`.

When a snapshot arrives:

1. commands at or below the acknowledged sequence are dropped;
2. remaining commands stay in sequence/tick order;
3. the authoritative state replaces the prediction base;
4. pending commands are replayed;
5. correction distance is recorded for telemetry.

No client-predicted damage, gold, death, objective or winner state is ever trusted by the server.

## Remote interpolation

Authoritative snapshots arrive about every 3 simulation ticks (~10 Hz).

Remote entities are rendered from a bounded snapshot buffer several ticks behind estimated server time. Position and HP interpolate between two authoritative snapshots. The locally controlled entity uses prediction instead.

## Network telemetry

The connection manager tracks:

- RTT;
- approximate RTT jitter;
- average snapshot arrival interval;
- missed snapshot windows;
- most recent reconciliation correction distance;
- pending unacknowledged local inputs.

These values are visible on the authoritative online diagnostics screen.

## Reconnect

Within the current in-memory development server lifetime, a reconnecting authenticated user is re-associated with their existing `ActiveMatch` by user ID.

The new socket:

- replaces the old socket ID in the match participant record;
- rejoins the Socket.IO room;
- receives `game:resumed`;
- immediately receives the newest authoritative snapshot.

Persistent process-independent reconnect belongs to a later persistence phase.

## Online diagnostics screen

The online screen intentionally favors correctness and observability over final art.

Controls:

- RMB: move
- LMB: attack a nearby target under the pointer
- Q: Gareth targeted Q / Luxana line Q
- S: stop
- Escape: leave local online slice view

It renders:

- predicted local hero;
- interpolated remote entities;
- authoritative minions/towers;
- HP;
- server tick/content version;
- RTT/jitter/correction/pending-input metrics.

## Certification

0.4 is not considered merged until all of these pass on the exact PR HEAD and again after merge:

- simulation boundary check;
- TypeScript strict mode;
- 100k deterministic simulation suite;
- network prediction/reconciliation/interpolation tests;
- production build;
- server TypeScript;
- MatchRunner tests.

## Dependency audit note

The current root `npm ci` reports npm audit findings inherited from the dependency graph. They are tracked explicitly. This phase will not use `npm audit fix --force` because a forced major upgrade without compatibility certification would be less professional than a scoped dependency remediation PR.
