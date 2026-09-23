import assert from 'node:assert/strict';
import test from 'node:test';
import type { CoreMovementCommand } from '../shared/protocol.ts';
import { combatFixtureCommands } from './fixtures/combatRepro.ts';
import { createSimulation, isPositionVisibleToTeam, stepSimulation } from './core.ts';
import { runDeterminismProbe } from './determinism.ts';
import { hashSimulationState } from './hash.ts';
import { buildSpatialHash, querySpatialHash } from './spatialHash.ts';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent.ts';

const options = {
  seed: 0xC0FFEE,
  contentVersion: 'test-content',
  players: [
    { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000 },
    { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000 },
  ],
};

function scenarioCommands(tick: number): readonly CoreMovementCommand[] {
  const commands: CoreMovementCommand[] = [];
  if (tick === 0) {
    commands.push({ type: 'attack', playerId: 'blue-1', seq: 1, tick, targetId: 2 });
    commands.push({ type: 'attack', playerId: 'red-1', seq: 1, tick, targetId: 1 });
  }
  if (tick === 300) commands.push({ type: 'move', playerId: 'blue-1', seq: 2, tick, x: 1200, y: 1100 });
  if (tick === 600) commands.push({ type: 'move', playerId: 'red-1', seq: 2, tick, x: 1180, y: 1100 });
  if (tick === 900) commands.push({ type: 'stop', playerId: 'blue-1', seq: 3, tick });
  return commands;
}

test('same seed + same inputs stays deterministic for 100k ticks', () => {
  const probe = runDeterminismProbe(options, 100_000, scenarioCommands);
  assert.equal(probe.ok, true, 'divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});

test('lane simulation stays deterministic across waves and AI', () => {
  const probe = runDeterminismProbe({ ...options, withLane: true }, 5_000, () => []);
  assert.equal(probe.ok, true, 'lane divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});

test('input sequence rejects duplicates and stale commands', () => {
  const state = createSimulation(options);
  stepSimulation(state, [
    { type: 'move', playerId: 'blue-1', seq: 1, tick: 0, x: 1100, y: 1000 },
    { type: 'move', playerId: 'blue-1', seq: 1, tick: 0, x: 2000, y: 2000 },
  ]);
  assert.equal(state.lastAcceptedSeq['blue-1'], 1);
  assert.notEqual(state.entities['1'].moveTarget?.x, 2000);
});

test('state hash changes when authoritative state changes', () => {
  const state = createSimulation(options);
  const before = hashSimulationState(state);
  stepSimulation(state, []);
  const after = hashSimulationState(state);
  assert.notEqual(before, after);
});

test('lane starts with towers and deterministic minion wave', () => {
  const state = createSimulation({ ...options, withLane: true });
  assert.equal(Object.values(state.entities).filter((entity) => entity.kind === 'tower').length, 2);
  stepSimulation(state, []);
  assert.equal(state.waveNumber, 1);
  assert.equal(Object.values(state.entities).filter((entity) => entity.kind === 'minion').length, 6);
});

test('hero last-hit awards gold, xp and cs authoritatively', () => {
  const state = createSimulation({ ...options, withLane: true });
  stepSimulation(state, []);
  const hero = state.entities['1'];
  const minion = Object.values(state.entities).find((entity) => entity.kind === 'minion' && entity.team === 1);
  assert.ok(minion);
  minion.x = hero.x + 20;
  minion.y = hero.y;
  minion.hp = 1;
  const goldBefore = hero.gold;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: state.tick, targetId: minion.id }]);
  assert.equal(minion.dead, true);
  assert.equal(hero.cs, 1);
  assert.equal(hero.gold, goldBefore + minion.bountyGold);
  assert.ok(hero.xp > 0);
});

test('destroying enemy lane tower produces a deterministic winner', () => {
  const state = createSimulation({ ...options, withLane: true });
  const hero = state.entities['1'];
  const tower = Object.values(state.entities).find((entity) => entity.kind === 'tower' && entity.team === 1);
  assert.ok(tower);
  tower.x = hero.x + 20;
  tower.y = hero.y;
  tower.hp = 1;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: 0, targetId: tower.id }]);
  assert.equal(tower.dead, true);
  assert.equal(state.winner, 0);
});

