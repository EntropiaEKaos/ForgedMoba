import type { CoreMovementCommand, EntityId, PlayerId } from '../shared/protocol.ts';
import { normalizeSeed, rollPermille } from './rng.ts';
import { buildSpatialHash, querySpatialHash, type SpatialHash } from './spatialHash.ts';
import {
  WAVE_INTERVAL_TICKS,
  type CreateSimulationOptions,
  type SimEntity,
  type SimTeam,
  type SimulationState,
  type SimVec,
} from './types.ts';

const DEFAULT_WIDTH = 3000;
const DEFAULT_HEIGHT = 3000;
const LANE_Y_RATIO = 0.5;
const HERO_HP = 650;
const HERO_ATTACK_DAMAGE = 64;
const HERO_ATTACK_RANGE = 72;
const HERO_ATTACK_COOLDOWN_TICKS = 24;
const HERO_MOVE_SPEED_PER_TICK = 4;
const HERO_CRIT_CHANCE_PERMILLE = 100;
const HERO_RESPAWN_TICKS = 150;
const HERO_KILL_GOLD = 300;
const HERO_KILL_XP = 120;
const TOWER_HP = 1800;
const TOWER_ATTACK_DAMAGE = 95;
const TOWER_ATTACK_RANGE = 320;
const TOWER_ATTACK_COOLDOWN_TICKS = 30;
const TOWER_AGGRO_RANGE = 340;
const TOWER_GOLD = 500;
const MINION_HP = 220;
const MINION_ATTACK_DAMAGE = 22;
const MINION_ATTACK_RANGE = 55;
const MINION_ATTACK_COOLDOWN_TICKS = 30;
const MINION_MOVE_SPEED_PER_TICK = 2;
const MINION_AGGRO_RANGE = 220;
const MINION_GOLD = 20;
const MINION_XP = 30;
const WAVE_SIZE = 3;
const SPATIAL_CELL_SIZE = 128;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function squaredDistance(a: SimEntity | SimVec, b: SimEntity | SimVec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

function entityByPlayer(state: SimulationState, playerId: PlayerId): SimEntity | null {
  const ids = Object.keys(state.entities).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const entity = state.entities[String(id)];
    if (entity.ownerPlayerId === playerId) return entity;
  }
  return null;
}

function createHero(state: SimulationState, player: CreateSimulationOptions['players'][number]): SimEntity {
  const id: EntityId = state.nextEntityId++;
  const x = clampInt(player.x, 0, state.width);
  const y = clampInt(player.y, 0, state.height);
  return {
    id,
    kind: 'hero',
    team: player.team,
    ownerPlayerId: player.playerId,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: 16,
    moveTarget: null,
    attackTargetId: null,
    hp: HERO_HP,
    maxHp: HERO_HP,
    attackDamage: HERO_ATTACK_DAMAGE,
    attackRange: HERO_ATTACK_RANGE,
    attackCooldownTicks: HERO_ATTACK_COOLDOWN_TICKS,
    attackCooldownRemaining: 0,
    moveSpeedPerTick: HERO_MOVE_SPEED_PER_TICK,
    critChancePermille: HERO_CRIT_CHANCE_PERMILLE,
    aggroRange: 0,
    dead: false,
    respawnAtTick: null,
    bountyGold: HERO_KILL_GOLD,
    xpBounty: HERO_KILL_XP,
    level: 1,
    xp: 0,
    gold: 475,
    cs: 0,
  };
}

function laneY(state: SimulationState): number {
  return Math.trunc(state.height * LANE_Y_RATIO);
}

function teamTowerX(state: SimulationState, team: SimTeam): number {
  return team === 0 ? Math.trunc(state.width * 0.18) : Math.trunc(state.width * 0.82);
}

function teamMinionSpawnX(state: SimulationState, team: SimTeam): number {
  return team === 0 ? Math.trunc(state.width * 0.22) : Math.trunc(state.width * 0.78);
}

