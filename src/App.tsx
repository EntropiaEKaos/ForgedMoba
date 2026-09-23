import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { HEROES, HERO_BY_ID, type HeroDef, type AbilitySlot } from './game/heroes';
import { ITEMS, ITEM_BY_ID, componentDiscount, type ItemDef } from './game/items';
import { Game, type Snapshot } from './game/engine';
import { drawHeroSprite } from './game/sprites';
import { initAudio, setMuted, isMuted, sfx } from './game/sound';
import { SUMMONERS } from './game/summoners';
import { loadProfile, saveProfile, addMatch, getRank, loadMatches, resetProfile, buySkin, equipSkin, unequipSkin, type Profile, type MatchRecord } from './game/persistence';
import { SKINS_BY_HERO, SKIN_BY_ID, applySkin, getSkinRarityColor, type Skin } from './game/skins';
import { conn, useConnection } from './network/connection';
import { ConnectScreen } from './screens/ConnectScreen';
import { DraftScreen } from './screens/DraftScreen';
import { AdminPanel } from './admin/AdminPanel';
import { RunesModal } from './screens/RunesModal';
import { OnlineMatchScreen } from './screens/OnlineMatchScreen';
import { getActiveRules, initializeAdminContent, type AdminContent } from './admin/content';

// ================= BADGE DE STATUS ONLINE =================
function OnlineBadge() {
  const { status, user } = useConnection();
  const dot = status === 'online' ? 'bg-[#40c060]' : status === 'offline' ? 'bg-[#ff5050]' : 'bg-[#80c0ff] animate-ping';
  const label = status === 'online' ? (user?.mode === 'account' ? 'Online' : 'Convidado') : 'Offline';
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border border-[#223038] bg-[#0d151c]" title={`Status: ${status}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[12px] text-[#7a909a]">{label}</span>
    </div>
  );
}

function HeroPortrait({ hero, team = 0, size = 64, look }: { hero: HeroDef; team?: 0 | 1; size?: number; look?: HeroDef['look'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
    const spr = drawHeroSprite(look ?? hero.look, team, 0, 'idle');
    ctx.drawImage(spr, 0, 0, spr.width, spr.height, 0, -6, cv.width, cv.height * 1.15);
  }, [hero, team, look]);
  return <canvas ref={ref} width={size} height={size} className="pixelated" style={{ width: size, height: size }} />;
}

