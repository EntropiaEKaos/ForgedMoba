export type HeroArtAnimation = 'idle' | 'run' | 'attack' | 'cast';

export interface HeroAtlasDefinition {
  heroId: string;
  source: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<HeroArtAnimation, {
    frames: number[];
    fps: number;
    loop: boolean;
  }>;
  anchor: { x: number; y: number };
  scale: number;
  shadowScale: number;
}

export interface TerrainArtDefinition {
  map: string;
  nativeWidth: number;
  nativeHeight: number;
}

export interface ArtManifest {
  version: 2;
  id: string;
  terrain: TerrainArtDefinition;
  heroes: HeroAtlasDefinition[];
}

export function validateArtManifest(value: unknown): ArtManifest {
  if (!value || typeof value !== 'object') throw new Error('art manifest must be an object');
  const manifest = value as Partial<ArtManifest>;
  if (manifest.version !== 2) throw new Error('art manifest version must be 2');
  if (typeof manifest.id !== 'string' || manifest.id.length < 1) throw new Error('art manifest id required');
  if (!manifest.terrain || typeof manifest.terrain.map !== 'string') throw new Error('terrain map required');
  if (!Number.isFinite(manifest.terrain.nativeWidth) || manifest.terrain.nativeWidth <= 0) throw new Error('terrain width invalid');
  if (!Number.isFinite(manifest.terrain.nativeHeight) || manifest.terrain.nativeHeight <= 0) throw new Error('terrain height invalid');
  if (!Array.isArray(manifest.heroes) || manifest.heroes.length < 1) throw new Error('at least one hero atlas required');

  const ids = new Set<string>();
  for (const hero of manifest.heroes) {
    if (!hero || typeof hero.heroId !== 'string' || !hero.heroId) throw new Error('heroId required');
    if (ids.has(hero.heroId)) throw new Error('duplicate hero atlas: ' + hero.heroId);
    ids.add(hero.heroId);
    if (typeof hero.source !== 'string' || !hero.source) throw new Error(hero.heroId + ': source required');
    if (!Number.isFinite(hero.frameWidth) || hero.frameWidth <= 0) throw new Error(hero.heroId + ': frameWidth invalid');
    if (!Number.isFinite(hero.frameHeight) || hero.frameHeight <= 0) throw new Error(hero.heroId + ': frameHeight invalid');
    if (!hero.anchor || hero.anchor.x < 0 || hero.anchor.x > 1 || hero.anchor.y < 0 || hero.anchor.y > 1) {
      throw new Error(hero.heroId + ': anchor invalid');
    }
    for (const animation of ['idle', 'run', 'attack', 'cast'] as const) {
      const def = hero.animations?.[animation];
      if (!def || !Array.isArray(def.frames) || def.frames.length < 1) {
        throw new Error(hero.heroId + ': missing animation ' + animation);
      }
      if (!Number.isFinite(def.fps) || def.fps <= 0 || def.fps > 60) throw new Error(hero.heroId + ': invalid fps');
      for (const frame of def.frames) {
        if (!Number.isInteger(frame) || frame < 0) throw new Error(hero.heroId + ': invalid frame');
      }
    }
  }
  return manifest as ArtManifest;
}
