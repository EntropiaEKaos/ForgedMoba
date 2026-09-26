import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('public/assets/art/v2/manifest.json');
if (!existsSync(manifestPath)) {
  console.error('[art-assets] missing manifest:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const errors = [];
const refs = [
  ['terrain.map', manifest?.terrain?.map],
  ['world.source', manifest?.world?.source],
  ...((manifest?.heroes ?? []).map((hero) => ['hero:' + hero.heroId, hero.source])),
];

let totalBytes = 0;
for (const [label, url] of refs) {
  if (typeof url !== 'string' || !url.startsWith('/assets/art/v2/')) {
    errors.push(label + ': asset must live under /assets/art/v2/');
    continue;
  }
  const disk = resolve('public' + url);
  if (!existsSync(disk)) {
    errors.push(label + ': referenced asset missing: ' + disk);
    continue;
  }
  const info = statSync(disk);
  totalBytes += info.size;
  if (info.size > 2_000_000) errors.push(label + ': individual asset exceeds 2MB budget');
  if (disk.endsWith('.svg')) {
    const svg = readFileSync(disk, 'utf8');
    if (!/<svg\b/.test(svg) || !/viewBox=/.test(svg)) {
      errors.push(label + ': SVG must declare viewBox');
    }
  }
}

if (totalBytes > 6_000_000) errors.push('art pack exceeds 6MB source budget');
if (!Array.isArray(manifest?.heroes) || manifest.heroes.length < 2) {
  errors.push('manifest must provide at least the authoritative Gareth/Luxana coverage');
}

if (errors.length) {
  console.error('[art-assets] validation failed');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log(
  '[art-assets] OK · pack=' + manifest.id +
  ' · heroes=' + manifest.heroes.length +
  ' · bytes=' + totalBytes,
);
