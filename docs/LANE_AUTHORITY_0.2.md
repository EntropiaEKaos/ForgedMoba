# ForgedMoba — Lane Authority 0.2

This phase is the first gameplay slice executed by a headless authoritative server runner.

## Included

- 30 Hz fixed deterministic simulation.
- simulation state version 2.
- deterministic content version/hash.
- hero movement/basic attack/death/respawn core.
- one tower per team.
- three-minion waves every 30 seconds.
- minion/tower target acquisition through a deterministic spatial hash.
- hero last-hit gold, XP and CS.
- tower destruction as the temporary vertical-slice win condition.
- 10 Hz authoritative snapshots with state hash and input acknowledgements.
- 100,000-tick deterministic no-lane stress test.
- 5,000-tick deterministic lane+AI regression test.

## Deliberately not included

This is not yet the full production ruleset. The slice intentionally omits abilities, items, jungle, wards, multiple towers, inhibitors, full map pathing, reconnect, prediction/reconciliation and production persistence.

The legacy Canvas game remains intact and playable offline. No legacy gameplay system is deleted merely because a smaller authoritative equivalent now exists.

## Certification rule

The phase may be merged only after branch CI and pull-request CI both pass the simulation boundary guard, root TypeScript, all deterministic tests, production client build, server TypeScript and authoritative runner tests. Post-merge main CI must pass again before 0.2 is called certified.
