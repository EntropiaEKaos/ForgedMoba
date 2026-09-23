import type { CoreSimulationCommand } from '../../shared/protocol.ts';

export const COMBAT_REPRO_FIXTURE: Readonly<Record<number, readonly CoreSimulationCommand[]>> = {
  0: [
    { type: 'move', playerId: 'blue-1', seq: 1, tick: 0, x: 1030, y: 1000 },
    { type: 'move', playerId: 'red-1', seq: 1, tick: 0, x: 1070, y: 1000 },
  ],
  12: [
    { type: 'cast', playerId: 'blue-1', seq: 2, tick: 12, slot: 'Q', targetId: 2 },
  ],
  20: [
    { type: 'cast', playerId: 'red-1', seq: 2, tick: 20, slot: 'Q', x: 900, y: 1000 },
  ],
  90: [
    { type: 'attack', playerId: 'blue-1', seq: 3, tick: 90, targetId: 2 },
  ],
};

export function combatFixtureCommands(tick: number): readonly CoreSimulationCommand[] {
  return COMBAT_REPRO_FIXTURE[tick] ?? [];
}
