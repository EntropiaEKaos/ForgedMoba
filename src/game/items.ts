// ============ 26 ITENS COM RECEITAS ============
export interface ItemStats {
  ad?: number; ap?: number; hp?: number; mp?: number;
  armor?: number; mr?: number; as?: number;      // as = % vel. ataque (0.25 = 25%)
  ms?: number; crit?: number;                     // crit = % chance
  lifesteal?: number; hpRegen?: number; mpRegen?: number;
  mpen?: number;                                  // penetração mágica %
}

export interface ItemDef {
  id: string;
  name: string;
  totalCost: number;
  recipe: string[];       // ids dos componentes
  stats: ItemStats;
  passive?: string;       // descrição da passiva
  passiveKey?: string;    // efeito no motor
  tier: 1 | 2 | 3;
  icon: { bg: string; fg: string; glyph: string };
}

export const ITEMS: ItemDef[] = [
  // ---------- COMPONENTES (Tier 1) ----------
  { id: 'longsword', name: 'Espada Longa', totalCost: 350, recipe: [], stats: { ad: 10 }, tier: 1,
    icon: { bg: '#3a3a44', fg: '#d8dce4', glyph: 'sword' } },
  { id: 'dagger', name: 'Adaga', totalCost: 300, recipe: [], stats: { as: 0.12 }, tier: 1,
    icon: { bg: '#3a3a44', fg: '#a8e0c8', glyph: 'dagger' } },
  { id: 'amptome', name: 'Tomo Amplificador', totalCost: 435, recipe: [], stats: { ap: 20 }, tier: 1,
    icon: { bg: '#2e2a4a', fg: '#b090ff', glyph: 'book' } },
  { id: 'ruby', name: 'Cristal de Rubi', totalCost: 400, recipe: [], stats: { hp: 150 }, tier: 1,
    icon: { bg: '#3a1e24', fg: '#ff5a6a', glyph: 'gem' } },
  { id: 'sapphire', name: 'Cristal de Safira', totalCost: 350, recipe: [], stats: { mp: 250 }, tier: 1,
    icon: { bg: '#1e2a3e', fg: '#5aa0ff', glyph: 'gem' } },
  { id: 'clotharmor', name: 'Armadura de Pano', totalCost: 300, recipe: [], stats: { armor: 15 }, tier: 1,
    icon: { bg: '#3a3428', fg: '#d0c090', glyph: 'shield' } },
  { id: 'nullmantle', name: 'Manto Nulificador', totalCost: 450, recipe: [], stats: { mr: 25 }, tier: 1,
    icon: { bg: '#2a2e3e', fg: '#8ab0e0', glyph: 'cloak' } },
  { id: 'boots', name: 'Botas de Velocidade', totalCost: 350, recipe: [], stats: { ms: 25 }, tier: 1,
    icon: { bg: '#33302a', fg: '#c8a878', glyph: 'boot' } },
  { id: 'vampscepter', name: 'Cetro Vampírico', totalCost: 800, recipe: ['longsword'], stats: { ad: 15, lifesteal: 0.08 }, tier: 2,
    icon: { bg: '#38202a', fg: '#e06070', glyph: 'scepter' } },
  { id: 'pickaxe', name: 'Picareta', totalCost: 875, recipe: ['longsword'], stats: { ad: 25 }, tier: 2,
    icon: { bg: '#3a3a44', fg: '#e0c8a0', glyph: 'pick' } },
  { id: 'bfsword', name: 'Espada B.F.', totalCost: 1550, recipe: ['pickaxe'], stats: { ad: 45 }, tier: 2,
    icon: { bg: '#2e3440', fg: '#f0f4fa', glyph: 'bigsword' } },
  { id: 'blastingwand', name: 'Cajado Desmedido', totalCost: 1600, recipe: ['amptome', 'amptome'], stats: { ap: 80 }, tier: 2,
    icon: { bg: '#302050', fg: '#d0a0ff', glyph: 'rod' } },

  // ---------- ITENS COMPLETOS (Tier 3) ----------
  { id: 'infinityedge', name: 'Gume do Infinito', totalCost: 3600, recipe: ['bfsword', 'pickaxe'],
    stats: { ad: 70, crit: 25 }, tier: 3,
    passive: 'Acertos críticos causam 250% de dano (em vez de 200%).', passiveKey: 'iedge',
    icon: { bg: '#403020', fg: '#ffd858', glyph: 'bigsword' } },
  { id: 'bloodthirster', name: 'Sedenta por Sangue', totalCost: 3200, recipe: ['bfsword', 'vampscepter'],
    stats: { ad: 70, lifesteal: 0.15 }, tier: 3,
    passive: 'Roubo de vida excedente gera um escudo de até 200.', passiveKey: 'btshield',
    icon: { bg: '#401820', fg: '#ff4858', glyph: 'bigsword' } },
  { id: 'deathcap', name: 'Capuz Mortal de Rabadan', totalCost: 3800, recipe: ['blastingwand', 'amptome'],
    stats: { ap: 120 }, tier: 3,
    passive: 'Aumenta seu Poder de Habilidade total em 30%.', passiveKey: 'deathcap',
    icon: { bg: '#3a1050', fg: '#e8b0ff', glyph: 'hat' } },
  { id: 'voidstaff', name: 'Cajado do Vazio', totalCost: 3000, recipe: ['blastingwand'],
    stats: { ap: 70, mpen: 0.35 }, tier: 3,
    passive: 'Suas magias ignoram 35% da resistência mágica inimiga.', passiveKey: 'voidpen',
    icon: { bg: '#241040', fg: '#a060e0', glyph: 'rod' } },
  { id: 'zhonya', name: 'Ampulheta de Zhonya', totalCost: 3300, recipe: ['blastingwand', 'clotharmor'],
    stats: { ap: 75, armor: 45 }, tier: 3,
    passive: 'ATIVO (tecla 1-6): fica invulnerável e imóvel por 2s (recarga 90s).', passiveKey: 'stasis',
    icon: { bg: '#403410', fg: '#ffd840', glyph: 'hourglass' } },
  { id: 'frozenmallet', name: 'Malho Congelado', totalCost: 3100, recipe: ['ruby', 'ruby', 'pickaxe'],
    stats: { ad: 30, hp: 550 }, tier: 3,
    passive: 'Seus ataques básicos reduzem a velocidade do alvo em 30% por 1,5s.', passiveKey: 'mallet',
    icon: { bg: '#1a3040', fg: '#80d0f0', glyph: 'hammer' } },
  { id: 'thornmail', name: 'Armadura de Espinhos', totalCost: 2200, recipe: ['clotharmor', 'clotharmor'],
    stats: { armor: 80 }, tier: 3,
    passive: 'Reflete 25% do dano de ataques recebidos como dano mágico.', passiveKey: 'thorns',
    icon: { bg: '#20301c', fg: '#90d060', glyph: 'shield' } },
  { id: 'warmog', name: 'Coração de Warmung', totalCost: 2850, recipe: ['ruby', 'ruby'],
    stats: { hp: 800, hpRegen: 10 }, tier: 3,
    passive: 'Fora de combate por 6s, regenera 3% da vida máxima por segundo.', passiveKey: 'warmog',
    icon: { bg: '#2a3418', fg: '#a0e050', glyph: 'heart' } },
  { id: 'sunfire', name: 'Capa do Fogo Solar', totalCost: 2700, recipe: ['ruby', 'clotharmor'],
    stats: { hp: 400, armor: 40 }, tier: 3,
    passive: 'Queima inimigos próximos com 35 de dano mágico por segundo.', passiveKey: 'sunfire',
    icon: { bg: '#40200c', fg: '#ff9040', glyph: 'flame' } },
  { id: 'banshee', name: 'Véu da Fada Sombria', totalCost: 2900, recipe: ['nullmantle', 'sapphire', 'ruby'],
    stats: { mr: 55, hp: 300, mp: 300 }, tier: 3,
    passive: 'Bloqueia uma habilidade inimiga a cada 30s.', passiveKey: 'spellshield',
    icon: { bg: '#182838', fg: '#70b8ff', glyph: 'cloak' } },
  { id: 'berserker', name: 'Grevas do Berserker', totalCost: 1100, recipe: ['boots', 'dagger'],
    stats: { ms: 35, as: 0.25 }, tier: 3,
    icon: { bg: '#33302a', fg: '#e0b060', glyph: 'boot' } },
  { id: 'sorcshoes', name: 'Sapatos do Feiticeiro', totalCost: 1100, recipe: ['boots'],
    stats: { ms: 35, mpen: 0.12 }, tier: 3,
    passive: 'Suas magias ignoram 12% da resistência mágica.', passiveKey: 'sorcpen',
    icon: { bg: '#2a2440', fg: '#a888e8', glyph: 'boot' } },
  { id: 'ninjatabi', name: 'Tabi Ninja', totalCost: 1000, recipe: ['boots', 'clotharmor'],
    stats: { ms: 35, armor: 22 }, tier: 3,
    passive: 'Reduz o dano de ataques básicos recebidos em 10%.', passiveKey: 'tabi',
    icon: { bg: '#242c28', fg: '#88b898', glyph: 'boot' } },
  { id: 'phantomdancer', name: 'Dançarina Fantasma', totalCost: 2800, recipe: ['dagger', 'dagger'],
    stats: { as: 0.45, crit: 20, ms: 8 }, tier: 3,
    passive: 'Você atravessa unidades livremente.', passiveKey: 'ghost',
    icon: { bg: '#283038', fg: '#c0e8f8', glyph: 'dagger' } },
  { id: 'randuins', name: 'Ampulheta de Randuin', totalCost: 2900, recipe: ['ruby', 'clotharmor'],
    stats: { hp: 400, armor: 60 }, tier: 3,
    passive: 'ATIVO: reduz vel. ataque e movimento de inimigos próximos em 40% por 2s (recarga 60s).', passiveKey: 'randuins',
    icon: { bg: '#3a2810', fg: '#e0a040', glyph: 'hourglass' } },
  { id: 'qss', name: 'Cinto de Quicksilver', totalCost: 1300, recipe: ['nullmantle'],
    stats: { mr: 40 }, tier: 3,
    passive: 'ATIVO: remove todos os efeitos negativos (recarga 90s).', passiveKey: 'qss',
    icon: { bg: '#2a3a4a', fg: '#a0d0ff', glyph: 'cloak' } },
  { id: 'ward', name: 'Ward de Visão', totalCost: 75, recipe: [],
    stats: {}, tier: 1,
    passive: 'ATIVO: planta uma ward reveladora por 120s (recarga 30s).', passiveKey: 'ward',
    icon: { bg: '#2a3a2a', fg: '#80e0a0', glyph: 'shield' } },
  // ---------- NOVOS ITENS LENDÁRIOS (receitas ricas) ----------
  { id: 'youmuus', name: 'Fantasma de Youmuu', totalCost: 3100, recipe: ['pickaxe', 'dagger'],
    stats: { ad: 50, as: 0.15, crit: 10 }, tier: 3,
    passive: 'ATIVO: +25% vel. movimento e ataque por 6s (recarga 60s).', passiveKey: 'youmuus',
    icon: { bg: '#1a2030', fg: '#80d0e0', glyph: 'dagger' } },
  { id: 'abyssalmask', name: 'Máscara Abissal', totalCost: 2900, recipe: ['ruby', 'nullmantle'],
    stats: { hp: 350, mr: 45 }, tier: 3,
    passive: 'Inimigos próximos sofrem 10% a mais de dano mágico.', passiveKey: 'abyssal',
    icon: { bg: '#1a1828', fg: '#9a6aff', glyph: 'cloak' } },
  { id: 'blackcleaver', name: 'Corte Sombrio', totalCost: 3100, recipe: ['ruby', 'pickaxe'],
    stats: { hp: 400, ad: 40 }, tier: 3,
    passive: 'Ataques reduzem a armadura do alvo em 5% (acumula 6x).', passiveKey: 'cleaver',
    icon: { bg: '#241a14', fg: '#b8602c', glyph: 'bigsword' } },
  { id: 'deathsdance', name: 'Dança da Morte', totalCost: 3300, recipe: ['bfsword', 'vampscepter'],
    stats: { ad: 75, hp: 300 }, tier: 3,
    passive: 'Ignora 30% do dano recebido, sofrido ao longo de 3s.', passiveKey: 'deathsdance',
    icon: { bg: '#2a1a2a', fg: '#c048c0', glyph: 'bigsword' } },
  { id: 'nashorstooth', name: 'Dente de Nashor', totalCost: 3200, recipe: ['amptome', 'dagger'],
    stats: { ap: 80, as: 0.5 }, tier: 3,
    passive: 'Ataques causam dano mágico adicional.', passiveKey: 'nashor',
    icon: { bg: '#181428', fg: '#5cb0d8', glyph: 'rod' } },
  { id: 'lichbane', name: 'Sedeção de Lich', totalCost: 3200, recipe: ['amptome', 'sapphire'],
    stats: { ap: 80, ms: 8, mp: 300 }, tier: 3,
    passive: 'Após usar habilidade, próximo ataque causa dano mágico extra.', passiveKey: 'lichbane',
    icon: { bg: '#1c2828', fg: '#4cd8a4', glyph: 'scepter' } },
  { id: 'spiritvisage', name: 'Visão Espiritual', totalCost: 2900, recipe: ['nullmantle', 'ruby'],
    stats: { hp: 450, mr: 40, hpRegen: 10 }, tier: 3,
    passive: 'Aumenta toda cura recebida em 30%.', passiveKey: 'spirit',
    icon: { bg: '#241a2a', fg: '#d86cd8', glyph: 'heart' } },
  { id: 'goredrinker', name: 'Bebedor de Sangue', totalCost: 3300, recipe: ['pickaxe', 'ruby'],
    stats: { ad: 50, hp: 400, hpRegen: 15 }, tier: 3,
    passive: 'ATIVO: cura com base em inimigos próximos.', passiveKey: 'goredrinker',
    icon: { bg: '#2a1814', fg: '#d85050', glyph: 'scepter' } },
  { id: 'mawofmalmortius', name: 'Fauces de Malmortius', totalCost: 3200, recipe: ['pickaxe', 'nullmantle'],
    stats: { ad: 60, mr: 50 }, tier: 3,
    passive: 'Receber dano mágico baixo ativa um escudo mágico.', passiveKey: 'maw',
    icon: { bg: '#241428', fg: '#c84cd8', glyph: 'bigsword' } },
  { id: 'steraksgage', name: 'Medidor de Sterak', totalCost: 3100, recipe: ['pickaxe', 'ruby'],
    stats: { hp: 450, ad: 50 }, tier: 3,
    passive: 'Ao receber dano alto, ganha escudo por 4s.', passiveKey: 'steraks',
    icon: { bg: '#241c14', fg: '#d8a84c', glyph: 'shield' } },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export function componentDiscount(id: string, owned: string[]): { cost: number; consumed: number[] } {
  // custo com desconto: componentes que você já tem são consumidos
  const item = ITEM_BY_ID[id];
  let cost = item.totalCost;
  const ownedCopy = [...owned];
  const consumed: number[] = [];
  for (const comp of item.recipe) {
    const idx = ownedCopy.indexOf(comp);
    if (idx >= 0) {
      cost -= ITEM_BY_ID[comp].totalCost;
      consumed.push(idx);
      ownedCopy[idx] = '__used__';
    }
  }
  return { cost: Math.max(0, cost), consumed };
}
