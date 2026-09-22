import { useEffect, useRef, useState } from 'react';
import { HEROES, HERO_BY_ID, type HeroDef } from '../game/heroes';
import { SKIN_BY_ID, applySkin } from '../game/skins';
import { drawHeroSprite } from '../game/sprites';
import { SUMMONERS } from '../game/summoners';
import { sfx, initAudio } from '../game/sound';
import type { Profile } from '../game/persistence';

// ---------- ordem de draft estilo LoL ----------
// B = ban, P = pick | 0 = time azul (jogador), 1 = time vermelho
type Step = { type: 'ban' | 'pick'; team: 0 | 1 };
const DRAFT_ORDER: Step[] = [
  // fase de banimento 1 (3 bans cada, alternando)
  { type: 'ban', team: 0 }, { type: 'ban', team: 1 },
  { type: 'ban', team: 0 }, { type: 'ban', team: 1 },
  { type: 'ban', team: 0 }, { type: 'ban', team: 1 },
  // fase de escolha 1
  { type: 'pick', team: 0 },
  { type: 'pick', team: 1 }, { type: 'pick', team: 1 },
  { type: 'pick', team: 0 }, { type: 'pick', team: 0 },
  { type: 'pick', team: 1 },
  // fase de banimento 2 (2 bans cada)
  { type: 'ban', team: 1 }, { type: 'ban', team: 0 },
  { type: 'ban', team: 1 }, { type: 'ban', team: 0 },
  // fase de escolha 2
  { type: 'pick', team: 1 },
  { type: 'pick', team: 0 }, { type: 'pick', team: 0 },
  { type: 'pick', team: 1 },
];

const STEP_TIME = 22; // segundos por etapa

function Portrait({ hero, look, size = 48, dim }: { hero: HeroDef; look?: HeroDef['look']; size?: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
    const spr = drawHeroSprite(look ?? hero.look, 0, 0, 'idle');
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.drawImage(spr, 0, 0, spr.width, spr.height, 0, -4, cv.width, cv.height * 1.15);
    if (dim) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(cv.width - 4, cv.height - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cv.width - 4, 4); ctx.lineTo(4, cv.height - 4); ctx.stroke();
    }
  }, [hero, look, dim]);
  return <canvas ref={ref} width={size} height={size} className="pixelated" style={{ width: size, height: size }} />;
}

