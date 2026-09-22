import type { SimulationState } from './types.ts';

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function hashSimulationState(state: SimulationState): string {
  const entityIds = Object.keys(state.entities).map(Number).sort((a, b) => a - b);
  const entities = entityIds.map((id) => state.entities[String(id)]);
  const seq = Object.entries(state.lastAcceptedSeq).sort(([a], [b]) => compareText(a, b));
  return fnv1a32(JSON.stringify({
    version: state.version,
    contentVersion: state.contentVersion,
    tick: state.tick,
    seed: state.seed,
    rngState: state.rngState,
    width: state.width,
    height: state.height,
    nextEntityId: state.nextEntityId,
    entities,
    score: state.score,
    lastAcceptedSeq: seq,
    laneEnabled: state.laneEnabled,
    nextWaveTick: state.nextWaveTick,
    waveNumber: state.waveNumber,
    winner: state.winner,
  }));
}
