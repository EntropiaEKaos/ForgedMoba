import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchMode } from '../shared/protocol.ts';
import type { SimulationState } from '../simulation/types.ts';
import {
  CinematicObserver,
  eventDurationMs,
  type CinematicEvent,
} from './cinematicModel.ts';

interface MatchResult {
  winner: 0 | 1 | null;
}

interface CinematicHudProps {
  matchId: string;
  mode: MatchMode;
  localPlayerId?: string;
  localTeam: 0 | 1;
  state: SimulationState | null;
  result: MatchResult | null;
  serverTickRate: number;
  onReturn: () => void;
}

function eventText(event: CinematicEvent, localTeam: 0 | 1): { eyebrow: string; title: string; tone: 'good' | 'bad' | 'neutral' } {
  const allied = 'team' in event ? event.team === localTeam : true;

  if (event.type === 'ace') {
    return {
      eyebrow: allied ? 'DOMÍNIO TOTAL' : 'TIME ELIMINADO',
      title: allied ? 'ACE' : 'ACE INIMIGO',
      tone: allied ? 'good' : 'bad',
    };
  }
  if (event.type === 'objective-kill') {
    return {
      eyebrow: 'OBJETIVO ÉPICO',
      title: allied ? 'SENTINELA CONQUISTADO' : 'OBJETIVO PERDIDO',
      tone: allied ? 'good' : 'bad',
    };
  }
  if (event.type === 'tower-destroyed') {
    return {
      eyebrow: 'ESTRUTURA',
      title: allied ? 'TORRE INIMIGA DESTRUÍDA' : 'TORRE ALIADA DESTRUÍDA',
      tone: allied ? 'good' : 'bad',
    };
  }
  if (event.type === 'hero-kill') {
    return {
      eyebrow: allied ? 'ABATE' : 'BAIXA',
      title: allied ? 'INIMIGO ELIMINADO' : 'ALIADO ELIMINADO',
      tone: allied ? 'good' : 'bad',
    };
  }
  if (event.type === 'level-up') {
    return {
      eyebrow: 'ASCENSÃO',
      title: 'NÍVEL ' + event.level,
      tone: 'good',
    };
  }
  return {
    eyebrow: 'RETORNO',
    title: 'DE VOLTA À BATALHA',
    tone: 'neutral',
  };
}

const toneClass = {
  good: 'border-[#d9b85a] text-[#ffe69b] shadow-[0_0_42px_rgba(232,200,96,0.28)]',
  bad: 'border-[#a74747] text-[#ffb1a7] shadow-[0_0_42px_rgba(226,87,77,0.24)]',
  neutral: 'border-[#4d8ba4] text-[#bcecff] shadow-[0_0_42px_rgba(90,190,220,0.2)]',
} as const;

