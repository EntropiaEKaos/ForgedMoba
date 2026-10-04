import { useEffect, useMemo, useRef, useState } from 'react';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import type { SimulationState } from '../simulation/types.ts';
import {
  authoritativeAbility,
  CURRENT_AUTHORITATIVE_CONTENT,
  type AuthoritativeAbilityContent,
} from '../shared/authoritativeContent.ts';
import { CinematicHud } from '../visual/CinematicHud.tsx';
import { PremiumGameHud } from '../visual/PremiumGameHud.tsx';
import { PixiBattlefieldRuntime } from '../visual/PixiBattlefieldRuntime.ts';
import { loadLegacyVisualCatalog, type LegacyVisualCatalog } from '../visual/legacyVisualCatalog.ts';

const authority = CURRENT_AUTHORITATIVE_CONTENT.payload;
const abilitySlots = ['Q', 'W', 'E', 'R'] as const;

function heroWithAbility(predicate: (ability: AuthoritativeAbilityContent) => boolean): { heroId: string; slot: 'Q' | 'W' | 'E' | 'R' } | null {
  for (const hero of authority.heroes) {
    for (const slot of abilitySlots) {
      if (predicate(hero.abilities[slot])) return { heroId: hero.id, slot };
    }
  }
  return null;
}

const SUPPORT_PICK = heroWithAbility((ability) =>
  ability.healBase > 0 ||
  ability.shieldBase > 0 ||
  ability.hastePermille > 0 ||
  ability.damageReductionPermille > 0,
);

const CONTROL_PICK = heroWithAbility((ability) =>
  ability.statusKind === 'root' ||
  ability.statusKind === 'stun' ||
  ability.statusKind === 'silence' ||
  ability.statusKind === 'slow',
);

function proofHero(preferred: string, fallbackIndex: number): string {
  return authority.heroes.some((hero) => hero.id === preferred)
    ? preferred
    : authority.heroes[Math.min(fallbackIndex, Math.max(0, authority.heroes.length - 1))]?.id ?? preferred;
}

function castProofAbility(
  state: SimulationState,
  playerId: string,
  seq: number,
  slot: 'Q' | 'W' | 'E' | 'R',
  enemyPlayerId: string,
): void {
  const caster = Object.values(state.entities).find((entity) => entity.ownerPlayerId === playerId);
  const enemy = Object.values(state.entities).find((entity) => entity.ownerPlayerId === enemyPlayerId);
  if (!caster?.heroId) return;
  const ability = authoritativeAbility(caster.heroId, slot);
  const friendlyTarget = Object.values(state.entities)
    .find((entity) => entity.ownerPlayerId === 'blue-1') ?? caster;
  const target = ability.affectsAllies ? friendlyTarget : enemy;
  if (!target && ability.runtime !== 'self') return;

  if (ability.runtime === 'self') {
    stepSimulation(state, [{ type: 'cast', playerId, seq, tick: state.tick, slot }]);
    return;
  }
  if (ability.runtime === 'target') {
    stepSimulation(state, [{ type: 'cast', playerId, seq, tick: state.tick, slot, targetId: target?.id }]);
    return;
  }
  stepSimulation(state, [{
    type: 'cast',
    playerId,
    seq,
    tick: state.tick,
    slot,
    x: target?.x ?? caster.x + 120,
    y: target?.y ?? caster.y,
  }]);
}

function buildProofState(): SimulationState {
  const supportHero = proofHero('luxana', 1);
  const controlHero = proofHero('luxana', 2);
  const state = createSimulation({
    seed: 0x1A3C1A,
    width: 3000,
    height: 2200,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue-1', team: 0, x: 920, y: 1120, heroId: proofHero('anya', 0) },
      { playerId: 'blue-2', team: 0, x: 820, y: 1040, heroId: supportHero },
      { playerId: 'blue-3', team: 0, x: 760, y: 1200, heroId: controlHero },
      { playerId: 'red-1', team: 1, x: 980, y: 1200, heroId: proofHero('luxana', 3) },
      { playerId: 'red-2', team: 1, x: 1160, y: 1040, heroId: proofHero('rizar', 4) },
      { playerId: 'red-3', team: 1, x: 1160, y: 1200, heroId: proofHero('blitz', 5) },
    ],
  });

  stepSimulation(state, [
    { type: 'place-ward', playerId: 'red-1', seq: 1, tick: 0, x: 1260, y: 1320 },
  ]);

  for (const entity of Object.values(state.entities)) {
    if (entity.kind !== 'hero') continue;
    entity.level = entity.team === 0 ? 7 : 6;
    entity.gold = entity.team === 0 ? 3600 : 2800;
    entity.cs = entity.team === 0 ? 56 : 44;
    entity.mana = Math.max(entity.maxMana, 9999);
    entity.maxMana = Math.max(entity.maxMana, 9999);
    if (entity.ownerPlayerId === 'blue-1') {
      entity.inventory = ['infinityedge', 'vampscepter', 'boots'];
      entity.hp = Math.max(1, entity.maxHp - 180);
    }
  }
  return state;
}

