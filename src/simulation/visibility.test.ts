import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent.ts';
import { createSimulation, stepSimulation } from './core.ts';
import { createClientViewState } from './visibility.ts';

function state() {
  return createSimulation({
    seed: 42,
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue', team: 0, x: 700, y: 1500, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 2300, y: 1500, heroId: 'luxana' },
    ],
  });
}

test('client view always includes friendly entities but hides distant enemies and neutral units', () => {
  const authoritative = state();
  const view = createClientViewState(authoritative, 'blue');

  assert.ok(Object.values(view.entities).some((entity) => entity.ownerPlayerId === 'blue'));
  assert.ok(Object.values(view.entities).some((entity) => entity.kind === 'tower' && entity.team === 0));
  assert.equal(Object.values(view.entities).some((entity) => entity.ownerPlayerId === 'red'), false);
  assert.equal(Object.values(view.entities).some((entity) => entity.kind === 'objective'), false);
});

test('enemy becomes visible when inside authoritative hero vision', () => {
  const authoritative = state();
  const blue = Object.values(authoritative.entities).find((entity) => entity.ownerPlayerId === 'blue');
  const red = Object.values(authoritative.entities).find((entity) => entity.ownerPlayerId === 'red');
  assert.ok(blue && red);
  red.x = blue.x + CURRENT_AUTHORITATIVE_CONTENT.payload.rules.heroVisionRadius - 10;
  red.y = blue.y;

  const view = createClientViewState(authoritative, 'blue');
  assert.ok(Object.values(view.entities).some((entity) => entity.ownerPlayerId === 'red'));
});

test('friendly ward reveals enemies but enemy wards never leak through normal vision', () => {
  const authoritative = state();
  const blue = Object.values(authoritative.entities).find((entity) => entity.ownerPlayerId === 'blue');
  const red = Object.values(authoritative.entities).find((entity) => entity.ownerPlayerId === 'red');
  assert.ok(blue && red);

  stepSimulation(authoritative, [{
    type: 'place-ward',
    playerId: 'blue',
    seq: 1,
    tick: authoritative.tick,
    x: blue.x + 500,
    y: blue.y,
  }]);
  const blueWard = Object.values(authoritative.entities).find((entity) => entity.kind === 'ward' && entity.team === 0);
  assert.ok(blueWard);
  red.x = blueWard.x + 100;
  red.y = blueWard.y;

  stepSimulation(authoritative, [{
    type: 'place-ward',
    playerId: 'red',
    seq: 1,
    tick: authoritative.tick,
    x: red.x - 20,
    y: red.y,
  }]);
  const redWard = Object.values(authoritative.entities).find((entity) => entity.kind === 'ward' && entity.team === 1);
  assert.ok(redWard);

  const view = createClientViewState(authoritative, 'blue');
  assert.ok(Object.values(view.entities).some((entity) => entity.ownerPlayerId === 'red'));
  assert.ok(view.entities[String(blueWard.id)]);
  assert.equal(view.entities[String(redWard.id)], undefined);
});

test('client view removes server RNG seed and other players input acknowledgements', () => {
  const authoritative = state();
  authoritative.lastAcceptedSeq.blue = 12;
  authoritative.lastAcceptedSeq.red = 99;
  const view = createClientViewState(authoritative, 'blue');

  assert.equal(view.seed, 0);
  assert.equal(view.rngState, 0);
  assert.deepEqual(view.lastAcceptedSeq, { blue: 12 });
  assert.notEqual(view.nextEntityId, authoritative.nextEntityId);
});
