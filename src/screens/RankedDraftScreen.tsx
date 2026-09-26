import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { conn, useConnection } from '../network/connection';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent';
import type { DraftPlayerSnapshot, RankedRole } from '../shared/protocol';

const ROLE_LABEL: Record<RankedRole, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  carry: 'CARRY',
  support: 'SUPPORT',
};

function heroLabel(heroId: string | null): string {
  if (!heroId) return '—';
  return heroId === 'gareth' ? 'Gareth' : heroId === 'luxana' ? 'Luxana' : heroId;
}

function PlayerRow({ player, isLocal }: { player: DraftPlayerSnapshot; isLocal: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: isLocal ? -14 : 14 }}
      animate={{ opacity: 1, x: 0 }}
      className={
        'grid grid-cols-[72px_1fr_80px_54px] items-center gap-2 border px-2 py-2 text-xs ' +
        (isLocal ? 'border-[#e8c860] bg-[#272214]' : 'border-[#263943] bg-[#0d171e]')
      }
    >
      <span className="font-pixel text-[8px] text-[#74c6e5]">{ROLE_LABEL[player.role]}</span>
      <span className={player.connected ? 'text-[#d8e4e8]' : 'text-[#7e8588]'}>
        {player.username}{isLocal ? ' · VOCÊ' : ''}
      </span>
      <span className={player.heroId ? 'text-[#e8c860]' : 'text-[#687d86]'}>
        {heroLabel(player.heroId)}
      </span>
      <span className={player.ready ? 'text-[#72e19f]' : player.connected ? 'text-[#e2a95c]' : 'text-[#e46c6c]'}>
        {player.ready ? 'READY' : player.connected ? 'PICK' : 'OFF'}
      </span>
    </motion.div>
  );
}

export function RankedDraftScreen() {
  const { draft, user, networkError } = useConnection();
  const [, setClock] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setClock((value) => value + 1), 250);
    return () => clearInterval(interval);
  }, []);

  const local = useMemo(
    () => draft?.players.find((player) => player.playerId === user?.id) ?? null,
    [draft, user?.id],
  );

  if (!draft) return null;

  const secondsLeft = Math.max(0, Math.ceil((draft.deadlineAt - Date.now()) / 1000));
  const team0 = draft.players.filter((player) => player.team === 0);
  const team1 = draft.players.filter((player) => player.team === 1);
  const readyCount = draft.players.filter((player) => player.ready && player.connected).length;
  const heroes = CURRENT_AUTHORITATIVE_CONTENT.payload.heroes;

  return (
    <motion.div
      className="min-h-screen bg-[#07110f] text-[#d8e4e8] p-5 overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="pixel-panel bg-[#0c151d] border-[#476572] p-5 mb-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-pixel text-[12px] text-[#e8c860]">RANKED 5V5 · DRAFT AUTORITATIVO</div>
              <div className="text-sm text-[#829aa4] mt-2">
                Sala {draft.draftId.slice(0, 8)} · conteúdo {draft.contentVersion}
              </div>
            </div>
            <div className="text-right">
              <div className="font-pixel text-[12px] text-[#75dca1]">{readyCount}/10 READY</div>
              <div className={secondsLeft <= 20 ? 'text-[#ff8e76] mt-1' : 'text-[#8aa0a8] mt-1'}>
                Deadline: {secondsLeft}s
              </div>
            </div>
          </div>
          {networkError && <div className="mt-3 text-[#ff8e76] text-sm">network: {networkError}</div>}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-5">
          <section className="pixel-panel bg-[#101820] p-4 border-[#315875]">
            <h2 className="font-pixel text-[10px] text-[#7ec8ff] mb-3">EQUIPE AZUL</h2>
            <div className="space-y-2">
              {team0.map((player) => (
                <PlayerRow key={player.playerId} player={player} isLocal={player.playerId === user?.id} />
              ))}
            </div>
          </section>

          <section className="pixel-panel bg-[#101820] p-4 border-[#753b3b]">
            <h2 className="font-pixel text-[10px] text-[#ff9292] mb-3">EQUIPE VERMELHA</h2>
            <div className="space-y-2">
              {team1.map((player) => (
                <PlayerRow key={player.playerId} player={player} isLocal={player.playerId === user?.id} />
              ))}
            </div>
          </section>
        </div>

        <section className="pixel-panel bg-[#0c151d] p-5 mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-pixel text-[10px] text-[#e8c860]">SEU PICK · {local ? ROLE_LABEL[local.role] : '—'}</h2>
              <p className="text-sm text-[#829aa4] mt-1">
                O servidor valida o herói contra o content pack ativo. Pick fica bloqueado enquanto READY.
              </p>
            </div>
            <div className="text-xs text-[#6f858e]">
              Catálogo autoritativo atual: {heroes.length} heróis
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {heroes.map((hero) => {
              const selected = local?.heroId === hero.id;
              return (
                <motion.button
                  key={hero.id}
                  whileHover={{ y: -4, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  disabled={!local || local.ready || draft.status !== 'draft'}
                  onClick={() => conn.pickDraftHero(hero.id)}
                  className={
                    'border-2 p-4 text-left transition-all disabled:opacity-50 ' +
                    (selected
                      ? 'border-[#e8c860] bg-[#2b2515]'
                      : 'border-[#2b4652] bg-[#101c24] hover:border-[#5c8ea3]')
                  }
                >
                  <div className="font-pixel text-[10px] text-[#e8d7a4]">{heroLabel(hero.id)}</div>
                  <div className="text-xs text-[#8398a0] mt-2">
                    HP {hero.maxHp} · AD {hero.attackDamage} · Q {hero.q.runtime}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              disabled={!local?.heroId || draft.status !== 'draft'}
              onClick={() => conn.setDraftReady(!local?.ready)}
              className={
                'font-pixel text-[9px] px-6 py-3 border-2 disabled:opacity-40 ' +
                (local?.ready
                  ? 'bg-[#52311d] border-[#9a5d30] text-[#ffd0a0]'
                  : 'bg-[#245237] border-[#3c8a59] text-[#c0ffd8]')
              }
            >
              {local?.ready ? 'DESBLOQUEAR PICK' : 'CONFIRMAR · READY'}
            </button>
            <button
              onClick={() => conn.leaveDraft()}
              className="font-pixel text-[9px] px-5 py-3 bg-[#4d2020] border-2 border-[#823838] text-[#ffb0a0]"
            >
              SAIR DO DRAFT
            </button>
          </div>

          <div className="mt-4 text-xs text-[#647982]">
            Nesta fase o catálogo online autoritativo ainda contém Gareth e Luxana; picks duplicados são permitidos até a expansão do conteúdo pós-core.
          </div>
        </section>
      </div>

      <AnimatePresence>
        {(readyCount === 10 || draft.status === 'ready' || draft.status === 'launched') && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 36 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="text-center"
            >
              <div className="font-pixel text-[9px] tracking-[0.35em] text-[#7e9eaa]">DRAFT CONCLUÍDO</div>
              <div className="mt-4 font-pixel text-[24px] text-[#e8c860]">FORMANDO PARTIDA</div>
              <motion.div
                className="mx-auto mt-5 h-1 w-72 overflow-hidden bg-[#15242c]"
              >
                <motion.div
                  className="h-full w-1/3 bg-[#5ad0c0]"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
              <div className="mt-4 text-sm text-[#879aa2]">sincronizando jogadores e conteúdo autoritativo</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
