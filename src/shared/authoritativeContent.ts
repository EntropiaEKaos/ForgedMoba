import { HEROES, type AbilityDef, type AbilitySlot, type HeroDef } from '../game/heroes.ts';
import { ITEMS, type ItemDef } from '../game/items.ts';
import { createContentManifest, type ContentManifest } from './contentVersion.ts';

export type AuthoritativeHeroId = string;
export type AuthoritativeAbilityRuntime = 'self' | 'target' | 'line' | 'cone' | 'area' | 'dash';
export type AuthoritativeDamageType = 'physical' | 'magic' | 'true';
export type AuthoritativeVisualTag = 'blade' | 'fire' | 'frost' | 'arcane' | 'nature' | 'shadow' | 'light' | 'tech';

export interface AuthoritativeAbilityContent {
  slot: AbilitySlot;
  key: string;
  name: string;
  description: string;
  runtime: AuthoritativeAbilityRuntime;
  damageType: AuthoritativeDamageType;
  visualTag: AuthoritativeVisualTag;
  range: number;
  radius: number;
  lineHalfWidth: number;
  cooldownTicks: number;
  manaCost: number;
  damageBase: number;
  damagePerLevel: number;
  damageAdPermille: number;
  damageApPermille: number;
  healBase: number;
  shieldBase: number;
  hastePermille: number;
  damageReductionPermille: number;
  statusKind: 'stun' | 'root' | 'slow' | 'silence' | null;
  statusTicks: number;
  statusMagnitudePermille: number;
  affectsAllies: boolean;
  pierces: boolean;
  moveDistance: number;
}

export type AuthoritativeQAbility = AuthoritativeAbilityContent;

export interface AuthoritativeHeroContent {
  id: AuthoritativeHeroId;
  name: string;
  title: string;
  role: string;
  passive: { name: string; description: string; key: string };
  maxHp: number;
  maxMana: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackRange: number;
  attackCooldownTicks: number;
  moveSpeedPerTick: number;
  critChancePermille: number;
  hpRegenPerSecond: number;
  manaRegenPerSecond: number;
  lifestealPermille: number;
  visual: { primary: string; secondary: string; accent: string; weapon: string };
  abilities: Record<AbilitySlot, AuthoritativeAbilityContent>;
  q: AuthoritativeQAbility;
}

export interface AuthoritativeItemStats {
  attackDamage?: number;
  abilityPower?: number;
  maxHp?: number;
  maxMana?: number;
  armor?: number;
  magicResist?: number;
  attackSpeedPermille?: number;
  moveSpeedPerTick?: number;
  critChancePermille?: number;
  lifestealPermille?: number;
  hpRegenPerSecond?: number;
  manaRegenPerSecond?: number;
  magicPenPermille?: number;
}

export interface AuthoritativeItemContent {
  id: string;
  name: string;
  cost: number;
  tier: 1 | 2 | 3;
  recipe: string[];
  passive: string | null;
  passiveKey: string | null;
  stats: AuthoritativeItemStats;
}

export interface AuthoritativeNeutralContent {
  id: string;
  kind: 'camp' | 'objective';
  xPermille: number;
  yPermille: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  attackCooldownTicks: number;
  moveSpeedPerTick: number;
  aggroRange: number;
  leashRadius: number;
  bountyGold: number;
  xpBounty: number;
  respawnTicks: number;
  teamGold: number;
}

export interface AuthoritativeRulesContent {
  tickRate: number;
  startingGold: number;
  maxInventorySlots: number;
  shopRadius: number;
  heroRespawnTicks: number;
  heroKillGold: number;
  heroKillXp: number;
  wardPlacementRange: number;
  wardDurationTicks: number;
  wardCooldownTicks: number;
  wardVisionRadius: number;
  heroVisionRadius: number;
  maxWardsPerTeam: number;
}

export interface AuthoritativeContentPayload {
  schemaVersion: 2;
  rules: AuthoritativeRulesContent;
  heroes: AuthoritativeHeroContent[];
  items: AuthoritativeItemContent[];
  neutralUnits: AuthoritativeNeutralContent[];
}

export interface PublishedAuthoritativeContent {
  manifest: ContentManifest;
  contentVersion: string;
  payload: AuthoritativeContentPayload;
}

function assertInt(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(name + ' must be an integer between ' + min + ' and ' + max + '.');
  }
}

