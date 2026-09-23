import type { CoreSimulationCommand, EntityId, PlayerId } from '../shared/protocol.ts';
import {
  CURRENT_AUTHORITATIVE_CONTENT,
  authoritativeHero,
  authoritativeItem,
  type AuthoritativeContentPayload,
  type AuthoritativeNeutralContent,
} from '../shared/authoritativeContent.ts';
import { normalizeSeed, rollPermille } from './rng.ts';
import { buildSpatialHash, querySpatialHash, type SpatialHash } from './spatialHash.ts';
import {
  WAVE_INTERVAL_TICKS,
  type CreateSimulationOptions,
  type SimAbilitySlot,
  type SimEntity,
  type SimHeroId,
  type SimStatus,
  type SimStatusKind,
  type SimTeam,
  type SimulationState,
  type SimVec,
} from './types.ts';

const DEFAULT_WIDTH = 3000;
const DEFAULT_HEIGHT = 3000;
const LANE_Y_RATIO = 0.5;

const TOWER_HP = 1800;
const TOWER_ATTACK_DAMAGE = 95;
const TOWER_ATTACK_RANGE = 320;
const TOWER_ATTACK_COOLDOWN_TICKS = 30;
const TOWER_AGGRO_RANGE = 340;
const TOWER_GOLD = 500;
const TOWER_HERO_AGGRO_TICKS = 90;

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
const XP_SHARE_RADIUS = 500;
const UNIT_SEPARATION_PADDING = 2;

const EMPTY_COOLDOWNS = (): Record<SimAbilitySlot, number> => ({ Q: 0, W: 0, E: 0, R: 0 });

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

function heroIdFor(player: CreateSimulationOptions['players'][number]): SimHeroId {
  if (player.heroId === 'gareth' || player.heroId === 'luxana') return player.heroId;
  return player.team === 0 ? 'gareth' : 'luxana';
}

function baseEntityFields() {
  return {
    abilityCooldowns: EMPTY_COOLDOWNS(),
    statuses: [] as SimStatus[],
    towerAggroUntilTick: 0,
    neutral: false,
    campId: null as string | null,
    leashRadius: 0,
    visionRadius: 0,
    expiresAtTick: null as number | null,
    wardCooldownRemaining: 0,
    inventory: [] as string[],
  };
}

