import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation } from '../simulation/core.ts';
import {
  cameraCueForEvent,
  captureCinematicProbe,
  deriveCinematicEvents,
} from './cinematicModel.ts';

function stateWithPlayers() {
  return createSimulation({
    seed: 17,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue', team: 0, x: 900, y: 1500, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 980, y: 1500, heroId: 'luxana' },
    ],
  });
}

test('cinematic model derives hero kill from authoritative score/death delta', () => {
  const state = stateWithPlayers();
  const before = captureCinematicProbe(state);
  const victim = state.entities['2'];
  victim.dead = true;
  victim.hp = 0;
  state.score[0] += 1;
  state.tick += 1;
  const events = deriveCinematicEvents(before, captureCinematicProbe(state));
  const kill = events.find((event) => event.type === 'hero-kill');
  assert.ok(kill);
  assert.equal(kill.team, 0);
  assert.equal(kill.victimId, 2);
});

test('cinematic model derives local level-up and respawn', () => {
  const state = stateWithPlayers();
  const before = captureCinematicProbe(state);
  const hero = state.entities['1'];
  hero.level = 2;
  hero.dead = false;
  state.tick += 1;
  let events = deriveCinematicEvents(before, captureCinematicProbe(state));
  const level = events.find((event) => event.type === 'level-up');
  assert.ok(level);
  assert.equal(level.level, 2);
  assert.ok(cameraCueForEvent(level, 'blue'));

  const respawnBefore = captureCinematicProbe(state);
  hero.dead = true;
  state.tick += 1;
  const deadProbe = captureCinematicProbe(state);
  hero.dead = false;
  state.tick += 1;
  events = deriveCinematicEvents(deadProbe, captureCinematicProbe(state));
  const respawn = events.find((event) => event.type === 'respawn');
  assert.ok(respawn);
  assert.equal(cameraCueForEvent(respawn, 'red'), null);
  assert.ok(cameraCueForEvent(respawn, 'blue'));
  assert.ok(respawnBefore.tick < state.tick);
});

test('objective and tower events outrank kill presentation', () => {
  const state = stateWithPlayers();
  const before = captureCinematicProbe(state);
  const tower = Object.values(state.entities).find((entity) => entity.kind === 'tower' && entity.team === 1);
  const objective = Object.values(state.entities).find((entity) => entity.kind === 'objective');
  assert.ok(tower);
  assert.ok(objective);
  tower.dead = true;
  objective.dead = true;
  state.objectiveScore[0] += 1;
  state.tick += 1;
  const events = deriveCinematicEvents(before, captureCinematicProbe(state));
  assert.equal(events[0]?.type, 'objective-kill');
  assert.ok(events.some((event) => event.type === 'tower-destroyed'));
});


test('cinematic model emits ACE only when a multi-player enemy team is fully dead', () => {
  const state = createSimulation({
    seed: 99,
    players: [
      { playerId: 'b1', team: 0, x: 800, y: 1000, heroId: 'gareth' },
      { playerId: 'b2', team: 0, x: 820, y: 1000, heroId: 'luxana' },
      { playerId: 'b3', team: 0, x: 840, y: 1000, heroId: 'gareth' },
      { playerId: 'r1', team: 1, x: 1200, y: 1000, heroId: 'luxana' },
      { playerId: 'r2', team: 1, x: 1220, y: 1000, heroId: 'gareth' },
      { playerId: 'r3', team: 1, x: 1240, y: 1000, heroId: 'luxana' },
    ],
  });
  const before = captureCinematicProbe(state);
  for (const entity of Object.values(state.entities)) {
    if (entity.kind === 'hero' && entity.team === 1) entity.dead = true;
  }
  state.score[0] += 1;
  state.tick += 1;
  const events = deriveCinematicEvents(before, captureCinematicProbe(state));
  assert.ok(events.some((event) => event.type === 'ace' && event.team === 0));
});