function spawnTower(state: SimulationState, team: SimTeam): void {
  const id = state.nextEntityId++;
  const x = teamTowerX(state, team);
  const y = laneY(state);
  state.entities[String(id)] = {
    id,
    kind: 'tower',
    team,
    ownerPlayerId: null,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: 28,
    moveTarget: null,
    attackTargetId: null,
    hp: TOWER_HP,
    maxHp: TOWER_HP,
    attackDamage: TOWER_ATTACK_DAMAGE,
    attackRange: TOWER_ATTACK_RANGE,
    attackCooldownTicks: TOWER_ATTACK_COOLDOWN_TICKS,
    attackCooldownRemaining: 0,
    moveSpeedPerTick: 0,
    critChancePermille: 0,
    aggroRange: TOWER_AGGRO_RANGE,
    dead: false,
    respawnAtTick: null,
    bountyGold: TOWER_GOLD,
    xpBounty: 0,
    level: 1,
    xp: 0,
    gold: 0,
    cs: 0,
  };
}

function spawnMinion(state: SimulationState, team: SimTeam, offset: number): void {
  const id = state.nextEntityId++;
  const x = teamMinionSpawnX(state, team);
  const y = laneY(state) + offset;
  state.entities[String(id)] = {
    id,
    kind: 'minion',
    team,
    ownerPlayerId: null,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: 10,
    moveTarget: null,
    attackTargetId: null,
    hp: MINION_HP,
    maxHp: MINION_HP,
    attackDamage: MINION_ATTACK_DAMAGE,
    attackRange: MINION_ATTACK_RANGE,
    attackCooldownTicks: MINION_ATTACK_COOLDOWN_TICKS,
    attackCooldownRemaining: 0,
    moveSpeedPerTick: MINION_MOVE_SPEED_PER_TICK,
    critChancePermille: 0,
    aggroRange: MINION_AGGRO_RANGE,
    dead: false,
    respawnAtTick: null,
    bountyGold: MINION_GOLD,
    xpBounty: MINION_XP,
    level: 1,
    xp: 0,
    gold: 0,
    cs: 0,
  };
}

function spawnWave(state: SimulationState): void {
  const offsets = [-26, 0, 26];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < WAVE_SIZE; i += 1) spawnMinion(state, team, offsets[i]);
  }
  state.waveNumber += 1;
}

function maybeSpawnWave(state: SimulationState): void {
  if (!state.laneEnabled || state.nextWaveTick === null || state.winner !== null) return;
  if (state.tick < state.nextWaveTick) return;
  spawnWave(state);
  state.nextWaveTick += WAVE_INTERVAL_TICKS;
}

function moveEntity(state: SimulationState, entity: SimEntity): void {
  if (entity.dead || !entity.moveTarget || entity.moveSpeedPerTick <= 0) return;
  const dx = entity.moveTarget.x - entity.x;
  const dy = entity.moveTarget.y - entity.y;
  if (dx === 0 && dy === 0) {
    entity.moveTarget = null;
    return;
  }
  const distance = Math.sqrt(dx * dx + dy * dy);
  const step = entity.moveSpeedPerTick;
  if (distance <= step) {
    entity.x = entity.moveTarget.x;
    entity.y = entity.moveTarget.y;
    entity.moveTarget = null;
    return;
  }
  entity.x = clampInt(entity.x + (dx / distance) * step, 0, state.width);
  entity.y = clampInt(entity.y + (dy / distance) * step, 0, state.height);
}

function awardKill(state: SimulationState, attacker: SimEntity, victim: SimEntity): void {
  if (attacker.kind === 'hero') {
    attacker.gold += victim.bountyGold;
    attacker.xp += victim.xpBounty;
    if (victim.kind === 'minion') attacker.cs += 1;
    while (attacker.xp >= attacker.level * 100 && attacker.level < 18) {
      attacker.xp -= attacker.level * 100;
      attacker.level += 1;
    }
  }
  if (victim.kind === 'hero') state.score[attacker.team] += 1;
}

function killEntity(state: SimulationState, victim: SimEntity, attacker: SimEntity): void {
  victim.hp = 0;
  victim.dead = true;
  victim.moveTarget = null;
  victim.attackTargetId = null;
  victim.respawnAtTick = victim.kind === 'hero' ? state.tick + HERO_RESPAWN_TICKS : null;
  awardKill(state, attacker, victim);
  if (victim.kind === 'tower') state.winner = attacker.team;
}

