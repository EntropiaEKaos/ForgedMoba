import type { SimulationState } from '../simulation/types.ts';
import {
  captureVisualProbe,
  deriveCombatFx,
  type CombatFxEvent,
  type VisualStateProbe,
} from './fxModel.ts';

export type VisualEventListener = (event: CombatFxEvent) => void;

export class VisualEventBus {
  private previous: VisualStateProbe | null = null;
  private readonly listeners = new Set<VisualEventListener>();

  subscribe(listener: VisualEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.previous = null;
  }

  observe(state: SimulationState): CombatFxEvent[] {
    const current = captureVisualProbe(state);
    if (this.previous && current.tick < this.previous.tick) this.previous = null;
    const events = deriveCombatFx(this.previous, current);
    this.previous = current;
    for (const event of events) {
      for (const listener of this.listeners) listener(event);
    }
    return events;
  }
}
