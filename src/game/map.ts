// ============ MAPA — posicionamento fiel ao Summoner's Rift ============
// Mundo 3000x3000. Base AZUL: canto inferior-esquerdo. Base VERMELHA: canto superior-direito.
// Rota do TOPO: borda esquerda + borda superior. MEIO: diagonal. BOT: borda inferior + direita.
// RIO: cruza o meio perpendicularmente, com poço do BARÃO (rio superior) e do DRAGÃO (rio inferior).

export const WORLD = 3000;
export type Vec = [number, number];

const mirror = ([x, y]: Vec): Vec => [WORLD - x, WORLD - y];

// -------- Rotas (waypoints do nexus azul -> nexus vermelho) --------
export const LANES: Record<'top' | 'mid' | 'bot', Vec[]> = {
  top: [
    [340, 2600], [240, 2250], [215, 1850], [210, 1500], [215, 1150], [240, 750],
    [300, 400], [400, 300], [750, 240], [1150, 215], [1500, 210], [1850, 215], [2250, 240], [2600, 340],
  ],
  mid: [
    [430, 2570], [700, 2300], [1000, 2000], [1250, 1750], [1500, 1500],
    [1750, 1250], [2000, 1000], [2300, 700], [2570, 430],
  ],
  bot: [
    [400, 2660], [750, 2760], [1150, 2785], [1500, 2790], [1850, 2785], [2250, 2760],
    [2600, 2700], [2700, 2600], [2760, 2250], [2785, 1850], [2790, 1500], [2785, 1150], [2760, 750], [2660, 400],
  ],
};

// -------- Rio (perpendicular ao meio) --------
export const RIVER: Vec[] = [[640, 640], [1000, 1000], [1500, 1500], [2000, 2000], [2360, 2360]];
export const BARON_PIT: Vec = [980, 1240];   // rio superior (lado do topo)
export const DRAGON_PIT: Vec = [2020, 1760]; // rio inferior (lado do bot)

// -------- Estruturas --------
export interface TowerSpot { x: number; y: number; team: 0 | 1; lane: 'top' | 'mid' | 'bot' | 'nexus'; tier: number }
// tier: 1=externa, 2=interna, 3=do inibidor, 4/5=torres do nexus (só atacáveis após a anterior cair)

const BLUE_TOWERS: TowerSpot[] = [
  { x: 218, y: 1440, team: 0, lane: 'top', tier: 1 },
  { x: 232, y: 2030, team: 0, lane: 'top', tier: 2 },
  { x: 315, y: 2360, team: 0, lane: 'top', tier: 3 },
  { x: 1180, y: 1820, team: 0, lane: 'mid', tier: 1 },
  { x: 900, y: 2100, team: 0, lane: 'mid', tier: 2 },
  { x: 645, y: 2355, team: 0, lane: 'mid', tier: 3 },
  { x: 1560, y: 2782, team: 0, lane: 'bot', tier: 1 },
  { x: 970, y: 2768, team: 0, lane: 'bot', tier: 2 },
  { x: 640, y: 2685, team: 0, lane: 'bot', tier: 3 },
  { x: 355, y: 2555, team: 0, lane: 'nexus', tier: 4 },
  { x: 445, y: 2645, team: 0, lane: 'nexus', tier: 4 },
];

export const TOWERS: TowerSpot[] = [
  ...BLUE_TOWERS,
  ...BLUE_TOWERS.map(t => ({ ...t, team: 1 as const, x: WORLD - t.x, y: WORLD - t.y })),
];

export interface InhibSpot { x: number; y: number; team: 0 | 1; lane: 'top' | 'mid' | 'bot' }
const BLUE_INHIBS: InhibSpot[] = [
  { x: 285, y: 2455, team: 0, lane: 'top' },
  { x: 555, y: 2450, team: 0, lane: 'mid' },
  { x: 545, y: 2715, team: 0, lane: 'bot' },
];
export const INHIBS: InhibSpot[] = [
  ...BLUE_INHIBS,
  ...BLUE_INHIBS.map(i => ({ ...i, team: 1 as const, x: WORLD - i.x, y: WORLD - i.y })),
];

export const NEXUS: { x: number; y: number; team: 0 | 1 }[] = [
  { x: 255, y: 2745, team: 0 },
  { x: 2745, y: 255, team: 1 },
];

export const FOUNTAINS: Vec[] = [[130, 2870], [2870, 130]];

