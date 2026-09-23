# Map Authority 0.8 — Jungle, Objectives and Wards

## Purpose

This phase moves the first non-lane map systems into the same deterministic, server-authoritative simulation already used by movement, combat, items and networking.

## Published content

Jungle and vision gameplay values are part of the immutable authoritative content pack:

- neutral spawn positions;
- HP, damage, range, cooldown and movement;
- aggro and leash radius;
- gold and XP rewards;
- respawn timers;
- objective team gold;
- ward placement range;
- ward duration;
- ward cooldown;
- ward vision radius;
- hero vision radius;
- per-team ward cap.

Any gameplay mutation changes the published content hash.

## Jungle camps

The current vertical slice publishes two neutral camps.

Neutral units:

- share the existing spatial hash and attack pipeline;
- only acquire heroes;
- retaliate when attacked;
- chase within a server-owned leash radius;
- return to their spawn when they lose a valid target;
- respawn from published timings;
- award published gold/XP to the killing hero.

No client-authored neutral HP, aggro, reward or respawn state is accepted.

## Epic objective

The Rift Sentinel is the first authoritative epic objective.

On kill:

- killer receives the published personal bounty;
- every allied hero receives published team gold;
- the team's objective score increments;
- the objective respawns on its published timer.

Objective state is included in the deterministic state hash and authoritative snapshots.

## Wards and vision

`place-ward` is a core simulation command.

Placement is validated by the simulation for:

- living hero ownership;
- published placement range;
- ward cooldown;
- per-team ward cap;
- world bounds.

Wards are deterministic entities with an authoritative expiry tick and vision radius. Oldest wards are replaced deterministically when the team cap is reached.

`isPositionVisibleToTeam()` is the first deterministic vision primitive. Hero and ward vision use server-published radii.

The current diagnostics client still receives the full development snapshot; server-side information redaction/fog-of-war snapshot filtering remains a later anti-cheat hardening step.

## Client

The online diagnostic screen renders:

- jungle camps;
- epic objective;
- wards;
- objective score;
- local ward cooldown.

Controls add `4` / `V` to place a ward at the pointer.

Prediction and reconciliation replay ward placement through the same deterministic core as the server.

## Certification

0.8 is not mergeable until the exact HEAD passes:

- simulation boundary check;
- strict TypeScript;
- 100k deterministic suite;
- jungle/objective/ward determinism tests;
- network prediction/reconciliation suite;
- production build;
- server TypeScript;
- MatchRunner tests.

The same gates must pass again on the PR merge ref and on the final `main` SHA.
