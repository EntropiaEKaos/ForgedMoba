import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { NetworkMetricsSnapshot } from '../network/telemetry.ts';
import type { MatchMode } from '../shared/protocol.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent.ts';
import { conn } from '../network/connection.ts';
import { CinematicObserver, type CinematicEvent } from './cinematicModel.ts';

interface PremiumGameHudProps {
  state: SimulationState | null;
  localPlayerId?: string;
  localTeam: 0 | 1;
  mode: MatchMode;
  serverTickRate: number;
  matchId: string;
  networkMetrics: NetworkMetricsSnapshot;
  pendingInputs: number;
  networkError: string | null;
  disconnectedPlayers: Record<string, number>;
  matchResult: { winner: 0 | 1 | null } | null;
}

const portraitStyle = (heroId: string | null): CSSProperties => ({
  backgroundImage: heroId
    ? `url(/assets/art/v2/heroes/${heroId}-sheet.svg)`
    : undefined,
  backgroundRepeat: 'no-repeat',
  backgroundSize: '400% 100%',
  backgroundPosition: '0% 50%',
});

function heroEntities(state: SimulationState | null): SimEntity[] {
  if (!state) return [];
  return Object.values(state.entities)
    .filter((entity) => entity.kind === 'hero')
    .sort((a, b) => a.team - b.team || a.id - b.id);
}

function hpPercent(entity: SimEntity | null): number {
  if (!entity) return 0;
  return Math.max(0, Math.min(100, entity.hp / Math.max(1, entity.maxHp) * 100));
}

function cooldownSeconds(ticks: number, tickRate: number): number {
  return Math.max(0, Math.ceil(ticks / Math.max(1, tickRate)));
}

function HeroFrame({
  hero,
  side,
  local,
}: {
  hero: SimEntity;
  side: 'left' | 'right';
  local: boolean;
}) {
  const hp = hpPercent(hero);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: side === 'left' ? -18 : 18 }}
      animate={{ opacity: hero.dead ? 0.52 : 1, x: 0 }}
      className={
        'relative flex h-12 w-40 items-center overflow-hidden border bg-[#071016]/92 shadow-lg backdrop-blur-sm ' +
        (local
          ? 'border-[#f1cf6b] shadow-[0_0_22px_rgba(241,207,107,.18)]'
          : hero.team === 0
            ? 'border-[#2e7594]'
            : 'border-[#8d3d3d]')
      }
    >
      {side === 'right' && (
        <div className="absolute inset-y-0 left-0 z-0 bg-[#7d2525]/20" style={{ width: hp + '%' }} />
      )}
      {side === 'left' && (
        <div className="absolute inset-y-0 right-0 z-0 bg-[#246684]/20" style={{ width: hp + '%' }} />
      )}

      <div
        className="z-10 h-12 w-12 shrink-0 bg-[#101b23] bg-cover"
        style={portraitStyle(hero.heroId)}
      />
      <div className="z-10 min-w-0 flex-1 px-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-pixel text-[8px] text-[#e8edf0]">
            {(hero.heroId ?? 'hero').toUpperCase()}
          </span>
          <span className="text-[10px] text-[#98aab0]">Lv {hero.level}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden bg-black/70">
          <motion.div
            className={hero.team === 0 ? 'h-full bg-[#55bfff]' : 'h-full bg-[#ff6969]'}
            animate={{ width: hp + '%' }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-[#738891]">
          <span>{hero.cs} CS</span>
          <span>{hero.gold}g</span>
        </div>
      </div>
      {hero.dead && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/45 font-pixel text-[8px] text-[#ff8b84]">
          CAÍDO
        </div>
      )}
    </motion.div>
  );
}

