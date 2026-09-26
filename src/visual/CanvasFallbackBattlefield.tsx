import { useEffect, useRef } from 'react';
import { conn } from '../network/connection.ts';
import { authoritativeAbility } from '../shared/authoritativeContent.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';
import { nearestAttackableEntityId } from './targeting.ts';

function localEntity(state: SimulationState | null, playerId: string | undefined): SimEntity | null {
  if (!state || !playerId) return null;
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

export function CanvasFallbackBattlefield({ localPlayerId }: { localPlayerId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let pointer = { x: 1500, y: 1500 };

    const fit = () => {
      const dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1));
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const toWorld = (clientX: number, clientY: number) => {
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state;
      return {
        x: Math.max(0, Math.min(state?.width ?? 3000, clientX / window.innerWidth * (state?.width ?? 3000))),
        y: Math.max(0, Math.min(state?.height ?? 3000, clientY / window.innerHeight * (state?.height ?? 3000))),
      };
    };

    const move = (event: PointerEvent) => { pointer = toWorld(event.clientX, event.clientY); };
    const context = (event: MouseEvent) => {
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
      if (event.key === '4' || event.key === 'v' || event.key === 'V') conn.sendPlaceWard(pointer.x, pointer.y);
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
          const targetId = nearestAttackableEntityId(state, localPlayerId, pointer.x, pointer.y);
          if (targetId !== null) conn.sendCast(slot, { targetId });
        } else {
          conn.sendCast(slot, { x: pointer.x, y: pointer.y });
        }
      }
    };

    const draw = () => {
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state ?? null;
      const remote = new Map(conn.getInterpolatedFrame()?.entities.map((entity) => [entity.id, entity]) ?? []);
      const width = state?.width ?? 3000;
      const height = state?.height ?? 3000;
      const sx = window.innerWidth / width;
      const sy = window.innerHeight / height;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = '#07110f';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = '#18241d';
      ctx.fillRect(0, height * 0.5 * sy - 38, window.innerWidth, 76);

      if (state) {
        for (const id of Object.keys(state.entities).map(Number).sort((a,b)=>a-b)) {
          const entity = state.entities[String(id)];
          if (!entity || entity.dead) continue;
          const isLocal = entity.ownerPlayerId === localPlayerId;
          const lerped = isLocal ? undefined : remote.get(id);
          const x = (lerped?.x ?? entity.x) * sx;
          const y = (lerped?.y ?? entity.y) * sy;
          const radius = Math.max(4, entity.radius * Math.min(sx, sy) * 2.2);
          const color =
            entity.kind === 'objective' ? '#b06cff' :
            entity.kind === 'monster' ? '#8b6f47' :
            entity.kind === 'ward' ? (entity.team === 0 ? '#6ad5ff' : '#ff8aa8') :
            isLocal ? '#e8c860' :
            entity.team === 0 ? '#65c0ff' : '#ff8080';
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('pointermove', move);
    canvas.addEventListener('contextmenu', context);
    canvas.addEventListener('click', click);
    window.addEventListener('keydown', key);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', move);
      canvas.removeEventListener('contextmenu', context);
      canvas.removeEventListener('click', click);
      window.removeEventListener('keydown', key);
    };
  }, [localPlayerId]);

  return <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" data-renderer="canvas-fallback" />;
}