export function CinematicHud({
  matchId,
  mode,
  localPlayerId,
  localTeam,
  state,
  result,
  serverTickRate,
  onReturn,
}: CinematicHudProps) {
  const observerRef = useRef(new CinematicObserver());
  const queueRef = useRef<CinematicEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeEvent, setActiveEvent] = useState<CinematicEvent | null>(null);
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    observerRef.current.reset();
    queueRef.current = [];
    setActiveEvent(null);
    setIntroVisible(true);
    const timeout = setTimeout(() => setIntroVisible(false), 2350);
    return () => clearTimeout(timeout);
  }, [matchId]);

  useEffect(() => {
    if (!state) return;
    const events = observerRef.current.observe(state)
      .filter((event) =>
        event.type !== 'level-up' && event.type !== 'respawn'
          ? true
          : event.ownerPlayerId === localPlayerId,
      );
    if (events.length === 0) return;
    queueRef.current.push(...events);
    if (!activeEvent) setActiveEvent(queueRef.current.shift() ?? null);
  }, [state, localPlayerId, activeEvent]);

  useEffect(() => {
    if (!activeEvent) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = queueRef.current.shift() ?? null;
      setActiveEvent(next);
    }, eventDurationMs(activeEvent));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [activeEvent]);

  const localHero = useMemo(() => {
    if (!state || !localPlayerId) return null;
    return Object.values(state.entities)
      .filter((entity) => entity.ownerPlayerId === localPlayerId)
      .sort((a, b) => a.id - b.id)[0] ?? null;
  }, [state, localPlayerId]);

  const respawnSeconds = localHero?.dead && localHero.respawnAtTick !== null && state
    ? Math.max(0, Math.ceil((localHero.respawnAtTick - state.tick) / Math.max(1, serverTickRate)))
    : null;

  const label =
    mode === 'duel1v1' ? 'DUEL 1V1' :
    mode === 'skirmish3v3' ? 'SKIRMISH 3V3' :
    'RANKED 5V5';

  const banner = activeEvent ? eventText(activeEvent, localTeam) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {introVisible && !result && (
          <motion.div
            key="intro"
            className="absolute inset-0 flex items-center justify-center bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 1.18, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -24 }}
              transition={{ type: 'spring', stiffness: 130, damping: 18 }}
              className="text-center"
            >
              <motion.div
                initial={{ letterSpacing: '0.15em', opacity: 0 }}
                animate={{ letterSpacing: '0.55em', opacity: 1 }}
                className="font-pixel text-[10px] text-[#8fb4c1]"
              >
                FORGED MOBA
              </motion.div>
              <div className="mt-4 font-pixel text-[28px] text-[#f0d36d] drop-shadow-[0_0_24px_rgba(240,211,109,0.5)]">
                {label}
              </div>
              <div className="mt-3 text-sm tracking-[0.3em] text-[#b7c8ce]">
                EQUIPE {localTeam === 0 ? 'AZUL' : 'VERMELHA'}
              </div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.25, duration: 0.8 }}
                className="mx-auto mt-5 h-[2px] w-72 bg-gradient-to-r from-transparent via-[#e8c860] to-transparent"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {banner && !result && (
          <motion.div
            key={activeEvent?.key}
            className="absolute top-[9%] left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: -34, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 210, damping: 19 }}
          >
            <div
              className={'relative min-w-72 overflow-hidden border-y bg-[linear-gradient(90deg,transparent,rgba(7,16,21,.94)_14%,rgba(7,16,21,.94)_86%,transparent)] px-9 py-3 text-center backdrop-blur-md ' + toneClass[banner.tone]}
              style={{ clipPath: 'polygon(5% 0,95% 0,100% 50%,95% 100%,5% 100%,0 50%)' }}
            >
              <motion.div
                className="absolute inset-y-0 -left-12 w-10 rotate-12 bg-white/12 blur-md"
                animate={{ x: [0, 420] }}
                transition={{ duration: 1.2 }}
              />
              <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              <div className="font-pixel text-[7px] tracking-[0.34em] opacity-65">{banner.eyebrow}</div>
              <div className="mt-1.5 font-pixel text-[12px] drop-shadow-[0_0_16px_rgba(255,255,255,.16)]">{banner.title}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {respawnSeconds !== null && !result && (
          <motion.div
            key="death"
            className="absolute inset-0 flex items-center justify-center bg-[#090507]/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="font-pixel text-[11px] text-[#d47c78]">VOCÊ CAIU</div>
              <motion.div
                key={respawnSeconds}
                initial={{ scale: 1.25, opacity: 0.35 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-3 font-pixel text-[42px] text-[#f0e1d7]"
              >
                {respawnSeconds}
              </motion.div>
              <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#9d9292]">respawn</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/78 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.72, y: 44 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
              className={
                'relative min-w-[360px] overflow-hidden border-4 bg-[#09131a] px-12 py-10 text-center ' +
                (result.winner === localTeam
                  ? 'border-[#d5b95e] shadow-[0_0_90px_rgba(232,200,96,0.3)]'
                  : 'border-[#8c3d3d] shadow-[0_0_90px_rgba(176,58,58,0.26)]')
              }
            >
              <motion.div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.9 }}
              />
              <div className="font-pixel text-[9px] tracking-[0.3em] text-[#8198a0]">RESULTADO AUTORITATIVO</div>
              <motion.div
                initial={{ letterSpacing: '0.05em' }}
                animate={{ letterSpacing: '0.16em' }}
                transition={{ duration: 0.8 }}
                className={
                  'mt-4 font-pixel text-[30px] ' +
                  (result.winner === localTeam
                    ? 'text-[#f1d76f]'
                    : result.winner === null
                      ? 'text-[#d8e4e8]'
                      : 'text-[#f08b82]')
                }
              >
                {result.winner === localTeam ? 'VITÓRIA' : result.winner === null ? 'PARTIDA ENCERRADA' : 'DERROTA'}
              </motion.div>
              <div className="mx-auto mt-5 h-px w-64 bg-gradient-to-r from-transparent via-[#52707c] to-transparent" />
              <div className="mt-5 text-sm text-[#8fa3aa]">
                {label} · servidor confirmou o resultado
              </div>
              <button
                onClick={onReturn}
                className="mt-7 border-2 border-[#4f8d68] bg-[#173525] px-7 py-3 font-pixel text-[9px] text-[#c8ffe0] hover:bg-[#214a34]"
              >
                VOLTAR AO LOBBY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
