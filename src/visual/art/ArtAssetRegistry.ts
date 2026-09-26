import {
  Assets,
  Rectangle,
  Texture,
} from 'pixi.js';
import {
  validateArtManifest,
  type ArtManifest,
  type HeroArtAnimation,
  type HeroAtlasDefinition,
} from './types.ts';

interface LoadedHeroAtlas {
  definition: HeroAtlasDefinition;
  frames: Texture[];
}

export class ArtAssetRegistry {
  private manifest: ArtManifest | null = null;
  private terrainTexture: Texture | null = null;
  private readonly heroes = new Map<string, LoadedHeroAtlas>();
  private ready = false;
  private failure: string | null = null;

  async init(manifestUrl = '/assets/art/v2/manifest.json'): Promise<void> {
    try {
      const response = await fetch(manifestUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error('manifest HTTP ' + response.status);
      const manifest = validateArtManifest(await response.json());
      this.manifest = manifest;

      this.terrainTexture = await Assets.load<Texture>(manifest.terrain.map);

      for (const definition of manifest.heroes) {
        const source = await Assets.load<Texture>(definition.source);
        const maxFrame = Math.max(
          ...Object.values(definition.animations).flatMap((animation) => animation.frames),
        );
        const frames: Texture[] = [];
        for (let index = 0; index <= maxFrame; index += 1) {
          frames[index] = new Texture({
            source: source.source,
            frame: new Rectangle(
              index * definition.frameWidth,
              0,
              definition.frameWidth,
              definition.frameHeight,
            ),
          });
        }
        this.heroes.set(definition.heroId, { definition, frames });
      }

      this.ready = true;
      this.failure = null;
    } catch (error) {
      this.ready = false;
      this.failure = error instanceof Error ? error.message : 'unknown art pipeline error';
      console.warn('[art-pipeline] fallback active:', this.failure);
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  get error(): string | null {
    return this.failure;
  }

  get version(): string | null {
    return this.manifest?.id ?? null;
  }

  get terrain(): Texture | null {
    return this.terrainTexture;
  }

  heroDefinition(heroId: string | null): HeroAtlasDefinition | null {
    if (!heroId) return null;
    return this.heroes.get(heroId)?.definition ?? null;
  }

  heroTexture(
    heroId: string | null,
    animation: HeroArtAnimation,
    elapsedMs: number,
  ): Texture | null {
    if (!heroId) return null;
    const atlas = this.heroes.get(heroId);
    if (!atlas) return null;

    const def = atlas.definition.animations[animation];
    const frameDuration = 1000 / Math.max(1, def.fps);
    const rawIndex = Math.max(0, Math.floor(elapsedMs / frameDuration));
    const animationIndex = def.loop
      ? rawIndex % def.frames.length
      : Math.min(def.frames.length - 1, rawIndex);
    return atlas.frames[def.frames[animationIndex]] ?? null;
  }
}
