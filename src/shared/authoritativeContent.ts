import { createContentManifest, type ContentManifest } from './contentVersion.ts';

export type AuthoritativeHeroId = 'gareth' | 'luxana';
export type AuthoritativeQRuntime = 'targeted-strike' | 'line-root';

export interface AuthoritativeQAbility {
  runtime: AuthoritativeQRuntime;
  range: number;
  damageBase: number;
  damageAdPermille: number;
  cooldownTicks: number;
  statusKind: 'slow' | 'root';
  statusTicks: number;
  statusMagnitudePermille: number;
  lineHalfWidth?: number;
}

export interface AuthoritativeHeroContent {
  id: AuthoritativeHeroId;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  attackCooldownTicks: number;
  moveSpeedPerTick: number;
  critChancePermille: number;
  q: AuthoritativeQAbility;
}

export interface AuthoritativeItemStats {
  attackDamage?: number;
  maxHp?: number;
  moveSpeedPerTick?: number;
}

export interface AuthoritativeItemContent {
  id: string;
  name: string;
  cost: number;
  stats: AuthoritativeItemStats;
}

export interface AuthoritativeRulesContent {
  tickRate: number;
  startingGold: number;
  maxInventorySlots: number;
  shopRadius: number;
  heroRespawnTicks: number;
  heroKillGold: number;
  heroKillXp: number;
}

