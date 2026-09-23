import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_AUTHORITATIVE_CONTENT,
  publishAuthoritativeContent,
  validateAuthoritativeContent,
} from '../shared/authoritativeContent.ts';

test('published authoritative content is stable for identical payloads', () => {
  const left = publishAuthoritativeContent(
    'authority-test',
    structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload),
  );
  const right = publishAuthoritativeContent(
    'authority-test',
    structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload),
  );
  assert.equal(left.contentVersion, right.contentVersion);
  assert.equal(left.manifest.hash, right.manifest.hash);
});

test('gameplay content mutation changes the published hash', () => {
  const original = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  const changed = structuredClone(original);
  changed.heroes[0].q.damageBase += 1;
  const a = publishAuthoritativeContent('authority-test', original);
  const b = publishAuthoritativeContent('authority-test', changed);
  assert.notEqual(a.manifest.hash, b.manifest.hash);
  assert.notEqual(a.contentVersion, b.contentVersion);
});

test('publisher rejects duplicate IDs and malformed rules', () => {
  const duplicate = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  duplicate.items.push(structuredClone(duplicate.items[0]));
  assert.throws(() => validateAuthoritativeContent(duplicate), /duplicate ID/);

  const malformed = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  malformed.rules.tickRate = 0;
  assert.throws(() => validateAuthoritativeContent(malformed), /tickRate/);
});


test('published pack is frozen and detached from the source draft', () => {
  const draft = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  const published = publishAuthoritativeContent('authority-frozen', draft);
  const before = published.payload.heroes[0].maxHp;
  draft.heroes[0].maxHp += 999;
  assert.equal(published.payload.heroes[0].maxHp, before);
  assert.equal(Object.isFrozen(published.payload), true);
  assert.equal(Object.isFrozen(published.payload.heroes[0]), true);
});


test('jungle and ward gameplay mutations alter the published content hash', () => {
  const original = structuredClone(CURRENT_AUTHORITATIVE_CONTENT.payload);
  const jungleChanged = structuredClone(original);
  jungleChanged.neutralUnits[0].respawnTicks += 1;
  const wardChanged = structuredClone(original);
  wardChanged.rules.wardDurationTicks += 1;

  const base = publishAuthoritativeContent('authority-test', original);
  const jungle = publishAuthoritativeContent('authority-test', jungleChanged);
  const ward = publishAuthoritativeContent('authority-test', wardChanged);

  assert.notEqual(base.contentVersion, jungle.contentVersion);
  assert.notEqual(base.contentVersion, ward.contentVersion);
});
