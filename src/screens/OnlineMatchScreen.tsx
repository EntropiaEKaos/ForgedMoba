import { useEffect, useRef } from 'react';
import { conn, useConnection } from '../network/connection';
import type { SimEntity, SimulationState } from '../simulation/types';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent';

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
    matchResult,
    user,
    authoritativeSnapshot,
    networkMetrics,
    pendingInputs,
    networkError,
    disconnectedPlayers,
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
      if (conn.matchResult) return;
      const world = screenToWorld(event.clientX, event.clientY);
      conn.sendMove(world.x, world.y);
    };

    const onClick = (event: MouseEvent) => {
      if (conn.matchResult) return;
      const world = screenToWorld(event.clientX, event.clientY);
      const targetId = nearestEnemyId(world.x, world.y);
      if (targetId !== null) conn.sendAttack(targetId);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (conn.matchResult) conn.clearMatch();
        else conn.leaveMatch();
        return;
      }
      if (conn.matchResult) return;
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

  const localSnapshotEntity = localEntity(
    conn.predictedState ?? authoritativeSnapshot?.state ?? null,
    user?.id,
  );
  const publishedItems = CURRENT_AUTHORITATIVE_CONTENT.payload.items;

  const disconnectedEntries = Object.entries(disconnectedPlayers)
    .map(([playerId, deadline]) => ({
      playerId,
      secondsLeft: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  return (
    <div className="fixed inset-0 bg-[#07110f] text-[#d8e4e8] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
      <div className="absolute top-3 left-3 z-10 bg-[#09131a]/90 border-2 border-[#28434d] px-3 py-2 font-mono text-xs min-w-64">
        <div className="font-pixel text-[9px] text-[#e8c860] mb-2">FORGED MOBA · AUTHORITATIVE ONLINE</div>
        <div>
          {match.mode === 'duel1v1' ? 'DUEL 1V1' : match.mode === 'skirmish3v3' ? 'SKIRMISH 3V3' : 'RANKED 5V5'}
          {' · '}match {match.matchId.slice(0, 8)}
        </div>
        <div>team {match.team} · slot {match.slot}</div>
        <div>tick {authoritativeSnapshot?.serverTick ?? '—'} · {match.serverTickRate} Hz · snapshots ~10 Hz</div>
        <div>RTT {networkMetrics.rttMs === null ? '—' : networkMetrics.rttMs.toFixed(1)} ms · jitter {networkMetrics.jitterMs.toFixed(1)} ms</div>
        <div>correction {networkMetrics.correctionDistance.toFixed(2)} · pending {pendingInputs}</div>
        <div>snapshot interval {networkMetrics.snapshotIntervalMs === null ? '—' : networkMetrics.snapshotIntervalMs.toFixed(1)} ms</div>
        <div>reconnect grace {Math.round(match.reconnectGraceMs / 1000)}s</div>
        <div className="text-[#71909d] mt-1 break-all">content {match.contentVersion}</div>
        {networkError && <div className="text-[#ff8585] mt-1">network: {networkError}</div>}
        {disconnectedEntries.map((entry) => (
          <div key={entry.playerId} className="text-[#ffbf66] mt-1">
            reconnect {entry.playerId.slice(0, 8)} · {entry.secondsLeft}s
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-[#09131a]/90 border border-[#28434d] px-4 py-2 text-xs">
        RMB mover · LMB atacar · Q habilidade autoritativa · S parar · ESC sair
      </div>

      <div className="absolute bottom-3 right-3 z-10 w-64 bg-[#09131a]/95 border-2 border-[#5b4a23] p-3 text-xs">
        <div className="font-pixel text-[8px] text-[#e8c860] mb-2">LOJA AUTORITATIVA · BASE</div>
        <div className="mb-2 text-[#b5c7cc]">
          Ouro: <b className="text-[#ffe080]">{localSnapshotEntity?.gold ?? '—'}</b>
          {' · '}slots {localSnapshotEntity?.inventory.length ?? 0}/{CURRENT_AUTHORITATIVE_CONTENT.payload.rules.maxInventorySlots}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {publishedItems.map((item) => (
            <button
              key={item.id}
              disabled={
                Boolean(matchResult) ||
                !localSnapshotEntity ||
                localSnapshotEntity.gold < item.cost ||
                localSnapshotEntity.inventory.length >= CURRENT_AUTHORITATIVE_CONTENT.payload.rules.maxInventorySlots
              }
              onClick={() => conn.sendBuy(item.id)}
              className="border border-[#5b4a23] bg-[#211c12] px-2 py-2 text-left disabled:opacity-35 hover:bg-[#342a17]"
            >
              <span className="block text-[#e6d9b5]">{item.name}</span>
              <span className="text-[#e8c860]">{item.cost}g</span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-[#718994] break-words">
          {localSnapshotEntity?.inventory.length ? 'Inventário: ' + localSnapshotEntity.inventory.join(', ') : 'Inventário vazio'}
        </div>
      </div>

      <button
        onClick={() => matchResult ? conn.clearMatch() : conn.leaveMatch()}
        className="absolute top-3 right-3 z-10 bg-[#3b1717] border-2 border-[#7f3737] px-3 py-2 font-pixel text-[8px] text-[#ffb0a0]"
      >
        {matchResult ? 'VOLTAR AO LOBBY' : 'ABANDONAR PARTIDA'}
      </button>

      {matchResult && (
        <div className="absolute inset-0 z-20 bg-black/65 flex items-center justify-center">
          <div className="pixel-panel bg-[#0d151c] border-4 border-[#e8c860] p-8 text-center min-w-80">
            <div className="font-pixel text-[20px] text-[#e8c860] mb-3">
              {matchResult.winner === match.team ? 'VITÓRIA' : matchResult.winner === null ? 'PARTIDA ENCERRADA' : 'DERROTA'}
            </div>
            <div className="text-[#9ab0b8] mb-5">
              Resultado confirmado pelo servidor autoritativo.
            </div>
            <button
              onClick={() => conn.clearMatch()}
              className="font-pixel text-[9px] px-6 py-3 bg-[#294d3b] border-2 border-[#4f8d68] text-[#c8ffe0]"
            >
              VOLTAR AO LOBBY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