// -------- Selva (acampamentos espelhados como no LoL) --------
export interface CampSpot { x: number; y: number; type: 'blue' | 'red' | 'wolves' | 'raptors' | 'gromp' | 'krugs' | 'dragon' | 'baron' | 'riftherald' | 'crab' | 'wyvern'; side: 0 | 1 | 2 }
const BLUE_SIDE_CAMPS: CampSpot[] = [
  { x: 480, y: 1620, type: 'gromp', side: 0 },
  { x: 700, y: 1780, type: 'blue', side: 0 },
  { x: 790, y: 2080, type: 'wolves', side: 0 },
  { x: 1330, y: 2260, type: 'raptors', side: 0 },
  { x: 1640, y: 2440, type: 'red', side: 0 },
  { x: 1960, y: 2620, type: 'krugs', side: 0 },
  // monstros épicos do rio (escudos/caranguejo)
  { x: 1120, y: 1480, type: 'crab', side: 0 },
];
export const CAMPS: CampSpot[] = [
  ...BLUE_SIDE_CAMPS,
  ...BLUE_SIDE_CAMPS.map(c => ({ ...c, side: 1 as const, x: WORLD - c.x, y: WORLD - c.y })),
  { x: DRAGON_PIT[0], y: DRAGON_PIT[1], type: 'dragon', side: 2 },
  { x: BARON_PIT[0], y: BARON_PIT[1], type: 'baron', side: 2 },
  // Arauto da Fenda (monstro épico do rio SUPERIOR — entre o Barão e o meio)
  // no rio, caminhável, sem invadir rota
  { x: 1210, y: 1210, type: 'riftherald', side: 2 },
  // Wyvern (dragão menor, respawn rápido) — rio INFERIOR, entre o meio e o Dragão
  { x: 1750, y: 1750, type: 'wyvern', side: 2 },
];

// -------- Grade de caminhabilidade (paredes da selva) --------
export const GRID = 60;                 // 60x60 células de 50px
export const CELL = WORLD / GRID;
export const walkGrid = new Uint8Array(GRID * GRID); // 1 = caminhável

function stampCircle(x: number, y: number, r: number) {
  const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(GRID - 1, Math.ceil((x + r) / CELL));
  const r0 = Math.max(0, Math.floor((y - r) / CELL)), r1 = Math.min(GRID - 1, Math.ceil((y + r) / CELL));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const px = cx * CELL + CELL / 2, py = cy * CELL + CELL / 2;
    if ((px - x) ** 2 + (py - y) ** 2 <= r * r) walkGrid[cy * GRID + cx] = 1;
  }
}
function stampPath(pts: Vec[], r: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const d = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(d / (CELL / 2)));
    for (let s = 0; s <= steps; s++) stampCircle(ax + (bx - ax) * s / steps, ay + (by - ay) * s / steps, r);
  }
}

// Rotas largas
stampPath(LANES.top, 120);
stampPath(LANES.mid, 120);
stampPath(LANES.bot, 120);
// Rio
stampPath(RIVER, 130);
stampCircle(BARON_PIT[0], BARON_PIT[1], 150);
stampCircle(DRAGON_PIT[0], DRAGON_PIT[1], 150);
// Bases (plataformas)
stampCircle(400, 2600, 420); stampCircle(150, 2850, 320);
stampCircle(2600, 400, 420); stampCircle(2850, 150, 320);

// Trilhas da selva (lado azul) + espelho
const jungleTrails: Vec[][] = [
  // quadrante do topo (azul): topo -> gromp -> buff azul -> lobos -> meio
  [[225, 1600], [480, 1620], [700, 1780], [790, 2080], [960, 2110]],
  // buff azul -> rio superior (entrada do barão)
  [[700, 1780], [900, 1560], [1080, 1350]],
  // gromp -> rio
  [[480, 1620], [640, 1400], [820, 1150], [900, 950]],
  // quadrante do bot (azul): meio -> raptors -> buff vermelho -> krugs -> bot
  [[1120, 1930], [1330, 2260], [1640, 2440], [1960, 2620], [1990, 2755]],
  // buff vermelho -> rio inferior (entrada do dragão)
  [[1640, 2440], [1840, 2200], [1950, 1980]],
  // raptors -> rio
  [[1330, 2260], [1560, 2090], [1800, 2020]],
  // conexões da rota com o rio
  [[210, 1500], [500, 1180], [700, 800]],
  [[1500, 2790], [2050, 2450], [2280, 2330]],
];
for (const tr of jungleTrails) { stampPath(tr, 85); stampPath(tr.map(mirror), 85); }

export function isWalkable(x: number, y: number): boolean {
  if (x < 10 || y < 10 || x > WORLD - 10 || y > WORLD - 10) return false;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  return walkGrid[cy * GRID + cx] === 1;
}

// Movimento com deslize nas paredes
export function tryMove(x: number, y: number, nx: number, ny: number, ghost = false): Vec {
  if (ghost || isWalkable(nx, ny)) {
    if (nx < 15) nx = 15; if (ny < 15) ny = 15;
    if (nx > WORLD - 15) nx = WORLD - 15; if (ny > WORLD - 15) ny = WORLD - 15;
    if (ghost && !isWalkable(nx, ny) && isWalkable(x, y)) {
      // fantasmas não saem do mapa jogável por completo — deslizam também
      if (isWalkable(nx, y)) return [nx, y];
      if (isWalkable(x, ny)) return [x, ny];
      return [x, y];
    }
    return [nx, ny];
  }
  if (isWalkable(nx, y)) return [nx, y];
  if (isWalkable(x, ny)) return [x, ny];
  return [x, y];
}

export function nearestWalkable(x: number, y: number): Vec {
  if (isWalkable(x, y)) return [x, y];
  for (let r = CELL; r < 900; r += CELL) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
      if (isWalkable(px, py)) return [px, py];
    }
  }
  return [1500, 1500];
}