test('spatial hash returns stable sorted candidate IDs', () => {
  const state = createSimulation({ ...options, withLane: true });
  stepSimulation(state, []);
  const index = buildSpatialHash(state.entities, 128);
  const ids = querySpatialHash(index, 1500, 1500, 2000);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.ok(ids.length >= 10);
});


test('Gareth Q is authoritative, applies slow and respects cooldown', () => {
  const state = createSimulation({
    ...options,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000, heroId: 'luxana' as const },
    ],
  });
  const target = state.entities['2'];
  const hpBefore = target.hp;
  stepSimulation(state, [{ type: 'cast', playerId: 'blue-1', seq: 1, tick: 0, slot: 'Q', targetId: 2 }]);
  assert.ok(target.hp < hpBefore);
  assert.ok(target.statuses.some((status) => status.kind === 'slow'));
  assert.ok(state.entities['1'].abilityCooldowns.Q > 0);
  const afterFirst = target.hp;
  stepSimulation(state, [{ type: 'cast', playerId: 'blue-1', seq: 2, tick: 1, slot: 'Q', targetId: 2 }]);
  assert.equal(target.hp, afterFirst);
});

test('Luxana Q resolves a deterministic line hit and roots the first enemy', () => {
  const state = createSimulation({
    ...options,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000, heroId: 'luxana' as const },
    ],
  });
  const target = state.entities['1'];
  const hpBefore = target.hp;
  stepSimulation(state, [{ type: 'cast', playerId: 'red-1', seq: 1, tick: 0, slot: 'Q', x: 800, y: 1000 }]);
  assert.ok(target.hp < hpBefore);
  assert.ok(target.statuses.some((status) => status.kind === 'root'));
  const xBefore = target.x;
  stepSimulation(state, [{ type: 'move', playerId: 'blue-1', seq: 1, tick: 1, x: 1300, y: 1000 }]);
  assert.equal(target.x, xBefore);
});

test('lane XP is shared deterministically between nearby allied heroes', () => {
  const state = createSimulation({
    seed: 42,
    contentVersion: 'test-content',
    withLane: true,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'blue-2', team: 0 as const, x: 1020, y: 1000, heroId: 'luxana' as const },
      { playerId: 'red-1', team: 1 as const, x: 1600, y: 1000, heroId: 'luxana' as const },
    ],
  });
  stepSimulation(state, []);
  const killer = state.entities['1'];
  const ally = state.entities['2'];
  const minion = Object.values(state.entities).find((entity) => entity.kind === 'minion' && entity.team === 1);
  assert.ok(minion);
  minion.x = killer.x + 20;
  minion.y = killer.y;
  minion.hp = 1;
  const killerXp = killer.xp;
  const allyXp = ally.xp;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: state.tick, targetId: minion.id }]);
  assert.ok(killer.xp > killerXp);
  assert.ok(ally.xp > allyXp);
  assert.equal(killer.xp - killerXp, ally.xp - allyXp);
});

test('tower prioritizes a hero that damages an allied hero in tower range', () => {
  const state = createSimulation({
    seed: 77,
    contentVersion: 'test-content',
    withLane: true,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 600, y: 1500, heroId: 'gareth' as const },
      { playerId: 'red-1', team: 1 as const, x: 640, y: 1500, heroId: 'luxana' as const },
    ],
  });
  const blueTower = Object.values(state.entities).find((entity) => entity.kind === 'tower' && entity.team === 0);
  assert.ok(blueTower);
  stepSimulation(state, [{ type: 'attack', playerId: 'red-1', seq: 1, tick: 0, targetId: 1 }]);
  assert.equal(blueTower.attackTargetId, 2);
});

test('overlapping movable entities separate deterministically', () => {
  const state = createSimulation({
    seed: 9,
    contentVersion: 'test-content',
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000 },
      { playerId: 'red-1', team: 1 as const, x: 1000, y: 1000 },
    ],
  });
  stepSimulation(state, []);
  const a = state.entities['1'];
  const b = state.entities['2'];
  assert.notDeepEqual([a.x, a.y], [b.x, b.y]);
});

