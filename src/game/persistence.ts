// ============ PERSISTÊNCIA (localStorage) ============
export interface Profile {
  name: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  timePlayed: number;
  mainHero: string;
  heroStats: Record<string, { games: number; wins: number; k: number; d: number; a: number; cs: number }>;
  favoriteSummoners: string[];
  totalMatches: number;
  createdAt: number;
  difficulty: 'easy' | 'normal' | 'hard';
  // sistema de skins
  ownedSkins: string[];                        // ids de skins desbloqueadas
  equippedSkins: Record<string, string>;       // heroId -> skinId (skin equipada)
  currency: number;                            // "moedas de éter" para comprar skins
  shards: string[];                            // fragmentos de skin que podem ser ativos
  // sistema de runas
  runePage: { keystone: string; secondary: string; minor: string };
  runePages: Record<string, { keystone: string; secondary: string; minor: string }>; // páginas salvas por nome
}

export interface MatchRecord {
  id: string;
  date: number;
  hero: string;
  result: 'win' | 'lose';
  k: number; d: number; a: number; cs: number;
  gold: number;
  time: number;
  teamKills: [number, number];
}

const KEY = 'pixelrift_profile_v1';
const MATCH_KEY = 'pixelrift_matches_v1';

export function defaultProfile(name = 'Invocador'): Profile {
  return {
    name, level: 1, xp: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0,
    timePlayed: 0, mainHero: 'gareth', heroStats: {}, favoriteSummoners: ['flash', 'ignite'],
    totalMatches: 0, createdAt: Date.now(), difficulty: 'normal',
    ownedSkins: [], equippedSkins: {}, currency: 500, shards: [],
    runePage: { keystone: 'conqueror', secondary: 'bloodline', minor: 'vitality' },
    runePages: {
      'Combate': { keystone: 'conqueror', secondary: 'bloodline', minor: 'brutality' },
      'Magia': { keystone: 'arcanecomet', secondary: 'transcendence', minor: 'sorcery' },
      'Tanque': { keystone: 'aftershock', secondary: 'ironclad', minor: 'vitality' },
    },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const p = defaultProfile();
  saveProfile(p);
  return p;
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function loadMatches(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function addMatch(rec: MatchRecord, p: Profile): Profile {
  const matches = loadMatches();
  matches.unshift(rec);
  const trimmed = matches.slice(0, 50);
  try { localStorage.setItem(MATCH_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  // atualiza perfil
  const np = { ...p };
  np.totalMatches++;
  np.kills += rec.k; np.deaths += rec.d; np.assists += rec.a; np.cs += rec.cs;
  np.gold += rec.gold; np.timePlayed += rec.time;
  if (rec.result === 'win') np.wins++; else np.losses++;
  np.xp += rec.result === 'win' ? 200 + rec.k * 10 : 80 + rec.k * 5;
  while (np.xp >= np.level * 200) { np.xp -= np.level * 200; np.level++; }
  const hs = np.heroStats[rec.hero] ?? { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0 };
  hs.games++; hs.k += rec.k; hs.d += rec.d; hs.a += rec.a; hs.cs += rec.cs;
  if (rec.result === 'win') hs.wins++;
  np.heroStats[rec.hero] = hs;
  // concede éter (moeda de skin) e às vezes um fragmento aleatório
  const ether = rec.result === 'win' ? 150 + rec.k * 5 : 60 + rec.k * 3;
  np.currency += ether;
  if (Math.random() < 0.18) {
    const random = `${rec.hero}_etherfrag`;
    if (!np.shards.includes(random)) np.shards.push(random);
  }
  saveProfile(np);
  return np;
}

export function resetProfile(): Profile {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(MATCH_KEY);
  } catch { /* ignore */ }
  return defaultProfile();
}

// ---------- Helpers de Skins ----------
export function addCurrency(p: Profile, amount: number): Profile {
  const np = { ...p, currency: p.currency + amount };
  saveProfile(np);
  return np;
}

export function buySkin(p: Profile, skinId: string, cost: number): { ok: boolean; error?: string; profile?: Profile } {
  if (p.ownedSkins.includes(skinId)) return { ok: false, error: 'Você já possui esta skin' };
  if (p.currency < cost) return { ok: false, error: 'Éter insuficiente' };
  const np = { ...p, ownedSkins: [...p.ownedSkins, skinId], currency: p.currency - cost };
  saveProfile(np);
  return { ok: true, profile: np };
}

export function equipSkin(p: Profile, heroId: string, skinId: string): Profile {
  const np = { ...p, equippedSkins: { ...p.equippedSkins, [heroId]: skinId } };
  saveProfile(np);
  return np;
}

export function unequipSkin(p: Profile, heroId: string): Profile {
  const np = { ...p, equippedSkins: { ...p.equippedSkins } };
  delete np.equippedSkins[heroId];
  saveProfile(np);
  return np;
}

export function getRank(p: Profile): string {
  const wr = p.totalMatches > 0 ? p.wins / p.totalMatches : 0;
  if (p.level < 5) return 'Ferro';
  if (p.level < 10) return 'Bronze';
  if (p.level < 20) return 'Prata';
  if (p.level < 35) return 'Ouro';
  if (p.level < 50) return 'Platina';
  if (p.level < 75) return 'Diamante';
  if (wr > 0.6) return 'Mestre';
  return 'Desafiante';
}
