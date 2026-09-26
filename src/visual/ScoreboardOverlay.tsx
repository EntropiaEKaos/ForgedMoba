import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { SimulationState } from '../simulation/types.ts';

export function ScoreboardOverlay({
  state,
  localPlayerId,
}: {
  state: SimulationState | null;
  localPlayerId?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      setOpen(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const teams = useMemo(() => {
    const heroes = state
      ? Object.values(state.entities)
          .filter((entity) => entity.kind === 'hero')
          .sort((a, b) => a.id - b.id)
      : [];
    return {
      blue: heroes.filter((entity) => entity.team === 0),
      red: heroes.filter((entity) => entity.team === 1),
    };
  }, [state]);

  return (
    <AnimatePresence>
      {open && state && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.16 }}
            className="w-[min(980px,92vw)] border-2 border-[#3d5662] bg-[#081117]/96 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.5)]"
          >
            <div className="mb-4 grid grid-cols-3 items-center">
              <div className="font-pixel text-[12px] text-[#79cfff]">
                AZUL · {state.score[0]}
              </div>
              <div className="text-center font-pixel text-[9px] tracking-[0.2em] text-[#80949c]">
                PLACAR AUTORITATIVO
              </div>
              <div className="text-right font-pixel text-[12px] text-[#ff9090]">
                {state.score[1]} · VERMELHO
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {([
                ['blue', teams.blue],
                ['red', teams.red],
              ] as const).map(([team, heroes]) => (
                <div key={team} className="space-y-1.5">
                  {heroes.map((hero) => {
                    const local = hero.ownerPlayerId === localPlayerId;
                    const hpPct = Math.round(hero.hp / Math.max(1, hero.maxHp) * 100);
                    return (
                      <motion.div
                        layout
                        key={hero.id}
                        className={
                          'grid grid-cols-[1fr_54px_54px_54px_58px] items-center gap-2 border px-3 py-2 text-xs ' +
                          (local
                            ? 'border-[#e8c860] bg-[#2a2516]'
                            : team === 'blue'
                              ? 'border-[#24475a] bg-[#0c1921]'
                              : 'border-[#5a2b2b] bg-[#1b0e0e]')
                        }
                      >
                        <div>
                          <div className="text-[#dce8ec]">
                            {hero.heroId ?? 'hero'}{local ? ' · VOCÊ' : ''}
                          </div>
                          <div className="text-[10px] text-[#617983]">
                            {hero.ownerPlayerId?.slice(0, 8) ?? 'bot'}
                          </div>
                        </div>
                        <div className="text-center text-[#c7d6db]">Lv {hero.level}</div>
                        <div className="text-center text-[#e8c860]">{hero.gold}g</div>
                        <div className="text-center text-[#9fd6a8]">{hero.cs} CS</div>
                        <div className={'text-right ' + (hero.dead ? 'text-[#e46c6c]' : 'text-[#9fd6a8]')}>
                          {hero.dead ? 'MORTO' : hpPct + '%'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#23343c] pt-3 text-[10px] text-[#607781]">
              <span>Objetivos {state.objectiveScore[0]} : {state.objectiveScore[1]}</span>
              <span>Segure TAB para visualizar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
