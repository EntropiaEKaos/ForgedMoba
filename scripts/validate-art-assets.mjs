import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('public/assets/art/v2/manifest.json');
const uiManifestPath = resolve('public/assets/ui/v2/manifest.json');
const visualCatalogPath = resolve('public/assets/visual/v2.3/legacy-capabilities.json');
if (!existsSync(manifestPath)) {
  console.error('[art-assets] missing manifest:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!existsSync(uiManifestPath)) {
  console.error('[art-assets] missing UI manifest:', uiManifestPath);
  process.exit(1);
}
const uiManifest = JSON.parse(readFileSync(uiManifestPath, 'utf8'));
if (!existsSync(visualCatalogPath)) {
  console.error('[art-assets] missing Visual 2.3 legacy capability catalog:', visualCatalogPath);
  process.exit(1);
}
const visualCatalog = JSON.parse(readFileSync(visualCatalogPath, 'utf8'));
const errors = [];
const refs = [
  ['terrain.map', manifest?.terrain?.map],
  ['world.source', manifest?.world?.source],
  ...((manifest?.heroes ?? []).map((hero) => ['hero:' + hero.heroId, hero.source])),
];

const uiRefs = [
  ...Object.entries(uiManifest?.abilities ?? {}).map(([id, url]) => ['ui-ability:' + id, url]),
  ...Object.entries(uiManifest?.items ?? {}).map(([id, url]) => ['ui-item:' + id, url]),
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

let uiBytes = 0;
for (const [label, url] of uiRefs) {
  if (typeof url !== 'string' || !url.startsWith('/assets/ui/v2/')) {
    errors.push(label + ': asset must live under /assets/ui/v2/');
    continue;
  }
  const disk = resolve('public' + url);
  if (!existsSync(disk)) {
    errors.push(label + ': referenced asset missing: ' + disk);
    continue;
  }
  const info = statSync(disk);
  uiBytes += info.size;
  if (info.size > 500_000) errors.push(label + ': UI asset exceeds 500KB budget');
  if (disk.endsWith('.svg')) {
    const svg = readFileSync(disk, 'utf8');
    if (!/<svg\b/.test(svg) || !/viewBox=/.test(svg)) {
      errors.push(label + ': SVG must declare viewBox');
    }
  }
}

const requiredUiAbilities = ['gareth-q', 'luxana-q', 'locked-w', 'locked-e', 'locked-r', 'ward'];
const requiredUiItems = ['longsword', 'ruby', 'boots', 'pickaxe'];
for (const id of requiredUiAbilities) {
  if (!uiManifest?.abilities?.[id]) errors.push('missing UI ability icon: ' + id);
}
for (const id of requiredUiItems) {
  if (!uiManifest?.items?.[id]) errors.push('missing UI item icon: ' + id);
}

if (totalBytes > 6_000_000) errors.push('art pack exceeds 6MB source budget');
if (uiBytes > 2_000_000) errors.push('UI pack exceeds 2MB source budget');

if (visualCatalog?.version !== 3) errors.push('Visual 2.3 capability catalog must use version 3');
if (!String(visualCatalog?.id ?? '').startsWith('forged-visual-capabilities-')) errors.push('Visual 2.3 capability catalog id is invalid');
if ((visualCatalog?.counts?.heroes ?? 0) < 40) errors.push('Visual 2.3 capability catalog lost legacy hero coverage');
if ((visualCatalog?.counts?.items ?? 0) < 30) errors.push('Visual 2.3 capability catalog lost legacy item coverage');
if ((visualCatalog?.counts?.runes ?? 0) < 10) errors.push('Visual 2.3 capability catalog lost rune coverage');
if ((visualCatalog?.counts?.summoners ?? 0) < 8) errors.push('Visual 2.3 capability catalog lost summoner coverage');
if ((visualCatalog?.counts?.skins ?? 0) < 15) errors.push('Visual 2.3 capability catalog lost skin coverage');
if ((visualCatalog?.counts?.abilityKeys ?? 0) < 150) errors.push('Visual 2.3 capability catalog lost legacy ability-key coverage');
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
  ' · world-bytes=' + totalBytes +
  ' · ui=' + uiManifest.id +
  ' · ui-bytes=' + uiBytes +
  ' · visual-catalog=' + visualCatalog.id +
  ' · legacy-heroes=' + visualCatalog.counts.heroes +
  ' · ability-keys=' + visualCatalog.counts.abilityKeys,
);
