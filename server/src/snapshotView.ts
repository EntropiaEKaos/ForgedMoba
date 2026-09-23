import type { AuthoritativeSnapshot, PlayerId } from '../../src/shared/protocol.ts';
import {
  createClientViewState,
  hashSimulationState,
  type SimulationState,
} from '../../src/simulation/index.ts';

export function createPlayerSnapshot(
  snapshot: AuthoritativeSnapshot<SimulationState>,
  playerId: PlayerId,
): AuthoritativeSnapshot<SimulationState> {
  const state = createClientViewState(snapshot.state, playerId);
  return {
    matchId: snapshot.matchId,
    contentVersion: snapshot.contentVersion,
    serverTick: snapshot.serverTick,
    ackSeqByPlayer: {
      [playerId]: snapshot.ackSeqByPlayer[playerId] ?? -1,
    },
    stateHash: hashSimulationState(state),
    state,
  };
}