function validEnemy(attacker: SimEntity, target: SimEntity | undefined): target is SimEntity {
  return Boolean(target && !target.dead && target.team !== attacker.team);
}

function tryAttack(state: SimulationState, attacker: SimEntity): void {
  if (attacker.dead || attacker.attackTargetId === null || attacker.attackCooldownRemaining > 0) return;
  const target = state.entities[String(attacker.attackTargetId)];
  if (!validEnemy(attacker, target)) {
    attacker.attackTargetId = null;
    return;
  }
  const range = attacker.attackRange + target.radius;
  if (squaredDistance(attacker, target) > range * range) return;
  const crit = rollPermille(state.rngState, attacker.critChancePermille);
  state.rngState = crit.state;
  const damage = crit.hit ? attacker.attackDamage * 2 : attacker.attackDamage;
  target.hp = Math.max(0, target.hp - damage);
  attacker.attackCooldownRemaining = attacker.attackCooldownTicks;
  if (target.hp === 0) killEntity(state, target, attacker);
}

function respawnIfReady(state: SimulationState, entity: SimEntity): void {
  if (entity.kind !== 'hero' || !entity.dead || entity.respawnAtTick === null || state.tick < entity.respawnAtTick) return;
  entity.dead = false;
  entity.hp = entity.maxHp;
  entity.x = entity.spawnX;
  entity.y = entity.spawnY;
  entity.respawnAtTick = null;
  entity.attackCooldownRemaining = 0;
  entity.attackTargetId = null;
  entity.moveTarget = null;
}

function nearestEnemy(
  state: SimulationState,
  index: SpatialHash,
  entity: SimEntity,
  radius: number,
  preferredKinds?: readonly SimEntity['kind'][],
): SimEntity | null {
  let best: SimEntity | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxDistance = radius * radius;
  const ids = querySpatialHash(index, entity.x, entity.y, radius);
  for (const id of ids) {
    const target = state.entities[String(id)];
    if (!validEnemy(entity, target)) continue;
    if (preferredKinds && !preferredKinds.includes(target.kind)) continue;
    const d2 = squaredDistance(entity, target);
    if (d2 > maxDistance) continue;
    if (d2 < bestDistance || (d2 === bestDistance && target.id < (best?.id ?? Number.MAX_SAFE_INTEGER))) {
      best = target;
      bestDistance = d2;
    }
  }
  return best;
}

function updateMinionAI(state: SimulationState, index: SpatialHash, minion: SimEntity): void {
  if (minion.dead) return;
  const current = minion.attackTargetId === null ? undefined : state.entities[String(minion.attackTargetId)];
  if (!validEnemy(minion, current) || squaredDistance(minion, current) > minion.aggroRange * minion.aggroRange) {
    const target = nearestEnemy(state, index, minion, minion.aggroRange, ['minion', 'hero', 'tower']);
    minion.attackTargetId = target?.id ?? null;
  }
  const target = minion.attackTargetId === null ? undefined : state.entities[String(minion.attackTargetId)];
  if (validEnemy(minion, target)) {
    const range = minion.attackRange + target.radius;
    if (squaredDistance(minion, target) > range * range) minion.moveTarget = { x: target.x, y: target.y };
    else minion.moveTarget = null;
    return;
  }
  const enemyTower = Object.values(state.entities)
    .filter((candidate) => candidate.kind === 'tower' && candidate.team !== minion.team && !candidate.dead)
    .sort((a, b) => a.id - b.id)[0];
  minion.moveTarget = enemyTower ? { x: enemyTower.x, y: enemyTower.y } : null;
}

function updateTowerAI(state: SimulationState, index: SpatialHash, tower: SimEntity): void {
  if (tower.dead) return;
  const current = tower.attackTargetId === null ? undefined : state.entities[String(tower.attackTargetId)];
  const range = tower.attackRange + (current?.radius ?? 0);
  if (!validEnemy(tower, current) || squaredDistance(tower, current) > range * range) {
    const minion = nearestEnemy(state, index, tower, tower.aggroRange, ['minion']);
    const hero = minion ? null : nearestEnemy(state, index, tower, tower.aggroRange, ['hero']);
    tower.attackTargetId = (minion ?? hero)?.id ?? null;
  }
}

