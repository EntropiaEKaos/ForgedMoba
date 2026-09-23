import { useEffect, useRef } from 'react';
import { conn, useConnection } from '../network/connection';
import type { SimEntity, SimulationState } from '../simulation/types';

function localEntity(state: SimulationState | null, playerId: string | undefined): SimEntity | null {
  if (!state || !playerId) return null;
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

export function OnlineMatchScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    match,
    user,
    authoritativeSnapshot,
    networkMetrics,
    pendingInputs,
    networkError,
  } = useConnection();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !match) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let pointerWorld = { x: 1500, y: 1500 };

    const fit = () => {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const screenToWorld = (clientX: number, clientY: number) => {
      const width = conn.authoritativeSnapshot?.state.width ?? 3000;
      const height = conn.authoritativeSnapshot?.state.height ?? 3000;
      return {
        x: Math.max(0, Math.min(width, clientX / window.innerWidth * width)),
        y: Math.max(0, Math.min(height, clientY / window.innerHeight * height)),
      };
    };

    const nearestEnemyId = (worldX: number, worldY: number): number | null => {
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state;
      if (!state) return null;
      const local = localEntity(state, user?.id);
      if (!local) return null;

      let best: { id: number; d2: number } | null = null;
      for (const entity of Object.values(state.entities)) {
        if (entity.dead || entity.team === local.team) continue;
        const dx = entity.x - worldX;
        const dy = entity.y - worldY;
        const d2 = dx * dx + dy * dy;
        const hit = Math.max(28, entity.radius + 18);
        if (d2 > hit * hit) continue;
        if (!best || d2 < best.d2 || (d2 === best.d2 && entity.id < best.id)) best = { id: entity.id, d2 };
      }
      return best?.id ?? null;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerWorld = screenToWorld(event.clientX, event.clientY);
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const world = screenToWorld(event.clientX, event.clientY);
      conn.sendMove(world.x, world.y);
    };

    const onClick = (event: MouseEvent) => {
      const world = screenToWorld(event.clientX, event.clientY);
      const targetId = nearestEnemyId(world.x, world.y);
      if (targetId !== null) conn.sendAttack(targetId);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 's' || event.key === 'S') conn.sendStop();
      if (event.key === 'q' || event.key === 'Q') {
        const state = conn.predictedState ?? conn.authoritativeSnapshot?.state;
        const local = localEntity(state ?? null, user?.id);
        if (!local) return;
        if (local.heroId === 'gareth') {
          const targetId = nearestEnemyId(pointerWorld.x, pointerWorld.y);
          if (targetId !== null) conn.sendCastQ({ targetId });
        } else {
          conn.sendCastQ({ x: pointerWorld.x, y: pointerWorld.y });
        }
      }
      if (event.key === 'Escape') {
        conn.clearMatch();
      }
    };

    const drawHealth = (x: number, y: number, hp: number, maxHp: number, width: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x - width / 2, y, width, 5);
      ctx.fillStyle = '#d8e4e8';
      ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, hp / Math.max(1, maxHp))), 5);
    };

    const frame = () => {
      const state = conn.predictedState ?? conn.authoritativeSnapshot?.state ?? null;
      const interpolated = conn.getInterpolatedFrame();
      const width = state?.width ?? 3000;
      const height = state?.height ?? 3000;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = vw / width;
      const sy = vh / height;

      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = '#07110f';
      ctx.fillRect(0, 0, vw, vh);

      const laneY = height * 0.5 * sy;
      ctx.fillStyle = '#18241d';
      ctx.fillRect(0, laneY - 38, vw, 76);
      ctx.fillStyle = '#315044';
      ctx.fillRect(0, laneY - 2, vw, 4);

      const remoteById = new Map(interpolated?.entities.map((entity) => [entity.id, entity]) ?? []);
      const local = localEntity(state, user?.id);
      const entityIds = state ? Object.keys(state.entities).map(Number).sort((a, b) => a - b) : [];

      for (const id of entityIds) {
        const authoritative = state?.entities[String(id)];
        if (!authoritative) continue;
        const isLocal = authoritative.ownerPlayerId === user?.id;
        const remote = !isLocal ? remoteById.get(id) : undefined;
        const x = (remote?.x ?? authoritative.x) * sx;
        const y = (remote?.y ?? authoritative.y) * sy;
        const hp = remote?.hp ?? authoritative.hp;
        const maxHp = remote?.maxHp ?? authoritative.maxHp;
        const dead = remote?.dead ?? authoritative.dead;
        if (dead) continue;

        const radius = Math.max(4, authoritative.radius * Math.min(sx, sy) * 2.4);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (authoritative.kind === 'tower') ctx.fillStyle = authoritative.team === 0 ? '#4aa8ff' : '#ff5f5f';
        else if (authoritative.kind === 'minion') ctx.fillStyle = authoritative.team === 0 ? '#5c86b0' : '#ad6969';
        else if (isLocal) ctx.fillStyle = '#e8c860';
        else ctx.fillStyle = authoritative.team === 0 ? '#65c0ff' : '#ff8080';
        ctx.fill();

        if (isLocal) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        drawHealth(x, y + radius + 5, hp, maxHp, Math.max(22, radius * 2.3));

        if (authoritative.kind === 'hero') {
          ctx.fillStyle = '#d8e4e8';
          ctx.font = '11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(authoritative.heroId ?? 'hero', x, y - radius - 8);
        }
      }

      if (local?.moveTarget) {
        ctx.strokeStyle = 'rgba(232,200,96,0.55)';
        ctx.beginPath();
        ctx.moveTo(local.x * sx, local.y * sy);
        ctx.lineTo(local.moveTarget.x * sx, local.moveTarget.y * sy);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [match?.matchId, user?.id]);

  if (!match) return null;

  return (
    <div className="fixed inset-0 bg-[#07110f] text-[#d8e4e8] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
      <div className="absolute top-3 left-3 z-10 bg-[#09131a]/90 border-2 border-[#28434d] px-3 py-2 font-mono text-xs min-w-64">
        <div className="font-pixel text-[9px] text-[#e8c860] mb-2">FORGED MOBA · AUTHORITATIVE ONLINE</div>
        <div>{match.mode === 'duel1v1' ? 'DUEL 1V1' : 'RANKED 5V5'} · match {match.matchId.slice(0, 8)}</div>
        <div>team {match.team} · slot {match.slot}</div>
        <div>tick {authoritativeSnapshot?.serverTick ?? '—'} · {match.serverTickRate} Hz · snapshots ~10 Hz</div>
        <div>RTT {networkMetrics.rttMs === null ? '—' : networkMetrics.rttMs.toFixed(1)} ms · jitter {networkMetrics.jitterMs.toFixed(1)} ms</div>
        <div>correction {networkMetrics.correctionDistance.toFixed(2)} · pending {pendingInputs}</div>
        <div>snapshot interval {networkMetrics.snapshotIntervalMs === null ? '—' : networkMetrics.snapshotIntervalMs.toFixed(1)} ms</div>
        <div className="text-[#71909d] mt-1 break-all">content {match.contentVersion}</div>
        {networkError && <div className="text-[#ff8585] mt-1">network: {networkError}</div>}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-[#09131a]/90 border border-[#28434d] px-4 py-2 text-xs">
        RMB mover · LMB atacar · Q habilidade autoritativa · S parar · ESC sair
      </div>

      <button
        onClick={() => conn.clearMatch()}
        className="absolute top-3 right-3 z-10 bg-[#3b1717] border-2 border-[#7f3737] px-3 py-2 font-pixel text-[8px] text-[#ffb0a0]"
      >
        SAIR DO SLICE
      </button>
    </div>
  );
}
