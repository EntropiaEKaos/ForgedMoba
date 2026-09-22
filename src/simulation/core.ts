import type { CoreMovementCommand, EntityId } from '../shared/protocol.ts';
import { normalizeSeed, rollPermille } from './rng.ts';
import type { CreateSimulationOptions, SimEntity, SimTeam, SimulationState, SimVec } from './types.ts';

const DEFAULT_WIDTH = 3000;
const DEFAULT_HEIGHT = 3000;
const DEFAULT_HP = 650;
const DEFAULT_ATTACK_DAMAGE = 64;
const DEFAULT_ATTACK_RANGE = 72;
const DEFAULT_ATTACK_COOLDOWN_TICKS = 24;
const DEFAULT_MOVE_SPEED_PER_TICK = 4;
const DEFAULT_CRIT_CHANCE_PERMILLE = 100;
const RESPAWN_TICKS = 150;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function entityByPlayer(state: SimulationState, playerId: string): SimEntity | null {
  for (const entity of Object.values(state.entities)) {
    if (entity.ownerPlayerId === playerId) return entity;
  }
  return null;
}

function squaredDistance(a: SimEntity | SimVec, b: SimEntity | SimVec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

function moveEntity(state: SimulationState, entity: SimEntity): void {
  if (entity.dead || !entity.moveTarget) return;

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

function killEntity(state: SimulationState, victim: SimEntity, killerTeam: SimTeam): void {
  victim.hp = 0;
  victim.dead = true;
  victim.moveTarget = null;
  victim.attackTargetId = null;
  victim.respawnAtTick = state.tick + RESPAWN_TICKS;
  state.score[killerTeam] += 1;
}

function tryAttack(state: SimulationState, attacker: SimEntity): void {
  if (attacker.dead || attacker.attackTargetId === null || attacker.attackCooldownRemaining > 0) return;

  const target = state.entities[String(attacker.attackTargetId)];
  if (!target || target.dead || target.team === attacker.team) {
    attacker.attackTargetId = null;
    return;
  }

  const rangeSquared = attacker.attackRange * attacker.attackRange;
  if (squaredDistance(attacker, target) > rangeSquared) return;

  const crit = rollPermille(state.rngState, attacker.critChancePermille);
  state.rngState = crit.state;
  const damage = crit.hit ? attacker.attackDamage * 2 : attacker.attackDamage;
  target.hp = Math.max(0, target.hp - damage);
  attacker.attackCooldownRemaining = attacker.attackCooldownTicks;

  if (target.hp === 0) killEntity(state, target, attacker.team);
}

function respawnIfReady(state: SimulationState, entity: SimEntity): void {
  if (!entity.dead || entity.respawnAtTick === null || state.tick < entity.respawnAtTick) return;
  entity.dead = false;
  entity.hp = entity.maxHp;
  entity.x = entity.spawnX;
  entity.y = entity.spawnY;
  entity.respawnAtTick = null;
  entity.attackCooldownRemaining = 0;
  entity.attackTargetId = null;
  entity.moveTarget = null;
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
      entity.moveTarget = {
        x: clampInt(command.x, 0, state.width),
        y: clampInt(command.y, 0, state.height),
      };
      entity.attackTargetId = null;
      break;
    case 'attack':
      entity.attackTargetId = command.targetId;
      break;
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
    version: 1,
    tick: 0,
    seed: normalizeSeed(options.seed),
    rngState: normalizeSeed(options.seed),
    width,
    height,
    nextEntityId: 1,
    entities: {},
    score: [0, 0],
    lastAcceptedSeq: {},
  };

  const seenPlayers = new Set<string>();
  for (const player of options.players) {
    if (!player.playerId || seenPlayers.has(player.playerId)) {
      throw new Error('playerId inválido ou duplicado: ' + player.playerId);
    }
    seenPlayers.add(player.playerId);

    const id: EntityId = state.nextEntityId++;
    const x = clampInt(player.x, 0, width);
    const y = clampInt(player.y, 0, height);
    state.entities[String(id)] = {
      id,
      kind: 'hero',
      team: player.team,
      ownerPlayerId: player.playerId,
      x,
      y,
      spawnX: x,
      spawnY: y,
      moveTarget: null,
      attackTargetId: null,
      hp: DEFAULT_HP,
      maxHp: DEFAULT_HP,
      attackDamage: DEFAULT_ATTACK_DAMAGE,
      attackRange: DEFAULT_ATTACK_RANGE,
      attackCooldownTicks: DEFAULT_ATTACK_COOLDOWN_TICKS,
      attackCooldownRemaining: 0,
      moveSpeedPerTick: DEFAULT_MOVE_SPEED_PER_TICK,
      critChancePermille: DEFAULT_CRIT_CHANCE_PERMILLE,
      dead: false,
      respawnAtTick: null,
    };
    state.lastAcceptedSeq[player.playerId] = -1;
  }

  return state;
}

/**
 * Executa exatamente um tick autoritativo. Não lê relógio, DOM, rede ou Math.random().
 */
export function stepSimulation(state: SimulationState, commands: readonly CoreMovementCommand[]): void {
  const ordered = [...commands].sort((a, b) => {
    const playerOrder = a.playerId.localeCompare(b.playerId);
    return playerOrder !== 0 ? playerOrder : a.seq - b.seq;
  });

  for (const command of ordered) applyCommand(state, command);

  const ids = Object.keys(state.entities).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const entity = state.entities[String(id)];
    respawnIfReady(state, entity);
    if (entity.attackCooldownRemaining > 0) entity.attackCooldownRemaining -= 1;
    moveEntity(state, entity);
    tryAttack(state, entity);
  }

  state.tick += 1;
}
