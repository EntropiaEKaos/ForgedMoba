import type { CoreSimulationCommand } from '../shared/protocol.ts';
import { createSimulation, stepSimulation } from './core.ts';
import { hashSimulationState } from './hash.ts';
import type { CreateSimulationOptions } from './types.ts';

export interface DeterminismProbeResult {
  ok: boolean;
  ticks: number;
  hashA: string;
  hashB: string;
  firstDivergentTick: number | null;
}

export function runDeterminismProbe(
  options: CreateSimulationOptions,
  ticks: number,
  commandsAtTick: (tick: number) => readonly CoreSimulationCommand[],
): DeterminismProbeResult {
  const a = createSimulation(options);
  const b = createSimulation(options);
  for (let tick = 0; tick < ticks; tick += 1) {
    const commands = commandsAtTick(tick);
    stepSimulation(a, commands);
    stepSimulation(b, commands);
    const hashA = hashSimulationState(a);
    const hashB = hashSimulationState(b);
    if (hashA !== hashB) return { ok: false, ticks: tick + 1, hashA, hashB, firstDivergentTick: tick };
  }
  return { ok: true, ticks, hashA: hashSimulationState(a), hashB: hashSimulationState(b), firstDivergentTick: null };
}
