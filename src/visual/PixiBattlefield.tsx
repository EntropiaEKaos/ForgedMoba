import { useEffect, useRef, useState } from 'react';
import { conn } from '../network/connection.ts';
import { authoritativeAbility } from '../shared/authoritativeContent.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';
import { CanvasFallbackBattlefield } from './CanvasFallbackBattlefield.tsx';
import { PixiBattlefieldRuntime } from './PixiBattlefieldRuntime.ts';
import {
  readVisualQuality,
  saveVisualQuality,
  type VisualQuality,
} from './quality.ts';
import { nearestAttackableEntityId } from './targeting.ts';

function localEntity(state: SimulationState | null, playerId: string | undefined): SimEntity | null {
  if (!state || !playerId) return null;
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

export function PixiBattlefield({ localPlayerId }: { localPlayerId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PixiBattlefieldRuntime | null>(null);
  const [quality, setQuality] = useState<VisualQuality>(() => readVisualQuality());
  const qualityRef = useRef(quality);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    qualityRef.current = quality;
    saveVisualQuality(quality);
    runtimeRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let raf = 0;
    let pointerWorld = { x: 1500, y: 1500 };
    const runtime = new PixiBattlefieldRuntime(canvas);
    runtimeRef.current = runtime;

    const resize = () => runtime.resize(window.innerWidth, window.innerHeight);

    const toWorld = (clientX: number, clientY: number) =>
      runtime.screenToWorld({ x: clientX, y: clientY });

    const pointerMove = (event: PointerEvent) => {
      pointerWorld = toWorld(event.clientX, event.clientY);
    };

    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (conn.matchResult) return;
      const world = toWorld(event.clientX, event.clientY);
      conn.sendMove(world.x, world.y);
    };

    const click = (event: MouseEvent) => {
      if (conn.matchResult) return;
      const world = toWorld(event.clientX, event.clientY);
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state ?? null;
      const targetId = nearestAttackableEntityId(state, localPlayerId, world.x, world.y);
      if (targetId !== null) conn.sendAttack(targetId);
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (conn.matchResult) conn.clearMatch();
        else conn.leaveMatch();
        return;
      }
      if (conn.matchResult) return;
      if (event.key === 's' || event.key === 'S') conn.sendStop();
      if (event.key === '4' || event.key === 'v' || event.key === 'V') {
        conn.sendPlaceWard(pointerWorld.x, pointerWorld.y);
      }
      const slot = event.key.toUpperCase();
      if (slot === 'Q' || slot === 'W' || slot === 'E' || slot === 'R') {
        const state = conn.predictedState ?? conn.authoritativeSnapshot?.state ?? null;
        const local = localEntity(state, localPlayerId);
        if (!local?.heroId) return;
        const ability = authoritativeAbility(local.heroId, slot);
        if (ability.runtime === 'self') {
          conn.sendCast(slot);
        } else if (ability.runtime === 'target') {
          if (ability.affectsAllies) {
            conn.sendCast(slot, { targetId: local.id });
            return;
          }
          const targetId = nearestAttackableEntityId(
            state,
            localPlayerId,
            pointerWorld.x,
            pointerWorld.y,
          );
          if (targetId !== null) conn.sendCast(slot, { targetId });
        } else {
          conn.sendCast(slot, { x: pointerWorld.x, y: pointerWorld.y });
        }
      }
    };

    const render = () => {
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state;
      if (state) {
        runtime.render({
          state,
          interpolated: conn.getInterpolatedFrame(),
          localPlayerId,
          quality: qualityRef.current,
        });
      }
      raf = requestAnimationFrame(render);
    };

    void runtime.init(qualityRef.current)
      .then(() => {
        if (cancelled) return;
        window.addEventListener('resize', resize);
        window.addEventListener('pointermove', pointerMove);
        canvas.addEventListener('contextmenu', contextMenu);
        canvas.addEventListener('click', click);
        window.addEventListener('keydown', key);
        resize();
        raf = requestAnimationFrame(render);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'PixiJS initialization failed';
        setFallbackReason(message);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('contextmenu', contextMenu);
      canvas.removeEventListener('click', click);
      window.removeEventListener('keydown', key);
      runtime.destroy();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [localPlayerId]);

  if (fallbackReason) {
    return (
      <>
        <CanvasFallbackBattlefield localPlayerId={localPlayerId} />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#2d1717]/95 border border-[#8c4a4a] px-3 py-2 text-[10px] text-[#ffd0c8]">
          WebGL indisponível · Canvas fallback ativo
        </div>
      </>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" data-renderer="pixi-webgl" />
      <label className="absolute top-3 right-40 z-20 bg-[#09131a]/90 border border-[#28434d] px-2 py-1 text-[10px] text-[#b8cdd3]">
        Visual
        <select
          value={quality}
          onChange={(event) => setQuality(event.target.value as VisualQuality)}
          className="ml-2 bg-[#0d1d26] border border-[#31505c] px-1 py-1 text-[#e8d8b0]"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="ultra">Ultra</option>
        </select>
      </label>
    </>
  );
}
