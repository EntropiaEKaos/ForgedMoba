import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateArtManifest } from './types.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../../public/assets/art/v2/manifest.json', import.meta.url), 'utf8'),
);

test('production art manifest validates and exposes authoritative hero art coverage', () => {
  const parsed = validateArtManifest(manifest);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.id, 'forged-art-v2.1.0');
  assert.deepEqual(parsed.heroes.map((hero) => hero.heroId).sort(), ['gareth', 'luxana']);
});

test('manifest requires all four production animation states', () => {
  const parsed = validateArtManifest(manifest);
  for (const hero of parsed.heroes) {
    for (const pose of ['idle', 'run', 'attack', 'cast'] as const) {
      assert.ok(hero.animations[pose].frames.length > 0);
      assert.ok(hero.animations[pose].fps > 0);
    }
  }
});

test('manifest validator rejects duplicate hero atlases', () => {
  const invalid = structuredClone(manifest);
  invalid.heroes.push(structuredClone(invalid.heroes[0]));
  assert.throws(() => validateArtManifest(invalid), /duplicate hero atlas/);
});


test('world atlas covers every authoritative battlefield presentation kind', () => {
  const parsed = validateArtManifest(manifest);
  const keys = Object.keys(parsed.world.sprites).sort();
  assert.deepEqual(keys, [
    'blue-minion',
    'blue-tower',
    'blue-ward',
    'epic-objective',
    'jungle-monster',
    'red-minion',
    'red-tower',
    'red-ward',
  ]);
  assert.equal(parsed.world.frameWidth, 128);
  assert.equal(parsed.world.frameHeight, 128);
});

test('manifest validator rejects an incomplete world atlas', () => {
  const invalid = structuredClone(manifest);
  delete invalid.world.sprites['epic-objective'];
  assert.throws(() => validateArtManifest(invalid), /world sprite missing: epic-objective/);
});