function acceptCommand(state: SimulationState, command: CoreMovementCommand): boolean {
  if (command.tick !== state.tick) return false;
  const previous = state.lastAcceptedSeq[command.playerId] ?? -1;
  if (!Number.isInteger(command.seq) || command.seq <= previous) return false;
  state.lastAcceptedSeq[command.playerId] = command.seq;
  return true;
}

function applyCommand(state: SimulationState, command: CoreMovementCommand): void {
  if (!acceptCommand(state, command)) return;
  const entity = entityByPlayer(state, command.playerId);
  if (!entity || entity.dead) return;
  switch (command.type) {
    case 'move':
      entity.moveTarget = { x: clampInt(command.x, 0, state.width), y: clampInt(command.y, 0, state.height) };
      entity.attackTargetId = null;
      break;
    case 'attack': {
      const target = state.entities[String(command.targetId)];
      if (validEnemy(entity, target)) entity.attackTargetId = target.id;
      break;
    }
    case 'stop':
      entity.moveTarget = null;
      entity.attackTargetId = null;
      break;
  }
}

export function createSimulation(options: CreateSimulationOptions): SimulationState {
  const width = clampInt(options.width ?? DEFAULT_WIDTH, 512, 100_000);
  const height = clampInt(options.height ?? DEFAULT_HEIGHT, 512, 100_000);
  const state: SimulationState = {
    version: 2,
    contentVersion: options.contentVersion?.trim() || 'core-0.2-dev',
    tick: 0,
    seed: normalizeSeed(options.seed),
    rngState: normalizeSeed(options.seed),
    width,
    height,
    nextEntityId: 1,
    entities: {},
    score: [0, 0],
    lastAcceptedSeq: {},
    laneEnabled: Boolean(options.withLane),
    nextWaveTick: options.withLane ? 0 : null,
    waveNumber: 0,
    winner: null,
  };

  const seenPlayers = new Set<string>();
  for (const player of options.players) {
    if (!player.playerId || seenPlayers.has(player.playerId)) throw new Error('playerId inválido ou duplicado: ' + player.playerId);
    seenPlayers.add(player.playerId);
    const hero = createHero(state, player);
    state.entities[String(hero.id)] = hero;
    state.lastAcceptedSeq[player.playerId] = -1;
  }

  if (state.laneEnabled) {
    spawnTower(state, 0);
    spawnTower(state, 1);
  }
  return state;
}

/** Executa exatamente um tick autoritativo, sem relógio, DOM, rede ou Math.random(). */
export function stepSimulation(state: SimulationState, commands: readonly CoreMovementCommand[]): void {
  if (state.winner !== null) return;
  maybeSpawnWave(state);
  const ordered = [...commands].sort((a, b) => {
    const playerOrder = compareText(a.playerId, b.playerId);
    return playerOrder !== 0 ? playerOrder : a.seq - b.seq;
  });
  for (const command of ordered) applyCommand(state, command);

  let index = buildSpatialHash(state.entities, SPATIAL_CELL_SIZE);
  const ids = Object.keys(state.entities).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const entity = state.entities[String(id)];
    respawnIfReady(state, entity);
    if (entity.attackCooldownRemaining > 0) entity.attackCooldownRemaining -= 1;
    if (entity.kind === 'minion') updateMinionAI(state, index, entity);
    else if (entity.kind === 'tower') updateTowerAI(state, index, entity);
    moveEntity(state, entity);
  }

  index = buildSpatialHash(state.entities, SPATIAL_CELL_SIZE);
  for (const id of ids) {
    const entity = state.entities[String(id)];
    if (!entity || entity.dead) continue;
    if (entity.kind === 'minion') updateMinionAI(state, index, entity);
    else if (entity.kind === 'tower') updateTowerAI(state, index, entity);
    tryAttack(state, entity);
    if (state.winner !== null) break;
  }

  state.tick += 1;
}