export function VisualProofScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PixiBattlefieldRuntime | null>(null);
  const [state, setState] = useState<SimulationState>(() => buildProofState());
  const [catalog, setCatalog] = useState<LegacyVisualCatalog | null>(null);
  const stateRef = useRef(state);
  const initialState = useMemo(() => state, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const runtime = new PixiBattlefieldRuntime(canvas);
    runtimeRef.current = runtime;
    let cancelled = false;
    let raf = 0;

    const resize = () => runtime.resize(window.innerWidth, window.innerHeight);
    const frame = () => {
      runtime.render({
        state: stateRef.current,
        interpolated: null,
        localPlayerId: 'blue-1',
        quality: 'ultra',
        skinVisuals: {
          'blue-1': {
            skinId: 'anya_pumpkin',
            heroId: proofHero('anya', 0),
            rarity: 'rara',
            mods: {
              trailColor: 0xff8040,
              particleColor: 0xffc060,
              auraColor: 0xff6a20,
              glowColor: 0xffa040,
            },
          },
        },
      });
      raf = requestAnimationFrame(frame);
    };

    void runtime.init('ultra').then(() => {
      if (cancelled) return;
      resize();
      window.addEventListener('resize', resize);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadLegacyVisualCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    const objectiveTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        const objective = Object.values(next.entities)
          .filter((entity) => entity.kind === 'objective')
          .sort((a, b) => a.id - b.id)[0];
        if (objective) {
          objective.dead = true;
          objective.hp = 0;
        }
        next.objectiveScore[0] += 1;
        next.tick += 3;
        return next;
      });
    }, 2050);

    const progressionTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        const local = Object.values(next.entities).find((entity) => entity.ownerPlayerId === 'blue-1');
        if (local) {
          local.level += 1;
          if (!local.inventory.includes('pickaxe')) local.inventory.push('pickaxe');
        }
        next.tick += 3;
        return next;
      });
    }, 2480);

    const supportTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        castProofAbility(next, 'blue-2', 1, 'W', 'red-1');
        return next;
      });
    }, 2700);

    const localShieldTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        castProofAbility(next, 'blue-1', 2, 'E', 'red-1');
        return next;
      });
    }, 2810);

    const wardTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        stepSimulation(next, [
          { type: 'place-ward', playerId: 'blue-1', seq: 1, tick: next.tick, x: 1040, y: 980 },
        ]);
        return next;
      });
    }, 2840);

    const controlTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        castProofAbility(next, 'blue-3', 1, 'Q', 'red-1');
        return next;
      });
    }, 2990);

    const localCastTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        castProofAbility(next, 'blue-1', 3, 'Q', 'red-1');
        return next;
      });
    }, 3100);

    return () => {
      clearTimeout(objectiveTimer);
      clearTimeout(progressionTimer);
      clearTimeout(supportTimer);
      clearTimeout(localShieldTimer);
      clearTimeout(wardTimer);
      clearTimeout(controlTimer);
      clearTimeout(localCastTimer);
    };
  }, [initialState]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07110f] text-[#d8e4e8]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <PremiumGameHud
        state={state}
        localPlayerId="blue-1"
        localTeam={0}
        mode="skirmish3v3"
        serverTickRate={30}
        matchId="visual-proof-3.1"
        networkMetrics={{
          rttMs: 24.6,
          jitterMs: 2.8,
          snapshotIntervalMs: 100,
          skippedSnapshotWindows: 0,
          correctionDistance: 0.42,
          samples: 30,
        }}
        pendingInputs={1}
        networkError={null}
        disconnectedPlayers={{}}
        matchResult={null}
      />
      <CinematicHud
        matchId="visual-proof-3.1"
        mode="skirmish3v3"
        localPlayerId="blue-1"
        localTeam={0}
        state={state}
        result={null}
        serverTickRate={30}
        onReturn={() => {}}
      />

      <div className="pointer-events-none absolute left-1/2 top-[58px] z-20 -translate-x-1/2 rounded-full border border-[#6b5a30] bg-[#090e12]/72 px-4 py-1.5 text-[9px] uppercase tracking-[.24em] text-[#d5c179] backdrop-blur-sm">
        Visual 3.1 · Full Authority + GPU FX · PixiJS Ultra
      </div>

      <div className="pointer-events-none absolute left-5 top-40 z-20 w-[268px] overflow-hidden border border-[#65582f] bg-[linear-gradient(145deg,rgba(5,13,18,.94),rgba(9,14,16,.8))] p-3 shadow-[0_18px_60px_rgba(0,0,0,.42)] backdrop-blur-md">
        <div className="font-pixel text-[8px] tracking-[.18em] text-[#f0d36d]">FORGED VISUAL AUTHORITY BRIDGE</div>
        <div className="mt-2 text-[9px] uppercase tracking-[.12em] text-[#77909a]">
          QWER Authority · Event Bus · Mesh · Shader · Bloom · Glow · GPU Particles
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px]">
          <span className="text-[#78909a]">Authoritative heroes</span><span className="text-right text-[#dce9ec]">{authority.heroes.length}</span>
          <span className="text-[#78909a]">Authoritative items</span><span className="text-right text-[#dce9ec]">{authority.items.length}</span>
          <span className="text-[#78909a]">Runes indexed</span><span className="text-right text-[#dce9ec]">{catalog?.counts.runes ?? '—'}</span>
          <span className="text-[#78909a]">Summoners indexed</span><span className="text-right text-[#dce9ec]">{catalog?.counts.summoners ?? '—'}</span>
          <span className="text-[#78909a]">Skins indexed</span><span className="text-right text-[#dce9ec]">{catalog?.counts.skins ?? '—'}</span>
          <span className="text-[#78909a]">Legacy effect keys</span><span className="text-right text-[#ffe28a]">{catalog?.counts.abilityKeys ?? '—'}</span>
        </div>
        <div className="mt-3 border-t border-[#34434a] pt-2 text-[8px] leading-4 text-[#607781]">
          Live FX execute from authoritative simulation deltas. Visual metadata never owns gameplay.
        </div>
      </div>
    </div>
  );
}
