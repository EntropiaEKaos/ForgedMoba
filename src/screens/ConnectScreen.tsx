import { useEffect, useState } from 'react';
import { conn, useConnection } from '../network/connection';
import { initAudio, sfx } from '../game/sound';

/**
 * Tela de Conexão / Login — ponto de entrada da Fase 2.
 * O JOGADOR ESCOLHE SEU NOME antes de entrar.
 */
export function ConnectScreen({ onReady }: { onReady: () => void }) {
  const { status, serverInfo } = useConnection();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [u, setU] = useState('');
  const [e, setE] = useState('');
  const [p, setP] = useState('');
  const [guestName, setGuestName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { conn.init(); }, []);

  // entrar como convidado com o nome escolhido
  const guest = () => {
    initAudio(); sfx.buy();
    const name = guestName.trim() || 'Invocador';
    conn.enterGuest(name);
    onReady();
  };

  const submit = async () => {
    setBusy(true); setErr('');
    const r = tab === 'login'
      ? await conn.login(u, p)
      : await conn.register(u, e, p);
    setBusy(false);
    if (r.ok) { sfx.levelup(); onReady(); }
    else setErr(r.error || 'Erro desconhecido');
  };

  const checking = status === 'checking';

  return (
    <div className="min-h-screen rift-bg text-[#d8e4e8] font-body flex items-center justify-center p-4 relative overflow-hidden">
      <div className="scanlines pointer-events-none fixed inset-0 z-50" />
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 text-9xl animate-float">⚔️</div>
        <div className="absolute bottom-1/4 right-1/4 text-9xl animate-float" style={{ animationDelay: '1s' }}>🛡️</div>
        <div className="absolute top-1/2 left-1/2 text-7xl animate-float" style={{ animationDelay: '0.5s' }}>👑</div>
      </div>

      <div className="relative z-10 w-[420px] max-w-full">
        <div className="text-center mb-6">
          <h1 className="font-pixel text-3xl sm:text-4xl text-[#e8c860] title-glow mb-2">PIXEL RIFT</h1>
          <p className="text-[#5ad0c0] text-[16px]">MOBA Cartoon 5v5</p>
        </div>

        {/* status do servidor */}
        <div className={`flex items-center justify-center gap-2 mb-4 px-3 py-1.5 border-2 text-[14px] ${
          status === 'online' ? 'border-[#40c060] bg-[#0d1f14] text-[#80e0a0]'
          : status === 'offline' ? 'border-[#8c3a3a] bg-[#1f0d0d] text-[#ff9090]'
          : 'border-[#2a4a6c] bg-[#0d1a2e] text-[#80c0ff]'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-[#40c060]' : status === 'offline' ? 'bg-[#ff5050]' : 'bg-[#80c0ff] animate-ping'}`} />
          {status === 'online' && <>SERVIDOR ONLINE {serverInfo?.players != null && `· ${serverInfo.players} jogadores`}</>}
          {status === 'offline' && 'SERVIDOR OFFLINE · modo local'}
          {checking && 'CONECTANDO AO SERVIDOR...'}
        </div>

        {status === 'online' ? (
          <div className="pixel-panel bg-[#101820] p-5">
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setTab('login'); setErr(''); }} className={`flex-1 font-pixel text-[9px] py-2 border-2 ${tab === 'login' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>ENTRAR</button>
              <button onClick={() => { setTab('register'); setErr(''); }} className={`flex-1 font-pixel text-[9px] py-2 border-2 ${tab === 'register' ? 'border-[#e8c860] bg-[#1a2418] text-[#e8c860]' : 'border-[#223038] bg-[#0d151c] text-[#7a909a]'}`}>CRIAR CONTA</button>
            </div>

            <div className="space-y-2">
              <input value={u} onChange={ev => setU(ev.target.value)} placeholder="Usuário" maxLength={32}
                className="w-full bg-[#0d151c] border-2 border-[#223038] px-3 py-2 text-[#e8d8b0] text-[15px] focus:border-[#e8c860] outline-none" />
              {tab === 'register' && (
                <input value={e} onChange={ev => setE(ev.target.value)} placeholder="E-mail" type="email"
                  className="w-full bg-[#0d151c] border-2 border-[#223038] px-3 py-2 text-[#e8d8b0] text-[15px] focus:border-[#e8c860] outline-none" />
              )}
              <input value={p} onChange={ev => setP(ev.target.value)} placeholder="Senha" type="password"
                onKeyDown={ev => ev.key === 'Enter' && submit()}
                className="w-full bg-[#0d151c] border-2 border-[#223038] px-3 py-2 text-[#e8d8b0] text-[15px] focus:border-[#e8c860] outline-none" />
            </div>

            {err && <div className="text-[#ff9090] text-[13px] mt-2 text-center bg-[#1f0d0d] border border-[#8c3a3a] px-2 py-1">{err}</div>}

            <button onClick={submit} disabled={busy || (!u || !p || (tab === 'register' && !e))}
              className="mt-3 w-full font-pixel text-[10px] py-3 bg-[#e8c860] text-[#1a1408] border-2 border-[#8c6a20] hover:bg-[#f5dc80] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {busy ? 'AGUARDE...' : tab === 'login' ? '🔐 ENTRAR' : '✨ CRIAR CONTA'}
            </button>

            <div className="flex items-center gap-2 my-3 text-[#3a5058] text-[13px]">
              <div className="flex-1 h-px bg-[#223038]" /> OU <div className="flex-1 h-px bg-[#223038]" />
            </div>
            {/* CAMPO DE NOME PARA CONVIDADO */}
            <div className="mb-2">
              <input value={guestName} onChange={ev => setGuestName(ev.target.value)} placeholder="Escolha seu nome de invocador..." maxLength={16}
                className="w-full bg-[#0d151c] border-2 border-[#223038] px-3 py-2 text-[#e8d8b0] text-[15px] focus:border-[#5ad0c0] outline-none text-center" />
            </div>
            <button onClick={guest} className="w-full font-pixel text-[9px] py-2.5 bg-[#1a2c40] text-[#80c0ff] border-2 border-[#2a4a6c] hover:bg-[#22344a] transition-all">
              👤 JOGAR COMO CONVIDADO
            </button>
          </div>
        ) : status === 'offline' ? (
          <div className="pixel-panel bg-[#101820] p-6 text-center">
            <div className="text-5xl mb-3">📡</div>
            <h2 className="font-pixel text-[12px] text-[#e8c860] mb-2">SERVIDOR INDISPONÍVEL</h2>
            <p className="text-[14px] text-[#9ab0b8] mb-4 leading-snug">
              Você pode jogar no <b className="text-[#5ad0c0]">modo local</b> contra bots com todo o progresso salvo no seu navegador.
            </p>
            {/* CAMPO DE NOME PARA CONVIDADO */}
            <div className="mb-3">
              <input value={guestName} onChange={ev => setGuestName(ev.target.value)} placeholder="Escolha seu nome de invocador..." maxLength={16}
                onKeyDown={ev => ev.key === 'Enter' && guest()}
                className="w-full bg-[#0d151c] border-2 border-[#223038] px-3 py-2.5 text-[#e8d8b0] text-[15px] focus:border-[#5ad0c0] outline-none text-center" />
            </div>
            <button onClick={guest} className="w-full font-pixel text-[10px] py-3 bg-[#e8c860] text-[#1a1408] border-2 border-[#8c6a20] hover:bg-[#f5dc80] transition-all">
              ▶ JOGAR COMO CONVIDADO
            </button>
            <button onClick={() => conn.init()} className="mt-2 text-[13px] text-[#7a909a] hover:text-[#5ad0c0] underline">
              ↻ tentar reconectar
            </button>
          </div>
        ) : (
          <div className="pixel-panel bg-[#101820] p-8 text-center">
            <div className="flex justify-center gap-1 mb-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-3 h-3 bg-[#80c0ff] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="font-pixel text-[9px] text-[#80c0ff]">VERIFICANDO SERVIDOR...</p>
          </div>
        )}

        <p className="text-center text-[12px] text-[#3a5058] mt-4">47 heróis · 40+ itens · Summoner's Rift</p>
      </div>
    </div>
  );
}