function createHero(
  state: SimulationState,
  player: CreateSimulationOptions['players'][number],
  content: AuthoritativeContentPayload,
): SimEntity {
  const id: EntityId = state.nextEntityId++;
  const x = clampInt(player.x, 0, state.width);
  const y = clampInt(player.y, 0, state.height);
  const heroId = heroIdFor(player);
  const publishedHero = authoritativeHero(heroId, content);
  return {
    id,
    kind: 'hero',
    team: player.team,
    ownerPlayerId: player.playerId,
    heroId,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: 16,
    moveTarget: null,
    attackTargetId: null,
    hp: publishedHero.maxHp,
    maxHp: publishedHero.maxHp,
    attackDamage: publishedHero.attackDamage,
    attackRange: publishedHero.attackRange,
    attackCooldownTicks: publishedHero.attackCooldownTicks,
    attackCooldownRemaining: 0,
    ...baseEntityFields(),
    visionRadius: content.rules.heroVisionRadius,
    moveSpeedPerTick: publishedHero.moveSpeedPerTick,
    critChancePermille: publishedHero.critChancePermille,
    aggroRange: 0,
    dead: false,
    respawnAtTick: null,
    bountyGold: content.rules.heroKillGold,
    xpBounty: content.rules.heroKillXp,
    level: 1,
    xp: 0,
    gold: content.rules.startingGold,
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
    heroId: null,
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
    ...baseEntityFields(),
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
    heroId: null,
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
    ...baseEntityFields(),
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

function spawnNeutralUnit(
  state: SimulationState,
  definition: AuthoritativeNeutralContent,
): void {
  const id = state.nextEntityId++;
  const x = Math.trunc(state.width * definition.xPermille / 1000);
  const y = Math.trunc(state.height * definition.yPermille / 1000);
  state.entities[String(id)] = {
    id,
    kind: definition.kind === 'objective' ? 'objective' : 'monster',
    team: 0,
    ownerPlayerId: null,
    heroId: null,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: definition.kind === 'objective' ? 32 : 20,
    moveTarget: null,
    attackTargetId: null,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    attackDamage: definition.attackDamage,
    attackRange: definition.attackRange,
    attackCooldownTicks: definition.attackCooldownTicks,
    attackCooldownRemaining: 0,
    ...baseEntityFields(),
    neutral: true,
    campId: definition.id,
    leashRadius: definition.leashRadius,
    moveSpeedPerTick: definition.moveSpeedPerTick,
    critChancePermille: 0,
    aggroRange: definition.aggroRange,
    dead: false,
    respawnAtTick: null,
    bountyGold: definition.bountyGold,
    xpBounty: definition.xpBounty,
    level: 1,
    xp: 0,
    gold: 0,
    cs: 0,
  };
}

function spawnJungle(state: SimulationState, content: AuthoritativeContentPayload): void {
  for (const definition of content.neutralUnits) spawnNeutralUnit(state, definition);
}

function neutralDefinition(
  entity: SimEntity,
  content: AuthoritativeContentPayload,
): AuthoritativeNeutralContent | null {
  if (!entity.campId) return null;
  return content.neutralUnits.find((entry) => entry.id === entity.campId) ?? null;
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

function statusActive(entity: SimEntity, kind: SimStatusKind, tick: number): SimStatus | null {
  return entity.statuses.find((status) => status.kind === kind && status.expiresAtTick > tick) ?? null;
}

function pruneStatuses(entity: SimEntity, tick: number): void {
  entity.statuses = entity.statuses.filter((status) => status.expiresAtTick > tick);
}

function upsertStatus(entity: SimEntity, status: SimStatus): void {
  const existing = entity.statuses.find((candidate) => candidate.kind === status.kind);
  if (!existing) {
    entity.statuses.push(status);
    entity.statuses.sort((a, b) => compareText(a.kind, b.kind) || a.sourceId - b.sourceId);
    return;
  }
  existing.sourceId = status.sourceId;
  existing.expiresAtTick = Math.max(existing.expiresAtTick, status.expiresAtTick);
  existing.magnitudePermille = Math.max(existing.magnitudePermille, status.magnitudePermille);
}

function effectiveMoveStep(entity: SimEntity, tick: number): number {
  if (statusActive(entity, 'stun', tick) || statusActive(entity, 'root', tick)) return 0;
  const slow = statusActive(entity, 'slow', tick);
  if (!slow) return entity.moveSpeedPerTick;
  return Math.max(1, Math.trunc(entity.moveSpeedPerTick * (1000 - slow.magnitudePermille) / 1000));
}

function moveEntity(state: SimulationState, entity: SimEntity): void {
  if (entity.dead || !entity.moveTarget) return;
  const step = effectiveMoveStep(entity, state.tick);
  if (step <= 0) return;

  const dx = entity.moveTarget.x - entity.x;
  const dy = entity.moveTarget.y - entity.y;
  if (dx === 0 && dy === 0) {
    entity.moveTarget = null;
    return;
  }
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= step) {
    entity.x = entity.moveTarget.x;
    entity.y = entity.moveTarget.y;
    entity.moveTarget = null;
    return;
  }
  entity.x = clampInt(entity.x + (dx / distance) * step, entity.radius, state.width - entity.radius);
  entity.y = clampInt(entity.y + (dy / distance) * step, entity.radius, state.height - entity.radius);
}

function grantXp(entity: SimEntity, amount: number): void {
  if (entity.kind !== 'hero' || entity.dead || amount <= 0) return;
  entity.xp += amount;
  while (entity.xp >= entity.level * 100 && entity.level < 18) {
    entity.xp -= entity.level * 100;
    entity.level += 1;
  }
}

function shareMinionXp(state: SimulationState, victim: SimEntity, killerTeam: SimTeam): void {
  const radiusSq = XP_SHARE_RADIUS * XP_SHARE_RADIUS;
  const nearby = Object.values(state.entities)
    .filter((entity) =>
      entity.kind === 'hero' &&
      entity.team === killerTeam &&
      !entity.dead &&
      squaredDistance(entity, victim) <= radiusSq,
    )
    .sort((a, b) => a.id - b.id);
  if (nearby.length === 0) return;
  const share = Math.max(1, Math.trunc(victim.xpBounty / nearby.length));
  for (const hero of nearby) grantXp(hero, share);
}

function awardKill(
  state: SimulationState,
  attacker: SimEntity,
  victim: SimEntity,
  content: AuthoritativeContentPayload,
): void {
  if (attacker.kind === 'hero') {
    attacker.gold += victim.bountyGold;
    if (victim.kind === 'minion') attacker.cs += 1;
    if (victim.kind !== 'minion') grantXp(attacker, victim.xpBounty);
  }
  if (victim.kind === 'minion') shareMinionXp(state, victim, attacker.team);
  if (victim.kind === 'hero') state.score[attacker.team] += 1;
  if (victim.kind === 'objective') {
    state.objectiveScore[attacker.team] += 1;
    const definition = neutralDefinition(victim, content);
    const teamGold = definition?.teamGold ?? 0;
    if (teamGold > 0) {
      for (const entity of Object.values(state.entities)) {
        if (entity.kind === 'hero' && entity.team === attacker.team) entity.gold += teamGold;
      }
    }
  }
}

function killEntity(
  state: SimulationState,
  victim: SimEntity,
  attacker: SimEntity,
  content: AuthoritativeContentPayload,
): void {
  victim.hp = 0;
  victim.dead = true;
  victim.moveTarget = null;
  victim.attackTargetId = null;
  victim.statuses = [];
  if (victim.kind === 'hero') {
    victim.respawnAtTick = state.tick + content.rules.heroRespawnTicks;
  } else if (victim.kind === 'monster' || victim.kind === 'objective') {
    const definition = neutralDefinition(victim, content);
    victim.respawnAtTick = definition ? state.tick + definition.respawnTicks : null;
  } else {
    victim.respawnAtTick = null;
  }
  awardKill(state, attacker, victim, content);
  if (victim.kind === 'tower') state.winner = attacker.team;
}

function validEnemy(attacker: SimEntity, target: SimEntity | undefined): target is SimEntity {
  if (!target || target.dead || target.kind === 'ward') return false;
  if (attacker.neutral) return !target.neutral && target.kind === 'hero';
  if (target.neutral) return target.kind === 'monster' || target.kind === 'objective';
  return target.team !== attacker.team;
}

function markTowerAggro(state: SimulationState, attacker: SimEntity, victim: SimEntity): void {
  if (attacker.kind === 'hero' && victim.kind === 'hero') {
    attacker.towerAggroUntilTick = Math.max(attacker.towerAggroUntilTick, state.tick + TOWER_HERO_AGGRO_TICKS);
  }
}

function dealDamage(
  state: SimulationState,
  attacker: SimEntity,
  victim: SimEntity,
  amount: number,
  content: AuthoritativeContentPayload,
): void {
  if (!validEnemy(attacker, victim) || amount <= 0) return;
  markTowerAggro(state, attacker, victim);
  if (victim.neutral && attacker.kind === 'hero') victim.attackTargetId = attacker.id;
  victim.hp = Math.max(0, victim.hp - Math.max(0, Math.trunc(amount)));
  if (victim.hp === 0) killEntity(state, victim, attacker, content);
}

function tryAttack(state: SimulationState, attacker: SimEntity, content: AuthoritativeContentPayload): void {
  if (
    attacker.dead ||
    attacker.attackTargetId === null ||
    attacker.attackCooldownRemaining > 0 ||
    statusActive(attacker, 'stun', state.tick)
  ) return;

  const target = state.entities[String(attacker.attackTargetId)];
  if (!validEnemy(attacker, target)) {
    attacker.attackTargetId = null;
    return;
  }
  const range = attacker.attackRange + target.radius;
  if (squaredDistance(attacker, target) > range * range) return;

  const crit = rollPermille(state.rngState, attacker.critChancePermille);
  state.rngState = crit.state;
  dealDamage(state, attacker, target, crit.hit ? attacker.attackDamage * 2 : attacker.attackDamage, content);
  attacker.attackCooldownRemaining = attacker.attackCooldownTicks;
}

function respawnIfReady(state: SimulationState, entity: SimEntity): void {
  if (
    (entity.kind !== 'hero' && entity.kind !== 'monster' && entity.kind !== 'objective') ||
    !entity.dead ||
    entity.respawnAtTick === null ||
    state.tick < entity.respawnAtTick
  ) return;
  entity.dead = false;
  entity.hp = entity.maxHp;
  entity.x = entity.spawnX;
  entity.y = entity.spawnY;
  entity.respawnAtTick = null;
  entity.attackCooldownRemaining = 0;
  entity.abilityCooldowns = EMPTY_COOLDOWNS();
  entity.attackTargetId = null;
  entity.moveTarget = null;
  entity.statuses = [];
  entity.towerAggroUntilTick = 0;
}

function nearestEnemy(
  state: SimulationState,
  index: SpatialHash,
  entity: SimEntity,
  radius: number,
  preferredKinds?: readonly SimEntity['kind'][],
  predicate?: (target: SimEntity) => boolean,
): SimEntity | null {
  let best: SimEntity | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxDistance = radius * radius;
  const ids = querySpatialHash(index, entity.x, entity.y, radius);
  for (const id of ids) {
    const target = state.entities[String(id)];
    if (!validEnemy(entity, target)) continue;
    if (preferredKinds && !preferredKinds.includes(target.kind)) continue;
    if (predicate && !predicate(target)) continue;
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
    minion.moveTarget = squaredDistance(minion, target) > range * range ? { x: target.x, y: target.y } : null;
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
  const currentStillValid = validEnemy(tower, current) && squaredDistance(tower, current) <= range * range;

  const provoker = nearestEnemy(
    state,
    index,
    tower,
    tower.aggroRange,
    ['hero'],
    (candidate) => candidate.towerAggroUntilTick > state.tick,
  );
  if (provoker) {
    tower.attackTargetId = provoker.id;
    return;
  }
  if (currentStillValid) return;

  const minion = nearestEnemy(state, index, tower, tower.aggroRange, ['minion']);
  const hero = minion ? null : nearestEnemy(state, index, tower, tower.aggroRange, ['hero']);
  tower.attackTargetId = (minion ?? hero)?.id ?? null;
}

function updateNeutralAI(state: SimulationState, index: SpatialHash, neutral: SimEntity): void {
  if (neutral.dead || !neutral.neutral) return;
  const spawn = { x: neutral.spawnX, y: neutral.spawnY };
  const leashSq = neutral.leashRadius * neutral.leashRadius;

  if (squaredDistance(neutral, spawn) > leashSq) {
    neutral.attackTargetId = null;
    neutral.moveTarget = spawn;
    return;
  }

  const current = neutral.attackTargetId === null
    ? undefined
    : state.entities[String(neutral.attackTargetId)];
  const currentValid = validEnemy(neutral, current) &&
    squaredDistance(current, spawn) <= leashSq;

  if (!currentValid) {
    const target = nearestEnemy(
      state,
      index,
      neutral,
      neutral.aggroRange,
      ['hero'],
      (candidate) => squaredDistance(candidate, spawn) <= leashSq,
    );
    neutral.attackTargetId = target?.id ?? null;
  }

  const target = neutral.attackTargetId === null
    ? undefined
    : state.entities[String(neutral.attackTargetId)];
  if (validEnemy(neutral, target)) {
    const range = neutral.attackRange + target.radius;
    neutral.moveTarget = squaredDistance(neutral, target) > range * range
      ? { x: target.x, y: target.y }
      : null;
    return;
  }

  neutral.moveTarget = (neutral.x === neutral.spawnX && neutral.y === neutral.spawnY)
    ? null
    : spawn;
}

function decrementCooldowns(entity: SimEntity): void {
  if (entity.attackCooldownRemaining > 0) entity.attackCooldownRemaining -= 1;
  if (entity.wardCooldownRemaining > 0) entity.wardCooldownRemaining -= 1;
  for (const slot of ['Q', 'W', 'E', 'R'] as const) {
    if (entity.abilityCooldowns[slot] > 0) entity.abilityCooldowns[slot] -= 1;
  }
}

function resolveEntityCollisions(state: SimulationState): void {
  const entities = Object.values(state.entities)
    .filter((entity) => !entity.dead && entity.kind !== 'tower' && entity.kind !== 'ward')
    .sort((a, b) => a.id - b.id);

  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i];
      const b = entities[j];
      const minDistance = a.radius + b.radius + UNIT_SEPARATION_PADDING;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= minDistance * minDistance) continue;

      if (distanceSq === 0) {
        const dir = a.id < b.id ? -1 : 1;
        a.x = clampInt(a.x + dir, a.radius, state.width - a.radius);
        b.x = clampInt(b.x - dir, b.radius, state.width - b.radius);
        continue;
      }

      const distance = Math.sqrt(distanceSq);
      const overlap = minDistance - distance;
      const pushX = Math.max(1, Math.trunc(Math.abs(dx / distance * overlap / 2)));
      const pushY = Math.max(0, Math.trunc(Math.abs(dy / distance * overlap / 2)));
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;

      a.x = clampInt(a.x - signX * pushX, a.radius, state.width - a.radius);
      b.x = clampInt(b.x + signX * pushX, b.radius, state.width - b.radius);
      if (pushY > 0) {
        a.y = clampInt(a.y - signY * pushY, a.radius, state.height - a.radius);
        b.y = clampInt(b.y + signY * pushY, b.radius, state.height - b.radius);
      }
    }
  }
}

