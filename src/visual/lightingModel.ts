import type { SimulationState } from '../simulation/types.ts';
import type { VisualQuality } from './quality.ts';
import { VISUAL_QUALITY } from './quality.ts';

export interface BattlefieldLight {
  key: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  priority: number;
  pulseHz: number;
}

export function deriveBattlefieldLights(
  state: SimulationState,
  localPlayerId: string | undefined,
  quality: VisualQuality,
): BattlefieldLight[] {
  const budget = VISUAL_QUALITY[quality].dynamicLights;
  if (budget <= 0) return [];

  const lights: BattlefieldLight[] = [];
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.dead) continue;
    const local = entity.ownerPlayerId === localPlayerId;

    if (entity.kind === 'objective') {
      lights.push({
        key: 'objective:' + entity.id,
        x: entity.x,
        y: entity.y,
        radius: Math.max(145, entity.radius * 5.2),
        color: 0xb967ff,
        intensity: quality === 'ultra' ? 0.34 : 0.25,
        priority: 100,
        pulseHz: 0.85,
      });
      continue;
    }

    if (entity.kind === 'hero') {
      lights.push({
        key: 'hero:' + entity.id,
        x: entity.x,
        y: entity.y,
        radius: Math.max(70, entity.radius * (local ? 3.7 : 3.1)),
        color: local ? 0xffdc73 : entity.team === 0 ? 0x4ecbff : 0xff6565,
        intensity: local ? 0.24 : 0.16,
        priority: local ? 95 : 75,
        pulseHz: local ? 1.25 : 0.65,
      });
      continue;
    }

    if (entity.kind === 'tower') {
      lights.push({
        key: 'tower:' + entity.id,
        x: entity.x,
        y: entity.y - entity.radius * 0.5,
        radius: Math.max(95, entity.radius * 3.8),
        color: entity.team === 0 ? 0x46c7ff : 0xff5d5d,
        intensity: 0.2,
        priority: 85,
        pulseHz: 0.38,
      });
      continue;
    }

    if (entity.kind === 'ward') {
      lights.push({
        key: 'ward:' + entity.id,
        x: entity.x,
        y: entity.y,
        radius: Math.max(58, entity.radius * 5),
        color: entity.team === 0 ? 0x6de5ff : 0xff7ca0,
        intensity: 0.18,
        priority: 70,
        pulseHz: 1.6,
      });
      continue;
    }

    if (entity.kind === 'monster') {
      lights.push({
        key: 'monster:' + entity.id,
        x: entity.x,
        y: entity.y,
        radius: Math.max(72, entity.radius * 3.2),
        color: 0xe1a855,
        intensity: 0.11,
        priority: 55,
        pulseHz: 0.45,
      });
    }
  }

  return lights
    .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))
    .slice(0, budget);
}

export function lightPulse(light: BattlefieldLight, elapsedSeconds: number): number {
  return 0.86 + (Math.sin(elapsedSeconds * Math.PI * 2 * light.pulseHz) + 1) * 0.07;
}
