import type { SimulationState } from './types.ts';

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Canonicaliza somente dados autoritativos e ordena entidades/players.
 * O hash é usado para detectar o primeiro tick de divergência.
 */
export function hashSimulationState(state: SimulationState): string {
  const entityIds = Object.keys(state.entities)
    .map(Number)
    .sort((a, b) => a - b);
  const entities = entityIds.map((id) => state.entities[String(id)]);
  const seq = Object.entries(state.lastAcceptedSeq).sort(([a], [b]) => a.localeCompare(b));

  return fnv1a32(JSON.stringify({
    version: state.version,
    tick: state.tick,
    seed: state.seed,
    rngState: state.rngState,
    width: state.width,
    height: state.height,
    nextEntityId: state.nextEntityId,
    entities,
    score: state.score,
    lastAcceptedSeq: seq,
  }));
}