function AbilitySlot({
  keyLabel,
  title,
  active,
  cooldown,
  accent,
  locked = false,
}: {
  keyLabel: string;
  title: string;
  active: boolean;
  cooldown: number;
  accent: string;
  locked?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.025 }}
      className="relative h-[74px] w-[74px] overflow-hidden border-2 bg-[#0a1117]/96 shadow-[0_12px_30px_rgba(0,0,0,.4)]"
      style={{ borderColor: accent }}
    >
      <div className="absolute inset-1 border border-white/5 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.16),transparent_40%),linear-gradient(145deg,rgba(255,255,255,.04),rgba(0,0,0,.45))]" />
      <div className="absolute left-2 top-1 z-10 font-pixel text-[10px]" style={{ color: accent }}>
        {keyLabel}
      </div>
      <div className="absolute inset-x-1 bottom-1 z-10 text-center text-[8px] uppercase tracking-[.12em] text-[#9fb1b7]">
        {title}
      </div>
      {locked ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/72">
          <span className="font-pixel text-[8px] tracking-[.14em] text-[#69767b]">BLOQ.</span>
        </div>
      ) : !active ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/66">
          <span className="font-pixel text-[16px] text-white">{cooldown}s</span>
        </div>
      ) : (
        null
      )}
      {active && !locked && (
        <motion.div
          className="absolute inset-0 opacity-45"
          animate={{ boxShadow: [`inset 0 0 12px ${accent}`, `inset 0 0 28px ${accent}`, `inset 0 0 12px ${accent}`] }}
          transition={{ duration: 1.7, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

function MiniMap({
  state,
  localPlayerId,
}: {
  state: SimulationState | null;
  localPlayerId?: string;
}) {
  if (!state) return null;
  const entities = Object.values(state.entities)
    .filter((entity) => !entity.dead && entity.kind !== 'ward')
    .sort((a, b) => a.id - b.id);

  return (
    <div className="relative h-52 w-52 overflow-hidden border-2 border-[#435b63] bg-[#0a1715] shadow-[0_10px_45px_rgba(0,0,0,.48)]">
      <img
        src="/assets/art/v2/terrain/rift-map.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-fill opacity-80"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,.36))]" />
      {entities.map((entity) => {
        const x = entity.x / Math.max(1, state.width) * 100;
        const y = entity.y / Math.max(1, state.height) * 100;
        const isLocal = entity.ownerPlayerId === localPlayerId;
        const size =
          entity.kind === 'hero' ? 7 :
          entity.kind === 'tower' ? 5 :
          entity.kind === 'objective' ? 6 :
          entity.kind === 'monster' ? 3 :
          2;
        const color =
          entity.kind === 'objective' ? '#d783ff' :
          entity.kind === 'monster' ? '#d6aa64' :
          entity.team === 0 ? '#55c7ff' : '#ff6f6f';
        return (
          <motion.div
            key={entity.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/70"
            animate={isLocal ? { scale: [1, 1.8, 1] } : undefined}
            transition={isLocal ? { duration: 1.1, repeat: Infinity } : undefined}
            style={{
              left: x + '%',
              top: y + '%',
              width: size,
              height: size,
              background: isLocal ? '#ffe477' : color,
              boxShadow: isLocal ? '0 0 10px #ffe477' : undefined,
            }}
          />
        );
      })}
      <div className="absolute left-2 top-2 font-pixel text-[7px] tracking-[.2em] text-white/60">RIFT</div>
    </div>
  );
}

function feedLabel(event: CinematicEvent, localTeam: 0 | 1): { text: string; good: boolean } {
  const allied = 'team' in event ? event.team === localTeam : true;
  if (event.type === 'ace') return { text: allied ? 'ACE aliado' : 'ACE inimigo', good: allied };
  if (event.type === 'objective-kill') return { text: allied ? 'Objetivo conquistado' : 'Objetivo perdido', good: allied };
  if (event.type === 'tower-destroyed') return { text: allied ? 'Torre inimiga destruída' : 'Torre aliada destruída', good: allied };
  if (event.type === 'hero-kill') return { text: allied ? 'Abate aliado' : 'Baixa aliada', good: allied };
  if (event.type === 'level-up') return { text: 'Nível ' + event.level, good: true };
  return { text: 'Retorno à batalha', good: true };
}

export function PremiumGameHud({
  state,
  localPlayerId,
  localTeam,
  mode,
  serverTickRate,
  matchId,
  networkMetrics,
  pendingInputs,
  networkError,
  disconnectedPlayers,
  matchResult,
}: PremiumGameHudProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const observerRef = useRef(new CinematicObserver());
  const [feed, setFeed] = useState<Array<{ key: string; event: CinematicEvent }>>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'b' || event.key === 'B') setShopOpen((value) => !value);
      if (event.key === 'F8') {
        event.preventDefault();
        setDebugOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    observerRef.current.reset();
    setFeed([]);
  }, [matchId]);

  useEffect(() => {
    if (!state) return;
    const events = observerRef.current.observe(state)
      .filter((event) =>
        event.type === 'hero-kill' ||
        event.type === 'objective-kill' ||
        event.type === 'tower-destroyed' ||
        event.type === 'ace'
      );
    if (events.length === 0) return;
    setFeed((current) => [
      ...events.map((event) => ({ key: event.key, event })),
      ...current,
    ].slice(0, 4));
  }, [state]);

  const heroes = useMemo(() => heroEntities(state), [state]);
  const blue = heroes.filter((hero) => hero.team === 0);
  const red = heroes.filter((hero) => hero.team === 1);
  const local = heroes.find((hero) => hero.ownerPlayerId === localPlayerId) ?? null;
  const qCd = cooldownSeconds(local?.abilityCooldowns.Q ?? 0, serverTickRate);
  const wardCd = cooldownSeconds(local?.wardCooldownRemaining ?? 0, serverTickRate);
  const inventorySlots = CURRENT_AUTHORITATIVE_CONTENT.payload.rules.maxInventorySlots;
  const items = CURRENT_AUTHORITATIVE_CONTENT.payload.items;
  const disconnectedEntries = Object.entries(disconnectedPlayers)
    .map(([playerId, deadline]) => ({
      playerId,
      secondsLeft: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute left-1/2 top-0 -translate-x-1/2">
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative min-w-[520px] border-x border-b border-[#46555c] bg-[#071016]/94 px-5 pb-3 pt-2 shadow-[0_15px_50px_rgba(0,0,0,.48)] backdrop-blur-md"
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#e3c264] to-transparent" />
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[18px] text-[#75d3ff]">{state?.score[0] ?? 0}</span>
              <span className="text-[10px] uppercase tracking-[.24em] text-[#75919b]">Azul</span>
            </div>
            <div className="text-center">
              <div className="font-pixel text-[9px] text-[#e6ca72]">
                {mode === 'duel1v1' ? 'DUEL' : mode === 'skirmish3v3' ? 'SKIRMISH' : 'RANKED 5V5'}
              </div>
              <div className="mt-1 text-[10px] tracking-[.18em] text-[#76909a]">
                OBJ {state?.objectiveScore[0] ?? 0} · {state?.objectiveScore[1] ?? 0}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[.24em] text-[#9a7777]">Vermelho</span>
              <span className="font-pixel text-[18px] text-[#ff8780]">{state?.score[1] ?? 0}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute left-1/2 top-20 -translate-x-1/2">
        <AnimatePresence initial={false}>
          {feed.map(({ key, event }) => {
            const label = feedLabel(event, localTeam);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: -12, scale: .96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className={
                  'mb-1 border px-3 py-1.5 text-center text-[10px] uppercase tracking-[.18em] backdrop-blur-sm ' +
                  (label.good
                    ? 'border-[#7c6830] bg-[#171207]/88 text-[#e7d181]'
                    : 'border-[#703636] bg-[#1b0a0a]/88 text-[#ff9b92]')
                }
              >
                {label.text}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="absolute left-3 top-16 flex flex-col gap-1.5">
        {blue.map((hero) => (
          <HeroFrame key={hero.id} hero={hero} side="left" local={hero.ownerPlayerId === localPlayerId} />
        ))}
      </div>
      <div className="absolute right-3 top-16 flex flex-col items-end gap-1.5">
        {red.map((hero) => (
          <HeroFrame key={hero.id} hero={hero} side="right" local={hero.ownerPlayerId === localPlayerId} />
        ))}
      </div>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 140, damping: 20 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
      >
        <div className="relative flex min-w-[760px] items-end justify-center gap-3 border-x border-t border-[#46545a] bg-[#071016]/96 px-5 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,.5)] backdrop-blur-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0bd58] to-transparent" />

          <div className="mr-3 flex items-end gap-3">
            <div className="relative h-24 w-24 overflow-hidden border-2 border-[#d5b65d] bg-[#0c1820] shadow-[0_0_30px_rgba(213,182,93,.16)]">
              <div className="absolute inset-0 bg-cover" style={portraitStyle(local?.heroId ?? null)} />
              <div className="absolute inset-x-0 bottom-0 bg-black/66 px-2 py-1 text-center font-pixel text-[8px] text-[#f5e4a6]">
                Lv {local?.level ?? 0}
              </div>
            </div>
            <div className="w-44 pb-1">
              <div className="flex justify-between text-[9px] uppercase tracking-[.12em] text-[#91a3aa]">
                <span>{(local?.heroId ?? 'hero').toUpperCase()}</span>
                <span>{local?.dead ? 'CAÍDO' : 'EM COMBATE'}</span>
              </div>
              <div className="mt-2 h-4 overflow-hidden border border-[#334952] bg-black/70">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#177f52] to-[#5bd291]"
                  animate={{ width: hpPercent(local) + '%' }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#9bb0b7]">
                <span>{Math.max(0, Math.round(local?.hp ?? 0))} / {Math.round(local?.maxHp ?? 0)} HP</span>
                <span>{local?.xp ?? 0} XP</span>
              </div>
              <div className="mt-2 flex gap-2 text-[10px]">
                <span className="text-[#e8c860]">{local?.gold ?? 0}g</span>
                <span className="text-[#a7bec6]">{local?.cs ?? 0} CS</span>
              </div>
            </div>
          </div>

          <AbilitySlot keyLabel="Q" title={local?.heroId === 'gareth' ? 'Golpe' : 'Luz'} active={qCd === 0} cooldown={qCd} accent="#61cfff" />
          <AbilitySlot keyLabel="W" title="Em breve" active={false} cooldown={0} accent="#4b5660" locked />
          <AbilitySlot keyLabel="E" title="Em breve" active={false} cooldown={0} accent="#4b5660" locked />
          <AbilitySlot keyLabel="R" title="Ultimate" active={false} cooldown={0} accent="#7a5a2a" locked />
          <AbilitySlot keyLabel="4" title="Ward" active={wardCd === 0} cooldown={wardCd} accent="#d3ba63" />

          <div className="ml-3 grid grid-cols-3 gap-1.5">
            {Array.from({ length: inventorySlots }, (_, index) => {
              const itemId = local?.inventory[index] ?? null;
              const item = itemId ? items.find((candidate) => candidate.id === itemId) : null;
              return (
                <div
                  key={index}
                  className="grid h-11 w-11 place-items-center border border-[#3e4d53] bg-[#0c1419]/94 text-center shadow-inner"
                  title={item?.name ?? 'slot vazio'}
                >
                  <span className="font-pixel text-[8px] text-[#e5d89c]">
                    {item ? item.name.slice(0, 2).toUpperCase() : '·'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-3 left-3">
        <MiniMap state={state} localPlayerId={localPlayerId} />
        <div className="mt-2 flex gap-2">
          <button
            className="pointer-events-auto border border-[#5d512e] bg-[#171309]/94 px-3 py-2 font-pixel text-[8px] text-[#e8c860] hover:bg-[#2b2410]"
            onClick={() => setShopOpen((value) => !value)}
          >
            LOJA [B]
          </button>
          <button
            className="pointer-events-auto border border-[#344852] bg-[#081217]/94 px-3 py-2 font-pixel text-[8px] text-[#789aa8] hover:bg-[#10212a]"
            onClick={() => setDebugOpen((value) => !value)}
          >
            REDE [F8]
          </button>
        </div>
      </div>

      <AnimatePresence>
        {shopOpen && (
          <motion.div
            initial={{ opacity: 0, x: -40, y: 25, scale: .97 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: .97 }}
            className="pointer-events-auto absolute bottom-64 left-3 w-[390px] border-2 border-[#6d5b2f] bg-[#0a0f13]/97 p-4 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-[9px] text-[#e8c860]">ARSENAL DA BASE</div>
                <div className="mt-1 text-[10px] text-[#71858d]">Servidor valida ouro, slots e alcance.</div>
              </div>
              <div className="font-pixel text-[14px] text-[#ffe48a]">{local?.gold ?? 0}g</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {items.map((item) => {
                const disabled =
                  Boolean(matchResult) ||
                  !local ||
                  local.gold < item.cost ||
                  local.inventory.length >= inventorySlots;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={disabled ? undefined : { scale: .98 }}
                    disabled={disabled}
                    onClick={() => conn.sendBuy(item.id)}
                    className="border border-[#51472a] bg-[linear-gradient(145deg,#1b1810,#0d1114)] p-3 text-left disabled:opacity-35"
                  >
                    <div className="font-pixel text-[8px] text-[#e5d89c]">{item.name}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-[#7c939b]">ITEM</span>
                      <span className="text-[#e8c860]">{item.cost}g</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {debugOpen && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute bottom-3 right-3 w-72 border border-[#31505c] bg-[#061017]/94 p-3 font-mono text-[10px] text-[#83a8b6] backdrop-blur-md"
          >
            <div className="mb-2 font-pixel text-[8px] text-[#70d5ff]">NETWORK / AUTHORITY</div>
            <div>match {matchId.slice(0, 8)} · tick {state?.tick ?? '—'}</div>
            <div>RTT {networkMetrics.rttMs === null ? '—' : networkMetrics.rttMs.toFixed(1)} ms</div>
            <div>jitter {networkMetrics.jitterMs.toFixed(1)} ms</div>
            <div>correction {networkMetrics.correctionDistance.toFixed(2)}</div>
            <div>pending {pendingInputs}</div>
            {networkError && <div className="mt-2 text-[#ff8b84]">{networkError}</div>}
            {disconnectedEntries.map((entry) => (
              <div key={entry.playerId} className="mt-1 text-[#ffc06e]">
                reconnect {entry.playerId.slice(0, 8)} · {entry.secondsLeft}s
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
