import type { SimulationState } from '../simulation/types.ts';

export function nearestAttackableEntityId(
  state: SimulationState | null,
  localPlayerId: string | undefined,
  worldX: number,
  worldY: number,
  hitPadding = 18,
): number | null {
  if (!state || !localPlayerId) return null;
  const local = Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === localPlayerId)
    .sort((a, b) => a.id - b.id)[0];
  if (!local || local.dead) return null;

  let best: { id: number; distanceSq: number } | null = null;
  for (const entity of Object.values(state.entities)) {
    if (
      entity.dead ||
      entity.kind === 'ward' ||
      (!entity.neutral && entity.team === local.team)
    ) continue;
    const dx = entity.x - worldX;
    const dy = entity.y - worldY;
    const distanceSq = dx * dx + dy * dy;
    const hit = Math.max(28, entity.radius + hitPadding);
    if (distanceSq > hit * hit) continue;
    if (
      !best ||
      distanceSq < best.distanceSq ||
      (distanceSq === best.distanceSq && entity.id < best.id)
    ) {
      best = { id: entity.id, distanceSq };
    }
  }
  return best?.id ?? null;
}
