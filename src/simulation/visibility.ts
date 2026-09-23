import { isPositionVisibleToTeam } from './core.ts';
import type { PlayerId } from '../shared/protocol.ts';
import type { SimEntity, SimTeam, SimulationState } from './types.ts';

function playerEntity(state: SimulationState, playerId: PlayerId): SimEntity | null {
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId && entity.kind === 'hero')
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

function visibleToTeam(state: SimulationState, team: SimTeam, entity: SimEntity): boolean {
  if (entity.kind === 'ward' && entity.team !== team) return false;
  if (!entity.neutral && entity.team === team) return true;
  return isPositionVisibleToTeam(state, team, entity);
}

export function createClientViewState(
  state: SimulationState,
  playerId: PlayerId,
): SimulationState {
  const owner = playerEntity(state, playerId);
  if (!owner) throw new Error('player has no authoritative hero: ' + playerId);

  const entities: Record<string, SimEntity> = {};
  for (const id of Object.keys(state.entities).map(Number).sort((a, b) => a - b)) {
    const entity = state.entities[String(id)];
    if (!visibleToTeam(state, owner.team, entity)) continue;
    entities[String(id)] = structuredClone(entity);
  }

  const ownAck = state.lastAcceptedSeq[playerId] ?? -1;
  return {
    version: state.version,
    contentVersion: state.contentVersion,
    tick: state.tick,
    seed: 0,
    rngState: 0,
    width: state.width,
    height: state.height,
    nextEntityId: 1_000_000_000 + state.tick * 100,
    entities,
    score: [...state.score] as [number, number],
    objectiveScore: [...state.objectiveScore] as [number, number],
    lastAcceptedSeq: { [playerId]: ownAck },
    laneEnabled: state.laneEnabled,
    jungleEnabled: state.jungleEnabled,
    nextWaveTick: state.nextWaveTick,
    waveNumber: state.waveNumber,
    winner: state.winner,
  };
}