function acceptCommand(state: SimulationState, command: CoreSimulationCommand): boolean {
  if (command.tick !== state.tick) return false;
  const previous = state.lastAcceptedSeq[command.playerId] ?? -1;
  if (!Number.isInteger(command.seq) || command.seq <= previous) return false;
  state.lastAcceptedSeq[command.playerId] = command.seq;
  return true;
}

function normalizedDirection(from: SimEntity, x: number, y: number): SimVec | null {
  const dx = x - from.x;
  const dy = y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return null;
  return { x: dx / distance, y: dy / distance };
}

function pointSegmentDistanceSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq <= 0) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  const dx = px - qx;
  const dy = py - qy;
  return dx * dx + dy * dy;
}

function castGarethQ(
  state: SimulationState,
  caster: SimEntity,
  targetId: EntityId | undefined,
  content: AuthoritativeContentPayload,
): boolean {
  if (!targetId) return false;
  const target = state.entities[String(targetId)];
  if (!validEnemy(caster, target)) return false;
  const q = authoritativeHero('gareth', content).q;
  const range = q.range + target.radius;
  if (squaredDistance(caster, target) > range * range) return false;

  const damage = q.damageBase + Math.trunc(caster.attackDamage * q.damageAdPermille / 1000);
  dealDamage(state, caster, target, damage, content);
  if (!target.dead) {
    upsertStatus(target, {
      kind: q.statusKind,
      sourceId: caster.id,
      expiresAtTick: state.tick + q.statusTicks,
      magnitudePermille: q.statusMagnitudePermille,
    });
  }
  caster.abilityCooldowns.Q = q.cooldownTicks;
  return true;
}