test('recorded combat command fixture stays deterministic', () => {
  const fixtureOptions = {
    seed: 0xBADA55,
    contentVersion: 'combat-fixture-v1',
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000, heroId: 'luxana' as const },
    ],
  };
  const probe = runDeterminismProbe(fixtureOptions, 500, combatFixtureCommands);
  assert.equal(probe.ok, true, 'fixture divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});


test('published item purchase spends gold and applies stats authoritatively', () => {
  const state = createSimulation(options);
  const hero = state.entities['1'];
  const damageBefore = hero.attackDamage;
  stepSimulation(state, [{
    type: 'buy',
    playerId: 'blue-1',
    seq: 1,
    tick: 0,
    itemId: 'longsword',
  }]);
  assert.deepEqual(hero.inventory, ['longsword']);
  assert.equal(hero.gold, CURRENT_AUTHORITATIVE_CONTENT.payload.rules.startingGold - 350);
  assert.equal(hero.attackDamage, damageBefore + 10);
});

test('item purchase is rejected outside the authoritative shop radius', () => {
  const state = createSimulation(options);
  const hero = state.entities['1'];
  hero.x = hero.spawnX + CURRENT_AUTHORITATIVE_CONTENT.payload.rules.shopRadius + 50;
  const goldBefore = hero.gold;
  stepSimulation(state, [{
    type: 'buy',
    playerId: 'blue-1',
    seq: 1,
    tick: 0,
    itemId: 'longsword',
  }]);
  assert.deepEqual(hero.inventory, []);
  assert.equal(hero.gold, goldBefore);
});

test('Q runtime consumes published ability values instead of hidden constants', () => {
  const published = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  const gareth = published.heroes.find((hero) => hero.id === 'gareth');
  assert.ok(gareth);
  gareth.q.damageBase += 77;

  const state = createSimulation({
    ...options,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'red-1', team: 1 as const, x: 1060, y: 1000, heroId: 'luxana' as const },
    ],
  }, published);
  const target = state.entities['2'];
  const hpBefore = target.hp;
  stepSimulation(state, [{
    type: 'cast',
    playerId: 'blue-1',
    seq: 1,
    tick: 0,
    slot: 'Q',
    targetId: 2,
  }], published);

  const expected = gareth.q.damageBase +
    Math.trunc(state.entities['1'].attackDamage * gareth.q.damageAdPermille / 1000);
  assert.equal(hpBefore - target.hp, expected);
});


test('authoritative jungle spawns published neutral camps and objective deterministically', () => {
  const state = createSimulation({ ...options, withJungle: true });
  const monsters = Object.values(state.entities).filter((entity) => entity.kind === 'monster');
  const objectives = Object.values(state.entities).filter((entity) => entity.kind === 'objective');
  assert.equal(monsters.length, 2);
  assert.equal(objectives.length, 1);
  assert.deepEqual(
    [...monsters, ...objectives].map((entity) => entity.campId).sort(),
    ['blue-camp', 'red-camp', 'rift-sentinel'],
  );
});

test('neutral camp kill grants authoritative reward and respawns from published timing', () => {
  const state = createSimulation({ ...options, withJungle: true });
  const hero = state.entities['1'];
  const camp = Object.values(state.entities).find((entity) => entity.kind === 'monster');
  assert.ok(camp);
  const definition = CURRENT_AUTHORITATIVE_CONTENT.payload.neutralUnits.find((entry) => entry.id === camp.campId);
  assert.ok(definition);
  camp.x = hero.x + 20;
  camp.y = hero.y;
  camp.hp = 1;
  const goldBefore = hero.gold;
  const xpBefore = hero.xp;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: 0, targetId: camp.id }]);
  assert.equal(camp.dead, true);
  assert.equal(hero.gold, goldBefore + definition.bountyGold);
  assert.equal(hero.xp, xpBefore + definition.xpBounty);
  assert.equal(camp.respawnAtTick, definition.respawnTicks);
  state.tick = camp.respawnAtTick!;
  stepSimulation(state, []);
  assert.equal(camp.dead, false);
  assert.equal(camp.hp, camp.maxHp);
  assert.deepEqual([camp.x, camp.y], [camp.spawnX, camp.spawnY]);
});

