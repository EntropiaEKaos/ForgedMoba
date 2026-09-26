import { useEffect, useMemo, useRef, useState } from 'react';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import type { SimulationState } from '../simulation/types.ts';
import { CinematicHud } from '../visual/CinematicHud.tsx';
import { PremiumGameHud } from '../visual/PremiumGameHud.tsx';
import { PixiBattlefieldRuntime } from '../visual/PixiBattlefieldRuntime.ts';

function buildProofState(): SimulationState {
  const state = createSimulation({
    seed: 0x1A3C1A,
    width: 3000,
    height: 2200,
    withLane: true,
    withJungle: true,
    players: [
      { playerId: 'blue-1', team: 0, x: 920, y: 1120, heroId: 'anya' },
      { playerId: 'blue-2', team: 0, x: 880, y: 1040, heroId: 'ashka' },
      { playerId: 'blue-3', team: 0, x: 860, y: 1210, heroId: 'yamir' },
      { playerId: 'red-1', team: 1, x: 2050, y: 1100, heroId: 'luxana' },
      { playerId: 'red-2', team: 1, x: 2110, y: 1020, heroId: 'rizar' },
      { playerId: 'red-3', team: 1, x: 2140, y: 1200, heroId: 'blitz' },
    ],
  });

  stepSimulation(state, [
    { type: 'place-ward', playerId: 'blue-1', seq: 1, tick: 0, x: 1250, y: 900 },
    { type: 'place-ward', playerId: 'red-1', seq: 1, tick: 0, x: 1770, y: 1330 },
  ]);

  for (const entity of Object.values(state.entities)) {
    if (entity.kind === 'hero') {
      entity.level = entity.team === 0 ? 6 : 5;
      entity.gold = entity.team === 0 ? 1320 : 1180;
      entity.cs = entity.team === 0 ? 42 : 37;
      if (entity.ownerPlayerId === 'blue-1') {
        entity.inventory = ['infinityedge', 'vampscepter', 'boots'];
      }
    }
  }
  return state;
}

export function VisualProofScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PixiBattlefieldRuntime | null>(null);
  const [state, setState] = useState<SimulationState>(() => buildProofState());
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
    const timer = setTimeout(() => {
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
    }, 2600);
    return () => clearTimeout(timer);
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
        matchId="visual-proof-3.0"
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
        matchId="visual-proof-3.0"
        mode="skirmish3v3"
        localPlayerId="blue-1"
        localTeam={0}
        state={state}
        result={null}
        serverTickRate={30}
        onReturn={() => {}}
      />

      <div className="pointer-events-none absolute left-1/2 top-[58px] z-20 -translate-x-1/2 rounded-full border border-[#6b5a30] bg-[#090e12]/72 px-4 py-1.5 text-[9px] uppercase tracking-[.24em] text-[#d5c179] backdrop-blur-sm">
        Visual 3.0 · PixiJS Ultra · Catálogo Autoritativo Completo
      </div>
    </div>
  );
}
