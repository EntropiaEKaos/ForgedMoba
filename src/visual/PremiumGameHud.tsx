import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { NetworkMetricsSnapshot } from '../network/telemetry.ts';
import type { MatchMode } from '../shared/protocol.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';
import {
  CURRENT_AUTHORITATIVE_CONTENT,
  authoritativeHero,
  type AuthoritativeAbilityContent,
  type AuthoritativeItemContent,
  type AuthoritativeVisualTag,
} from '../shared/authoritativeContent.ts';
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

const portraitStyle = (heroId: string | null): CSSProperties => {
  if (!heroId) return {};
  if (heroId === 'gareth' || heroId === 'luxana') return {
    backgroundImage: `url(/assets/art/v2/heroes/${heroId}-sheet.svg)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '400% 100%',
    backgroundPosition: '0% 50%',
  };
  const hero = authoritativeHero(heroId);
  return {
    background: `radial-gradient(circle at 50% 30%, ${hero.visual.secondary} 0 18%, transparent 19%), linear-gradient(135deg, ${hero.visual.accent}, ${hero.visual.primary} 48%, #071016 49%)`,
  };
};

const modeLabel = (mode: MatchMode) =>
  mode === 'duel1v1' ? 'DUEL' : mode === 'skirmish3v3' ? 'SKIRMISH 3V3' : 'RANKED 5V5';

const TAG_COLORS: Record<AuthoritativeVisualTag, [string, string]> = {
  blade: ['#f1d9a1', '#805228'], fire: ['#ffd06a', '#a92f19'], frost: ['#d9f6ff', '#327aa2'],
  arcane: ['#efc9ff', '#6541a4'], nature: ['#c9f39d', '#397544'], shadow: ['#dcadff', '#2b153f'],
  light: ['#fff4af', '#b77c20'], tech: ['#9df5ff', '#315f78'],
};

function svgData(primary: string, secondary: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></radialGradient></defs><rect width="96" height="96" rx="16" fill="#071016"/><path d="M48 7 82 27 76 70 48 89 20 70 14 27Z" fill="url(#g)" stroke="${primary}" stroke-width="3"/><circle cx="48" cy="48" r="22" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="3"/><text x="48" y="58" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="28" fill="#fff">${glyph}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function abilityIcon(ability: AuthoritativeAbilityContent): string {
  if (ability.slot === 'Q' && (ability.key === 'decisive' || ability.key === 'lightbinding')) {
    return `/assets/ui/v2/abilities/${ability.key === 'decisive' ? 'gareth-q' : 'luxana-q'}.svg`;
  }
  const [primary, secondary] = TAG_COLORS[ability.visualTag];
  return svgData(primary, secondary, ability.slot);
}

function itemIcon(item: AuthoritativeItemContent): string {
  if (['longsword', 'ruby', 'boots', 'pickaxe'].includes(item.id)) return '/assets/ui/v2/items/' + item.id + '.svg';
  const glyph = item.stats.attackDamage ? '⚔' : item.stats.abilityPower ? '✦' : item.stats.armor || item.stats.magicResist ? '◆' : item.stats.moveSpeedPerTick ? '➤' : '◈';
  const primary = item.tier === 3 ? '#ffe278' : item.tier === 2 ? '#91d9ff' : '#c5d0d4';
  return svgData(primary, item.tier === 3 ? '#6e3b20' : '#273e4b', glyph);
}

function itemPrice(item: AuthoritativeItemContent, inventory: readonly string[], catalog: readonly AuthoritativeItemContent[]): number {
  const available = [...inventory];
  let price = item.cost;
  for (const componentId of item.recipe) {
    const index = available.indexOf(componentId);
    if (index < 0) continue;
    price -= catalog.find((candidate) => candidate.id === componentId)?.cost ?? 0;
    available[index] = '__used__';
  }
  return Math.max(0, price);
}

function heroesOf(state: SimulationState | null): SimEntity[] {
  if (!state) return [];
  return Object.values(state.entities)
    .filter((entity) => entity.kind === 'hero')
    .sort((a, b) => a.team - b.team || a.id - b.id);
}

function hpPct(entity: SimEntity | null): number {
  if (!entity) return 0;
  return Math.max(0, Math.min(100, entity.hp / Math.max(1, entity.maxHp) * 100));
}

function cdSeconds(ticks: number, rate: number): number {
  return Math.max(0, Math.ceil(ticks / Math.max(1, rate)));
}

function TeamPortrait({ hero, local }: { hero: SimEntity; local: boolean }) {
  const hp = hpPct(hero);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: .88 }}
      animate={{ opacity: hero.dead ? .48 : 1, scale: local ? 1.06 : 1 }}
      className={
        'relative h-[50px] w-[50px] overflow-hidden border bg-[#071016]/95 shadow-[0_8px_28px_rgba(0,0,0,.55)] ' +
        (local ? 'border-[#f3d26f]' : hero.team === 0 ? 'border-[#397fa0]' : 'border-[#9a4646]')
      }
      style={{ clipPath: 'polygon(14% 0,86% 0,100% 14%,100% 86%,86% 100%,14% 100%,0 86%,0 14%)' }}
    >
      <div className="absolute inset-0 bg-cover" style={portraitStyle(hero.heroId)} />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-black/80">
        <motion.div
          className={hero.team === 0 ? 'h-full bg-[#5acbff]' : 'h-full bg-[#ff6f6f]'}
          animate={{ width: hp + '%' }}
        />
      </div>
      <div className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[8px] text-white">{hero.level}</div>
      {hero.dead && <div className="absolute inset-0 grid place-items-center bg-black/55 font-pixel text-[7px] text-[#ff8d84]">KO</div>}
    </motion.div>
  );
}