function assertUniqueIds<T extends { id: string }>(name: string, values: readonly T[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.id.trim()) throw new Error(name + ' contains an empty ID.');
    if (seen.has(value.id)) throw new Error(name + ' contains duplicate ID: ' + value.id);
    seen.add(value.id);
  }
}

function contains(text: string, ...needles: string[]): boolean {
  const normalized = text.toLocaleLowerCase('pt-BR');
  return needles.some((needle) => normalized.includes(needle));
}

function abilityRuntime(ability: AbilityDef): AuthoritativeAbilityRuntime {
  const text = ability.key + ' ' + ability.desc;
  if (contains(text, 'teleporta', 'avança', 'salta', 'mergulha', 'dash', 'investida')) return 'dash';
  if (contains(text, 'projétil', 'dispara', 'flecha', 'feixe', 'raio', 'lança um', 'lança uma', 'linha', 'perfura', 'dardo', 'foguete')) return 'line';
  if (contains(text, 'cone', 'leque', 'rajada')) return 'cone';
  if (contains(text, 'no chão', 'no solo', 'zona', 'área', 'redemoinho', 'chuva', 'nuvem', 'armadilha', 'explod')) return 'area';
  if (ability.range <= 0 || contains(text, 'ao redor', 'em volta', 'transforma-se', 'canaliza', 'canta')) return 'self';
  return 'target';
}

function abilityVisualTag(ability: AbilityDef): AuthoritativeVisualTag {
  const text = ability.key + ' ' + ability.name + ' ' + ability.desc;
  if (contains(text, 'fogo', 'flame', 'fire', 'infer', 'solar', 'vulc')) return 'fire';
  if (contains(text, 'gelo', 'frost', 'ice', 'neve', 'cristal')) return 'frost';
  if (contains(text, 'sombra', 'shadow', 'void', 'abiss', 'morte', 'dark')) return 'shadow';
  if (contains(text, 'luz', 'light', 'prism', 'estrela', 'cura', 'holy')) return 'light';
  if (contains(text, 'planta', 'floresta', 'nature', 'espinho', 'raiz', 'esporo', 'água', 'maré')) return 'nature';
  if (contains(text, 'mecha', 'tech', 'torreta', 'sucata', 'rocket', 'elétr', 'choque')) return 'tech';
  if (contains(text, 'espada', 'lâmina', 'golpe', 'punho', 'garra', 'machado', 'blade', 'corte')) return 'blade';
  return 'arcane';
}

function statusFor(ability: AbilityDef): Pick<AuthoritativeAbilityContent, 'statusKind' | 'statusTicks' | 'statusMagnitudePermille'> {
  const text = ability.key + ' ' + ability.desc;
  const seconds = ability.key.toLowerCase().includes('ult') || ability.cd >= 60 ? 2 : 1;
  if (contains(text, 'atordoa', 'atordo', 'stun', 'congela', 'suprime', 'nocaute')) {
    return { statusKind: 'stun', statusTicks: seconds * 30, statusMagnitudePermille: 1000 };
  }
  if (contains(text, 'prende', 'enraíza', 'imobiliza', 'prisão', 'root')) {
    return { statusKind: 'root', statusTicks: seconds * 30, statusMagnitudePermille: 1000 };
  }
  if (contains(text, 'silencia', 'silêncio', 'silence')) {
    return { statusKind: 'silence', statusTicks: seconds * 30, statusMagnitudePermille: 1000 };
  }
  if (contains(text, 'lentidão', 'desacelera', 'reduz a velocidade', 'slow')) {
    return { statusKind: 'slow', statusTicks: seconds * 45, statusMagnitudePermille: 300 };
  }
  return { statusKind: null, statusTicks: 0, statusMagnitudePermille: 0 };
}