function ItemIcon({ item, size = 40 }: { item: ItemDef; size?: number }) {
  const g = item.icon;
  return (
    <div className="relative flex items-center justify-center border border-black/70" style={{ width: size, height: size, background: g.bg }}>
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 16 16" className="pixelated">
        <Glyph glyph={g.glyph} color={g.fg} />
      </svg>
    </div>
  );
}
function Glyph({ glyph, color }: { glyph: string; color: string }) {
  const P = (p: { x: number; y: number; w: number; h: number }) => <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={color} />;
  switch (glyph) {
    case 'sword': return <g><P x={7} y={1} w={2} h={9} /><P x={5} y={10} w={6} h={2} /><P x={7} y={12} w={2} h={3} /></g>;
    case 'bigsword': return <g><P x={6} y={0} w={4} h={10} /><P x={4} y={10} w={8} h={2} /><P x={7} y={12} w={2} h={4} /></g>;
    case 'dagger': return <g><P x={4} y={2} w={2} h={6} /><P x={10} y={2} w={2} h={6} /><P x={3} y={8} w={4} h={2} /><P x={9} y={8} w={4} h={2} /></g>;
    case 'book': return <g><P x={3} y={3} w={10} h={10} /><rect x={7} y={3} width={2} height={10} fill="#00000060" /><P x={4} y={1} w={8} h={2} /></g>;
    case 'gem': return <g><P x={6} y={2} w={4} h={2} /><P x={4} y={4} w={8} h={4} /><P x={5} y={8} w={6} h={3} /><P x={7} y={11} w={2} h={2} /></g>;
    case 'shield': return <g><P x={4} y={2} w={8} h={7} /><P x={5} y={9} w={6} h={2} /><P x={6} y={11} w={4} h={2} /></g>;
    case 'cloak': return <g><P x={5} y={1} w={6} h={3} /><P x={3} y={4} w={10} h={8} /></g>;
    case 'boot': return <g><P x={5} y={2} w={4} h={8} /><P x={5} y={10} w={8} h={3} /></g>;
    case 'scepter': return <g><P x={7} y={4} w={2} h={10} /><P x={5} y={1} w={6} h={4} /></g>;
    case 'pick': return <g><P x={7} y={3} w={2} h={11} /><P x={3} y={2} w={10} h={2} /></g>;
    case 'rod': return <g><P x={7} y={5} w={2} h={10} /><P x={5} y={1} w={6} h={5} /></g>;
    case 'hat': return <g><P x={6} y={1} w={3} h={6} /><P x={4} y={5} w={7} h={4} /><P x={2} y={9} w={12} h={2} /></g>;
    case 'hourglass': return <g><P x={4} y={1} w={8} h={2} /><P x={5} y={3} w={6} h={3} /><P x={7} y={6} w={2} h={3} /><P x={5} y={9} w={6} h={3} /><P x={4} y={12} w={8} h={2} /></g>;
    case 'hammer': return <g><P x={7} y={5} w={2} h={9} /><P x={3} y={1} w={10} h={5} /></g>;
    case 'heart': return <g><P x={3} y={3} w={4} h={4} /><P x={9} y={3} w={4} h={4} /><P x={3} y={6} w={10} h={3} /><P x={5} y={9} w={6} h={2} /><P x={7} y={11} w={2} h={2} /></g>;
    case 'flame': return <g><P x={7} y={1} w={2} h={3} /><P x={5} y={4} w={6} h={4} /><P x={4} y={8} w={8} h={4} /></g>;
    default: return <P x={4} y={4} w={8} h={8} />;
  }
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ROLES = ['Todos', 'Lutador', 'Maga', 'Assassino', 'Assassina', 'Atiradora', 'Tanque', 'Suporte'] as const;
const Key = ({ k }: { k: string }) => <span className="font-pixel text-[8px] bg-[#1e2c34] border border-[#3a5058] text-[#e8c860] px-1.5 py-0.5 mr-1">{k}</span>;

// ================= TELA DE PERFIL + SELEÇÃO =================
function ProfileScreen({ profile, onPlay, onEditName, onUpdateProfile, onDraft }: { profile: Profile; onPlay: (heroId: string, summoners: string[]) => void; onEditName: (n: string) => void; onUpdateProfile: (p: Profile) => void; onDraft: () => void }) {
  const [sel, setSel] = useState<string>(profile.mainHero);
  const [role, setRole] = useState<string>('Todos');
  const [sum1, setSum1] = useState<string>(profile.favoriteSummoners[0] ?? 'flash');
  const [sum2, setSum2] = useState<string>(profile.favoriteSummoners[1] ?? 'ignite');
  const [tab, setTab] = useState<'select' | 'multiplayer' | 'profile' | 'history'>('select');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  const [showRunes, setShowRunes] = useState(false);
  const [diffLocal, setDiffLocal] = useState<'easy' | 'normal' | 'hard'>(profile.difficulty ?? 'normal');
  const [nameInput, setNameInput] = useState(profile.name);
  const h = HERO_BY_ID[sel];
  const skinLook = profile.equippedSkins?.[sel] ? SKIN_BY_ID[profile.equippedSkins[sel]] : null;
  const resolvedLook = skinLook ? applySkin(h.look, skinLook) : h.look;
  const filtered = HEROES.filter(x => role === 'Todos' || x.role === role);

  useEffect(() => { setMatches(loadMatches()); }, []);

  const start = () => {
    initAudio(); sfx.buy();
    const p = { ...profile, mainHero: sel, favoriteSummoners: [sum1, sum2], difficulty: diffLocal };
    saveProfile(p);
    onPlay(sel, [sum1, sum2]);
  };

  const statBar = (label: string, v: number, max: number, color: string) => (
    <div className="flex items-center gap-2 text-[15px] leading-5">
      <span className="w-14 text-[#8aa0a8]">{label}</span>
      <div className="flex-1 h-3 bg-[#0a0f14] border border-[#2a3a42]">
        <div className="h-full transition-all duration-300" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: color }} />
      </div>
      <span className="w-12 text-right text-[#d8e4e8]">{Math.round(v)}</span>
    </div>
  );

  const wr = profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;

  return (
    <div className="min-h-screen rift-bg text-[#d8e4e8] font-body overflow-x-hidden">
      <div className="scanlines pointer-events-none fixed inset-0 z-50" />
      <header className="border-b-4 border-[#2a3a42] bg-[#0c1218]/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="font-pixel text-[#e8c860] text-xl sm:text-2xl title-glow">PIXEL RIFT</h1>
            <span className="text-[#5ad0c0] text-lg hidden sm:inline">· {HEROES.length} heróis · {ITEMS.length} itens</span>
          </div>
          <div className="flex items-center gap-3 text-[15px]">
            <OnlineBadge />
            <button onClick={() => setShowSkins(true)} className="flex items-center gap-1.5 font-pixel text-[9px] px-2 py-1 border-2 border-[#a060ff] bg-[#1a1230] text-[#d0b0ff] hover:bg-[#2a1e44] transition-all" title="Coleção de Skins">
              ✦ SKINS
            </button>
            <button onClick={() => setShowRunes(true)} className="flex items-center gap-1.5 font-pixel text-[9px] px-2 py-1 border-2 border-[#8c5ae0] bg-[#1a1430] text-[#c0a0ff] hover:bg-[#2a1e44] transition-all" title="Página de Runas">
              ⚜ RUNAS
            </button>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] text-[#e8c860]">{getRank(profile)}</span>
              <span className="text-[#8aa0a8]">nv{profile.level}</span>
            </div>
            <button onClick={() => setEditingName(true)} className="text-[#8aa0a8] hover:text-[#e8c860] text-[15px]">{profile.name} ✎</button>
            <div className="text-[#5f7880]">{profile.wins}V / {profile.losses}D · {wr}% WR</div>
          </div>
        </div>
      </header>

      {editingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setEditingName(false)}>
          <div className="bg-[#0e151d] border-4 border-[#8c6a20] p-4 hard-shadow" onClick={e => e.stopPropagation()}>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} className="bg-[#101820] border-2 border-[#2a3a42] px-3 py-2 text-[#e8c860] font-body text-lg w-64" maxLength={16} />
            <button onClick={() => { onEditName(nameInput || 'Invocador'); setEditingName(false); }} className="ml-2 px-4 py-2 bg-[#e8c860] text-[#1a1408] font-pixel text-[9px] border-2 border-[#8c6a20]">OK</button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 py-6">
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setTab('select')} className={`font-pixel text-[9px] px-4 py-2 border-2 ${tab === 'select' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>⚔ SELEÇÃO</button>
          <button onClick={() => setTab('multiplayer')} className={`font-pixel text-[9px] px-4 py-2 border-2 ${tab === 'multiplayer' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>🌐 MULTIPLAYER</button>
          <button onClick={() => setTab('profile')} className={`font-pixel text-[9px] px-4 py-2 border-2 ${tab === 'profile' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>📊 PERFIL</button>
          <button onClick={() => setTab('history')} className={`font-pixel text-[9px] px-4 py-2 border-2 ${tab === 'history' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>📜 HISTÓRICO ({matches.length})</button>
          <button onClick={() => setShowSettings(true)} className="font-pixel text-[9px] px-4 py-2 border-2 border-[#223038] bg-[#0d151c] text-[#7a909a] hover:text-[#5ad0c0] ml-auto">⚙ CONFIG</button>
        </div>

        {tab === 'select' ? (
          <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            <aside className="lg:sticky lg:top-24 self-start">
              <div className="pixel-panel bg-[#101820] p-5">
                <div className="relative h-56 flex items-end justify-center bg-gradient-to-b from-[#0a1410] via-[#12211c] to-[#1a2c24] border-2 border-[#2a3a42] overflow-hidden">
                  <div className="absolute inset-0 grid-fade opacity-60" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-10 bg-[#e8c860]/10 blur-md" />
                  <div className={`relative animate-float ${skinLook?.mods?.auraColor ? 'skin-heavy-glow' : ''}`}
                    style={skinLook?.mods?.auraColor ? { filter: `drop-shadow(0 0 8px ${skinLook.mods.auraColor})` } : {}}>
                    <HeroPortrait hero={h} size={170} look={resolvedLook} />
                  </div>
                  <div className="absolute top-2 left-2 font-pixel text-[9px] text-[#5ad0c0] bg-black/50 px-2 py-1">{h.role.toUpperCase()}</div>
                  <div className="absolute top-2 right-2 font-pixel text-[9px] text-[#8aa0a8] bg-black/50 px-2 py-1">{h.ranged ? 'LONGE' : 'PERTO'}</div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <h2 className="font-pixel text-[#e8c860] text-lg title-glow">{h.name}</h2>
                  <span className="text-[#8aa0a8] text-[15px]">— {h.title}</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {statBar('Vida', h.hp, 800, 'linear-gradient(90deg,#2e8c4a,#40c060)')}
                  {statBar('Dano', h.ad, 80, 'linear-gradient(90deg,#a86820,#e8a040)')}
                  {statBar('Armad.', h.armor, 50, 'linear-gradient(90deg,#5a6a7a,#8aa0b0)')}
                  {statBar('Vel.Atk', h.as * 100, 80, 'linear-gradient(90deg,#8c5a20,#e0b060)')}
                  {statBar('Alcance', h.atkRange, 200, 'linear-gradient(90deg,#2a6a8c,#50b0d0)')}
                </div>
                <div className="mt-4 border-l-4 border-[#8c5ae0] bg-[#161024] p-2.5">
                  <div className="text-[15px]"><b className="text-[#c0a0ff] font-pixel text-[10px]">PASSIVA · </b><b className="text-[#e8d8ff]">{h.passive.name}</b></div>
                  <div className="text-[15px] text-[#9a8ab8] leading-snug">{h.passive.desc}</div>
                </div>
                <div className="mt-2 space-y-1">
                  {(['Q', 'W', 'E', 'R'] as AbilitySlot[]).map(s => (
                    <div key={s} className="flex gap-2 items-start border border-[#223038] bg-[#0d151c] p-2 hover:border-[#e8c860]/50 transition-colors">
                      <span className={`font-pixel text-[10px] w-6 h-6 flex items-center justify-center shrink-0 ${s === 'R' ? 'bg-[#8c2e2e] text-[#ffd0a0]' : 'bg-[#1e3242] text-[#80d0ff]'}`}>{s}</span>
                      <div className="min-w-0">
                        <div className="text-[15px] leading-4"><b className="text-[#e8d8b0]">{h.abilities[s].name}</b> <span className="text-[#5f7880]">· {h.abilities[s].cd}s</span></div>
                        <div className="text-[14px] text-[#8aa0a8] leading-snug">{h.abilities[s].desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* feitiços de invocador */}
                <div className="mt-3 border-t-2 border-[#223038] pt-3">
                  <div className="font-pixel text-[9px] text-[#5ad0c0] mb-2">FEITIÇOS DE INVOCADOR</div>
                  <div className="flex gap-2">
                    {[0, 1].map((idx: number) => {
                      const cur = idx === 0 ? sum1 : sum2;
                      const set = idx === 0 ? setSum1 : setSum2;
                      return (
                        <div key={idx} className="flex-1">
                          <div className="font-pixel text-[8px] text-[#5f7880] mb-1">{idx === 0 ? 'D' : 'F'}</div>
                          <select value={cur} onChange={e => set(e.target.value)}
                            className="w-full bg-[#0d151c] border-2 border-[#223038] text-[#e8d8b0] text-[14px] px-1 py-1.5">
                            {Object.values(SUMMONERS).map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[13px] text-[#5f7880] mt-1">{SUMMONERS[sum1].desc}</div>
                  <div className="text-[13px] text-[#5f7880]">{SUMMONERS[sum2].desc}</div>
                </div>
                <div className="mt-4">
                  <div className="font-pixel text-[8px] text-[#5f7880] mb-1.5">DIFICULDADE DOS BOTS</div>
                  <div className="flex gap-1">
                    {([['easy', '🙂 Fácil'], ['normal', '😐 Normal'], ['hard', '😈 Difícil']] as const).map(([d, label]) => (
                      <button key={d} onClick={() => { const p = { ...profile, difficulty: d }; saveProfile(p); setDiffLocal(d); }}
                        className={`flex-1 font-pixel text-[8px] py-2 border-2 transition-all ${diffLocal === d ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => { initAudio(); sfx.click(); onDraft(); }}
                  className="mt-3 w-full font-pixel text-[11px] py-4 bg-[#5a2e7a] text-[#e0c0ff] border-4 border-[#8c5ae0] hover:bg-[#6a3a8c] hover:-translate-y-0.5 active:translate-y-0.5 transition-all hard-shadow">
                  🚫 DRAFT COM BANIMENTOS
                </button>
                <button onClick={start}
                  className="mt-2 w-full font-pixel text-[10px] py-3 bg-[#e8c860] text-[#1a1408] border-4 border-[#8c6a20] hover:bg-[#f5dc80] hover:-translate-y-0.5 active:translate-y-0.5 transition-all hard-shadow-gold">
                  ▶ PARTIDA RÁPIDA
                </button>
              </div>
            </aside>
            <section>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-pixel text-[11px] text-[#8aa0a8]">ESCOLHA SEU CAMPEÃO <span className="text-[#e8c860]">▮</span><span className="animate-blink">_</span></h2>
                <div className="flex gap-1 flex-wrap">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                      className={`text-[14px] px-2.5 py-1 border-2 transition-all ${role === r ? 'border-[#5ad0c0] bg-[#12332e] text-[#8af0e0]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a] hover:border-[#3a5058]'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {filtered.map(hero => (
                  <button key={hero.id} onClick={() => { setSel(hero.id); sfx.click(); }}
                    className={`group relative bg-[#101820] border-2 p-2.5 text-left transition-all duration-150 hover:-translate-y-1 ${sel === hero.id ? 'border-[#e8c860] hard-shadow-gold' : 'border-[#223038] hover:border-[#5ad0c0]'}`}>
                    <div className="flex justify-center bg-gradient-to-b from-[#0a1410] to-[#141f1a] border border-[#1e2c34] py-1">
                      <HeroPortrait hero={hero} size={64} />
                    </div>
                    <div className={`mt-1.5 font-pixel text-[8px] ${sel === hero.id ? 'text-[#e8c860]' : 'text-[#c8d8dc] group-hover:text-[#8af0e0]'}`}>{hero.name}</div>
                    <div className="text-[13px] text-[#5f7880] leading-3">{hero.role}</div>
                    {sel === hero.id && <div className="absolute -top-2 -right-2 font-pixel text-[8px] bg-[#e8c860] text-[#1a1408] px-1.5 py-0.5 border-2 border-[#8c6a20]">✓</div>}
                  </button>
                ))}
              </div>
              <div className="mt-5 pixel-panel bg-[#0d151c] p-4">
                <h3 className="font-pixel text-[10px] text-[#5ad0c0] mb-2.5">⌨ COMO JOGAR</h3>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[15px] text-[#9ab0b8]">
                  <div><Key k="ESQ" /> atacar · <Key k="DIR" /> mover</div>
                  <div className="text-[#e0a040]"><Key k="QWER" /> habilidades (mira no cursor)</div>
                  <div className="text-[#40c060]"><Key k="CTRL/SHIFT+QWER" /> upar habilidade</div>
                  <div className="text-[#a0d0ff]"><Key k="D F" /> feitiços de invocador</div>
                  <div><Key k="A" />+dir: mover-atacar · <Key k="S" /> parar</div>
                  <div><Key k="B" /> recall · <Key k="P" /> loja · <Key k="1-6" /> ativo</div>
                  <div><Key k="G/V" /> ping · <Key k="CTRL+1-4" /> chat</div>
                  <div><Key k="TAB" /> placar · <Key k="H" /> ajuda · <Key k="M" /> som</div>
                </div>
                <p className="mt-2.5 text-[14px] text-[#5f7880]">Last-hit (golpe final) em minions dá +50% de ouro. Bounty aumenta com sequência de abates — shutdown dá ouro extra!</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="pixel-panel bg-[#0d151c] p-4">
            <h3 className="font-pixel text-[10px] text-[#5ad0c0] mb-3">HISTÓRICO DE PARTIDAS</h3>
            {matches.length === 0 ? (
              <div className="text-[#5f7880] text-center py-8">Nenhuma partida jogada ainda. Volte aqui após sua primeira batalha!</div>
            ) : (
              <div className="space-y-1.5">
                {matches.map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 p-2 border-l-4 ${m.result === 'win' ? 'border-[#40c060] bg-[#0d1f14]' : 'border-[#c04040] bg-[#1f0d0d]'}`}>
                    <span className={`font-pixel text-[9px] w-16 ${m.result === 'win' ? 'text-[#80e0a0]' : 'text-[#ff9090]'}`}>{m.result === 'win' ? 'VITÓRIA' : 'DERROTA'}</span>
                    <HeroPortrait hero={HERO_BY_ID[m.hero]} size={28} />
                    <span className="text-[15px] text-[#e8d8b0] w-24">{HERO_BY_ID[m.hero].name}</span>
                    <span className="text-[14px] text-[#9ab0b8]">{m.k}/{m.d}/{m.a} · {m.cs} CS · {fmtTime(m.time)}</span>
                    <span className="text-[13px] text-[#5f7880] ml-auto">{new Date(m.date).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
               </div>
            )}
          </div>
        )}

        {tab === 'multiplayer' && (
          <MultiplayerLobby onPlay={() => start()} />
        )}

        {tab === 'profile' && (
          <ProfileCareer profile={profile} />
        )}
      </main>

      {showSettings && (
        <SettingsModal profile={profile} onClose={() => setShowSettings(false)} onReset={() => { resetProfile(); onEditName('Invocador'); setShowSettings(false); window.location.reload(); }} />
      )}
      {showSkins && (
        <SkinsModal profile={profile} onClose={() => setShowSkins(false)} onUpdate={(p) => onUpdateProfile(p)} />
      )}
      {showRunes && (
        <RunesModal profile={profile} onClose={() => setShowRunes(false)}
          onSave={(runePage, runePages) => {
            const p = { ...profile, runePage, runePages };
            saveProfile(p); onUpdateProfile(p);
          }} />
      )}
    </div>
  );
}

// ================= COLEÇÃO DE SKINS =================
function SkinsModal({ profile, onClose, onUpdate }: { profile: Profile; onClose: () => void; onUpdate: (p: Profile) => void }) {
  const [heroId, setHeroId] = useState(profile.mainHero);
  const hero = HERO_BY_ID[heroId];
  const skins = SKINS_BY_HERO[heroId] ?? [];
  const owned = (id: string) => profile.ownedSkins.includes(id);
  const equipped = profile.equippedSkins[heroId];
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const flash = (m: { t: string; ok: boolean }) => { setMsg(m); setTimeout(() => setMsg(null), 1600); };

  const costOf = (s: Skin) => s.rarity === 'comum' ? 300 : s.rarity === 'rara' ? 600 : s.rarity === 'épica' ? 1200 : 2000;

  // preview canvas com a skin aplicada
  const SkinPreview = ({ id, size, animated = false }: { id: string; size: number; animated?: boolean }) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const skin = id === 'base' ? null : SKIN_BY_ID[id];
    const frame = animated ? Math.floor(Math.sin(Date.now() / 300)) : 0;
    useEffect(() => {
      const cv = ref.current!; const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
      const look = skin ? applySkin(hero.look, skin) : hero.look;
      const spr = drawHeroSprite(look, 0, frame, 'idle');
      ctx.drawImage(spr, -spr.width / 4, -6, spr.width * 1.5, spr.height * 1.5);
    });
    return <canvas ref={ref} width={size} height={size} className="pixelated" style={{ width: size, height: size }} />;
  };

  const heroesWithSkins = HEROES.filter(h => (SKINS_BY_HERO[h.id] ?? []).length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 font-body" onClick={onClose}>
      <div className="bg-[#0e151d] border-4 border-[#8c6a20] w-[940px] max-w-[97vw] max-h-[92vh] overflow-auto hard-shadow" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#223038] sticky top-0 bg-[#0e151d] z-10">
          <div>
            <h2 className="font-pixel text-[12px] text-[#c0a0ff]">✦ COLEÇÃO DE SKINS</h2>
            <div className="text-[13px] text-[#8aa0a8]">Seleciona um herói para trocar a aparência em batalha</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[10px] text-[#ffe080] bg-[#2a2412] px-2 py-1 border border-[#8c6a20]">💎 {profile.currency} éter</span>
            <button onClick={onClose} className="font-pixel text-[9px] px-3 py-2 bg-[#5c1e1e] text-[#ffc0b0] border-2 border-[#8c3a3a]">FECHAR</button>
          </div>
        </div>

        <div className="p-4">
          {/* seletor de herói */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {heroesWithSkins.map(h => (
              <button key={h.id} onClick={() => setHeroId(h.id)}
                className={`relative border-2 p-1 ${heroId === h.id ? 'border-[#a060ff] bg-[#1a1230]' : 'border-[#223038] bg-[#0d151c] hover:border-[#5ad0c0]'}`}>
                <HeroPortrait hero={h} size={36} />
                <div className="absolute -top-1.5 -right-1.5 text-[10px] bg-[#7c2a2a] text-[#ffc0b0] px-0.5 leading-3">{SKINS_BY_HERO[h.id]!.length}</div>
              </button>
            ))}
          </div>

          {msg && <div className={`text-[14px] text-center mb-3 py-1 border ${msg.ok ? 'text-[#8ae08a] border-[#2e6a3a] bg-[#0d1f14]' : 'text-[#ff9090] border-[#8c3a3a] bg-[#1f0d0d]'}`}>{msg.t}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {/* skin padrão */}
            <div className={`bg-[#101820] border-2 p-3 ${!equipped ? 'border-[#e8c860]' : 'border-[#223038]'}`}>
              <div className="flex justify-center bg-gradient-to-b from-[#0a1410] to-[#161e1a] py-2">
                <SkinPreview id="base" size={72} animated />
              </div>
              <div className="mt-2 font-pixel text-[8px] text-[#e8d8b0]">{hero.name}</div>
              <div className="text-[13px] text-[#5f7880]">Aparência padrão</div>
              <button disabled={!equipped} onClick={() => { onUpdate(unequipSkin(profile, heroId)); flash({ t: 'Skin padrão equipada!', ok: true }); }}
                className={`mt-2 w-full font-pixel text-[8px] py-1.5 border-2 ${equipped ? 'bg-[#2e6a3a] text-[#c0ffc0] border-[#40c060]' : 'bg-[#1a2430] text-[#5f7880] border-[#223038] opacity-50'}`}>
                EQUIPADA
              </button>
            </div>

            {/* skins do herói */}
            {skins.map(s => {
              const isOwned = owned(s.id);
              const isEq = equipped === s.id;
              const rc = getSkinRarityColor(s.rarity);
              return (
                <div key={s.id} className={`bg-[#101820] border-2 p-3 flex flex-col ${isEq ? 'border-[#e8c860]' : 'border-[#223038]'}`}>
                  <div className={`flex justify-center bg-gradient-to-b from-[#0a1410] to-[#1a1224] py-2 ${s.mods?.auraColor ? 'sparkle' : ''}`}
                    style={s.mods?.auraColor ? { border: `1px solid ${s.mods.auraColor}55` } : {}}>
                    <SkinPreview id={s.id} size={72} animated />
                  </div>
                  <div className="mt-2 font-pixel text-[8px] text-[#e8d8b0]">{s.name}</div>
                  <div className="text-[11px]" style={{ color: rc }}>{s.rarity.toUpperCase()}</div>
                  <div className="text-[12px] text-[#7a909a] leading-tight mt-0.5 flex-1">{s.desc}</div>
                  {isOwned ? (
                    <button disabled={isEq} onClick={() => { onUpdate(equipSkin(profile, heroId, s.id)); flash({ t: `${s.name} equipada!`, ok: true }); }}
                      className={`mt-2 w-full font-pixel text-[8px] py-1.5 border-2 ${isEq ? 'bg-[#2a2412] text-[#ffe080] border-[#e8c860]' : 'bg-[#2e6a3a] text-[#c0ffc0] border-[#40c060]'}`}>
                      {isEq ? 'EQUIPADA ✓' : 'EQUIPAR'}
                    </button>
                  ) : (
                    <div>
                      <button onClick={() => {
                        const r = buySkin(profile, s.id, costOf(s));
                        if (r.ok && r.profile) { onUpdate(r.profile); flash({ t: `${s.name} comprada!`, ok: true }); }
                        else flash({ t: r.error || 'Erro', ok: false });
                      }} disabled={profile.currency < costOf(s)}
                        className="w-full font-pixel text-[8px] py-1.5 border-2 bg-[#5a2e7a] text-[#e0c0ff] border-[#8c5ae0] hover:bg-[#6a3a8c] disabled:opacity-40">
                        COMPRAR · {costOf(s)} 💎
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-[#161024] border-l-4 border-[#8c5ae0] p-3 text-[13px] text-[#9ab0b8]">
            <b className="text-[#c0a0ff]">💡 Como ganhar éter:</b> Você ganha <b className="text-[#ffe080]">+150 éter</b> por vitória e <b className="text-[#ffe080]">+60</b> por derrota (mais bônus por abates). Skins lendárias mudam a cor da aura, rastro e partículas do herói em batalha!
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= MULTIPLAYER LOBBY =================
function MultiplayerLobby({ onPlay }: { onPlay: () => void }) {
  const { conn, status, queueMode, queueRequiredPlayers } = useConnection();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(value => value + 1), 500);
    return () => clearInterval(interval);
  }, []);

  if (status !== 'online') {
    return (
      <div className="pixel-panel bg-[#101820] p-8 text-center max-w-2xl mx-auto">
        <div className="text-5xl mb-3">🌐</div>
        <h2 className="font-pixel text-[11px] text-[#e8c860] mb-2">MULTIPLAYER INDISPONÍVEL</h2>
        <p className="text-[15px] text-[#9ab0b8] mb-2 leading-snug">
          O servidor autoritativo está offline. O modo treino local continua disponível sem alterar o progresso online.
        </p>
        <div className="bg-[#0d151c] border border-[#223038] p-3 my-4 text-left text-[13px] text-[#7a909a] font-body">
          <div className="text-[#5ad0c0] font-pixel text-[8px] mb-1">▶ DESENVOLVIMENTO LOCAL</div>
          <div>1. <code className="text-[#e8d8b0]">cd server</code></div>
          <div>2. <code className="text-[#e8d8b0]">npm install</code></div>
          <div>3. <code className="text-[#e8d8b0]">npm run dev</code> (porta 3001)</div>
        </div>
        <button onClick={onPlay} className="font-pixel text-[10px] px-6 py-3 bg-[#1a2c40] text-[#80c0ff] border-2 border-[#2a4a6c] hover:bg-[#22344a] transition-all">
          🤖 JOGAR VS BOTS
        </button>
      </div>
    );
  }

  const queueLabel =
    queueMode === 'duel1v1' ? 'DUELO 1V1' :
    queueMode === 'skirmish3v3' ? 'ESCARAMUÇA 3V3' :
    'RANQUEADA 5V5';

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="pixel-panel bg-[#101820] p-5 text-center border-[#6a4f24]">
          <div className="text-4xl mb-2">⚔️</div>
          <h2 className="font-pixel text-[11px] text-[#e8c860] mb-2">DUELO AUTORITATIVO 1V1</h2>
          <p className="text-[14px] text-[#9ab0b8] min-h-16">
            Vertical slice de menor escala para validar prediction, reconciliation, Q, lane, torre e vitória.
          </p>
          <button
            disabled={conn.inQueue}
            onClick={() => conn.joinQueue('duel1v1')}
            className="mt-4 w-full font-pixel text-[9px] py-3 bg-[#61431f] text-[#ffe9a6] border-2 border-[#a77a31] disabled:opacity-40 hover:bg-[#795528]"
          >
            ⚔ ENTRAR NO DUELO
          </button>
        </div>

        <div className="pixel-panel bg-[#101820] p-5 text-center border-[#315875]">
          <div className="text-4xl mb-2">🛡️</div>
          <h2 className="font-pixel text-[11px] text-[#8ac8ff] mb-2">ESCARAMUÇA 3V3</h2>
          <p className="text-[14px] text-[#9ab0b8] min-h-16">
            Seis jogadores reais, equipes 3v3 e janela autoritativa de reconnect antes de um abandono por desconexão.
          </p>
          <button
            disabled={conn.inQueue}
            onClick={() => conn.joinQueue('skirmish3v3')}
            className="mt-4 w-full font-pixel text-[9px] py-3 bg-[#244b66] text-[#cceaff] border-2 border-[#3f7fa8] disabled:opacity-40 hover:bg-[#2e5e7f]"
          >
            🛡 ENTRAR NO 3V3
          </button>
        </div>

        <div className="pixel-panel bg-[#101820] p-5 text-center">
          <div className="text-4xl mb-2">🏰</div>
          <h2 className="font-pixel text-[11px] text-[#5ad0c0] mb-2">RANQUEADA 5V5 — FUNDAÇÃO</h2>
          <p className="text-[14px] text-[#9ab0b8] min-h-16">
            Preserva a fila de 10 jogadores para a evolução do MOBA completo; ainda usa o slice de lane autoritativo.
          </p>
          <button
            disabled={conn.inQueue}
            onClick={() => conn.joinQueue('ranked5v5')}
            className="mt-4 w-full font-pixel text-[9px] py-3 bg-[#245237] text-[#c0ffd8] border-2 border-[#3c8a59] disabled:opacity-40 hover:bg-[#2f6847]"
          >
            🔎 ENTRAR NA FILA 5V5
          </button>
        </div>
      </div>

      {conn.inQueue && (
        <div className="pixel-panel bg-[#0c151d] p-5 text-center">
          <div className="font-pixel text-[11px] text-[#e8c860] animate-pulse">PROCURANDO · {queueLabel}</div>
          <div className="flex justify-center gap-1 my-3">
            {[0, 1, 2, 3, 4].map(index => (
              <div
                key={index}
                className="w-3 h-8 bg-[#2a4a6c]"
                style={{ opacity: 0.3 + Math.abs(Math.sin(tick * 0.5 + index)) * 0.7 }}
              />
            ))}
          </div>
          <div className="text-[14px] text-[#9ab0b8]">
            Posição: <b className="text-[#e8c860]">{conn.queuePos ?? '—'}</b>
            {' · '}alvo: <b className="text-[#5ad0c0]">
              {queueRequiredPlayers || (queueMode === 'duel1v1' ? 2 : queueMode === 'skirmish3v3' ? 6 : 10)} jogadores
            </b>
            {conn.queueEta > 0 && <> · ~{conn.queueEta}s estimado</>}
          </div>
          <button
            onClick={() => conn.leaveQueue()}
            className="mt-3 font-pixel text-[9px] px-6 py-2 bg-[#5c1e1e] text-[#ffc0b0] border-2 border-[#8c3a3a] hover:bg-[#7c2a2a]"
          >
            ✖ CANCELAR
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="pixel-panel bg-[#101820] p-4 text-center">
          <div className="font-pixel text-[8px] text-[#5ad0c0] mb-1">JOGADORES ONLINE</div>
          <div className="font-pixel text-[16px] text-[#80e0a0]">{conn.serverInfo?.players ?? '?'}</div>
        </div>
        <div className="pixel-panel bg-[#101820] p-4 text-center">
          <div className="font-pixel text-[8px] text-[#5ad0c0] mb-1">MATCHES ATIVOS</div>
          <div className="font-pixel text-[16px] text-[#e8c860]">{conn.serverInfo?.activeMatches ?? 0}</div>
        </div>
        <div className="pixel-panel bg-[#101820] p-4 text-center">
          <div className="font-pixel text-[8px] text-[#5ad0c0] mb-1">RECONNECT</div>
          <div className="font-pixel text-[10px] text-[#8ac8ff] mt-1.5">
            {Math.round((conn.serverInfo?.reconnectGraceMs ?? 30000) / 1000)}s GRACE
          </div>
        </div>
      </div>

      <button onClick={onPlay} className="w-full font-pixel text-[9px] py-3 bg-[#1a2430] text-[#a0d0ff] border-2 border-[#2a4a6c] hover:bg-[#22344a]">
        🤖 PARTIDA TREINO VS BOTS
      </button>
    </div>
  );
}

// ================= PERFIL DE CARREIRA =================
function ProfileCareer({ profile }: { profile: Profile }) {
  const games = profile.totalMatches;
  const wr = games > 0 ? Math.round((profile.wins / games) * 100) : 0;
  const avgK = games > 0 ? (profile.kills / games).toFixed(1) : '0';
  const avgD = games > 0 ? (profile.deaths / games).toFixed(1) : '0';
  const avgA = games > 0 ? (profile.assists / games).toFixed(1) : '0';
  const avgKDA = profile.deaths > 0 ? ((profile.kills + profile.assists) / profile.deaths).toFixed(2) : '∞';
  const avgCS = games > 0 ? Math.round(profile.cs / games) : 0;
  const hrs = Math.floor(profile.timePlayed / 3600);
  const mins = Math.floor((profile.timePlayed % 3600) / 60);

  const mastery = Object.entries(profile.heroStats)
    .map(([id, s]) => ({ id, s, wr: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0, kda: s.d > 0 ? ((s.k + s.a) / s.d).toFixed(2) : '∞' }))
    .sort((a, b) => b.s.games - a.s.games);

  const big = (label: string, value: string, color: string) => (
    <div className="bg-[#0d151c] border-2 border-[#223038] p-3 text-center">
      <div className="font-pixel text-[14px]" style={{ color }}>{value}</div>
      <div className="text-[12px] text-[#5f7880] mt-1">{label}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="pixel-panel bg-[#101820] p-5">
        <h2 className="font-pixel text-[11px] text-[#5ad0c0] mb-3">📊 ESTATÍSTICAS DE CARREIRA</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {big('Partidas', String(games), '#e8d8b0')}
          {big('Vitórias', String(profile.wins), '#80e0a0')}
          {big('Win Rate', `${wr}%`, '#40c060')}
          {big('KDA médio', avgKDA, '#e8c860')}
          {big('CS médio', String(avgCS), '#ffe080')}
          {big('Tempo jogado', hrs > 0 ? `${hrs}h${mins}m` : `${mins}m`, '#8accff')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {big('Total de Abates', String(profile.kills), '#80e0a0')}
          {big('Total de Mortes', String(profile.deaths), '#ff9090')}
          {big('Total de Assist.', String(profile.assists), '#8accff')}
          {big('Ouro total', `${(profile.gold / 1000).toFixed(1)}k`, '#ffe080')}
        </div>
        <div className="text-[14px] text-[#8aa0a8] mt-3 text-center">
          Média por partida: <span className="text-[#e8d8b0]">{avgK} / {avgD} / {avgA}</span>
        </div>
      </div>

      <div className="pixel-panel bg-[#101820] p-5">
        <h2 className="font-pixel text-[11px] text-[#5ad0c0] mb-3">🏆 MAESTRIA DE HERÓIS</h2>
        {mastery.length === 0 ? (
          <div className="text-[15px] text-[#5f7880] text-center py-6">Jogue algumas partidas para ver sua maestria de heróis aqui!</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {mastery.map(m => {
              const hero = HERO_BY_ID[m.id];
              if (!hero) return null;
              const pts = m.s.games * 100 + m.s.wins * 250;
              return (
                <div key={m.id} className="flex items-center gap-3 bg-[#0d151c] border border-[#223038] p-2">
                  <HeroPortrait hero={hero} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="font-pixel text-[9px] text-[#e8c860] truncate">{hero.name}</span>
                      <span className="text-[12px] text-[#5f7880]">{m.s.games} jogo{m.s.games !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-3 text-[13px] text-[#9ab0b8]">
                      <span>{m.s.k}/{m.s.d}/{m.s.a}</span>
                      <span className="text-[#ffe080]">{m.wr}% V</span>
                      <span className="text-[#8accff]">{m.kda} KDA</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-pixel text-[11px] text-[#5ad0c0]">{pts}</div>
                    <div className="text-[10px] text-[#5f7880]">pontos</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= CONFIGURAÇÕES =================
function SettingsModal({ profile, onClose, onReset }: { profile: Profile; onClose: () => void; onReset: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { conn, status } = useConnection();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onClick={onClose}>
      <div className="bg-[#0e151d] border-4 border-[#8c6a20] p-5 w-[440px] max-w-[94vw] hard-shadow" onClick={e => e.stopPropagation()}>
        <h2 className="font-pixel text-[11px] text-[#e8c860] mb-4">⚙ CONFIGURAÇÕES</h2>

        <div className="space-y-3">
          <div className="bg-[#101820] border border-[#223038] p-3">
            <div className="font-pixel text-[9px] text-[#5ad0c0] mb-2">🔊 ÁUDIO</div>
            <button onClick={() => { setMuted(!isMuted()); }} className={`w-full font-pixel text-[9px] py-2 border-2 ${isMuted() ? 'bg-[#5c1e1e] border-[#8c3a3a] text-[#ffc0b0]' : 'bg-[#1a2c24] border-[#40c060] text-[#80e0a0]'}`}>
              {isMuted() ? '🔇 SOM DESLIGADO' : '🔊 SOM LIGADO'}
            </button>
          </div>

          <div className="bg-[#101820] border border-[#223038] p-3">
            <div className="font-pixel text-[9px] text-[#5ad0c0] mb-2">🎮 CONTA & SESSÃO</div>
            <div className="flex justify-between text-[14px] mb-1"><span className="text-[#8aa0a8]">Nome de perfil</span><span className="text-[#e8d8b0]">{profile.name}</span></div>
            <div className="flex justify-between text-[14px] mb-1"><span className="text-[#8aa0a8]">Nível</span><span className="text-[#ffe080]">{profile.level}</span></div>
            <div className="flex justify-between text-[14px] mb-1"><span className="text-[#8aa0a8]">Rank</span><span className="text-[#e8c860]">{getRank(profile)}</span></div>
            <div className="flex justify-between text-[14px] mb-1"><span className="text-[#8aa0a8]">Partidas</span><span className="text-[#b8c8d0]">{profile.totalMatches}</span></div>
            <div className="border-t border-[#223038] mt-2 pt-2">
              <div className="flex justify-between text-[14px] mb-1">
                <span className="text-[#8aa0a8]">Sessão online</span>
                <span className={status === 'online' ? 'text-[#40c060]' : 'text-[#ff9090]'}>{status === 'online' ? '● Online' : '● Offline'}</span>
              </div>
              <div className="flex justify-between text-[14px] mb-2">
                <span className="text-[#8aa0a8]">Modo</span>
                <span className={conn.user?.mode === 'account' ? 'text-[#80c0ff]' : 'text-[#9ab0b8]'}>{conn.user?.mode === 'account' ? 'Conta (sincronizada)' : 'Convidado (local)'}</span>
              </div>
              {conn.user?.mode === 'account' && (
                <button onClick={() => conn.logout()} className="w-full font-pixel text-[9px] py-1.5 border-2 border-[#8c3a3a] bg-[#3a1414] text-[#ffc0b0] hover:bg-[#5c1e1e]">↩ SAIR DA CONTA</button>
              )}
            </div>
          </div>

          <div className="bg-[#101820] border border-[#5c1e1e] p-3">
            <div className="font-pixel text-[9px] text-[#ff9090] mb-2">⚠ ZONA DE PERIGO</div>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} className="w-full font-pixel text-[9px] py-2 border-2 border-[#8c3a3a] bg-[#3a1414] text-[#ffc0b0] hover:bg-[#5c1e1e]">
                🗑 APAGAR PERFIL E HISTÓRICO
              </button>
            ) : (
              <div>
                <p className="text-[14px] text-[#ff9090] mb-2">Tem certeza? Todo o progresso será perdido!</p>
                <div className="flex gap-2">
                  <button onClick={onReset} className="flex-1 font-pixel text-[9px] py-2 border-2 border-[#8c3a3a] bg-[#5c1e1e] text-white">SIM, APAGAR</button>
                  <button onClick={() => setConfirmReset(false)} className="flex-1 font-pixel text-[9px] py-2 border-2 border-[#223038] bg-[#101820] text-[#9ab0b8]">CANCELAR</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-4 font-pixel text-[9px] py-2 bg-[#1a2430] text-[#a0d0ff] border-2 border-[#2a4a6c]">FECHAR</button>
      </div>
    </div>
  );
}

// ================= LOJA =================
const RECOS: Record<string, string[]> = {
  gareth: ['sunfire', 'warmog', 'frozenmallet', 'thornmail', 'ninjatabi'],
  anya: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  ashka: ['infinityedge', 'phantomdancer', 'bloodthirster', 'berserker'],
  yamir: ['bloodthirster', 'infinityedge', 'phantomdancer', 'berserker'],
  rizar: ['deathcap', 'banshee', 'voidstaff', 'sorcshoes'],
  timo: ['deathcap', 'frozenmallet', 'sorcshoes', 'phantomdancer'],
  luxana: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  darion: ['frozenmallet', 'sunfire', 'warmog', 'ninjatabi'],
  katya: ['deathcap', 'zhonya', 'sorcshoes', 'voidstaff'],
  blitz: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  warrik: ['bloodthirster', 'frozenmallet', 'warmog', 'ninjatabi'],
  morgause: ['zhonya', 'deathcap', 'banshee', 'sorcshoes'],
  jaina: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  thresk: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  jinxara: ['infinityedge', 'phantomdancer', 'bloodthirster', 'berserker'],
  yasuke: ['bloodthirster', 'infinityedge', 'phantomdancer', 'berserker'],
  zedric: ['infinityedge', 'youmuus', 'phantomdancer', 'berserker'],
  sonara: ['deathcap', 'zhonya', 'banshee', 'sorcshoes'],
  malzahar: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  nidalee: ['infinityedge', 'phantomdancer', 'bloodthirster', 'berserker'],
  akali: ['infinityedge', 'youmuus', 'phantomdancer', 'berserker'],
  braum: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  // 25 heróis originais — recomendações de build
  volcarn: ['sunfire', 'blackcleaver', 'warmog', 'ninjatabi'],
  aethel: ['infinityedge', 'phantomdancer', 'berserker', 'frozenmallet'],
  cogsworth: ['sunfire', 'thornmail', 'warmog', 'spiritvisage'],
  myrmidon: ['deathcap', 'voidstaff', 'liandrys', 'sorcshoes'],
  noctara: ['bloodthirster', 'youmuus', 'infinityedge', 'berserker'],
  kragmar: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  solanis: ['deathcap', 'spiritvisage', 'zhonya', 'sorcshoes'],
  umbrath: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  thornveil: ['sunfire', 'frozenmallet', 'warmog', 'thornmail'],
  glimmerfin: ['infinityedge', 'phantomdancer', 'berserker', 'frozenmallet'],
  ironpeak: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  vesper: ['deathcap', 'spiritvisage', 'zhonya', 'sorcshoes'],
  cinderfox: ['infinityedge', 'phantomdancer', 'berserker', 'frozenmallet'],
  galen: ['deathcap', 'spiritvisage', 'zhonya', 'sorcshoes'],
  riftborn: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  boulderback: ['sunfire', 'thornmail', 'warmog', 'ninjatabi'],
  shrike: ['bloodthirster', 'youmuus', 'infinityedge', 'berserker'],
  mossheart: ['sunfire', 'thornmail', 'warmog', 'spiritvisage'],
  vexfire: ['infinityedge', 'phantomdancer', 'berserker', 'frozenmallet'],
  tideweaver: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  grimfang: ['bloodthirster', 'frozenmallet', 'warmog', 'berserker'],
  starcaller: ['deathcap', 'voidstaff', 'zhonya', 'sorcshoes'],
  rustjaw: ['infinityedge', 'phantomdancer', 'berserker', 'frozenmallet'],
  frostbite: ['sunfire', 'frozenmallet', 'warmog', 'ninjatabi'],
  lumen: ['deathcap', 'spiritvisage', 'zhonya', 'sorcshoes'],
};

function Shop({ snap, game, hero, onClose }: { snap: Snapshot; game: Game; hero: HeroDef; onClose: () => void }) {
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [sel, setSel] = useState<string>(RECOS[hero.id]?.[0] ?? 'infinityedge');
  const [search, setSearch] = useState('');
  const item = ITEM_BY_ID[sel];
  const { cost } = componentDiscount(sel, snap.items);
  const canAfford = snap.gold >= cost && snap.canShop;
  const buy = () => {
    const err = game.buyItem(sel);
    if (err) { setMsg({ t: err, ok: false }); sfx.error(); }
    else { setMsg({ t: `${item.name} comprado!`, ok: true }); sfx.buy(); }
    setTimeout(() => setMsg(null), 1600);
  };
  const STAT_L: Record<string, string> = { ad: 'Dano de Ataque', ap: 'Poder de Habilidade', hp: 'Vida', mp: 'Mana', armor: 'Armadura', mr: 'Resist. Mágica', as: 'Vel. de Ataque', ms: 'Vel. de Movimento', crit: 'Chance de Crítico', lifesteal: 'Roubo de Vida', hpRegen: 'Regen. Vida', mpRegen: 'Regen. Mana', mpen: 'Penetração Mágica' };
  const tiers: { label: string; list: ItemDef[] }[] = [
    { label: 'RECOMENDADOS', list: (RECOS[hero.id] ?? []).map(id => ITEM_BY_ID[id]).filter(Boolean) },
    { label: 'COMPONENTES', list: ITEMS.filter(i => i.tier === 1) },
    { label: 'INTERMEDIÁRIOS', list: ITEMS.filter(i => i.tier === 2) },
    { label: 'LENDÁRIOS', list: ITEMS.filter(i => i.tier === 3) },
  ].map(t => ({ ...t, list: search ? t.list.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : t.list }));
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 font-body" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0e151d] border-4 border-[#8c6a20] w-[860px] max-w-[96vw] max-h-[92vh] overflow-auto p-4 text-[#d8e4e8] hard-shadow">
        <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel text-[12px] text-[#e8c860]">🛒 LOJA DE ITENS</h2>
            <span className="font-pixel text-[10px] text-[#1a1408] bg-[#e8c860] px-2 py-1">🪙 {snap.gold}</span>
          </div>
          <input value={search} onChange={ev => setSearch(ev.target.value)} placeholder="🔍 Buscar item..."
            className="bg-[#0d151c] border-2 border-[#223038] px-2 py-1.5 text-[14px] text-[#e8d8b0] w-40 focus:border-[#e8c860] outline-none" />
          <button onClick={onClose} className="font-pixel text-[9px] px-3 py-2 bg-[#5c1e1e] hover:bg-[#7c2a2a] border-2 border-[#8c3a3a] text-[#ffc0b0] transition-colors">FECHAR (P)</button>
        </div>
        {!snap.canShop && <div className="text-[#ff8080] text-[15px] mb-2 bg-[#3a1414] border border-[#7c2a2a] px-2 py-1">⚠ Volte à sua base (fonte) para comprar itens!</div>}
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="flex-1 min-w-0">
            {tiers.map(t => (
              <div key={t.label} className="mb-3">
                <div className={`text-[13px] font-pixel text-[8px] mb-1.5 ${t.label === 'RECOMENDADOS' ? 'text-[#5ad0c0]' : 'text-[#5f7880]'}`}>
                  {t.label === 'RECOMENDADOS' ? `★ ${t.label} PARA ${hero.name.toUpperCase()}` : t.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.list.map(i => {
                    const ownedComp = snap.items.includes(i.id);
                    return (
                      <button key={i.id} onClick={(ev) => {
                        if (ev.ctrlKey || ev.metaKey) {
                          // compra rápida com Ctrl+clique
                          const err = game.buyItem(i.id);
                          if (err) { setMsg({ t: err, ok: false }); sfx.error(); }
                          else { setMsg({ t: `${i.name} comprado!`, ok: true }); sfx.buy(); }
                          setTimeout(() => setMsg(null), 1600);
                        } else { setSel(i.id); sfx.click(); }
                      }} title={`${i.name} (Ctrl+clique = compra rápida)`}
                        className={`relative border-2 transition-all hover:-translate-y-0.5 ${sel === i.id ? 'border-[#e8c860]' : 'border-transparent'} ${ownedComp ? 'ring-2 ring-[#40c060]' : ''}`}>
                        <ItemIcon item={i} size={46} />
                        <div className="text-[10px] text-[#ffe080] bg-black/85 absolute bottom-0 inset-x-0 text-center leading-3">{i.totalCost}</div>
                        {ownedComp && <div className="absolute -top-1.5 -right-1.5 text-[10px] bg-[#40c060] text-black px-0.5 leading-3">✓</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="w-full md:w-72 bg-[#131c26] border-2 border-[#223038] p-3 shrink-0 self-start">
            <div className="flex items-center gap-2.5 mb-2">
              <ItemIcon item={item} size={48} />
              <div className="min-w-0">
                <div className="font-bold text-[#e8d8b0] text-[16px] leading-4">{item.name}</div>
                <div className="text-[14px] text-[#ffe080]">🪙 {item.totalCost}{cost !== item.totalCost && <span className="text-[#8af0c0]"> → {cost} c/ receita</span>}</div>
              </div>
            </div>
            <div className="text-[14px] text-[#d8e4e8] space-y-0.5 mb-2">
              {Object.entries(item.stats).map(([k, v]) => {
                const pct = ['as', 'lifesteal', 'mpen'].includes(k);
                return <div key={k} className="text-[#8ae08a]">+{pct ? Math.round((v as number) * 100) + '%' : k === 'crit' ? v + '%' : v} <span className="text-[#9ab0b8]">{STAT_L[k]}</span></div>;
              })}
            </div>
            {item.passive && <div className="text-[14px] text-[#c0a0ff] mb-2 border-l-2 border-[#8c5ae0] pl-2">✦ {item.passive}</div>}
            {item.recipe.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[12px] text-[#5f7880] mb-1">RECEITA:</div>
                <div className="flex gap-1.5 items-center flex-wrap">
                  {item.recipe.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <button onClick={() => setSel(r)} title={ITEM_BY_ID[r].name} className="hover:-translate-y-0.5 transition-transform">
                        <ItemIcon item={ITEM_BY_ID[r]} size={32} />
                      </button>
                      {i < item.recipe.length - 1 && <span className="text-[#5f7880]">+</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={buy} disabled={!canAfford}
              className={`w-full py-2.5 font-pixel text-[9px] border-2 transition-all ${canAfford ? 'bg-[#2e6a3a] hover:bg-[#3a8c4a] border-[#40c060] text-[#c0ffc0] hover:-translate-y-0.5' : 'bg-[#1e2c34] border-[#2a3a42] text-[#5f7880] cursor-not-allowed'}`}>
              COMPRAR · {cost} 🪙
            </button>
            <button onClick={() => {
              const err = game.undoPurchase();
              if (err) { setMsg({ t: err, ok: false }); sfx.error(); }
              else { setMsg({ t: 'Compra desfeita!', ok: true }); sfx.click(); }
              setTimeout(() => setMsg(null), 1600);
            }} className="w-full mt-1.5 py-1.5 font-pixel text-[8px] border border-[#3a3a42] bg-[#1a1a22] text-[#8a8a9a] hover:text-[#ffc0b0] hover:border-[#743739] transition-all">
              ↩ DESFAZER ÚLTIMA COMPRA (10s)
            </button>
            {msg && <div className={`text-[14px] text-center mt-1.5 ${msg.ok ? 'text-[#8af0c0]' : 'text-[#ff9090]'}`}>{msg.t}</div>}
            <div className="mt-3 border-t-2 border-[#223038] pt-2">
              <div className="text-[12px] text-[#5f7880] mb-1">INVENTÁRIO ({snap.items.length}/6) · clique p/ vender 70%</div>
              <div className="flex gap-1 flex-wrap min-h-9">
                {snap.items.map((id, i) => (
                  <button key={i} onClick={() => { game.sellItem(i); sfx.gold(); }} title={`Vender ${ITEM_BY_ID[id].name}`} className="hover:-translate-y-0.5 transition-transform">
                    <ItemIcon item={ITEM_BY_ID[id]} size={32} />
                  </button>
                ))}
                {snap.items.length === 0 && <div className="text-[13px] text-[#3a5058]">— vazio —</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= HUD =================
function HUD({ snap, hero, onShop, muted, onMute, onUp, onPing, onChat, onBuyback }: { snap: Snapshot; hero: HeroDef; onShop: () => void; muted: boolean; onMute: () => void; onUp: (s: AbilitySlot) => void; onPing: (kind: 'danger' | 'omw' | 'missing' | 'assist') => void; onChat: (text: string) => void; onBuyback: () => void }) {
  const [showBoard, setShowBoard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showPingWheel, setShowPingWheel] = useState(false);
  const [hoverAb, setHoverAb] = useState<AbilitySlot | null>(null);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); setShowBoard(true); }
      if (e.key === 'h' || e.key === 'H') setShowHelp(v => !v);
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Tab') setShowBoard(false); };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);
  const hpPct = (snap.hp / snap.maxHp) * 100;
  return (
    <div className="absolute inset-0 pointer-events-none select-none font-body">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-stretch gap-0 pointer-events-auto">
        <div className="bg-[#0d1a2e]/95 border-2 border-[#2a4a7c] px-3 py-1 flex items-center gap-2">
          <span className="font-pixel text-[11px] text-[#80c0ff]">{snap.teamKills[0]}</span>
          <span className="text-[12px] text-[#5f7880]">{snap.towersLeft[0]}🏰</span>
        </div>
        <div className="bg-[#0e151d]/95 border-y-2 border-[#8c6a20] px-4 py-1 text-center min-w-32">
          <div className="font-pixel text-[10px] text-[#e8c860] leading-4">{fmtTime(snap.time)}</div>
          <div className={`text-[13px] leading-3 ${snap.goldDiff >= 0 ? 'text-[#8ae08a]' : 'text-[#ff9090]'}`}>
            {snap.goldDiff >= 0 ? '▲' : '▼'} {Math.abs(snap.goldDiff)} ouro
          </div>
        </div>
        <div className="bg-[#2a0d0d]/95 border-2 border-[#7c2a2a] px-3 py-1 flex items-center gap-2">
          <span className="text-[12px] text-[#5f7880]">🏰{snap.towersLeft[1]}</span>
          <span className="font-pixel text-[11px] text-[#ff8080]">{snap.teamKills[1]}</span>
        </div>
      </div>

      {snap.target && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 border-2 border-[#7c2a2a] px-3 py-1 flex items-center gap-2 min-w-56">
          <span className="font-pixel text-[8px] text-[#ff9090]">ALVO</span>
          <div className="flex-1">
            <div className="text-[14px] text-[#ffc0b0] leading-3">{snap.target.name} <span className="text-[#5f7880]">nv{snap.target.level}</span></div>
            <div className="h-2 bg-[#1a0808] border border-[#3a1414] mt-0.5">
              <div className="h-full bg-gradient-to-r from-[#a82020] to-[#ff5050] transition-all duration-150" style={{ width: `${(snap.target.hp / snap.target.maxHp) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-16 right-3 space-y-1 max-w-64">
        {snap.feed.slice(-4).map((f, i) => (
          <div key={`${f.t}-${i}`} className={`text-[14px] px-2 py-0.5 bg-black/70 border-l-4 animate-slidein ${f.team === 0 ? 'border-[#40a0ff] text-[#b0d8ff]' : 'border-[#ff5050] text-[#ffb0b0]'}`}>
            💀 {f.text}
          </div>
        ))}
      </div>

      {snap.banner && (
        <div key={snap.banner.id} className="absolute top-[26%] left-1/2 -translate-x-1/2 text-center animate-banner">
          <div className="font-pixel text-xl sm:text-2xl px-6 py-3 bg-black/75 border-y-4" style={{ color: snap.banner.color, borderColor: snap.banner.color, textShadow: '3px 3px 0 #000' }}>
            {snap.banner.text}
          </div>
          <div className="text-[16px] text-[#d8e4e8] bg-black/60 px-3 py-0.5 mt-1 inline-block">{snap.banner.sub}</div>
        </div>
      )}

      {snap.recalling && (
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 font-pixel text-[10px] text-[#80c0ff] bg-black/80 border-2 border-[#2a4a7c] px-4 py-2 animate-pulse">
          ⟲ RETORNANDO À BASE...
        </div>
      )}

      {/* Dica de habilidade em modo de mira */}
      {snap.aimingSkill && !snap.dead && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="aim-badge bg-black/90 border-2 border-[#e8c860] px-4 py-2 flex items-center gap-3">
            <span className="font-pixel text-[14px] text-[#e8c860]">[{snap.aimingSkill}]</span>
            <span className="text-[13px] text-[#e8d8b0]">{hero.abilities[snap.aimingSkill].name}</span>
            <span className="text-[12px] text-[#9ab0b8]">· clique <b className="text-[#40c060]">ESQ</b> para conjurar · <b className="text-[#ff6060]">ESC</b> cancela</span>
          </div>
        </div>
      )}
       {snap.dead && !snap.result && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(90,10,10,0.55), rgba(20,0,0,0.75))' }}>
          <div className="text-center space-y-4">
            <div>
              <div className="font-pixel text-2xl text-[#ff5050] title-glow-red animate-pop">VOCÊ MORREU</div>
              <div className="text-[#d8b0b0] text-lg mt-2">renascendo em <b className="font-pixel text-[14px] text-[#ffd0a0]">{Math.ceil(snap.respawnIn)}</b>s</div>
            </div>
            
            {/* ===== DOTA BUYBACK BUTTON ===== */}
            <div className="pointer-events-auto">
              {snap.buybackCd > 0 ? (
                <div className="font-pixel text-[9px] text-[#6e8490] bg-black/80 border border-[#223038] px-4 py-2 rounded">
                  🕒 COMPRA DE VOLTA EM RECARGA: <b className="text-white">{Math.ceil(snap.buybackCd)}s</b>
                </div>
              ) : (
                <button
                  onClick={onBuyback}
                  disabled={!snap.canBuyback}
                  className={`font-pixel text-[10px] px-8 py-3.5 border-4 rounded transition-all transform hover:scale-105 ${
                    snap.canBuyback
                      ? 'border-[#8c6a20] bg-[#3a2c10] text-[#ffe080] hover:bg-[#574016] cursor-pointer shadow-[0_0_16px_rgba(232,200,96,0.5)]'
                      : 'border-[#223038] bg-[#0f1418] text-[#5f7880] cursor-not-allowed opacity-50'
                  }`}
                >
                  🔔 COMPRA DE VOLTA ({snap.buybackCost} 🪙)
                </button>
              )}
              {snap.gold < snap.buybackCost && snap.buybackCd <= 0 && (
                <div className="text-[12px] text-[#ff8080] mt-1">Ouro insuficiente para Buyback! Falta: <span className="font-bold">{snap.buybackCost - snap.gold} 🪙</span></div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBoard && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#0e151d]/97 border-2 border-[#8c6a20] p-3 w-[460px] max-w-[92vw] hard-shadow">
          {([0, 1] as const).map(team => (
            <div key={team} className="mb-2 last:mb-0">
              <div className={`font-pixel text-[9px] mb-1 flex justify-between ${team === 0 ? 'text-[#80c0ff]' : 'text-[#ff8080]'}`}>
                <span>{team === 0 ? '■ TIME AZUL' : '■ TIME VERMELHO'}</span>
                <span>{snap.teamKills[team]} ABATES</span>
              </div>
              {snap.board.filter(b => b.team === team).map((b, i) => (
                <div key={i} className={`flex justify-between text-[15px] px-1.5 py-0.5 ${b.name === hero.name && team === 0 ? 'bg-[#e8c860]/15 text-[#ffe080]' : 'text-[#b8c8d0]'}`}>
                  <span>
                    <HeroPortrait hero={HERO_BY_ID[b.hero]} team={team} size={16} />
                    <b className="ml-1.5">{b.name}</b> <span className="text-[#5f7880]">nv{b.level}</span>
                    {b.isJg && <span className="text-[#c080ff] ml-1">🌲</span>}
                    {b.bounty > 300 && <span className="text-[#ffe080] ml-1">💰{b.bounty}</span>}
                  </span>
                  <span className="text-[#9ab0b8]">{b.k}/{b.d}/{b.a} · {b.cs} CS</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showHelp && (
        <div className="absolute bottom-28 left-3 bg-[#0e151d]/97 border-2 border-[#5ad0c0] p-3 text-[14px] text-[#b8c8d0] w-72 hard-shadow pointer-events-auto">
          <div className="font-pixel text-[9px] text-[#5ad0c0] mb-2">⌨ ATALHOS DE TECLADO (H fecha)</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[14px] text-[#9ab0b8]">
            <div><Key k="ESQ" /> atacar · <Key k="DIR" /> mover</div>
            <div><Key k="A" />+dir: mover-atacando</div>
            <div className="text-[#e0a040]"><Key k="Q W E R" /> conjurar</div>
            <div className="text-[#40c060]"><Key k="CTRL+QWER" /> upar habilidade</div>
            <div className="text-[#40c060]"><Key k="SHIFT+QWER" /> upar (alt.)</div>
            <div className="text-[#a0d0ff]"><Key k="D F" /> feitiços de invocador</div>
            <div><Key k="B" /> recall à base</div>
            <div><Key k="S" /> parar</div>
            <div><Key k="P" /> loja (na base)</div>
            <div><Key k="TAB" /> placar</div>
            <div><Key k="1-6" /> ativo de item</div>
            <div><Key k="G/V" /> ping tático</div>
            <div><Key k="CTRL+1-4" /> chat rápido</div>
            <div><Key k="Y" /> travar câmera</div>
            <div><Key k="ESPAÇO" /> centralizar câmera</div>
            <div><Key k="H" /> esta ajuda</div>
            <div><Key k="M" /> liga/desliga som</div>
          </div>
          <div className="text-[#5f7880] text-[12px] pt-2 mt-1 border-t border-[#223038]">💡 Você ganha <b className="text-[#40c060]">1 ponto de skill por nível</b>. R destrava no nv 6. Cada skill vai até nível 5 (R até 3).</div>
        </div>
      )}

      <div className="absolute top-2 right-2 flex gap-1.5 pointer-events-auto">
        <button onClick={() => setShowPingWheel(v => !v)} title="Pings Táticos (G)" className="w-9 h-9 bg-[#0e151d]/90 border-2 border-[#223038] hover:border-[#ffe080] font-pixel text-[10px] text-[#ffe080] transition-colors">📍</button>
        <button onClick={() => setShowChat(v => !v)} title="Chat da Partida" className="w-9 h-9 bg-[#0e151d]/90 border-2 border-[#223038] hover:border-[#80c0ff] font-pixel text-[10px] text-[#80c0ff] transition-colors">💬</button>
        <button onClick={onMute} title="Som (M)" className="w-9 h-9 bg-[#0e151d]/90 border-2 border-[#223038] hover:border-[#e8c860] text-[16px] transition-colors">{muted ? '🔇' : '🔊'}</button>
        <button onClick={() => setShowHelp(v => !v)} title="Ajuda (H)" className="w-9 h-9 bg-[#0e151d]/90 border-2 border-[#223038] hover:border-[#5ad0c0] font-pixel text-[10px] text-[#5ad0c0] transition-colors">?</button>
      </div>

      {showPingWheel && (
        <div className="absolute top-12 right-2 bg-[#0e151d]/98 border-2 border-[#ffe080] p-2 flex flex-col gap-1.5 z-50 hard-shadow pointer-events-auto">
          <div className="font-pixel text-[8px] text-[#ffe080] mb-1">PING TÁTICO</div>
          <button onClick={() => { onPing('danger'); setShowPingWheel(false); }} className="text-left px-2 py-1 bg-[#3a1414] hover:bg-[#5a1e1e] border border-[#ff5050] text-[#ffb0b0] text-[14px]">⚠️ Perigo</button>
          <button onClick={() => { onPing('omw'); setShowPingWheel(false); }} className="text-left px-2 py-1 bg-[#10243a] hover:bg-[#1a385a] border border-[#40c0ff] text-[#b0e0ff] text-[14px]">🏃 A Caminho</button>
          <button onClick={() => { onPing('missing'); setShowPingWheel(false); }} className="text-left px-2 py-1 bg-[#3a3010] hover:bg-[#5a4818] border border-[#ffe080] text-[#ffe0a0] text-[14px]">❓ Inimigo MIA</button>
          <button onClick={() => { onPing('assist'); setShowPingWheel(false); }} className="text-left px-2 py-1 bg-[#103a20] hover:bg-[#185a30] border border-[#40ff80] text-[#b0ffc0] text-[14px]">🆘 Ajuda</button>
        </div>
      )}

      {showChat && (
        <div className="absolute bottom-28 left-4 w-80 bg-[#0e151d]/95 border-2 border-[#2a4a7c] p-2 hard-shadow pointer-events-auto z-40">
          <div className="font-pixel text-[8px] text-[#80c0ff] mb-1 flex justify-between">
            <span>CHAT DA PARTIDA</span>
            <button onClick={() => setShowChat(false)} className="text-[#ff8080]">✕</button>
          </div>
          <div className="h-32 overflow-y-auto space-y-1 text-[13px] border border-[#1e2c34] p-1.5 bg-black/50 mb-1.5">
            {snap.chat.map((c, i) => (
              <div key={i} className="leading-snug">
                <span className={`font-bold ${c.team === 0 ? 'text-[#80c0ff]' : 'text-[#ff8080]'}`}>[{c.sender}]: </span>
                <span className="text-[#d8e4e8]">{c.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) { onChat(chatInput.trim()); setChatInput(''); } }} className="flex gap-1">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Digite para o time..." className="flex-1 bg-[#101820] border border-[#2a3a42] px-2 py-0.5 text-[13px] text-[#e8d8b0]" maxLength={50} />
            <button type="submit" className="font-pixel text-[8px] px-2 bg-[#2a4a7c] hover:bg-[#3a6aac] text-white">ENVIAR</button>
          </form>
        </div>
      )}

      {/* indicador de pontos de habilidade */}
      {snap.skillPoints > 0 && (
        <div className="absolute top-12 right-2 bg-[#0e151d]/95 border-2 border-[#40c060] px-3 py-1.5 animate-pulse pointer-events-auto">
          <div className="font-pixel text-[9px] text-[#80ff80]">+{snap.skillPoints} PONTOS!</div>
          <div className="text-[12px] text-[#9ab0b8]">Ctrl+QWER p/ upar</div>
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 pb-2">
        <div className="flex items-end justify-center gap-2 px-2 pointer-events-auto">
          {/* painel de stats */}
          <div className={`bg-[#0e151d] border-2 p-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[#8aa0a8] w-28 ${snap.skillPoints > 0 ? 'border-[#40c060] skill-pt-glow' : 'border-[#2a3a42]'}`}>
            <div title="Dano de Ataque"><span className="text-[#e8a040]">⚔</span> {snap.stats.ad}</div>
            <div title="Poder de Habilidade"><span className="text-[#a060ff]">🔮</span> {snap.stats.ap}</div>
            <div title="Armadura"><span className="text-[#8aa0b0]">🛡</span> {snap.stats.armor}</div>
            <div title="Resistência Mágica"><span className="text-[#b0d8ff]">✨</span> {snap.stats.mr}</div>
            <div title="Velocidade de Ataque"><span className="text-[#e0b060]">🏹</span> {snap.stats.aspd}</div>
            <div title="Velocidade de Movimento"><span className="text-[#5ad0c0]">👟</span> {snap.stats.ms}</div>
            {snap.skillPoints > 0 && (
              <div className="col-span-2 text-center text-[#40c060] font-pixel text-[8px] animate-pulse mt-1 border-t border-[#1e2a32] pt-1">
                +{snap.skillPoints} PTS SKILL
              </div>
            )}
          </div>

          <div className="relative" title={`${hero.passive.name} — ${hero.passive.desc}`}>
            <div className="bg-[#101820] border-2 border-[#8c6a20] p-0.5 relative overflow-hidden">
              <HeroPortrait hero={hero} size={62} />
              {snap.dead && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `conic-gradient(rgba(10,10,16,0.9) ${(1 - snap.respawnIn / 30) * 360}deg, rgba(140,20,20,0.75) 0deg)` }}>
                  <span className="font-pixel text-[11px] text-[#ff8080]">{Math.ceil(snap.respawnIn)}</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 font-pixel text-[9px] bg-[#1e3242] border-2 border-[#80d0ff] text-[#80d0ff] px-1">{snap.level}</div>
          </div>

          <div>
            <div className="w-[300px] sm:w-[340px] mb-1">
              <div className="h-[18px] bg-[#0a1008] border-2 border-[#1e3224] relative overflow-hidden">
                <div className={`h-full transition-all duration-150 ${hpPct < 25 ? 'bg-gradient-to-b from-[#c03030] to-[#7c1818] animate-pulse' : 'bg-gradient-to-b from-[#40c060] to-[#1e6a30]'}`} style={{ width: `${hpPct}%` }} />
                <div className="absolute inset-0 text-center font-pixel text-[8px] text-white leading-4" style={{ textShadow: '1px 1px 0 #000' }}>{snap.hp}/{snap.maxHp}</div>
              </div>
              {snap.maxMp > 0 ? (
                <div className="h-[12px] bg-[#080a10] border-2 border-t-0 border-[#1e2432] relative overflow-hidden">
                  <div className="h-full bg-gradient-to-b from-[#4080e0] to-[#1e3a7c] transition-all duration-150" style={{ width: `${(snap.mp / snap.maxMp) * 100}%` }} />
                  <div className="absolute inset-0 text-center text-[11px] text-white leading-3" style={{ textShadow: '1px 1px 0 #000' }}>{snap.mp}/{snap.maxMp}</div>
                </div>
              ) : (
                <div className="h-[12px] bg-[#14100a] border-2 border-t-0 border-[#32281a] flex items-center justify-center">
                  <span className="text-[10px] text-[#8a7a5a] leading-3">— sem mana —</span>
                </div>
              )}
              <div className="h-[4px] bg-[#0a0a10]"><div className="h-full bg-[#8c5ae0] transition-all duration-300" style={{ width: `${(snap.xp / snap.xpNext) * 100}%` }} /></div>
            </div>
            <div className="flex gap-1 items-end">
              {snap.cds.map(c => {
                const ab = hero.abilities[c.slot];
                const maxLv = c.slot === 'R' ? 3 : 5;
                const locked = c.slot === 'R' && snap.level < 6;
                const cdPct = c.rem > 0 ? (c.rem / c.total) * 100 : 0;
                return (
                  <div key={c.slot} className="relative" onMouseEnter={() => setHoverAb(c.slot)} onMouseLeave={() => setHoverAb(null)}>
                    <div className={`relative w-12 h-12 border-2 overflow-hidden transition-all duration-200 ${snap.aimingSkill === c.slot ? 'border-[#ffe040] bg-[#3a2a10] scale-110 shadow-[0_0_16px_rgba(255,224,64,0.8)]' : locked ? 'border-[#223038] bg-[#0d151c]' : c.ok ? 'border-[#e8c860] bg-[#1a2430] ability-ready' : c.canUp ? 'border-[#40c060] bg-[#101a22] ability-upgradable' : 'border-[#3a4a52] bg-[#101a22]'}`}>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
                      <div className={`absolute inset-0 flex items-center justify-center font-pixel text-[12px] ${locked ? 'text-[#3a5058]' : c.ok ? 'text-[#ffe080]' : 'text-[#7a909a]'}`} style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.7)' }}>
                        {locked ? '🔒' : c.slot}
                      </div>
                      {ab.mana > 0 && !locked && <div className="absolute bottom-0.5 right-0.5 text-[10px] text-[#60a0e0] leading-3" style={{ textShadow: '1px 1px 0 #000' }}>{ab.mana}</div>}
                      {/* pips de nível da habilidade (estilo LoL) */}
                      <div className="absolute top-0.5 left-0.5 flex gap-[1px]">
                        {Array.from({ length: maxLv }).map((_, i) => (
                          <div key={i} className={`w-[3px] h-[3px] ${i < c.lv ? (c.slot === 'R' ? 'bg-[#ffd060]' : 'bg-[#80ff80]') : 'bg-[#2a3a42]'}`}
                            style={i < c.lv ? { boxShadow: `0 0 3px ${c.slot === 'R' ? '#ffd060' : '#80ff80'}` } : undefined} />
                        ))}
                      </div>
                      {!locked && c.rem > 0 && <div className="absolute bottom-0 inset-x-0 bg-black/75" style={{ height: `${cdPct}%` }} />}
                      {!locked && c.rem > 0 && <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] text-white">{Math.ceil(c.rem)}</div>}
                      {/* botão de upar */}
                      {c.canUp && (
                        <button onClick={() => onUp(c.slot)} className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-[#40c060] border-2 border-[#80ff80] text-black font-pixel text-[12px] flex items-center justify-center hover:scale-125 transition-transform animate-pulse z-20 hard-shadow-gold" title={`Upar ${c.slot} — tecla Ctrl+${c.slot} ou Shift+${c.slot}`}>+</button>
                      )}
                    </div>
                     {hoverAb === c.slot && (
                       <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 bg-[#0e151d] border-2 border-[#8c6a20] p-2.5 z-50 hard-shadow">
                         <div className="flex justify-between items-center mb-0.5">
                           <div className="text-[15px]"><b className="text-[#e8d8b0]">{c.slot} — {ab.name}</b></div>
                           {c.lv > 0 ? (
                             <span className="text-[#8ae08a] font-pixel text-[9px]">NV {c.lv}/{maxLv}</span>
                           ) : (
                             <span className="text-[#ff6060] font-pixel text-[8px] animate-pulse">NÃO APRENDIDA</span>
                           )}
                         </div>
                         <div className="text-[13px] text-[#9ab0b8] leading-snug">{ab.desc}</div>
                         
                         {/* ===== CALCULADOR DE DANO DINÂMICO E ESCALAS (AFETADO POR ITENS) ===== */}
                         {c.lv > 0 && snap.stats && (
                           <div className="mt-1.5 border-t border-[#223038] pt-1.5 space-y-0.5 text-[12px]">
                             <div className="text-[#ffb060] font-bold">
                               Dano Estimado: <span className="text-white font-mono">{
                                 Math.round(
                                   (ab.dmgBase ?? (c.slot === 'R' ? 120 : 60)) +
                                   (c.lv - 1) * (ab.dmgPerLevel ?? (c.slot === 'R' ? 60 : 15)) +
                                   snap.stats.ad * (ab.ratioAd !== undefined ? ab.ratioAd : (c.slot === 'R' ? 0.8 : 0.4)) +
                                   snap.stats.ap * (ab.ratioAp !== undefined ? ab.ratioAp : (c.slot === 'R' ? 0.9 : 0.5)) +
                                   snap.stats.armor * (ab.ratioArmor ?? 0) +
                                   snap.stats.mr * (ab.ratioMr ?? 0) +
                                   snap.maxHp * (ab.ratioHp ?? 0)
                                 )
                               }</span>
                             </div>
                             <div className="text-[#8aa0a8] flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px]">
                               {(ab.ratioAd !== 0 || c.slot === 'R') && (
                                 <span>AD: <span className="text-[#ffb060] font-bold">{Math.round((ab.ratioAd !== undefined ? ab.ratioAd : (c.slot === 'R' ? 0.8 : 0.4)) * 100)}%</span></span>
                               )}
                               {(ab.ratioAp !== 0 || c.slot === 'R') && (
                                 <span>AP: <span className="text-[#c090ff] font-bold">{Math.round((ab.ratioAp !== undefined ? ab.ratioAp : (c.slot === 'R' ? 0.9 : 0.5)) * 100)}%</span></span>
                               )}
                               {ab.ratioArmor !== 0 && (
                                 <span>Arm: <span className="text-[#60a0ff] font-bold">{Math.round((ab.ratioArmor ?? 0) * 100)}%</span></span>
                               )}
                               {ab.ratioMr !== 0 && (
                                 <span>RM: <span className="text-[#ff90c0] font-bold">{Math.round((ab.ratioMr ?? 0) * 100)}%</span></span>
                               )}
                               {ab.ratioHp !== 0 && (
                                 <span>HP: <span className="text-[#60ff90] font-bold">{Math.round((ab.ratioHp ?? 0) * 100)}%</span></span>
                               )}
                             </div>
                           </div>
                         )}

                         <div className="text-[12px] text-[#5f7880] mt-1 flex gap-2 flex-wrap">
                           <span>⏱ {ab.cd}s</span>{ab.mana > 0 && <span>💧 {ab.mana}</span>}
                           {c.canUp && <span className="text-[#40c060]">⬆ Ctrl+{c.slot} p/ upar</span>}
                         </div>
                       </div>
                     )}
                  </div>
                );
              })}
              <div className="w-10 h-12 bg-[#161024] border-2 border-[#8c5ae0] flex items-center justify-center relative group">
                <span className="font-pixel text-[10px] text-[#c0a0ff]">P</span>
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-56 bg-[#0e151d] border-2 border-[#8c5ae0] p-2 z-50 hidden group-hover:block hard-shadow">
                  <div className="text-[14px]"><b className="text-[#c0a0ff]">Passiva — {hero.passive.name}</b></div>
                  <div className="text-[13px] text-[#9ab0b8] leading-snug">{hero.passive.desc}</div>
                </div>
              </div>
              <div className="flex gap-1 ml-1 pl-1 border-l-2 border-[#2a3a42]">
                {snap.summoners.map((s, i) => {
                  const key = i === 0 ? 'D' : 'F';
                  return (
                    <div key={key} className={`relative w-10 h-12 border-2 ${s.cd <= 0 ? 'border-[#a0d0ff] bg-[#1a2a40]' : 'border-[#223038] bg-[#0d151c]'}`} title={`Feitiço ${key}: ${s.name}`}>
                      <div className="absolute inset-0 flex items-center justify-center font-pixel text-[12px] text-[#5f7880]">{s.icon}</div>
                      <div className="absolute top-0.5 right-0.5 font-pixel text-[8px] text-[#a0d0ff]">{key}</div>
                      {s.cd > 0 && <div className="absolute bottom-0 inset-x-0 bg-black/75" style={{ height: `${(s.cd / s.cdMax) * 100}%` }} />}
                      {s.cd > 0 && <div className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-white">{Math.ceil(s.cd)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-0.5 h-6 items-center min-w-24 justify-center">
              {snap.buffs.map(b => (
                <span key={b.key} title={b.label} className="text-[11px] px-1 py-0.5 border leading-3" style={{ borderColor: b.color, background: `${b.color}22` }}>
                  {b.label.split(' ')[0]}{b.stacks > 1 && <b className="text-white ml-0.5">{b.stacks}</b>}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-6 gap-0.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const id = snap.items[i];
                  return (
                    <div key={i} className="w-9 h-9 bg-[#0a1014] border-2 border-[#223038] relative" title={id ? ITEM_BY_ID[id].name : 'Slot vazio'}>
                      {id && <ItemIcon item={ITEM_BY_ID[id]} size={32} />}
                      {id === 'zhonya' && snap.activeCd > 0 && <div className="absolute inset-0 bg-black/75 text-white text-[11px] flex items-center justify-center">{Math.ceil(snap.activeCd)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="text-center bg-[#101820] border-2 border-[#223038] px-2 py-1 min-w-20">
                <div className="font-pixel text-[9px] text-[#ffe080] leading-4">🪙 {snap.gold}</div>
                <div className="text-[12px] text-[#9ab0b8] leading-3">
                  {snap.cs} CS{snap.time > 60 && <span className="text-[#6a8a8a]"> ({(snap.cs / (snap.time / 60)).toFixed(1)}/m)</span>} · <span className="text-[#80e0a0]">{snap.k}</span>/<span className="text-[#ff9090]">{snap.d}</span>/<span className="text-[#8accff]">{snap.a}</span>
                </div>
              </div>
              <button onClick={onShop} className={`h-[46px] px-3 font-pixel text-[9px] border-2 transition-all hover:-translate-y-0.5 ${snap.canShop ? 'bg-[#2e5a20] border-[#60c040] text-[#c0ffa0] animate-pulse' : 'bg-[#101820] border-[#223038] text-[#7a909a]'}`}>
                LOJA<br />[P]
              </button>
            </div>
          </div>
        </div>
        <div className="text-center text-[12px] text-[#3a5058] mt-1">
          <span className="text-[#6a8a8a]">próx onda {Math.ceil(snap.waveIn)}s</span> · 
          <span className="text-[#e0a040]"> QWER</span> magias · 
          <span className="text-[#40c060]"> Ctrl/Shift+QWER</span> upar · 
          <span className="text-[#a0d0ff]"> D/F</span> feitiços · 
          <span className="text-[#5ad0c0]"> B</span> base · 
          <span className="text-[#6a8a8a]">H ajuda · M som</span>
        </div>
      </div>

    </div>
  );
}

// ================= RESUMO PÓS-PARTIDA =================
function MatchSummary({ snap, hero, xpGained, onPlayAgain, onExit }: {
  snap: Snapshot; hero: HeroDef; xpGained: number; onPlayAgain: () => void; onExit: () => void;
}) {
  const isWin = snap.result === 'win';
  const kda = snap.d === 0 ? (snap.k + snap.a).toFixed(1) : ((snap.k + snap.a) / snap.d).toFixed(2);
  const blue = snap.board.filter(b => b.team === 0);
  const red = snap.board.filter(b => b.team === 1);
  const rowCls = (b: typeof blue[0]) => b.name === hero.name && b.team === 0
    ? 'bg-[#e8c860]/15 text-[#ffe080]'
    : 'text-[#b8c8d0]';
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 pointer-events-auto font-body overflow-auto py-4 px-3">
      <div className="w-[860px] max-w-full">
        {/* banner */}
        <div className={`text-center mb-4 animate-pop`}>
          <div className={`font-pixel text-3xl sm:text-4xl ${isWin ? 'text-[#e8c860] title-glow' : 'text-[#ff5050] title-glow-red'}`}>
            {isWin ? '🏆 VITÓRIA' : '💀 DERROTA'}
          </div>
          <div className="text-[16px] text-[#8aa0a8] mt-1">{fmtTime(snap.time)} de partida</div>
        </div>

        <div className="grid md:grid-cols-[1fr_1.6fr] gap-4">
          {/* desempenho do jogador */}
          <div className="pixel-panel bg-[#101820] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[#0a1410] border-2 border-[#8c6a20] p-0.5"><HeroPortrait hero={hero} size={52} /></div>
              <div>
                <div className="font-pixel text-[11px] text-[#e8c860]">{hero.name}</div>
                <div className="text-[14px] text-[#8aa0a8]">Nível {snap.level} · {hero.role}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-[#0d151c] border border-[#223038] py-1.5">
                <div className="font-pixel text-[13px] text-[#80e0a0]">{snap.k}</div>
                <div className="text-[11px] text-[#5f7880]">Abates</div>
              </div>
              <div className="bg-[#0d151c] border border-[#223038] py-1.5">
                <div className="font-pixel text-[13px] text-[#ff9090]">{snap.d}</div>
                <div className="text-[11px] text-[#5f7880]">Mortes</div>
              </div>
              <div className="bg-[#0d151c] border border-[#223038] py-1.5">
                <div className="font-pixel text-[13px] text-[#8accff]">{snap.a}</div>
                <div className="text-[11px] text-[#5f7880]">Assist.</div>
              </div>
            </div>
            <div className="space-y-1 text-[14px]">
              <div className="flex justify-between"><span className="text-[#8aa0a8]">KDA</span><span className="text-[#ffe080] font-bold">{kda}</span></div>
              <div className="flex justify-between"><span className="text-[#8aa0a8]">Tropas (CS)</span><span className="text-[#b8c8d0]">{snap.cs}</span></div>
              <div className="flex justify-between"><span className="text-[#8aa0a8]">Ouro ganho</span><span className="text-[#ffe080]">{snap.gold} 🪙</span></div>
              <div className="flex justify-between"><span className="text-[#8aa0a8]">Dano de Ataque</span><span className="text-[#e8a040]">{snap.stats.ad}</span></div>
              <div className="flex justify-between"><span className="text-[#8aa0a8]">Poder de Habilidade</span><span className="text-[#a060ff]">{snap.stats.ap}</span></div>
              <div className="flex justify-between border-t border-[#223038] pt-1 mt-1"><span className="text-[#40c060]">XP ganho</span><span className="text-[#40c060] font-bold">+{xpGained}</span></div>
            </div>
          </div>

          {/* placar completo */}
          <div className="pixel-panel bg-[#101820] p-4">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="font-pixel text-[10px] text-[#80c0ff]">TIME AZUL · {snap.teamKills[0]}</span>
              <span className="font-pixel text-[8px] text-[#5f7880]">PLACAR</span>
              <span className="font-pixel text-[10px] text-[#ff8080]">{snap.teamKills[1]} · TIME VERMELHO</span>
            </div>
            <div className="space-y-0.5 text-[13px]">
              {blue.map((b, i) => (
                <div key={i} className={`flex items-center gap-2 px-2 py-1 ${rowCls(b)}`}>
                  <span className="w-5">{HERO_BY_ID[b.hero] && <HeroPortrait hero={HERO_BY_ID[b.hero]} size={18} />}</span>
                  <span className="flex-1 truncate">{b.name}{b.isJg && <span className="text-[#8a6a40] text-[11px]"> 🌿</span>}</span>
                  <span className="w-24 text-right tabular-nums">{b.k}/{b.d}/{b.a}</span>
                  <span className="w-16 text-right text-[#ffe080] tabular-nums">{b.cs} CS</span>
                  <span className="w-7 text-right text-[#8aa0a8]">nv{b.level}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#223038] my-2" />
            <div className="space-y-0.5 text-[13px]">
              {red.map((b, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 text-[#b8c8d0]">
                  <span className="w-5">{HERO_BY_ID[b.hero] && <HeroPortrait hero={HERO_BY_ID[b.hero]} team={1} size={18} />}</span>
                  <span className="flex-1 truncate">{b.name}{b.isJg && <span className="text-[#8a6a40] text-[11px]"> 🌿</span>}</span>
                  <span className="w-24 text-right tabular-nums">{b.k}/{b.d}/{b.a}</span>
                  <span className="w-16 text-right text-[#ffe080] tabular-nums">{b.cs} CS</span>
                  <span className="w-7 text-right text-[#8aa0a8]">nv{b.level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* botões */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={onPlayAgain} className="font-pixel text-[11px] px-8 py-4 bg-[#e8c860] text-[#1a1408] border-4 border-[#8c6a20] hover:bg-[#f5dc80] hover:-translate-y-1 transition-all hard-shadow-gold">
            ⟳ JOGAR NOVAMENTE
          </button>
          <button onClick={onExit} className="font-pixel text-[11px] px-8 py-4 bg-[#1a2430] text-[#a0d0ff] border-4 border-[#2a4a6c] hover:bg-[#22344a] hover:-translate-y-1 transition-all hard-shadow">
            ⌂ MENU PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= PARTIDA =================
function Match({ heroId, summoners, profile, onMatchEnd, onPlayAgain, onExit }: { heroId: string; summoners: string[]; profile: Profile; onMatchEnd: (rec: MatchRecord, p: Profile) => void; onPlayAgain: () => void; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const hero = HERO_BY_ID[heroId];
  const recordedRef = useRef(false);
  const lastRec = useRef<{ rec: MatchRecord; xp: number } | null>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    const fit = () => { cv.width = window.innerWidth; cv.height = window.innerHeight; };
    fit();
    window.addEventListener('resize', fit);
    const { mode, map } = getActiveRules();
    const game = new Game(cv, miniRef.current, heroId, setSnap, profile.difficulty ?? 'normal', mode, map);
    game.playerSummoners = summoners;
    game.setEquippedSkins(profile.equippedSkins ?? {});
    gameRef.current = game;
    const keyShop = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') setShopOpen(o => { game.shopOpen = !o; sfx.click(); return !o; });
      if (e.key === 'Escape') { setShopOpen(false); game.shopOpen = false; }
      if (e.key === 'm' || e.key === 'M') { setMuted(!isMuted()); setMutedState(isMuted()); }
    };
    window.addEventListener('keydown', keyShop);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', keyShop); game.destroy(); };
  }, [heroId, summoners]);

  // grava partida ao terminar
  useEffect(() => {
    if (snap?.result && !recordedRef.current) {
      recordedRef.current = true;
      const rec: MatchRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: Date.now(), hero: heroId, result: snap.result,
        k: snap.k, d: snap.d, a: snap.a, cs: snap.cs, gold: snap.gold, time: snap.time,
        teamKills: snap.teamKills,
      };
      const xp = snap.result === 'win' ? 200 + snap.k * 10 : 80 + snap.k * 5;
      const np = addMatch(rec, profile);
      lastRec.current = { rec, xp };
      onMatchEnd(rec, np);
    }
  }, [snap?.result]);

  const toggleShop = useCallback(() => {
    setShopOpen(o => { if (gameRef.current) gameRef.current.shopOpen = !o; sfx.click(); return !o; });
  }, []);
  const toggleMute = useCallback(() => { setMuted(!isMuted()); setMutedState(isMuted()); }, []);
  const upSkill = useCallback((s: AbilitySlot) => { gameRef.current?.upgradeSkill(s); }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black cursor-crosshair">
      <canvas ref={canvasRef} className="block pixelated" />
      <div className="game-vignette absolute inset-0 z-15" />
      <div className="scanlines pointer-events-none absolute inset-0 z-20 opacity-40" />
      <div className="absolute bottom-2 right-2 border-2 border-[#8c6a20] bg-black/70 hard-shadow z-10">
        <div className="flex justify-between items-center px-1 bg-[#101820] border-b border-[#223038]">
          <span className="font-pixel text-[7px] text-[#8c6a20]">RIFT</span>
          <span className="text-[10px] text-[#5f7880]">esq: câmera · dir: mover</span>
        </div>
        <canvas ref={miniRef} width={200} height={200} className="pixelated block" style={{ width: 200, height: 200 }} />
      </div>
       {snap && (
        <HUD
          snap={snap}
          hero={hero}
          onShop={toggleShop}
          muted={muted}
          onMute={toggleMute}
          onUp={upSkill}
          onPing={(kind) => gameRef.current?.sendPing(gameRef.current.player.x, gameRef.current.player.y, kind)}
          onChat={(text) => gameRef.current?.postChat(gameRef.current.player.name, text, gameRef.current.player.team as 0 | 1)}
          onBuyback={() => {
            const err = gameRef.current?.buyback();
            if (err) sfx.error();
          }}
        />
      )}
      {snap && shopOpen && !snap.result && <Shop snap={snap} game={gameRef.current!} hero={hero} onClose={toggleShop} />}
      {snap?.result && lastRec.current && (
        <MatchSummary snap={snap} hero={hero} xpGained={lastRec.current.xp} onPlayAgain={onPlayAgain} onExit={onExit} />
      )}
    </div>
  );
}

export default function App() {
  const { match: onlineMatch } = useConnection();
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [match, setMatch] = useState<{ heroId: string; summoners: string[] } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminContent, setAdminContent] = useState<AdminContent>(() => initializeAdminContent());

  useEffect(() => {
    const toggleAdmin = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setAdminOpen(open => !open);
      }
    };
    window.addEventListener('keydown', toggleAdmin);
    return () => window.removeEventListener('keydown', toggleAdmin);
  }, []);

  let screen: ReactNode;
  if (!ready) {
    screen = <ConnectScreen onReady={() => {
      // sincroniza nome do perfil com a sessão (convidado ou conta)
      const sessName = conn.user?.username;
      // sincroniza qualquer nome escolhido (não apenas o padrão)
      if (sessName && sessName !== 'Convidado' && sessName !== 'Invocador') {
        const p = { ...profile, name: sessName }; setProfile(p); saveProfile(p);
      } else if (sessName) {
        // mesmo padrão, sincroniza
        const p = { ...profile, name: sessName }; setProfile(p); saveProfile(p);
      }
      setReady(true);
    }} />;
  } else if (onlineMatch) {
    screen = <OnlineMatchScreen />;
  } else if (match) {
    screen = <Match key={gameKey} heroId={match.heroId} summoners={match.summoners} profile={profile}
      onMatchEnd={(_rec, p) => setProfile(p)}
      onPlayAgain={() => setGameKey(k => k + 1)}
      onExit={() => setMatch(null)} />;
  } else if (drafting) {
    screen = <DraftScreen profile={profile}
      onComplete={(heroId, summoners) => { setDrafting(false); setGameKey(k => k + 1); setMatch({ heroId, summoners }); }}
      onCancel={() => setDrafting(false)} />;
  } else {
    screen = <ProfileScreen profile={profile} onUpdateProfile={setProfile}
      onPlay={(heroId, summoners) => { setGameKey(k => k + 1); setMatch({ heroId, summoners }); }}
      onDraft={() => setDrafting(true)}
      onEditName={(n) => { const p = { ...profile, name: n }; setProfile(p); saveProfile(p); }} />;
  }

  return <>
    {screen}
    {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} onContentChange={setAdminContent} key={`${adminContent.heroes.length}-${adminContent.items.length}-${adminContent.activeModeId}`} />}
  </>;
}