export interface AuthoritativeContentPayload {
  schemaVersion: 1;
  rules: AuthoritativeRulesContent;
  heroes: AuthoritativeHeroContent[];
  items: AuthoritativeItemContent[];
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

export function validateAuthoritativeContent(payload: AuthoritativeContentPayload): void {
  if (payload.schemaVersion !== 1) throw new Error('Unsupported authoritative content schema.');
  assertInt('rules.tickRate', payload.rules.tickRate, 1, 120);
  assertInt('rules.startingGold', payload.rules.startingGold, 0, 100_000);
  assertInt('rules.maxInventorySlots', payload.rules.maxInventorySlots, 1, 12);
  assertInt('rules.shopRadius', payload.rules.shopRadius, 1, 10_000);
  assertInt('rules.heroRespawnTicks', payload.rules.heroRespawnTicks, 1, 100_000);
  assertInt('rules.heroKillGold', payload.rules.heroKillGold, 0, 100_000);
  assertInt('rules.heroKillXp', payload.rules.heroKillXp, 0, 100_000);

  assertUniqueIds('heroes', payload.heroes);
  assertUniqueIds('items', payload.items);

  const requiredHeroes = new Set<AuthoritativeHeroId>(['gareth', 'luxana']);
  for (const hero of payload.heroes) {
    requiredHeroes.delete(hero.id);
    assertInt(hero.id + '.maxHp', hero.maxHp, 1, 1_000_000);
    assertInt(hero.id + '.attackDamage', hero.attackDamage, 0, 100_000);
    assertInt(hero.id + '.attackRange', hero.attackRange, 1, 100_000);
    assertInt(hero.id + '.attackCooldownTicks', hero.attackCooldownTicks, 1, 10_000);
    assertInt(hero.id + '.moveSpeedPerTick', hero.moveSpeedPerTick, 1, 1_000);
    assertInt(hero.id + '.critChancePermille', hero.critChancePermille, 0, 1000);
    assertInt(hero.id + '.q.range', hero.q.range, 1, 100_000);
    assertInt(hero.id + '.q.damageBase', hero.q.damageBase, 0, 100_000);
    assertInt(hero.id + '.q.damageAdPermille', hero.q.damageAdPermille, 0, 10_000);
    assertInt(hero.id + '.q.cooldownTicks', hero.q.cooldownTicks, 1, 100_000);
    assertInt(hero.id + '.q.statusTicks', hero.q.statusTicks, 1, 100_000);
    assertInt(hero.id + '.q.statusMagnitudePermille', hero.q.statusMagnitudePermille, 0, 1000);
    if (hero.q.runtime === 'line-root') {
      assertInt(hero.id + '.q.lineHalfWidth', hero.q.lineHalfWidth ?? 0, 1, 10_000);
    }
  }
  if (requiredHeroes.size > 0) {
    throw new Error('Missing required authoritative heroes: ' + [...requiredHeroes].join(', '));
  }

  for (const item of payload.items) {
    assertInt(item.id + '.cost', item.cost, 0, 100_000);
    if (!item.name.trim()) throw new Error('Item ' + item.id + ' has no name.');
    if (item.stats.attackDamage !== undefined) {
      assertInt(item.id + '.attackDamage', item.stats.attackDamage, 0, 100_000);
    }
    if (item.stats.maxHp !== undefined) {
      assertInt(item.id + '.maxHp', item.stats.maxHp, 0, 1_000_000);
    }
    if (item.stats.moveSpeedPerTick !== undefined) {
      assertInt(item.id + '.moveSpeedPerTick', item.stats.moveSpeedPerTick, 0, 1_000);
    }
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function publishAuthoritativeContent(
  version: string,
  payload: AuthoritativeContentPayload,
): PublishedAuthoritativeContent {
  validateAuthoritativeContent(payload);
  const publishedPayload = deepFreeze(clone(payload));
  const manifest = deepFreeze(createContentManifest(version, publishedPayload));
  return deepFreeze({
    manifest,
    contentVersion: manifest.version + '+' + manifest.hash,
    payload: publishedPayload,
  });
}

export const CURRENT_AUTHORITATIVE_CONTENT = publishAuthoritativeContent('authority-0.7.0', {
  schemaVersion: 1,
  rules: {
    tickRate: 30,
    startingGold: 475,
    maxInventorySlots: 6,
    shopRadius: 190,
    heroRespawnTicks: 150,
    heroKillGold: 300,
    heroKillXp: 120,
  },
  heroes: [
    {
      id: 'gareth',
      maxHp: 650,
      attackDamage: 64,
      attackRange: 72,
      attackCooldownTicks: 24,
      moveSpeedPerTick: 4,
      critChancePermille: 100,
      q: {
        runtime: 'targeted-strike',
        range: 118,
        damageBase: 96,
        damageAdPermille: 500,
        cooldownTicks: 120,
        statusKind: 'slow',
        statusTicks: 45,
        statusMagnitudePermille: 250,
      },
    },
    {
      id: 'luxana',
      maxHp: 650,
      attackDamage: 64,
      attackRange: 72,
      attackCooldownTicks: 24,
      moveSpeedPerTick: 4,
      critChancePermille: 100,
      q: {
        runtime: 'line-root',
        range: 430,
        damageBase: 105,
        damageAdPermille: 0,
        cooldownTicks: 180,
        statusKind: 'root',
        statusTicks: 45,
        statusMagnitudePermille: 1000,
        lineHalfWidth: 34,
      },
    },
  ],
  items: [
    { id: 'longsword', name: 'Espada Longa', cost: 350, stats: { attackDamage: 10 } },
    { id: 'ruby', name: 'Cristal de Rubi', cost: 400, stats: { maxHp: 150 } },
    { id: 'boots', name: 'Botas de Velocidade', cost: 350, stats: { moveSpeedPerTick: 1 } },
    { id: 'pickaxe', name: 'Picareta', cost: 875, stats: { attackDamage: 25 } },
  ],
});

export function authoritativeHero(
  id: AuthoritativeHeroId,
  content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload,
): AuthoritativeHeroContent {
  const hero = content.heroes.find((entry) => entry.id === id);
  if (!hero) throw new Error('Published content is missing hero: ' + id);
  return hero;
}

export function authoritativeItem(
  id: string,
  content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload,
): AuthoritativeItemContent | null {
  return content.items.find((entry) => entry.id === id) ?? null;
}