export function DraftScreen({ profile, onComplete, onCancel }: {
  profile: Profile;
  onComplete: (heroId: string, summoners: string[], bans: string[]) => void;
  onCancel: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [bans, setBans] = useState<string[]>([]);
  const [picks, setPicks] = useState<{ blue: string[]; red: string[] }>({ blue: [], red: [] });
  const [hover, setHover] = useState<string>(profile.mainHero);
  const [timer, setTimer] = useState(STEP_TIME);
  const [sum1, setSum1] = useState(profile.favoriteSummoners?.[0] ?? 'flash');
  const [sum2, setSum2] = useState(profile.favoriteSummoners?.[1] ?? 'ignite');
  const [role, setRole] = useState('Todos');
  const done = stepIdx >= DRAFT_ORDER.length;
  const step = done ? null : DRAFT_ORDER[stepIdx];
  const myTurn = !!step && step.team === 0;
  const isFirstBlueP = picks.blue.length === 0;

  const unavailable = new Set([...bans, ...picks.blue, ...picks.red]);
  const hoverHero = HERO_BY_ID[hover] ?? HEROES[0];
  const skinLook = profile.equippedSkins?.[hover] ? SKIN_BY_ID[profile.equippedSkins[hover]] : null;
  const hoverLook = skinLook ? applySkin(hoverHero.look, skinLook) : hoverHero.look;

  // avança a etapa aplicando uma escolha
  const commit = (heroId: string) => {
    if (!step) return;
    if (step.type === 'ban') { setBans(b => [...b, heroId]); sfx.error(); }
    else {
      if (step.team === 0) setPicks(p => ({ ...p, blue: [...p.blue, heroId] }));
      else setPicks(p => ({ ...p, red: [...p.red, heroId] }));
      sfx.buy();
    }
    setStepIdx(i => i + 1);
    setTimer(STEP_TIME);
  };

  // IA escolhe para o time inimigo e para aliados bots
  useEffect(() => {
    if (done || !step || myTurn) return;
    const delay = 900 + Math.random() * 1300;
    const t = setTimeout(() => {
      const pool = HEROES.filter(h => !unavailable.has(h.id));
      // bans miram em heróis fortes; picks variam por função
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) commit(pick.id);
    }, delay);
    return () => clearTimeout(t);
  }, [stepIdx, done]);

  // timer: se estourar na vez do jogador, escolhe automático
  useEffect(() => {
    if (done || !myTurn) return;
    if (timer <= 0) {
      const pool = HEROES.filter(h => !unavailable.has(h.id));
      commit((pool.find(h => h.id === hover) ?? pool[0]).id);
      return;
    }
    const t = setTimeout(() => setTimer(x => x - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, myTurn, done]);

  // meu campeão = primeiro pick azul
  const myHero = picks.blue[0];

  const start = () => {
    initAudio(); sfx.levelup();
    onComplete(myHero ?? profile.mainHero, [sum1, sum2], bans);
  };

  const phaseLabel = !step ? 'DRAFT COMPLETO'
    : step.type === 'ban' ? (step.team === 0 ? '🚫 SEU BANIMENTO' : '🚫 BANIMENTO INIMIGO')
    : (step.team === 0 ? (isFirstBlueP ? '⚔ ESCOLHA SEU CAMPEÃO' : '⚔ ESCOLHA DO ALIADO') : '⚔ ESCOLHA INIMIGA');

  const slot = (id: string | undefined, team: 0 | 1, isMe = false) => (
    <div className={`flex items-center gap-2 p-1.5 border-2 ${id ? (team === 0 ? 'border-[#2a4a7c] bg-[#0d1a2e]' : 'border-[#7c2a2a] bg-[#2a0d0d]') : 'border-[#223038] bg-[#0d151c]'} ${isMe ? 'ring-2 ring-[#e8c860]' : ''}`}>
      {id ? <Portrait hero={HERO_BY_ID[id]} size={34} /> : <div className="w-[34px] h-[34px] bg-[#0a1014] flex items-center justify-center text-[#3a5058]">?</div>}
      <div className="min-w-0 flex-1">
        <div className={`font-pixel text-[8px] truncate ${id ? (team === 0 ? 'text-[#80c0ff]' : 'text-[#ff9090]') : 'text-[#3a5058]'}`}>
          {id ? HERO_BY_ID[id].name : 'aguardando'}
        </div>
        {isMe && <div className="text-[10px] text-[#e8c860]">VOCÊ</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen rift-bg text-[#d8e4e8] font-body flex flex-col">
      <div className="scanlines pointer-events-none fixed inset-0 z-50" />

      {/* cabeçalho com fase e cronômetro */}
      <header className="border-b-4 border-[#2a3a42] bg-[#0c1218]/95 px-4 py-2 flex items-center justify-between gap-3">
        <button onClick={onCancel} className="font-pixel text-[8px] px-3 py-1.5 border-2 border-[#223038] bg-[#0d151c] text-[#7a909a] hover:text-[#ff9090]">✖ SAIR</button>
        <div className="text-center flex-1">
          <div className={`font-pixel text-[12px] ${step?.type === 'ban' ? 'text-[#ff6060]' : myTurn ? 'text-[#e8c860]' : 'text-[#80c0ff]'}`}>{phaseLabel}</div>
          <div className="text-[13px] text-[#5f7880]">Etapa {Math.min(stepIdx + 1, DRAFT_ORDER.length)} de {DRAFT_ORDER.length}</div>
        </div>
        <div className={`font-pixel text-[16px] w-14 text-center ${myTurn && timer <= 5 ? 'text-[#ff5050] animate-pulse' : 'text-[#8aa0a8]'}`}>
          {myTurn ? timer : '—'}
        </div>
      </header>

      {/* barra de progresso do draft */}
      <div className="flex h-1.5 bg-[#0a1014]">
        {DRAFT_ORDER.map((s, i) => (
          <div key={i} className={`flex-1 ${i < stepIdx ? (s.type === 'ban' ? 'bg-[#7c2a2a]' : s.team === 0 ? 'bg-[#2a6a9c]' : 'bg-[#9c4a2a]') : i === stepIdx ? 'bg-[#e8c860] animate-pulse' : 'bg-[#151d24]'} ${i > 0 ? 'ml-px' : ''}`} />
        ))}
      </div>

      <main className="flex-1 grid lg:grid-cols-[200px_1fr_200px] gap-3 p-3 overflow-hidden">
        {/* time azul */}
        <aside className="space-y-1.5">
          <div className="font-pixel text-[9px] text-[#80c0ff] mb-1">■ TIME AZUL</div>
          {[0, 1, 2, 3, 4].map(i => slot(picks.blue[i], 0, i === 0))}
          <div className="pt-2">
            <div className="font-pixel text-[8px] text-[#5f7880] mb-1">BANIDOS</div>
            <div className="flex gap-1 flex-wrap">
              {bans.filter((_, i) => i % 2 === 0).map(b => (
                <div key={b} title={HERO_BY_ID[b].name} className="border border-[#7c2a2a]"><Portrait hero={HERO_BY_ID[b]} size={26} dim /></div>
              ))}
            </div>
          </div>
        </aside>

        {/* centro: grade de heróis */}
        <section className="flex flex-col min-h-0">
          <div className="flex gap-1 mb-2 flex-wrap justify-center">
            {['Todos', 'Lutador', 'Maga', 'Assassino', 'Atirador', 'Tanque', 'Suporte'].map(r => (
              <button key={r} onClick={() => setRole(r)} className={`text-[13px] px-2 py-0.5 border ${role === r ? 'border-[#5ad0c0] text-[#8af0e0] bg-[#12332e]' : 'border-[#223038] text-[#7a909a] bg-[#0d151c]'}`}>{r}</button>
            ))}
          </div>

          <div className="flex-1 overflow-auto grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-8 gap-1.5 content-start p-1">
            {HEROES.map(h => {
              const isBanned = bans.includes(h.id);
              const isTaken = picks.blue.includes(h.id) || picks.red.includes(h.id);
              const off = isBanned || isTaken;
              const hidden = role !== 'Todos' && h.role !== role;
              return (
                <button key={h.id} disabled={off || !myTurn}
                  onClick={() => { if (!off && myTurn) { setHover(h.id); commit(h.id); } }}
                  onMouseEnter={() => !off && setHover(h.id)}
                  className={`relative border-2 p-1 transition-all ${hidden ? 'opacity-25' : ''} ${
                    off ? 'border-[#3a1414] bg-[#150808] cursor-not-allowed'
                    : hover === h.id ? 'border-[#e8c860] bg-[#1a2418] -translate-y-0.5'
                    : 'border-[#223038] bg-[#0d151c] hover:border-[#5ad0c0]'} ${!myTurn && !off ? 'cursor-default' : ''}`}>
                  <Portrait hero={h} size={40} dim={off} />
                  <div className={`font-pixel text-[6px] mt-0.5 truncate ${off ? 'text-[#5a3030]' : 'text-[#c8d8dc]'}`}>{h.name}</div>
                  {isBanned && <div className="absolute inset-0 flex items-center justify-center text-[#ff4040] text-lg font-bold">🚫</div>}
                </button>
              );
            })}
          </div>

          {/* painel do herói em foco */}
          <div className="mt-2 border-2 border-[#223038] bg-[#0d151c] p-2 flex items-center gap-3">
            <div className="bg-gradient-to-b from-[#0a1410] to-[#161e1a] border border-[#1e2c34] p-1">
              <Portrait hero={hoverHero} look={hoverLook} size={64} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-pixel text-[10px] text-[#e8c860]">{hoverHero.name} <span className="text-[#5f7880] text-[8px]">{hoverHero.role}</span></div>
              <div className="text-[13px] text-[#8aa0a8] truncate">{hoverHero.title}</div>
              <div className="text-[12px] text-[#7a909a] mt-0.5"><b className="text-[#c0a0ff]">P:</b> {hoverHero.passive.name} · <b className="text-[#ffd060]">R:</b> {hoverHero.abilities.R.name}</div>
            </div>
            {myTurn && (
              <button onClick={() => commit(hover)} disabled={unavailable.has(hover)}
                className={`font-pixel text-[10px] px-5 py-3 border-2 whitespace-nowrap ${step?.type === 'ban'
                  ? 'bg-[#5c1e1e] border-[#8c3a3a] text-[#ffc0b0] hover:bg-[#7c2a2a]'
                  : 'bg-[#2e6a3a] border-[#40c060] text-[#c0ffc0] hover:bg-[#3a8c4a]'} disabled:opacity-30`}>
                {step?.type === 'ban' ? '🚫 BANIR' : '✔ ESCOLHER'}
              </button>
            )}
          </div>
        </section>

        {/* time vermelho */}
        <aside className="space-y-1.5">
          <div className="font-pixel text-[9px] text-[#ff8080] mb-1 text-right">TIME VERMELHO ■</div>
          {[0, 1, 2, 3, 4].map(i => slot(picks.red[i], 1))}
          <div className="pt-2">
            <div className="font-pixel text-[8px] text-[#5f7880] mb-1 text-right">BANIDOS</div>
            <div className="flex gap-1 flex-wrap justify-end">
              {bans.filter((_, i) => i % 2 === 1).map(b => (
                <div key={b} title={HERO_BY_ID[b].name} className="border border-[#7c2a2a]"><Portrait hero={HERO_BY_ID[b]} size={26} dim /></div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* rodapé: feitiços + iniciar */}
      <footer className="border-t-4 border-[#2a3a42] bg-[#0c1218]/95 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] text-[#5f7880]">FEITIÇOS</span>
          {([[sum1, setSum1, 'D'], [sum2, setSum2, 'F']] as const).map(([cur, set, key]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="font-pixel text-[8px] text-[#a0d0ff]">{key}</span>
              <select value={cur} onChange={e => set(e.target.value)} className="bg-[#0d151c] border-2 border-[#223038] text-[#e8d8b0] text-[13px] px-1 py-1">
                {Object.values(SUMMONERS).map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        {done ? (
          <button onClick={start} className="font-pixel text-[11px] px-8 py-3 bg-[#e8c860] text-[#1a1408] border-4 border-[#8c6a20] hover:bg-[#f5dc80] hover:-translate-y-0.5 transition-all hard-shadow-gold animate-pulse">
            ▶ ENTRAR NA PARTIDA COM {myHero ? HERO_BY_ID[myHero].name.toUpperCase() : '?'}
          </button>
        ) : (
          <div className="text-[14px] text-[#5f7880]">
            {myTurn ? <span className="text-[#e8c860]">Sua vez — clique num campeão</span> : 'Aguardando os outros invocadores...'}
          </div>
        )}
      </footer>
    </div>
  );
}