function compileAbility(hero: HeroDef, slot: AbilitySlot, ability: AbilityDef): AuthoritativeAbilityContent {
  const runtime = abilityRuntime(ability);
  const text = ability.name + ' ' + ability.desc;
  const supportEffect = contains(text, 'cura', 'regenera', 'escudo', 'reduz dano', 'armadura', 'imune', 'velocidade de aliados');
  const explicitlyDamaging = contains(text, 'dano', 'fere', 'atinge', 'golpe', 'corta', 'explode', 'queima', 'ataca', 'devasta', 'perfura', 'morde');
  const baseBySlot = { Q: 55, W: 70, E: 85, R: 180 } as const;
  const ratio = hero.role.toLowerCase().includes('mag') || hero.role.toLowerCase().includes('suporte')
    ? { ad: 150, ap: 650 }
    : { ad: 650, ap: 150 };
  const status = statusFor(ability);
  const tag = abilityVisualTag(ability);
  const range = ability.range > 0 ? ability.range * 2 : runtime === 'self' ? 0 : 320;
  const radius = runtime === 'self' || runtime === 'area' || runtime === 'cone' ? (slot === 'R' ? 190 : 115) : 40;
  const healing = contains(text, 'cura', 'regenera', 'restaura vida');
  const shielding = contains(text, 'escudo', 'reduz dano', 'armadura', 'imune', 'fortaleza', 'bastião');
  const haste = contains(text, 'velocidade', 'acelera', 'rápido', 'haste', 'fúria');
  const content: AuthoritativeAbilityContent = {
    slot,
    key: ability.key,
    name: ability.name,
    description: ability.desc,
    runtime,
    damageType: hero.role.toLowerCase().includes('mag') || tag !== 'blade' ? 'magic' : 'physical',
    visualTag: tag,
    range,
    radius,
    lineHalfWidth: slot === 'R' ? 44 : 26,
    cooldownTicks: Math.max(1, Math.round(ability.cd * 30)),
    manaCost: Math.max(0, Math.round(ability.mana)),
    damageBase: ability.dmgBase ?? (explicitlyDamaging || !supportEffect ? baseBySlot[slot] : 0),
    damagePerLevel: ability.dmgPerLevel ?? (slot === 'R' ? 14 : 7),
    damageAdPermille: Math.round((ability.ratioAd ?? ratio.ad / 1000) * 1000),
    damageApPermille: Math.round((ability.ratioAp ?? ratio.ap / 1000) * 1000),
    healBase: healing ? (slot === 'R' ? 220 : 70) : 0,
    shieldBase: shielding ? (slot === 'R' ? 240 : 80) : 0,
    hastePermille: haste ? (slot === 'R' ? 400 : 250) : 0,
    damageReductionPermille: shielding ? (slot === 'R' ? 500 : 250) : 0,
    ...status,
    affectsAllies: supportEffect && !explicitlyDamaging,
    pierces: contains(text, 'perfura', 'todos no caminho', 'feixe', 'laser', 'onda gigante'),
    moveDistance: runtime === 'dash' ? Math.max(160, range) : 0,
  };

  if (hero.id === 'gareth' && slot === 'Q') Object.assign(content, {
    runtime: 'target' as const, range: 118, damageType: 'physical' as const, damageBase: 96,
    damagePerLevel: 0, damageAdPermille: 500, damageApPermille: 0, cooldownTicks: 120,
    statusKind: 'slow' as const, statusTicks: 45, statusMagnitudePermille: 250,
  });
  if (hero.id === 'luxana' && slot === 'Q') Object.assign(content, {
    runtime: 'line' as const, range: 430, lineHalfWidth: 34, damageType: 'magic' as const,
    damageBase: 105, damagePerLevel: 0, damageAdPermille: 0, damageApPermille: 600,
    cooldownTicks: 180, statusKind: 'root' as const, statusTicks: 45,
    statusMagnitudePermille: 1000, pierces: false,
  });
  return content;
}

function compileHero(hero: HeroDef): AuthoritativeHeroContent {
  const abilities = Object.fromEntries(
    (['Q', 'W', 'E', 'R'] as const).map((slot) => [slot, compileAbility(hero, slot, hero.abilities[slot])]),
  ) as Record<AbilitySlot, AuthoritativeAbilityContent>;
  return {
    id: hero.id,
    name: hero.name,
    title: hero.title,
    role: hero.role,
    passive: { name: hero.passive.name, description: hero.passive.desc, key: hero.passive.key },
    maxHp: Math.round(hero.hp),
    maxMana: Math.round(hero.mp),
    attackDamage: Math.round(hero.ad),
    abilityPower: 0,
    armor: Math.round(hero.armor),
    magicResist: Math.round(hero.mr),
    attackRange: Math.max(55, Math.round(hero.atkRange * 1.3)),
    attackCooldownTicks: Math.max(8, Math.round(16 / Math.max(0.1, hero.as))),
    moveSpeedPerTick: Math.max(2, Math.round(hero.ms / 27)),
    critChancePermille: 50,
    hpRegenPerSecond: Math.max(0, Math.round(hero.hpRegen)),
    manaRegenPerSecond: Math.max(0, Math.round(hero.mpRegen)),
    lifestealPermille: contains(hero.passive.desc, 'roubo de vida', 'dano cura', 'curam metade') ? 120 : 0,
    visual: { primary: hero.look.armor, secondary: hero.look.skin, accent: hero.look.trim, weapon: hero.look.weapon },
    abilities,
    q: abilities.Q,
  };
}

