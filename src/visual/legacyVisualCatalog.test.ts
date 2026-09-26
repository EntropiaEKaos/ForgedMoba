import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLegacyVisualCatalog, type LegacyVisualCatalog } from './legacyVisualCatalog.ts';

test('legacy visual catalog validates exact coverage counts', () => {
  const catalog: LegacyVisualCatalog = {
    version: 3,
    id: 'forged-visual-capabilities-test',
    generatedFrom: 'test',
    authorityNote: 'test',
    counts: { heroes: 1, items: 1, runes: 1, summoners: 1, skins: 1, abilityKeys: 1 },
    heroes: [{ id: 'h', name: 'Hero' }],
    items: [{ id: 'i', name: 'Item' }],
    runes: [{ id: 'r', name: 'Rune' }],
    summoners: [{ id: 's', name: 'Spell' }],
    skins: [{ id: 'skin', heroId: 'h', name: 'Skin' }],
    abilityKeys: ['ability'],
  };
  assert.equal(validateLegacyVisualCatalog(catalog).counts.heroes, 1);
});