function castLuxanaQ(
  state: SimulationState,
  caster: SimEntity,
  x: number | undefined,
  y: number | undefined,
  content: AuthoritativeContentPayload,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const direction = normalizedDirection(caster, Number(x), Number(y));
  if (!direction) return false;

  const q = authoritativeHero('luxana', content).q;
  const endX = caster.x + direction.x * q.range;
  const endY = caster.y + direction.y * q.range;
  const halfWidth = q.lineHalfWidth ?? 1;
  const candidates = Object.values(state.entities)
    .filter((target) =>
      validEnemy(caster, target) &&
      target.kind !== 'tower' &&
      pointSegmentDistanceSquared(target.x, target.y, caster.x, caster.y, endX, endY) <=
        (halfWidth + target.radius) ** 2,
    )
    .sort((a, b) => {
      const da = squaredDistance(caster, a);
      const db = squaredDistance(caster, b);
      return da - db || a.id - b.id;
    });

  const target = candidates[0];
  if (!target) return false;
  const damage = q.damageBase + Math.trunc(caster.attackDamage * q.damageAdPermille / 1000);
  dealDamage(state, caster, target, damage, content);
  if (!target.dead) {
    upsertStatus(target, {
      kind: q.statusKind,
      sourceId: caster.id,
      expiresAtTick: state.tick + q.statusTicks,
      magnitudePermille: q.statusMagnitudePermille,
    });
  }
  caster.abilityCooldowns.Q = q.cooldownTicks;
  return true;
}