function compileItem(item: ItemDef): AuthoritativeItemContent {
  return {
    id: item.id,
    name: item.name,
    cost: Math.round(item.totalCost),
    tier: item.tier,
    recipe: [...item.recipe],
    passive: item.passive ?? null,
    passiveKey: item.passiveKey ?? null,
    stats: {
      ...(item.stats.ad === undefined ? {} : { attackDamage: Math.round(item.stats.ad) }),
      ...(item.stats.ap === undefined ? {} : { abilityPower: Math.round(item.stats.ap) }),
      ...(item.stats.hp === undefined ? {} : { maxHp: Math.round(item.stats.hp) }),
      ...(item.stats.mp === undefined ? {} : { maxMana: Math.round(item.stats.mp) }),
      ...(item.stats.armor === undefined ? {} : { armor: Math.round(item.stats.armor) }),
      ...(item.stats.mr === undefined ? {} : { magicResist: Math.round(item.stats.mr) }),
      ...(item.stats.as === undefined ? {} : { attackSpeedPermille: Math.round(item.stats.as * 1000) }),
      ...(item.stats.ms === undefined ? {} : { moveSpeedPerTick: Math.max(1, Math.round(item.stats.ms / 25)) }),
      ...(item.stats.crit === undefined ? {} : { critChancePermille: Math.round(item.stats.crit * 10) }),
      ...(item.stats.lifesteal === undefined ? {} : { lifestealPermille: Math.round(item.stats.lifesteal * 1000) }),
      ...(item.stats.hpRegen === undefined ? {} : { hpRegenPerSecond: Math.round(item.stats.hpRegen) }),
      ...(item.stats.mpRegen === undefined ? {} : { manaRegenPerSecond: Math.round(item.stats.mpRegen) }),
      ...(item.stats.mpen === undefined ? {} : { magicPenPermille: Math.round(item.stats.mpen * 1000) }),
    },
  };
}

export function validateAuthoritativeContent(payload: AuthoritativeContentPayload): void {
  if (payload.schemaVersion !== 2) throw new Error('Unsupported authoritative content schema.');
  assertInt('rules.tickRate', payload.rules.tickRate, 1, 120);
  assertInt('rules.startingGold', payload.rules.startingGold, 0, 100_000);
  assertInt('rules.maxInventorySlots', payload.rules.maxInventorySlots, 1, 12);
  assertInt('rules.shopRadius', payload.rules.shopRadius, 1, 10_000);
  assertInt('rules.heroRespawnTicks', payload.rules.heroRespawnTicks, 1, 100_000);
  assertInt('rules.heroKillGold', payload.rules.heroKillGold, 0, 100_000);
  assertInt('rules.heroKillXp', payload.rules.heroKillXp, 0, 100_000);
  assertInt('rules.wardPlacementRange', payload.rules.wardPlacementRange, 1, 100_000);
  assertInt('rules.wardDurationTicks', payload.rules.wardDurationTicks, 1, 1_000_000);
  assertInt('rules.wardCooldownTicks', payload.rules.wardCooldownTicks, 1, 1_000_000);
  assertInt('rules.wardVisionRadius', payload.rules.wardVisionRadius, 1, 100_000);
  assertInt('rules.heroVisionRadius', payload.rules.heroVisionRadius, 1, 100_000);
  assertInt('rules.maxWardsPerTeam', payload.rules.maxWardsPerTeam, 1, 20);
  assertUniqueIds('heroes', payload.heroes);
  assertUniqueIds('items', payload.items);
  assertUniqueIds('neutralUnits', payload.neutralUnits);
  if (payload.heroes.length < 2) throw new Error('At least two authoritative heroes are required.');

  for (const hero of payload.heroes) {
    assertInt(hero.id + '.maxHp', hero.maxHp, 1, 1_000_000);
    assertInt(hero.id + '.maxMana', hero.maxMana, 0, 1_000_000);
    assertInt(hero.id + '.attackDamage', hero.attackDamage, 0, 100_000);
    assertInt(hero.id + '.attackRange', hero.attackRange, 1, 100_000);
    assertInt(hero.id + '.attackCooldownTicks', hero.attackCooldownTicks, 1, 10_000);
    assertInt(hero.id + '.moveSpeedPerTick', hero.moveSpeedPerTick, 1, 1_000);
    for (const slot of ['Q', 'W', 'E', 'R'] as const) {
      const ability = slot === 'Q' ? hero.q : hero.abilities[slot];
      if (!ability || ability.slot !== slot) throw new Error(hero.id + ' is missing authoritative ' + slot + '.');
      assertInt(hero.id + '.' + slot + '.cooldownTicks', ability.cooldownTicks, 1, 1_000_000);
      assertInt(hero.id + '.' + slot + '.range', ability.range, 0, 100_000);
      assertInt(hero.id + '.' + slot + '.radius', ability.radius, 1, 10_000);
    }
  }

  const itemIds = new Set(payload.items.map((item) => item.id));
  for (const item of payload.items) {
    assertInt(item.id + '.cost', item.cost, 0, 100_000);
    if (!item.name.trim()) throw new Error('Item ' + item.id + ' has no name.');
    for (const component of item.recipe) {
      if (!itemIds.has(component)) throw new Error(item.id + ' has unknown recipe component: ' + component);
    }
  }
}

