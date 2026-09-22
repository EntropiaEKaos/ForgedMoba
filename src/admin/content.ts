import { HEROES, HERO_BY_ID, type HeroDef } from '../game/heroes';
import { ITEMS, ITEM_BY_ID, type ItemDef } from '../game/items';
import type { GameModeDef, MapPresetDef } from './types';

export interface AdminRecord<T> {
  data: T;
  custom: boolean;
}

export interface AdminContent {
  version: 1;
  heroes: AdminRecord<HeroDef>[];
  items: AdminRecord<ItemDef>[];
  modes: GameModeDef[];
  maps: MapPresetDef[];
  activeModeId: string;
}

const KEY = 'pixelrift_admin_content_v1';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const BASE_HEROES = clone(HEROES);
const BASE_ITEMS = clone(ITEMS);

export const DEFAULT_MAPS: MapPresetDef[] = [
  { id: 'rift', name: 'Rift Clássico', description: 'Floresta viva, rio central e três rotas.', theme: 'forest', ambientColor: '#5b8d55', fogOpacity: 0.68, riverColor: '#5a9cc5', laneColor: '#9c835c', forestColor: '#345a38' },
  { id: 'frost-rift', name: 'Rift Glacial', description: 'Variante fria do Rift com iluminação azul.', theme: 'frost', ambientColor: '#8db8d0', fogOpacity: 0.62, riverColor: '#9ad8ee', laneColor: '#aeb9bd', forestColor: '#496f78' },
  { id: 'ember-rift', name: 'Rift de Brasas', description: 'Variante vulcânica, quente e de alto contraste.', theme: 'volcanic', ambientColor: '#b35f39', fogOpacity: 0.72, riverColor: '#6d3f38', laneColor: '#a16f4f', forestColor: '#4e332b' },
];

export const DEFAULT_MODES: GameModeDef[] = [
  { id: 'classic', name: 'Conquista 5v5', description: 'Regras tradicionais: três rotas e objetivo de destruir o Nexus.', mapId: 'rift', teamSize: 5, startingGold: 475, waveInterval: 30, maxLevel: 18, passiveGoldRate: 2.4, respawnScale: 1 },
  { id: 'blitz', name: 'Rift Blitz 3v3', description: 'Times menores, mais ouro e ondas rápidas.', mapId: 'rift', teamSize: 3, startingGold: 1000, waveInterval: 17, maxLevel: 15, passiveGoldRate: 4, respawnScale: 0.65 },
  { id: 'frost-clash', name: 'Confronto Glacial', description: 'Partida acelerada na variante glacial.', mapId: 'frost-rift', teamSize: 5, startingGold: 800, waveInterval: 22, maxLevel: 18, passiveGoldRate: 3.2, respawnScale: 0.8 },
];

export function defaultAdminContent(): AdminContent {
  return { version: 1, heroes: [], items: [], modes: clone(DEFAULT_MODES), maps: clone(DEFAULT_MAPS), activeModeId: 'classic' };
}

export function loadAdminContent(): AdminContent {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultAdminContent(), ...JSON.parse(raw) };
  } catch { /* storage indisponível */ }
  return defaultAdminContent();
}

export function saveAdminContent(content: AdminContent) {
  localStorage.setItem(KEY, JSON.stringify(content));
  applyAdminContent(content);
}

export function applyAdminContent(content: AdminContent) {
  HEROES.splice(0, HEROES.length, ...clone(BASE_HEROES));
  ITEMS.splice(0, ITEMS.length, ...clone(BASE_ITEMS));

  for (const record of content.heroes) {
    const index = HEROES.findIndex(hero => hero.id === record.data.id);
    if (index >= 0) HEROES[index] = clone(record.data);
    else HEROES.push(clone(record.data));
  }
  for (const key of Object.keys(HERO_BY_ID)) delete HERO_BY_ID[key];
  for (const hero of HEROES) HERO_BY_ID[hero.id] = hero;

  for (const record of content.items) {
    const index = ITEMS.findIndex(item => item.id === record.data.id);
    if (index >= 0) ITEMS[index] = clone(record.data);
    else ITEMS.push(clone(record.data));
  }
  for (const key of Object.keys(ITEM_BY_ID)) delete ITEM_BY_ID[key];
  for (const item of ITEMS) ITEM_BY_ID[item.id] = item;
}

export function initializeAdminContent() {
  const content = loadAdminContent();
  applyAdminContent(content);
  return content;
}

export function resetAdminContent() {
  localStorage.removeItem(KEY);
  const content = defaultAdminContent();
  applyAdminContent(content);
  return content;
}

export function getActiveRules(content = loadAdminContent()) {
  const mode = content.modes.find(entry => entry.id === content.activeModeId) ?? content.modes[0] ?? DEFAULT_MODES[0];
  const map = content.maps.find(entry => entry.id === mode.mapId) ?? content.maps[0] ?? DEFAULT_MAPS[0];
  return { mode, map };
}

export function createHeroTemplate(): HeroDef {
  const id = `hero-${Date.now()}`;
  return {
    id, name: 'Novo Herói', title: 'O Protótipo', role: 'Lutador', ranged: false, atkRange: 60,
    hp: 600, hpG: 90, mp: 280, mpG: 40, ad: 62, adG: 3.5, armor: 32, armorG: 3.5, mr: 30, mrG: 1,
    as: 0.65, asG: 0.02, ms: 105, hpRegen: 7, mpRegen: 7,
    passive: { name: 'Passiva Nova', desc: 'Descreva o comportamento passivo.', key: `${id}-passive` },
    abilities: {
      Q: { name: 'Habilidade Q', desc: 'Descreva a habilidade.', cd: 8, mana: 50, range: 220, key: `${id}-q`, dmgBase: 60, dmgPerLevel: 15, ratioAd: 0.4, ratioAp: 0.5, ratioArmor: 0, ratioMr: 0, ratioHp: 0 },
      W: { name: 'Habilidade W', desc: 'Descreva a habilidade.', cd: 12, mana: 60, range: 0, key: `${id}-w`, dmgBase: 50, dmgPerLevel: 10, ratioAd: 0.3, ratioAp: 0.4, ratioArmor: 0, ratioMr: 0, ratioHp: 0 },
      E: { name: 'Habilidade E', desc: 'Descreva a habilidade.', cd: 14, mana: 60, range: 200, key: `${id}-e`, dmgBase: 55, dmgPerLevel: 12, ratioAd: 0.3, ratioAp: 0.4, ratioArmor: 0, ratioMr: 0, ratioHp: 0 },
      R: { name: 'Ultimate', desc: 'Descreva a habilidade máxima.', cd: 100, mana: 100, range: 260, key: `${id}-r`, dmgBase: 120, dmgPerLevel: 60, ratioAd: 0.8, ratioAp: 0.9, ratioArmor: 0, ratioMr: 0, ratioHp: 0 },
    },
    look: { skin: '#ddb28b', hair: '#49372c', armor: '#4676a8', trim: '#e5c45d', legs: '#263b5a', weapon: 'sword', weaponColor: '#dce8ef', hairStyle: 'short' },
  };
}

export function createItemTemplate(): ItemDef {
  return {
    id: `item-${Date.now()}`, name: 'Novo Item', totalCost: 1000, recipe: [], tier: 2,
    stats: { ad: 15, hp: 100 }, passive: 'Descreva a passiva.', passiveKey: '',
    icon: { bg: '#253142', fg: '#d9c06b', glyph: 'gem' },
  };
}