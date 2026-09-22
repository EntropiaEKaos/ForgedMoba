import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentManifest, hashContent, stableContentString } from '../shared/contentVersion.ts';

test('content hashing is key-order independent for equivalent JSON data', () => {
  const a = { heroes: [{ id: 'a', hp: 600 }], rules: { tickRate: 30, mode: 'lane' } };
  const b = { rules: { mode: 'lane', tickRate: 30 }, heroes: [{ hp: 600, id: 'a' }] };
  assert.equal(stableContentString(a), stableContentString(b));
  assert.equal(hashContent(a), hashContent(b));
});

test('content manifest binds explicit version to deterministic payload hash', () => {
  const manifest = createContentManifest('core-0.2', { tickRate: 30, lane: true });
  assert.equal(manifest.version, 'core-0.2');
  assert.match(manifest.hash, /^[0-9a-f]{8}$/);
});