function clone<T>(value: T): T { return structuredClone(value); }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function publishAuthoritativeContent(version: string, payload: AuthoritativeContentPayload): PublishedAuthoritativeContent {
  validateAuthoritativeContent(payload);
  const publishedPayload = deepFreeze(clone(payload));
  const manifest = deepFreeze(createContentManifest(version, publishedPayload));
  return deepFreeze({ manifest, contentVersion: manifest.version + '+' + manifest.hash, payload: publishedPayload });
}

const LEGACY_MIGRATED_PAYLOAD: AuthoritativeContentPayload = {
  schemaVersion: 2,
  rules: {
    tickRate: 30, startingGold: 475, maxInventorySlots: 6, shopRadius: 190,
    heroRespawnTicks: 150, heroKillGold: 300, heroKillXp: 120,
    wardPlacementRange: 600, wardDurationTicks: 2700, wardCooldownTicks: 900,
    wardVisionRadius: 500, heroVisionRadius: 520, maxWardsPerTeam: 4,
  },
  heroes: HEROES.map(compileHero),
  items: ITEMS.map(compileItem),
  neutralUnits: [
    { id: 'blue-camp', kind: 'camp', xPermille: 350, yPermille: 270, maxHp: 780, attackDamage: 38, attackRange: 62, attackCooldownTicks: 30, moveSpeedPerTick: 2, aggroRange: 260, leashRadius: 360, bountyGold: 95, xpBounty: 110, respawnTicks: 900, teamGold: 0 },
    { id: 'red-camp', kind: 'camp', xPermille: 650, yPermille: 730, maxHp: 780, attackDamage: 38, attackRange: 62, attackCooldownTicks: 30, moveSpeedPerTick: 2, aggroRange: 260, leashRadius: 360, bountyGold: 95, xpBounty: 110, respawnTicks: 900, teamGold: 0 },
    { id: 'rift-sentinel', kind: 'objective', xPermille: 500, yPermille: 180, maxHp: 2400, attackDamage: 72, attackRange: 78, attackCooldownTicks: 28, moveSpeedPerTick: 1, aggroRange: 320, leashRadius: 420, bountyGold: 180, xpBounty: 220, respawnTicks: 1800, teamGold: 125 },
  ],
};

export const CURRENT_AUTHORITATIVE_CONTENT = publishAuthoritativeContent('authority-1.0.0', LEGACY_MIGRATED_PAYLOAD);

export function authoritativeHero(id: AuthoritativeHeroId, content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload): AuthoritativeHeroContent {
  const hero = content.heroes.find((entry) => entry.id === id);
  if (!hero) throw new Error('Published content is missing hero: ' + id);
  return hero;
}

export function authoritativeAbility(heroId: AuthoritativeHeroId, slot: AbilitySlot, content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload): AuthoritativeAbilityContent {
  const hero = authoritativeHero(heroId, content);
  return slot === 'Q' ? hero.q : hero.abilities[slot];
}

export function authoritativeItem(id: string, content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload): AuthoritativeItemContent | null {
  return content.items.find((entry) => entry.id === id) ?? null;
}