test('epic objective awards team gold and objective score authoritatively', () => {
  const state = createSimulation({
    seed: 91,
    contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    withJungle: true,
    players: [
      { playerId: 'blue-1', team: 0 as const, x: 1000, y: 1000, heroId: 'gareth' as const },
      { playerId: 'blue-2', team: 0 as const, x: 1020, y: 1000, heroId: 'luxana' as const },
      { playerId: 'red-1', team: 1 as const, x: 2100, y: 1000, heroId: 'luxana' as const },
    ],
  });
  const objective = Object.values(state.entities).find((entity) => entity.kind === 'objective');
  assert.ok(objective);
  const definition = CURRENT_AUTHORITATIVE_CONTENT.payload.neutralUnits.find((entry) => entry.id === objective.campId);
  assert.ok(definition);
  const killer = state.entities['1'];
  const ally = state.entities['2'];
  objective.x = killer.x + 20;
  objective.y = killer.y;
  objective.hp = 1;
  const killerGold = killer.gold;
  const allyGold = ally.gold;
  stepSimulation(state, [{ type: 'attack', playerId: 'blue-1', seq: 1, tick: 0, targetId: objective.id }]);
  assert.equal(state.objectiveScore[0], 1);
  assert.equal(killer.gold, killerGold + definition.bountyGold + definition.teamGold);
  assert.equal(ally.gold, allyGold + definition.teamGold);
});

test('ward placement is authoritative, cooldown-bound, visible and expires deterministically', () => {
  const state = createSimulation(options);
  const hero = state.entities['1'];
  assert.equal(isPositionVisibleToTeam(state, 0, { x: 1900, y: 1000 }), false);
  stepSimulation(state, [{
    type: 'place-ward',
    playerId: 'blue-1',
    seq: 1,
    tick: 0,
    x: 1500,
    y: 1000,
  }]);
  const ward = Object.values(state.entities).find((entity) => entity.kind === 'ward');
  assert.ok(ward);
  assert.equal(ward.team, 0);
  assert.equal(
    ward.expiresAtTick,
    CURRENT_AUTHORITATIVE_CONTENT.payload.rules.wardDurationTicks,
  );
  assert.equal(
    hero.wardCooldownRemaining,
    CURRENT_AUTHORITATIVE_CONTENT.payload.rules.wardCooldownTicks - 1,
  );
  assert.equal(isPositionVisibleToTeam(state, 0, { x: 1900, y: 1000 }), true);

  const wardCount = Object.values(state.entities).filter((entity) => entity.kind === 'ward').length;
  stepSimulation(state, [{
    type: 'place-ward',
    playerId: 'blue-1',
    seq: 2,
    tick: 1,
    x: 1400,
    y: 1000,
  }]);
  assert.equal(Object.values(state.entities).filter((entity) => entity.kind === 'ward').length, wardCount);

  ward.expiresAtTick = state.tick;
  stepSimulation(state, []);
  assert.equal(state.entities[String(ward.id)], undefined);
});

test('ward placement beyond published range is rejected', () => {
  const state = createSimulation(options);
  stepSimulation(state, [{
    type: 'place-ward',
    playerId: 'blue-1',
    seq: 1,
    tick: 0,
    x: 2500,
    y: 2500,
  }]);
  assert.equal(Object.values(state.entities).some((entity) => entity.kind === 'ward'), false);
});

test('jungle + objective + ward state stays deterministic', () => {
  const probe = runDeterminismProbe(
    { ...options, withLane: true, withJungle: true },
    5_000,
    (tick) => tick === 0
      ? [{ type: 'place-ward', playerId: 'blue-1', seq: 1, tick, x: 1300, y: 1000 }]
      : [],
  );
  assert.equal(probe.ok, true, 'jungle/ward divergiu no tick ' + probe.firstDivergentTick);
  assert.equal(probe.hashA, probe.hashB);
});