function castQ(
  state: SimulationState,
  caster: SimEntity,
  command: Extract<CoreSimulationCommand, { type: 'cast' }>,
  content: AuthoritativeContentPayload,
): void {
  if (
    caster.kind !== 'hero' ||
    caster.dead ||
    caster.abilityCooldowns.Q > 0 ||
    statusActive(caster, 'stun', state.tick) ||
    command.slot !== 'Q'
  ) return;

  if (caster.heroId === 'gareth') castGarethQ(state, caster, command.targetId, content);
  else if (caster.heroId === 'luxana') castLuxanaQ(state, caster, command.x, command.y, content);
}

function buyItem(
  entity: SimEntity,
  itemId: string,
  content: AuthoritativeContentPayload,
): void {
  if (entity.kind !== 'hero' || entity.dead) return;
  const item = authoritativeItem(itemId, content);
  if (!item) return;
  if (entity.inventory.length >= content.rules.maxInventorySlots) return;
  const dx = entity.x - entity.spawnX;
  const dy = entity.y - entity.spawnY;
  if (dx * dx + dy * dy > content.rules.shopRadius * content.rules.shopRadius) return;
  if (entity.gold < item.cost) return;

  entity.gold -= item.cost;
  entity.inventory.push(item.id);
  if (item.stats.attackDamage) entity.attackDamage += item.stats.attackDamage;
  if (item.stats.maxHp) {
    entity.maxHp += item.stats.maxHp;
    entity.hp += item.stats.maxHp;
  }
  if (item.stats.moveSpeedPerTick) entity.moveSpeedPerTick += item.stats.moveSpeedPerTick;
}

