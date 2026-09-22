// ============ EVENTOS GLOBAIS DE PARTIDA ============
// Eventos dinâmicos que surgem durante a partida e mudam o ritmo do jogo.
// Cada evento tem uma janela de tempo, um efeito global e um anúncio.

export type EventKind =
  | 'goldrush'      // ouro acelerado para todos
  | 'bloodmoon'     // dano aumentado, cura reduzida
  | 'ironwill'      // resistências aumentadas
  | 'arcanesurge'   // recargas aceleradas
  | 'huntseason'    // monstros da selva valem mais
  | 'suddendeath';  // respawn mais lento (fim de jogo)

export interface MatchEventDef {
  kind: EventKind;
  name: string;
  desc: string;
  color: string;
  icon: string;
  duration: number;   // segundos de duração
  /** momento mais cedo em que pode acontecer (segundos) */
  earliest: number;
  /** peso relativo no sorteio */
  weight: number;
}

export const MATCH_EVENTS: MatchEventDef[] = [
  {
    kind: 'goldrush', name: 'Corrida do Ouro', icon: '💰', color: '#ffd040',
    desc: 'Todo ouro ganho é aumentado em 60% para ambos os times.',
    duration: 60, earliest: 120, weight: 3,
  },
  {
    kind: 'bloodmoon', name: 'Lua Sangrenta', icon: '🌑', color: '#e04060',
    desc: 'Todo dano causado aumenta 18%, mas toda cura é reduzida em 35%.',
    duration: 75, earliest: 240, weight: 3,
  },
  {
    kind: 'ironwill', name: 'Vontade de Ferro', icon: '🛡️', color: '#90b0d0',
    desc: 'Todos ganham +30 de Armadura e Resistência Mágica.',
    duration: 60, earliest: 180, weight: 2,
  },
  {
    kind: 'arcanesurge', name: 'Surto Arcano', icon: '✨', color: '#a070ff',
    desc: 'Recargas de habilidades passam 45% mais rápido.',
    duration: 50, earliest: 200, weight: 3,
  },
  {
    kind: 'huntseason', name: 'Temporada de Caça', icon: '🌿', color: '#70d060',
    desc: 'Monstros da selva concedem o dobro de ouro e experiência.',
    duration: 70, earliest: 150, weight: 2,
  },
  {
    kind: 'suddendeath', name: 'Morte Súbita', icon: '⚰️', color: '#ff5050',
    desc: 'Tempo de renascimento aumentado em 60%. Cada erro custa caro.',
    duration: 90, earliest: 900, weight: 4,
  },
];

export interface ActiveEvent {
  kind: EventKind;
  def: MatchEventDef;
  startedAt: number;
  endsAt: number;
}

/** Sorteia um evento elegível considerando o tempo atual da partida. */
export function pickEvent(matchTime: number, exclude?: EventKind): MatchEventDef | null {
  const pool = MATCH_EVENTS.filter(e => matchTime >= e.earliest && e.kind !== exclude);
  if (!pool.length) return null;
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

/** Multiplicadores agregados do evento ativo (usados pelo motor). */
export function eventModifiers(active: ActiveEvent | null) {
  return {
    goldMul: active?.kind === 'goldrush' ? 1.6 : 1,
    damageMul: active?.kind === 'bloodmoon' ? 1.18 : 1,
    healMul: active?.kind === 'bloodmoon' ? 0.65 : 1,
    resistBonus: active?.kind === 'ironwill' ? 30 : 0,
    cdrMul: active?.kind === 'arcanesurge' ? 1.45 : 1,
    jungleMul: active?.kind === 'huntseason' ? 2 : 1,
    respawnMul: active?.kind === 'suddendeath' ? 1.6 : 1,
  };
}
