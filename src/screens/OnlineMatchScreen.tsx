import { conn, useConnection } from '../network/connection';
import type { SimEntity, SimulationState } from '../simulation/types';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent';
import { PixiBattlefield } from '../visual/PixiBattlefield.tsx';

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
      <PixiBattlefield localPlayerId={user?.id} />
      <div className="absolute top-3 left-3 z-10 bg-[#09131a]/90 border-2 border-[#28434d] px-3 py-2 font-mono text-xs min-w-64">
        <div className="font-pixel text-[9px] text-[#e8c860] mb-2">FORGED MOBA · AUTHORITATIVE ONLINE</div>
        <div>
          {match.mode === 'duel1v1' ? 'DUEL 1V1' : match.mode === 'skirmish3v3' ? 'SKIRMISH 3V3' : 'RANKED 5V5'}
          {' · '}match {match.matchId.slice(0, 8)}
        </div>
        <div>team {match.team} · slot {match.slot}</div>
        <div>
          objectives {authoritativeSnapshot?.state.objectiveScore?.[0] ?? 0}
          {' : '}
          {authoritativeSnapshot?.state.objectiveScore?.[1] ?? 0}
        </div>
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
        RMB mover · LMB atacar · Q habilidade · 4/V ward · S parar · ESC sair
      </div>

      <div className="absolute bottom-3 right-3 z-10 w-64 bg-[#09131a]/95 border-2 border-[#5b4a23] p-3 text-xs">
        <div className="font-pixel text-[8px] text-[#e8c860] mb-2">LOJA AUTORITATIVA · BASE</div>
        <div className="mb-2 text-[#b5c7cc]">
          Ouro: <b className="text-[#ffe080]">{localSnapshotEntity?.gold ?? '—'}</b>
          {' · '}slots {localSnapshotEntity?.inventory.length ?? 0}/{CURRENT_AUTHORITATIVE_CONTENT.payload.rules.maxInventorySlots}
          <br />
          Ward: {localSnapshotEntity?.wardCooldownRemaining
            ? Math.ceil(localSnapshotEntity.wardCooldownRemaining / 30) + 's'
            : 'pronta'}
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
