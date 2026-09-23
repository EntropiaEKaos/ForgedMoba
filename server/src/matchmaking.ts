import type { MatchMode } from '../../src/shared/protocol.ts';

export interface MatchmakingEntry {
  userId: string;
  username: string;
  socketId: string;
}

export interface MatchmakingJoinResult {
  joined: boolean;
  position: number;
  requiredPlayers: number;
  mode: MatchMode;
}

const REQUIRED: Record<MatchMode, number> = {
  duel1v1: 2,
  ranked5v5: 10,
};

export class MatchmakingQueues {
  private readonly queues: Record<MatchMode, MatchmakingEntry[]> = {
    duel1v1: [],
    ranked5v5: [],
  };

  join(entry: MatchmakingEntry, mode: MatchMode): MatchmakingJoinResult {
    const existing = this.findBySocket(entry.socketId);
    if (existing) {
      return {
        joined: false,
        position: existing.position,
        requiredPlayers: REQUIRED[existing.mode],
        mode: existing.mode,
      };
    }
    const queue = this.queues[mode];
    queue.push({ ...entry });
    return {
      joined: true,
      position: queue.length,
      requiredPlayers: REQUIRED[mode],
      mode,
    };
  }

  leaveBySocket(socketId: string): boolean {
    let removed = false;
    for (const mode of ['duel1v1', 'ranked5v5'] as const) {
      const queue = this.queues[mode];
      const index = queue.findIndex((entry) => entry.socketId === socketId);
      if (index >= 0) {
        queue.splice(index, 1);
        removed = true;
      }
    }
    return removed;
  }

  takeReady(mode: MatchMode): MatchmakingEntry[] | null {
    const queue = this.queues[mode];
    const required = REQUIRED[mode];
    if (queue.length < required) return null;
    return queue.splice(0, required);
  }

  size(mode: MatchMode): number {
    return this.queues[mode].length;
  }

  requiredPlayers(mode: MatchMode): number {
    return REQUIRED[mode];
  }

  private findBySocket(socketId: string): { mode: MatchMode; position: number } | null {
    for (const mode of ['duel1v1', 'ranked5v5'] as const) {
      const position = this.queues[mode].findIndex((entry) => entry.socketId === socketId);
      if (position >= 0) return { mode, position: position + 1 };
    }
    return null;
  }
}
