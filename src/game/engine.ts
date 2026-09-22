// ============ MOTOR DO JOGO ============
import { HEROES, HERO_BY_ID, type HeroDef, type AbilitySlot, type AbilityDef } from './heroes';
import { ITEM_BY_ID, componentDiscount } from './items';
import {
  WORLD, LANES, RIVER, TOWERS, INHIBS, NEXUS, FOUNTAINS, CAMPS,
  BARON_PIT, DRAGON_PIT, isWalkable, tryMove, nearestWalkable, type Vec,
} from './map';
import { getHeroSprite, getMinionSprite, getMonsterSprite } from './sprites';
import { applySkin, SKIN_BY_ID } from './skins';
import { sfx, initAudio } from './sound';
import type { GameModeDef, MapPresetDef } from '../admin/types';
import { DEFAULT_RUNE_PAGE, RUNE_BY_ID, runeKeys, runeStats, type RunePage } from './runes';
import { eventModifiers, pickEvent, type ActiveEvent, type EventKind } from './events';

// helpers de shading no engine (para torres, estruturas, etc)
function shadeE(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
function celE(hex: string) { return { l: shadeE(hex, 52), b: hex, d: shadeE(hex, -56) }; }

/**
 * Calcula o dano de uma habilidade de forma dinâmica,
 * considerando escalonamentos de AD, AP, Armadura, RM e Vida Máxima (afetados por itens!)
 */
export function calculateAbilityDamage(u: Unit, ab: AbilityDef, skillLv: number): number {
  if (skillLv <= 0) return 0;
  // Fallbacks razoáveis caso não haja stats preenchidos no form
  const isUlt = ab.key.includes('ult') || ab.key === 'r' || ab.name.toLowerCase().includes('invocar') || ab.name.toLowerCase().includes('suprema');
  const base = ab.dmgBase ?? (isUlt ? 120 : 60);
  const perLv = ab.dmgPerLevel ?? (isUlt ? 60 : 15);
  
  let dmg = base + (skillLv - 1) * perLv;

  // Escalonamentos estruturados
  const rAd = ab.ratioAd !== undefined ? ab.ratioAd : (isUlt ? 0.8 : 0.4);
  const rAp = ab.ratioAp !== undefined ? ab.ratioAp : (isUlt ? 0.9 : 0.5);
  const rArmor = ab.ratioArmor !== undefined ? ab.ratioArmor : 0;
  const rMr = ab.ratioMr !== undefined ? ab.ratioMr : 0;
  const rHp = ab.ratioHp !== undefined ? ab.ratioHp : 0;

  dmg += u.ad * rAd;
  dmg += u.ap * rAp;
  dmg += u.armor * rArmor;
  dmg += u.mr * rMr;
  dmg += u.maxHp * rHp;

  return Math.round(dmg);
}
import { SUMMONERS } from './summoners';
// SummonerDef type used implicitly via SUMMONERS records
import { FogOfWar, placeWard, type Ward } from './wards';

type Team = 0 | 1;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface Buff { key: string; until: number; v?: number; src?: Unit; tickT?: number; stacks?: number; data?: any }

export interface Unit {
  id: number; kind: 'hero' | 'minion' | 'tower' | 'inhib' | 'nexus' | 'monster';
  team: Team | 2; x: number; y: number; r: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  ad: number; ap: number; armor: number; mr: number; aspd: number; ms: number;
  crit: number; lifesteal: number; mpen: number; hpRegen: number; mpRegen: number;
  atkRange: number; atkCd: number; dead: boolean;
  buffs: Buff[]; lastCombat: number; facing: number; animT: number;
  moveTgt: Vec | null; attackTgt: Unit | null;
  flashT: number; stuckT: number; lastX: number; lastY: number; fountainT: number;
  attackMove: boolean; retalTgt: Unit | null; retalT: number;
  castT: number; attackAnimT: number;
  // hero
  def?: HeroDef; level: number; xp: number; gold: number; items: string[];
  cds: Record<AbilitySlot, number>; spellCount: number; hitCount: number;
  kills: number; deaths: number; assists: number; cs: number; respawnT: number;
  isBot: boolean; lane?: 'top' | 'mid' | 'bot'; buildIdx: number; recallT: number;
  recentDmg: Map<number, number>; barrierCd: number; activeCd: number; aiT: number;
  skillPoints: number; skillLv: Record<AbilitySlot, number>;
  summoners: string[]; summonerCd: Record<string, number>;
  bounty: number; killsStreak: number; deathsStreak: number;
  baseExitT: number; isJungler: boolean; smiteCd: number; wardCd: number;
  leftBase: boolean;
  // recargas das runas
  electrocuteCd: number; cometCd: number; aftershockCd: number;
  buybackCd: number;        // Dota: Recarga do Buyback
  // barra de dano fantasma (dano recente visível atrás da vida)
  ghostHp: number; ghostT: number;
  // minion
  wpts?: Vec[]; wptI?: number; caster?: boolean; superM?: boolean;
  // tower/estrutura
  tier?: number; towerLane?: string;
  // monstro
  campType?: string; campHome?: Vec;
  name: string;
}

interface Projectile {
  x: number; y: number; tx: number; ty: number; target?: Unit; speed: number;
  team: Team | 2; src: Unit; color: string; size: number; kind: string;
  onHit: (hitUnit: Unit | null, px: number, py: number) => void;
  hitRadius: number; maxDist: number; traveled: number; dx: number; dy: number;
  pierceHeroOnly?: boolean; hitSet?: Set<Unit>;
}

interface Zone {
  x: number; y: number; r: number; until: number; team: Team; src: Unit; color: string;
  dps: number; magic: boolean; tickT: number; slow?: number; kind: string; trap?: boolean; armT?: number;
}

interface FX {
  kind: string; x: number; y: number; x2?: number; y2?: number; r?: number; until: number; color: string;
  text?: string; vy?: number; vx?: number; g?: number; size?: number;
  dur?: number;         // duração total (para cálculo preciso de life)
  ang?: number;         // ângulo (para efeitos direcionais)
  n?: number;           // stacks/quantidade
  color2?: string;      // cor secundária (gradientes bi-color)
}

export interface ChatMessage {
  sender: string;
  hero: string;
  team: Team;
  text: string;
  time: number;
}

export interface TacticalPing {
  x: number;
  y: number;
  kind: 'danger' | 'omw' | 'missing' | 'assist';
  sender: string;
  team: Team;
  until: number;
}

export interface Snapshot {
  hp: number; maxHp: number; mp: number; maxMp: number; level: number; xp: number; xpNext: number;
  gold: number; cs: number; k: number; d: number; a: number; time: number; waveIn: number;
  cds: { slot: AbilitySlot; rem: number; total: number; mana: number; ok: boolean; lv: number; canUp: boolean }[];
  items: string[]; dead: boolean; respawnIn: number; canShop: boolean;
  passiveNote: string; result: 'win' | 'lose' | null; activeCd: number; hasZhonya: boolean;
  feed: { t: number; text: string; team: Team }[];
  board: { name: string; hero: string; team: Team; k: number; d: number; a: number; cs: number; level: number; bounty: number; isJg: boolean }[];
  recalling: boolean;
  teamKills: [number, number]; towersLeft: [number, number]; goldDiff: number;
  banner: { text: string; sub: string; color: string; id: number } | null;
  buffs: { key: string; label: string; color: string; stacks: number }[];
  target: { name: string; hp: number; maxHp: number; level: number } | null;
  skillPoints: number;
  summoners: { id: string; cd: number; cdMax: number; icon: string; name: string }[];
  activeItems: { idx: number; name: string; cd: number; cdMax: number; icon: string }[];
  lastHitBonus: number;
  totalGold: number;
  shutdown: boolean;
  aimingSkill: AbilitySlot | null;
  chat: ChatMessage[];
  stats: { ad: number; ap: number; armor: number; mr: number; ms: number; aspd: number };
  pings: TacticalPing[];
  /** runas equipadas na partida atual */
  runes: { id: string; name: string; desc: string; color: string; slot: string }[];
  /** pilhas de runa ativas (ex.: Fúria do Conquistador) */
  runeStacks: { key: string; label: string; color: string; stacks: number }[];
  /** evento global ativo, se houver */
  event: { kind: string; name: string; desc: string; icon: string; color: string; remaining: number; total: number } | null;
  /** segundos até o próximo evento global */
  nextEventIn: number;
  // ===== DOTA: MECÂNICA DE BUYBACK (COMPRA DE VOLTA) =====
  buybackCost: number;
  buybackCd: number;
  canBuyback: boolean;
}

const BUFF_META: Record<string, { label: string; color: string }> = {
  speed: { label: '⚡ Velocidade', color: '#5ad0c0' }, slow: { label: '🐌 Lentidão', color: '#6a8ac8' },
  stun: { label: '💫 Atordoado', color: '#ffd040' }, root: { label: '🔒 Enraizado', color: '#a060e0' },
  silence: { label: '🔇 Silêncio', color: '#c08090' }, fear: { label: '😱 Apavorado', color: '#b080e0' },
  bleed: { label: '🩸 Sangrando', color: '#e05050' }, poison: { label: '☠️ Veneno', color: '#80c050' },
  shield: { label: '🛡️ Escudo', color: '#e8e8f0' }, bshield: { label: '🛡️ Escudo Negro', color: '#8080c0' },
  invuln: { label: '✨ Invulnerável', color: '#ffd840' }, bluebuff: { label: '🔵 Sentinela Azul', color: '#60a0ff' },
  redbuff: { label: '🔴 Bruto Rubro', color: '#ff7050' }, baron: { label: '👑 Barão', color: '#c080ff' },
  invis: { label: '👁️ Oculto', color: '#a0c0b0' }, blind: { label: '🙈 Cego', color: '#c0c080' },
  dr: { label: '🛡️ Resistência', color: '#e8c860' }, aspd: { label: '⚔️ Vel. Ataque', color: '#f0a050' },
  wuju: { label: '⚔️ Estilo Wuju', color: '#b8e0d0' }, highlanderR: { label: '🔥 Highlander', color: '#f0d060' },
  meditate: { label: '🧘 Meditando', color: '#90d090' }, lotus: { label: '🗡️ Lótus', color: '#e0e8f0' },
  spin: { label: '🌀 Julgamento', color: '#d0e0f0' }, decisive: { label: '💥 Golpe Decisivo', color: '#e8c860' },
  cripple: { label: '💢 Mutilante', color: '#ff8070' }, powerfist: { label: '🤜 Punho de Força', color: '#ffd040' },
  toxic: { label: '☠️ Tóxico', color: '#a0e050' }, despower: { label: '⚡ Dessecado', color: '#b090ff' },
  moltenshield: { label: '🔥 Fundido', color: '#ff9060' }, spellshield: { label: '🔮 Véu', color: '#70b8ff' },
  prowl: { label: '🐆 Prowl', color: '#e8c860' }, minigun: { label: '🔫 Minigun', color: '#e0a040' },
  rocket: { label: '🚀 Foguete', color: '#e04040' }, windwall: { label: '💨 Parede', color: '#c0f0ff' },
  glacialfence: { label: '🛡️ Glacial', color: '#a0d0e0' }, puma: { label: '🐆 Puma', color: '#e8c860' },
  grievous: { label: '🩸 Grevious', color: '#c04040' }, exhaust: { label: '☠ Esgotado', color: '#c0a060' },
  frozenstrike: { label: '❄️ Congelante', color: '#a0d0e0' }, shadowmarkdot: { label: '🩸 Marca', color: '#c04040' },
  wyvernbuff: { label: '🦅 Cinzas da Wyvern', color: '#ff8040' }, heraldbuff: { label: '⚔️ Bênção do Arauto', color: '#c080ff' },
  // ===== DOTA: RUNAS DE PODER =====
  dd: { label: '⚔ Dano Duplo', color: '#ff4040' },
  haste: { label: '⚡ Super Velocidade', color: '#5ad0c0' },
  regen: { label: '💧 Regeneração', color: '#60ffa0' },
};

let UID = 1;

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  mini: HTMLCanvasElement | null; mctx: CanvasRenderingContext2D | null = null;
  ground: HTMLCanvasElement | null = null;
  units: Unit[] = []; heroes: Unit[] = []; projs: Projectile[] = []; zones: Zone[] = []; fx: FX[] = [];
  player!: Unit;
  camX = 0; camY = 0; camLock = true;
  camZoom = 1; // 0.6 a 1.4
  // ===== RUNAS =====
  runePage: RunePage = DEFAULT_RUNE_PAGE;
  runeStats = runeStats(DEFAULT_RUNE_PAGE);
  runeSet: Set<string> = runeKeys(DEFAULT_RUNE_PAGE);
  // ===== EVENTOS GLOBAIS =====
  activeEvent: ActiveEvent | null = null;
  nextEventAt = 120;              // primeiro evento aos 2 minutos
  lastEventKind: EventKind | undefined = undefined;
  eventMods = eventModifiers(null);
  t = 0; waveT = 10; result: 'win' | 'lose' | null = null;
  mouse = { x: 0, y: 0, inside: false };
  feed: { t: number; text: string; team: Team }[] = [];
  delayed: { at: number; fn: () => void }[] = [];
  raf = 0; last = 0; snapCb: (s: Snapshot) => void; snapT = 0;
  hawkPing: { x: number; y: number; until: number } | null = null;
  onDestroy: (() => void)[] = [];
  shopOpen = false;
  aMovePending = false;
  difficulty: 'easy' | 'normal' | 'hard' = 'normal';
  // skins: heroId -> look resolvido (aplica skin se equipada)
  heroLooks: Record<string, HeroDef['look']> = {};
  // skins: heroId -> mods visuais (rastro/aura/partículas)
  heroSkinMods: Record<string, { trail: string; particle: string; aura: string }> = {};
  banner: { text: string; sub: string; color: string; until: number; id: number } | null = null;
  bannerId = 0;
  firstBlood = false;
  shakeT = 0; shakeM = 0;
  // efeitos de tela cheia (tinta/vinheta/flash para ultimates)
  screenFx: { color: string; until: number; dur: number; intensity: number; vignette: boolean }[] = [];
  hitStop = 0; // pausa microscópica em golpes fortes (fighting game juice)
  // ===== DOTA: RUNAS DE PODER DO RIO =====
  riverRunes: { x: number; y: number; kind: 'dd' | 'haste' | 'invis' | 'regen'; until: number }[] = [];
  nextRuneAt = 120; // primeira runa aos 2 minutos
  // ===== CAMADA AMBIENTE (vagalumes e cintilações do rio) =====
  ambient: { x: number; y: number; type: 0 | 1; phase: number; speed: number }[] = [];
  fog = new FogOfWar();
  wards: Ward[] = [];
  chatLog: ChatMessage[] = [];
  pings: TacticalPing[] = [];
  multiKills: Map<number, { count: number; lastTime: number }> = new Map();
  channel: BroadcastChannel | null = null;
  dragonNextRespawn = 0;
  baronNextRespawn = 0;
  // skill em modo de mira: aguarda clique para conjurar (mostra indicador)
  aimingSkill: AbilitySlot | null = null;
  // conjuração rápida (smart cast): tecla dispara direto no cursor
  smartCast = false;

  /**
   * Classifica o tipo de indicador de mira de uma habilidade pela descrição:
   * - 'line'   → skillshot linear (projétil, feixe)
   * - 'circle' → área com raio fixo (AoE no chão)
   * - 'cone'   → cone à frente do lançador
   * - 'target' → alvo único (mira automática)
   * - 'self'   → conjura em si mesmo (sem mira)
   */
  aimTypeOf(ab: AbilityDef): 'line' | 'circle' | 'cone' | 'target' | 'self' {
    const d = ab.desc.toLowerCase();
    const k = ab.key.toLowerCase();
    // skillshots lineares
    if (k.includes('shot') || k.includes('bolt') || k.includes('arrow') || k.includes('spear') || k.includes('rocket') || k.includes('laser') || k.includes('beam') || k.includes('bindin') || k.includes('grab') || k.includes('hook') || k.includes('lance') || k.includes('dart') || k.includes('blade') || k.includes('scrapshot')) return 'line';
    if (d.includes('dispara') || d.includes('lança um') || d.includes('lança uma') || d.includes('flecha') || d.includes('projétil') || d.includes('em linha') || d.includes('perfur') || d.includes('atinge todos no caminho') || d.includes('linha reta')) return 'line';
    // cones
    if (k.includes('cone') || k.includes('cleave') || d.includes('em cone') || d.includes('cone de') || d.includes('em leque') || d.includes('leque de') || d.includes('rajada de vento')) return 'cone';
    // AoE circular no chão (mira o solo)
    if (d.includes('no chão') || d.includes('no solo') || d.includes('planta') || d.includes('cria uma zona') || d.includes('cria um cristal') || d.includes('cria uma barreira') || d.includes('parede') || d.includes('meteor') || d.includes('poça') || d.includes('cria uma nuvem') || d.includes('cria uma armadilha') || d.includes('cria um redemoinho') || d.includes('faz chover') || d.includes('cria uma poça')) return 'circle';
    // conjuração em si mesmo
    if (ab.range === 0 && (d.includes('ao redor') || d.includes('em volta') || d.includes('reduz o dano recebido') || d.includes('escudo em si') || d.includes('cobre-se') || d.includes('reveste-se') || d.includes('recolhe-se') || d.includes('transforma-se') || d.includes('canaliza') || d.includes('canta'))) return 'self';
    // circle padrão para AoEs
    if (d.includes('em área') || d.includes('em uma área') || d.includes('área')) return 'circle';
    // caso contrário, alvo único
    return 'target';
  }
  // slots de itens ativos (índice do item no inventário)
  activeSlots: { slot: number; cd: number; cdMax: number; key: string }[] = [];
  // slots de feitiços (índices 0 e 1 do array summoners)
  summonerSlots: { id: string; cd: number; cdMax: number }[] = [];
  // configuração de feitiços do jogador (setada antes da partida)
  playerSummoners: string[] = ['flash', 'ignite'];
  modeRules: GameModeDef = { id: 'classic', name: 'Conquista 5v5', description: '', mapId: 'rift', teamSize: 5, startingGold: 475, waveInterval: 30, maxLevel: 18, passiveGoldRate: 2.4, respawnScale: 1 };
  mapPreset: MapPresetDef = { id: 'rift', name: 'Rift Clássico', description: '', theme: 'forest', ambientColor: '#5b8d55', fogOpacity: 0.68, riverColor: '#5a9cc5', laneColor: '#9c835c', forestColor: '#345a38' };

  constructor(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null, heroId: string, snapCb: (s: Snapshot) => void, difficulty: 'easy' | 'normal' | 'hard' = 'normal', modeRules?: GameModeDef, mapPreset?: MapPresetDef) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!;
    this.mini = mini; if (mini) this.mctx = mini.getContext('2d');
    this.difficulty = difficulty;
    if (modeRules) this.modeRules = modeRules;
    if (mapPreset) this.mapPreset = mapPreset;
    this.waveT = Math.min(10, this.modeRules.waveInterval);
    this.snapCb = snapCb;
    this.buildMap();
    this.spawnHeroes(heroId);
    this.prerenderGround();
    this.initAmbient();
    this.bindInput();
    this.camX = this.player.x; this.camY = this.player.y;
    this.last = performance.now();
    // configura feitiços do jogador
    this.player.summoners = this.playerSummoners;
    for (let i = 0; i < 2; i++) this.summonerSlots.push({ id: this.playerSummoners[i], cd: 0, cdMax: SUMMONERS[this.playerSummoners[i]].cd });
    // feitiços dos bots (flash obrigatório + 1 aleatório)
    const pool = ['ignite', 'heal', 'exhaust', 'barrier', 'teleport', 'clarity'];
    for (const h of this.heroes) {
      if (h === this.player) continue;
      const extra = pool[Math.floor(Math.random() * pool.length)];
      h.summoners = ['flash', extra];
    }
    // marca o jungler (5º herói de cada time)
    const allyJg = this.heroes.filter(h => h.team === 0)[4];
    const enemyJg = this.heroes.filter(h => h.team === 1)[4];
    if (allyJg) { allyJg.isJungler = true; allyJg.summoners = ['flash', 'smite']; }
    if (enemyJg) { enemyJg.isJungler = true; enemyJg.summoners = ['flash', 'smite']; }
    try {
      this.channel = new BroadcastChannel('pixelrift_match_sync');
      this.channel.onmessage = (e) => {
        if (e.data?.type === 'chat') {
          this.chatLog.push(e.data.msg);
          if (this.chatLog.length > 20) this.chatLog.shift();
        }
        if (e.data?.type === 'ping') {
          this.pings.push(e.data.ping);
          sfx.ping();
        }
      };
    } catch { /* sem canal */ }
    this.postChat('Sistema', 'A partida começou! Boa sorte no Rift.', 0);
    const loop = (now: number) => {
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      this.update(dt);
      this.render();
      this.snapT -= dt;
      if (this.snapT <= 0) { this.snapT = 0.12; this.snapCb(this.snapshot()); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() { cancelAnimationFrame(this.raf); this.onDestroy.forEach(f => f()); try { this.channel?.close(); } catch { /* ignore */ } }

  postChat(sender: string, text: string, team: Team) {
    const msg: ChatMessage = { sender, hero: sender, team, text, time: this.t };
    this.chatLog.push(msg);
    if (this.chatLog.length > 20) this.chatLog.shift();
    try { this.channel?.postMessage({ type: 'chat', msg }); } catch { /* ignore */ }
  }

  sendPing(x: number, y: number, kind: 'danger' | 'omw' | 'missing' | 'assist' = 'danger') {
    const ping: TacticalPing = { x, y, kind, sender: this.player.name, team: this.player.team as Team, until: this.t + 4 };
    this.pings.push(ping);
    sfx.ping();
    const names = { danger: '⚠️ Perigo', omw: '🏃 A Caminho', missing: '❓ Inimigo Desaparecido', assist: '🆘 Preciso de Ajuda' };
    this.postChat(this.player.name, `Ping: ${names[kind]}`, this.player.team as Team);
    try { this.channel?.postMessage({ type: 'ping', ping }); } catch { /* ignore */ }
  }

  // ---------- construção ----------
  baseUnit(): Unit {
    return {
      id: UID++, kind: 'minion', team: 0, x: 0, y: 0, r: 14, hp: 100, maxHp: 100, mp: 0, maxMp: 0,
      ad: 10, ap: 0, armor: 0, mr: 0, aspd: 0.7, ms: 90, crit: 0, lifesteal: 0, mpen: 0, hpRegen: 0, mpRegen: 0,
      atkRange: 50, atkCd: 0, dead: false, buffs: [], lastCombat: -99, facing: 1, animT: 0,
      moveTgt: null, attackTgt: null, flashT: 0, stuckT: 0, lastX: 0, lastY: 0, fountainT: 0,
      attackMove: false, retalTgt: null, retalT: -99, castT: -99, attackAnimT: -99,
      level: 1, xp: 0, gold: 0, items: [],
      cds: { Q: 0, W: 0, E: 0, R: 0 }, spellCount: 0, hitCount: 0, kills: 0, deaths: 0, assists: 0, cs: 0,
      respawnT: 0, isBot: true, buildIdx: 0, recallT: -1, recentDmg: new Map(), barrierCd: 0, activeCd: 0,
      aiT: Math.random() * 0.4, name: '',
      skillPoints: 0, skillLv: { Q: 0, W: 0, E: 0, R: 0 },
      summoners: ['flash', 'ignite'], summonerCd: {},
      bounty: 300, killsStreak: 0, deathsStreak: 0,
      baseExitT: 0, isJungler: false, smiteCd: 0, wardCd: 0, leftBase: false,
      electrocuteCd: 0, cometCd: 0, aftershockCd: 0,
      buybackCd: 0,
      ghostHp: 0, ghostT: 0,
    };
  }

  buildMap() {
    for (const ts of TOWERS) {
      const u = this.baseUnit();
      u.kind = 'tower'; u.team = ts.team; u.x = ts.x; u.y = ts.y; u.r = 22;
      u.maxHp = u.hp = ts.tier <= 1 ? 3000 : ts.tier === 2 ? 3300 : 3800;
      u.ad = 170 + ts.tier * 15; u.atkRange = 270; u.aspd = 0.83; u.armor = 40; u.mr = 40;
      u.tier = ts.tier; u.towerLane = ts.lane; u.name = 'Torre';
      this.units.push(u);
    }
    for (const is of INHIBS) {
      const u = this.baseUnit();
      u.kind = 'inhib'; u.team = is.team; u.x = is.x; u.y = is.y; u.r = 20;
      u.maxHp = u.hp = 3000; u.armor = 30; u.mr = 30; u.towerLane = is.lane; u.name = 'Inibidor';
      this.units.push(u);
    }
    for (const n of NEXUS) {
      const u = this.baseUnit();
      u.kind = 'nexus'; u.team = n.team; u.x = n.x; u.y = n.y; u.r = 30;
      u.maxHp = u.hp = 5500; u.armor = 30; u.mr = 30; u.name = 'Nexus';
      this.units.push(u);
    }
    for (const c of CAMPS) this.spawnCamp(c.type, c.x, c.y);
  }

  spawnCamp(type: string, x: number, y: number) {
    const u = this.baseUnit();
    u.kind = 'monster'; u.team = 2; u.x = x; u.y = y; u.campType = type; u.campHome = [x, y];
    // Balanceamento por ordem de dificuldade da selva.
    // Buffs (blue/red) = epic no início; krugs = mais forte da selva normal;
    // crab = scuttle fácil; épicos = rota do rio.
    const S: Record<string, [number, number, number, string]> = {
      gromp: [1150, 62, 20, 'Gromp'],
      blue: [1750, 78, 26, 'Sentinela Azul'],
      wolves: [1100, 58, 18, 'Lobo Ancião'],
      raptors: [950, 52, 16, 'Raptor Carmesim'],
      red: [1750, 80, 26, 'Bruto Rubro'],
      krugs: [1300, 66, 20, 'Krug Ancestral'],
      crab: [550, 28, 18, 'Caranguejo Escúter'],
      // monstros épicos do rio
      wyvern: [2600, 90, 26, 'Wyvern das Cinzas'],
      riftherald: [4600, 160, 40, 'Arauto da Fenda'],
      dragon: [3600, 125, 34, 'Dragão'],
      baron: [5800, 200, 40, 'Barão Na\'Karth'],
    };
    const [hp, ad, r, name] = S[type] ?? S.gromp;
    u.maxHp = u.hp = hp; u.ad = ad; u.r = r; u.atkRange = r + 40; u.aspd = 0.6; u.ms = 85;
    u.armor = 20; u.mr = 20; u.name = name;
    // monstros épicos têm mais resistência (proporcional ao poder)
    if (type === 'wyvern') { u.armor = 30; u.mr = 30; }
    else if (type === 'riftherald') { u.armor = 45; u.mr = 45; }
    else if (type === 'dragon') { u.armor = 40; u.mr = 40; }
    else if (type === 'baron') { u.armor = 60; u.mr = 60; u.ad = 200; }
    this.units.push(u);
  }

  /** Registra as skins equipadas pelo jogador (heroId -> skinId). */
  /** Define a página de runas do jogador (antes ou durante a partida). */
  setRunePage(page: RunePage) {
    this.runePage = page;
    this.runeStats = runeStats(page);
    this.runeSet = runeKeys(page);
    if (this.player) this.applyHeroStats(this.player);
  }

  /** Verifica se o jogador possui uma runa ativa. */
  hasRune(key: string) { return this.runeSet.has(key); }

  /** Atualiza o ciclo de eventos globais da partida. */
  updateEvents() {
    // encerra evento expirado
    if (this.activeEvent && this.t >= this.activeEvent.endsAt) {
      const ended = this.activeEvent.def;
      this.activeEvent = null;
      this.eventMods = eventModifiers(null);
      this.announce(`${ended.icon} EVENTO ENCERRADO`, ended.name, '#8aa0a8');
      for (const h of this.heroes) this.applyHeroStats(h);
      this.nextEventAt = this.t + 90 + Math.random() * 60;
    }
    // inicia novo evento
    if (!this.activeEvent && this.t >= this.nextEventAt) {
      const def = pickEvent(this.t, this.lastEventKind);
      if (def) {
        this.activeEvent = { kind: def.kind, def, startedAt: this.t, endsAt: this.t + def.duration };
        this.lastEventKind = def.kind;
        this.eventMods = eventModifiers(this.activeEvent);
        this.announce(`${def.icon} ${def.name.toUpperCase()}`, def.desc, def.color);
        this.screenFlash(def.color, 0.8, 0.35);
        this.shake(5, 0.4);
        sfx.objective();
        for (const h of this.heroes) this.applyHeroStats(h);
      } else {
        this.nextEventAt = this.t + 30;
      }
    }
  }

  /** Atualiza o ciclo de spawn e colisões das Runas de Poder do Rio do Dota. */
  updateRiverRunes() {
    // Spawn periódico a cada 2 minutos
    if (this.t >= this.nextRuneAt) {
      this.nextRuneAt = this.t + 120;
      // Escolhe um lado do rio aleatório (superior ou inferior)
      const isTop = Math.random() < 0.5;
      const x = isTop ? 1175 : 1750;
      const y = isTop ? 1175 : 1750;
      const kinds: ('dd' | 'haste' | 'invis' | 'regen')[] = ['dd', 'haste', 'invis', 'regen'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      
      this.riverRunes.push({ x, y, kind, until: this.t + 90 }); // dura 90s se não for coletada
      
      const names = { dd: 'Dano Duplo', haste: 'Super Velocidade', invis: 'Invisibilidade', regen: 'Regeneração' };
      this.announce('🌌 RUNA DO RIO', `Uma Runa de ${names[kind]} surgiu no rio!`, '#5ad0c0');
      sfx.ping();
    }

    // Limpa expiradas
    this.riverRunes = this.riverRunes.filter(r => r.until > this.t);

    // Detecção de colisão do herói com a runa (coleta)
    for (const h of this.heroes.filter(x => !x.dead)) {
      for (let i = 0; i < this.riverRunes.length; i++) {
        const r = this.riverRunes[i];
        if (dist(h.x, h.y, r.x, r.y) < h.r + 20) {
          this.riverRunes.splice(i, 1);
          i--;
          
          // Aplica os efeitos clássicos de Dota!
          if (r.kind === 'dd') {
            this.addBuff(h, 'dd', 15); // +100% AD por 15s
            this.text(h.x, h.y - 46, 'DANO DUPLO!', '#ff4040');
          } else if (r.kind === 'haste') {
            this.addBuff(h, 'haste', 15); // velocidade máxima por 15s
            this.text(h.x, h.y - 46, 'SUPER VELOCIDADE!', '#5ad0c0');
          } else if (r.kind === 'invis') {
            this.addBuff(h, 'invis', 20); // invisibilidade por 20s
            this.text(h.x, h.y - 46, 'INVISÍVEL!', '#a0c0b0');
          } else if (r.kind === 'regen') {
            this.addBuff(h, 'regen', 10); // regeneração de vida/mana por 10s (cancela ao sofrer dano)
            this.text(h.x, h.y - 46, 'REGENERAÇÃO!', '#60ffa0');
          }
          
          this.fx.push({ kind: 'ringBurst', x: h.x, y: h.y, r: 50, until: this.t + 0.4, dur: 0.4, color: '#5ad0c0' });
          sfx.levelup();
          this.applyHeroStats(h);
          break;
        }
      }
    }
  }

  /** Inicializa partículas ambiente: vagalumes na selva e cintilâncias no rio. */
  initAmbient() {
    let seed = 4242;
    const rndA = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.ambient = [];
    // vagalumes espalhados pelo mapa (mais densos na selva escura)
    for (let i = 0; i < 90; i++) {
      const x = rndA() * WORLD, y = rndA() * WORLD;
      const riverDist = Math.abs(x - y) / Math.SQRT2; // distância aproximada à diagonal do rio
      if (riverDist < 150) continue; // evita sobrepor o rio
      this.ambient.push({ x, y, type: 0, phase: rndA() * Math.PI * 2, speed: 0.5 + rndA() * 0.8 });
    }
    // cintilações ao longo do rio
    for (let i = 0; i < 40; i++) {
      const t = i / 39;
      const p0 = RIVER[Math.floor(t * (RIVER.length - 1))];
      const p1 = RIVER[Math.min(RIVER.length - 1, Math.floor(t * (RIVER.length - 1)) + 1)];
      const lt = (t * (RIVER.length - 1)) % 1;
      const x = p0[0] + (p1[0] - p0[0]) * lt + (rndA() - 0.5) * 120;
      const y = p0[1] + (p1[1] - p0[1]) * lt + (rndA() - 0.5) * 120;
      this.ambient.push({ x, y, type: 1, phase: rndA() * Math.PI * 2, speed: 1.2 + rndA() * 1.4 });
    }
  }

  /** Atualiza as fases das partículas ambiente (barato, sem estado por frame). */
  updateAmbient(dt: number) {
    for (const a of this.ambient) a.phase += a.speed * dt;
  }

  /** Desenha a camada ambiente entre o terreno e a névoa de guerra. */
  drawAmbient() {
    const { ctx } = this;
    const vw = this.canvas.width, vh = this.canvas.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of this.ambient) {
      const dx = Math.sin(a.phase) * 20;
      const dy = Math.cos(a.phase * 1.3) * 14;
      const [sx, sy] = this.worldToScreen(a.x + dx, a.y + dy);
      if (sx < -16 || sy < -16 || sx > vw + 16 || sy > vh + 16) continue;
      const twinkle = 0.3 + Math.sin(a.phase * 2.1) * 0.25;
      if (a.type === 0) {
        // vagalume: núcleo + halo retangular barato
        ctx.globalAlpha = twinkle * 0.5;
        ctx.fillStyle = '#c8ff80';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#e8ffc0';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      } else {
        // cintilância do rio
        ctx.globalAlpha = twinkle * 0.7;
        ctx.fillStyle = '#a8ecff';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }
    ctx.restore();
  }

  setEquippedSkins(map: Record<string, string>) {
    for (const [heroId, skinId] of Object.entries(map)) {
      const skin = SKIN_BY_ID[skinId];
      const hero = HERO_BY_ID[heroId];
      if (skin && hero) {
        this.heroLooks[heroId] = applySkin(hero.look, skin);
        this.heroSkinMods[heroId] = {
          trail: skin.mods?.trailColor ?? '#f0e8c0',
          particle: skin.mods?.particleColor ?? '#f0e0b0',
          aura: skin.mods?.auraColor ?? skin.mods?.glowColor ?? '',
        };
      }
    }
  }

  spawnHeroes(playerHeroId: string) {
    const others = HEROES.filter(h => h.id !== playerHeroId);
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    const teamSize = Math.max(1, Math.min(5, this.modeRules.teamSize));
    const allyDefs = [HERO_BY_ID[playerHeroId], ...shuffled.slice(0, teamSize - 1)];
    const enemyDefs = shuffled.slice(teamSize - 1, teamSize * 2 - 1);
    const lanes: ('top' | 'mid' | 'bot')[] = ['mid', 'top', 'bot', 'bot', 'top'].slice(0, teamSize) as ('top' | 'mid' | 'bot')[];
    allyDefs.forEach((d, i) => this.addHero(d, 0, lanes[i], i === 0));
    enemyDefs.forEach((d, i) => this.addHero(d, 1, lanes[i], false));
  }

  addHero(def: HeroDef, team: Team, lane: 'top' | 'mid' | 'bot', isPlayer: boolean) {
    const u = this.baseUnit();
    u.kind = 'hero'; u.def = def; u.team = team; u.isBot = !isPlayer; u.lane = lane;
    const [fx0, fy0] = FOUNTAINS[team];
    u.x = fx0 + rnd(-40, 40); u.y = fy0 + rnd(-40, 40);
    u.r = 16; u.gold = this.modeRules.startingGold; u.level = 1; u.name = def.name;
    // JOGADOR: começa sem habilidades e com 1 ponto — ESCOLHE Q/W/E como primeira
    // BOTS: pegam Q automaticamente
    u.skillLv = { Q: 0, W: 0, E: 0, R: 0 };
    u.skillPoints = isPlayer ? 1 : 0;
    if (!isPlayer) u.skillLv.Q = 1; // bots têm Q automático
    this.applyHeroStats(u); u.hp = u.maxHp; u.mp = u.maxMp;
    this.units.push(u); this.heroes.push(u);
    if (isPlayer) this.player = u;
  }

  applyHeroStats(u: Unit) {
    const d = u.def!; const L = u.level - 1;
    let hp = d.hp + d.hpG * L, mp = d.mp + d.mpG * L, ad = d.ad + d.adG * L, ap = 0;
    let armor = d.armor + d.armorG * L, mr = d.mr + d.mrG * L, aspd = d.as + d.asG * L;
    let ms = d.ms, crit = 0, ls = 0, mpen = 0, hpR = d.hpRegen, mpR = d.mpRegen;
    for (const id of u.items) {
      const s = ITEM_BY_ID[id].stats;
      hp += s.hp ?? 0; mp += s.mp ?? 0; ad += s.ad ?? 0; ap += s.ap ?? 0;
      armor += s.armor ?? 0; mr += s.mr ?? 0; aspd += d.as * (s.as ?? 0); ms += s.ms ?? 0;
      crit += s.crit ?? 0; ls += s.lifesteal ?? 0; mpen += s.mpen ?? 0; hpR += s.hpRegen ?? 0; mpR += s.mpRegen ?? 0;
    }
    if (u.items.includes('deathcap')) ap *= 1.3;
    // ===== RUNAS: bônus estáticos (somente para o jogador) =====
    if (u === this.player) {
      const rs = this.runeStats;
      hp += rs.hp; ad += rs.ad; ap += rs.ap; armor += rs.armor; mr += rs.mr;
      ms += rs.ms; aspd += d.as * rs.as; crit += rs.crit; ls += rs.lifesteal;
      mpen += rs.mpen; hpR += rs.hpRegen; mpR += rs.mpRegen;
      // Conquistador: cada pilha de Fúria dá +3 AD e AP
      const fury = this.getBuff(u, 'conquerorStacks');
      if (fury) { ad += (fury.stacks ?? 0) * 3; ap += (fury.stacks ?? 0) * 3; }
      // Pós-Choque: resistências temporárias
      if (this.hasBuff(u, 'aftershock')) { armor += 35; mr += 35; }
    }
    // ===== EVENTO GLOBAL: Vontade de Ferro =====
    const ev = this.eventMods;
    if (ev.resistBonus && u.kind === 'hero') { armor += ev.resistBonus; mr += ev.resistBonus; }
    // ===== DOTA: RUNAS DE PODER =====
    if (this.hasBuff(u, 'dd')) ad *= 2;
    if (this.hasBuff(u, 'haste')) ms *= 1.5;

    const hpFrac = u.maxHp > 0 ? u.hp / u.maxHp : 1;
    const mpFrac = u.maxMp > 0 ? u.mp / u.maxMp : 1;
    u.maxHp = hp; u.maxMp = mp; u.hp = hp * hpFrac; u.mp = mp * mpFrac;
    u.ad = ad; u.ap = ap; u.armor = armor; u.mr = mr; u.aspd = Math.min(2.5, aspd);
    u.ms = ms; u.crit = Math.min(100, crit); u.lifesteal = ls; u.mpen = Math.min(0.6, mpen);
    u.hpRegen = hpR; u.mpRegen = mpR;
  }

  // ---------- buffs ----------
  addBuff(u: Unit, key: string, dur: number, v = 0, src?: Unit, data?: any) {
    if (['stun', 'root', 'slow', 'fear', 'silence', 'blind'].includes(key)) {
      if (this.hasBuff(u, 'bshield') || this.hasBuff(u, 'invuln')) return;
      if (!this.hasBuff(u, key)) {
        const labels: Record<string, string> = { stun: 'STUN!', root: 'SNARE!', silence: 'SILÊNCIO!', fear: 'MEDO!', blind: 'CEGO!' };
        if (labels[key]) this.text(u.x, u.y - 45, labels[key], '#ff4040');
      }
      // ===== RUNA PÓS-CHOQUE: aplicar CC concede resistências + explosão =====
      const p = this.player;
      if (p && src === p && ['stun', 'root', 'fear', 'silence'].includes(key) && this.t > p.aftershockCd) {
        p.aftershockCd = this.t + 18;
        this.addBuff(p, 'aftershock', 2.5);
        this.applyHeroStats(p);
        this.fx.push({ kind: 'ringBurst', x: p.x, y: p.y, r: 70, until: this.t + 0.5, dur: 0.5, color: '#ffc040' });
        this.fx.push({ kind: 'nova', x: p.x, y: p.y - 10, r: 60, until: this.t + 0.4, dur: 0.4, color: '#ffc040' });
        this.text(p.x, p.y - 56, 'PÓS-CHOQUE!', '#ffc040');
        // explosão mágica ao redor
        this.delayed.push({
          at: this.t + 2.5, fn: () => {
            if (p.dead) return;
            const dmg = 40 + p.level * 10 + p.maxHp * 0.05;
            for (const e of this.units.filter(x => !x.dead && x.team !== p.team && !['tower', 'inhib', 'nexus'].includes(x.kind) && dist(x.x, x.y, p.x, p.y) < 130)) {
              this.dealDamage(p, e, dmg, 'magic', { ability: true });
            }
            this.fx.push({ kind: 'explosion', x: p.x, y: p.y, r: 120, until: this.t + 0.5, dur: 0.5, color: '#ffc040' });
            this.applyHeroStats(p);
          },
        });
      }
    }
    const ex = u.buffs.find(b => b.key === key && key !== 'bleed');
    if (ex) { ex.until = Math.max(ex.until, this.t + dur); ex.v = v; ex.src = src; ex.data = data ?? ex.data; return; }
    u.buffs.push({ key, until: this.t + dur, v, src, tickT: 0, stacks: 1, data });
  }
  hasBuff(u: Unit, key: string) { return u.buffs.some(b => b.key === key); }
  getBuff(u: Unit, key: string) { return u.buffs.find(b => b.key === key); }
  isStunned(u: Unit) { return u.buffs.some(b => b.key === 'stun' || b.key === 'fear'); }

  speedOf(u: Unit): number {
    let ms = u.ms;
    for (const b of u.buffs) {
      if (b.key === 'speed') ms *= 1 + (b.v ?? 0);
      if (b.key === 'slow') ms *= 1 - (b.v ?? 0);
      if (b.key === 'wyvernbuff') ms *= 1.08;
    }
    return ms;
  }
  aspdOf(u: Unit): number {
    let a = u.aspd;
    for (const b of u.buffs) {
      if (b.key === 'aspd') a *= 1 + (b.v ?? 0);
      if (b.key === 'wyvernbuff') a *= 1.1;
    }
    return Math.min(3, a);
  }

  // ---------- movimento com desvio de paredes + anti-travamento ----------
  moveToward(u: Unit, tx: number, ty: number, dt: number, ghost = false): boolean {
    const d = dist(u.x, u.y, tx, ty);
    if (d < 5) return true;
    const spd = this.speedOf(u) * dt;
    const dx = (tx - u.x) / d, dy = (ty - u.y) / d;
    let [nx, ny] = tryMove(u.x, u.y, u.x + dx * spd, u.y + dy * spd, ghost);
    const moved = dist(nx, ny, u.x, u.y);
    if (moved < spd * 0.3) {
      u.stuckT += dt;
      if (u.stuckT > 0.35) {
        u.stuckT = 0;
        // desliza na perpendicular
        let escaped = false;
        for (const s of [1, -1]) {
          const [px, py] = tryMove(u.x, u.y, u.x - dy * s * spd * 3, u.y + dx * s * spd * 3, ghost);
          if (dist(px, py, u.x, u.y) > spd * 0.5) { nx = px; ny = py; escaped = true; break; }
        }
        if (!escaped) {
          const [ex, ey] = nearestWalkable(u.x + dx * 50 + rnd(-40, 40), u.y + dy * 50 + rnd(-40, 40));
          if (dist(ex, ey, u.x, u.y) < 120) { nx = ex; ny = ey; }
        }
      }
    } else u.stuckT = 0;
    if (nx !== u.x || ny !== u.y) {
      u.x = nx; u.y = ny;
      if (Math.abs(dx) > 0.2) u.facing = dx >= 0 ? 1 : -1;
      return true;
    }
    return false;
  }

  // ---------- dano ----------
  dealDamage(src: Unit, dst: Unit, amount: number, type: 'phys' | 'magic' | 'true', opts: { attack?: boolean; ability?: boolean } = {}) {
    if (dst.dead || this.hasBuff(dst, 'invuln')) return 0;
    if (opts.ability && dst.kind === 'hero') {
      const ss = this.getBuff(dst, 'spellshield');
      if (ss) { dst.buffs = dst.buffs.filter(b => b !== ss); this.text(dst.x, dst.y - 30, 'Bloqueado!', '#70b8ff'); return 0; }
    }
    let dmg = amount;
    // ===== EVENTO GLOBAL: Lua Sangrenta aumenta todo o dano =====
    dmg *= this.eventMods.damageMul;
    // ===== RUNA: Matador de Gigantes =====
    if (src === this.player && this.hasRune('giantslayer') && dst.maxHp > src.maxHp) {
      const excess = Math.min(1, (dst.maxHp - src.maxHp) / src.maxHp);
      dmg *= 1 + excess * 0.1;
    }
    if (type === 'phys') dmg *= 100 / (100 + Math.max(0, dst.armor));
    if (type === 'magic') {
      const mr = Math.max(0, dst.mr * (1 - (src.mpen ?? 0)));
      dmg *= 100 / (100 + mr);
    }
    for (const b of dst.buffs) if (b.key === 'dr') dmg *= 1 - (b.v ?? 0);
    // Máscara Abissal: inimigos próximos ao portador sofrem +10% dano mágico
    if (type === 'magic' && src.items?.includes('abyssalmask') && dist(src.x, src.y, dst.x, dst.y) < 200) dmg *= 1.1;
    // Black Cleaver: reduz armadura
    if (opts.attack && src.items?.includes('blackcleaver')) {
      dst.armor = Math.max(0, dst.armor - dst.armor * 0.05);
    }
    if (this.hasBuff(dst, 'exhaust')) dmg *= 0.5;
    if (this.hasBuff(dst, 'grievous')) { /* cura reduzida é tratada no heal */ }
    if (opts.attack && dst.items?.includes('ninjatabi')) dmg *= 0.9;
    for (const b of dst.buffs) {
      if ((b.key === 'shield' || b.key === 'bshield') && (b.v ?? 0) > 0) {
        const abs = Math.min(b.v!, dmg); b.v! -= abs; dmg -= abs;
        if (b.v! <= 0) b.until = 0;
        if (dmg <= 0) break;
      }
    }
    // Buff do Arauto: +10% dano a estruturas
    if (this.hasBuff(src, 'heraldbuff') && ['tower', 'inhib', 'nexus'].includes(dst.kind)) dmg *= 1.1;
    // ===== BARRA DE DANO FANTASMA: registra o pico de vida na janela recente =====
    dst.ghostHp = Math.max(dst.ghostHp, dst.hp);
    dst.ghostT = 0.7;
    dst.hp -= dmg; dst.lastCombat = this.t; src.lastCombat = this.t;
    if (dmg > 2) dst.flashT = Math.max(dst.flashT, dmg > 200 ? 0.2 : dmg > 100 ? 0.15 : 0.12);
    // hit-stop: pausa microscópica em golpes fortes (estilo fighting game)
    if (dst.kind === 'hero' && dmg > dst.maxHp * 0.1) this.hitStop = Math.max(this.hitStop, 0.03);
    if (dst === this.player && dmg > this.player.maxHp * 0.12) this.hitStop = Math.max(this.hitStop, 0.04);
    if (dst.kind === 'hero' && src.kind === 'hero') dst.recentDmg.set(src.id, this.t);
    // retaliation: herói parado revida quem o atacou
    if (dst.kind === 'hero' && !dst.attackTgt && !dst.moveTgt && src.kind === 'hero' && src.team !== dst.team && !this.hasBuff(src, 'invis')) {
      dst.retalTgt = src; dst.retalT = this.t;
    }
    if (dst.kind === 'hero' && dst.def?.passive.key === 'manabarrier' && dst.hp < dst.maxHp * 0.2 && this.t > dst.barrierCd) {
      dst.barrierCd = this.t + 90; this.addBuff(dst, 'shield', 6, dst.mp * 0.5);
      this.text(dst.x, dst.y - 34, 'Barreira de Mana!', '#60c0ff');
      this.sparks(dst.x, dst.y - 10, '#60c0ff', 8, 120);
    }
    if (opts.attack && dst.items?.includes('thornmail') && !src.dead) {
      src.hp -= dmg * 0.25 * (100 / (100 + src.mr));
      if (src.hp <= 0) this.kill(dst, src);
    }
    if (dst.kind === 'hero' || src === this.player || dst === this.player || dmg > 60) {
      this.text(dst.x + rnd(-12, 12), dst.y - 34, String(Math.round(dmg)),
        type === 'true' ? '#ffffff' : type === 'magic' ? '#c090ff' : '#ffb060');
    }
    if (opts.ability && src.kind === 'hero' && src.def?.passive.key === 'soulsiphon') {
      src.hp = Math.min(src.maxHp, src.hp + dmg * 0.2);
    }
    // tremor de tela quando o jogador apanha forte
    if (dst === this.player && dmg > this.player.maxHp * 0.08) this.shake(4, 0.25);
    if (dst.hp <= 0) this.kill(src, dst);
    return dmg;
  }

  heal(u: Unit, amt: number) {
    if (u.dead) return;
    if (this.hasBuff(u, 'grievous')) amt *= 0.5;
    // ===== EVENTO GLOBAL: Lua Sangrenta reduz cura =====
    amt *= this.eventMods.healMul;
    // Visão Espiritual: +30% cura recebida
    if (u.items?.includes('spiritvisage')) amt *= 1.3;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    // efeito visual de cura significativa
    if (u.hp - before > 15 && this.fx.length < 120) {
      this.fx.push({ kind: 'heal', x: u.x + rnd(-8, 8), y: u.y - 10, until: this.t + 0.7, color: '#60ff90' });
    }
  }

  shake(m: number, t: number) { this.shakeM = Math.max(this.shakeM, m); this.shakeT = Math.max(this.shakeT, t); }

  /** Flash de tela cheia para ultimates — tinta colorida + vinheta opcional. */
  screenFlash(color: string, dur: number, intensity = 0.35, vignette = true) {
    this.screenFx.push({ color, until: this.t + dur, dur, intensity, vignette });
    if (this.screenFx.length > 4) this.screenFx.shift();
  }

  announce(text: string, sub: string, color: string) {
    this.banner = { text, sub, color, until: this.t + 3, id: ++this.bannerId };
  }

  sparks(x: number, y: number, color: string, n = 5, spd = 100) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(spd * 0.4, spd);
      this.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, g: 300, until: this.t + rnd(0.25, 0.5), color, size: rnd(2, 4) });
    }
  }

  kill(src: Unit, dst: Unit) {
    if (dst.dead) return;
    dst.dead = true; dst.hp = 0; dst.attackTgt = null; dst.buffs = [];
    const giveGold = (h: Unit, g: number) => {
      // evento Corrida do Ouro multiplica todo ouro ganho
      const total = Math.round(g * this.eventMods.goldMul);
      h.gold += total;
      if (h === this.player) { this.text(h.x, h.y - 44, `+${total} ouro`, '#ffd858'); sfx.gold(); }
    };
    const shareXp = (team: Team, x: number, y: number, xp: number) => {
      const near = this.heroes.filter(h => h.team === team && !h.dead && dist(h.x, h.y, x, y) < 420);
      for (const h of near) this.giveXp(h, xp / Math.max(1, near.length * 0.7));
    };
     if (dst.kind === 'minion') {
       const isDeny = src.team === dst.team;
       const g = dst.superM ? 45 : dst.caster ? 16 : 22;
       if (isDeny) {
         if (src === this.player) {
           this.text(dst.x, dst.y - 40, '❗ DENY!', '#a060ff');
           sfx.hit();
         }
         // Dota Deny: oponentes ganham apenas 50% da XP normal, 0 ouro
         const xpBase = dst.superM ? 95 : dst.caster ? 32 : 62;
         shareXp(dst.team === 0 ? 1 : 0, dst.x, dst.y, xpBase * 0.5);
       } else {
         if (src.kind === 'hero') {
           // last-hit bonus: +50% de ouro extra se o herói deu o golpe final
           const lastHitBonus = Math.round(g * 0.5);
           giveGold(src, g + lastHitBonus);
           src.cs++;
           if (src === this.player) this.text(src.x, src.y - 56, `+${g + lastHitBonus} LAST HIT!`, '#ffe080');
         }
         if (dst.team !== 2) shareXp(dst.team === 0 ? 1 : 0, dst.x, dst.y, dst.superM ? 95 : dst.caster ? 32 : 62);
       }
      // MORTE DE MINION — pequena explosão + faíscas
      const mColor = dst.team === 0 ? '#5a8ad0' : '#d06a5a';
      this.fx.push({ kind: 'explosion', x: dst.x, y: dst.y - 6, r: dst.superM ? 30 : 20, until: this.t + 0.3, dur: 0.3, color: mColor });
      this.sparks(dst.x, dst.y - 6, mColor, dst.superM ? 8 : 5, 100);
      // partículas voando
      for (let i = 0; i < (dst.superM ? 6 : 3); i++) {
        const a = rnd(0, Math.PI * 2);
        this.fx.push({ kind: 'ember', x: dst.x, y: dst.y - 6, size: 3,
          vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 30,
          until: this.t + 0.4, dur: 0.4, color: mColor });
      }
      return;
    }
    if (dst.kind === 'monster') {
      const type = dst.campType!;
      const G: Record<string, number> = { gromp: 80, blue: 90, wolves: 70, raptors: 65, red: 90, krugs: 85, dragon: 150, baron: 300, crab: 40, wyvern: 200, riftherald: 280 };
      this.sparks(dst.x, dst.y, '#e0c080', 10, 140);
      if (src.kind === 'hero') {
        // evento Temporada de Caça dobra ouro/XP de monstros da selva
        const jm = this.eventMods.jungleMul;
        giveGold(src, Math.round((G[type] ?? 60) * jm)); src.cs++;
        this.giveXp(src, (type === 'dragon' ? 250 : type === 'baron' ? 600 : type === 'riftherald' ? 400 : type === 'wyvern' ? 180 : 130) * jm);
        if (type === 'blue') { this.addBuff(src, 'bluebuff', 90); this.text(src.x, src.y - 46, 'Buff Azul!', '#60a0ff'); }
        if (type === 'red') { this.addBuff(src, 'redbuff', 90); this.text(src.x, src.y - 46, 'Buff Vermelho!', '#ff7050'); }
        if (type === 'crab') {
          // caranguejo: revela a área (visão temporária) + ouro
          this.fx.push({ kind: 'ring', x: dst.x, y: dst.y, r: 60, until: this.t + 0.5, color: '#80e0a0' });
          if (src === this.player) this.text(src.x, src.y - 46, '+ Visão!', '#80e0a0');
        }
        if (type === 'wyvern' && src.team !== 2) {
          // buff da wyvern +10% vel. ataque e +8% vel. movimento para a EQUIPA
          for (const h of this.heroes.filter(h2 => h2.team === src.team)) {
            giveGold(h, 80);
            this.addBuff(h, 'wyvernbuff', 90);
          }
          this.text(src.x, src.y - 46, 'Buff da Wyvern!', '#ff8040');
          this.announce('🦅 WYVERN ABATIDA', `A equipe de ${src.name} ganhou as cinzas da wyvern!`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          sfx.objective();
        }
        if (type === 'riftherald' && src.team !== 2) {
          // Arauto: +10% dano a estruturas para a EQUIPA
          for (const h of this.heroes.filter(h2 => h2.team === src.team)) {
            giveGold(h, 200);
            this.addBuff(h, 'heraldbuff', 120);
          }
          this.text(src.x, src.y - 46, 'Bênção do Arauto!', '#c080ff');
          this.announce('⚔️ ARAUTO DA FENDA', `A equipe de ${src.name} invocou o Arauto!`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          this.shake(6, 0.4);
          sfx.objective();
        }
        if (type === 'dragon' && src.team !== 2) {
          for (const h of this.heroes.filter(h2 => h2.team === src.team)) giveGold(h, 125);
          this.announce('🐉 DRAGÃO ABATIDO', `${src.name} dominou o dragão`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          this.dragonNextRespawn = this.t + 150;
          sfx.objective();
        }
        if (type === 'baron' && src.team !== 2) {
          for (const h of this.heroes.filter(h2 => h2.team === src.team)) { this.addBuff(h, 'baron', 180); giveGold(h, 300); }
          this.announce('👑 BARÃO ABATIDO', `Bênção do Barão para o time de ${src.name}`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          this.baronNextRespawn = this.t + 240;
          this.shake(8, 0.5);
          this.screenFlash('#c080ff', 0.5, 0.4);
          sfx.objective();
        }
      }
      const rt = type === 'dragon' ? 150 : type === 'baron' ? 240 : type === 'riftherald' ? 300 : type === 'wyvern' ? 120 : 75;
      this.delayed.push({ at: this.t + rt, fn: () => this.spawnCamp(type, dst.campHome![0], dst.campHome![1]) });
      this.units = this.units.filter(u2 => u2 !== dst);
      return;
    }
    if (dst.kind === 'hero') {
      dst.deaths++;
      dst.respawnT = this.t + (6 + dst.level * 2.2) * this.modeRules.respawnScale * this.eventMods.respawnMul;
      dst.recallT = -1;
      this.sparks(dst.x, dst.y - 8, '#ff5050', 18, 200);
      this.fx.push({ kind: 'ultimateBurst', x: dst.x, y: dst.y - 8, r: 60, until: this.t + 0.6, color: '#ff6060' });
      this.fx.push({ kind: 'shockwave', x: dst.x, y: dst.y - 8, r: 80, until: this.t + 0.5, color: '#ff8080' });
      // alma subindo
      this.fx.push({ kind: 'soulRise', x: dst.x, y: dst.y - 10, until: this.t + 1.2, color: dst.team === 0 ? '#a0d0ff' : '#ff9090' });
      this.screenFlash('#ff2020', 0.35, 0.28);
      let killerName = src.name || 'Torre';
      // bounty system: ouro baseado no bounty do alvo
      const bounty = dst.bounty;
      const isShutdown = dst.killsStreak >= 3;
      if (src.kind === 'hero') {
        src.kills++; giveGold(src, bounty); this.giveXp(src, 150 + dst.level * 15);
        if (src === this.player) this.text(src.x, src.y - 58, `+${150 + dst.level * 15} XP`, '#c0a0ff');
        // ===== RUNA PRESENÇA DE ESPÍRITO: abate reduz 15% das recargas =====
        if (src === this.player && this.hasRune('presence')) {
          for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) src.cds[s] *= 0.85;
          this.text(src.x, src.y - 70, 'Presença!', '#80c0ff');
        }
        src.killsStreak++; src.deathsStreak = 0;
        src.bounty = Math.min(1000, 300 + src.killsStreak * 50);
        if (src.def?.passive.key === 'voracity') { for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) src.cds[s] = Math.max(0, src.cds[s] - 12); }
        const hl = this.getBuff(src, 'highlanderR'); if (hl) hl.until += 4;
        // passivas de abate
        if (src.def?.passive.key === 'soulharvest') { src.ap += 5; this.text(src.x, src.y - 56, '+5 AP (Alma)', '#8040c0'); }
        if (src.def?.passive.key === 'getexcited') { this.addBuff(src, 'speed', 6, 0.6); this.text(src.x, src.y - 56, 'Get Excited!', '#e0a040'); }
        
        // Multi-Kill Streak (Double, Triple, Quadra, Penta Kill!)
        const multi = this.multiKills.get(src.id) ?? { count: 0, lastTime: 0 };
        if (this.t - multi.lastTime < 10) multi.count++;
        else multi.count = 1;
        multi.lastTime = this.t;
        this.multiKills.set(src.id, multi);

        if (multi.count === 2) { this.announce('⚔️ DOUBLE KILL!', `${src.name} fez um Double Kill!`, src.team === 0 ? '#5ad0ff' : '#ff6a5a'); sfx.doubleKill(); }
        else if (multi.count === 3) { this.announce('🔥 TRIPLE KILL!', `${src.name} é implacável!`, '#ffa040'); sfx.tripleKill(); }
        else if (multi.count === 4) { this.announce('⚡ QUADRA KILL!', `${src.name} está imparável!`, '#ff6030'); sfx.quadraKill(); }
        else if (multi.count >= 5) { this.announce('👑 PENTAKILL!', `LENDÁRIO! ${src.name} aniquilou a equipe inimiga!`, '#ffe040'); sfx.pentaKill(); }

        // Checar ACE (todos os 5 heróis inimigos mortos)
        const enemiesAlive = this.heroes.filter(h => h.team === dst.team && !h.dead).length;
        if (enemiesAlive === 0) {
          this.announce('💀 ACE!', `Todos os inimigos foram abatidos!`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          sfx.ace();
        }

        if (isShutdown) {
          this.announce('💰 SHUTDOWN!', `${src.name} interrompeu a sequência de ${dst.name}! +${bounty} ouro`, src.team === 0 ? '#5ad0ff' : '#ff6a5a');
          if (src === this.player) this.text(src.x, src.y - 56, `+${bounty} SHUTDOWN!`, '#ffe080');
        }

        // Chat bot banter
        const botLines = ['Boa jogada!', 'Continue assim!', 'GG!', 'Alvo eliminado!', 'Empurrem a rota!'];
        const line = botLines[Math.floor(Math.random() * botLines.length)];
        this.postChat(src.name, line, src.team as Team);
      }
      dst.killsStreak = 0; dst.deathsStreak++;
      dst.bounty = Math.max(300, 300 - dst.deathsStreak * 50);
      for (const [hid, tt] of dst.recentDmg) {
        if (this.t - tt < 10) {
          const h = this.heroes.find(hh => hh.id === hid);
          if (h && h !== src && h.team !== dst.team) {
            h.assists++; giveGold(h, 150);
            if (h.def?.passive.key === 'voracity') { for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) h.cds[s] = Math.max(0, h.cds[s] - 12); }
          }
        }
      }
      dst.recentDmg.clear();
      const kColor = (src.team === 2 ? (dst.team === 0 ? 1 : 0) : src.team) === 0 ? '#5ad0ff' : '#ff6a5a';
      if (!this.firstBlood) {
        this.firstBlood = true;
        this.announce('⚡ FIRST BLOOD!', `${killerName} derramou o primeiro sangue`, kColor);
      } else {
        this.announce('💀 ABATEU!', `${killerName} eliminou ${dst.name}`, kColor);
      }
      this.feed.push({ t: this.t, text: `${killerName} abateu ${dst.name}`, team: (src.team === 2 ? (dst.team === 0 ? 1 : 0) : src.team) as Team });
      if (dst === this.player) { sfx.death(); this.shake(8, 0.4); }
      else if (src === this.player) sfx.kill();
      return;
    }
    if (dst.kind === 'tower') {
      this.units = this.units.filter(u2 => u2 !== dst);
      for (const h of this.heroes.filter(h2 => h2.team !== dst.team)) h.gold += 120;
      this.sparks(dst.x, dst.y - 30, '#d0b090', 16, 200);
      const laneName = dst.towerLane === 'nexus' ? 'do Nexus' : dst.towerLane === 'top' ? 'do Topo' : dst.towerLane === 'mid' ? 'do Meio' : 'de Baixo';
      this.announce('🏰 TORRE DESTRUÍDA', `Torre ${laneName} ${dst.team === 0 ? 'azul' : 'vermelha'} caiu!`, dst.team === 0 ? '#ff6a5a' : '#5ad0ff');
      this.feed.push({ t: this.t, text: `Torre ${dst.team === 0 ? 'azul' : 'vermelha'} destruída!`, team: (dst.team === 0 ? 1 : 0) as Team });
      sfx.tower();
      return;
    }
    if (dst.kind === 'inhib') {
      this.units = this.units.filter(u2 => u2 !== dst);
      this.announce('💥 INIBIDOR DESTRUÍDO', 'Superminions a caminho!', dst.team === 0 ? '#ff6a5a' : '#5ad0ff');
      this.feed.push({ t: this.t, text: `Inibidor ${dst.team === 0 ? 'azul' : 'vermelho'} destruído!`, team: (dst.team === 0 ? 1 : 0) as Team });
      sfx.tower();
      this.delayed.push({
        at: this.t + 240, fn: () => {
          const spot = INHIBS.find(i => i.team === dst.team && i.lane === dst.towerLane);
          if (spot && !this.result) {
            const u = this.baseUnit();
            u.kind = 'inhib'; u.team = dst.team; u.x = spot.x; u.y = spot.y; u.r = 20;
            u.maxHp = u.hp = 3000; u.armor = 30; u.mr = 30; u.towerLane = spot.lane; u.name = 'Inibidor';
            this.units.push(u);
          }
        },
      });
      return;
    }
    if (dst.kind === 'nexus') {
      this.result = dst.team === this.player.team ? 'lose' : 'win';
      this.sparks(dst.x, dst.y - 20, dst.team === 0 ? '#5ad0ff' : '#ff6a5a', 30, 260);
      sfx.objective();
    }
  }

  giveXp(u: Unit, xp: number) {
    if (u.level >= this.modeRules.maxLevel) return;
    u.xp += xp;
    while (u.xp >= this.xpNext(u.level) && u.level < this.modeRules.maxLevel) {
      u.xp -= this.xpNext(u.level); u.level++;
      // pontos de habilidade: 1 por nível (exceto níveis onde R destrava: ganha 2)
      u.skillPoints += u.level === 6 || u.level === 11 || u.level === 16 ? 2 : 1;
      // auto-upgrade para bots
      if (u.isBot) this.autoUpgradeSkills(u);
      this.applyHeroStats(u);
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12); u.mp = Math.min(u.maxMp, u.mp + u.maxMp * 0.2);
      this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 44, until: this.t + 0.7, color: '#ffe860' });
      this.sparks(u.x, u.y - 14, '#ffe860', 8, 120);
      if (u === this.player) { this.text(u.x, u.y - 50, `Nível ${u.level}! +${u.skillPoints} pts`, '#ffe860'); sfx.levelup(); }
    }
  }
  autoUpgradeSkills(u: Unit) {
    // ordem de prioridade: Q primeiro (já tem 1), depois W, E, R
    const order: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
    while (u.skillPoints > 0) {
      let upgraded = false;
      for (const s of order) {
        const lv = u.skillLv[s];
        const maxLv = s === 'R' ? 3 : 5;
        const reqLv = s === 'R' ? (lv === 0 ? 6 : lv === 1 ? 11 : lv === 2 ? 16 : 99) : lv + 1;
        if (lv < maxLv && u.level >= reqLv) { u.skillLv[s]++; u.skillPoints--; upgraded = true; break; }
      }
      if (!upgraded) break;
    }
  }
  xpNext(level: number) { return 160 + level * 95; }

  levelUpSkill(slot: AbilitySlot) {
    const u = this.player;
    if (u.dead || u.skillPoints <= 0) return;
    const maxLv = slot === 'R' ? 3 : 5;
    const lv = u.skillLv[slot];
    const reqLv = slot === 'R' ? (lv === 0 ? 6 : lv === 1 ? 11 : lv === 2 ? 16 : 99) : lv + 1;
    if (lv < maxLv && u.level >= reqLv) {
      u.skillLv[slot]++;
      u.skillPoints--;
      this.text(u.x, u.y - 60, `${slot} UP!`, '#ffe860');
      sfx.levelup();
    }
  }

  text(x: number, y: number, s: string, color: string, fontSize?: number) {
    if (this.fx.length > 120) return;
    this.fx.push({ kind: 'text', x, y, until: this.t + 1.1, dur: 1.1, color, text: s, vy: -30, size: fontSize });
  }

  /** Texto grande flutuante (level up, abate, etc) */
  bigText(x: number, y: number, s: string, color: string) {
    this.fx.push({ kind: 'text', x, y, until: this.t + 1.6, dur: 1.6, color, text: s, vy: -22, size: 18 });
  }

  // ---------- ataques básicos ----------
  tryAttack(u: Unit, tgt: Unit, dt: number) {
    u.atkCd -= dt;
    if (u.atkCd > 0) return;
    if (this.hasBuff(u, 'blind')) {
      u.atkCd = 1 / this.aspdOf(u);
      this.text(tgt.x, tgt.y - 30, 'Errou!', '#a0a0a0');
      return;
    }
    u.atkCd = 1 / this.aspdOf(u);
    u.facing = tgt.x >= u.x ? 1 : -1;
    if (u.kind === 'hero') u.attackAnimT = this.t;
    const doHit = (victim: Unit) => {
      if (victim.dead) return;
      let dmg = u.ad; let isCrit = false;
      if (u.kind === 'hero' && Math.random() * 100 < u.crit) {
        isCrit = true;
        dmg *= u.items.includes('infinityedge') ? 2.5 : 2;
      }
      const dec = this.getBuff(u, 'decisive');
      if (dec) { dmg += 30 + u.level * 14 + u.ad * 0.4; this.addBuff(victim, 'silence', 1.5); u.buffs = u.buffs.filter(b => b !== dec); }
      const cw = this.getBuff(u, 'cripple');
      if (cw) { dmg *= 1.5; this.addBuff(victim, 'slow', 1, 0.9, u); u.buffs = u.buffs.filter(b => b !== cw); }
      const pf = this.getBuff(u, 'powerfist');
      if (pf) { dmg *= 2; this.addBuff(victim, 'stun', 1); this.fx.push({ kind: 'ring', x: victim.x, y: victim.y, r: 26, until: this.t + 0.4, color: '#ffd040' }); u.buffs = u.buffs.filter(b => b !== pf); }
      const dealt = this.dealDamage(u, victim, dmg, 'phys', { attack: true });
      // ===== FEEDBACK VISUAL RICO DE ATAQUE BÁSICO =====
      const skinMod = u.kind === 'hero' ? this.heroSkinMods[u.def!.id] : undefined;
      const sparkCol = isCrit ? '#ffd840'
        : u.kind === 'tower' ? '#ff9070'
        : u.kind === 'hero' ? (skinMod?.particle ?? '#f0e0b0') : '#f0e0b0';
      this.sparks(victim.x, victim.y - 8, sparkCol, isCrit ? 10 : 4, isCrit ? 180 : 100);
      if (u.kind === 'hero' && !u.def?.ranged) {
        // slash direcional + faíscas de metal
        this.fx.push({ kind: 'slash', x: victim.x, y: victim.y - 8, r: isCrit ? 20 : 15, until: this.t + 0.2, dur: 0.2, color: isCrit ? '#ffd840' : '#f0f0f0', vx: Math.atan2(victim.y - u.y, victim.x - u.x) + rnd(-0.3, 0.3) });
      }
      if (isCrit) {
        // CRÍTICO — impacto muito mais rico
        this.fx.push({ kind: 'starBurst', x: victim.x, y: victim.y - 8, r: 30, until: this.t + 0.35, dur: 0.35, color: '#ffd840' });
        this.fx.push({ kind: 'ring', x: victim.x, y: victim.y - 8, r: 20, until: this.t + 0.25, dur: 0.25, color: '#ffd840' });
        this.text(victim.x, victim.y - 48, 'CRÍTICO!', '#ffd840');
        if (u === this.player) this.hitStop = Math.max(this.hitStop, 0.04);
      }
      if (u === this.player || victim === this.player) { if (isCrit) sfx.crit(); else sfx.hit(); }
      if (u.lifesteal > 0) {
        const healAmt = dealt * u.lifesteal;
        const over = u.hp + healAmt - u.maxHp;
        this.heal(u, healAmt);
        if (over > 0 && u.items?.includes('bloodthirster')) {
          const sh = this.getBuff(u, 'shield');
          if (sh) sh.v = Math.min(200, (sh.v ?? 0) + over); else this.addBuff(u, 'shield', 8, Math.min(200, over));
        }
      }
      if (u.kind === 'hero') this.onHitEffects(u, victim, dealt);
      if (u.kind === 'tower') this.fx.push({ kind: 'beam', x: u.x, y: u.y - 40, x2: victim.x, y2: victim.y, until: this.t + 0.15, color: u.team === 0 ? '#60c0ff' : '#ff7060' });
      const msh = this.getBuff(victim, 'moltenshield');
      if (msh && dist(u.x, u.y, victim.x, victim.y) < 90 && !u.dead) this.dealDamage(victim, u, 25 + victim.level * 8 + victim.ap * 0.2, 'magic', { ability: true });
    };
    if ((u.kind === 'hero' && u.def && !u.def.ranged) || u.kind === 'monster' || (u.kind === 'minion' && !u.caster)) {
      doHit(tgt);
      if (u.kind === 'hero' && u.def?.passive.key === 'doublestrike') {
        u.hitCount++;
        if (u.hitCount >= 4) {
          u.hitCount = 0;
          this.delayed.push({ at: this.t + 0.15, fn: () => { if (!tgt.dead && !u.dead) doHit(tgt); } });
          this.text(u.x, u.y - 44, 'Golpe Duplo!', '#c0a0ff');
        }
      }
    } else {
      const skinMod = u.kind === 'hero' ? this.heroSkinMods[u.def!.id] : undefined;
      const col = u.kind === 'tower' ? (u.team === 0 ? '#70c8ff' : '#ff8070')
        : u.kind === 'hero' ? (skinMod?.trail ?? '#f0e8c0') : '#c0d0e8';
      this.projs.push({
        x: u.x, y: u.y - 14, tx: tgt.x, ty: tgt.y, target: tgt, speed: u.kind === 'tower' ? 520 : 440,
        team: u.team, src: u, color: col, size: u.kind === 'tower' ? 7 : 4, kind: 'attack',
        hitRadius: 16, maxDist: 2200, traveled: 0, dx: 0, dy: 0,
        onHit: hit => { if (hit) doHit(hit); },
      });
      if (u.kind === 'hero' && u.def?.passive.key === 'doublestrike') {
        u.hitCount++;
        if (u.hitCount >= 4) { u.hitCount = 0; u.atkCd *= 0.4; }
      }
    }
  }

  /**
   * Dispara os efeitos das runas equipadas.
   * @param source origem do dano: 'attack' (básico) ou 'ability' (habilidade)
   */
  triggerRunes(u: Unit, tgt: Unit, dealt: number, source: 'attack' | 'ability') {
    if (u !== this.player || tgt.dead) return;

    // CONQUISTADOR: acumula Fúria (máx. 6); pilha cheia cura 8% do dano
    if (this.hasRune('conqueror') && (tgt.kind === 'hero' || tgt.kind === 'monster')) {
      const b = this.getBuff(u, 'conquerorStacks');
      if (b) {
        b.stacks = Math.min(6, (b.stacks ?? 1) + 1);
        b.until = this.t + 6;
      } else {
        u.buffs.push({ key: 'conquerorStacks', until: this.t + 6, stacks: 1, tickT: 0 });
      }
      const stacks = this.getBuff(u, 'conquerorStacks')?.stacks ?? 0;
      if (stacks >= 6) this.heal(u, dealt * 0.08);
      if (stacks === 6 && !this.hasBuff(u, 'conquerorFull')) {
        this.addBuff(u, 'conquerorFull', 6);
        this.text(u.x, u.y - 54, 'FÚRIA MÁXIMA!', '#e07040');
        this.fx.push({ kind: 'ringBurst', x: u.x, y: u.y, r: 46, until: this.t + 0.4, dur: 0.4, color: '#e07040' });
      }
      this.applyHeroStats(u);
    }

    // ELETROCUTAR: 3 fontes de dano distintas em 4s
    if (this.hasRune('electrocute') && tgt.kind === 'hero' && this.t > u.electrocuteCd) {
      const b = this.getBuff(tgt, 'electroMark');
      if (b && b.src === u) {
        b.stacks = (b.stacks ?? 1) + 1;
        b.until = this.t + 4;
        if (b.stacks >= 3) {
          tgt.buffs = tgt.buffs.filter(x => x !== b);
          u.electrocuteCd = this.t + 20;
          const dmg = 40 + u.level * 12 + u.ap * 0.2 + u.ad * 0.3;
          this.dealDamage(u, tgt, dmg, 'magic', { ability: true });
          this.fx.push({ kind: 'lightning', x: u.x, y: u.y - 12, x2: tgt.x, y2: tgt.y - 8, until: this.t + 0.3, dur: 0.3, color: '#a060ff' });
          this.fx.push({ kind: 'nova', x: tgt.x, y: tgt.y - 8, r: 36, until: this.t + 0.35, dur: 0.35, color: '#a060ff' });
          this.text(tgt.x, tgt.y - 50, 'ELETROCUTAR!', '#a060ff');
          sfx.crit();
        }
      } else {
        tgt.buffs.push({ key: 'electroMark', until: this.t + 4, stacks: 1, src: u, tickT: 0 });
      }
    }

    // PASSO LIGEIRO: velocidade + cura em ataques básicos
    if (source === 'attack' && this.hasRune('fleetwork')) {
      this.addBuff(u, 'speed', 1, 0.2);
      this.heal(u, 6 + u.level * 1.5);
    }

    // COMETA ARCANO: habilidades invocam um cometa (recarga 14s)
    if (source === 'ability' && this.hasRune('arcanecomet') && this.t > u.cometCd) {
      u.cometCd = this.t + 14;
      const dmg = 30 + u.level * 8 + u.ap * 0.25;
      this.delayed.push({
        at: this.t + 0.5, fn: () => {
          if (tgt.dead) return;
          this.dealDamage(u, tgt, dmg, 'magic', { ability: true });
          this.fx.push({ kind: 'fireball', x: tgt.x, y: tgt.y - 8, r: 14, until: this.t + 0.35, dur: 0.35, color: '#70b0ff' });
          this.fx.push({ kind: 'explosion', x: tgt.x, y: tgt.y - 8, r: 32, until: this.t + 0.4, dur: 0.4, color: '#70b0ff' });
        },
      });
      this.text(u.x, u.y - 50, 'Cometa!', '#70b0ff');
    }
  }

  onHitEffects(u: Unit, tgt: Unit, _dealt: number) {
    // ===== RUNAS DO JOGADOR (ataques básicos) =====
    if (u === this.player) this.triggerRunes(u, tgt, _dealt, 'attack');
    const pk = u.def?.passive.key;
    if (pk === 'frostshot') { this.addBuff(tgt, 'slow', 2, 0.2, u); }
    if (pk === 'frosttouch') { this.addBuff(tgt, 'slow', 2, 0.25, u); }
    if (pk === 'eternalhunger') { const bonus = 10 + u.level * 2.5; this.dealDamage(u, tgt, bonus, 'magic', {}); this.heal(u, bonus / 2); }
    if (pk === 'hemorrhage') this.applyBleed(u, tgt, 5);
    if (pk === 'soulharvest') { /* almas coletadas em kill() */ }
    if (pk === 'getexcited') { /* abates ativam em kill() */ }
    if (pk === 'spiritshield') { /* recarrega em movimento */ }
    if (pk === 'shadowmark') { this.applyDot(u, tgt, 20 + u.level * 5 + u.ap * 0.2, 3, 'shadowmarkdot'); }
    if (pk === 'stormsong') { /* a cada 3 habilidades */ }
    if (pk === 'voidshield') { /* a cada 30s */ }
    if (pk === 'prowl') { /* na selva */ }
    if (pk === 'discipline') {
      u.hitCount++;
      if (u.hitCount >= 2) { u.hitCount = 0; this.dealDamage(u, tgt, 15 + u.level * 4 + u.ap * 0.2, 'magic', {}); }
    }
    if (pk === 'frozenstrike') {
      const b = tgt.buffs.find(bb => bb.key === 'frozenstrike' && bb.src === u);
      if (b) { b.stacks = Math.min(4, (b.stacks ?? 0) + 1); b.until = this.t + 4; if (b.stacks >= 4) { b.stacks = 0; this.addBuff(tgt, 'stun', 1); this.text(tgt.x, tgt.y - 40, 'Congelado!', '#a0d0e0'); } }
      else tgt.buffs.push({ key: 'frozenstrike', until: this.t + 4, src: u, stacks: 1, tickT: 0 });
    }
    const mark = tgt.buffs.find(b => b.key === 'illum' && b.src === u);
    if (mark) {
      tgt.buffs = tgt.buffs.filter(b => b !== mark);
      const d2 = this.dealDamage(u, tgt, 20 + u.level * 10 + u.ap * 0.3, 'magic', {});
      if (d2 > 0) { this.sparks(tgt.x, tgt.y - 10, '#ffe880', 6, 130); this.text(tgt.x, tgt.y - 46, 'Iluminação!', '#ffe880'); }
    }
    if (this.hasBuff(u, 'wuju')) this.dealDamage(u, tgt, 12 + u.level * 6 + u.ad * 0.25, 'true', {});
    if (this.hasBuff(u, 'toxic') || u.def?.id === 'timo') this.applyPoison(u, tgt, this.hasBuff(u, 'toxic') ? 2 : 1);
    if (u.items.includes('frozenmallet')) this.addBuff(tgt, 'slow', 1.5, 0.3, u);
    if (this.hasBuff(u, 'redbuff')) { this.addBuff(tgt, 'slow', 1.5, 0.15, u); this.applyDot(u, tgt, 12, 3, 'burnR'); }
    if (this.hasBuff(u, 'prowl')) { this.dealDamage(u, tgt, 20 + u.level * 4, 'true', {}); u.buffs = u.buffs.filter(b => b.key !== 'prowl'); }
  }

  applyBleed(src: Unit, tgt: Unit, dur: number) {
    const b = tgt.buffs.find(bb => bb.key === 'bleed' && bb.src === src);
    if (b) { b.stacks = Math.min(5, (b.stacks ?? 1) + 1); b.until = this.t + dur; }
    else tgt.buffs.push({ key: 'bleed', until: this.t + dur, v: 6 + src.level * 1.6, src, tickT: 0, stacks: 1 });
  }
  applyPoison(src: Unit, tgt: Unit, mult: number) {
    const b = tgt.buffs.find(bb => bb.key === 'poison' && bb.src === src);
    const dps = (6 + src.level * 2.2 + src.ap * 0.1) * mult;
    if (b) { b.until = this.t + 4; b.v = dps; } else tgt.buffs.push({ key: 'poison', until: this.t + 4, v: dps, src, tickT: 0 });
  }
  applyDot(src: Unit, tgt: Unit, dps: number, dur: number, key: string) {
    const b = tgt.buffs.find(bb => bb.key === key && bb.src === src);
    if (b) { b.until = this.t + dur; b.v = dps; } else tgt.buffs.push({ key, until: this.t + dur, v: dps, src, tickT: 0 });
  }

  // ---------- seleção de alvo (cursor → alvo atual → mais próximo no alcance) ----------
  pickTarget(u: Unit, tx: number, ty: number, range: number, heroOnly = false): Unit | null {
    const kinds = heroOnly ? ['hero'] : ['hero', 'minion', 'monster'];
    const cand = this.units.filter(e => !e.dead && e.team !== u.team && !this.hasBuff(e, 'invis') && kinds.includes(e.kind));
    let t = cand.find(e => dist(e.x, e.y, tx, ty) < Math.max(36, e.r + 18)) ?? null;
    if (!t && u.attackTgt && !u.attackTgt.dead && cand.includes(u.attackTgt)) t = u.attackTgt;
    if (!t) {
      const inR = cand.filter(e => dist(u.x, u.y, e.x, e.y) <= range)
        .sort((a, b) => {
          const pa = a.kind === 'hero' ? 0 : 1, pb = b.kind === 'hero' ? 0 : 1;
          return pa - pb || dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y);
        });
      t = inR[0] ?? null;
    }
    if (t && dist(u.x, u.y, t.x, t.y) > range + 60) return null;
    return t;
  }

  // ---------- habilidades ----------
  abilityReady(u: Unit, slot: AbilitySlot): { ok: boolean; reason?: string } {
    const ab = u.def!.abilities[slot];
    if (u.skillLv[slot] <= 0) return { ok: false, reason: 'Não aprendida' };
    if (slot === 'R' && u.level < 6) return { ok: false, reason: 'Requer nível 6' };
    if (u.cds[slot] > 0) return { ok: false, reason: 'Em recarga' };
    if (u.maxMp > 0 && u.mp < ab.mana) return { ok: false, reason: 'Sem mana' };
    if (this.isStunned(u) || this.hasBuff(u, 'silence')) return { ok: false, reason: 'Impedido' };
    return { ok: true };
  }

  cast(u: Unit, slot: AbilitySlot, tx: number, ty: number, _tgt: Unit | null) {
    if (u.dead || !u.def) return;
    const chk = this.abilityReady(u, slot);
    if (!chk.ok) { if (u === this.player) { this.text(u.x, u.y - 46, chk.reason!, '#ff8080'); sfx.error(); } return; }
    const ab = u.def.abilities[slot];
    const L = u.level, AP = u.ap, AD = u.ad;
    const rlvl = u.level >= 16 ? 3 : u.level >= 11 ? 2 : 1;
    // bônus por nível da habilidade (Q/W/E: +10 por nível; R: +60 por nível)
    const skillLv = u.skillLv[slot];
    const skillBonus = slot === 'R' ? (skillLv - 1) * 60 : (skillLv - 1) * 10;
    u.cds[slot] = ab.cd * (this.hasBuff(u, 'bluebuff') ? 0.85 : 1);
    if (u.maxMp > 0) u.mp -= ab.mana * (this.hasBuff(u, 'bluebuff') ? 0.5 : 1);
    u.recallT = -1;
    u.castT = this.t;
    if (u.def.passive.key === 'arcanemastery') for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) if (s !== slot) u.cds[s] = Math.max(0, u.cds[s] - 1);
    let pyroStun = false;
    if (u.def.passive.key === 'pyromania') {
      u.spellCount++;
      if (u.spellCount > 4) { pyroStun = true; u.spellCount = 0; this.text(u.x, u.y - 52, 'PIROMANIA!', '#ff6040'); }
    }
    // feedback de conjuração
    // ---- VFX TEMÁTICO POR HABILIDADE (cor + estilo de conjuração) ----
    const vfx = ABILITY_VFX[ab.key] ?? { c: slot === 'R' ? '#ffd840' : u.team === 0 ? '#70d0ff' : '#ff9080', s: 'burst' as const };
    const castCol = vfx.c;
    // efeito de conjuração conforme o estilo temático
    this.sparks(u.x, u.y - 12, castCol, slot === 'R' ? 10 : 6, slot === 'R' ? 140 : 100);
    this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.3, color: castCol });
    switch (vfx.s) {
      case 'fire':
        this.fx.push({ kind: 'fireball', x: u.x, y: u.y - 14, r: 15, until: this.t + 0.35, dur: 0.35, color: castCol });
        this.fx.push({ kind: 'ember', x: u.x, y: u.y - 14, size: 3, vx: rnd(-30, 30), vy: -40, until: this.t + 0.4, dur: 0.4, color: castCol });
        this.fx.push({ kind: 'ember', x: u.x, y: u.y - 14, size: 3, vx: rnd(-30, 30), vy: -50, until: this.t + 0.4, dur: 0.4, color: castCol });
        break;
      case 'ice':
        this.fx.push({ kind: 'iceshatter', x: u.x, y: u.y - 10, r: 32, until: this.t + 0.4, dur: 0.4, color: castCol });
        this.fx.push({ kind: 'starBurst', x: u.x, y: u.y - 12, r: 26, until: this.t + 0.3, dur: 0.3, color: castCol });
        break;
      case 'shadow':
        this.fx.push({ kind: 'voidtentacle', x: u.x, y: u.y - 8, r: 38, until: this.t + 0.45, dur: 0.45, color: castCol });
        this.fx.push({ kind: 'vortex', x: u.x, y: u.y - 8, r: 30, until: this.t + 0.4, dur: 0.4, color: castCol });
        break;
      case 'holy':
        this.fx.push({ kind: 'holypillar', x: u.x, y: u.y, r: 28, until: this.t + 0.5, dur: 0.5, color: castCol });
        this.fx.push({ kind: 'starBurst', x: u.x, y: u.y - 12, r: 40, until: this.t + 0.4, dur: 0.4, color: castCol });
        break;
      case 'blade':
        this.fx.push({ kind: 'slash', x: u.x + u.facing * 18, y: u.y - 10, r: 22, until: this.t + 0.25, dur: 0.25, color: castCol, vx: u.facing > 0 ? 0 : Math.PI });
        this.sparks(u.x + u.facing * 22, u.y - 10, castCol, 4, 140);
        break;
      case 'shock':
        this.fx.push({ kind: 'nova', x: u.x, y: u.y - 10, r: 42, until: this.t + 0.35, dur: 0.35, color: castCol });
        // pequenos raios saindo do herói
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + rnd(0, 1);
          this.fx.push({ kind: 'lightning', x: u.x, y: u.y - 10,
            x2: u.x + Math.cos(a) * 40, y2: u.y - 10 + Math.sin(a) * 40,
            until: this.t + 0.2, dur: 0.2, color: castCol });
        }
        break;
      case 'nature':
        this.fx.push({ kind: 'poisoncloud', x: u.x, y: u.y - 10, r: 36, until: this.t + 0.5, dur: 0.5, color: castCol });
        this.fx.push({ kind: 'ringBurst', x: u.x, y: u.y, r: 44, until: this.t + 0.35, dur: 0.35, color: castCol });
        break;
      case 'buff':
        this.fx.push({ kind: 'healpulse', x: u.x, y: u.y, r: 42, until: this.t + 0.5, dur: 0.5, color: castCol });
        break;
      default:
        this.fx.push({ kind: 'ringBurst', x: u.x, y: u.y, r: 36, until: this.t + 0.3, dur: 0.3, color: castCol });
    }
    // ultimates ganham anel de runas dramático + onda expansiva
    if (slot === 'R') {
      this.fx.push({ kind: 'runes', x: u.x, y: u.y + 6, r: 46, until: this.t + 0.7, color: castCol });
      this.fx.push({ kind: 'ringBurst', x: u.x, y: u.y, r: 70, until: this.t + 0.5, color: castCol });
      this.fx.push({ kind: 'shockwave', x: u.x, y: u.y, r: 80, until: this.t + 0.45, color: castCol });
      this.sparks(u.x, u.y - 12, castCol, 12, 150);
    }
    // stormsong: a cada 3 habilidades, ganha escudo + velocidade
    if (u.def?.passive.key === 'stormsong') {
      const cnt = u.buffs.find(b => b.key === 'stormsongCnt');
      if (cnt) { cnt.stacks = (cnt.stacks ?? 0) + 1; if (cnt.stacks >= 3) { cnt.stacks = 0; this.addBuff(u, 'shield', 4, 50 + u.level * 8); this.addBuff(u, 'speed', 4, 0.2); this.text(u.x, u.y - 50, 'Canto da Tempestade!', '#e8c040'); } }
      else u.buffs.push({ key: 'stormsongCnt', until: this.t + 999, stacks: 1, tickT: 0 });
    }
    if (ab.range > 0 && ab.range < 2000) this.fx.push({ kind: 'castring', x: u.x, y: u.y, r: ab.range, until: this.t + 0.45, color: u.team === 0 ? 'rgba(110,208,255,0.45)' : 'rgba(255,130,110,0.45)' });
    if (u === this.player) { if (slot === 'R') sfx.ult(); else sfx.cast(); }

    const enemies = (x: number, y: number, r: number) =>
      this.units.filter(e => !e.dead && e.team !== u.team &&
        !['tower', 'inhib', 'nexus'].includes(e.kind) && dist(e.x, e.y, x, y) <= r + e.r);
    const enemyHeroes = (x: number, y: number, r: number) => this.heroes.filter(e => !e.dead && e.team !== u.team && dist(e.x, e.y, x, y) <= r);
    const abilityHit = (victim: Unit, dmg: number, type: 'phys' | 'magic' | 'true'): number => {
      const computedDmg = calculateAbilityDamage(u, ab, skillLv);
      const finalDmg = computedDmg > 0 ? computedDmg : (dmg + skillBonus);
      const dealt = this.dealDamage(u, victim, finalDmg, type, { ability: true });
      // ===== FEEDBACK VISUAL TEMÁTICO DE IMPACTO =====
      if (dealt > 0 && !victim.dead) {
        const big = dmg > 100;
        const crit = dmg > 200;
        const ang = Math.atan2(victim.y - u.y, victim.x - u.x);
        // Efeito de impacto casado com o TEMA do VFX (fire → fireball explode, ice → shatter, etc.)
        switch (vfx.s) {
          case 'fire':
            this.fx.push({ kind: 'explosion', x: victim.x, y: victim.y - 8, r: big ? 34 : 22, until: this.t + 0.4, dur: 0.4, color: castCol });
            for (let i = 0; i < (crit ? 6 : 4); i++) {
              const a = rnd(0, Math.PI * 2);
              this.fx.push({ kind: 'ember', x: victim.x, y: victim.y - 8, size: 4,
                vx: Math.cos(a) * 100, vy: Math.sin(a) * 100 - 40,
                until: this.t + 0.5, dur: 0.5, color: castCol });
            }
            break;
          case 'ice':
            this.fx.push({ kind: 'iceshatter', x: victim.x, y: victim.y - 8, r: big ? 40 : 28, until: this.t + 0.4, dur: 0.4, color: castCol });
            this.sparks(victim.x, victim.y - 8, castCol, crit ? 8 : 5, 120);
            break;
          case 'shadow':
            this.fx.push({ kind: 'vortex', x: victim.x, y: victim.y - 8, r: big ? 30 : 22, until: this.t + 0.4, dur: 0.4, color: castCol });
            this.fx.push({ kind: 'orb', x: victim.x, y: victim.y - 8, r: big ? 14 : 10, until: this.t + 0.25, dur: 0.25, color: castCol });
            break;
          case 'holy':
            this.fx.push({ kind: 'starBurst', x: victim.x, y: victim.y - 8, r: big ? 34 : 24, until: this.t + 0.4, dur: 0.4, color: castCol });
            this.fx.push({ kind: 'ring', x: victim.x, y: victim.y - 8, r: big ? 22 : 16, until: this.t + 0.25, dur: 0.25, color: '#ffffff' });
            break;
          case 'blade':
            this.fx.push({ kind: 'bloodslash', x: victim.x, y: victim.y - 8, r: big ? 22 : 16, until: this.t + 0.3, dur: 0.3, color: castCol, vx: ang });
            this.sparks(victim.x, victim.y - 8, castCol, crit ? 10 : 6, crit ? 160 : 110);
            break;
          case 'shock':
            this.fx.push({ kind: 'lightning', x: u.x, y: u.y - 10, x2: victim.x, y2: victim.y - 8, until: this.t + 0.25, dur: 0.25, color: castCol });
            this.fx.push({ kind: 'nova', x: victim.x, y: victim.y - 8, r: big ? 32 : 22, until: this.t + 0.3, dur: 0.3, color: castCol });
            break;
          case 'nature':
            this.fx.push({ kind: 'poisoncloud', x: victim.x, y: victim.y - 8, r: big ? 30 : 22, until: this.t + 0.5, dur: 0.5, color: castCol });
            this.sparks(victim.x, victim.y - 8, castCol, 4, 100);
            break;
          case 'buff':
            this.fx.push({ kind: 'healpulse', x: victim.x, y: victim.y - 8, r: big ? 28 : 20, until: this.t + 0.4, dur: 0.4, color: castCol });
            break;
          default:
            if (type === 'magic') {
              this.fx.push({ kind: 'orb', x: victim.x, y: victim.y - 8, r: big ? 16 : 10, until: this.t + 0.25, dur: 0.25, color: castCol });
              this.fx.push({ kind: 'starBurst', x: victim.x, y: victim.y - 8, r: big ? 26 : 18, until: this.t + 0.3, dur: 0.3, color: castCol });
            } else if (type === 'phys') {
              this.fx.push({ kind: 'slash', x: victim.x, y: victim.y - 8, r: 15, until: this.t + 0.2, dur: 0.2, color: castCol, vx: ang });
            } else {
              this.fx.push({ kind: 'explosion', x: victim.x, y: victim.y - 8, r: big ? 30 : 20, until: this.t + 0.3, dur: 0.3, color: '#fff' });
            }
            this.sparks(victim.x, victim.y - 8, castCol, crit ? 10 : big ? 7 : 5, crit ? 160 : 120);
        }
        // dano crítico ganha screen flash sutil + hit-stop
        if (crit) {
          this.screenFlash(castCol, 0.15, 0.15, false);
          this.hitStop = Math.max(this.hitStop, 0.05);
        } else if (big) {
          this.hitStop = Math.max(this.hitStop, 0.025);
        }
        // flash forte no alvo em impacto grande
        if (big) victim.flashT = Math.max(victim.flashT, crit ? 0.25 : 0.18);
      }
      // ===== RUNAS: gatilho por habilidade =====
      if (u === this.player && dealt > 0) this.triggerRunes(u, victim, dealt, 'ability');
      if (pyroStun && !victim.dead) { this.addBuff(victim, 'stun', 1.5); this.text(victim.x, victim.y - 42, 'Atordoado!', '#ff6040'); }
      if (u.def!.passive.key === 'illumination' && !victim.dead) this.addBuff(victim, 'illum', 5, 0, u);
      if (u.def!.passive.key === 'hemorrhage' && !victim.dead) this.applyBleed(u, victim, 5);
      if (this.hasBuff(u, 'despower') && !victim.dead) {
        for (const e of enemies(victim.x, victim.y, 90)) if (e !== victim) this.dealDamage(u, e, dmg * 0.5, type, {});
      }
      return dealt;
    };
    const dirTo = (x: number, y: number): Vec => {
      const d = dist(u.x, u.y, x, y) || 1;
      return [(x - u.x) / d, (y - u.y) / d];
    };
    const skillshot = (color: string, size: number, speed: number, range: number, hitR: number, onHitUnit: (v: Unit) => void, pierce = false) => {
      const [dx, dy] = dirTo(tx, ty);
      this.projs.push({
        x: u.x, y: u.y - 10, tx: u.x + dx * range, ty: u.y + dy * range, speed, team: u.team, src: u,
        color, size, kind: pierce ? 'pierce' : 'skill', hitRadius: hitR, maxDist: range, traveled: 0, dx, dy,
        hitSet: pierce ? new Set() : undefined,
        onHit: v => { if (v) onHitUnit(v); },
      });
    };
    u.facing = tx >= u.x ? 1 : -1;
    switch (ab.key) {
      case 'decisive': this.addBuff(u, 'speed', 2, 0.3); this.addBuff(u, 'decisive', 4.5); u.buffs = u.buffs.filter(b => b.key !== 'slow'); break;
      case 'courage': this.addBuff(u, 'dr', 4, 0.3); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 34, until: this.t + 0.5, color: '#e8c860' }); break;
      case 'judgment': this.addBuff(u, 'spin', 3, 20 + L * 9 + AD * 0.36); break;
      case 'demacian': {
        const v = this.pickTarget(u, tx, ty, ab.range + 60, true);
        if (v) {
          // pilar de luz santa marca o alvo
          this.fx.push({ kind: 'holypillar', x: v.x, y: v.y, r: 30, until: this.t + 0.7, dur: 0.7, color: '#ffe860' });
          this.fx.push({ kind: 'runes', x: v.x, y: v.y + 4, r: 40, until: this.t + 0.7, dur: 0.7, color: '#ffe860' });
          this.fx.push({ kind: 'sword', x: v.x, y: v.y, until: this.t + 0.7, color: '#ffe860' });
          this.screenFlash('#ffe860', 0.35, 0.25, false);
          this.delayed.push({
            at: this.t + 0.5, fn: () => {
              if (!v.dead) {
                const d2 = abilityHit(v, 80 + rlvl * 90 + (v.maxHp - v.hp) * 0.28, 'true');
                if (d2 > 0) {
                  this.fx.push({ kind: 'explosion', x: v.x, y: v.y - 8, r: 60, until: this.t + 0.5, dur: 0.5, color: '#ffe860' });
                  this.fx.push({ kind: 'shockwave', x: v.x, y: v.y, r: 90, until: this.t + 0.5, dur: 0.5, color: '#fff' });
                  this.sparks(v.x, v.y - 10, '#ffe860', 16, 200);
                  this.hitStop = Math.max(this.hitStop, 0.08);
                }
              }
            }
          });
        } else u.cds[slot] = 0.5;
        break;
      }
      case 'disintegrate': {
        const v = this.pickTarget(u, tx, ty, ab.range + 40);
        if (!v) { u.cds[slot] = 0.5; if (u.maxMp) u.mp += ab.mana; break; }
        this.projs.push({
          x: u.x, y: u.y - 12, tx: v.x, ty: v.y, target: v, speed: 400, team: u.team, src: u, color: '#ff8040', size: 8,
          kind: 'fire', hitRadius: 18, maxDist: 999, traveled: 0, dx: 0, dy: 0,
          onHit: h => {
            if (!h) return;
            abilityHit(h, 55 + L * 16 + AP * 0.7, 'magic');
            this.sparks(h.x, h.y - 8, '#ff8040', 6, 120);
            if (h.dead && (h.kind === 'minion' || h.kind === 'monster')) { if (u.maxMp) u.mp = Math.min(u.maxMp, u.mp + ab.mana); u.cds.Q = Math.min(u.cds.Q, 1.5); this.text(u.x, u.y - 44, 'Mana devolvida!', '#60a0ff'); }
          },
        });
        break;
      }
      case 'incinerate': {
        const [dx, dy] = dirTo(tx, ty);
        this.fx.push({ kind: 'cone', x: u.x, y: u.y, x2: u.x + dx * 190, y2: u.y + dy * 190, until: this.t + 0.35, color: 'rgba(255,110,40,0.75)' });
        for (const e of enemies(u.x + dx * 105, u.y + dy * 105, 130)) { abilityHit(e, 60 + L * 18 + AP * 0.75, 'magic'); this.sparks(e.x, e.y - 8, '#ff7030', 4, 100); }
        break;
      }
      case 'moltenshield': this.addBuff(u, 'shield', 5, 40 + L * 12 + AP * 0.4); this.addBuff(u, 'moltenshield', 5); break;
      case 'tibbers': {
        const d0 = dist(u.x, u.y, tx, ty); const px2 = d0 > 260 ? u.x + (tx - u.x) / d0 * 260 : tx, py2 = d0 > 260 ? u.y + (ty - u.y) / d0 * 260 : ty;
        // EXPLOSÃO ESPETACULAR — dupla explosão + faíscas flamejantes por todo lado
        this.fx.push({ kind: 'ultimateBurst', x: px2, y: py2, r: 150, until: this.t + 0.7, dur: 0.7, color: '#ff6020' });
        this.fx.push({ kind: 'explosion', x: px2, y: py2, r: 100, until: this.t + 0.5, dur: 0.5, color: '#ff8040' });
        this.fx.push({ kind: 'shockwave', x: px2, y: py2, r: 180, until: this.t + 0.55, dur: 0.55, color: '#ffb060' });
        this.fx.push({ kind: 'shockwave', x: px2, y: py2, r: 230, until: this.t + 0.7, dur: 0.7, color: '#ff6020' });
        this.fx.push({ kind: 'ring', x: px2, y: py2, r: 130, until: this.t + 0.6, dur: 0.6, color: '#ff6020' });
        // brasas voando em todas as direções
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          this.fx.push({ kind: 'ember', x: px2, y: py2, size: 4,
            vx: Math.cos(a) * 180, vy: Math.sin(a) * 180 - 60,
            until: this.t + 0.7, dur: 0.7, color: '#ff8040' });
        }
        this.sparks(px2, py2, '#ff6020', 30, 280);
        this.shake(9, 0.5);
        this.hitStop = Math.max(this.hitStop, 0.06);
        this.screenFlash('#ff4020', 0.5, 0.4);
        for (const e of enemies(px2, py2, 130)) abilityHit(e, 120 + rlvl * 90 + AP * 0.8, 'magic');
        this.zones.push({ x: px2, y: py2, r: 120, until: this.t + 4, team: u.team as Team, src: u, color: 'rgba(255,90,30,0.25)', dps: 20 + AP * 0.15, magic: true, tickT: 0, kind: 'fire' });
        break;
      }
      case 'rangerfocus': this.addBuff(u, 'aspd', 4, 0.5); break;
      case 'volley': {
        const [dx, dy] = dirTo(tx, ty); const base = Math.atan2(dy, dx);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.13;
          this.projs.push({
            x: u.x, y: u.y - 10, tx: u.x + Math.cos(a) * 340, ty: u.y + Math.sin(a) * 340, speed: 480, team: u.team, src: u,
            color: '#bfe8ff', size: 4, kind: 'skill', hitRadius: 14, maxDist: 340, traveled: 0, dx: Math.cos(a), dy: Math.sin(a),
            onHit: v => { if (v) { abilityHit(v, 30 + L * 10 + AD * 0.9, 'phys'); this.addBuff(v, 'slow', 2, 0.4, u); this.sparks(v.x, v.y - 6, '#bfe8ff', 3, 80); } },
          });
        }
        break;
      }
      case 'hawkshot':
        this.hawkPing = { x: tx, y: ty, until: this.t + 6 };
        this.fx.push({ kind: 'ring', x: tx, y: ty, r: 200, until: this.t + 6, color: '#a0e0ff' });
        this.text(u.x, u.y - 46, 'Falcão enviado!', '#a0e0ff');
        break;
      case 'crystalarrow': {
        const [dx, dy] = dirTo(tx, ty);
        // efeito de conjuração: cristais formando a flecha
        this.fx.push({ kind: 'iceshatter', x: u.x, y: u.y - 10, r: 40, until: this.t + 0.4, dur: 0.4, color: '#80e0ff' });
        this.fx.push({ kind: 'runes', x: u.x, y: u.y, r: 45, until: this.t + 0.5, dur: 0.5, color: '#80e0ff' });
        this.screenFlash('#80e0ff', 0.25, 0.2, false);
        this.projs.push({
          x: u.x, y: u.y - 10, tx: u.x + dx * 4200, ty: u.y + dy * 4200, speed: 580, team: u.team, src: u, color: '#80e0ff', size: 12,
          kind: 'bigarrow', hitRadius: 24, maxDist: 4200, traveled: 0, dx, dy, pierceHeroOnly: true,
          onHit: v => {
            if (v && v.kind === 'hero') {
              const dd = dist(u.x, u.y, v.x, v.y);
              this.addBuff(v, 'stun', clamp(dd / 800, 1, 3.5));
              abilityHit(v, 150 + rlvl * 100 + AP * 0.9, 'magic');
              // impacto ÉPICO da flecha
              this.fx.push({ kind: 'iceshatter', x: v.x, y: v.y - 8, r: 60, until: this.t + 0.5, dur: 0.5, color: '#80e0ff' });
              this.fx.push({ kind: 'explosion', x: v.x, y: v.y - 8, r: 70, until: this.t + 0.5, dur: 0.5, color: '#80e0ff' });
              this.fx.push({ kind: 'shockwave', x: v.x, y: v.y, r: 120, until: this.t + 0.5, dur: 0.5, color: '#c0f0ff' });
              this.sparks(v.x, v.y - 8, '#80e0ff', 18, 220);
              this.hitStop = Math.max(this.hitStop, 0.08);
              this.screenFlash('#80e0ff', 0.3, 0.25, false);
              for (const e of enemyHeroes(v.x, v.y, 120)) if (e !== v) abilityHit(e, (150 + rlvl * 100) / 2, 'magic');
            }
          },
        });
        break;
      }
      case 'alphastrike': {
        const v = this.pickTarget(u, tx, ty, ab.range + 60);
        if (!v) { u.cds[slot] = 1; if (u.maxMp) u.mp += ab.mana; break; }
        this.addBuff(u, 'invuln', 0.5);
        const list = [v, ...enemies(v.x, v.y, 140).filter(e => e !== v).slice(0, 3)];
        for (const e of list) { this.fx.push({ kind: 'slash', x: e.x, y: e.y - 6, r: 18, until: this.t + 0.4, color: '#c0f0ff' }); abilityHit(e, 30 + L * 14 + AD * 0.9, 'phys'); }
        const [nx, ny] = nearestWalkable(v.x + rnd(-30, 30), v.y + rnd(-30, 30));
        u.x = nx; u.y = ny; u.moveTgt = null;
        this.sparks(u.x, u.y - 8, '#c0f0ff', 6, 120);
        break;
      }
      case 'meditate': this.addBuff(u, 'meditate', 3); this.addBuff(u, 'dr', 3, 0.5); u.moveTgt = null; break;
      case 'wuju': this.addBuff(u, 'wuju', 5); break;
      case 'highlander': this.addBuff(u, 'speed', 8, 0.4); this.addBuff(u, 'aspd', 8, 0.4); this.addBuff(u, 'highlanderR', 8); u.buffs = u.buffs.filter(b => b.key !== 'slow'); break;
      case 'overload': skillshot('#80a0ff', 6, 560, 300, 16, v => { abilityHit(v, 45 + L * 12 + AP * 0.5 + u.maxMp * 0.04, 'magic'); this.sparks(v.x, v.y - 8, '#80a0ff', 4, 100); }); break;
      case 'runeprison': {
        const v = this.pickTarget(u, tx, ty, ab.range + 40);
        if (v) { this.addBuff(v, 'root', 1.5, 0, u); abilityHit(v, 50 + L * 14 + AP * 0.6, 'magic'); this.fx.push({ kind: 'prison', x: v.x, y: v.y, until: this.t + 1.5, color: '#8060ff' }); }
        else u.cds[slot] = 1;
        break;
      }
      case 'spellflux': {
        const v = this.pickTarget(u, tx, ty, ab.range + 40);
        if (v) { abilityHit(v, 45 + L * 12 + AP * 0.55, 'magic'); this.sparks(v.x, v.y - 8, '#b090ff', 4, 100); v.mr = Math.max(0, v.mr - 12); this.delayed.push({ at: this.t + 4, fn: () => { v.mr += 12; } }); }
        else u.cds[slot] = 1;
        break;
      }
      case 'desperatepower': this.addBuff(u, 'despower', 6); this.addBuff(u, 'speed', 6, 0.25); break;
      case 'blindingdart': {
        const v = this.pickTarget(u, tx, ty, ab.range + 40);
        if (v) {
          this.projs.push({
            x: u.x, y: u.y - 12, tx: v.x, ty: v.y, target: v, speed: 440, team: u.team, src: u, color: '#c0ff60', size: 5,
            kind: 'dart', hitRadius: 16, maxDist: 999, traveled: 0, dx: 0, dy: 0,
            onHit: h => { if (h) { abilityHit(h, 50 + L * 15 + AP * 0.8, 'magic'); this.addBuff(h, 'blind', 2); this.text(h.x, h.y - 40, 'Cego!', '#c0ff60'); } },
          });
        } else u.cds[slot] = 1;
        break;
      }
      case 'movequick': this.addBuff(u, 'speed', 4, 0.4); break;
      case 'toxicshot': this.addBuff(u, 'toxic', 6); break;
      case 'shroom': {
        const d0 = dist(u.x, u.y, tx, ty); const px2 = d0 > 160 ? u.x + (tx - u.x) / d0 * 160 : tx, py2 = d0 > 160 ? u.y + (ty - u.y) / d0 * 160 : ty;
        this.zones.push({ x: px2, y: py2, r: 55, until: this.t + 60, team: u.team as Team, src: u, color: 'rgba(120,200,60,0.6)', dps: 30 + AP * 0.25, magic: true, tickT: 0, kind: 'shroom', trap: true, armT: this.t + 1 });
        break;
      }
      case 'lightbinding': {
        skillshot('#ffe880', 7, 480, 330, 18, v => { this.addBuff(v, 'root', 1.5, 0, u); abilityHit(v, 50 + L * 14 + AP * 0.6, 'magic'); this.fx.push({ kind: 'prison', x: v.x, y: v.y, until: this.t + 1.5, color: '#ffe880' }); }, true);
        break;
      }
      case 'prismatic': {
        const sh = 40 + L * 10 + AP * 0.35;
        this.addBuff(u, 'shield', 3, sh);
        for (const a of this.heroes.filter(h => h.team === u.team && h !== u && !h.dead && dist(h.x, h.y, u.x, u.y) < 220)) this.addBuff(a, 'shield', 3, sh);
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 60, until: this.t + 0.5, color: '#ffe8a0' });
        break;
      }
      case 'lucent': {
        this.zones.push({ x: tx, y: ty, r: 100, until: this.t + 1.2, team: u.team as Team, src: u, color: 'rgba(255,230,140,0.3)', dps: 0, magic: true, tickT: 0, slow: 0.3, kind: 'lucent' });
        this.delayed.push({
          at: this.t + 1.2, fn: () => {
            this.fx.push({ kind: 'ring', x: tx, y: ty, r: 100, until: this.t + 0.4, color: '#ffe880' });
            this.sparks(tx, ty, '#ffe880', 8, 150);
            for (const e of enemies(tx, ty, 100)) abilityHit(e, 60 + L * 16 + AP * 0.7, 'magic');
          },
        });
        break;
      }
      case 'finalspark': {
        const [dx, dy] = dirTo(tx, ty);
        const ex = u.x + dx * 1000, ey = u.y + dy * 1000;
        // LASER GIGANTE — pilar duplo + explosão na origem + faíscas ao longo do caminho
        this.fx.push({ kind: 'laser', x: u.x, y: u.y, x2: ex, y2: ey, until: this.t + 0.65, dur: 0.65, color: '#fff0a0' });
        this.fx.push({ kind: 'laser', x: u.x, y: u.y, x2: ex, y2: ey, until: this.t + 0.35, dur: 0.35, color: '#ffffff' });
        this.fx.push({ kind: 'starBurst', x: u.x, y: u.y - 10, r: 80, until: this.t + 0.5, dur: 0.5, color: '#fff8c0' });
        this.fx.push({ kind: 'runes', x: u.x, y: u.y + 8, r: 50, until: this.t + 0.7, dur: 0.7, color: '#fff0a0' });
        // faíscas descendo ao longo do laser
        for (let i = 1; i < 10; i++) {
          const t2 = i / 10;
          this.delayed.push({
            at: this.t + t2 * 0.1, fn: () => {
              const px = u.x + dx * 1000 * t2, py = u.y + dy * 1000 * t2;
              this.fx.push({ kind: 'starBurst', x: px, y: py, r: 20, until: this.t + 0.3, dur: 0.3, color: '#fff8c0' });
            }
          });
        }
        this.shake(7, 0.4);
        this.screenFlash('#fff0a0', 0.45, 0.35, false);
        this.hitStop = Math.max(this.hitStop, 0.05);
        for (const e of this.units.filter(e2 => !e2.dead && e2.team !== u.team && !['tower', 'inhib', 'nexus'].includes(e2.kind))) {
          const t2 = clamp(((e.x - u.x) * dx + (e.y - u.y) * dy) / 1000, 0, 1);
          const px3 = u.x + dx * 1000 * t2, py3 = u.y + dy * 1000 * t2;
          if (dist(e.x, e.y, px3, py3) < 45 + e.r) { abilityHit(e, 150 + rlvl * 100 + AP * 0.85, 'magic'); this.sparks(e.x, e.y - 8, '#fff0a0', 8, 160); }
        }
        break;
      }
      case 'decimate': {
        this.fx.push({ kind: 'spinfx', x: u.x, y: u.y, r: 115, until: this.t + 0.4, color: '#ff6050' });
        let heroesHit = 0;
        for (const e of enemies(u.x, u.y, 115)) { abilityHit(e, 45 + L * 13 + AD * 0.8, 'phys'); if (e.kind === 'hero') heroesHit++; }
        if (heroesHit > 0) { this.heal(u, (u.maxHp - u.hp) * 0.12 * heroesHit); this.text(u.x, u.y - 48, '+ Cura', '#60e080'); }
        break;
      }
      case 'cripplingstrike': this.addBuff(u, 'cripple', 4.5); break;
      case 'apprehend': {
        const [dx, dy] = dirTo(tx, ty);
        this.fx.push({ kind: 'cone', x: u.x, y: u.y, x2: u.x + dx * 170, y2: u.y + dy * 170, until: this.t + 0.3, color: 'rgba(200,60,60,0.6)' });
        for (const e of enemies(u.x + dx * 110, u.y + dy * 110, 120)) {
          const [nx2, ny2] = nearestWalkable(u.x + dx * 45, u.y + dy * 45);
          e.x = nx2; e.y = ny2; this.addBuff(e, 'slow', 1, 0.4, u);
        }
        break;
      }
      case 'guillotine': {
        const v = this.pickTarget(u, tx, ty, ab.range + 60, true);
        if (v) {
          const [nx2, ny2] = nearestWalkable(v.x + rnd(-25, 25), v.y + rnd(-25, 25));
          u.x = nx2; u.y = ny2;
          const bleed = v.buffs.find(b => b.key === 'bleed');
          const stacks = bleed?.stacks ?? 0;
          // EXECUÇÃO SANGRENTA — machado brutal + explosão de sangue
          this.fx.push({ kind: 'sword', x: v.x, y: v.y, until: this.t + 0.6, color: '#ff2020' });
          this.fx.push({ kind: 'bloodslash', x: v.x, y: v.y - 8, r: 32, until: this.t + 0.4, dur: 0.4, color: '#ff2040', vx: 0 });
          this.fx.push({ kind: 'explosion', x: v.x, y: v.y - 8, r: 50, until: this.t + 0.5, dur: 0.5, color: '#c02040' });
          // gotas de sangue voando
          for (let i = 0; i < 12; i++) {
            const a = rnd(0, Math.PI * 2);
            this.fx.push({ kind: 'ember', x: v.x, y: v.y - 8, size: 4,
              vx: Math.cos(a) * 140, vy: Math.sin(a) * 140 - 30,
              until: this.t + 0.6, dur: 0.6, color: '#c02040' });
          }
          this.screenFlash('#ff2020', 0.3, 0.3, false);
          this.hitStop = Math.max(this.hitStop, 0.1);
          this.shake(6, 0.35);
          abilityHit(v, (100 + rlvl * 110) * (1 + stacks * 0.2), 'true');
          this.sparks(v.x, v.y - 8, '#ff4040', 10, 180);
          if (v.dead) { u.cds.R = 0; this.text(u.x, u.y - 50, 'GUILHOTINA!', '#ff4040'); }
        } else u.cds[slot] = 1;
        break;
      }
      case 'bouncingblade': {
        const first = this.pickTarget(u, tx, ty, ab.range + 40);
        if (!first) { u.cds[slot] = 1; break; }
        let prev: Unit = u; let cur: Unit | null = first; let mult = 1; const hitSet = new Set<Unit>();
        for (let i = 0; i < 3 && cur; i++) {
          const from = prev, to = cur;
          this.delayed.push({ at: this.t + i * 0.18, fn: () => { if (!to.dead) { this.fx.push({ kind: 'beam', x: from.x, y: from.y - 10, x2: to.x, y2: to.y - 10, until: this.t + 0.15, color: '#e0e8f0' }); abilityHit(to, (40 + L * 12 + AD * 0.55 + AP * 0.4) * mult, 'magic'); this.sparks(to.x, to.y - 8, '#e0e8f0', 3, 90); } } });
          hitSet.add(cur); prev = cur; mult *= 0.85;
          cur = enemies(cur.x, cur.y, 170).filter(e => !hitSet.has(e))[0] ?? null;
        }
        break;
      }
      case 'sinistersteel': {
        this.fx.push({ kind: 'spinfx', x: u.x, y: u.y, r: 105, until: this.t + 0.35, color: '#d0d8e0' });
        let hitHero = false;
        for (const e of enemies(u.x, u.y, 105)) { abilityHit(e, 40 + L * 11 + AD * 0.6 + AP * 0.3, 'magic'); if (e.kind === 'hero') hitHero = true; }
        if (hitHero) this.addBuff(u, 'speed', 1.5, 0.35);
        break;
      }
      case 'shunpo': {
        const d0 = dist(u.x, u.y, tx, ty); const px2 = d0 > 280 ? u.x + (tx - u.x) / d0 * 280 : tx, py2 = d0 > 280 ? u.y + (ty - u.y) / d0 * 280 : ty;
        const [nx2, ny2] = nearestWalkable(px2, py2);
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.3, color: '#c05060' });
        this.sparks(u.x, u.y - 8, '#c05060', 5, 100);
        u.x = nx2; u.y = ny2; u.moveTgt = null;
        const v = enemies(u.x, u.y, 110)[0];
        if (v) { abilityHit(v, 50 + L * 13 + AD * 0.5 + AP * 0.4, 'magic'); this.sparks(v.x, v.y - 8, '#e0e8f0', 5, 120); }
        break;
      }
      case 'deathlotus': this.addBuff(u, 'lotus', 2); u.moveTgt = null; break;
      case 'rocketgrab': {
        skillshot('#ffd040', 8, 520, 330, 20, v => {
          this.addBuff(v, 'stun', 0.7);
          abilityHit(v, 60 + L * 16 + AP * 0.8, 'magic');
          if (!['tower', 'inhib', 'nexus'].includes(v.kind)) {
            const [nx2, ny2] = nearestWalkable(u.x + (v.x - u.x > 0 ? 35 : -35), u.y + (v.y - u.y > 0 ? 25 : -25));
            v.x = nx2; v.y = ny2;
          }
          this.sparks(v.x, v.y - 8, '#ffd040', 6, 130);
          this.text(v.x, v.y - 40, 'Fisgado!', '#ffd040');
        });
        break;
      }
      case 'overdrive': this.addBuff(u, 'aspd', 5, 0.7); this.addBuff(u, 'speed', 5, 0.3); break;
      case 'powerfist': this.addBuff(u, 'powerfist', 4.5); break;
      case 'staticfield': {
        // TEMPESTADE ELÉTRICA — múltiplas camadas de choque + raios em todos os inimigos
        this.fx.push({ kind: 'ultimateBurst', x: u.x, y: u.y, r: 170, until: this.t + 0.7, dur: 0.7, color: '#60c0ff' });
        this.fx.push({ kind: 'nova', x: u.x, y: u.y - 10, r: 130, until: this.t + 0.5, dur: 0.5, color: '#80d0ff' });
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 170, until: this.t + 0.5, dur: 0.5, color: '#80d0ff' });
        this.fx.push({ kind: 'shockwave', x: u.x, y: u.y, r: 200, until: this.t + 0.6, dur: 0.6, color: '#a0e0ff' });
        // pequenos raios secundários (arco elétrico ao redor)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.fx.push({
            kind: 'lightning', x: u.x, y: u.y - 10,
            x2: u.x + Math.cos(a) * 80, y2: u.y - 10 + Math.sin(a) * 80,
            until: this.t + 0.3, dur: 0.3, color: '#a0e0ff'
          });
        }
        this.shake(7, 0.4);
        this.screenFlash('#60c0ff', 0.4, 0.35);
        this.hitStop = Math.max(this.hitStop, 0.06);
        for (const e of enemies(u.x, u.y, 170)) {
          abilityHit(e, 120 + rlvl * 90 + AP * 0.9, 'magic');
          this.addBuff(e, 'silence', 0.8);
          this.fx.push({ kind: 'lightning', x: u.x, y: u.y - 10, x2: e.x, y2: e.y - 8, until: this.t + 0.3, dur: 0.3, color: '#a0e0ff' });
        }
        break;
      }
      case 'hungeringstrike': {
        const v = this.pickTarget(u, tx, ty, 130);
        if (v) {
          const dmg = Math.max(60 + L * 18 + AP * 0.6, v.kind === 'hero' ? v.maxHp * 0.08 : 0);
          const dealt = abilityHit(v, dmg, 'magic');
          this.heal(u, dealt * 0.8);
          this.sparks(v.x, v.y - 8, '#a0e060', 5, 110);
        } else u.cds[slot] = 1;
        break;
      }
      case 'bloodscent': this.addBuff(u, 'aspd', 6, 0.4); this.addBuff(u, 'speed', 6, 0.2); break;
      case 'terrorhowl':
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 140, until: this.t + 0.4, color: '#a080d0' });
        for (const e of enemyHeroes(u.x, u.y, 140)) { this.addBuff(e, 'fear', 1, 0, u); this.text(e.x, e.y - 42, 'APAVORADO!', '#b080e0'); }
        break;
      case 'infiniteduress': {
        const v = this.pickTarget(u, tx, ty, ab.range + 40, true);
        if (v) {
          const [nx2, ny2] = nearestWalkable(v.x + 25, v.y);
          u.x = nx2; u.y = ny2;
          this.addBuff(v, 'stun', 1.8, 0, u);
          for (let i = 0; i < 4; i++) this.delayed.push({ at: this.t + 0.3 + i * 0.4, fn: () => { if (!v.dead && !u.dead) { const dd = abilityHit(v, 40 + rlvl * 35 + AD * 0.35, 'magic'); this.heal(u, dd * 0.5); this.sparks(v.x, v.y - 8, '#a0e060', 3, 100); } } });
        } else u.cds[slot] = 1;
        break;
      }
      case 'darkbinding': skillshot('#a060e0', 7, 420, 330, 18, v => { this.addBuff(v, 'root', 2, 0, u); abilityHit(v, 55 + L * 15 + AP * 0.75, 'magic'); this.fx.push({ kind: 'prison', x: v.x, y: v.y, until: this.t + 2, color: '#a060e0' }); }); break;
      case 'tormentedsoil':
        this.zones.push({ x: tx, y: ty, r: 105, until: this.t + 5, team: u.team as Team, src: u, color: 'rgba(140,60,200,0.28)', dps: 20 + L * 3 + AP * 0.2, magic: true, tickT: 0, kind: 'soil' });
        break;
      case 'blackshield': {
        const allies = this.heroes.filter(h => h.team === u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < 260);
        const target2 = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u;
        this.addBuff(target2, 'bshield', 4, 50 + L * 14 + AP * 0.7);
        this.fx.push({ kind: 'ring', x: target2.x, y: target2.y, r: 30, until: this.t + 0.5, color: '#6060a0' });
        break;
      }
      case 'soulshackles': {
        const victims = enemyHeroes(u.x, u.y, 260);
        for (const v of victims) {
          this.fx.push({ kind: 'chain', x: u.x, y: u.y, x2: v.x, y2: v.y, until: this.t + 1.5, color: '#c080ff' });
          abilityHit(v, 80 + rlvl * 70 + AP * 0.6, 'magic'); this.addBuff(v, 'slow', 1.5, 0.2, u);
        }
        this.delayed.push({
          at: this.t + 1.5, fn: () => {
            for (const v of victims) if (!v.dead && !u.dead && dist(u.x, u.y, v.x, v.y) < 340) { this.addBuff(v, 'stun', 1.5); this.dealDamage(u, v, 80 + rlvl * 70 + AP * 0.6, 'magic', { ability: true }); this.sparks(v.x, v.y - 8, '#c080ff', 5, 120); }
          },
        });
        break;
      }
      // ============ HABILIDADES GENÉRICAS (10 heróis novos) ============
      case 'frostarrow': skillshot('#80c0e0', 6, 480, 260, 16, v => { abilityHit(v, 50 + L * 14 + AP * 0.6, 'magic'); this.addBuff(v, 'root', 1, 0, u); this.sparks(v.x, v.y - 8, '#80c0e0', 5, 110); }); break;
      case 'frostring': this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 110, until: this.t + 0.5, color: '#80c0e0' }); for (const e of enemies(u.x, u.y, 110)) { abilityHit(e, 45 + L * 12 + AP * 0.5, 'magic'); this.addBuff(e, 'root', 1.5, 0, u); this.sparks(e.x, e.y - 8, '#80c0e0', 4, 100); } break;
      case 'blizzard': this.zones.push({ x: tx, y: ty, r: 110, until: this.t + 3, team: u.team as Team, src: u, color: 'rgba(128,192,224,0.3)', dps: 30 + AP * 0.15, magic: true, tickT: 0, slow: 0.3, kind: 'blizzard' }); this.fx.push({ kind: 'ring', x: tx, y: ty, r: 110, until: this.t + 0.5, color: '#80c0e0' }); break;
      case 'freeze': { const v = this.pickTarget(u, tx, ty, ab.range + 40, true); if (v) { abilityHit(v, 150 + rlvl * 100 + AP * 0.8, 'magic'); this.addBuff(v, 'stun', 3); this.fx.push({ kind: 'ring', x: v.x, y: v.y, r: 40, until: this.t + 0.6, color: '#80c0e0' }); this.sparks(v.x, v.y - 8, '#80c0e0', 10, 150); } else u.cds[slot] = 0.5; break; }
      case 'deathhook': skillshot('#5a8a5a', 8, 520, 330, 20, v => { this.addBuff(v, 'stun', 0.7); abilityHit(v, 60 + L * 16 + AP * 0.8, 'magic'); if (!['tower', 'inhib', 'nexus'].includes(v.kind)) { const [nx2, ny2] = nearestWalkable(u.x + (v.x - u.x > 0 ? 35 : -35), u.y + (v.y - u.y > 0 ? 25 : -25)); v.x = nx2; v.y = ny2; } this.text(v.x, v.y - 40, 'Fisgado!', '#5a8a5a'); }); break;
      case 'darkcage': { const v = this.pickTarget(u, tx, ty, ab.range + 40); if (v) { this.addBuff(v, 'root', 2, 0, u); this.fx.push({ kind: 'ring', x: v.x, y: v.y, r: 50, until: this.t + 2, color: '#5a8a5a' }); abilityHit(v, 40 + L * 10 + AP * 0.4, 'magic'); } else u.cds[slot] = 0.5; break; }
      case 'flay': this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 130, until: this.t + 0.4, color: '#5a8a5a' }); for (const e of enemies(u.x, u.y, 130)) { abilityHit(e, 50 + L * 12 + AP * 0.5, 'phys'); const [nx2, ny2] = nearestWalkable(u.x + (e.x - u.x > 0 ? -30 : 30), u.y + (e.y - u.y > 0 ? -30 : 30)); if (!['tower', 'inhib', 'nexus'].includes(e.kind)) { e.x = nx2; e.y = ny2; } } break;
      case 'gate': { const [nx2, ny2] = isWalkable(tx, ty) ? [tx, ty] : nearestWalkable(tx, ty); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.5, color: '#5a8a5a' }); u.x = nx2; u.y = ny2; u.moveTgt = null; this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.5, color: '#5a8a5a' }); this.sparks(u.x, u.y - 8, '#5a8a5a', 8, 120); break; }
      case 'switcheroo': { u.buffs = u.buffs.filter(b => b.key !== 'minigun' && b.key !== 'rocket'); if (this.hasBuff(u, 'minigun')) { u.buffs = u.buffs.filter(b => b.key !== 'minigun'); this.addBuff(u, 'rocket', 999); u.atkRange = 250; this.text(u.x, u.y - 44, 'Canhão de Foguetes!', '#e04040'); } else { u.buffs = u.buffs.filter(b => b.key !== 'rocket'); this.addBuff(u, 'minigun', 999); this.addBuff(u, 'aspd', 999, 0.5); u.atkRange = 185; this.text(u.x, u.y - 44, 'Minigun!', '#e0a040'); } break; }
      case 'zap': skillshot('#e0a040', 5, 540, 280, 14, v => { abilityHit(v, 40 + L * 12 + AP * 0.5, 'magic'); this.fx.push({ kind: 'ring', x: v.x, y: v.y, r: 60, until: this.t + 2, color: 'rgba(224,160,64,0.3)' }); }); break;
      case 'flamechompers': this.zones.push({ x: tx, y: ty, r: 80, until: this.t + 4, team: u.team as Team, src: u, color: 'rgba(224,80,40,0.3)', dps: 25 + AP * 0.1, magic: true, tickT: 0, slow: 0.3, kind: 'trap', trap: true, armT: this.t + 0.5 }); break;
      case 'superrocket': { const [dx, dy] = dirTo(tx, ty); this.projs.push({ x: u.x, y: u.y - 10, tx: u.x + dx * 4200, ty: u.y + dy * 4200, speed: 600, team: u.team, src: u, color: '#e04040', size: 12, kind: 'bigarrow', hitRadius: 30, maxDist: 4200, traveled: 0, dx, dy, pierceHeroOnly: true, onHit: v => { if (v && v.kind === 'hero') { abilityHit(v, 200 + rlvl * 120 + AP * 0.9, 'magic'); this.sparks(v.x, v.y - 8, '#e04040', 12, 180); for (const e of enemyHeroes(v.x, v.y, 140)) if (e !== v) abilityHit(e, (200 + rlvl * 120) / 2, 'magic'); } } }); break; }
      case 'steelblade': skillshot('#c0f0ff', 5, 500, 220, 16, v => { abilityHit(v, 40 + L * 12 + AD * 0.6, 'phys'); this.sparks(v.x, v.y - 8, '#c0f0ff', 4, 100); }); break;
      case 'windwall': this.addBuff(u, 'windwall', 4); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 80, until: this.t + 4, color: '#c0f0ff' }); break;
      case 'sweepingblade': { const v = this.pickTarget(u, tx, ty, ab.range + 40); if (v) { const [nx2, ny2] = nearestWalkable(v.x + rnd(-20, 20), v.y + rnd(-20, 20)); u.x = nx2; u.y = ny2; abilityHit(v, 50 + L * 14 + AD * 0.5, 'phys'); this.sparks(v.x, v.y - 8, '#c0f0ff', 5, 110); } else u.cds[slot] = 0.5; break; }
      case 'lastbreath': { const v = this.pickTarget(u, tx, ty, ab.range + 40, true); if (v) { this.addBuff(v, 'stun', 1.5, 0, u); const [nx2, ny2] = nearestWalkable(v.x + 20, v.y); u.x = nx2; u.y = ny2; abilityHit(v, 200 + rlvl * 100 + AD * 1.0, 'phys'); this.fx.push({ kind: 'sword', x: v.x, y: v.y, until: this.t + 0.5, color: '#c0f0ff' }); this.sparks(v.x, v.y - 8, '#c0f0ff', 10, 160); } else u.cds[slot] = 0.5; break; }
      case 'razorshuriken': { const [dx, dy] = dirTo(tx, ty); for (let i = -1; i <= 1; i++) { const a = Math.atan2(dy, dx) + i * 0.2; this.projs.push({ x: u.x, y: u.y - 10, tx: u.x + Math.cos(a) * 260, ty: u.y + Math.sin(a) * 260, speed: 500, team: u.team, src: u, color: '#c04040', size: 5, kind: 'skill', hitRadius: 16, maxDist: 260, traveled: 0, dx: Math.cos(a), dy: Math.sin(a), onHit: v => { if (v) abilityHit(v, 35 + L * 10 + AD * 0.5, 'phys'); } }); } break; }
      case 'livingshadow': { const [nx2, ny2] = isWalkable(tx, ty) ? [tx, ty] : nearestWalkable(tx, ty); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.3, color: '#c04040' }); u.x = nx2; u.y = ny2; u.moveTgt = null; this.addBuff(u, 'invis', 1.5); this.sparks(u.x, u.y - 8, '#c04040', 6, 120); break; }
      case 'shadowslash': this.fx.push({ kind: 'spinfx', x: u.x, y: u.y, r: 100, until: this.t + 0.35, color: '#c04040' }); for (const e of enemies(u.x, u.y, 100)) { abilityHit(e, 45 + L * 12 + AD * 0.5, 'phys'); this.addBuff(e, 'slow', 1.5, 0.3, u); } break;
      case 'deathmark': { const v = this.pickTarget(u, tx, ty, ab.range + 40, true); if (v) { this.addBuff(v, 'shadowmark', 3, 0, u); this.addBuff(u, 'invuln', 0.75); this.fx.push({ kind: 'ring', x: v.x, y: v.y, r: 40, until: this.t + 0.5, color: '#c04040' }); this.delayed.push({ at: this.t + 3, fn: () => { if (!v.dead) { abilityHit(v, 150 + rlvl * 100 + AD * 0.8, 'phys'); this.sparks(v.x, v.y - 8, '#c04040', 10, 160); } } }); } else u.cds[slot] = 0.5; break; }
      case 'silversona': skillshot('#e8c040', 6, 500, 240, 16, v => { abilityHit(v, 45 + L * 12 + AP * 0.6, 'magic'); this.heal(u, 30 + L * 8); this.sparks(v.x, v.y - 8, '#e8c040', 4, 100); }); break;
      case 'haste': this.addBuff(u, 'aspd', 5, 0.3); this.addBuff(u, 'speed', 5, 0.2); for (const a of this.heroes.filter(h => h.team === u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < 200)) { this.addBuff(a, 'aspd', 5, 0.3); this.addBuff(a, 'speed', 5, 0.2); } this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 60, until: this.t + 0.5, color: '#e8c040' }); break;
      case 'sonicwave': this.fx.push({ kind: 'cone', x: u.x, y: u.y, x2: u.x + dirTo(tx, ty)[0] * 200, y2: u.y + dirTo(tx, ty)[1] * 200, until: this.t + 0.35, color: 'rgba(232,192,64,0.6)' }); for (const e of enemies(u.x + dirTo(tx, ty)[0] * 100, u.y + dirTo(tx, ty)[1] * 100, 130)) { abilityHit(e, 50 + L * 14 + AP * 0.6, 'magic'); this.addBuff(e, 'silence', 1.5); } break;
      case 'crescendo': { const [dx, dy] = dirTo(tx, ty); this.fx.push({ kind: 'laser', x: u.x, y: u.y, x2: u.x + dx * 300, y2: u.y + dy * 300, until: this.t + 0.7, color: '#e8c040' }); this.fx.push({ kind: 'starBurst', x: u.x, y: u.y, r: 60, until: this.t + 0.5, color: '#ffe8a0' }); this.shake(5, 0.35); this.screenFlash('#e8a040', 0.4, 0.32); for (const e of this.units.filter(e2 => !e2.dead && e2.team !== u.team && !['tower', 'inhib', 'nexus'].includes(e2.kind))) { const t2 = clamp(((e.x - u.x) * dx + (e.y - u.y) * dy) / 300, 0, 1); const px3 = u.x + dx * 300 * t2, py3 = u.y + dy * 300 * t2; if (dist(e.x, e.y, px3, py3) < 50 + e.r) { abilityHit(e, 150 + rlvl * 100 + AP * 0.8, 'magic'); this.addBuff(e, 'stun', 1.5); this.sparks(e.x, e.y - 8, '#ffe8a0', 8, 160); } } break; }
      case 'voidcall': this.fx.push({ kind: 'vortex', x: tx, y: ty, r: 90, until: this.t + 1.5, color: '#a060e0' }); this.zones.push({ x: tx, y: ty, r: 100, until: this.t + 1.5, team: u.team as Team, src: u, color: 'rgba(128,64,192,0.35)', dps: 0, magic: true, tickT: 0, kind: 'void' }); this.delayed.push({ at: this.t + 1.5, fn: () => { this.fx.push({ kind: 'ultimateBurst', x: tx, y: ty, r: 110, until: this.t + 0.6, color: '#8040c0' }); this.sparks(tx, ty, '#c080ff', 14, 180); for (const e of enemies(tx, ty, 100)) { abilityHit(e, 60 + L * 16 + AP * 0.7, 'magic'); this.addBuff(e, 'silence', 1.5); } } }); break;
      case 'voidgate': this.zones.push({ x: tx, y: ty, r: 80, until: this.t + 8, team: u.team as Team, src: u, color: 'rgba(128,64,192,0.25)', dps: 15 + AP * 0.1, magic: true, tickT: 0, kind: 'voidgate' }); break;
      case 'voidwhispers': { const v = this.pickTarget(u, tx, ty, ab.range + 40); if (v) { this.applyDot(u, v, 30 + L * 8 + AP * 0.15, 4, 'voidplague'); this.addBuff(v, 'slow', 2, 0.2, u); } else u.cds[slot] = 0.5; break; }
      case 'nethergrasp': { const v = this.pickTarget(u, tx, ty, ab.range + 40, true); if (v) { this.addBuff(v, 'stun', 2.5, 0, u); this.addBuff(u, 'root', 2.5); this.screenFlash('#8040c0', 0.5, 0.4); for (let i = 0; i < 5; i++) this.delayed.push({ at: this.t + i * 0.5, fn: () => { if (!v.dead && !u.dead) { this.fx.push({ kind: 'beam', x: u.x, y: u.y - 10, x2: v.x, y2: v.y, until: this.t + 0.45, color: '#c080ff' }); this.fx.push({ kind: 'vortex', x: v.x, y: v.y, r: 40, until: this.t + 0.5, color: '#a060e0' }); abilityHit(v, 40 + rlvl * 35 + AP * 0.3, 'magic'); } } }); } else u.cds[slot] = 0.5; break; }
      case 'javelin': skillshot('#e8c860', 6, 600, 320, 16, v => { const d = dist(u.x, u.y, v.x, v.y); abilityHit(v, (50 + L * 14 + AD * 0.7) * (d > 200 ? 1.5 : 1), 'phys'); this.sparks(v.x, v.y - 8, '#e8c860', 5, 110); }); break;
      case 'bushwhack': this.zones.push({ x: tx, y: ty, r: 60, until: this.t + 60, team: u.team as Team, src: u, color: 'rgba(232,200,96,0.4)', dps: 20 + AP * 0.1, magic: true, tickT: 0, kind: 'trap', trap: true, armT: this.t + 0.5 }); break;
      case 'primalheal': { const v = this.pickTarget(u, tx, ty, ab.range + 40); if (v && v.team === u.team) { this.heal(v, 80 + L * 20 + AP * 0.5); this.fx.push({ kind: 'ring', x: v.x, y: v.y, r: 30, until: this.t + 0.5, color: '#80e080' }); } else if (v) { abilityHit(v, 60 + L * 14 + AP * 0.5, 'magic'); } else { this.heal(u, 80 + L * 20 + AP * 0.5); } break; }
      case 'pumaform': this.addBuff(u, 'puma', 10); this.addBuff(u, 'speed', 10, 0.4); this.addBuff(u, 'aspd', 10, 0.3); this.text(u.x, u.y - 44, 'Forma de Puma!', '#e8c860'); this.sparks(u.x, u.y - 8, '#e8c860', 8, 120); break;
      case 'voraxblade': skillshot('#e04040', 5, 500, 220, 16, v => { abilityHit(v, 40 + L * 12 + AD * 0.6, 'phys'); this.sparks(v.x, v.y - 8, '#e04040', 4, 100); }); break;
      case 'smokebomb': this.addBuff(u, 'invis', 4); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 80, until: this.t + 0.5, color: '#888' }); this.text(u.x, u.y - 44, 'Invisível!', '#aaa'); break;
      case 'shurikenflip': { const v = this.pickTarget(u, tx, ty, ab.range + 40); if (v) { const [nx2, ny2] = nearestWalkable(v.x + rnd(-20, 20), v.y + rnd(-20, 20)); u.x = nx2; u.y = ny2; abilityHit(v, 50 + L * 14 + AD * 0.5, 'phys'); this.sparks(v.x, v.y - 8, '#e04040', 5, 110); } else u.cds[slot] = 0.5; break; }
      case 'execution': { const v = this.pickTarget(u, tx, ty, ab.range + 40, true); if (v) { const [nx2, ny2] = nearestWalkable(v.x + 20, v.y); u.x = nx2; u.y = ny2; abilityHit(v, 150 + rlvl * 100 + AD * 0.9, 'phys'); this.fx.push({ kind: 'sword', x: v.x, y: v.y, until: this.t + 0.5, color: '#e04040' }); this.sparks(v.x, v.y - 8, '#e04040', 10, 160); if (v.dead) u.cds[slot] = 0; } else u.cds[slot] = 0.5; break; }
      case 'icebreak': skillshot('#a0d0e0', 7, 480, 260, 18, v => { abilityHit(v, 50 + L * 14 + AP * 0.6, 'magic'); this.addBuff(v, 'slow', 2, 0.4, u); this.sparks(v.x, v.y - 8, '#a0d0e0', 5, 110); }); break;
      case 'standbehind': { const allies = this.heroes.filter(h => h.team === u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < 260); const target = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u; const [nx2, ny2] = nearestWalkable(target.x + rnd(-30, 30), target.y + rnd(-30, 30)); u.x = nx2; u.y = ny2; this.addBuff(target, 'shield', 3, 80 + L * 12 + AP * 0.4); this.addBuff(target, 'dr', 3, 0.2); this.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 30, until: this.t + 0.5, color: '#a0d0e0' }); break; }
      case 'glacialfence': this.addBuff(u, 'glacialfence', 3); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 100, until: this.t + 3, color: '#a0d0e0' }); break;
      case 'glacialtremor': this.fx.push({ kind: 'ultimateBurst', x: u.x, y: u.y, r: 200, until: this.t + 0.75, color: '#80c8e8' }); this.fx.push({ kind: 'ringBurst', x: u.x, y: u.y, r: 220, until: this.t + 0.6, color: '#a0e8ff' }); this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 200, until: this.t + 0.6, color: '#a0d0e0' }); this.shake(7, 0.45); this.screenFlash('#4080a0', 0.5, 0.38); for (const e of enemies(u.x, u.y, 200)) { abilityHit(e, 120 + rlvl * 80 + AP * 0.7, 'magic'); this.addBuff(e, 'stun', 1); this.addBuff(e, 'slow', 2, 0.4, u); this.sparks(e.x, e.y - 8, '#a0e8ff', 10, 150); } break;
      default:
        // ===== FALLBACK INTELIGENTE: detecta padrões pela descrição =====
        const d = ab.desc.toLowerCase();
        const isUlt = slot === 'R';
        const baseDmg = (isUlt ? 90 : 45) + L * (isUlt ? 16 : 12) + AP * 0.5;
        const isPhys = d.includes('golpe') || d.includes('atac') || d.includes('esmag') || d.includes('corte') || d.includes('punho') || d.includes('garra') || d.includes('boca') || ab.key.includes('phys');
        const dmgType: 'phys' | 'magic' = isPhys ? 'phys' : 'magic';
        const isHeal = d.includes('cura') || d.includes('soro');
        const isShield = d.includes('escudo') || d.includes('protege');
        const isAoE = d.includes('área') || d.includes('redor') || d.includes('todos') || d.includes('ao redor') || ab.range === 0 || d.includes('cone') || d.includes('em volta');
        const isDash = d.includes('avanc') || d.includes('salta') || d.includes('pula') || d.includes('teleporta') || d.includes('avança') || d.includes('rolando') || d.includes('mergulha');
        const isCC = d.includes('atord') || d.includes('prend') || d.includes('congela') || d.includes('silencia') || d.includes('empurra') || d.includes('foge') || d.includes('medo') || d.includes('enraiz');
        const isSlow = d.includes('lentid') || d.includes('desacelera') || d.includes('câmera lenta') || d.includes('congela');
        const col = castCol;

        if (isHeal && slot !== 'Q') {
          // habilidade de cura
          const allies = this.heroes.filter(h => h.team === u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < (ab.range > 0 ? ab.range : 200));
          const target = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u;
          this.heal(target, 60 + L * 18 + AP * 0.4);
          this.fx.push({ kind: 'heal', x: target.x, y: target.y - 10, until: this.t + 0.7, color: '#60ff90' });
          if (isShield) this.addBuff(target, 'shield', 3, 40 + L * 10 + AP * 0.3);
          this.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 30, until: this.t + 0.4, color: '#60e080' });
        } else if (isShield && !isHeal) {
          this.addBuff(u, 'shield', 4, 50 + L * 15 + AP * 0.4);
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 35, until: this.t + 0.5, color: col });
          this.sparks(u.x, u.y - 10, col, 6, 100);
        } else if (isDash) {
          // dash/teleporte
          const d0 = dist(u.x, u.y, tx, ty); const maxD = ab.range > 0 ? ab.range : 180;
          const px2 = d0 > maxD ? u.x + (tx - u.x) / d0 * maxD : tx;
          const py2 = d0 > maxD ? u.y + (ty - u.y) / d0 * maxD : ty;
          const [nx2, ny2] = nearestWalkable(px2, py2);
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.3, color: col });
          u.x = nx2; u.y = ny2; u.moveTgt = null;
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.3, color: col });
          const hitTgt = this.pickTarget(u, u.x, u.y, 100);
          if (hitTgt) abilityHit(hitTgt, baseDmg * 0.7, dmgType);
        } else if (isAoE || isUlt) {
          // AoE / ultimate
          const cx = ab.range === 0 ? u.x : tx;
          const cy = ab.range === 0 ? u.y : ty;
          const rad = isUlt ? 180 : 120;
          this.fx.push({ kind: isUlt ? 'ultimateBurst' : 'explosion', x: cx, y: cy, r: rad, until: this.t + 0.5, color: col });
          if (isUlt) { this.shake(5, 0.3); this.screenFlash(col, 0.35, 0.3); }
          this.sparks(cx, cy, col, 12, 160);
          for (const e of enemies(cx, cy, rad)) {
            abilityHit(e, baseDmg, dmgType);
            if (isCC) { this.addBuff(e, 'stun', 1.2); this.text(e.x, e.y - 40, 'Atordoado!', '#ffe060'); }
            else if (isSlow) this.addBuff(e, 'slow', 2, 0.4, u);
          }
        } else {
          // dano direto no alvo
          const fallbackTgt = this.pickTarget(u, tx, ty, ab.range > 0 ? ab.range : 150);
          if (fallbackTgt) {
            abilityHit(fallbackTgt, baseDmg, dmgType);
            this.sparks(fallbackTgt.x, fallbackTgt.y - 8, col, 6, 110);
            if (isCC) this.addBuff(fallbackTgt, 'stun', 1);
            else if (isSlow) this.addBuff(fallbackTgt, 'slow', 2, 0.3, u);
          } else { u.cds[slot] = 0.5; if (u.maxMp) u.mp += ab.mana; }
        }
        break;
    }
  }

  // ---------- loja ----------
  lastPurchase: { id: string; cost: number; consumed: string[]; time: number } | null = null;

  buyItem(id: string): string | null {
    const u = this.player;
    if (u.dead) return 'Você está morto';
    if (dist(u.x, u.y, FOUNTAINS[u.team as Team][0], FOUNTAINS[u.team as Team][1]) > 360) return 'Volte à base para comprar';
    const { cost, consumed } = componentDiscount(id, u.items);
    const slotsAfter = u.items.length - consumed.length + 1;
    if (slotsAfter > 6) return 'Inventário cheio';
    if (u.gold < cost) return 'Ouro insuficiente';
    // salva compra para undo (10s de janela)
    const consumedIds = consumed.map(i => u.items[i]);
    u.gold -= cost;
    const keep = u.items.filter((_, i) => !consumed.includes(i));
    u.items = [...keep, id];
    this.lastPurchase = { id, cost, consumed: consumedIds, time: this.t };
    this.applyHeroStats(u);
    return null;
  }

  undoPurchase(): string | null {
    if (!this.lastPurchase) return 'Nada para desfazer';
    if (this.t - this.lastPurchase.time > 10) return 'Tempo de desfazer expirou (10s)';
    const u = this.player;
    const lp = this.lastPurchase;
    // remove o item comprado
    const idx = u.items.lastIndexOf(lp.id);
    if (idx < 0) return 'Item não encontrado';
    u.items.splice(idx, 1);
    // recoloca componentes consumidos
    for (const cid of lp.consumed) u.items.push(cid);
    // devolve ouro
    u.gold += lp.cost;
    this.lastPurchase = null;
    this.applyHeroStats(u);
    return null;
  }

  buyback(): string | null {
    const u = this.player;
    if (!u.dead) return 'Você não está morto!';
    if (this.t < u.buybackCd) return `Compra de volta em recarga por ${Math.ceil(u.buybackCd - this.t)}s`;
    const cost = 150 + u.level * 35;
    if (u.gold < cost) return 'Ouro insuficiente para Compra de Volta!';
    u.gold -= cost;
    u.buybackCd = this.t + 180; // 3 min de recarga
    this.respawn(u);
    this.announce('🔔 COMPRA DE VOLTA!', `${u.name} comprou de volta para a partida!`, '#ffcc00');
    sfx.objective();
    this.screenFlash('#ffcc00', 0.5, 0.4, false);
    return null;
  }

  sellItem(idx: number) {
    const u = this.player;
    if (idx < 0 || idx >= u.items.length) return;
    u.gold += Math.round(ITEM_BY_ID[u.items[idx]].totalCost * 0.7);
    u.items.splice(idx, 1);
    this.applyHeroStats(u);
  }
  useActive() {
    const u = this.player;
    if (u.dead) return;
    // Zhonya (slot especial)
    if (u.items.includes('zhonya') && u.activeCd <= 0) {
      u.activeCd = 90;
      this.addBuff(u, 'stun', 2); this.addBuff(u, 'invuln', 2);
      u.moveTgt = null; u.attackTgt = null;
      this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 34, until: this.t + 2, color: '#ffd840' });
      this.sparks(u.x, u.y - 10, '#ffd840', 8, 110);
      sfx.cast();
      return;
    }
    // Youmuu's
    if (u.items.includes('youmuus') && !this.activeSlots.find(a => a.key === 'youmuus' && a.cd > 0)) {
      this.activeSlots.push({ slot: u.items.indexOf('youmuus'), cd: 60, cdMax: 60, key: 'youmuus' });
      this.addBuff(u, 'speed', 6, 0.25); this.addBuff(u, 'aspd', 6, 0.25);
      this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.5, color: '#80d0e0' });
      this.sparks(u.x, u.y - 10, '#80d0e0', 6, 100);
      sfx.cast();
      return;
    }
    // Randuin's
    if (u.items.includes('randuins') && !this.activeSlots.find(a => a.key === 'randuins' && a.cd > 0)) {
      this.activeSlots.push({ slot: u.items.indexOf('randuins'), cd: 60, cdMax: 60, key: 'randuins' });
      this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 140, until: this.t + 0.5, color: '#e0a040' });
      for (const e of this.units.filter(e2 => !e2.dead && e2.team !== u.team && !['tower', 'inhib', 'nexus'].includes(e2.kind) && dist(e2.x, e2.y, u.x, u.y) < 150)) {
        this.addBuff(e, 'slow', 2, 0.4, u);
        this.addBuff(e, 'aspd', 2, -0.4, u);
      }
      sfx.cast();
      return;
    }
    // QSS
    if (u.items.includes('qss') && !this.activeSlots.find(a => a.key === 'qss' && a.cd > 0)) {
      this.activeSlots.push({ slot: u.items.indexOf('qss'), cd: 90, cdMax: 90, key: 'qss' });
      u.buffs = u.buffs.filter(b => !['stun', 'root', 'slow', 'fear', 'silence', 'blind', 'bleed', 'poison', 'burnR'].includes(b.key));
      this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 36, until: this.t + 0.5, color: '#a0d0ff' });
      this.sparks(u.x, u.y - 10, '#a0d0ff', 10, 140);
      sfx.cast();
      return;
    }
    // Ward
    if (u.items.includes('ward') && !this.activeSlots.find(a => a.key === 'ward' && a.cd > 0)) {
      this.activeSlots.push({ slot: u.items.indexOf('ward'), cd: 30, cdMax: 30, key: 'ward' });
      const [wx, wy] = this.worldToMouse();
      const w = placeWard(wx, wy, u.team as 0 | 1, this.t);
      this.wards.push(w);
      this.fx.push({ kind: 'ring', x: w.x, y: w.y, r: 20, until: this.t + 0.5, color: '#80e0a0' });
      this.text(w.x, w.y - 30, 'Ward plantada!', '#80e0a0');
      sfx.click();
      return;
    }
  }

  // coordenadas do mouse em mundo
  worldToMouse(): Vec {
    const cv = this.canvas;
    return [this.mouse.x - cv.width / 2 + this.camX, this.mouse.y - cv.height / 2 + this.camY];
  }

  // ---------- feitiços de invocador ----------
  useSummoner(idx: number) {
    const u = this.player;
    if (u.dead) return;
    const slot = this.summonerSlots[idx];
    if (!slot || slot.cd > 0) { sfx.error(); return; }
    const [wx, wy] = this.worldToMouse();
    const def = SUMMONERS[slot.id];
    slot.cd = def.cd;
    switch (slot.id) {
      case 'flash': {
        const d = dist(u.x, u.y, wx, wy);
        const r = Math.min(d, 200);
        const [nx, ny] = d > 0 ? nearestWalkable(u.x + (wx - u.x) / d * r, u.y + (wy - u.y) / d * r) : [u.x, u.y];
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.4, color: '#ffe080' });
        u.x = nx; u.y = ny; u.moveTgt = null;
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 24, until: this.t + 0.4, color: '#ffe080' });
        this.sparks(u.x, u.y - 8, '#ffe080', 8, 120);
        sfx.cast();
        break;
      }
      case 'ignite': {
        const tgt = this.pickTarget(u, wx, wy, 220);
        if (tgt) {
          this.applyDot(u, tgt, 25 + u.level * 4, 5, 'ignite');
          this.addBuff(tgt, 'grievous', 5, 0.5, u);
          this.fx.push({ kind: 'ring', x: tgt.x, y: tgt.y, r: 22, until: this.t + 0.4, color: '#ff6030' });
          this.sparks(tgt.x, tgt.y - 8, '#ff6030', 8, 130);
          sfx.cast();
        } else { slot.cd = 0; sfx.error(); }
        break;
      }
      case 'heal': {
        const allies = [u, ...this.heroes.filter(h => h.team === u.team && h !== u && !h.dead && dist(h.x, h.y, u.x, u.y) < 240)];
        const target = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const healAmt = 180 + u.level * 15;
        this.heal(target, healAmt);
        if (target !== u) this.heal(u, healAmt * 0.5);
        this.addBuff(target, 'speed', 2, 0.3);
        this.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 30, until: this.t + 0.5, color: '#60e080' });
        this.sparks(target.x, target.y - 10, '#60e080', 10, 130);
        sfx.cast();
        break;
      }
      case 'smite': {
        const tgt = this.units.find(e => !e.dead && e.kind === 'monster' && dist(e.x, e.y, wx, wy) < 60);
        if (tgt) {
          this.dealDamage(u, tgt, 500, 'true', { ability: true });
          u.gold += 40;
          this.text(tgt.x, tgt.y - 30, '+40 Smite!', '#c080ff');
          this.fx.push({ kind: 'ring', x: tgt.x, y: tgt.y, r: 30, until: this.t + 0.4, color: '#c080ff' });
          this.sparks(tgt.x, tgt.y - 10, '#c080ff', 10, 150);
          sfx.cast();
        } else { slot.cd = 0; sfx.error(); }
        break;
      }
      case 'exhaust': {
        const tgt = this.pickTarget(u, wx, wy, 240, true);
        if (tgt) {
          this.addBuff(tgt, 'exhaust', 2.5, 0.5, u);
          this.addBuff(tgt, 'slow', 2.5, 0.4, u);
          this.fx.push({ kind: 'ring', x: tgt.x, y: tgt.y, r: 24, until: this.t + 0.4, color: '#c0a060' });
          sfx.cast();
        } else { slot.cd = 0; sfx.error(); }
        break;
      }
      case 'barrier': {
        this.addBuff(u, 'shield', 2, 120 + u.level * 20);
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 28, until: this.t + 0.5, color: '#a0d0ff' });
        sfx.cast();
        break;
      }
      case 'clarity': {
        const allies = [u, ...this.heroes.filter(h => h.team === u.team && h !== u && !h.dead && dist(h.x, h.y, u.x, u.y) < 400)];
        for (const a of allies) a.mp = Math.min(a.maxMp, a.mp + a.maxMp * 0.4);
        this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 60, until: this.t + 0.5, color: '#80c0ff' });
        this.sparks(u.x, u.y - 10, '#80c0ff', 12, 150);
        sfx.cast();
        break;
      }
      case 'teleport': {
        // teleporta até o aliado mais próximo do cursor
        const tgt = this.units.find(e => !e.dead && e.team === u.team && (e.kind === 'hero' || e.kind === 'tower') && dist(e.x, e.y, wx, wy) < 200);
        if (tgt) {
          this.addBuff(u, 'root', 3.5);
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.5, color: '#60a0ff' });
          this.delayed.push({ at: this.t + 3.5, fn: () => { if (!u.dead) { u.x = tgt.x + rnd(-30, 30); u.y = tgt.y + rnd(-30, 30); u.moveTgt = null; this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 30, until: this.t + 0.5, color: '#60a0ff' }); this.sparks(u.x, u.y - 10, '#60a0ff', 8, 120); } } });
          sfx.cast();
        } else { slot.cd = 0; sfx.error(); }
        break;
      }
    }
  }

  // ---------- upar habilidades ----------
  upgradeSkill(slot: AbilitySlot) {
    const u = this.player;
    if (u.dead) return;
    const lv = u.skillLv[slot];
    const maxLv = slot === 'R' ? 3 : 5;
    const reqLv = slot === 'R' ? (lv === 0 ? 6 : lv === 1 ? 11 : lv === 2 ? 16 : 99) : lv + 1;
    if (u.skillPoints <= 0) { if (u === this.player) { this.text(u.x, u.y - 50, 'Sem pontos!', '#ff8080'); sfx.error(); } return; }
    if (lv >= maxLv) { if (u === this.player) { this.text(u.x, u.y - 50, `${slot} no máximo!`, '#ff8080'); sfx.error(); } return; }
    if (u.level < reqLv) { if (u === this.player) { this.text(u.x, u.y - 50, `Requer nível ${reqLv}`, '#ff8080'); sfx.error(); } return; }
    u.skillLv[slot]++;
    u.skillPoints--;
    this.text(u.x, u.y - 50, `${slot} NÍVEL ${u.skillLv[slot]}!`, '#ffe080');
    sfx.levelup();
  }

  // ---------- update ----------
  update(dt: number) {
    if (this.result) return;
    // hit-stop: pausa microscópica (fighting game juice)
    if (this.hitStop > 0) { this.hitStop -= dt; if (this.hitStop > 0) return; this.hitStop = 0; }
    this.t += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakeM = 0;
    this.delayed = this.delayed.filter(d => { if (this.t >= d.at) { d.fn(); return false; } return true; });
    this.updateAmbient(dt);
    this.updateRiverRunes();
    this.updateEvents();
    this.waveT -= dt;
    if (this.waveT <= 0) {
      this.waveT = this.modeRules.waveInterval;
      for (const lane of ['top', 'mid', 'bot'] as const) for (const team of [0, 1] as Team[]) this.spawnWave(lane, team);
    }
    // fog of war: reset e re-revela
    this.fog.reset();
    for (const h of this.heroes) {
      if (h.dead) continue;
      this.fog.reveal(h.x, h.y, h.def?.ranged ? 380 : 320, h.team as 0 | 1);
    }
    for (const t of this.units.filter(u2 => u2.kind === 'tower')) this.fog.reveal(t.x, t.y, 450, t.team as 0 | 1);
    for (const w of this.wards) this.fog.reveal(w.x, w.y, 320, w.team);
    // wards expiram
    this.wards = this.wards.filter(w => w.until > this.t);
    // cooldowns de feitiços e ativos
    for (const s of this.summonerSlots) s.cd = Math.max(0, s.cd - dt);
    this.activeSlots = this.activeSlots.filter(a => { a.cd = Math.max(0, a.cd - dt); return a.cd > 0; });
    for (const u of this.units) this.updateUnit(u, dt);
    // separação suave para não empilhar
    const mobs = this.units.filter(u2 => !u2.dead && (u2.kind === 'minion' || u2.kind === 'monster' || u2.kind === 'hero'));
    for (let i = 0; i < mobs.length; i++) {
      for (let j = i + 1; j < mobs.length; j++) {
        const a = mobs[i], b = mobs[j];
        if (a.kind === 'hero' && b.kind === 'hero') continue;
        const rr = (a.r + b.r) * 0.8;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (rr - d) / 2, px = dx / d * push, py = dy / d * push;
        const aPri = a.kind === 'hero' ? 1 : 0, bPri = b.kind === 'hero' ? 1 : 0;
        if (bPri >= aPri && isWalkable(a.x - px, a.y - py)) { a.x -= px; a.y -= py; }
        if (aPri >= bPri && isWalkable(b.x + px, b.y + py)) { b.x += px; b.y += py; }
      }
    }
    for (const h of this.heroes) if (h.dead && this.t >= h.respawnT) this.respawn(h);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.fx = this.fx.filter(f => {
      if (f.kind === 'text') f.y += (f.vy ?? 0) * dt;
      if (f.kind === 'spark') { f.x += (f.vx ?? 0) * dt; f.y += (f.vy ?? 0) * dt; f.vy = (f.vy ?? 0) + (f.g ?? 0) * dt; }
      return f.until > this.t;
    });
    if (this.banner && this.banner.until < this.t) this.banner = null;
    if (this.feed.length > 5) this.feed = this.feed.slice(-5);
    this.updateCamera(dt);
    if (this.hawkPing && this.hawkPing.until < this.t) this.hawkPing = null;
  }

  spawnWave(lane: 'top' | 'mid' | 'bot', team: Team) {
    const wpts = team === 0 ? LANES[lane] : [...LANES[lane]].reverse();
    const inhibDown = !this.units.some(u2 => u2.kind === 'inhib' && u2.team !== team && u2.towerLane === lane);
    const mkMinion = (caster: boolean, superM: boolean) => {
      const u = this.baseUnit();
      u.kind = 'minion'; u.team = team; u.caster = caster; u.superM = superM;
      const scale = 1 + this.t / 60 * 0.03;
      u.maxHp = u.hp = (superM ? 1400 : caster ? 290 : 460) * scale;
      u.ad = (superM ? 42 : caster ? 24 : 13) * scale;
      u.armor = superM ? 30 : 0; u.mr = superM ? 30 : 0;
      u.atkRange = caster ? 160 : superM ? 60 : 45; u.aspd = caster ? 0.65 : 0.75; u.ms = 82;
      u.r = superM ? 16 : 11;
      u.x = wpts[0][0] + rnd(-25, 25); u.y = wpts[0][1] + rnd(-25, 25);
      u.wpts = wpts; u.wptI = 1; u.name = superM ? 'Superminion' : caster ? 'Minion Conjurador' : 'Minion Guerreiro';
      this.units.push(u);
    };
    for (let i = 0; i < 3; i++) mkMinion(false, false);
    for (let i = 0; i < 3; i++) mkMinion(true, false);
    if (inhibDown) mkMinion(false, true);
  }

  respawn(h: Unit) {
    h.dead = false; h.hp = h.maxHp; h.mp = h.maxMp; h.buffs = [];
    const [fx0, fy0] = FOUNTAINS[h.team as Team];
    h.x = fx0 + rnd(-30, 30); h.y = fy0 + rnd(-30, 30);
    h.moveTgt = null; h.attackTgt = null;
    h.leftBase = false; // Permite saída limpa e recalculada da base ao renascer
    h.wptI = 1;        // Reinicia os waypoints ao renascer
    // feixe de luz épico ao respawnar
    this.fx.push({ kind: 'respawnBeam', x: h.x, y: h.y, until: this.t + 1.0, color: h.team === 0 ? '#60c0ff' : '#ff8080' });
    this.sparks(h.x, h.y - 10, '#ffffff', 12, 150);
    if (h === this.player) { sfx.levelup(); this.screenFlash('#ffffff', 0.3, 0.2, false); }
  }

  updateUnit(u: Unit, dt: number) {
    if (u.dead) return;
    u.animT += dt;
    u.flashT = Math.max(0, u.flashT - dt);
    // decaimento da barra de dano fantasma
    if (u.ghostT > 0) {
      u.ghostT -= dt;
      if (u.ghostT <= 0) u.ghostHp = u.hp;
    }
    for (const b of u.buffs) {
      if (['bleed', 'poison', 'burnR'].includes(b.key)) {
        b.tickT = (b.tickT ?? 0) + dt;
        if (b.tickT >= 0.5) {
          b.tickT -= 0.5;
          const dps = (b.v ?? 5) * (b.stacks ?? 1);
          if (b.key === 'bleed') this.sparks(u.x, u.y - 8, '#e05050', 1, 40);
          if (b.src && !b.src.dead) this.dealDamage(b.src, u, dps * 0.5, b.key === 'bleed' ? 'phys' : 'magic', {});
          else { u.hp -= dps * 0.5; if (u.hp <= 0 && b.src) this.kill(b.src, u); }
        }
      }
      if (b.key === 'spin') {
        b.tickT = (b.tickT ?? 0) + dt;
        if (b.tickT >= 0.5) {
          b.tickT -= 0.5;
          this.fx.push({ kind: 'spinfx', x: u.x, y: u.y, r: 95, until: this.t + 0.3, color: '#d0e0f0' });
          for (const e of this.units.filter(e2 => !e2.dead && e2.team !== u.team && !['tower', 'inhib', 'nexus'].includes(e2.kind) && dist(e2.x, e2.y, u.x, u.y) < 95 + e2.r))
            this.dealDamage(u, e, (b.v ?? 30) * 0.5, 'phys', { ability: true });
        }
      }
      if (b.key === 'meditate') {
        b.tickT = (b.tickT ?? 0) + dt;
        if (b.tickT >= 0.5) { b.tickT -= 0.5; this.heal(u, (30 + u.level * 10) * 0.5); this.sparks(u.x, u.y - 14, '#90d090', 2, 50); }
      }
      if (b.key === 'lotus') {
        b.tickT = (b.tickT ?? 0) + dt;
        if (b.tickT >= 0.25) {
          b.tickT -= 0.25;
          const tgts = this.heroes.filter(h => h.team !== u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < 240).slice(0, 3);
          for (const v of tgts) {
            this.fx.push({ kind: 'beam', x: u.x, y: u.y - 10, x2: v.x, y2: v.y, until: this.t + 0.1, color: '#e0e8f0' });
            this.dealDamage(u, v, 30 + u.level * 6 + u.ad * 0.2 + u.ap * 0.2, 'magic', { ability: true });
          }
        }
      }
    }
    u.buffs = u.buffs.filter(b => b.until > this.t);
    if (u.kind === 'hero') {
      let hpR = u.hpRegen, mpR = u.mpRegen;
      const oocTime = this.t - u.lastCombat;
      // ===== DOTA: REGEN RUNE (quebra se sofrer dano recente <3s) =====
      if (this.hasBuff(u, 'regen')) {
        if (oocTime < 3.0) {
          u.buffs = u.buffs.filter(b => b.key !== 'regen');
          this.text(u.x, u.y - 46, 'REGEN QUEBRADA!', '#ff40ff');
        } else {
          hpR += 60;
          mpR += 30;
          if (Math.random() < 0.15) {
            this.fx.push({ kind: 'heal', x: u.x + rnd(-8, 8), y: u.y - 10, until: this.t + 0.5, color: '#60ffa0' });
          }
        }
      }
      if (u.def?.passive.key === 'perseverance' && oocTime > 6) hpR += u.maxHp * 0.015;
      if (u.items.includes('warmog') && oocTime > 6) hpR += u.maxHp * 0.03;
      if (this.hasBuff(u, 'bluebuff')) mpR += 12;
      if (this.hasBuff(u, 'baron')) hpR += 15;
      u.hp = Math.min(u.maxHp, u.hp + hpR * dt * 0.2);
      u.mp = Math.min(u.maxMp, u.mp + mpR * dt * 0.35);
      const [fx0, fy0] = FOUNTAINS[u.team as Team];
      if (dist(u.x, u.y, fx0, fy0) < 300) { this.heal(u, u.maxHp * 0.36 * dt); u.mp = Math.min(u.maxMp, u.mp + u.maxMp * 0.3 * dt); }
      // taxa de recarga: runa Transcendência + evento Surto Arcano
      const cdrRate = dt
        * (u === this.player && this.hasRune('transcendence') ? 1 + this.runeStats.cdr : 1)
        * this.eventMods.cdrMul;
      for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) {
        const before = u.cds[s];
        u.cds[s] = Math.max(0, u.cds[s] - cdrRate);
        // flash sutil quando habilidade fica pronta (só para o jogador)
        if (before > 0 && u.cds[s] <= 0 && u === this.player && u.skillLv[s] > 0) {
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 18, until: this.t + 0.25, dur: 0.25, color: s === 'R' ? '#ffd040' : '#80e0ff' });
          sfx.click();
        }
      }
      u.activeCd = Math.max(0, u.activeCd - dt);
      if (u.items.includes('sunfire')) {
        for (const e of this.units.filter(e2 => !e2.dead && e2.team !== u.team && !['tower', 'inhib', 'nexus'].includes(e2.kind) && dist(e2.x, e2.y, u.x, u.y) < 110)) {
          e.hp -= 35 * dt * (100 / (100 + e.mr));
          if (e.hp <= 0) this.kill(u, e);
        }
      }
      if (u.items.includes('banshee') && !this.hasBuff(u, 'spellshield') && this.t - u.lastCombat > 30) this.addBuff(u, 'spellshield', 9999, 1);
      // passivas de loop
      if (u.def?.passive.key === 'spiritshield' && !this.hasBuff(u, 'spiritshield') && this.t - u.lastCombat > 8) this.addBuff(u, 'shield', 999, 60 + u.level * 8);
      if (u.def?.passive.key === 'stormsong') {
        const cnt = u.buffs.find(b => b.key === 'stormsongCnt');
        if (cnt) { /* contado no cast */ }
      }
      if (u.def?.passive.key === 'voidshield' && !this.hasBuff(u, 'voidshield') && this.t - u.lastCombat > 25) this.addBuff(u, 'bshield', 999, 80 + u.level * 10);
      if (u.def?.passive.key === 'prowl') {
        // prowl: dano bônus no próximo ataque se moveu recentemente
        if (u.moveTgt && !this.hasBuff(u, 'prowl')) this.addBuff(u, 'prowl', 999, 0, u);
      }
      if (u.recallT > 0) {
        if (this.t - u.lastCombat < 1.2 || u.moveTgt !== null) { u.recallT = -1; if (u === this.player) this.text(u.x, u.y - 44, 'Recall cancelado', '#ff9090'); }
        else if (this.t >= u.recallT) {
          u.recallT = -1;
          this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 40, until: this.t + 0.6, color: '#80c0ff' });
          const [fx1, fy1] = FOUNTAINS[u.team as Team];
          u.x = fx1; u.y = fy1; u.moveTgt = null; u.attackTgt = null;
          u.leftBase = false; // Reset da saída de base ao teleportar de volta
          u.wptI = 1;        // Reinicia os waypoints de rota ao retornar para a base
          this.sparks(u.x, u.y - 10, '#80c0ff', 8, 120);
        }
      }
      if (u.def?.passive.key === 'camouflage') {
        const still = !u.moveTgt && !this.isStunned(u);
        const camo = this.getBuff(u, 'camoT');
        if (still) {
          if (!camo) this.addBuff(u, 'camoT', 9999);
          else if (this.t + 9999 - camo.until > 2.5 && !this.hasBuff(u, 'invis')) this.addBuff(u, 'invis', 9999);
        } else {
          if (this.hasBuff(u, 'invis')) this.addBuff(u, 'aspd', 3, 0.4);
          u.buffs = u.buffs.filter(b => b.key !== 'invis' && b.key !== 'camoT');
        }
      }
      u.gold += this.modeRules.passiveGoldRate * dt; this.giveXp(u, 3.0 * dt);
    }
    if (u.kind === 'tower') { this.towerAI(u, dt); return; }
    if (u.kind === 'inhib' || u.kind === 'nexus') {
      if (u.hp < u.maxHp && !this.units.some(e => e.team !== u.team && !e.dead && e.kind !== 'monster' && dist(e.x, e.y, u.x, u.y) < 400)) u.hp = Math.min(u.maxHp, u.hp + 30 * dt);
      return;
    }
    if (u.kind === 'hero' || u.kind === 'minion') {
      const et = u.team === 0 ? 1 : 0;
      const [efx, efy] = FOUNTAINS[et];
      if (dist(u.x, u.y, efx, efy) < 260) { u.hp -= 900 * dt; if (u.hp <= 0) this.kill(this.units.find(n => n.kind === 'nexus' && n.team === et) ?? u, u); }
    }
    const fear = this.getBuff(u, 'fear');
    if (fear && fear.src) {
      this.moveToward(u, u.x + (u.x - fear.src.x), u.y + (u.y - fear.src.y), dt);
      return;
    }
    if (this.isStunned(u)) return;
    if (u.kind === 'minion') { this.minionAI(u, dt); return; }
    if (u.kind === 'monster') { this.monsterAI(u, dt); return; }
    if (u.kind === 'hero') {
      if (u.isBot) this.botAI(u, dt);
      this.heroMotion(u, dt);
    }
  }

  heroMotion(u: Unit, dt: number) {
    // trilha sutil de poeira ao mover (a cada 0.3s)
    if (u === this.player && u.moveTgt && Math.floor(this.t * 3.3) !== Math.floor((this.t - dt) * 3.3)) {
      this.fx.push({ kind: 'spark', x: u.x + rnd(-5, 5), y: u.y + 4, size: 2.5,
        until: this.t + 0.35, dur: 0.35, color: 'rgba(160,140,110,0.6)' });
    }
    if (u.attackTgt) {
      const t2 = u.attackTgt;
      if (t2.dead || (t2.kind === 'tower' && !this.towerAttackable(t2)) || (this.hasBuff(t2, 'invis') && t2.team !== u.team)) { u.attackTgt = null; }
      else {
        const d = dist(u.x, u.y, t2.x, t2.y);
        if (d <= u.atkRange + t2.r) {
          this.tryAttack(u, t2, dt);
          return;
        }
        if (!this.hasBuff(u, 'root') && !this.hasBuff(u, 'meditate') && !this.hasBuff(u, 'lotus')) {
          this.moveToward(u, t2.x, t2.y, dt, u.items?.includes('phantomdancer'));
        }
        return;
      }
    }
    u.atkCd = Math.max(0, u.atkCd - dt);
    // retaliação / attack-move: adquire alvo automaticamente
    if (!u.attackTgt && !u.moveTgt && u.retalTgt && !u.retalTgt.dead && this.t - u.retalT < 3 &&
      u.retalTgt.team !== u.team && !this.hasBuff(u.retalTgt, 'invis') && dist(u.x, u.y, u.retalTgt.x, u.retalTgt.y) < u.atkRange + 160) {
      u.attackTgt = u.retalTgt;
    }
    if (u.attackMove && !u.attackTgt && u.moveTgt) {
      const near = this.units.filter(e => !e.dead && e.team !== u.team && !this.hasBuff(e, 'invis') &&
        ['hero', 'minion', 'monster'].includes(e.kind) && dist(e.x, e.y, u.x, u.y) < 260)
        .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
      if (near) u.attackTgt = near;
    }
    if (u.moveTgt && !this.hasBuff(u, 'root') && !this.hasBuff(u, 'meditate') && !this.hasBuff(u, 'lotus')) {
      const [mx, my] = u.moveTgt;
      if (dist(u.x, u.y, mx, my) < 6) { u.moveTgt = null; return; }
      if (!this.moveToward(u, mx, my, dt, u.items?.includes('phantomdancer'))) { /* sem progresso — moveToward já desvia */ }
    }
  }

  towerAttackable(t: Unit): boolean {
    if (t.towerLane === 'nexus') {
      return INHIBS.filter(i => i.team === t.team).some(i => !this.units.some(u2 => u2.kind === 'inhib' && u2.team === t.team && u2.towerLane === i.lane));
    }
    return !this.units.some(u2 => u2.kind === 'tower' && u2.team === t.team && u2.towerLane === t.towerLane && (u2.tier ?? 0) < (t.tier ?? 0));
  }
  inhibAttackable(i: Unit): boolean {
    return !this.units.some(u2 => u2.kind === 'tower' && u2.team === i.team && u2.towerLane === i.towerLane);
  }
  nexusAttackable(n: Unit): boolean {
    return !this.units.some(u2 => u2.kind === 'tower' && u2.team === n.team && u2.towerLane === 'nexus');
  }

  towerAI(u: Unit, dt: number) {
    u.atkCd = Math.max(0, u.atkCd - dt);
    const inR = this.units.filter(e => !e.dead && e.team !== u.team && e.team !== 2 && (e.kind === 'minion' || e.kind === 'hero') && !this.hasBuff(e, 'invis') && dist(e.x, e.y, u.x, u.y) <= u.atkRange);
    if (!inR.length) { u.attackTgt = null; return; }
    if (!u.attackTgt || u.attackTgt.dead || dist(u.attackTgt.x, u.attackTgt.y, u.x, u.y) > u.atkRange) {
      u.attackTgt = inR.find(e => e.kind === 'minion') ?? inR[0];
    }
    if (u.attackTgt) this.tryAttack(u, u.attackTgt, dt);
  }

  minionAI(u: Unit, dt: number) {
    u.atkCd = Math.max(0, u.atkCd - dt);
    if (!u.attackTgt || u.attackTgt.dead || dist(u.attackTgt.x, u.attackTgt.y, u.x, u.y) > 300) {
      u.attackTgt = null;
      const cand = this.units.filter(e => !e.dead && e.team !== u.team && e.team !== 2 && !this.hasBuff(e, 'invis') &&
        (e.kind === 'minion' || e.kind === 'hero' ||
          (e.kind === 'tower' && this.towerAttackable(e)) ||
          (e.kind === 'inhib' && this.inhibAttackable(e)) ||
          (e.kind === 'nexus' && this.nexusAttackable(e))) &&
        dist(e.x, e.y, u.x, u.y) < 220);
      cand.sort((a, b) => {
        const pa = a.kind === 'minion' ? 0 : a.kind === 'hero' ? 1 : 2;
        const pb = b.kind === 'minion' ? 0 : b.kind === 'hero' ? 1 : 2;
        return pa - pb || dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y);
      });
      u.attackTgt = cand[0] ?? null;
    }
    if (u.attackTgt) {
      const t2 = u.attackTgt;
      const d = dist(u.x, u.y, t2.x, t2.y);
      if (d <= u.atkRange + t2.r) { this.tryAttack(u, t2, dt); return; }
      this.moveToward(u, t2.x, t2.y, dt);
      return;
    }
    if (!u.wpts) return;
    const i = u.wptI ?? 1;
    if (i >= u.wpts.length) return;
    const [wx, wy] = u.wpts[i];
    if (dist(u.x, u.y, wx, wy) < 40) { u.wptI = i + 1; return; }
    this.moveToward(u, wx, wy, dt);
  }

  monsterAI(u: Unit, dt: number) {
    u.atkCd = Math.max(0, u.atkCd - dt);
    const [hx, hy] = u.campHome!;
    const dHome = dist(u.x, u.y, hx, hy);
    const LEASH = 220;
    // leash duro: se passou do limite, volta imediatamente
    if (dHome > LEASH) {
      u.attackTgt = null;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5 * dt);
      this.moveToward(u, hx, hy, dt, true);
      return;
    }
    if (u.attackTgt && (u.attackTgt.dead || dist(u.attackTgt.x, u.attackTgt.y, hx, hy) > LEASH + 80)) {
      u.attackTgt = null;
      u.hp = u.maxHp;
    }
    if (!u.attackTgt) {
      const intruder = this.heroes.find(h => !h.dead && !this.hasBuff(h, 'invis') && dist(h.x, h.y, u.x, u.y) < u.atkRange + 30 && (u.hp < u.maxHp || dist(h.x, h.y, hx, hy) < 140));
      if (intruder) u.attackTgt = intruder;
    }
    if (u.attackTgt) {
      const t2 = u.attackTgt;
      const d = dist(u.x, u.y, t2.x, t2.y);
      if (d <= u.atkRange + t2.r) { this.tryAttack(u, t2, dt); return; }
      this.moveToward(u, t2.x, t2.y, dt, true);
      return;
    }
    if (dHome > 20) {
      this.moveToward(u, hx, hy, dt, true);
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4 * dt);
    }
  }

  botAI(u: Unit, dt: number) {
    u.aiT -= dt;
    if (u.aiT > 0) return;
    // reação varia com a dificuldade: easy=lento e burro, hard=rápido e agressivo
    const diffCfg = this.difficulty === 'easy' ? { tick: 0.7, aggro: 0.7, castChance: 0.5, goldMul: 0.85, skillUse: false }
      : this.difficulty === 'hard' ? { tick: 0.22, aggro: 0.5, castChance: 1, goldMul: 1.1, skillUse: true }
      : { tick: 0.4, aggro: 0.6, castChance: 0.85, goldMul: 1, skillUse: true };
    u.aiT = diffCfg.tick + Math.random() * 0.1;
    const [fx0, fy0] = FOUNTAINS[u.team as Team];
    const atFountain = dist(u.x, u.y, fx0, fy0) < 320;
    const hpFrac = u.hp / u.maxHp;
    // bônus de ouro dos bots conforme dificuldade (simula farm melhor)
    if (!atFountain) u.gold += (diffCfg.goldMul - 1) * 1.7 * (u.aiT);
    if (atFountain) u.fountainT += 0.4; else u.fountainT = 0;
    const nearEnemy = this.units.filter(e => !e.dead && e.team !== u.team && e.team !== 2 && !this.hasBuff(e, 'invis') && (e.kind === 'hero' || e.kind === 'minion') && dist(e.x, e.y, u.x, u.y) < 420);
    // JUNGLER: rotina de selva
    if (u.isJungler && !atFountain) {
      this.junglerAI(u);
      return;
    }
    if (atFountain) {
      const build = BOT_BUILDS[u.def!.id] ?? BOT_BUILDS.default;
      while (u.buildIdx < build.length && u.items.length < 6 && u.gold >= ITEM_BY_ID[build[u.buildIdx]].totalCost) {
        u.gold -= ITEM_BY_ID[build[u.buildIdx]].totalCost;
        u.items.push(build[u.buildIdx]); u.buildIdx++;
        this.applyHeroStats(u);
      }
      // saída da base: ir para o primeiro waypoint da rota (garantido caminhável)
      if (!u.leftBase) {
        const wpts = u.team === 0 ? LANES[u.lane!] : [...LANES[u.lane!]].reverse();
        u.moveTgt = [wpts[0][0] + rnd(-20, 20), wpts[0][1] + rnd(-20, 20)];
        u.leftBase = true;
        return;
      }
      // espera curar só se estiver muito ferido, máx 6s
      if (hpFrac < 0.5 && u.fountainT < 6) { u.moveTgt = null; return; }
    }
    if (hpFrac < diffCfg.aggro) {
      u.attackTgt = null;
      if (!nearEnemy.length && this.t - u.lastCombat > 3 && u.recallT < 0) { u.recallT = this.t + 6; sfx.recall(); }
      if (u.recallT < 0) u.moveTgt = [fx0, fy0];
      else u.moveTgt = null;
      return;
    }
    const enemyHeroesNear = nearEnemy.filter(e => e.kind === 'hero');
    const structures = this.units.filter(e => !e.dead && e.team !== u.team && e.team !== 2 &&
      ((e.kind === 'tower' && this.towerAttackable(e)) || (e.kind === 'inhib' && this.inhibAttackable(e)) || (e.kind === 'nexus' && this.nexusAttackable(e))) &&
      dist(e.x, e.y, u.x, u.y) < 300);
    const enemyTower = this.units.find(e => e.kind === 'tower' && e.team !== u.team && !e.dead && dist(e.x, e.y, u.x, u.y) < 300);
    const allyMinionsNear = this.units.filter(e => e.kind === 'minion' && e.team === u.team && !e.dead && dist(e.x, e.y, u.x, u.y) < 260);
    if (enemyTower && !allyMinionsNear.length && !structures.length && this.towerAttackable(enemyTower)) {
      const d = dist(u.x, u.y, enemyTower.x, enemyTower.y) || 1;
      u.moveTgt = [u.x + (u.x - enemyTower.x) / d * 140, u.y + (u.y - enemyTower.y) / d * 140];
      u.attackTgt = null;
      return;
    }
    let target: Unit | null = null;
    if (enemyHeroesNear.length && hpFrac > 0.35) {
      // IA melhorada: prioriza execução (inimigos com % de vida baixa) antes de focar dano bruto
      target = enemyHeroesNear.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    } else if (nearEnemy.length) {
      // prioriza heróis com pouca vida, depois minions/monstros mais próximos
      target = nearEnemy.sort((a, b) => {
        const pa = a.kind === 'hero' ? (a.hp / a.maxHp < 0.3 ? -2 : 0) : 1;
        const pb = b.kind === 'hero' ? (b.hp / b.maxHp < 0.3 ? -2 : 0) : 1;
        return pa - pb || dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y);
      })[0];
    } else if (structures.length) {
      target = structures[0];
    }
    if (target) {
      u.attackTgt = target; u.moveTgt = null;
      const heroTgt = target.kind === 'hero' ? target : enemyHeroesNear[0];
      if (heroTgt) {
        for (const s of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) {
          const ab = u.def!.abilities[s];
          if (s === 'R' && (u.level < 6 || heroTgt.hp / heroTgt.maxHp > 0.7)) continue;
          const rng = ab.range > 0 ? Math.min(ab.range + 60, 9999) : 260;
          if (diffCfg.skillUse && Math.random() > diffCfg.castChance) continue;
          if (this.abilityReady(u, s).ok && dist(u.x, u.y, heroTgt.x, heroTgt.y) < Math.min(rng, 420)) {
            this.cast(u, s, heroTgt.x, heroTgt.y, heroTgt);
            break;
          }
        }
      }
      return;
    }
    u.attackTgt = null;
    const wpts = u.team === 0 ? LANES[u.lane!] : [...LANES[u.lane!]].reverse();
    // ===== IA PATHING DE WAVE FIEL AO DOTA (sem travamentos) =====
    if (u.wptI === undefined || u.wptI === null || u.wptI <= 0) {
      u.wptI = 1;
    }
    // Avança para o próximo waypoint quando estiver próximo do atual (raio de 120px)
    if (u.wptI < wpts.length) {
      const [wx, wy] = wpts[u.wptI];
      if (dist(u.x, u.y, wx, wy) < 120) {
        u.wptI++;
      }
    }
    const targetWptIdx = Math.min(u.wptI, wpts.length - 1);
    const next = wpts[targetWptIdx];
    u.moveTgt = [next[0] + rnd(-15, 15), next[1] + rnd(-15, 15)];
  }

  junglerAI(u: Unit) {
    // rotina: farmar acampamentos do próprio lado, voltar p/ base se baixo, gank se oportuno
    const [fx0, fy0] = FOUNTAINS[u.team as Team];
    const hpFrac = u.hp / u.maxHp;
    if (hpFrac < 0.3) { u.moveTgt = [fx0, fy0]; u.attackTgt = null; return; }
    // acampamentos do lado do jungler (não invadir)
    const myCamps = CAMPS.filter(c => c.side === u.team && c.type !== 'dragon' && c.type !== 'baron');
    const aliveCamps = myCamps.filter(c => this.units.some(u2 => u2.kind === 'monster' && u2.campType === c.type && u2.campHome![0] === c.x && u2.campHome![1] === c.y && !u2.dead));
    // prioridade: buffs > outros
    const priority = (t: string) => t === 'blue' || t === 'red' ? 0 : t === 'gromp' ? 1 : 2;
    aliveCamps.sort((a, b) => priority(a.type) - priority(b.type) || dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y));
    const target = aliveCamps[0];
    if (target) {
      const campUnit = this.units.find(u2 => u2.kind === 'monster' && u2.campType === target.type && u2.campHome![0] === target.x && !u2.dead);
      if (campUnit) {
        // smite se disponível e monstro com pouca vida
        if (u.summoners.includes('smite') && u.smiteCd <= 0 && campUnit.hp < 500) {
          u.smiteCd = 60;
          this.dealDamage(u, campUnit, 500, 'true', { ability: true });
          u.gold += 40;
          this.fx.push({ kind: 'ring', x: campUnit.x, y: campUnit.y, r: 30, until: this.t + 0.4, color: '#c080ff' });
        }
        u.attackTgt = campUnit; u.moveTgt = null;
        return;
      }
      u.moveTgt = [target.x, target.y]; u.attackTgt = null;
      return;
    }
    // sem acampamentos: gank — ir para a lane mais próxima com inimigo
    const enemyHero = this.heroes.filter(h => h.team !== u.team && !h.dead && dist(h.x, h.y, u.x, u.y) < 600)
      .sort((a, b) => a.hp - b.hp)[0];
    if (enemyHero && hpFrac > 0.5) {
      u.moveTgt = [enemyHero.x, enemyHero.y];
      u.attackTgt = null;
      return;
    }
    // voltar para perto da base
    u.moveTgt = [fx0 + rnd(-100, 100), fy0 + rnd(-100, 100)];
  }

  updateProjectiles(dt: number) {
    for (const p of this.projs) {
      if (p.target) { if (!p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; } }
      const d = dist(p.x, p.y, p.tx, p.ty);
      const step = p.speed * dt;
      if (p.kind === 'attack' || p.kind === 'fire' || p.kind === 'dart') {
        if (d <= step + (p.target?.r ?? 10)) { p.onHit(p.target && !p.target.dead ? p.target : null, p.x, p.y); p.traveled = 1e9; continue; }
        p.x += (p.tx - p.x) / d * step; p.y += (p.ty - p.y) / d * step;
        p.traveled += step;
        continue;
      }
      p.x += p.dx * step; p.y += p.dy * step; p.traveled += step;
      const victims = this.units.filter(e => !e.dead && e.team !== p.team &&
        (p.pierceHeroOnly ? e.kind === 'hero' : !['tower', 'inhib', 'nexus'].includes(e.kind)) &&
        !this.hasBuff(e, 'invis') && (!p.hitSet || !p.hitSet.has(e)) &&
        dist(e.x, e.y, p.x, p.y) < p.hitRadius + e.r);
      if (victims.length) {
        if (p.kind === 'pierce') {
          for (const v of victims) { p.hitSet?.add(v); p.onHit(v, p.x, p.y); }
        } else {
          p.onHit(victims[0], p.x, p.y);
          p.traveled = 1e9;
        }
        continue;
      }
      if (p.traveled >= p.maxDist) { p.onHit(null, p.x, p.y); }
    }
    this.projs = this.projs.filter(p => p.traveled < p.maxDist);
  }

  updateZones(dt: number) {
    for (const z of this.zones) {
      if (z.trap) {
        if (this.t < (z.armT ?? 0)) continue;
        const v = this.units.find(e => !e.dead && e.team !== z.team && e.team !== 2 && (e.kind === 'hero' || e.kind === 'minion') && dist(e.x, e.y, z.x, z.y) < 45 + e.r);
        if (v) {
          z.until = 0;
          this.fx.push({ kind: 'ring', x: z.x, y: z.y, r: 90, until: this.t + 0.5, color: '#a0e050' });
          this.sparks(z.x, z.y, '#a0e050', 10, 160);
          for (const e of this.units.filter(e2 => !e2.dead && e2.team !== z.team && e2.team !== 2 && (e2.kind === 'hero' || e2.kind === 'minion') && dist(e2.x, e2.y, z.x, z.y) < 100)) {
            this.applyDot(z.src, e, z.dps, 4, 'poison');
            this.addBuff(e, 'slow', 4, 0.4, z.src);
            this.dealDamage(z.src, e, z.dps * 2, 'magic', { ability: true });
          }
        }
        continue;
      }
      z.tickT += dt;
      if (z.tickT >= 0.5) {
        z.tickT -= 0.5;
        for (const e of this.units.filter(e2 => !e2.dead && e2.team !== z.team && e2.team !== 2 && (e2.kind === 'hero' || e2.kind === 'minion' || e2.kind === 'monster') && dist(e2.x, e2.y, z.x, z.y) < z.r + e2.r)) {
          if (z.dps > 0) this.dealDamage(z.src, e, z.dps * 0.5, z.magic ? 'magic' : 'phys', { ability: true });
          if (z.slow) this.addBuff(e, 'slow', 0.6, z.slow, z.src);
        }
      }
    }
    this.zones = this.zones.filter(z => z.until > this.t);
  }

  updateCamera(dt: number) {
    const view = this.canvas;
    const vw = view.width, vh = view.height;
    if (this.camLock && !this.player.dead) {
      this.camX += (this.player.x - this.camX) * Math.min(1, dt * 8);
      this.camY += (this.player.y - this.camY) * Math.min(1, dt * 8);
    } else if (this.mouse.inside) {
      const edge = 28, spd = 900 * dt / this.camZoom;
      if (this.mouse.x < edge) this.camX -= spd;
      if (this.mouse.x > vw - edge) this.camX += spd;
      if (this.mouse.y < edge) this.camY -= spd;
      if (this.mouse.y > vh - edge) this.camY += spd;
    }
    const hvw = vw / 2 / this.camZoom, hvh = vh / 2 / this.camZoom;
    this.camX = clamp(this.camX, hvw - 100, WORLD - hvw + 100);
    this.camY = clamp(this.camY, hvh - 100, WORLD - hvh + 100);
  }

  // ---------- entrada ----------
  bindInput() {
    const cv = this.canvas;
    const toWorld = (mx: number, my: number): Vec => [
      (mx - cv.width / 2) / this.camZoom + this.camX,
      (my - cv.height / 2) / this.camZoom + this.camY,
    ];
    const onCtx = (e: MouseEvent) => e.preventDefault();

    // Helper para atacar/interagir com uma unidade
    const doAttack = (wx: number, wy: number) => {
      const u = this.player;
      if (u.dead) return;
      // Se estiver mirando skillshot (aimingSkill), conjura a skill
      if (this.aimingSkill) {
        const slot = this.aimingSkill;
        this.aimingSkill = null;
        const tgtHint = this.units.find(t2 => !t2.dead && t2.team !== u.team && dist(t2.x, t2.y, wx, wy) < Math.max(30, t2.r + 14) && !['tower', 'inhib', 'nexus'].includes(t2.kind)) ?? null;
        this.cast(u, slot, wx, wy, tgtHint);
        return;
      }
      // ===== MECÂNICA DOTA: Deny de minions aliados (<30% HP) =====
      let denyTgt = this.units.find(t2 => !t2.dead && t2.team === u.team && t2.kind === 'minion' && t2.hp < t2.maxHp * 0.3 && dist(t2.x, t2.y, wx, wy) < Math.max(30, t2.r + 14)) ?? null;
      if (denyTgt) {
        u.attackTgt = denyTgt; u.moveTgt = null; u.attackMove = false;
        this.fx.push({ kind: 'click', x: denyTgt.x, y: denyTgt.y, until: this.t + 0.4, color: '#40c060' });
        this.text(denyTgt.x, denyTgt.y - 30, 'DENY!', '#40c060');
        return;
      }
      // tolerância de clique
      let tgt = this.units.find(t2 => !t2.dead && t2.team !== u.team && !this.hasBuff(t2, 'invis') &&
        (t2.kind !== 'tower' || this.towerAttackable(t2)) && (t2.kind !== 'inhib' || this.inhibAttackable(t2)) && (t2.kind !== 'nexus' || this.nexusAttackable(t2)) &&
        dist(t2.x, t2.y, wx, wy) < Math.max(30, t2.r + 14)) ?? null;
      if (!tgt) {
        tgt = this.units.filter(t2 => !t2.dead && t2.team !== u.team && !this.hasBuff(t2, 'invis') &&
          (t2.kind !== 'tower' || this.towerAttackable(t2)) && (t2.kind !== 'inhib' || this.inhibAttackable(t2)) && (t2.kind !== 'nexus' || this.nexusAttackable(t2)) &&
          dist(t2.x, t2.y, wx, wy) < 70)
          .sort((a, b) => dist(a.x, a.y, wx, wy) - dist(b.x, b.y, wx, wy))[0] ?? null;
      }
      u.recallT = -1;
      u.retalTgt = null;
      if (tgt) {
        u.attackTgt = tgt; u.moveTgt = null; u.attackMove = false;
        this.fx.push({ kind: 'click', x: tgt.x, y: tgt.y, until: this.t + 0.4, color: '#ff5050' });
      } else {
        // ataque no chão vira attack-move (avança atacando quem encontrar)
        const [nx, ny] = isWalkable(wx, wy) ? [wx, wy] : nearestWalkable(wx, wy);
        u.moveTgt = [nx, ny];
        u.attackTgt = null;
        u.attackMove = true;
        this.fx.push({ kind: 'click', x: nx, y: ny, until: this.t + 0.4, color: '#ff8080' });
      }
    };
    const doMove = (wx: number, wy: number) => {
      const u = this.player;
      if (u.dead) return;
      // Cancela mira de skillshot
      if (this.aimingSkill) { this.aimingSkill = null; return; }
      const [nx, ny] = isWalkable(wx, wy) ? [wx, wy] : nearestWalkable(wx, wy);
      u.moveTgt = [nx, ny];
      u.attackTgt = null;
      u.attackMove = false;
      u.recallT = -1;
      u.retalTgt = null;
      this.fx.push({ kind: 'click', x: nx, y: ny, until: this.t + 0.4, color: '#60ff90' });
    };

    const onDown = (e: MouseEvent) => {
      initAudio();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const [wx, wy] = toWorld(mx, my);
      // Botão esquerdo (0) = atacar/interagir
      if (e.button === 0) doAttack(wx, wy);
      // Botão direito (2) = mover
      else if (e.button === 2) doMove(wx, wy);
    };
    const onMove = (e: MouseEvent) => {
      const rect = cv.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left; this.mouse.y = e.clientY - rect.top; this.mouse.inside = true;
    };
    const onLeave = () => { this.mouse.inside = false; };
    const onKey = (e: KeyboardEvent) => {
      // Reservado ao painel administrativo global.
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') return;
      if (this.shopOpen && !['p', 'P', 'Escape'].includes(e.key)) return;
      const k = e.key.toLowerCase();
      const u = this.player;
      const [wx, wy] = toWorld(this.mouse.x, this.mouse.y);
      // toggle smart cast (Ctrl+G): conjura no cursor sem preview
      if (k === 'g' && (e.ctrlKey || e.metaKey)) {
        this.smartCast = !this.smartCast;
        this.text(u.x, u.y - 60, this.smartCast ? 'Smart Cast ON' : 'Smart Cast OFF', '#e8c860');
        return;
      }
      // upar habilidade: Ctrl+Q/W/E/R ou Shift+Q/W/E/R (NÃO conjura)
      if ((e.ctrlKey || e.metaKey || e.shiftKey) && ['q', 'w', 'e', 'r'].includes(k)) {
        this.upgradeSkill(k.toUpperCase() as AbilitySlot);
        return;
      }
      if (['q', 'w', 'e', 'r'].includes(k) && !u.dead) {
        const slot = k.toUpperCase() as AbilitySlot;
        const ab = u.def!.abilities[slot];
        const aimType = this.aimTypeOf(ab);
        const chk = this.abilityReady(u, slot);
        // Se smart cast está ativo, conjura direto no cursor
        if (this.smartCast || aimType === 'self' || aimType === 'target') {
          const tgt = this.units.find(t2 => !t2.dead && t2.team !== u.team && dist(t2.x, t2.y, wx, wy) < Math.max(30, t2.r + 14) && !['tower', 'inhib', 'nexus'].includes(t2.kind)) ?? null;
          this.cast(u, slot, wx, wy, tgt);
        } else if (chk.ok) {
          // skillshot / cone / circle: entra em modo de mira (aguarda clique esquerdo)
          if (this.aimingSkill === slot) {
            // apertar de novo = cancela
            this.aimingSkill = null;
          } else {
            this.aimingSkill = slot;
          }
        } else {
          // habilidade em recarga → mostra erro
          this.cast(u, slot, wx, wy, null);
        }
      }
      // ESC cancela mira
      if (e.key === 'Escape' && this.aimingSkill) { this.aimingSkill = null; }
      // feitiços de invocador: D e F
      if (k === 'd') this.useSummoner(0);
      if (k === 'f') this.useSummoner(1);
      if (k === 'a') { this.aMovePending = true; this.text(u.x, u.y - 46, 'Mover-atacar: clique no destino', '#ff8080'); }
      if (k === 'b' && !u.dead && u.recallT < 0) { u.recallT = this.t + 6; u.moveTgt = null; u.attackTgt = null; sfx.recall(); }
      if (k === 's') { u.moveTgt = null; u.attackTgt = null; u.attackMove = false; u.retalTgt = null; }
      if (k === 'y') this.camLock = !this.camLock;
      if (k === ' ') { e.preventDefault(); this.camX = u.x; this.camY = u.y; }
      if (['1', '2', '3', '4', '5', '6'].includes(k)) this.useActive();
    };
    const onMiniDown = (e: MouseEvent) => {
      if (!this.mini) return;
      e.preventDefault();
      const rect = this.mini.getBoundingClientRect();
      const wx = (e.clientX - rect.left) / rect.width * WORLD;
      const wy = (e.clientY - rect.top) / rect.height * WORLD;
      if (e.button === 2) {
        const [nx, ny] = nearestWalkable(wx, wy);
        this.player.moveTgt = [nx, ny]; this.player.attackTgt = null;
      } else { this.camLock = false; this.camX = wx; this.camY = wy; }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.camZoom = clamp(this.camZoom - e.deltaY * 0.001, 0.55, 1.5);
    };
    cv.addEventListener('contextmenu', onCtx);
    cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseleave', onLeave);
    cv.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    if (this.mini) { this.mini.addEventListener('mousedown', onMiniDown); this.mini.addEventListener('contextmenu', onCtx); }
    this.onDestroy.push(() => {
      cv.removeEventListener('contextmenu', onCtx);
      cv.removeEventListener('mousedown', onDown);
      cv.removeEventListener('mousemove', onMove);
      cv.removeEventListener('mouseleave', onLeave);
      cv.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      if (this.mini) this.mini.removeEventListener('mousedown', onMiniDown);
    });
  }

  // ---------- render ----------
  prerenderGround() {
    const RES = 600, S = WORLD / RES;
    const g = document.createElement('canvas');
    g.width = RES; g.height = RES;
    const c = g.getContext('2d')!;
    const distToPoly = (px: number, py: number, poly: Vec[]) => {
      let best = 1e9;
      for (let i = 0; i < poly.length - 1; i++) {
        const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
        const abx = bx - ax, aby = by - ay;
        const t2 = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby), 0, 1);
        best = Math.min(best, dist(px, py, ax + abx * t2, ay + aby * t2));
      }
      return best;
    };
    // noise deterministic
    let seed = 12345;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const wx = x * S + S / 2, wy = y * S + S / 2;
      const n = rand() * 12 - 6; // ruído controlado
      const n2 = rand() * 8 - 4; // segundo oitavo
      let col: [number, number, number];

      if (!isWalkable(wx, wy)) {
        // ===== FLORESTA / MATA =====
        const deep = Math.min(
          distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, RIVER),
          distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.bot)
        );
        if (deep > 400) {
          // floresta profunda: tom mais escuro e quente
          col = [28 + n, 54 + n, 34 + n];
          if (rand() > 0.88) col = [col[0] + 20, col[1] + 32, col[2] + 18]; // copas claras
          if (rand() > 0.96) col = [18 + n, 40 + n, 24 + n];                   // manchas escuras
        } else if (deep > 200) {
          // floresta média
          col = [40 + n, 72 + n, 44 + n];
          if (rand() > 0.85) col = [55 + n, 95 + n, 55 + n]; // copas claras
        } else {
          // borda da floresta
          col = [50 + n, 85 + n, 50 + n];
          if (rand() > 0.82) col = [65 + n, 100 + n, 58 + n]; // grama da borda
        }
        // sombras das árvores: lógica baseada em ruído em grid 4x4
        const tx = (x % 4 < 2) ? 1 : 0, ty = (y % 4 < 2) ? 1 : 0;
        if (tx + ty === 1 && rand() > 0.5) col = [col[0] - 10, col[1] - 14, col[2] - 8];
      } else if (
        distToPoly(wx, wy, RIVER) < 120 ||
        dist(wx, wy, BARON_PIT[0], BARON_PIT[1]) < 150 ||
        dist(wx, wy, DRAGON_PIT[0], DRAGON_PIT[1]) < 150
      ) {
        // ===== ÁGUA =====
        const riverDist = distToPoly(wx, wy, RIVER);
        const waterDepth = clamp(1 - riverDist / 130, 0, 1); // mais escuro no centro
        const wave = Math.sin(wx * 0.03 + wy * 0.02 + this.t * 0) * 6;
        if (rand() > 0.92) {
          // reflexo de luz
          col = [90 + n, 155 + n, 195 + n];
        } else {
          col = [
            clamp(50 + waterDepth * 20 + wave + n, 30, 110),
            clamp(90 + waterDepth * 30 + wave + n, 60, 150),
            clamp(130 + waterDepth * 40 + wave + n, 90, 200)
          ];
        }
        // ondulação sutil
        if (Math.sin(wx * 0.08 + wy * 0.05) > 0.7) col = [col[0] + 8, col[1] + 12, col[2] + 15];
      } else if (
        Math.min(distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, LANES.bot)) < 110
      ) {
        // ===== ESTRADA =====
        const laneDist = Math.min(distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, LANES.bot));
        if (laneDist < 85) {
          // centro da estrada: terra compactada
          col = [142 + n, 118 + n, 82 + n];
          // pedregulhos ocasionais
          if (rand() > 0.95) col = [col[0] - 16, col[1] - 14, col[2] - 10];
        } else {
          // borda da estrada: terra solta
          col = [125 + n, 105 + n, 72 + n];
          if (rand() > 0.85) col = [108 + n, 94 + n, 62 + n]; // sombra de borda
          // grama crescendo na borda
          if (rand() > 0.75) col = [80 + n, 110 + n, 60 + n];
        }
      } else if (
        dist(wx, wy, FOUNTAINS[0][0], FOUNTAINS[0][1]) < 340 ||
        dist(wx, wy, FOUNTAINS[1][0], FOUNTAINS[1][1]) < 340
      ) {
        // ===== PLATAFORMAS DAS BASES =====
        const isBlue = dist(wx, wy, FOUNTAINS[0][0], FOUNTAINS[0][1]) < 340;
        const fd = isBlue
          ? dist(wx, wy, FOUNTAINS[0][0], FOUNTAINS[0][1])
          : dist(wx, wy, FOUNTAINS[1][0], FOUNTAINS[1][1]);
        const fdNorm = clamp(fd / 340, 0, 1);
        if (isBlue) {
          col = [
            clamp(62 + fdNorm * 30 + n, 40, 120),
            clamp(82 + fdNorm * 20 + n, 50, 120),
            clamp(120 + fdNorm * 16 + n, 80, 170)
          ];
          // runas brilhantes na base
          if (fd < 200 && Math.sin(wx * 0.1 + wy * 0.12) > 0.85) col = [col[0] + 18, col[1] + 20, col[2] + 30];
        } else {
          col = [
            clamp(120 + fdNorm * 20 + n, 80, 170),
            clamp(68 + fdNorm * 20 + n, 40, 120),
            clamp(65 + fdNorm * 20 + n, 40, 120)
          ];
          if (fd < 200 && Math.sin(wx * 0.1 + wy * 0.12) > 0.85) col = [col[0] + 30, col[1] + 14, col[2] + 14];
        }
      } else {
        // ===== GRAMA / SELVA PASSÁVEL =====
        // grama com duas camadas de ruído para textura orgânica
        col = [68 + n + n2 * 0.5, 108 + n + n2 * 0.3, 56 + n + n2 * 0.4];
        // manchas de grama mais escura (sombra de vegetação)
        if (rand() > 0.88) col = [col[0] - 12, col[1] - 18, col[2] - 8];
        // manchas de grama mais clara (luz)
        if (rand() > 0.90) col = [col[0] + 10, col[1] + 16, col[2] + 8];
        // flores/vegetação ocasional
        if (rand() > 0.97) {
          const flower = rand();
          if (flower < 0.3) col = [180 + n, 70 + n, 70 + n];       // vermelha
          else if (flower < 0.6) col = [220 + n, 200 + n, 80 + n];  // amarela
          else col = [80 + n, 80 + n, 180 + n];                      // azul
        }
      }
      c.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      c.fillRect(x, y, 1, 1);
    }
    // ===== DECORAÇÕES DO TERRENO (pós-processamento) =====
    seed = 54321;
    const r2 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // gramas detalhadas
    for (let i = 0; i < 2200; i++) {
      const gx = r2() * RES, gy = r2() * RES;
      const wx = gx * S, wy = gy * S;
      if (!isWalkable(wx, wy)) continue;
      const grassCol = `rgb(${85 + r2() * 50 | 0},${120 + r2() * 60 | 0},${60 + r2() * 40 | 0})`;
      c.fillStyle = grassCol;
      if (r2() > 0.5) {
        // tufo de grama vertical (3 linhas)
        c.fillRect(gx, gy - 1.5, 0.8, 2.5);
        c.fillRect(gx + 1, gy - 2, 0.8, 3);
        c.fillRect(gx + 2, gy - 1, 0.8, 2);
      } else {
        // tufo circular
        c.fillRect(gx, gy, 2, 1);
        c.fillRect(gx - 0.5, gy - 0.5, 1, 2);
      }
    }
    // flores coloridas esparsas
    for (let i = 0; i < 300; i++) {
      const fx = r2() * RES, fy = r2() * RES;
      const wx = fx * S, wy = fy * S;
      if (!isWalkable(wx, wy)) continue;
      // não na água nem na estrada
      if (distToPoly(wx, wy, RIVER) < 130) continue;
      if (Math.min(distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, LANES.bot)) < 115) continue;
      const flowerR = r2();
      const col = flowerR < 0.3 ? [230, 90, 90] : flowerR < 0.6 ? [240, 220, 100] : flowerR < 0.8 ? [100, 100, 220] : [255, 160, 200];
      c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      c.fillRect(fx, fy, 1.2, 1.2);
      // caule
      c.fillStyle = `rgb(${50 + r2() * 30 | 0},${90 + r2() * 30 | 0},${40 + r2() * 20 | 0})`;
      c.fillRect(fx + 0.3, fy + 1.2, 0.5, 1.5);
    }
    // pedras na selva
    for (let i = 0; i < 180; i++) {
      const px2 = r2() * RES, py2 = r2() * RES;
      const wx = px2 * S, wy = py2 * S;
      if (!isWalkable(wx, wy)) continue;
      if (Math.min(distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, LANES.bot)) < 108) continue;
      const shade2 = 80 + r2() * 40;
      c.fillStyle = `rgb(${shade2 | 0},${shade2 - 5 | 0},${shade2 - 10 | 0})`;
      const sr = 1 + r2() * 2;
      c.fillRect(px2, py2, sr, sr * 0.7);
      c.fillStyle = `rgb(${shade2 + 15 | 0},${shade2 + 10 | 0},${shade2 + 5 | 0})`;
      c.fillRect(px2, py2, sr, 0.5); // brilho na pedra
    }
    // cogumelos na selva escura
    for (let i = 0; i < 80; i++) {
      const mx = r2() * RES, my = r2() * RES;
      const wx = mx * S, wy = my * S;
      if (!isWalkable(wx, wy)) continue;
      const deep = Math.min(distToPoly(wx, wy, LANES.mid), distToPoly(wx, wy, RIVER), distToPoly(wx, wy, LANES.top), distToPoly(wx, wy, LANES.bot));
      if (deep < 300) continue; // só na floresta profunda
      c.fillStyle = r2() > 0.5 ? `rgb(${180 + r2() * 40 | 0},${60 + r2() * 30 | 0},${60 + r2() * 20 | 0})` : `rgb(${120 + r2() * 40 | 0},${140 + r2() * 30 | 0},${80 + r2() * 20 | 0})`;
      c.fillRect(mx, my, 1.8, 1.2);
      c.fillStyle = '#f0e8d0';
      c.fillRect(mx + 0.3, my + 0.3, 0.6, 0.4); // pontos brancos
    }
    // Preset administrativo do mapa: aplica direção de arte sem alterar a geometria.
    c.save();
    c.globalCompositeOperation = this.mapPreset.theme === 'void' ? 'multiply' : 'overlay';
    c.globalAlpha = this.mapPreset.theme === 'forest' ? 0.08 : 0.24;
    c.fillStyle = this.mapPreset.ambientColor;
    c.fillRect(0, 0, RES, RES);
    c.restore();
    this.ground = g;
  }

  worldToScreen(x: number, y: number): Vec {
    const vw = this.canvas.width, vh = this.canvas.height;
    return [
      (x - this.camX) * this.camZoom + vw / 2,
      (y - this.camY) * this.camZoom + vh / 2,
    ];
  }

  drawFog(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    // desenha uma camada escura sobre o mapa, depois "corta" buracos onde há visão
    const off = document.createElement('canvas');
    off.width = vw; off.height = vh;
    const fc = off.getContext('2d')!;
    fc.fillStyle = `rgba(4, 8, 14, ${this.mapPreset.fogOpacity})`;
    fc.fillRect(0, 0, vw, vh);
    fc.globalCompositeOperation = 'destination-out';
    const team = this.player.team as 0 | 1;
    // visão de heróis
    for (const h of this.heroes) {
      if (h.dead || h.team !== team) continue;
      const [sx, sy] = this.worldToScreen(h.x, h.y);
      const r = h.def?.ranged ? 380 : 320;
      const g = fc.createRadialGradient(sx, sy, r * 0.5, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.8)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(sx, sy, r, 0, Math.PI * 2); fc.fill();
    }
    // torres aliadas
    for (const t of this.units.filter(u2 => u2.kind === 'tower' && u2.team === team)) {
      const [sx, sy] = this.worldToScreen(t.x, t.y);
      const r = 450;
      const g = fc.createRadialGradient(sx, sy, r * 0.5, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(sx, sy, r, 0, Math.PI * 2); fc.fill();
    }
    // wards
    for (const w of this.wards) {
      if (w.team !== team) continue;
      const [sx, sy] = this.worldToScreen(w.x, w.y);
      const r = 320;
      const g = fc.createRadialGradient(sx, sy, r * 0.5, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(sx, sy, r, 0, Math.PI * 2); fc.fill();
    }
    // "memória" (já visto mas não visível agora) — cinza
    fc.globalCompositeOperation = 'destination-over';
    fc.fillStyle = `rgba(4, 8, 14, ${Math.max(0.2, this.mapPreset.fogOpacity - 0.13)})`;
    const VG = 38;
    const cellPx = vw / VG;
    const cx0 = Math.floor((this.camX - vw / 2) / 80), cy0 = Math.floor((this.camY - vh / 2) / 80);
    const cx1 = Math.ceil((this.camX + vw / 2) / 80), cy1 = Math.ceil((this.camY + vh / 2) / 80);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= VG || cy >= VG) continue;
      if ((this.fog.seen[cy * VG + cx] & (team === 0 ? 1 : 2)) === 0) {
        fc.fillRect(cx * cellPx - (this.camX - vw / 2), cy * cellPx - (this.camY - vh / 2), cellPx + 1, cellPx + 1);
      }
    }
    ctx.drawImage(off, 0, 0);
  }

  render() {
    const { ctx, canvas } = this;
    const vw = canvas.width, vh = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a1410';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    // zoom centrado + screen shake
    if (this.camZoom !== 1) {
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(this.camZoom, this.camZoom);
      ctx.translate(-vw / 2, -vh / 2);
    }
    if (this.shakeT > 0) ctx.translate(rnd(-this.shakeM, this.shakeM), rnd(-this.shakeM, this.shakeM));
    if (this.ground) {
      const RES = this.ground.width, S = WORLD / RES;
      const sx = (this.camX - vw / 2 / this.camZoom) / S, sy = (this.camY - vh / 2 / this.camZoom) / S;
      const sw = vw / this.camZoom / S, sh = vh / this.camZoom / S;
      ctx.drawImage(this.ground, sx, sy, sw, sh, 0, 0, vw, vh);
    }
    // camada ambiente (vagalumes e rio) — antes da névoa para respeitar a visão
    this.drawAmbient();
    // fog of war: escurece áreas não visíveis
    this.drawFog(ctx, vw, vh);
    // ===== PULSO DAS FONTES (glow de cura pulsante nas bases) =====
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FOUNTAINS.forEach(([fx, fy], fi) => {
      const [gsx, gsy] = this.worldToScreen(fx, fy);
      if (gsx < -200 || gsy < -200 || gsx > vw + 200 || gsy > vh + 200) return;
      const pulse = 0.32 + Math.sin(this.t * 2.4 + fi * Math.PI) * 0.1;
      const col = fi === 0 ? '#4ab0ff' : '#ff5a4a';
      const g = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, 130);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gsx, gsy, 130, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    for (const z of this.zones) {
      if (z.trap && z.team !== this.player.team) continue;
      const [sx, sy] = this.worldToScreen(z.x, z.y);
      if (sx < -200 || sy < -200 || sx > vw + 200 || sy > vh + 200) continue;
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(sx, sy, z.r, 0, Math.PI * 2); ctx.fill();
      if (z.kind === 'shroom') {
        ctx.fillStyle = '#8c5c3a'; ctx.fillRect(sx - 4, sy - 4, 8, 10);
        ctx.fillStyle = '#c04848'; ctx.fillRect(sx - 9, sy - 10, 18, 8);
        ctx.fillStyle = '#f0e0d0'; ctx.fillRect(sx - 5, sy - 8, 4, 3); ctx.fillRect(sx + 2, sy - 9, 4, 3);
      }
    }
    if (this.hawkPing) {
      const [sx, sy] = this.worldToScreen(this.hawkPing.x, this.hawkPing.y);
      ctx.strokeStyle = 'rgba(160,224,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, 200, 0, Math.PI * 2); ctx.stroke();
    }
    if (!this.player.dead) {
      const [sx, sy] = this.worldToScreen(this.player.x, this.player.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, this.player.atkRange, 0, Math.PI * 2); ctx.stroke();
    }
    const sorted = [...this.units].filter(u => !u.dead).sort((a, b) => a.y - b.y);
    const myTeam = this.player.team as 0 | 1;
    for (const u of sorted) {
      // fog of war: não desenha unidades inimigas fora da visão
      if (u.team !== myTeam && u.team !== 2 && !this.fog.isVisible(u.x, u.y, myTeam)) continue;
      // wards
      this.drawUnit(u);
    }
    // wards
    for (const w of this.wards) {
      if (w.team !== myTeam && !this.fog.wasSeen(w.x, w.y, myTeam)) continue;
      const [sx, sy] = this.worldToScreen(w.x, w.y);
      const isMine = w.team === myTeam;
      ctx.fillStyle = isMine ? '#80e0a0' : '#e08080';
      ctx.fillRect(sx - 3, sy - 12, 6, 12);
      ctx.fillStyle = isMine ? '#40c060' : '#c04040';
      ctx.beginPath(); ctx.arc(sx, sy - 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 1, sy - 15, 2, 2);
      if (isMine) {
        const lifeFrac = (w.until - this.t) / (w.kind === 'sentry' ? 180 : 120);
        ctx.strokeStyle = '#80e0a0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy - 14, 8, -Math.PI / 2, -Math.PI / 2 + lifeFrac * Math.PI * 2); ctx.stroke();
      }
    }
    // ===== DOTA: RUNAS DO RIO =====
    for (const r of this.riverRunes) {
      if (!this.fog.isVisible(r.x, r.y, myTeam)) continue;
      const [sx, sy] = this.worldToScreen(r.x, r.y);
      const runeColors = { dd: '#ff4040', haste: '#5ad0c0', invis: '#a060ff', regen: '#60ffa0' };
      const color = runeColors[r.kind] || '#fff';
      
      // brilho aditivo sob a runa
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 5) * 0.15;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // corpo de diamante
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx + 5, sy);
      ctx.lineTo(sx, sy + 8);
      ctx.lineTo(sx - 5, sy);
      ctx.closePath();
      ctx.fill();

      // brilho branco no centro
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 2, 2, 4);
    }
    for (const p of this.projs) {
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      const mag = Math.hypot(p.dx, p.dy) || 1;
      const isSkill = p.kind !== 'attack';
      const isBigSkill = p.kind === 'bigarrow' || p.size > 8;
      ctx.globalCompositeOperation = 'lighter';
      // rastro alongado com brilho — mais longo para skillshots
      const trailLen = isBigSkill ? 10 : isSkill ? 7 : 4;
      for (let i = 1; i <= trailLen; i++) {
        const fadeT = i / (trailLen + 1);
        ctx.globalAlpha = (isSkill ? 0.55 : 0.32) * (1 - fadeT);
        ctx.fillStyle = p.color;
        const ts = p.size * (1 - fadeT * 0.7);
        // trilha em ondas suaves (mais orgânica)
        const wave = Math.sin(fadeT * Math.PI * 2 + this.t * 8) * (isSkill ? 2 : 1);
        const perpX = -p.dy / mag * wave, perpY = p.dx / mag * wave;
        ctx.fillRect(
          sx - (p.dx / mag) * 5 * i + perpX - ts,
          sy - (p.dy / mag) * 5 * i + perpY - ts,
          ts * 2, ts * 2
        );
      }
      ctx.globalAlpha = 1;
      // halo de brilho no núcleo (só skillshots) — duplo halo
      if (isSkill) {
        const haloR = p.size * (isBigSkill ? 3.5 : 2.8);
        // halo externo suave
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, Math.PI * 2); ctx.fill();
        // núcleo brilhante pulsante
        const pulseR = p.size * (1 + Math.sin(this.t * 20) * 0.15);
        const gCore = ctx.createRadialGradient(sx, sy, 0, sx, sy, pulseR);
        gCore.addColorStop(0, '#ffffff'); gCore.addColorStop(0.5, p.color); gCore.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gCore;
        ctx.beginPath(); ctx.arc(sx, sy, pulseR, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // núcleo sólido no formato do projétil
      if (isBigSkill) {
        // formato de flecha para skillshots grandes (ex: crystal arrow)
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(p.dy, p.dx));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.size * 1.5, 0);
        ctx.lineTo(-p.size, -p.size * 0.7);
        ctx.lineTo(-p.size * 0.5, 0);
        ctx.lineTo(-p.size, p.size * 0.7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(p.size * 1.2, 0);
        ctx.lineTo(-p.size * 0.5, -p.size * 0.35);
        ctx.lineTo(-p.size * 0.3, 0);
        ctx.lineTo(-p.size * 0.5, p.size * 0.35);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      }
      // faíscas ocasionais nos skillshots
      if (isSkill && Math.random() < 0.4) {
        this.fx.push({ kind: 'spark', x: p.x + rnd(-6, 6), y: p.y + rnd(-6, 6),
          size: 2.5, until: this.t + 0.2, dur: 0.2, color: p.color });
      }
    }
    for (const f of this.fx) this.drawFX(f);
    // Pings táticos no mundo
    for (const p of this.pings) {
      if (p.until <= this.t) continue;
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      const pingColors = { danger: '#ff4040', omw: '#40c0ff', missing: '#ffe040', assist: '#40ff80' };
      const icons = { danger: '⚠️', omw: '🏃', missing: '❓', assist: '🆘' };
      ctx.fillStyle = pingColors[p.kind];
      ctx.beginPath(); ctx.arc(sx, sy, 18 + Math.sin(this.t * 8) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(icons[p.kind], sx, sy + 6);
    }
    ctx.restore();
    const u0 = this.player;
    if (u0.recallT > 0) {
      const [sx, sy] = this.worldToScreen(u0.x, u0.y);
      const frac = 1 - (u0.recallT - this.t) / 6;
      ctx.strokeStyle = '#80c0ff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sx, sy - 30, 18, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    }
    this.renderAimIndicator();
    this.renderScreenFx();
    this.renderMinimap();
  }

  /** Renderiza efeitos de tela cheia (tintas/vinhetas de ultimate). */
  /** Renderiza indicador visual de mira para skillshots (linha, cone, círculo). */
  renderAimIndicator() {
    if (!this.aimingSkill) return;
    const u = this.player;
    if (u.dead || !u.def) return;
    const slot = this.aimingSkill;
    const ab = u.def.abilities[slot];
    const aimType = this.aimTypeOf(ab);
    const { ctx } = this;
    // coords do mouse no mundo
    const [wx, wy] = [this.mouse.x - this.canvas.width / 2 + this.camX, this.mouse.y - this.canvas.height / 2 + this.camY];
    const [sx, sy] = this.worldToScreen(u.x, u.y);
    const [mx, my] = this.worldToScreen(wx, wy);
    const range = ab.range > 0 ? ab.range : 200;
    const isUlt = slot === 'R';
    const col = isUlt ? '#ffd840' : u.team === 0 ? '#60d0ff' : '#ff8080';
    const colHex = isUlt ? 'rgba(255,216,64,' : u.team === 0 ? 'rgba(96,208,255,' : 'rgba(255,128,128,';

    ctx.save();
    // círculo de alcance máximo (sempre visível)
    ctx.strokeStyle = colHex + '0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(sx, sy, range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    if (aimType === 'line') {
      // linha de skillshot: retângulo do lançador ao alcance na direção do cursor
      const dx = mx - sx, dy = my - sy;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      const width = 28; // largura do skillshot
      const len = range;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(ny, nx));
      // corpo do feixe (com gradient interno)
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, colHex + '0.5)');
      g.addColorStop(0.7, colHex + '0.28)');
      g.addColorStop(1, colHex + '0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -width / 2, len, width);
      // bordas
      ctx.strokeStyle = colHex + '0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -width / 2); ctx.lineTo(len, -width / 2);
      ctx.moveTo(0, width / 2); ctx.lineTo(len, width / 2);
      ctx.stroke();
      // ponta da flecha no final
      ctx.beginPath();
      ctx.moveTo(len - 12, -width / 2 - 4);
      ctx.lineTo(len, 0);
      ctx.lineTo(len - 12, width / 2 + 4);
      ctx.stroke();
      ctx.restore();
    } else if (aimType === 'cone') {
      // cone à frente do lançador
      const dx = mx - sx, dy = my - sy;
      const ang = Math.atan2(dy, dx);
      const spread = 0.6; // meia-abertura em radianos
      const coneLen = Math.min(range, 220);
      ctx.save();
      // preenchimento com gradient
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, coneLen);
      grd.addColorStop(0, colHex + '0.55)');
      grd.addColorStop(1, colHex + '0.05)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, coneLen, ang - spread, ang + spread);
      ctx.closePath();
      ctx.fill();
      // borda
      ctx.strokeStyle = colHex + '0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (aimType === 'circle') {
      // círculo AoE no cursor (clamp no alcance)
      const dxm = wx - u.x, dym = wy - u.y;
      const dm = Math.hypot(dxm, dym) || 1;
      const cx = dm > range ? u.x + (dxm / dm) * range : wx;
      const cy = dm > range ? u.y + (dym / dm) * range : wy;
      const [scx, scy] = this.worldToScreen(cx, cy);
      const radius = isUlt ? 120 : 90;
      // preenchimento pulsante
      const pulse = 1 + Math.sin(this.t * 6) * 0.05;
      const grd = ctx.createRadialGradient(scx, scy, 0, scx, scy, radius * pulse);
      grd.addColorStop(0, colHex + '0.05)');
      grd.addColorStop(0.7, colHex + '0.25)');
      grd.addColorStop(1, colHex + '0.5)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(scx, scy, radius * pulse, 0, Math.PI * 2); ctx.fill();
      // borda
      ctx.strokeStyle = colHex + '0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(scx, scy, radius * pulse, 0, Math.PI * 2); ctx.stroke();
      // cruz central
      ctx.beginPath();
      ctx.moveTo(scx - 8, scy); ctx.lineTo(scx + 8, scy);
      ctx.moveTo(scx, scy - 8); ctx.lineTo(scx, scy + 8);
      ctx.stroke();
    }

    // label da skill no cursor
    ctx.fillStyle = '#000';
    ctx.fillRect(mx - 30, my - 30, 60, 18);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.strokeRect(mx - 30, my - 30, 60, 18);
    ctx.fillStyle = col;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${slot}] ${aimType.toUpperCase()}`, mx, my - 17);

    ctx.restore();
  }

  renderScreenFx() {
    const { ctx, canvas } = this;
    const vw = canvas.width, vh = canvas.height;
    for (const s of this.screenFx) {
      const elapsed = s.dur - (s.until - this.t);
      const life = clamp((s.until - this.t) / s.dur, 0, 1);          // 1→0
      const ramp = Math.min(1, elapsed / 0.12);                       // sobe rápido
      const a = s.intensity * life * ramp;
      // tinta colorida em tela cheia
      ctx.fillStyle = s.color;
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(0, 0, vw, vh);
      // vinheta radial
      if (s.vignette) {
        const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.25, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, this.colorWithAlpha(s.color, 0.6 * ramp));
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillRect(0, 0, vw, vh);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    this.screenFx = this.screenFx.filter(s => s.until > this.t);
  }

  colorWithAlpha(color: string, a: number): string {
    // converte hex/rgb para rgba
    if (color.startsWith('#')) {
      const n = parseInt(color.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    if (color.startsWith('rgba(')) return color.replace(/,[\d.]+\)$/, `,${a})`);
    return color;
  }

  drawUnit(u: Unit) {
    const { ctx } = this;
    const [sx, sy] = this.worldToScreen(u.x, u.y);
    const vw = this.canvas.width, vh = this.canvas.height;
    if (sx < -140 || sy < -140 || sx > vw + 140 || sy > vh + 140) return;
    const moving = !!u.moveTgt || (!!u.attackTgt && dist(u.x, u.y, u.attackTgt.x, u.attackTgt.y) > u.atkRange + u.attackTgt.r);
    const frame4 = Math.floor(u.animT * 8) % 4;
    const frame6 = Math.floor(u.animT * 11) % 6;   // ciclo de caminhada de 6 frames
    // sombra proporcional ao sprite (heróis 33% maiores)
    const shR = u.kind === 'hero' ? u.r + 10 : u.kind === 'monster' ? u.r + 6 : u.r + 3;
    ctx.fillStyle = `rgba(0,0,0,${u.kind === 'hero' ? 0.4 : 0.3})`;
    ctx.beginPath(); ctx.ellipse(sx, sy + 6, shR, shR * 0.33, 0, 0, Math.PI * 2); ctx.fill();
    if (u.kind === 'hero') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(sx, sy + 9, shR * 1.25, shR * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (u.kind === 'tower') {
      // ===== TORRE MELHORADA — mais detalhes e glow =====
      const tc = u.team === 0 ? '#4a6a9c' : '#9c4a4a';
      const glow = u.team === 0 ? '#70c8ff' : '#ff8070';
      const attackable = this.towerAttackable(u);
      const tcCel = celE(tc);
      // base
      ctx.fillStyle = '#4a4a55'; ctx.fillRect(sx - 22, sy - 14, 44, 20);
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(sx - 22, sy - 14, 44, 5);
      // corpo
      ctx.fillStyle = tcCel.b; ctx.fillRect(sx - 15, sy - 60, 30, 48);
      ctx.fillStyle = tcCel.l; ctx.fillRect(sx - 15, sy - 60, 30, 10);
      ctx.fillStyle = tcCel.d; ctx.fillRect(sx + 6, sy - 50, 10, 38);
      // cume
      ctx.fillStyle = '#3c3c46'; ctx.fillRect(sx - 18, sy - 66, 36, 8);
      ctx.fillStyle = '#2e2e38'; ctx.fillRect(sx - 14, sy - 72, 28, 8);
      // orbe mágico no topo
      ctx.fillStyle = attackable ? glow : '#6a6a78';
      ctx.beginPath(); ctx.arc(sx, sy - 78, 8, 0, Math.PI * 2); ctx.fill();
      if (attackable) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 4) * 0.12;
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy - 78, 15, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      // emblemas laterais
      ctx.fillStyle = shadeE(tc, 20);
      ctx.fillRect(sx - 20, sy - 56, 5, 10);
      ctx.fillRect(sx + 15, sy - 56, 5, 10);
      // estandarte do time ondulando no mastro
      const wave = Math.sin(this.t * 3.5 + u.x * 0.01) * 2.5;
      ctx.fillStyle = u.team === 0 ? '#3a8cff' : '#ff4a4a';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 82);
      ctx.lineTo(sx + 14, sy - 76 + wave);
      ctx.lineTo(sx, sy - 66);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = u.team === 0 ? '#7fc0ff' : '#ff9a8a';
      ctx.fillRect(sx, sy - 81, 2, 14);
      // rachaduras de dano quando a torre está abalada
      if (u.hp < u.maxHp * 0.4) {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - 9, sy - 56); ctx.lineTo(sx - 3, sy - 42); ctx.lineTo(sx - 7, sy - 32);
        ctx.moveTo(sx + 7, sy - 58); ctx.lineTo(sx + 3, sy - 44); ctx.lineTo(sx + 9, sy - 36);
        ctx.stroke();
      }
      this.bar(sx, sy - 90, 52, 6, u.hp / u.maxHp, u.team === 0 ? '#40a0ff' : '#ff5050');
      return;
    }
    if (u.kind === 'inhib') {
      const col = u.team === 0 ? '#4a6a9c' : '#9c4a4a';
      const inCel = celE(col);
      ctx.fillStyle = '#50505c'; ctx.fillRect(sx - 20, sy - 10, 40, 18);
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(sx - 20, sy - 10, 40, 4);
      // cristal central
      ctx.save(); ctx.translate(sx, sy - 28); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = inCel.b; ctx.fillRect(-14, -14, 28, 28);
      ctx.fillStyle = inCel.l; ctx.fillRect(-14, -14, 28, 8);
      ctx.fillStyle = u.team === 0 ? '#80d0ff' : '#ffa080'; ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      // glow pulsante
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + Math.sin(this.t * 2.5) * 0.08;
      ctx.fillStyle = u.team === 0 ? '#80d0ff' : '#ffa080';
      ctx.beginPath(); ctx.arc(sx, sy - 28, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      this.bar(sx, sy - 55, 46, 5, u.hp / u.maxHp, u.team === 0 ? '#40a0ff' : '#ff5050');
      return;
    }
    if (u.kind === 'nexus') {
      const col = u.team === 0 ? '#5a8ad0' : '#d05a5a';
      const nCel = celE(col);
      ctx.fillStyle = '#4a4a56'; ctx.fillRect(sx - 32, sy - 12, 64, 24);
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(sx - 32, sy - 12, 64, 5);
      // diamante central rotativo
      ctx.save(); ctx.translate(sx, sy - 42); ctx.rotate(Math.PI / 4);
      const pulse = 1 + Math.sin(this.t * 3) * 0.08;
      ctx.fillStyle = nCel.b; ctx.fillRect(-22 * pulse, -22 * pulse, 44 * pulse, 44 * pulse);
      ctx.fillStyle = nCel.l; ctx.fillRect(-22 * pulse, -22 * pulse, 44 * pulse, 12 * pulse);
      ctx.fillStyle = u.team === 0 ? '#a0e0ff' : '#ffc0a0'; ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
      // anéis de energia concêntricos
      for (let ri = 0; ri < 3; ri++) {
        const r = 30 + ri * 12 + Math.sin(this.t * 2 + ri) * 4;
        ctx.strokeStyle = u.team === 0 ? 'rgba(160,224,255,0.2)' : 'rgba(255,192,160,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy - 42, r, 0, Math.PI * 2); ctx.stroke();
      }
      this.bar(sx, sy - 82, 64, 7, u.hp / u.maxHp, u.team === 0 ? '#40a0ff' : '#ff5050');
      return;
    }
    let spr: HTMLCanvasElement;
    if (u.kind === 'hero') {
      // determina a pose: cast > attack > walk > idle
      let pose: import('./sprites').Pose;
      let pFrame = frame6;
      if (this.t - u.castT < 0.45) {
        // conjuração: percorre os 6 frames uma vez (agacha → ergue → libera)
        pose = 'cast';
        pFrame = Math.min(5, Math.floor((this.t - u.castT) / 0.45 * 6));
      } else if (this.t - u.attackAnimT < 0.34) {
        // ataque: anticipação → impacto → recuperação (não loopa)
        pose = 'attack';
        pFrame = Math.min(5, Math.floor((this.t - u.attackAnimT) / 0.34 * 6));
      } else if (moving) {
        pose = 'walk';
      } else {
        pose = 'idle';
        pFrame = Math.floor(u.animT * 3.5) % 6;   // respiração lenta
      }
      const heroLook = this.heroLooks[u.def!.id] ?? u.def!.look;
      // rastro/afterimage quando em movimento (skin-based)
      if (moving && pose === 'walk') {
        const trailCol = this.heroSkinMods[u.def!.id]?.trail ?? '#f0e0b0';
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = trailCol;
        const prevFrame = (pFrame + 4) % 6;
        const prevSpr = getHeroSprite(heroLook, u.def!.id, u.team as Team, prevFrame, 'walk');
        ctx.drawImage(prevSpr, sx - prevSpr.width / 2 - u.facing * 8, sy - prevSpr.height + 20);
        ctx.globalAlpha = 1;
      }
      spr = getHeroSprite(heroLook, u.def!.id, u.team as Team, pFrame, pose);
    } else if (u.kind === 'minion') {
      spr = getMinionSprite(u.team as Team, !!u.caster, moving ? frame4 : 0, !!u.superM);
    } else {
      spr = getMonsterSprite(u.campType!, frame4);
    }
    const invis = this.hasBuff(u, 'invis');
    if (invis && u.team !== this.player.team) return;
    ctx.save();
    if (invis) ctx.globalAlpha = 0.5;
    const dw = spr.width, dh = spr.height;
    if (u.facing < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    // offset vertical: heróis são sprites maiores (26x26 U=4), posicionamento mais acima
    ctx.drawImage(spr, sx - dw / 2, sy - dh + (u.kind === 'hero' ? 20 : 12));
    const spriteY = sy - dh + (u.kind === 'hero' ? 20 : 12);
    // flash de dano
    if (u.flashT > 0) {
      ctx.globalAlpha = Math.min(0.8, u.flashT * 7) * (invis ? 0.5 : 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - dw / 2, spriteY, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = invis ? 0.5 : 1;
    }
    ctx.restore();
    // ===== AURAS DE BUFF NO MUNDO (orbitando o herói) =====
    if (u.kind === 'hero' && !u.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const orbit = (count: number, radius: number, color: string, speed: number, size: number) => {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + this.t * speed;
          const ox = sx + Math.cos(a) * radius;
          const oy = sy - 10 + Math.sin(a) * radius * 0.55;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = color;
          ctx.fillRect(ox - size, oy - size, size * 2, size * 2);
          ctx.globalAlpha = 0.35;
          ctx.fillRect(ox - size * 2, oy - size * 2, size * 4, size * 4);
        }
      };
      if (this.hasBuff(u, 'bluebuff')) orbit(3, 17, '#60a0ff', 2.2, 2);
      if (this.hasBuff(u, 'redbuff')) orbit(3, 17, '#ff7050', 2.4, 2);
      if (this.hasBuff(u, 'dd')) orbit(4, 19, '#ff4040', 3.2, 2);
      if (this.hasBuff(u, 'haste')) orbit(5, 20, '#5ad0c0', 4.5, 1.5);
      if (this.hasBuff(u, 'regen')) orbit(4, 16, '#60ffa0', 1.6, 1.5);
      // Barão: anel pulsante roxo sob os pés
      if (this.hasBuff(u, 'baron')) {
        const br = 20 + Math.sin(this.t * 4) * 3;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#c080ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx, sy + 4, br, br * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.restore();
    }
    let iconY = sy - dh + 2;
    if (this.isStunned(u)) { ctx.fillStyle = '#ffe860'; for (let i = 0; i < 3; i++) { const a = this.t * 4 + i * 2.1; ctx.fillRect(sx + Math.cos(a) * 14 - 2, iconY - 6 + Math.sin(a) * 4, 4, 4); } }
    if (this.hasBuff(u, 'root')) { ctx.fillStyle = '#a060e0'; ctx.fillRect(sx - 10, sy + 2, 20, 4); }
    if (this.hasBuff(u, 'fear')) { ctx.fillStyle = '#b080e0'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', sx, iconY - 8); }
    const sh = u.buffs.find(b => (b.key === 'shield' || b.key === 'bshield') && (b.v ?? 0) > 0);
    if (sh) { ctx.strokeStyle = sh.key === 'bshield' ? '#6060a0' : '#e8e8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 14, u.r + 8, 0, Math.PI * 2); ctx.stroke(); }
    if (u.kind === 'hero') {
      // aura da skin (lendárias/épicas) pulsando sob o herói
      const aura = this.heroSkinMods[u.def!.id]?.aura;
      if (aura) {
        const pulse = 1 + Math.sin(this.t * 3 + u.id) * 0.12;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = aura; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy - 6, (u.r + 6) * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(sx, sy - 6, (u.r + 3) * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const w = 52;
      const col = u === this.player ? '#40e080' : u.team === this.player.team ? '#40a0ff' : '#ff5050';
      const ghostFrac = u.ghostT > 0 && u.ghostHp > u.hp ? u.ghostHp / u.maxHp : undefined;
      this.bar(sx, sy - dh - 6, w, 7, u.hp / u.maxHp, col, u.maxHp, ghostFrac);
      if (u.maxMp > 0) this.bar(sx, sy - dh + 3, w, 3, u.mp / u.maxMp, '#4080e0');
      ctx.fillStyle = '#101820'; ctx.fillRect(sx - w / 2 - 12, sy - dh - 7, 11, 11);
      ctx.fillStyle = '#ffe090'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(u.level), sx - w / 2 - 6, sy - dh + 2);
      ctx.fillStyle = u.team === this.player.team ? '#b0d8ff' : '#ffb0b0';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(u.name, sx, sy - dh - 10);
      // marcador de alvo atual do jogador
      if (u === this.player.attackTgt && u.team !== this.player.team) {
        ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2;
        const a0 = this.t * 3;
        for (let i = 0; i < 4; i++) {
          const a = a0 + i * Math.PI / 2;
          ctx.beginPath(); ctx.arc(sx, sy - 12, u.r + 12, a, a + 0.5); ctx.stroke();
        }
      }
    } else {
      const col = u.team === 2 ? '#c0a050' : u.team === this.player.team ? '#60b0ff' : '#ff6060';
      if (u.hp < u.maxHp || u.kind !== 'minion') this.bar(sx, sy - dh - 2, u.kind === 'monster' ? 44 : 26, 4, u.hp / u.maxHp, col);
      // last hit: marca minion que morreria com 1 ataque do jogador
      if (u.kind === 'minion' && u.team !== this.player.team && !this.player.dead && u.hp <= this.player.ad * 1.2) {
        ctx.fillStyle = '#ffffff';
        const blink = Math.sin(this.t * 10) > 0;
        if (blink) {
          ctx.fillRect(sx - 1, sy - dh - 10, 2, 6);
          ctx.fillRect(sx - 3, sy - dh - 8, 6, 2);
        }
      }
    }
  }

  bar(cx: number, cy: number, w: number, h: number, frac: number, color: string, maxHp?: number, ghostFrac?: number) {
    const { ctx } = this;
    ctx.fillStyle = '#101418';
    ctx.fillRect(cx - w / 2 - 1, cy - 1, w + 2, h + 2);
    // barra fantasma (dano recente) — clássica do gênero
    if (ghostFrac !== undefined && ghostFrac > frac) {
      const ghostW = w * clamp(ghostFrac, 0, 1);
      ctx.fillStyle = 'rgba(255, 90, 90, 0.55)';
      ctx.fillRect(cx - w / 2, cy, ghostW, h);
    }
    ctx.fillStyle = color;
    const filledW = w * clamp(frac, 0, 1);
    ctx.fillRect(cx - w / 2, cy, filledW, h);
    // Segmentos de 100 HP (ticks pretos estilo LoL clássico)
    if (maxHp && maxHp > 100) {
      const step = (100 / maxHp) * w;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      for (let px = cx - w / 2 + step; px < cx - w / 2 + w; px += step) {
        ctx.fillRect(Math.floor(px), cy, 1, h);
      }
    }
  }

  drawFX(f: FX) {
    const { ctx } = this;
    const [sx, sy] = this.worldToScreen(f.x, f.y);
    // life = 1 no início, 0 no fim (usa dur se fornecido)
    const dur = f.dur ?? 0.5;
    const life = clamp((f.until - this.t) / dur, 0, 1);
    const prog = 1 - life;   // 0 no início, 1 no fim
    // easing suave
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeIn = (t: number) => t * t * t;

    if (f.kind === 'text') {
      // tamanho proporcional ao dano: números de dano crescem com o valor
      const isDmg = /^\d+$/.test(f.text ?? '');
      const val = isDmg ? parseInt(f.text!) : 0;
      const fontSize = isDmg ? Math.min(22, 11 + Math.floor(val / 50) * 2) : (f.size ?? 12);
      const isCrit = f.text === 'CRÍTICO!' || val > 200;
      ctx.font = `bold ${fontSize}px monospace`; ctx.textAlign = 'center';
      ctx.globalAlpha = life > 0.25 ? 1 : life / 0.25;
      // outline grosso para legibilidade
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(f.text!, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text!, sx, sy);
      // brilho em números críticos
      if (isCrit && life > 0.5) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (life - 0.5) * 0.6;
        ctx.fillText(f.text!, sx, sy);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (f.kind === 'spark') {
      ctx.globalAlpha = life;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = f.color;
      const s = (f.size ?? 3) * (0.5 + life * 0.5);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx - s / 4, sy - s / 4, s / 2, s / 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      return;
    }
    // partícula flutuante com trilha (novo!) — usado em explosões e magia
    if (f.kind === 'ember') {
      ctx.globalCompositeOperation = 'lighter';
      const s = (f.size ?? 3) * life;
      // trilha
      for (let i = 3; i >= 0; i--) {
        ctx.globalAlpha = life * (0.6 - i * 0.15);
        ctx.fillStyle = f.color;
        ctx.fillRect(sx - (f.vx ?? 0) * 0.03 * i - s / 2, sy - (f.vy ?? 0) * 0.03 * i - s / 2, s, s);
      }
      ctx.globalAlpha = life;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - s / 3, sy - s / 3, s / 1.5, s / 1.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = Math.min(1, life + 0.2);
    if (f.kind === 'ring') {
      const r = f.r ?? 20;
      ctx.globalCompositeOperation = 'lighter';
      // 3 camadas de brilho concêntrico
      ctx.strokeStyle = f.color; ctx.lineWidth = 8; ctx.globalAlpha = life * 0.3;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4; ctx.globalAlpha = life * 0.7;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'click') {
      // clique cartoon: 2 anéis expansivos
      const r1 = (f.r ?? 20) * easeOut(prog);
      const r2 = (f.r ?? 20) * 0.6 * easeOut(prog);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 * life + 1; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r1, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r2, 0, Math.PI * 2); ctx.stroke();
      // cruz central
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.globalAlpha = life;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy);
      ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'castring') {
      ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(sx, sy, f.r ?? 100, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (f.kind === 'spinfx') {
      // lâmina giratória com múltiplos arcos e brilho
      const r = f.r ?? 90;
      ctx.globalCompositeOperation = 'lighter';
      const a0 = this.t * 14;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = (0.3 - k * 0.08) * Math.min(1, life + 0.3);
        ctx.strokeStyle = f.color; ctx.lineWidth = 6 - k * 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, r, a0 - k * 0.4, a0 + Math.PI * 1.3 - k * 0.4); ctx.stroke();
      }
      ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, r, a0, a0 + Math.PI * 1.3); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'beam' || f.kind === 'chain') {
      const [ex, ey] = this.worldToScreen(f.x2!, f.y2!);
      ctx.globalCompositeOperation = 'lighter';
      // 4 camadas para brilho intenso
      ctx.strokeStyle = f.color; ctx.lineWidth = (f.kind === 'chain' ? 10 : 8); ctx.globalAlpha = 0.25 * life;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = (f.kind === 'chain' ? 6 : 5); ctx.globalAlpha = 0.45 * life;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.strokeStyle = f.color; ctx.lineWidth = f.kind === 'chain' ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // faíscas na trajetória do feixe (partículas móveis)
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const t2 = (i + prog * steps) % 1;
        const px = sx + (ex - sx) * t2, py = sy + (ey - sy) * t2;
        ctx.fillStyle = f.color; ctx.globalAlpha = life * (1 - t2);
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'laser') {
      const [ex, ey] = this.worldToScreen(f.x2!, f.y2!);
      const w = 24 * life + 4;
      ctx.globalCompositeOperation = 'lighter';
      // 5 camadas de brilho crescente — laser super potente
      ctx.strokeStyle = f.color; ctx.lineWidth = 60 * life + 8; ctx.globalAlpha = 0.15;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = 40 * life + 6; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.strokeStyle = f.color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // núcleo branco brilhante pulsante
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (8 * life + 2) * (1 + Math.sin(this.t * 40) * 0.15);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // origem: bola de energia brilhante
      const originR = 12 + Math.sin(this.t * 40) * 3;
      const og = ctx.createRadialGradient(sx, sy, 0, sx, sy, originR);
      og.addColorStop(0, '#ffffff'); og.addColorStop(0.5, f.color); og.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = og; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, originR, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'cone') {
      const [ex, ey] = this.worldToScreen(f.x2!, f.y2!);
      const ang = Math.atan2(ey - sy, ex - sx);
      const rad = dist(sx, sy, ex, ey);
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, rad, ang - 0.5, ang + 0.5);
      ctx.closePath(); ctx.fill();
    }
    if (f.kind === 'sword') {
      // espada descendo com brilho
      const prog = 1 - life;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = f.color; ctx.globalAlpha = 0.4;
      ctx.fillRect(sx - 6, sy - 60 * prog, 12, 44);
      ctx.globalAlpha = Math.min(1, life + 0.3);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = f.color;
      ctx.fillRect(sx - 3, sy - 60 * prog, 6, 42);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(sx - 1, sy - 60 * prog, 2, 40);
      ctx.fillStyle = f.color;
      ctx.fillRect(sx - 12, sy - 30 * prog, 24, 5);
    }
    if (f.kind === 'slash') {
      // corte em arco DRAMÁTICO com múltiplas camadas + rastro
      const r = f.r ?? 16;
      const rot = f.vx ?? 0;
      // arco cresce e depois desvanece (easing)
      const arcSize = 0.4 + easeOut(1 - life) * 0.7;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      // halo externo grosso
      ctx.strokeStyle = f.color; ctx.lineWidth = 12 * life; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(0, 0, r, -arcSize, arcSize); ctx.stroke();
      // camada média
      ctx.lineWidth = 6 * life + 1; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, r, -arcSize, arcSize); ctx.stroke();
      // núcleo brilhante
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(0, 0, r, -arcSize * 0.9, arcSize * 0.9); ctx.stroke();
      // pontas afiadas do corte
      ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(arcSize) * r * 1.15, Math.sin(arcSize) * r * 1.15);
      ctx.lineTo(Math.cos(arcSize) * r * 0.85, Math.sin(arcSize) * r * 0.85);
      ctx.moveTo(Math.cos(-arcSize) * r * 1.15, Math.sin(-arcSize) * r * 1.15);
      ctx.lineTo(Math.cos(-arcSize) * r * 0.85, Math.sin(-arcSize) * r * 0.85);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    if (f.kind === 'prison') {
      ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + this.t * 2;
        ctx.strokeRect(sx + Math.cos(a) * 20 - 2, sy + Math.sin(a) * 20 - 8, 4, 16);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- EXPLOSÃO CINEMATOGRÁFICA ----------
    if (f.kind === 'explosion') {
      const baseR = f.r ?? 60;
      // núcleo cresce com easeIn e desvanece
      const coreR = baseR * (0.3 + easeOut(prog) * 1.0);
      ctx.globalCompositeOperation = 'lighter';
      // 3 camadas de brilho concêntrico
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
      grad.addColorStop(0, 'rgba(255,255,255,' + (life * 0.95) + ')');
      grad.addColorStop(0.3, `rgba(255,240,180,${life * 0.85})`);
      grad.addColorStop(0.6, f.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, coreR, 0, Math.PI * 2); ctx.fill();
      // 2 anéis de choque em expansão diferente
      ctx.strokeStyle = f.color; ctx.lineWidth = 4 * life + 1; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, baseR * (0.5 + prog), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * life;
      ctx.beginPath(); ctx.arc(sx, sy, baseR * (0.7 + prog * 0.8), 0, Math.PI * 2); ctx.stroke();
      // "chunks" de destroços voando (6 pedaços)
      ctx.globalAlpha = life * 0.9;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f.x * 0.01; // ângulo consistente por FX
        const cd = baseR * (0.4 + prog * 1.2);
        const cx = sx + Math.cos(a) * cd, cy = sy + Math.sin(a) * cd;
        ctx.fillStyle = f.color;
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'shockwave') {
      // ONDA DE CHOQUE — anel dourado expandindo com halo
      const r = (f.r ?? 80) * easeOut(prog);
      ctx.globalCompositeOperation = 'lighter';
      // halo externo
      ctx.strokeStyle = f.color; ctx.lineWidth = 12 * life + 2; ctx.globalAlpha = life * 0.35;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      // anel médio
      ctx.lineWidth = 6 * life + 1; ctx.globalAlpha = life * 0.75;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      // núcleo brilhante
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'orb') {
      // ORBE MÁGICO — pulsante com anel externo e faíscas
      const r = (f.r ?? 12) * (0.85 + Math.sin(this.t * 18) * 0.18);
      ctx.globalCompositeOperation = 'lighter';
      // halo externo grande
      const gOuter = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
      gOuter.addColorStop(0, f.color);
      gOuter.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gOuter; ctx.globalAlpha = 0.4 * life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2); ctx.fill();
      // núcleo brilhante
      const gCore = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
      gCore.addColorStop(0, '#ffffff');
      gCore.addColorStop(0.4, f.color);
      gCore.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gCore; ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2); ctx.fill();
      // núcleo interno branco
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'lightning') {
      // RAIO ELÉTRICO com bifurcações e brilho intenso
      const [ex, ey] = this.worldToScreen(f.x2!, f.y2!);
      ctx.globalCompositeOperation = 'lighter';
      const segs = 10;
      // gera pontos do raio (consistente com base em posição)
      const seed = (f.x + f.y) * 0.017;
      const rnd2 = (i: number) => Math.sin(seed + i * 12.34) * 0.5;
      const pts: [number, number][] = [[sx, sy]];
      for (let i = 1; i < segs; i++) {
        const t2 = i / segs;
        const bx = sx + (ex - sx) * t2 + rnd2(i) * 22;
        const by = sy + (ey - sy) * t2 + rnd2(i + 100) * 22;
        pts.push([bx, by]);
      }
      pts.push([ex, ey]);
      const drawBolt = (width: number, color: string, alpha: number) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha * life;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      };
      drawBolt(12, f.color, 0.3);   // halo
      drawBolt(6, f.color, 0.7);    // médio
      drawBolt(2.5, '#ffffff', 1);  // núcleo branco
      // bifurcações elétricas (2 raios menores saindo do meio)
      for (let b = 0; b < 2; b++) {
        const midIdx = Math.floor(pts.length * (0.3 + b * 0.3));
        const [mx, my] = pts[midIdx];
        const branchAng = Math.atan2(ey - sy, ex - sx) + (b === 0 ? 0.7 : -0.7);
        const bl = 20 + rnd2(b + 50) * 10;
        const bx = mx + Math.cos(branchAng) * bl, by = my + Math.sin(branchAng) * bl;
        ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.globalAlpha = life * 0.6;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = life;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'nova') {
      // NOVA — explosão radial de raios com trilhas
      const baseR = f.r ?? 50;
      const r = baseR * (0.4 + easeOut(prog) * 1.0);
      ctx.globalCompositeOperation = 'lighter';
      const spokes = 14;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2 + this.t * 0.3;
        const innerR = r * 0.25;
        const outerR = r * (0.8 + (i % 2) * 0.3);
        // gradiente do raio
        const gx = sx + Math.cos(a) * outerR, gy = sy + Math.sin(a) * outerR;
        const grad = ctx.createLinearGradient(sx, sy, gx, gy);
        grad.addColorStop(0, f.color);
        grad.addColorStop(0.7, f.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 3.5 * life + 0.5; ctx.globalAlpha = life;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * innerR, sy + Math.sin(a) * innerR);
        ctx.lineTo(gx, gy);
        ctx.stroke();
      }
      // núcleo brilhante
      const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.35);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'runes') {
      // CÍRCULO DE RUNAS mágico rotativo com brilho crescente
      const r = f.r ?? 40;
      ctx.globalCompositeOperation = 'lighter';
      const alpha = life * 0.9;
      // 3 anéis
      ctx.strokeStyle = f.color; ctx.lineWidth = 2.5; ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, r * 1.15, 0, Math.PI * 2); ctx.stroke();
      // 8 runas girando + luzes conectando
      const angBase = this.t * 1.8;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + angBase;
        const rx = sx + Math.cos(a) * r, ry = sy + Math.sin(a) * r;
        // runa
        ctx.fillStyle = f.color;
        ctx.fillRect(rx - 3, ry - 3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
        // linha conectando ao anel interno
        const ri = r * 0.72;
        ctx.strokeStyle = f.color; ctx.lineWidth = 1; ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * ri, sy + Math.sin(a) * ri);
        ctx.lineTo(rx, ry);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'heal') {
      // CURA — cruzes verdes subindo com halo pulsante
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = f.color; ctx.globalAlpha = life;
      const yo = -(1 - life) * 40;
      // halo pulsante
      const pulse = 0.6 + Math.sin(this.t * 8) * 0.15;
      const hg = ctx.createRadialGradient(sx, sy + yo, 0, sx, sy + yo, 14 * pulse);
      hg.addColorStop(0, f.color); hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg; ctx.globalAlpha = life * 0.5;
      ctx.beginPath(); ctx.arc(sx, sy + yo, 14 * pulse, 0, Math.PI * 2); ctx.fill();
      // cruz
      ctx.fillStyle = f.color; ctx.globalAlpha = life;
      ctx.fillRect(sx - 2, sy - 7 + yo, 4, 14);
      ctx.fillRect(sx - 7, sy - 2 + yo, 14, 4);
      // brilho branco no centro da cruz
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life;
      ctx.fillRect(sx - 1, sy - 4 + yo, 2, 8);
      ctx.fillRect(sx - 4, sy - 1 + yo, 8, 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- NOVOS EFEITOS DEDICADOS ----------
    // BOLA DE FOGO — projétil flamejante rotativo
    if (f.kind === 'fireball') {
      const r = f.r ?? 14;
      ctx.globalCompositeOperation = 'lighter';
      // halo pulsante
      const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4);
      hg.addColorStop(0, '#ffe080'); hg.addColorStop(0.4, f.color); hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg; ctx.globalAlpha = 0.9 * life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2); ctx.fill();
      // 3 línguas de fogo em rotação
      const rot = this.t * 6;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + rot;
        const fx1 = sx + Math.cos(a) * r * 0.9;
        const fy1 = sy + Math.sin(a) * r * 0.9;
        ctx.fillStyle = '#ffe060'; ctx.globalAlpha = life;
        ctx.beginPath(); ctx.arc(fx1, fy1, r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      // núcleo branco
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ESTILHAÇOS DE GELO — cristais explodindo
    if (f.kind === 'iceshatter') {
      const r = (f.r ?? 40) * easeOut(prog);
      ctx.globalCompositeOperation = 'lighter';
      // 8 cristais afiados voando pra fora
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const cx = sx + Math.cos(a) * r;
        const cy = sy + Math.sin(a) * r;
        const size = 6 * life + 2;
        // cristal (losango)
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = f.color; ctx.globalAlpha = life;
        ctx.beginPath();
        ctx.moveTo(size, 0); ctx.lineTo(0, size / 2); ctx.lineTo(-size, 0); ctx.lineTo(0, -size / 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life * 0.8;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0); ctx.lineTo(0, size * 0.25); ctx.lineTo(-size * 0.5, 0); ctx.lineTo(0, -size * 0.25);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // anel central de gelo
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 * life; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // NUVEM DE VENENO — puffs verdes subindo
    if (f.kind === 'poisoncloud') {
      const r = f.r ?? 40;
      ctx.globalCompositeOperation = 'lighter';
      // 5 puffs sobrepostos
      for (let i = 0; i < 5; i++) {
        const off = i * 0.5;
        const px = sx + Math.sin(this.t * 2 + i) * 8 - 12 + i * 6;
        const py = sy + Math.cos(this.t * 1.5 + i) * 6 - prog * 20 - i * 3;
        const pr = r * (0.4 + i * 0.08);
        const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.globalAlpha = life * (0.6 - off * 0.08);
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // CORTE SANGRENTO — respingos vermelhos brutais
    if (f.kind === 'bloodslash') {
      const r = f.r ?? 20;
      const rot = f.vx ?? 0;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
      // corte principal (branco → vermelho)
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff3040'; ctx.lineWidth = 8 * life; ctx.globalAlpha = life * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * life + 0.5; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(0, 0, r, -1.0, 1.0); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = 'source-over';
      // gotas de sangue voando
      ctx.fillStyle = '#c02040'; ctx.globalAlpha = life * 0.9;
      for (let i = 0; i < 6; i++) {
        const a = -1 + (i / 5) * 2;
        const dr = r * (0.9 + prog * 0.7);
        const dx = Math.cos(a) * dr, dy = Math.sin(a) * dr;
        ctx.beginPath(); ctx.arc(dx, dy, 2.5 * life + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // PULSO DE CURA — círculo verde crescendo com cruzes
    if (f.kind === 'healpulse') {
      const baseR = f.r ?? 60;
      const r = baseR * easeOut(prog);
      ctx.globalCompositeOperation = 'lighter';
      // anel principal
      const g = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, f.color);
      g.addColorStop(1, 'rgba(255,255,255,' + life * 0.5 + ')');
      ctx.fillStyle = g; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      // cruzes subindo em volta
      ctx.fillStyle = f.color; ctx.globalAlpha = life;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cx = sx + Math.cos(a) * r * 0.8;
        const cy = sy + Math.sin(a) * r * 0.8 - easeIn(prog) * 15;
        ctx.fillRect(cx - 1.5, cy - 4, 3, 8);
        ctx.fillRect(cx - 4, cy - 1.5, 8, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ONDA DE TERRA — linhas rochosas irrompendo
    if (f.kind === 'earthspike') {
      const r = (f.r ?? 40) * easeOut(prog);
      const rot = f.vx ?? 0;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
      ctx.globalCompositeOperation = 'lighter';
      // 3 espinhos rochosos em linha
      for (let i = 0; i < 3; i++) {
        const px = i * r / 3;
        const py = -8 * life;
        ctx.fillStyle = f.color; ctx.globalAlpha = life;
        // triângulo
        ctx.beginPath();
        ctx.moveTo(px, py - 12 * life);
        ctx.lineTo(px - 6, py + 4);
        ctx.lineTo(px + 6, py + 4);
        ctx.closePath(); ctx.fill();
        // brilho no topo
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life * 0.6;
        ctx.beginPath();
        ctx.moveTo(px, py - 12 * life);
        ctx.lineTo(px - 2, py - 4);
        ctx.lineTo(px + 2, py - 4);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    // TENTÁCULOS DO VAZIO — linhas curvas roxas emergindo
    if (f.kind === 'voidtentacle') {
      const r = f.r ?? 40;
      ctx.globalCompositeOperation = 'lighter';
      const numT = 5;
      for (let i = 0; i < numT; i++) {
        const baseA = (i / numT) * Math.PI * 2;
        const len = r * easeOut(prog);
        ctx.strokeStyle = f.color; ctx.lineWidth = 5 * life + 1; ctx.globalAlpha = life * 0.7;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        // curva ondulada
        for (let j = 1; j <= 6; j++) {
          const t2 = j / 6;
          const wave = Math.sin(t2 * Math.PI * 2 + this.t * 4) * 6 * t2;
          const tx = sx + Math.cos(baseA) * len * t2 - Math.sin(baseA) * wave;
          const ty = sy + Math.sin(baseA) * len * t2 + Math.cos(baseA) * wave;
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
      // núcleo escuro
      const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.4);
      cg.addColorStop(0, '#000000'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // PENA DIVINA — luz caindo do céu (santo)
    if (f.kind === 'holypillar') {
      const r = f.r ?? 30;
      ctx.globalCompositeOperation = 'lighter';
      // pilar de luz vertical
      const g = ctx.createLinearGradient(sx, sy - 120, sx, sy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.4, f.color);
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g; ctx.globalAlpha = life * 0.85;
      ctx.fillRect(sx - r * 0.5, sy - 120, r, 120);
      // núcleo brilhante estreito
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life;
      ctx.fillRect(sx - 3, sy - 120, 6, 120);
      // anel dourado no chão
      ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      // faíscas caindo
      for (let i = 0; i < 6; i++) {
        const py = sy - 20 - (this.t * 60 + i * 20) % 100;
        const px2 = sx + Math.sin(this.t * 3 + i) * 8;
        ctx.fillStyle = f.color; ctx.globalAlpha = life;
        ctx.fillRect(px2 - 1, py, 2, 4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- ALMA SUBINDO (morte de herói) ----------
    if (f.kind === 'soulRise') {
      const progress = 1 - life; // 0→1: sobe
      const soulY = sy - progress * 80;
      ctx.globalCompositeOperation = 'lighter';
      // aura da alma
      const g = ctx.createRadialGradient(sx, soulY, 0, sx, soulY, 16 * life);
      g.addColorStop(0, 'rgba(255,255,255,' + (life * 0.7) + ')');
      g.addColorStop(0.5, f.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, soulY, 16 * life, 0, Math.PI * 2); ctx.fill();
      // corpo da alma (silhueta simplificada)
      ctx.globalAlpha = life * 0.6;
      ctx.fillStyle = f.color;
      ctx.fillRect(sx - 4, soulY - 8, 8, 10); // torso
      ctx.fillRect(sx - 3, soulY - 12, 6, 5);  // cabeça
      ctx.fillRect(sx - 5, soulY - 3, 2, 5);   // braço esq
      ctx.fillRect(sx + 3, soulY - 3, 2, 5);   // braço dir
      // rastro de partículas
      for (let i = 0; i < 4; i++) {
        const py = soulY + 10 + i * 6;
        const pa = life * (0.6 - i * 0.12);
        ctx.globalAlpha = pa;
        ctx.fillRect(sx + Math.sin(this.t * 5 + i * 2) * 6 - 1.5, py, 3, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- FEIXE DE LUZ DO RESPAWN ----------
    if (f.kind === 'respawnBeam') {
      const progress = 1 - life;
      const beamW = 30 + (1 - progress) * 20; // começa largo, afina
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = life * 0.7;
      // feixe principal
      const g = ctx.createLinearGradient(sx, sy - 100, sx, sy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, f.color);
      g.addColorStop(1, 'rgba(255,255,255,' + (life * 0.8) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(sx - beamW / 2, sy - 120, beamW, 120);
      // anel no chão
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 * life;
      ctx.beginPath(); ctx.ellipse(sx, sy, beamW * 0.7, beamW * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- EFEITOS PREMIUM DE ULTIMATE ----------
    if (f.kind === 'ultimateBurst') {
      // explosão cinematográfica: núcleo + anéis concêntricos + partículas orbitando
      const r = (f.r ?? 80);
      const prog = 1 - life; // 0→1
      ctx.globalCompositeOperation = 'lighter';
      // núcleo brilhante pulsante
      const coreR = r * (0.4 + prog * 0.3) * (0.9 + Math.sin(this.t * 30) * 0.1);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
      g.addColorStop(0, 'rgba(255,255,255,' + (life * 0.95) + ')');
      g.addColorStop(0.5, f.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = Math.min(1, life + 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, coreR, 0, Math.PI * 2); ctx.fill();
      // anéis concêntricos em expansão
      for (let i = 0; i < 3; i++) {
        const ringR = r * (0.5 + prog * 0.9 + i * 0.2);
        ctx.strokeStyle = f.color; ctx.lineWidth = (4 - i) * life; ctx.globalAlpha = life * (0.7 - i * 0.2);
        ctx.beginPath(); ctx.arc(sx, sy, ringR, 0, Math.PI * 2); ctx.stroke();
      }
      // partículas orbitando
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.t * 6;
        const pr = r * (0.6 + prog * 0.5);
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = life;
        ctx.fillRect(sx + Math.cos(a) * pr - 2, sy + Math.sin(a) * pr - 2, 4, 4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'vortex') {
      // espiral giratória sugando
      const r = (f.r ?? 70);
      const spins = 3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 * life + 1; ctx.globalAlpha = life * 0.85;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const tt = i / 40;
        const a = tt * Math.PI * 2 * spins + this.t * 4;
        const rr = r * (1 - tt);
        const px2 = sx + Math.cos(a) * rr, py2 = sy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.stroke();
      // núcleo escuro sugando
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.4);
      g.addColorStop(0, 'rgba(0,0,0,' + (life * 0.7) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'ringBurst') {
      // anel sólido expandindo com brilho (knockup/onda mágica)
      const r = (f.r ?? 100) * (1 - life);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.8, f.color);
      g.addColorStop(1, 'rgba(255,255,255,' + life * 0.6 + ')');
      ctx.fillStyle = g; ctx.globalAlpha = life;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * life + 1;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.kind === 'starBurst') {
      // estrela/faíscas radiais para skills mágicas potentes
      const r = (f.r ?? 60) * (1.2 - life * 0.5);
      ctx.globalCompositeOperation = 'lighter';
      const spikes = 8;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + this.t * 0.5;
        const len = r * (0.5 + (i % 2) * 0.5);
        const grd = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        grd.addColorStop(0, f.color);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = (3 - i % 2) * life + 1;
        ctx.globalAlpha = life;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  renderMinimap() {
    if (!this.mctx || !this.mini || !this.ground) return;
    const c = this.mctx, size = this.mini.width;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.ground, 0, 0, size, size);
    const k = size / WORLD;
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.kind === 'tower' || u.kind === 'inhib' || u.kind === 'nexus') {
        c.fillStyle = u.team === 0 ? '#50b0ff' : '#ff6060';
        const s = u.kind === 'nexus' ? 7 : u.kind === 'inhib' ? 5 : 4;
        c.fillRect(u.x * k - s / 2, u.y * k - s / 2, s, s);
      }
    }
    for (const u of this.units) {
      if (u.dead || u.kind === 'tower' || u.kind === 'inhib' || u.kind === 'nexus') continue;
      if (this.hasBuff(u, 'invis') && u.team !== this.player.team) continue;
      if (u.kind === 'hero') {
        c.fillStyle = u === this.player ? '#60ff90' : u.team === this.player.team ? '#50b0ff' : '#ff5050';
        c.beginPath(); c.arc(u.x * k, u.y * k, 4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
        // anel pulsante do jogador
        if (u === this.player) {
          const pr = 6 + Math.sin(this.t * 4) * 2;
          c.strokeStyle = 'rgba(96,255,144,0.85)';
          c.lineWidth = 1.5;
          c.beginPath(); c.arc(u.x * k, u.y * k, pr, 0, Math.PI * 2); c.stroke();
        }
      } else if (u.kind === 'minion') {
        c.fillStyle = u.team === 0 ? 'rgba(80,176,255,0.7)' : 'rgba(255,96,96,0.7)';
        c.fillRect(u.x * k - 1, u.y * k - 1, 2, 2);
      } else {
        // monstros da selva: épicos diferenciados no minimapa
        const ct = u.campType!;
        if (ct === 'dragon') { c.fillStyle = '#ff6040'; c.fillRect(u.x * k - 3, u.y * k - 3, 6, 6); }
        else if (ct === 'baron') { c.fillStyle = '#c080ff'; c.fillRect(u.x * k - 3, u.y * k - 3, 6, 6); }
        else if (ct === 'riftherald') { c.fillStyle = '#a060ff'; c.fillRect(u.x * k - 3, u.y * k - 3, 6, 6); }
        else if (ct === 'wyvern') { c.fillStyle = '#ffa040'; c.fillRect(u.x * k - 2.5, u.y * k - 2.5, 5, 5); }
        else if (ct === 'crab') { c.fillStyle = '#80d0a0'; c.fillRect(u.x * k - 2, u.y * k - 2, 4, 4); }
        else { c.fillStyle = '#d0b060'; c.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3); }
      }
    }
    if (this.hawkPing) {
      c.strokeStyle = '#a0e0ff'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.hawkPing.x * k, this.hawkPing.y * k, 10 + Math.sin(this.t * 6) * 3, 0, Math.PI * 2); c.stroke();
    }
    // timers de respawn dos épicos no minimapa (círculo tracejado + número s)
    c.font = 'bold 6px monospace';
    c.textAlign = 'center';
    if (this.dragonNextRespawn > this.t) {
      const rem = Math.ceil(this.dragonNextRespawn - this.t);
      c.strokeStyle = 'rgba(255,96,64,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(DRAGON_PIT[0] * k, DRAGON_PIT[1] * k, 8, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ff6040'; c.fillText(`${rem}`, DRAGON_PIT[0] * k, DRAGON_PIT[1] * k + 2);
    }
    if (this.baronNextRespawn > this.t) {
      const rem = Math.ceil(this.baronNextRespawn - this.t);
      c.strokeStyle = 'rgba(192,128,255,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(BARON_PIT[0] * k, BARON_PIT[1] * k, 8, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#c080ff'; c.fillText(`${rem}`, BARON_PIT[0] * k, BARON_PIT[1] * k + 2);
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
    c.strokeRect((this.camX - this.canvas.width / 2) * k, (this.camY - this.canvas.height / 2) * k, this.canvas.width * k, this.canvas.height * k);
  }

  // ---------- snapshot p/ HUD ----------
  snapshot(): Snapshot {
    const u = this.player;
    const blueK = this.heroes.filter(h => h.team === 0).reduce((s, h) => s + h.kills, 0);
    const redK = this.heroes.filter(h => h.team === 1).reduce((s, h) => s + h.kills, 0);
    const myTeam = u.team as Team, enemyTeam = (u.team === 0 ? 1 : 0) as Team;
    const goldOf = (team: Team) => Math.floor(this.heroes.filter(h => h.team === team).reduce((s, h) => s + h.gold, 0));
    const buffs = u.buffs
      .filter(b => BUFF_META[b.key])
      .slice(0, 8)
      .map(b => ({ key: b.key, label: BUFF_META[b.key].label, color: BUFF_META[b.key].color, stacks: b.stacks ?? 1 }));
    const t2 = u.attackTgt;
    return {
      hp: Math.max(0, Math.round(u.hp)), maxHp: Math.round(u.maxHp), mp: Math.round(u.mp), maxMp: Math.round(u.maxMp),
      level: u.level, xp: Math.round(u.xp), xpNext: this.xpNext(u.level),
      gold: Math.floor(u.gold), cs: u.cs, k: u.kills, d: u.deaths, a: u.assists, time: this.t, waveIn: Math.max(0, this.waveT),
      cds: (['Q', 'W', 'E', 'R'] as AbilitySlot[]).map(s => {
        const lv = u.skillLv[s];
        const maxLv = s === 'R' ? 3 : 5;
        const reqLv = s === 'R' ? (lv === 0 ? 6 : lv === 1 ? 11 : lv === 2 ? 16 : 99) : lv + 1;
        return {
          slot: s, rem: u.cds[s], total: u.def!.abilities[s].cd, mana: u.def!.abilities[s].mana,
          ok: this.abilityReady(u, s).ok, lv, canUp: u.skillPoints > 0 && lv < maxLv && u.level >= reqLv,
        };
      }),
      items: [...u.items], dead: u.dead, respawnIn: Math.max(0, u.respawnT - this.t),
      canShop: !u.dead && dist(u.x, u.y, FOUNTAINS[u.team as Team][0], FOUNTAINS[u.team as Team][1]) < 360,
      passiveNote: u.def!.passive.name, result: this.result, activeCd: u.activeCd, hasZhonya: u.items.includes('zhonya'),
      feed: [...this.feed], recalling: u.recallT > 0,
      board: this.heroes.map(h => ({ name: h.name, hero: h.def!.id, team: h.team as Team, k: h.kills, d: h.deaths, a: h.assists, cs: h.cs, level: h.level, bounty: h.bounty, isJg: h.isJungler })),
      teamKills: [blueK, redK],
      towersLeft: [this.units.filter(x => x.kind === 'tower' && x.team === 0).length, this.units.filter(x => x.kind === 'tower' && x.team === 1).length],
      goldDiff: goldOf(myTeam) - goldOf(enemyTeam),
      banner: this.banner ? { text: this.banner.text, sub: this.banner.sub, color: this.banner.color, id: this.banner.id } : null,
      buffs,
      target: t2 && !t2.dead && t2.kind === 'hero' && t2.team !== u.team ? { name: t2.name, hp: Math.max(0, Math.round(t2.hp)), maxHp: Math.round(t2.maxHp), level: t2.level } : null,
      skillPoints: u.skillPoints,
      summoners: this.summonerSlots.map(s => ({ id: s.id, cd: s.cd, cdMax: s.cdMax, icon: SUMMONERS[s.id].icon, name: SUMMONERS[s.id].name })),
      activeItems: this.activeSlots.map(a => ({ idx: a.slot, name: a.key, cd: a.cd, cdMax: a.cdMax, icon: ITEM_BY_ID[u.items[a.slot]]?.icon.glyph ?? '?' })),
      lastHitBonus: Math.round(22 * 0.5),
      totalGold: Math.floor(this.heroes.filter(h => h.team === u.team).reduce((s, h) => s + h.gold, 0)),
      shutdown: (u.attackTgt?.killsStreak ?? 0) >= 3,
      aimingSkill: this.aimingSkill,
      chat: [...this.chatLog],
      pings: [...this.pings],
      stats: {
        ad: Math.round(u.ad), ap: Math.round(u.ap),
        armor: Math.round(u.armor), mr: Math.round(u.mr),
        ms: Math.round(this.speedOf(u)), aspd: Number(this.aspdOf(u).toFixed(2))
      },
      runes: [this.runePage.keystone, this.runePage.secondary, this.runePage.minor]
        .map(id => RUNE_BY_ID[id])
        .filter(Boolean)
        .map(r => ({ id: r.id, name: r.name, desc: r.desc, color: r.color, slot: r.slot })),
      runeStacks: (() => {
        const out: { key: string; label: string; color: string; stacks: number }[] = [];
        const fury = this.getBuff(u, 'conquerorStacks');
        if (fury) out.push({ key: 'conqueror', label: '⚔ Fúria', color: '#e07040', stacks: fury.stacks ?? 0 });
        if (this.hasBuff(u, 'aftershock')) out.push({ key: 'aftershock', label: '🛡 Pós-Choque', color: '#ffc040', stacks: 1 });
        if (this.hasRune('electrocute') && this.t < u.electrocuteCd) {
          out.push({ key: 'electrocute', label: '⚡ Recarga', color: '#7050a0', stacks: Math.ceil(u.electrocuteCd - this.t) });
        }
        return out;
      })(),
      event: this.activeEvent ? {
        kind: this.activeEvent.kind,
        name: this.activeEvent.def.name,
        desc: this.activeEvent.def.desc,
        icon: this.activeEvent.def.icon,
        color: this.activeEvent.def.color,
        remaining: Math.max(0, this.activeEvent.endsAt - this.t),
        total: this.activeEvent.def.duration,
      } : null,
      nextEventIn: this.activeEvent ? 0 : Math.max(0, this.nextEventAt - this.t),
      // ===== DOTA BUYBACK =====
      buybackCost: 150 + u.level * 35,
      buybackCd: Math.max(0, u.buybackCd - this.t),
      canBuyback: u.dead && this.t >= u.buybackCd && u.gold >= (150 + u.level * 35),
    };
  }
}

// ============ VFX TEMÁTICO POR HABILIDADE ============
// c = cor principal | s = estilo de conjuração
type VfxStyle = 'fire' | 'ice' | 'shadow' | 'holy' | 'blade' | 'shock' | 'nature' | 'buff' | 'burst';
const ABILITY_VFX: Record<string, { c: string; s: VfxStyle }> = {
  // Gareth
  decisive: { c: '#ffe080', s: 'blade' }, courage: { c: '#e8c860', s: 'buff' },
  judgment: { c: '#d0e0f0', s: 'blade' }, demacian: { c: '#ffe860', s: 'holy' },
  // Anya (fogo)
  disintegrate: { c: '#ff8040', s: 'fire' }, incinerate: { c: '#ff7030', s: 'fire' },
  moltenshield: { c: '#ff9060', s: 'buff' }, tibbers: { c: '#ff6020', s: 'fire' },
  // Ashka (gelo)
  rangerfocus: { c: '#a0e0ff', s: 'buff' }, volley: { c: '#bfe8ff', s: 'ice' },
  hawkshot: { c: '#a0e0ff', s: 'nature' }, crystalarrow: { c: '#80e0ff', s: 'ice' },
  // Yamir (lâmina)
  alphastrike: { c: '#c0f0ff', s: 'blade' }, meditate: { c: '#90d090', s: 'buff' },
  wuju: { c: '#b8e0d0', s: 'buff' }, highlander: { c: '#f0d060', s: 'buff' },
  // Rizar (arcano)
  overload: { c: '#80a0ff', s: 'shock' }, runeprison: { c: '#8060ff', s: 'shadow' },
  spellflux: { c: '#b090ff', s: 'shock' }, desperatepower: { c: '#b090ff', s: 'buff' },
  // Timo (natureza/veneno)
  blindingdart: { c: '#c0ff60', s: 'nature' }, movequick: { c: '#a0e050', s: 'buff' },
  toxicshot: { c: '#a0e050', s: 'buff' }, shroom: { c: '#a0e050', s: 'nature' },
  // Luxana (luz)
  lightbinding: { c: '#ffe880', s: 'holy' }, prismatic: { c: '#ffe8a0', s: 'buff' },
  lucent: { c: '#ffe880', s: 'holy' }, finalspark: { c: '#fff0a0', s: 'holy' },
  // Darion (sangue)
  decimate: { c: '#ff6050', s: 'blade' }, cripplingstrike: { c: '#ff8070', s: 'buff' },
  apprehend: { c: '#c04040', s: 'blade' }, guillotine: { c: '#ff4040', s: 'blade' },
  // Katya (adagas)
  bouncingblade: { c: '#e0e8f0', s: 'blade' }, sinistersteel: { c: '#d0d8e0', s: 'blade' },
  shunpo: { c: '#c05060', s: 'shadow' }, deathlotus: { c: '#e0e8f0', s: 'blade' },
  // Blitz (elétrico)
  rocketgrab: { c: '#ffd040', s: 'shock' }, overdrive: { c: '#80d0ff', s: 'buff' },
  powerfist: { c: '#ffd040', s: 'shock' }, staticfield: { c: '#60c0ff', s: 'shock' },
  // Warrik (bestial)
  hungeringstrike: { c: '#a0e060', s: 'nature' }, bloodscent: { c: '#ff8060', s: 'buff' },
  terrorhowl: { c: '#a080d0', s: 'shadow' }, infiniteduress: { c: '#a0e060', s: 'shadow' },
  // Morgause (sombrio)
  darkbinding: { c: '#a060e0', s: 'shadow' }, tormentedsoil: { c: '#8c3ac8', s: 'shadow' },
  blackshield: { c: '#6060a0', s: 'buff' }, soulshackles: { c: '#c080ff', s: 'shadow' },
  // Heróis extras
  mysticshot: { c: '#ffd870', s: 'shock' }, essenceflux: { c: '#c090ff', s: 'shock' },
  arcaneshift: { c: '#a0d0ff', s: 'shadow' }, trueshot: { c: '#ffe080', s: 'holy' },
  sonicwave: { c: '#c0e0ff', s: 'shock' }, safeguard: { c: '#a0d0a0', s: 'buff' },
  tempest: { c: '#d0c0a0', s: 'shock' }, dragonsfury: { c: '#ff8040', s: 'fire' },
  deathsentence: { c: '#60ff80', s: 'shadow' }, darkpassage: { c: '#60ff80', s: 'buff' },
  flay: { c: '#60ff80', s: 'shadow' }, box: { c: '#60ff80', s: 'shadow' },
  tumble: { c: '#c0a0ff', s: 'buff' }, silverbolts: { c: '#e0d0ff', s: 'buff' },
  condemn: { c: '#c0a0ff', s: 'shock' }, finalhour: { c: '#c0a0ff', s: 'buff' },
  deadlyspines: { c: '#60e080', s: 'nature' }, rampantgrowth: { c: '#60e080', s: 'nature' },
  graspingroots: { c: '#60e080', s: 'nature' }, thrust: { c: '#e860a0', s: 'nature' },
  dredgeline: { c: '#60a0c0', s: 'shock' }, titanwraith: { c: '#60e0ff', s: 'buff' },
  riptide: { c: '#60c0e0', s: 'shock' }, depthcharge: { c: '#60e0ff', s: 'shock' },
  lunge: { c: '#e8d880', s: 'blade' }, riposte: { c: '#e8c860', s: 'buff' },
  bladework: { c: '#e8d880', s: 'buff' }, grandchallenge: { c: '#e8c860', s: 'holy' },
  claws: { c: '#a060ff', s: 'blade' }, spikes: { c: '#a060ff', s: 'shadow' },
  leap: { c: '#a060ff', s: 'shadow' }, voidassault: { c: '#a060ff', s: 'shadow' },
  steeltempest: { c: '#c0f0ff', s: 'blade' }, windwall: { c: '#c0f0ff', s: 'buff' },
  sweepingblade: { c: '#c0f0ff', s: 'blade' }, lastbreath: { c: '#c0f0ff', s: 'blade' },
  brokenwings: { c: '#60e0ff', s: 'blade' }, kiaburst: { c: '#60e0ff', s: 'shock' },
  valor: { c: '#60e0ff', s: 'buff' }, exile: { c: '#60e0ff', s: 'holy' },
  crescendo: { c: '#e8c040', s: 'holy' }, voidcall: { c: '#8040c0', s: 'shadow' },
  nethergrasp: { c: '#8040c0', s: 'shadow' }, glacialtremor: { c: '#80c8e8', s: 'ice' },
  superrocket: { c: '#e04040', s: 'fire' }, razorshuriken: { c: '#c04040', s: 'blade' },
  javelin: { c: '#e8c860', s: 'blade' },
  // ===== 25 HERÓIS ORIGINAIS (VFX temático) =====
  // Volcarn (magma/terra)
  magmadash: { c: '#ff7030', s: 'fire' }, stonehide: { c: '#e0a060', s: 'buff' },
  embercone: { c: '#ff8030', s: 'fire' }, volcanoerupt: { c: '#ff6020', s: 'fire' },
  // Aethel (vento)
  hurlspear: { c: '#a0e8ff', s: 'blade' }, gust: { c: '#c0f0ff', s: 'shock' },
  tornado: { c: '#bfe8ff', s: 'shock' }, skytempest: { c: '#80e0ff', s: 'ice' },
  // Cogsworth (mecânico)
  bouncycog: { c: '#ffd070', s: 'shock' }, overclock: { c: '#80d0ff', s: 'buff' },
  slowfield: { c: '#80e0c0', s: 'ice' }, timestop: { c: '#c0c0e0', s: 'shadow' },
  // Myrmidon (enxame)
  bugcloud: { c: '#a0c050', s: 'nature' }, chitinshield: { c: '#90b040', s: 'buff' },
  pheromone: { c: '#c8e060', s: 'nature' }, devourswarm: { c: '#90a040', s: 'nature' },
  // Noctara (sonhos)
  shadowpounce: { c: '#a060ff', s: 'shadow' }, sleepmist: { c: '#c090ff', s: 'shadow' },
  nightmare: { c: '#b060e0', s: 'shadow' }, nightmarch: { c: '#a050d0', s: 'shadow' },
  // Kragmar (abismo/crabe)
  crabclaw: { c: '#70c0d0', s: 'blade' }, shellfortress: { c: '#90d0e0', s: 'buff' },
  waterjet: { c: '#60d0ff', s: 'shock' }, krakengrip: { c: '#50c0e0', s: 'ice' },
  // Solanis (sol)
  dawnpierce: { c: '#ffe080', s: 'holy' }, radiantaura: { c: '#fff0a0', s: 'buff' },
  lightward: { c: '#ffe8a0', s: 'holy' }, sunrevival: { c: '#ffe080', s: 'holy' },
  // Umbrath (marionetes)
  puppetpull: { c: '#a090c0', s: 'shadow' }, shadowdance: { c: '#8070a0', s: 'shadow' },
  cursefield: { c: '#8a7ac0', s: 'shadow' }, puppetshow: { c: '#9a8ad0', s: 'shadow' },
  // Thornveil (selva)
  thornwhip: { c: '#80c050', s: 'nature' }, roottrap: { c: '#70a040', s: 'nature' },
  seedbomb: { c: '#90c060', s: 'nature' }, forestwrath: { c: '#70b040', s: 'nature' },
  // Glimmerfin (abissal/luz)
  biobeam: { c: '#60e0ff', s: 'shock' }, inkcloud: { c: '#4070a0', s: 'shadow' },
  eshock: { c: '#c0e0ff', s: 'shock' }, abyssvortex: { c: '#50c0ff', s: 'shock' },
  // Ironpeak (montanha)
  seismicfist: { c: '#c8b090', s: 'blade' }, stonewall: { c: '#b0a080', s: 'buff' },
  boulder: { c: '#c0a888', s: 'blade' }, mountainslam: { c: '#d0b888', s: 'buff' },
  // Vesper (eco/som)
  sharpnote: { c: '#e080e0', s: 'shock' }, healsong: { c: '#e0a0e0', s: 'holy' },
  crescendo_spd: { c: '#e090e0', s: 'buff' }, finalsymphony: { c: '#e080d0', s: 'holy' },
  // Cinderfox (fogo)
  fireorb: { c: '#ff7030', s: 'fire' }, flamestep: { c: '#ff9040', s: 'fire' },
  fietail: { c: '#ff8030', s: 'fire' }, foxspirit: { c: '#ff8040', s: 'fire' },
  // Galen (veneno/cura)
  toxinflask: { c: '#80c040', s: 'nature' }, serum: { c: '#90e090', s: 'holy' },
  plaguecloud: { c: '#70b040', s: 'nature' }, miraclecure: { c: '#a0f0a0', s: 'holy' },
  // Riftborn (cósmico)
  blackhole: { c: '#b080ff', s: 'shadow' }, spacefold: { c: '#a0e0ff', s: 'shadow' },
  supernova: { c: '#ffd080', s: 'shock' }, realitycollapse: { c: '#a070ff', s: 'shadow' },
  // Boulderback (tartaruga)
  shellroll: { c: '#a0b060', s: 'blade' }, turtletuck: { c: '#90a050', s: 'buff' },
  turtlequake: { c: '#b0c070', s: 'shock' }, eternalbastion: { c: '#a0b060', s: 'buff' },
  // Shrike (ave)
  aerialstrike: { c: '#d0c0a0', s: 'blade' }, wingcut: { c: '#c0b090', s: 'blade' },
  featherblades: { c: '#e0d0c0', s: 'blade' }, clawstorm: { c: '#d0c0a0', s: 'blade' },
  // Mossheart (treant)
  trunkfist: { c: '#8a7a4a', s: 'blade' }, barkskin: { c: '#7a6a3a', s: 'buff' },
  healingspores: { c: '#a0c060', s: 'nature' }, forestawaken: { c: '#709040', s: 'nature' },
  // Vexfire (diabinho)
  sulfurdart: { c: '#ff8040', s: 'fire' }, devilleap: { c: '#ff9040', s: 'fire' },
  minieruption: { c: '#ff7030', s: 'fire' }, demonfury: { c: '#ff8040', s: 'fire' },
  // Tideweaver (água)
  waterblade: { c: '#60c0e0', s: 'ice' }, healwave: { c: '#80e0c0', s: 'holy' },
  waterprison: { c: '#50c0d0', s: 'ice' }, tsunami: { c: '#50e0ff', s: 'ice' },
  // Grimfang (lobisomem)
  wildbite: { c: '#e0a0a0', s: 'blade' }, warhowl: { c: '#c09090', s: 'buff' },
  rendingclaw: { c: '#d08080', s: 'blade' }, wolfshape: { c: '#d0b0b0', s: 'buff' },
  // Starcaller (estrelas)
  fallingstar: { c: '#ffe080', s: 'holy' }, stardust: { c: '#c0b0f0', s: 'holy' },
  comet: { c: '#ffd870', s: 'shock' }, meteorshower: { c: '#ffc040', s: 'fire' },
  // Rustjaw (sucata)
  scrapshot: { c: '#c0a070', s: 'blade' }, turret: { c: '#d0b080', s: 'shock' },
  rustgrenade: { c: '#c08040', s: 'fire' }, megamecha: { c: '#b08040', s: 'buff' },
  // Frostbite (abismo de gelo)
  frosthit: { c: '#a0d0e0', s: 'ice' }, iceskin: { c: '#90c0d0', s: 'buff' },
  frosthbreath: { c: '#c0e8ff', s: 'ice' }, yetivalanche: { c: '#b0d0e0', s: 'ice' },
  // Lumen (cristal)
  prismbeam: { c: '#ffe8a0', s: 'holy' }, crystalward: { c: '#e0d0a0', s: 'buff' },
  lightfragments: { c: '#f0e0c0', s: 'holy' }, lightsanctuary: { c: '#ffe8c0', s: 'holy' },
};

const BOT_BUILDS: Record<string, string[]> = {
  default: ['boots', 'ruby', 'pickaxe', 'frozenmallet', 'warmog', 'thornmail'],
  gareth: ['boots', 'ruby', 'sunfire', 'ninjatabi', 'warmog', 'thornmail'],
  anya: ['boots', 'amptome', 'blastingwand', 'sorcshoes', 'deathcap', 'voidstaff'],
  ashka: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  yamir: ['boots', 'dagger', 'berserker', 'vampscepter', 'bloodthirster', 'infinityedge'],
  rizar: ['boots', 'sapphire', 'sorcshoes', 'blastingwand', 'banshee', 'deathcap'],
  timo: ['boots', 'amptome', 'berserker', 'blastingwand', 'deathcap', 'frozenmallet'],
  luxana: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  darion: ['boots', 'ruby', 'ninjatabi', 'frozenmallet', 'sunfire', 'warmog'],
  katya: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'zhonya'],
  blitz: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  warrik: ['boots', 'vampscepter', 'ninjatabi', 'frozenmallet', 'bloodthirster', 'warmog'],
  morgause: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'zhonya', 'deathcap'],
  jaina: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  thresk: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  jinxara: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  yasuke: ['boots', 'dagger', 'berserker', 'vampscepter', 'bloodthirster', 'infinityedge'],
  zedric: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'youmuus'],
  sonara: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'zhonya'],
  malzahar: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  nidalee: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  akali: ['boots', 'dagger', 'berserker', 'vampscepter', 'bloodthirster', 'infinityedge'],
  braum: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  // 25 heróis originais
  volcarn: ['boots', 'ruby', 'sunfire', 'ninjatabi', 'warmog', 'blackcleaver'],
  aethel: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  cogsworth: ['boots', 'ruby', 'sunfire', 'thornmail', 'warmog', 'spiritvisage'],
  myrmidon: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  noctara: ['boots', 'dagger', 'berserker', 'vampscepter', 'bloodthirster', 'youmuus'],
  kragmar: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  solanis: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'spiritvisage'],
  umbrath: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'zhonya'],
  thornveil: ['boots', 'ruby', 'sunfire', 'frozenmallet', 'warmog', 'thornmail'],
  glimmerfin: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  ironpeak: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  vesper: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'spiritvisage'],
  cinderfox: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  galen: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'spiritvisage'],
  riftborn: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  boulderback: ['boots', 'ruby', 'ninjatabi', 'sunfire', 'thornmail', 'warmog'],
  shrike: ['boots', 'dagger', 'berserker', 'vampscepter', 'bloodthirster', 'youmuus'],
  mossheart: ['boots', 'ruby', 'sunfire', 'thornmail', 'warmog', 'spiritvisage'],
  vexfire: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  tideweaver: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  grimfang: ['boots', 'vampscepter', 'berserker', 'frozenmallet', 'bloodthirster', 'warmog'],
  starcaller: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'voidstaff'],
  rustjaw: ['boots', 'dagger', 'berserker', 'pickaxe', 'infinityedge', 'phantomdancer'],
  frostbite: ['boots', 'ruby', 'sunfire', 'frozenmallet', 'thornmail', 'warmog'],
  lumen: ['boots', 'amptome', 'sorcshoes', 'blastingwand', 'deathcap', 'spiritvisage'],
};
