import { motion } from 'motion/react';
import { conn, useConnection } from '../network/connection';
import { PixiBattlefield } from '../visual/PixiBattlefield.tsx';
import { CinematicHud } from '../visual/CinematicHud.tsx';
import { ScoreboardOverlay } from '../visual/ScoreboardOverlay.tsx';
import { PremiumGameHud } from '../visual/PremiumGameHud.tsx';

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

  const state = conn.predictedState ?? authoritativeSnapshot?.state ?? null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07110f] text-[#d8e4e8]">
      <PixiBattlefield localPlayerId={user?.id} />

      <PremiumGameHud
        state={state}
        localPlayerId={user?.id}
        localTeam={match.team}
        mode={match.mode}
        serverTickRate={match.serverTickRate}
        matchId={match.matchId}
        networkMetrics={networkMetrics}
        pendingInputs={pendingInputs}
        networkError={networkError}
        disconnectedPlayers={disconnectedPlayers}
        matchResult={matchResult}
      />

      <ScoreboardOverlay
        state={state}
        localPlayerId={user?.id}
      />

      <CinematicHud
        matchId={match.matchId}
        mode={match.mode}
        localPlayerId={user?.id}
        localTeam={match.team}
        state={state}
        result={matchResult}
        serverTickRate={match.serverTickRate}
        onReturn={() => conn.clearMatch()}
      />

      <motion.button
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => matchResult ? conn.clearMatch() : conn.leaveMatch()}
        className="pointer-events-auto absolute right-3 top-3 z-40 border border-[#7c3838] bg-[#260d0d]/92 px-3 py-2 font-pixel text-[8px] text-[#ff9d94] opacity-70 transition hover:opacity-100"
      >
        {matchResult ? 'VOLTAR AO LOBBY' : 'SAIR'}
      </motion.button>
    </div>
  );
}