function placeWard(
  state: SimulationState,
  hero: SimEntity,
  x: number,
  y: number,
  content: AuthoritativeContentPayload,
): void {
  if (hero.kind !== 'hero' || hero.dead || hero.wardCooldownRemaining > 0) return;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const target = {
    x: clampInt(x, 0, state.width),
    y: clampInt(y, 0, state.height),
  };
  const placementRangeSq = content.rules.wardPlacementRange * content.rules.wardPlacementRange;
  if (squaredDistance(hero, target) > placementRangeSq) return;

  const teamWards = Object.values(state.entities)
    .filter((entity) => entity.kind === 'ward' && entity.team === hero.team && !entity.dead)
    .sort((a, b) =>
      (a.expiresAtTick ?? Number.MAX_SAFE_INTEGER) - (b.expiresAtTick ?? Number.MAX_SAFE_INTEGER) ||
      a.id - b.id,
    );
  if (teamWards.length >= content.rules.maxWardsPerTeam) {
    delete state.entities[String(teamWards[0].id)];
  }

  const id = state.nextEntityId++;
  state.entities[String(id)] = {
    id,
    kind: 'ward',
    team: hero.team,
    ownerPlayerId: hero.ownerPlayerId,
    heroId: null,
    x: target.x,
    y: target.y,
    spawnX: target.x,
    spawnY: target.y,
    radius: 6,
    moveTarget: null,
    attackTargetId: null,
    hp: 1,
    maxHp: 1,
    attackDamage: 0,
    attackRange: 0,
    attackCooldownTicks: 1,
    attackCooldownRemaining: 0,
    ...baseEntityFields(),
    visionRadius: content.rules.wardVisionRadius,
    expiresAtTick: state.tick + content.rules.wardDurationTicks,
    moveSpeedPerTick: 0,
    critChancePermille: 0,
    aggroRange: 0,
    dead: false,
    respawnAtTick: null,
    bountyGold: 0,
    xpBounty: 0,
    level: 1,
    xp: 0,
    gold: 0,
    cs: 0,
  };
  hero.wardCooldownRemaining = content.rules.wardCooldownTicks;
}

function cleanupExpiredWards(state: SimulationState): void {
  for (const entity of Object.values(state.entities)) {
    if (entity.kind === 'ward' && entity.expiresAtTick !== null && entity.expiresAtTick <= state.tick) {
      delete state.entities[String(entity.id)];
    }
  }
}

export function isPositionVisibleToTeam(
  state: SimulationState,
  team: SimTeam,
  position: SimVec,
): boolean {
  return Object.values(state.entities)
    .filter((entity) =>
      !entity.dead &&
      entity.team === team &&
      (entity.kind === 'hero' || entity.kind === 'ward') &&
      entity.visionRadius > 0,
    )
    .some((entity) => squaredDistance(entity, position) <= entity.visionRadius * entity.visionRadius);
}

