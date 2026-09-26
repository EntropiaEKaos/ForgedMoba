export interface LegacyVisualCatalogEntry {
  id: string;
  name: string;
}

export interface LegacyVisualSkinEntry extends LegacyVisualCatalogEntry {
  heroId: string;
}

export interface LegacyVisualCatalog {
  version: number;
  id: string;
  generatedFrom: string;
  authorityNote: string;
  counts: {
    heroes: number;
    items: number;
    runes: number;
    summoners: number;
    skins: number;
    abilityKeys: number;
  };
  heroes: LegacyVisualCatalogEntry[];
  items: LegacyVisualCatalogEntry[];
  runes: LegacyVisualCatalogEntry[];
  summoners: LegacyVisualCatalogEntry[];
  skins: LegacyVisualSkinEntry[];
  abilityKeys: string[];
}

let cached: Promise<LegacyVisualCatalog> | null = null;

export function validateLegacyVisualCatalog(value: LegacyVisualCatalog): LegacyVisualCatalog {
  if (value.version !== 3) throw new Error('unsupported legacy visual catalog version');
  if (!value.id.startsWith('forged-visual-capabilities-')) throw new Error('invalid legacy visual catalog id');
  const expected = {
    heroes: value.heroes.length,
    items: value.items.length,
    runes: value.runes.length,
    summoners: value.summoners.length,
    skins: value.skins.length,
    abilityKeys: value.abilityKeys.length,
  };
  for (const [key, count] of Object.entries(expected)) {
    if (value.counts[key as keyof typeof value.counts] !== count) {
      throw new Error('legacy visual catalog count mismatch: ' + key);
    }
  }
  return value;
}

export function loadLegacyVisualCatalog(): Promise<LegacyVisualCatalog> {
  cached ??= fetch('/assets/visual/v2.3/legacy-capabilities.json')
    .then((response) => {
      if (!response.ok) throw new Error('failed to load legacy visual catalog: ' + response.status);
      return response.json() as Promise<LegacyVisualCatalog>;
    })
    .then(validateLegacyVisualCatalog);
  return cached;
}
