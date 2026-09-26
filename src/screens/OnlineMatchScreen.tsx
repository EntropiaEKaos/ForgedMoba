import { motion } from 'motion/react';
import { conn, useConnection } from '../network/connection';
import type { SimEntity, SimulationState } from '../simulation/types';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent';
import { PixiBattlefield } from '../visual/PixiBattlefield.tsx';
import { CinematicHud } from '../visual/CinematicHud.tsx';

function localEntity(state: SimulationState | null, playerId: string | undefined): SimEntity | null {
  if (!state || !playerId) return null;
  return Object.values(state.entities)
    .filter((entity) => entity.ownerPlayerId === playerId)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

export function OnlineMatchScreen() {
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
      <CinematicHud
        matchId={match.matchId}
        mode={match.mode}
        localPlayerId={user?.id}
        localTeam={match.team}
        state={conn.predictedState ?? authoritativeSnapshot?.state ?? null}
        result={matchResult}
        serverTickRate={match.serverTickRate}
        onReturn={() => conn.clearMatch()}
      />
      <motion.div
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute top-3 left-3 z-10 bg-[#09131a]/90 border-2 border-[#28434d] px-3 py-2 font-mono text-xs min-w-64 backdrop-blur-sm"
      >
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
          <motion.div
            key={entry.playerId}
            className="text-[#ffbf66] mt-1"
            animate={{ opacity: [1, 0.45, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          >
            reconnect {entry.playerId.slice(0, 8)} · {entry.secondsLeft}s
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
      >
        <div className="flex gap-2">
          <div className="relative min-w-20 border-2 border-[#335a6d] bg-[#0b1820]/95 px-3 py-2 text-center">
            <div className="font-pixel text-[8px] text-[#7fcff0]">Q</div>
            <div className="mt-1 text-[10px] text-[#cdeaf5]">
              {(localSnapshotEntity?.abilityCooldowns.Q ?? 0) > 0
                ? Math.ceil((localSnapshotEntity?.abilityCooldowns.Q ?? 0) / match.serverTickRate) + 's'
                : 'PRONTA'}
            </div>
            {(localSnapshotEntity?.abilityCooldowns.Q ?? 0) > 0 && (
              <motion.div
                className="absolute inset-x-0 bottom-0 h-1 bg-[#5aaed2]"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{
                  duration: Math.max(0.1, (localSnapshotEntity?.abilityCooldowns.Q ?? 0) / match.serverTickRate),
                  ease: 'linear',
                }}
                style={{ transformOrigin: 'left' }}
              />
            )}
          </div>
          <div className="relative min-w-20 border-2 border-[#5a4f2d] bg-[#19150c]/95 px-3 py-2 text-center">
            <div className="font-pixel text-[8px] text-[#e8c860]">WARD · 4/V</div>
            <div className="mt-1 text-[10px] text-[#f3e4aa]">
              {(localSnapshotEntity?.wardCooldownRemaining ?? 0) > 0
                ? Math.ceil((localSnapshotEntity?.wardCooldownRemaining ?? 0) / match.serverTickRate) + 's'
                : 'PRONTA'}
            </div>
          </div>
        </div>
        <div className="bg-[#09131a]/90 border border-[#28434d] px-4 py-2 text-xs backdrop-blur-sm">
          RMB mover · LMB atacar · Q habilidade · 4/V ward · S parar · ESC sair
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="absolute bottom-3 right-3 z-10 w-64 bg-[#09131a]/95 border-2 border-[#5b4a23] p-3 text-xs backdrop-blur-sm"
      >
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
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => matchResult ? conn.clearMatch() : conn.leaveMatch()}
        className="absolute top-3 right-3 z-10 bg-[#3b1717] border-2 border-[#7f3737] px-3 py-2 font-pixel text-[8px] text-[#ffb0a0]"
      >
        {matchResult ? 'VOLTAR AO LOBBY' : 'ABANDONAR PARTIDA'}
      </motion.button>
    </div>
  );
}