function applyCommand(
  state: SimulationState,
  command: CoreSimulationCommand,
  content: AuthoritativeContentPayload,
): void {
  if (!acceptCommand(state, command)) return;
  const entity = entityByPlayer(state, command.playerId);
  if (!entity || entity.dead) return;

  switch (command.type) {
    case 'move':
      if (!statusActive(entity, 'stun', state.tick) && !statusActive(entity, 'root', state.tick)) {
        entity.moveTarget = {
          x: clampInt(command.x, entity.radius, state.width - entity.radius),
          y: clampInt(command.y, entity.radius, state.height - entity.radius),
        };
        entity.attackTargetId = null;
      }
      break;
    case 'attack': {
      if (statusActive(entity, 'stun', state.tick)) break;
      const target = state.entities[String(command.targetId)];
      if (validEnemy(entity, target)) entity.attackTargetId = target.id;
      break;
    }
    case 'stop':
      entity.moveTarget = null;
      entity.attackTargetId = null;
      break;
    case 'cast':
      castQ(state, entity, command, content);
      break;
    case 'buy':
      buyItem(entity, command.itemId, content);
      break;
    case 'place-ward':
      placeWard(state, entity, command.x, command.y, content);
      break;
  }
}

export function createSimulation(
  options: CreateSimulationOptions,
  content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload,
): SimulationState {
  const width = clampInt(options.width ?? DEFAULT_WIDTH, 512, 100_000);
  const height = clampInt(options.height ?? DEFAULT_HEIGHT, 512, 100_000);
  const state: SimulationState = {
    version: 3,
    contentVersion: options.contentVersion?.trim() || CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
    tick: 0,
    seed: normalizeSeed(options.seed),
    rngState: normalizeSeed(options.seed),
    width,
    height,
    nextEntityId: 1,
    entities: {},
    score: [0, 0],
    objectiveScore: [0, 0],
    lastAcceptedSeq: {},
    laneEnabled: Boolean(options.withLane),
    jungleEnabled: Boolean(options.withJungle),
    nextWaveTick: options.withLane ? 0 : null,
    waveNumber: 0,
    winner: null,
  };

  const seenPlayers = new Set<string>();
  for (const player of options.players) {
    if (!player.playerId || seenPlayers.has(player.playerId)) {
      throw new Error('playerId inválido ou duplicado: ' + player.playerId);
    }
    seenPlayers.add(player.playerId);
    const hero = createHero(state, player, content);
    state.entities[String(hero.id)] = hero;
    state.lastAcceptedSeq[player.playerId] = -1;
  }

  if (state.laneEnabled) {
    spawnTower(state, 0);
    spawnTower(state, 1);
  }
  if (state.jungleEnabled) spawnJungle(state, content);
  return state;
}

/** Executa exatamente um tick autoritativo, sem relógio, DOM, rede ou Math.random(). */
export function stepSimulation(
  state: SimulationState,
  commands: readonly CoreSimulationCommand[],
  content: AuthoritativeContentPayload = CURRENT_AUTHORITATIVE_CONTENT.payload,
): void {
  if (state.winner !== null) return;

  cleanupExpiredWards(state);
  maybeSpawnWave(state);

  const ordered = [...commands].sort((a, b) => {
    const playerOrder = compareText(a.playerId, b.playerId);
    return playerOrder !== 0 ? playerOrder : a.seq - b.seq;
  });
  for (const command of ordered) applyCommand(state, command, content);

  let index = buildSpatialHash(state.entities, SPATIAL_CELL_SIZE);
  const ids = Object.keys(state.entities).map(Number).sort((a, b) => a - b);

  for (const id of ids) {
    const entity = state.entities[String(id)];
    respawnIfReady(state, entity);
    pruneStatuses(entity, state.tick);
    decrementCooldowns(entity);

    if (entity.kind === 'minion') updateMinionAI(state, index, entity);
    else if (entity.kind === 'tower') updateTowerAI(state, index, entity);
    else if (entity.kind === 'monster' || entity.kind === 'objective') updateNeutralAI(state, index, entity);

    moveEntity(state, entity);
  }

  resolveEntityCollisions(state);

  index = buildSpatialHash(state.entities, SPATIAL_CELL_SIZE);
  for (const id of ids) {
    const entity = state.entities[String(id)];
    if (!entity || entity.dead) continue;
    if (entity.kind === 'minion') updateMinionAI(state, index, entity);
    else if (entity.kind === 'tower') updateTowerAI(state, index, entity);
    else if (entity.kind === 'monster' || entity.kind === 'objective') updateNeutralAI(state, index, entity);
    tryAttack(state, entity, content);
    if (state.winner !== null) break;
  }

  state.tick += 1;
}
