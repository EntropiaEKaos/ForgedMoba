import { useEffect, useMemo, useRef, useState } from 'react';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import type { SimulationState } from '../simulation/types.ts';
import { CinematicHud } from '../visual/CinematicHud.tsx';
import { PremiumGameHud } from '../visual/PremiumGameHud.tsx';
import { PixiBattlefieldRuntime } from '../visual/PixiBattlefieldRuntime.ts';
import { loadLegacyVisualCatalog, type LegacyVisualCatalog } from '../visual/legacyVisualCatalog.ts';

function buildProofState(): SimulationState {
  const state = createSimulation({
    seed: 0x1A3C1A,
    width: 3000,
    height: 2200,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue-1', team: 0, x: 920, y: 1120, heroId: 'gareth' },
      { playerId: 'blue-2', team: 0, x: 880, y: 1040, heroId: 'luxana' },
      { playerId: 'blue-3', team: 0, x: 860, y: 1210, heroId: 'gareth' },
      { playerId: 'red-1', team: 1, x: 1035, y: 1120, heroId: 'luxana' },
      { playerId: 'red-2', team: 1, x: 2110, y: 1020, heroId: 'gareth' },
      { playerId: 'red-3', team: 1, x: 2140, y: 1200, heroId: 'luxana' },
    ],
  });

  stepSimulation(state, [
    { type: 'place-ward', playerId: 'red-1', seq: 1, tick: 0, x: 1770, y: 1330 },
  ]);

  for (const entity of Object.values(state.entities)) {
    if (entity.kind === 'hero') {
      entity.level = entity.team === 0 ? 6 : 5;
      entity.gold = entity.team === 0 ? 1320 : 1180;
      entity.cs = entity.team === 0 ? 42 : 37;
      if (entity.ownerPlayerId === 'blue-1') {
        entity.inventory = ['longsword', 'ruby', 'boots'];
      }
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
            skinId: 'gareth_ember',
            heroId: 'gareth',
            rarity: 'épica',
            mods: {
              trailColor: 0xff9050,
              particleColor: 0xffc070,
              auraColor: 0xff6020,
              glowColor: 0xff8040,
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
    }, 2200);

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
    }, 2700);

    const wardTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        stepSimulation(next, [
          { type: 'place-ward', playerId: 'blue-1', seq: 1, tick: next.tick, x: 1180, y: 980 },
        ]);
        return next;
      });
    }, 2860);

    const luxanaTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        const target = Object.values(next.entities).find((entity) => entity.ownerPlayerId === 'red-1');
        if (target) {
          stepSimulation(next, [
            { type: 'cast', playerId: 'blue-2', seq: 1, tick: next.tick, slot: 'Q', x: target.x, y: target.y },
          ]);
        }
        return next;
      });
    }, 2860);

    const combatTimer = setTimeout(() => {
      setState((current) => {
        const next = structuredClone(current);
        stepSimulation(next, [
          { type: 'cast', playerId: 'blue-1', seq: 2, tick: next.tick, slot: 'Q', targetId: 4 },
        ]);
        return next;
      });
    }, 3060);

    return () => {
      clearTimeout(objectiveTimer);
      clearTimeout(progressionTimer);
      clearTimeout(wardTimer);
      clearTimeout(luxanaTimer);
      clearTimeout(combatTimer);
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
        matchId="visual-proof-2.3"
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
        matchId="visual-proof-2.3"
        mode="skirmish3v3"
        localPlayerId="blue-1"
        localTeam={0}
        state={state}
        result={null}
        serverTickRate={30}
        onReturn={() => {}}
      />

      <div className="pointer-events-none absolute left-1/2 top-[58px] z-20 -translate-x-1/2 rounded-full border border-[#6b5a30] bg-[#090e12]/72 px-4 py-1.5 text-[9px] uppercase tracking-[.24em] text-[#d5c179] backdrop-blur-sm">
        Visual 2.3 · Full Game Integration · GPU FX
      </div>

      <div className="pointer-events-none absolute left-5 top-40 z-20 w-[250px] overflow-hidden border border-[#65582f] bg-[linear-gradient(145deg,rgba(5,13,18,.92),rgba(9,14,16,.78))] p-3 shadow-[0_18px_60px_rgba(0,0,0,.38)] backdrop-blur-md">
        <div className="font-pixel text-[8px] tracking-[.18em] text-[#f0d36d]">FULL GAME VISUAL BRIDGE</div>
        <div className="mt-2 text-[9px] uppercase tracking-[.12em] text-[#77909a]">
          Event Bus · Mesh · Shader · Bloom · Glow · GPU Particles
        </div>
        {catalog && (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px]">
            <span className="text-[#78909a]">Heroes</span><span className="text-right text-[#dce9ec]">{catalog.counts.heroes}</span>
            <span className="text-[#78909a]">Items</span><span className="text-right text-[#dce9ec]">{catalog.counts.items}</span>
            <span className="text-[#78909a]">Runes</span><span className="text-right text-[#dce9ec]">{catalog.counts.runes}</span>
            <span className="text-[#78909a]">Summoners</span><span className="text-right text-[#dce9ec]">{catalog.counts.summoners}</span>
            <span className="text-[#78909a]">Skins</span><span className="text-right text-[#dce9ec]">{catalog.counts.skins}</span>
            <span className="text-[#78909a]">Ability keys</span><span className="text-right text-[#ffe28a]">{catalog.counts.abilityKeys}</span>
          </div>
        )}
        <div className="mt-3 border-t border-[#34434a] pt-2 text-[8px] leading-4 text-[#607781]">
          Legacy catalog indexed. Online FX execute only from authoritative state.
        </div>
      </div>
    </div>
  );
}
