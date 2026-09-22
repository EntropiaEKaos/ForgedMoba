// ============ SISTEMA DE RUNAS ============
// Cada partida usa uma "página" com 3 runas: Keystone, Secundária e Menor.
// As runas alteram atributos e comportamentos no motor via `runeKey`.

export type RuneSlot = 'keystone' | 'secondary' | 'minor';

export interface RuneDef {
  id: string;
  name: string;
  desc: string;
  slot: RuneSlot;
  /** chave usada pelo motor para aplicar o efeito */
  key: string;
  /** cor do ícone no HUD e na tela de seleção */
  color: string;
  /** bônus estáticos aplicados em applyHeroStats */
  stats?: {
    hp?: number; ad?: number; ap?: number; armor?: number; mr?: number;
    ms?: number; as?: number; crit?: number; lifesteal?: number;
    hpRegen?: number; mpRegen?: number; mpen?: number; cdr?: number;
  };
}

export const RUNES: RuneDef[] = [
  // ---------- KEYSTONES (efeito de identidade) ----------
  {
    id: 'conqueror', name: 'Conquistador', slot: 'keystone', key: 'conqueror', color: '#e07040',
    desc: 'Ataques e habilidades acumulam Fúria (máx. 6). Cada acúmulo dá +3 AD/AP. Com pilha cheia, cura 8% do dano causado.',
  },
  {
    id: 'electrocute', name: 'Eletrocutar', slot: 'keystone', key: 'electrocute', color: '#a060ff',
    desc: 'Acertar um herói com 3 fontes de dano distintas em 4s causa dano adaptativo extra (recarga 20s).',
  },
  {
    id: 'aftershock', name: 'Pós-Choque', slot: 'keystone', key: 'aftershock', color: '#ffc040',
    desc: 'Após aplicar controle de grupo, ganha 35 de Armadura/RM por 2,5s e libera uma explosão mágica.',
  },
  {
    id: 'fleetwork', name: 'Passo Ligeiro', slot: 'keystone', key: 'fleetwork', color: '#50d0b0',
    desc: 'Ataques concedem 20% de velocidade por 1s e curam uma pequena quantia de vida.',
  },
  {
    id: 'arcanecomet', name: 'Cometa Arcano', slot: 'keystone', key: 'arcanecomet', color: '#70b0ff',
    desc: 'Habilidades que causam dano invocam um cometa no alvo (recarga 14s).',
  },

  // ---------- SECUNDÁRIAS (utilidade forte) ----------
  {
    id: 'presence', name: 'Presença de Espírito', slot: 'secondary', key: 'presence', color: '#80c0ff',
    desc: 'Abates e assistências reduzem 15% da recarga restante de todas as habilidades.',
    stats: { mpRegen: 6 },
  },
  {
    id: 'bloodline', name: 'Linhagem Sanguínea', slot: 'secondary', key: 'bloodline', color: '#e05070',
    desc: 'Ganha 6% de roubo de vida e +90 de vida máxima.',
    stats: { lifesteal: 0.06, hp: 90 },
  },
  {
    id: 'transcendence', name: 'Transcendência', slot: 'secondary', key: 'transcendence', color: '#c090ff',
    desc: 'Reduz todas as recargas em 12% e concede +25 de Poder de Habilidade.',
    stats: { cdr: 0.12, ap: 25 },
  },
  {
    id: 'ironclad', name: 'Couraça de Ferro', slot: 'secondary', key: 'ironclad', color: '#90a0b0',
    desc: 'Ganha +25 de Armadura e +20 de Resistência Mágica.',
    stats: { armor: 25, mr: 20 },
  },
  {
    id: 'giantslayer', name: 'Matador de Gigantes', slot: 'secondary', key: 'giantslayer', color: '#ff8040',
    desc: 'Causa até 10% de dano adicional contra alvos com mais vida máxima que você.',
  },

  // ---------- MENORES (bônus de base) ----------
  { id: 'swift', name: 'Rapidez', slot: 'minor', key: 'swift', color: '#60e0c0', desc: '+18 de Velocidade de Movimento.', stats: { ms: 18 } },
  { id: 'vitality', name: 'Vitalidade', slot: 'minor', key: 'vitality', color: '#60d060', desc: '+120 de Vida e +5 de regeneração.', stats: { hp: 120, hpRegen: 5 } },
  { id: 'precision', name: 'Precisão', slot: 'minor', key: 'precision', color: '#ffd060', desc: '+10% de Velocidade de Ataque e +5% de Crítico.', stats: { as: 0.1, crit: 5 } },
  { id: 'sorcery', name: 'Feitiçaria', slot: 'minor', key: 'sorcery', color: '#b080ff', desc: '+8% de Penetração Mágica.', stats: { mpen: 0.08 } },
  { id: 'brutality', name: 'Brutalidade', slot: 'minor', key: 'brutality', color: '#e06060', desc: '+12 de Dano de Ataque.', stats: { ad: 12 } },
];

export const RUNE_BY_ID: Record<string, RuneDef> = Object.fromEntries(RUNES.map(r => [r.id, r]));
export const RUNES_BY_SLOT = (slot: RuneSlot) => RUNES.filter(r => r.slot === slot);

export interface RunePage {
  keystone: string;
  secondary: string;
  minor: string;
}

export const DEFAULT_RUNE_PAGE: RunePage = { keystone: 'conqueror', secondary: 'bloodline', minor: 'vitality' };

/** Soma dos bônus estáticos de uma página de runas. */
export function runeStats(page: RunePage) {
  const total = { hp: 0, ad: 0, ap: 0, armor: 0, mr: 0, ms: 0, as: 0, crit: 0, lifesteal: 0, hpRegen: 0, mpRegen: 0, mpen: 0, cdr: 0 };
  for (const id of [page.keystone, page.secondary, page.minor]) {
    const rune = RUNE_BY_ID[id];
    if (!rune?.stats) continue;
    for (const [key, value] of Object.entries(rune.stats)) {
      (total as Record<string, number>)[key] += value as number;
    }
  }
  return total;
}

/** Conjunto de chaves ativas para lookups rápidos no motor. */
export function runeKeys(page: RunePage): Set<string> {
  return new Set([page.keystone, page.secondary, page.minor]
    .map(id => RUNE_BY_ID[id]?.key)
    .filter(Boolean) as string[]);
}
