import { useEffect, useMemo, useRef, useState } from 'react';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import type { SimulationState } from '../simulation/types.ts';
import { CinematicHud } from '../visual/CinematicHud.tsx';
import { PixiBattlefieldRuntime } from '../visual/PixiBattlefieldRuntime.ts';

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
      { playerId: 'red-1', team: 1, x: 2050, y: 1100, heroId: 'luxana' },
      { playerId: 'red-2', team: 1, x: 2110, y: 1020, heroId: 'gareth' },
      { playerId: 'red-3', team: 1, x: 2140, y: 1200, heroId: 'luxana' },
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

  const local = state.entities['1'];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07110f] text-[#d8e4e8]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <CinematicHud
        matchId="visual-proof-1.3"
        mode="skirmish3v3"
        localPlayerId="blue-1"
        localTeam={0}
        state={state}
        result={null}
        serverTickRate={30}
        onReturn={() => {}}
      />

      <div className="absolute left-4 top-4 z-20 border-2 border-[#456675] bg-[#07131b]/92 px-4 py-3 backdrop-blur-sm">
        <div className="font-pixel text-[9px] text-[#e8c860]">VISUAL PROOF · CINEMATIC 1.3</div>
        <div className="mt-2 text-xs text-[#9db2ba]">
          PixiJS · Ultra · deterministic proof scene
        </div>
        <div className="mt-1 text-xs text-[#7f959d]">
          Lv {local?.level ?? 0} · {local?.gold ?? 0}g · {local?.cs ?? 0} CS
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 border border-[#55472a] bg-[#151108]/92 px-4 py-3 text-right">
        <div className="font-pixel text-[8px] text-[#e8c860]">OBJECTIVES</div>
        <div className="mt-2 font-pixel text-[16px] text-[#f2df9a]">
          {state.objectiveScore[0]} : {state.objectiveScore[1]}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border border-[#2e4b57] bg-[#08131a]/92 px-5 py-3 text-center">
        <div className="font-pixel text-[8px] text-[#79cfff]">Q · PRONTA</div>
        <div className="mt-1 text-[10px] text-[#78909a]">proof harness · sem autoridade de gameplay</div>
      </div>
    </div>
  );
}
