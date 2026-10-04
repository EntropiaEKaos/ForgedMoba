import assert from 'node:assert/strict';
import test from 'node:test';
import { materialForAbilityKey, materialForHero, profileForEvent } from './capabilityRegistry.ts';

test('known heroes resolve to distinct material identities', () => {
  assert.equal(materialForHero('gareth').id, 'steel');
  assert.equal(materialForHero('luxana').id, 'radiant');
  assert.equal(materialForHero('volcarn').id, 'fire');
});

test('legacy ability keys can resolve semantic material families', () => {
  assert.equal(materialForAbilityKey('volcanoerupt').id, 'fire');
  assert.equal(materialForAbilityKey('crystalarrow').id, 'frost');
  assert.equal(materialForAbilityKey('staticfield').id, 'storm');
  assert.equal(materialForAbilityKey('blackhole').id, 'void');
});

test('authoritative visual events resolve without importing the legacy engine', () => {
  const profile = profileForEvent({
    type: 'q-cast',
    tick: 10,
    entityId: 1,
    x: 50,
    y: 60,
    heroId: 'luxana',
  });
  assert.equal(profile.id, 'radiant');
});
