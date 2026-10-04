import type { VisualEffectProfile } from './capabilityRegistry.ts';

export interface SkinVisualMods {
  trailColor?: number;
  auraColor?: number;
  particleColor?: number;
  glowColor?: number;
}

export interface SkinVisualSelection {
  skinId: string;
  heroId: string;
  rarity: 'comum' | 'rara' | 'épica' | 'lendária';
  mods: SkinVisualMods;
}

export interface ResolvedSkinVisual {
  primary: number;
  secondary: number;
  glow: number;
  trail: number;
  particle: number;
  aura: number;
  intensity: number;
}

export function resolveSkinVisual(
  base: VisualEffectProfile,
  skin: SkinVisualSelection | null | undefined,
): ResolvedSkinVisual {
  const rarityBoost =
    skin?.rarity === 'lendária' ? 1.35 :
    skin?.rarity === 'épica' ? 1.2 :
    skin?.rarity === 'rara' ? 1.08 :
    1;

  return {
    primary: skin?.mods.particleColor ?? base.primary,
    secondary: skin?.mods.trailColor ?? base.secondary,
    glow: skin?.mods.glowColor ?? base.glow,
    trail: skin?.mods.trailColor ?? base.secondary,
    particle: skin?.mods.particleColor ?? base.primary,
    aura: skin?.mods.auraColor ?? base.glow,
    intensity: rarityBoost,
  };
}