function Ability({
  keyLabel,
  name,
  cooldown,
  accent,
  locked,
  iconSrc,
}: {
  keyLabel: string;
  name: string;
  cooldown: number;
  accent: string;
  locked?: boolean;
  iconSrc: string;
}) {
  const ready = cooldown <= 0 && !locked;
  return (
    <motion.div
      whileHover={locked ? undefined : { y: -6, scale: 1.035 }}
      className="relative h-[84px] w-[84px] overflow-hidden border-2 bg-[#071017]/98 shadow-[0_12px_34px_rgba(0,0,0,.58)]"
      style={{
        borderColor: locked ? '#313c41' : accent,
        clipPath: 'polygon(12% 0,88% 0,100% 12%,100% 88%,88% 100%,12% 100%,0 88%,0 12%)',
      }}
    >
      <div
        className="absolute inset-1 opacity-95"
        style={{
          background: locked
            ? 'linear-gradient(145deg,#11171a,#080b0d)'
            : `radial-gradient(circle at 38% 32%, ${accent}55, transparent 38%), linear-gradient(145deg,#17252d,#081015 64%)`,
        }}
      />
      <img
        src={iconSrc}
        alt=""
        className={'absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-cover transition ' + (locked ? 'opacity-45 grayscale' : 'opacity-95')}
      />
      <div className="absolute inset-1 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_45%,rgba(0,0,0,.22))]" />
      <div className="absolute left-2 top-1 z-10 rounded bg-black/55 px-1.5 py-0.5 font-pixel text-[9px]" style={{ color: locked ? '#667278' : accent }}>
        {keyLabel}
      </div>
      <div className="absolute inset-x-1 bottom-1 z-10 text-center text-[7px] uppercase tracking-[.16em] text-[#a7b5ba]">{name}</div>
      {locked && <div className="absolute inset-0 z-20 grid place-items-center bg-black/68"><span className="mt-6 font-pixel text-[7px] text-[#58656a]">LOCKED</span></div>}
      {!locked && cooldown > 0 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/66 backdrop-blur-[1px]">
          <span className="font-pixel text-[18px] text-white">{cooldown}</span>
        </div>
      )}
      {ready && (
        <>
          <motion.div
            className="absolute inset-0"
            animate={{ boxShadow: [`inset 0 0 8px ${accent}`, `inset 0 0 30px ${accent}`, `inset 0 0 8px ${accent}`] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          <motion.div
            className="absolute -left-12 top-0 h-full w-8 rotate-12 bg-white/15 blur-sm"
            animate={{ x: [0, 160] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }}
          />
        </>
      )}
    </motion.div>
  );
}

function MiniMap({ state, localPlayerId }: { state: SimulationState | null; localPlayerId?: string }) {
  if (!state) return null;
  const entities = Object.values(state.entities).filter((entity) => !entity.dead).sort((a, b) => a.id - b.id);
  return (
    <div className="relative h-[232px] w-[232px] overflow-hidden border-2 border-[#8a733a] bg-[#07120f] shadow-[0_18px_60px_rgba(0,0,0,.62)]"
      style={{ clipPath: 'polygon(7% 0,93% 0,100% 7%,100% 93%,93% 100%,7% 100%,0 93%,0 7%)' }}
    >
      <img src="/assets/art/v2/terrain/rift-map.svg" alt="" className="absolute inset-0 h-full w-full object-fill opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,.56))]" />
      <div className="absolute inset-[6px] border border-[#f0d36d]/18 shadow-[inset_0_0_30px_rgba(0,0,0,.45)]" />
      <div className="absolute inset-2 border border-[#d4bd67]/20" />
      {entities.map((entity) => {
        const x = entity.x / Math.max(1, state.width) * 100;
        const y = entity.y / Math.max(1, state.height) * 100;
        const local = entity.ownerPlayerId === localPlayerId;
        const size = entity.kind === 'hero' ? 8 : entity.kind === 'tower' ? 6 : entity.kind === 'objective' ? 7 : entity.kind === 'monster' ? 4 : 3;
        const color = entity.kind === 'objective' ? '#d58cff' : entity.kind === 'monster' ? '#d7aa5a' : entity.team === 0 ? '#5ed2ff' : '#ff7373';
        return (
          <motion.div
            key={entity.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/80"
            animate={local ? { scale: [1, 1.8, 1], boxShadow: ['0 0 4px #ffe477', '0 0 14px #ffe477', '0 0 4px #ffe477'] } : undefined}
            transition={local ? { duration: 1.1, repeat: Infinity } : undefined}
            style={{ left: x + '%', top: y + '%', width: size, height: size, background: local ? '#ffe477' : color }}
          />
        );
      })}
      <div className="absolute left-3 top-2 font-pixel text-[7px] tracking-[.25em] text-[#e3cf7e]">RIFT TACTICAL</div>
      <div className="absolute bottom-2 right-3 text-[8px] text-white/45">MAP</div>
    </div>
  );
}

function feedText(event: CinematicEvent, localTeam: 0 | 1) {
  const allied = 'team' in event ? event.team === localTeam : true;
  if (event.type === 'ace') return allied ? 'ACE — equipe inimiga eliminada' : 'ACE inimigo';
  if (event.type === 'objective-kill') return allied ? 'Sentinela conquistado' : 'Sentinela perdido';
  if (event.type === 'tower-destroyed') return allied ? 'Torre inimiga destruída' : 'Torre aliada perdida';
  if (event.type === 'hero-kill') return allied ? 'Abate aliado' : 'Aliado abatido';
  if (event.type === 'level-up') return 'Nível ' + event.level;
  return 'Retorno à batalha';
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
    const key = (event: KeyboardEvent) => {
      if (event.key === 'b' || event.key === 'B') setShopOpen((v) => !v);
      if (event.key === 'F8') { event.preventDefault(); setDebugOpen((v) => !v); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    observerRef.current.reset();
    setFeed([]);
  }, [matchId]);

  useEffect(() => {
    if (!state) return;
    const events = observerRef.current.observe(state).filter((event) =>
      event.type === 'hero-kill' || event.type === 'objective-kill' || event.type === 'tower-destroyed' || event.type === 'ace',
    );
    if (events.length) setFeed((old) => [...events.map((event) => ({ key: event.key, event })), ...old].slice(0, 4));
  }, [state]);

  const heroes = useMemo(() => heroesOf(state), [state]);
  const blue = heroes.filter((hero) => hero.team === 0);
  const red = heroes.filter((hero) => hero.team === 1);
  const local = heroes.find((hero) => hero.ownerPlayerId === localPlayerId) ?? null;
  const localContent = local?.heroId ? authoritativeHero(local.heroId) : null;
  const abilities = localContent ? (['Q', 'W', 'E', 'R'] as const).map((slot) => localContent.abilities[slot]) : [];
  const wardCd = cdSeconds(local?.wardCooldownRemaining ?? 0, serverTickRate);
  const items = CURRENT_AUTHORITATIVE_CONTENT.payload.items;
  const maxSlots = CURRENT_AUTHORITATIVE_CONTENT.payload.rules.maxInventorySlots;
  const disconnected = Object.entries(disconnectedPlayers).map(([playerId, deadline]) => ({
    playerId,
    seconds: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" data-hud-tier="forged-premium-2">
      <div className="absolute inset-0 border-[10px] border-black/20 shadow-[inset_0_0_130px_rgba(0,0,0,.48)]" />
      <div className="absolute left-0 top-0 h-32 w-32 border-l-2 border-t-2 border-[#c6aa52]/35" />
      <div className="absolute right-0 top-0 h-32 w-32 border-r-2 border-t-2 border-[#c6aa52]/35" />
      <div className="absolute bottom-0 left-0 h-32 w-32 border-b-2 border-l-2 border-[#c6aa52]/35" />
      <div className="absolute bottom-0 right-0 h-32 w-32 border-b-2 border-r-2 border-[#c6aa52]/35" />

      <div className="absolute left-1/2 top-0 -translate-x-1/2">
        <motion.div
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative h-[62px] min-w-[590px] overflow-hidden border-x border-b border-[#6a7272]/80 bg-[linear-gradient(180deg,rgba(5,13,18,.9),rgba(4,10,14,.72))] px-8 pt-2 shadow-[0_14px_44px_rgba(0,0,0,.52)] backdrop-blur-xl"
          style={{ clipPath: 'polygon(5% 0,95% 0,100% 82%,94% 100%,66% 100%,62% 78%,38% 78%,34% 100%,6% 100%,0 82%)' }}
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#f0d36c] to-transparent" />
          <div className="flex items-start justify-between gap-8">
            <div className="flex min-w-40 items-center gap-4">
              <div className="font-pixel text-[22px] text-[#70d6ff] drop-shadow-[0_0_14px_rgba(112,214,255,.5)]">{state?.score[0] ?? 0}</div>
              <div><div className="font-pixel text-[8px] text-[#9ddfff]">AZUL</div><div className="mt-1 text-[9px] text-[#5f7d88]">OBJ {state?.objectiveScore[0] ?? 0}</div></div>
            </div>

            <div className="relative -mt-1 text-center">
              <div className="font-pixel text-[9px] tracking-[.2em] text-[#e9cf72]">{modeLabel(mode)}</div>
              <div className="mt-1 text-[9px] uppercase tracking-[.16em] text-[#708891]">FORGED ARENA</div>
              <div className="mx-auto mt-1 h-4 w-4 rotate-45 border border-[#d0b75a] bg-[radial-gradient(circle,#57471a,#15140d_65%)] shadow-[0_0_22px_rgba(232,200,96,.32)]" />
            </div>

            <div className="flex min-w-40 items-center justify-end gap-4">
              <div className="text-right"><div className="font-pixel text-[8px] text-[#ffaaa4]">VERMELHO</div><div className="mt-1 text-[9px] text-[#8e6868]">OBJ {state?.objectiveScore[1] ?? 0}</div></div>
              <div className="font-pixel text-[22px] text-[#ff827c] drop-shadow-[0_0_14px_rgba(255,130,124,.45)]">{state?.score[1] ?? 0}</div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute left-5 top-20 flex gap-2">
        {blue.map((hero) => <TeamPortrait key={hero.id} hero={hero} local={hero.ownerPlayerId === localPlayerId} />)}
      </div>
      <div className="absolute right-5 top-20 flex gap-2">
        {red.map((hero) => <TeamPortrait key={hero.id} hero={hero} local={hero.ownerPlayerId === localPlayerId} />)}
      </div>

      <div className="absolute left-1/2 top-[86px] -translate-x-1/2">
        <AnimatePresence initial={false}>
          {feed.slice(0, 2).map(({ key, event }, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -15, scale: .94 }}
              animate={{ opacity: 1 - index * .25, y: 0, scale: 1 - index * .04 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-1 border-x border-[#8b7435] bg-[#090f12]/90 px-5 py-1.5 text-center text-[9px] uppercase tracking-[.22em] text-[#e9d58b] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-md"
            >
              {feedText(event, localTeam)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ y: 110, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 135, damping: 19 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
      >
        <div className="relative flex min-w-[940px] items-end justify-center gap-3 border-x border-t border-[#677070]/80 bg-[linear-gradient(180deg,rgba(6,16,22,.9),rgba(3,9,13,.97))] px-6 pb-4 pt-3 shadow-[0_-24px_70px_rgba(0,0,0,.62)] backdrop-blur-xl"
          style={{ clipPath: 'polygon(4% 0,96% 0,100% 28%,100% 100%,0 100%,0 28%)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f1d66a] to-transparent" />
          <div className="absolute left-1/2 top-[-7px] h-3 w-20 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,#d4b652,transparent)] opacity-70 blur-[1px]" />

          <div className="mr-3 flex items-end gap-3">
            <div className="relative h-[118px] w-[118px] overflow-hidden border-2 border-[#d9bd62] bg-[#0b1720] shadow-[0_0_34px_rgba(217,189,98,.22)]"
              style={{ clipPath: 'polygon(16% 0,84% 0,100% 16%,100% 84%,84% 100%,16% 100%,0 84%,0 16%)' }}
            >
              <div className="absolute inset-0 bg-cover scale-110" style={portraitStyle(local?.heroId ?? null)} />
              <div className="absolute inset-x-0 bottom-0 bg-black/72 py-1.5 text-center font-pixel text-[8px] text-[#ffe69a]">LEVEL {local?.level ?? 0}</div>
            </div>
            <div className="w-[205px] pb-1">
              <div className="flex items-end justify-between">
                <div><div className="font-pixel text-[10px] text-[#f0e5bf]">{(local?.heroId ?? 'hero').toUpperCase()}</div><div className="mt-1 text-[8px] uppercase tracking-[.18em] text-[#657f89]">{local?.dead ? 'fallen' : 'battle ready'}</div></div>
                <div className="font-pixel text-[9px] text-[#e8c860]">{local?.gold ?? 0}g</div>
              </div>
              <div className="mt-3 h-[16px] overflow-hidden border border-[#355647] bg-black/80 shadow-inner">
                <motion.div className="h-full bg-gradient-to-r from-[#177947] via-[#35af70] to-[#70dea0]" animate={{ width: hpPct(local) + '%' }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-[#90a9b2]"><span>{Math.round(local?.hp ?? 0)} / {Math.round(local?.maxHp ?? 0)} HP</span><span>{local?.cs ?? 0} CS</span></div>
              <div className="mt-3 h-[6px] overflow-hidden bg-black/70"><div className="h-full bg-gradient-to-r from-[#4776a3] to-[#7fb9d7]" style={{ width: `${local?.maxMana ? local.mana / local.maxMana * 100 : 0}%` }} /></div>
              <div className="mt-1 text-[7px] uppercase tracking-[.14em] text-[#536c76]">{local?.maxMana ? `${local.mana} / ${local.maxMana} mana` : 'resource free'}</div>
            </div>
          </div>

          {abilities.map((ability) => {
            const [accent] = TAG_COLORS[ability.visualTag];
            return <Ability key={ability.slot} keyLabel={ability.slot} name={ability.name} cooldown={cdSeconds(local?.abilityCooldowns[ability.slot] ?? 0, serverTickRate)} accent={accent} iconSrc={abilityIcon(ability)} />;
          })}
          <Ability keyLabel="4" name="Ward" cooldown={wardCd} accent="#e5c866" iconSrc="/assets/ui/v2/abilities/ward.svg" />

          <div className="ml-4">
            <div className="mb-1 text-center font-pixel text-[7px] tracking-[.18em] text-[#677b83]">INVENTORY</div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: maxSlots }, (_, index) => {
                const id = local?.inventory[index] ?? null;
                const item = id ? items.find((candidate) => candidate.id === id) : null;
                return (
                  <div key={index} className="relative grid h-[48px] w-[48px] place-items-center overflow-hidden border border-[#4f5b5e] bg-[linear-gradient(145deg,#101a1f,#070b0e)] shadow-inner" title={item?.name ?? 'empty'}>
                    {item ? (
                      <>
                        <img src={itemIcon(item)} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_45%)]" />
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#d6b952]" />
                      </>
                    ) : (
                      <div className="h-4 w-4 rotate-45 border border-[#334149] bg-[#0b1115]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-5 right-5">
        <MiniMap state={state} localPlayerId={localPlayerId} />
        <div className="mt-2 flex justify-end gap-2">
          <button className="pointer-events-auto border border-[#6d5b2f] bg-[#171309]/96 px-4 py-2 font-pixel text-[8px] text-[#e8c860] hover:bg-[#2b2410]" onClick={() => setShopOpen((v) => !v)}>SHOP [B]</button>
          <button className="pointer-events-auto border border-[#344852] bg-[#081217]/96 px-3 py-2 font-pixel text-[8px] text-[#789aa8]" onClick={() => setDebugOpen((v) => !v)}>NET [F8]</button>
        </div>
      </div>

      <div className="absolute bottom-5 left-5 space-y-2">
        <div className="border-l-2 border-[#d2b75c] bg-[#071016]/86 px-3 py-2 text-[9px] uppercase tracking-[.18em] text-[#8da2aa] backdrop-blur-md">
          RMB MOVE · LMB ATTACK · Q CAST · 4 WARD · TAB SCORE
        </div>
        <div className="flex items-center gap-2 border-l-2 border-[#356c55] bg-[#071016]/86 px-3 py-2 text-[9px] text-[#78938b] backdrop-blur-md">
          <span className={'h-2 w-2 rounded-full ' + (networkError ? 'bg-[#ff6666]' : 'bg-[#5de39c] shadow-[0_0_10px_#5de39c]')} />
          {networkError ? 'NETWORK ISSUE' : `${networkMetrics.rttMs?.toFixed(0) ?? '—'}ms · synced`}
        </div>
      </div>

      <AnimatePresence>
        {shopOpen && (
          <motion.div
            initial={{ opacity: 0, x: 40, y: 18, scale: .97 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: .97 }}
            className="pointer-events-auto absolute bottom-[300px] right-5 w-[430px] border-2 border-[#776231] bg-[#070d11]/98 p-4 shadow-[0_28px_80px_rgba(0,0,0,.68)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-[#3a3320] pb-3">
              <div><div className="font-pixel text-[10px] text-[#f0d36d]">FORGE SHOP</div><div className="mt-1 text-[9px] text-[#677d86]">authoritative purchase terminal</div></div>
              <div className="font-pixel text-[15px] text-[#ffe48a]">{local?.gold ?? 0}g</div>
            </div>
            <div className="mt-4 grid max-h-[48vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {items.map((item) => {
                const price = itemPrice(item, local?.inventory ?? [], items);
                const ownedComponents = item.recipe.filter((component) => local?.inventory.includes(component)).length;
                const disabled = Boolean(matchResult) || !local || local.gold < price || local.inventory.length - ownedComponents >= maxSlots;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={disabled ? undefined : { y: -3, scale: 1.01 }}
                    whileTap={disabled ? undefined : { scale: .98 }}
                    disabled={disabled}
                    onClick={() => conn.sendBuy(item.id)}
                    className="relative overflow-hidden border border-[#554724] bg-[linear-gradient(145deg,#1d1810,#0b1115)] p-3 text-left disabled:opacity-30"
                  >
                    <div className="flex items-center gap-3">
                      <img src={itemIcon(item)} alt="" className="h-12 w-12 border border-[#66582f] object-cover shadow-[0_0_18px_rgba(205,177,81,.08)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-pixel text-[8px] text-[#eadb9f]">{item.name}</div>
                        <div className="mt-2 flex justify-between text-[10px]"><span className="text-[#627982]">T{item.tier}{item.recipe.length ? ` · ${item.recipe.length} parts` : ''}</span><span className="text-[#e8c860]">{price}g</span></div>
                      </div>
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
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 25 }}
            className="absolute right-5 top-36 w-72 border border-[#31505c] bg-[#061017]/96 p-3 font-mono text-[10px] text-[#83a8b6] backdrop-blur-md"
          >
            <div className="mb-2 font-pixel text-[8px] text-[#70d5ff]">AUTHORITY LINK</div>
            <div>match {matchId.slice(0, 8)} · tick {state?.tick ?? '—'}</div>
            <div>RTT {networkMetrics.rttMs === null ? '—' : networkMetrics.rttMs.toFixed(1)} ms</div>
            <div>jitter {networkMetrics.jitterMs.toFixed(1)} ms</div>
            <div>correction {networkMetrics.correctionDistance.toFixed(2)}</div>
            <div>pending {pendingInputs}</div>
            {networkError && <div className="mt-2 text-[#ff8b84]">{networkError}</div>}
            {disconnected.map((entry) => <div key={entry.playerId} className="mt-1 text-[#ffc06e]">reconnect {entry.playerId.slice(0, 8)} · {entry.seconds}s</div>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
