import type { AuthoritativeSnapshot, CoreSimulationCommand, PlayerId } from '../shared/protocol.ts';
import { stepOwnedPrediction } from '../simulation/core.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';

function cloneState(state: SimulationState): SimulationState {
  return structuredClone(state);
}

function localEntity(state: SimulationState, playerId: PlayerId): SimEntity | null {
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

export interface ReconciliationResult {
  ackSeq: number;
  droppedCommands: number;
  pendingCommands: number;
  correctionDistance: number;
}

export class ClientPrediction {
  readonly playerId: PlayerId;
  private snapshot: AuthoritativeSnapshot<SimulationState> | null = null;
  private pending: CoreSimulationCommand[] = [];
  private lastPredicted: SimulationState | null = null;

  constructor(playerId: PlayerId) {
    this.playerId = playerId;
  }

  reset(): void {
    this.snapshot = null;
    this.pending = [];
    this.lastPredicted = null;
  }

  record(command: CoreSimulationCommand): void {
    if (command.playerId !== this.playerId) return;
    if (this.pending.some((entry) => entry.seq === command.seq)) return;
    this.pending.push(structuredClone(command));
    this.pending.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
  }

  acceptSnapshot(snapshot: AuthoritativeSnapshot<SimulationState>, predictThroughTick?: number): ReconciliationResult {
    const before = this.lastPredicted ? localEntity(this.lastPredicted, this.playerId) : null;
    const ackSeq = snapshot.ackSeqByPlayer[this.playerId] ?? -1;
    const previousCount = this.pending.length;
    this.pending = this.pending.filter((command) => command.seq > ackSeq);
    this.snapshot = structuredClone(snapshot);

    const targetTick = Math.max(snapshot.state.tick - 1, predictThroughTick ?? snapshot.serverTick);
    const predicted = this.predictThrough(targetTick);
    const after = predicted ? localEntity(predicted, this.playerId) : null;
    const correctionDistance = before && after
      ? Math.hypot(after.x - before.x, after.y - before.y)
      : 0;

    return {
      ackSeq,
      droppedCommands: previousCount - this.pending.length,
      pendingCommands: this.pending.length,
      correctionDistance,
    };
  }

  predictThrough(targetTick: number): SimulationState | null {
    if (!this.snapshot) return null;
    const state = cloneState(this.snapshot.state);
    const maxTick = Math.max(state.tick - 1, Math.trunc(targetTick));

    while (state.tick <= maxTick && state.winner === null) {
      const commands = this.pending.filter((command) => command.tick === state.tick);
      stepOwnedPrediction(state, this.playerId, commands);
    }

    this.lastPredicted = state;
    return cloneState(state);
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get pendingCommands(): readonly CoreSimulationCommand[] {
    return this.pending;
  }
}
