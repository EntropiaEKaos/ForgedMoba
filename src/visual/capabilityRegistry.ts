import type { CombatFxEvent } from './fxModel.ts';

export type VisualMaterialId =
  | 'steel'
  | 'radiant'
  | 'arcane'
  | 'void'
  | 'fire'
  | 'frost'
  | 'storm'
  | 'nature'
  | 'blood'
  | 'shadow'
  | 'neutral';

export interface VisualEffectProfile {
  id: VisualMaterialId;
  primary: number;
  secondary: number;
  glow: number;
  particleScale: number;
  trailWidth: number;
  bloom: number;
  shake: number;
}

export const VISUAL_MATERIALS: Record<VisualMaterialId, VisualEffectProfile> = {
  steel:   { id: 'steel', primary: 0xffd466, secondary: 0xe7f4ff, glow: 0xffe89a, particleScale: 1.05, trailWidth: 12, bloom: 0.75, shake: 1.05 },
  radiant: { id: 'radiant', primary: 0xffed9a, secondary: 0x78dfff, glow: 0xffffff, particleScale: 1.15, trailWidth: 18, bloom: 1.1, shake: 0.85 },
  arcane:  { id: 'arcane', primary: 0xae7cff, secondary: 0x6fdcff, glow: 0xdcc8ff, particleScale: 1.15, trailWidth: 15, bloom: 1.0, shake: 0.8 },
  void:    { id: 'void', primary: 0x8f55e8, secondary: 0xe15dff, glow: 0xc08cff, particleScale: 1.25, trailWidth: 20, bloom: 1.2, shake: 1.0 },
  fire:    { id: 'fire', primary: 0xff6b24, secondary: 0xffca55, glow: 0xff9a3c, particleScale: 1.3, trailWidth: 18, bloom: 1.15, shake: 1.15 },
  frost:   { id: 'frost', primary: 0x68d9ff, secondary: 0xd8f7ff, glow: 0xa7edff, particleScale: 1.05, trailWidth: 16, bloom: 0.9, shake: 0.72 },
  storm:   { id: 'storm', primary: 0x7d8dff, secondary: 0xf4f8ff, glow: 0xb9c6ff, particleScale: 1.2, trailWidth: 11, bloom: 1.25, shake: 1.25 },
  nature:  { id: 'nature', primary: 0x65d889, secondary: 0xd9f3a5, glow: 0x9affba, particleScale: 1.05, trailWidth: 13, bloom: 0.72, shake: 0.7 },
  blood:   { id: 'blood', primary: 0xe8485c, secondary: 0xff9a84, glow: 0xff6677, particleScale: 1.18, trailWidth: 15, bloom: 0.9, shake: 1.08 },
  shadow:  { id: 'shadow', primary: 0x7b6a9f, secondary: 0xc088e8, glow: 0x9a77c9, particleScale: 1.12, trailWidth: 17, bloom: 0.82, shake: 0.82 },
  neutral: { id: 'neutral', primary: 0xe8d7bb, secondary: 0xffffff, glow: 0xffefdb, particleScale: 1, trailWidth: 12, bloom: 0.65, shake: 0.8 },
};

const HERO_MATERIAL: Record<string, VisualMaterialId> = {
  gareth: 'steel',
  luxana: 'radiant',
  anya: 'fire',
  ashka: 'frost',
  jaina: 'frost',
  volcarn: 'fire',
  rizar: 'arcane',
  blitz: 'storm',
  darion: 'blood',
  morgause: 'shadow',
  timo: 'nature',
  warrik: 'blood',
};

const MATERIAL_KEYWORDS: Array<[VisualMaterialId, RegExp]> = [
  ['fire', /(fire|flame|magma|ember|burn|ignite|volcan)/i],
  ['frost', /(frost|ice|freeze|crystal|snow|blizzard)/i],
  ['storm', /(lightning|thunder|storm|static|electric|shock|smite)/i],
  ['radiant', /(light|prism|solar|radiant|holy|star|finalspark)/i],
  ['void', /(void|abyss|blackhole|rift)/i],
  ['blood', /(blood|bleed|hemorr|vamp|guillotine)/i],
  ['shadow', /(shadow|dark|soul|ghost|night|death)/i],
  ['nature', /(nature|vine|root|poison|toxic|spore|bark|thorn)/i],
  ['arcane', /(arcane|rune|spell|mana|comet|flux)/i],
];

export function materialForHero(heroId: string | null | undefined): VisualEffectProfile {
  return VISUAL_MATERIALS[heroId ? (HERO_MATERIAL[heroId] ?? 'neutral') : 'neutral'];
}

export function materialForAbilityKey(key: string | null | undefined, heroId?: string | null): VisualEffectProfile {
  if (key) {
    for (const [material, pattern] of MATERIAL_KEYWORDS) {
      if (pattern.test(key)) return VISUAL_MATERIALS[material];
    }
  }
  return materialForHero(heroId);
}

export function profileForEvent(event: CombatFxEvent): VisualEffectProfile {
  if (event.type === 'q-cast' || event.type === 'ability-cast') return materialForHero(event.heroId);
  if (event.type === 'status-impact') {
    if (event.status === 'root') return VISUAL_MATERIALS.arcane;
    if (event.status === 'stun') return VISUAL_MATERIALS.storm;
    return VISUAL_MATERIALS.frost;
  }
  if (event.type === 'heal') return VISUAL_MATERIALS.nature;
  if (event.type === 'level-up') return VISUAL_MATERIALS.radiant;
  if (event.type === 'ward-spawn') return VISUAL_MATERIALS.radiant;
  if (event.type === 'item-equip') return VISUAL_MATERIALS.steel;
  if (event.type === 'objective') return VISUAL_MATERIALS.void;
  if (event.type === 'death') return event.kind === 'objective' ? VISUAL_MATERIALS.void : VISUAL_MATERIALS.blood;
  if (event.type === 'basic-attack') return materialForHero(event.heroId);
  return VISUAL_MATERIALS.neutral;
}
