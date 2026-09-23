import { FIXED_DT } from './constants';
import { SeededRng } from './prng';
import type { InputCommand, PlayerId, TeamId } from '../shared/protocol';
import { createInitialState, type SimEntity, type SimulationState } from './state';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class Simulation {
  readonly state: SimulationState;
  private readonly rng: SeededRng;

  constructor(seed: number, worldSize = 3000) {
    this.state = createInitialState(seed, worldSize);
    this.rng = new SeededRng(seed);
    this.state.rngState = this.rng.snapshot();
  }

  addPlayer(playerId: PlayerId, team: TeamId, x: number, y: number): number {
    if (this.state.playerEntity[playerId] !== undefined) {
      throw new Error(`Player already exists: ${playerId}`);
    }
    const id = this.state.nextEntityId++;
    const entity: SimEntity = {
      id,
      kind: 'hero',
      team,
      ownerPlayerId: playerId,
      position: { x: clamp(x, 0, this.state.worldSize), y: clamp(y, 0, this.state.worldSize) },
      velocity: { x: 0, y: 0 },
      moveTarget: null,
      hp: 600,
      maxHp: 600,
      moveSpeed: 110,
      attackDamage: 60,
      attackRange: 70,
      attackCooldownTicks: 20,
      attackCooldownRemaining: 0,
      attackTargetId: null,
      dead: false,
      respawnTick: null,
    };
    this.state.entities[id] = entity;
    this.state.playerEntity[playerId] = id;
    this.state.lastProcessedSeq[playerId] = 0;
    return id;
  }

  step(commands: readonly InputCommand[]): void {
    const ordered = [...commands].sort((a, b) =>
      a.tick - b.tick || a.playerId.localeCompare(b.playerId) || a.seq - b.seq,
    );
    for (const command of ordered) this.applyCommand(command);

    const ids = Object.keys(this.state.entities).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const entity = this.state.entities[id];
      if (!entity) continue;
      this.updateEntity(entity);
    }

    this.state.tick += 1;
    this.state.rngState = this.rng.snapshot();
  }

  private applyCommand(command: InputCommand): void {
    if (command.tick > this.state.tick) return;
    const entityId = this.state.playerEntity[command.playerId];
    if (entityId === undefined) return;

    const lastSeq = this.state.lastProcessedSeq[command.playerId] ?? 0;
    if (command.seq <= lastSeq) return;
    this.state.lastProcessedSeq[command.playerId] = command.seq;

    const entity = this.state.entities[entityId];
    if (!entity || entity.dead) return;

    switch (command.type) {
      case 'move':
        entity.moveTarget = {
          x: clamp(command.x, 0, this.state.worldSize),
          y: clamp(command.y, 0, this.state.worldSize),
        };
        entity.attackTargetId = null;
        break;
      case 'attack':
        entity.attackTargetId = command.targetId;
        entity.moveTarget = null;
        break;
      case 'cast':
      case 'buy':
      case 'upgrade':
      case 'recall':
        // Protocol reserved now; deterministic implementations migrate in later slices.
        break;
    }
  }

  private updateEntity(entity: SimEntity): void {
    if (entity.dead) {
      if (entity.respawnTick !== null && this.state.tick >= entity.respawnTick) {
        entity.dead = false;
        entity.hp = entity.maxHp;
        entity.respawnTick = null;
      }
      return;
    }

    if (entity.attackCooldownRemaining > 0) entity.attackCooldownRemaining -= 1;

    if (entity.attackTargetId !== null) {
      const target = this.state.entities[entity.attackTargetId];
      if (!target || target.dead || target.team === entity.team) {
        entity.attackTargetId = null;
      } else {
        const dx = target.position.x - entity.position.x;
        const dy = target.position.y - entity.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= entity.attackRange) {
          entity.velocity.x = 0;
          entity.velocity.y = 0;
          if (entity.attackCooldownRemaining <= 0) {
            target.hp = Math.max(0, target.hp - entity.attackDamage);
            entity.attackCooldownRemaining = entity.attackCooldownTicks;
            if (target.hp <= 0) {
              target.dead = true;
              target.moveTarget = null;
              target.attackTargetId = null;
              target.respawnTick = this.state.tick + 150;
            }
          }
          return;
        }
      }
    }

    this.updateMovement(entity);
  }

  private updateMovement(entity: SimEntity): void {
    const target = entity.moveTarget;
    if (!target) {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
      return;
    }

    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const distance = Math.hypot(dx, dy);
    const maxStep = entity.moveSpeed * FIXED_DT;
    if (distance <= maxStep || distance === 0) {
      entity.position.x = target.x;
      entity.position.y = target.y;
      entity.velocity.x = 0;
      entity.velocity.y = 0;
      entity.moveTarget = null;
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    entity.velocity.x = nx * entity.moveSpeed;
    entity.velocity.y = ny * entity.moveSpeed;
    entity.position.x = clamp(entity.position.x + entity.velocity.x * FIXED_DT, 0, this.state.worldSize);
    entity.position.y = clamp(entity.position.y + entity.velocity.y * FIXED_DT, 0, this.state.worldSize);
  }
}
