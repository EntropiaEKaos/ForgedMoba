import { useState } from 'react';
import { RUNES_BY_SLOT, RUNE_BY_ID, runeStats, type RunePage, type RuneSlot } from '../game/runes';
import { sfx } from '../game/sound';
import type { Profile } from '../game/persistence';

const SLOT_LABEL: Record<RuneSlot, string> = {
  keystone: 'PEDRA ANGULAR',
  secondary: 'SECUNDÁRIA',
  minor: 'MENOR',
};

const SLOT_HINT: Record<RuneSlot, string> = {
  keystone: 'Define a identidade do seu estilo de jogo.',
  secondary: 'Utilidade forte com bônus de atributo.',
  minor: 'Pequeno bônus de atributo base.',
};

const STAT_LABEL: Record<string, string> = {
  hp: 'Vida', ad: 'Dano de Ataque', ap: 'Poder de Habilidade', armor: 'Armadura',
  mr: 'Resist. Mágica', ms: 'Velocidade', as: 'Vel. Ataque', crit: 'Crítico',
  lifesteal: 'Roubo de Vida', hpRegen: 'Regen. Vida', mpRegen: 'Regen. Mana',
  mpen: 'Penetração Mágica', cdr: 'Redução de Recarga',
};

export function RunesModal({ profile, onClose, onSave }: {
  profile: Profile;
  onClose: () => void;
  onSave: (page: RunePage, pages: Record<string, RunePage>) => void;
}) {
  const [page, setPage] = useState<RunePage>(profile.runePage ?? { keystone: 'conqueror', secondary: 'bloodline', minor: 'vitality' });
  const [pages, setPages] = useState<Record<string, RunePage>>(profile.runePages ?? {});
  const [pageName, setPageName] = useState('');
  const [msg, setMsg] = useState('Escolha três runas para levar à partida.');

  const totals = runeStats(page);
  const activeStats = Object.entries(totals).filter(([, v]) => v !== 0);

  const pick = (slot: RuneSlot, id: string) => {
    setPage(prev => ({ ...prev, [slot]: id }));
    sfx.click();
  };

  const savePage = () => {
    const name = pageName.trim();
    if (!name) return setMsg('Digite um nome para salvar a página.');
    const next = { ...pages, [name]: { ...page } };
    setPages(next);
    setPageName('');
    setMsg(`Página "${name}" salva.`);
    sfx.buy();
  };

  const confirm = () => { onSave(page, pages); sfx.levelup(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 font-body" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0e151d] border-4 border-[#8c5ae0] w-[900px] max-w-[97vw] max-h-[92vh] overflow-auto hard-shadow">
        <header className="flex items-center justify-between gap-3 border-b-2 border-[#263943] px-4 py-3 sticky top-0 bg-[#0e151d] z-10">
          <div>
            <h2 className="font-pixel text-[12px] text-[#c0a0ff]">✦ PÁGINA DE RUNAS</h2>
            <p className="text-[13px] text-[#718994]">Runas mudam atributos e adicionam efeitos durante a partida</p>
          </div>
          <button onClick={onClose} className="font-pixel text-[9px] px-3 py-2 bg-[#5c1e1e] border-2 border-[#8c3a3a] text-[#ffc0b0]">FECHAR</button>
        </header>

        <div className="p-4 space-y-4">
          {/* páginas salvas */}
          {Object.keys(pages).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-pixel text-[8px] text-[#5f7880]">PÁGINAS:</span>
              {Object.entries(pages).map(([name, p]) => (
                <button key={name} onClick={() => { setPage({ ...p }); setMsg(`Página "${name}" carregada.`); sfx.click(); }}
                  className="text-[13px] px-2 py-1 border-2 border-[#263943] bg-[#101b23] text-[#9ab0b8] hover:border-[#8c5ae0] hover:text-[#c0a0ff] transition-colors">
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* seleção por slot */}
          {(['keystone', 'secondary', 'minor'] as RuneSlot[]).map(slot => (
            <section key={slot}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="font-pixel text-[9px] text-[#e8c860]">{SLOT_LABEL[slot]}</h3>
                <span className="text-[12px] text-[#5f7880]">{SLOT_HINT[slot]}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {RUNES_BY_SLOT(slot).map(rune => {
                  const active = page[slot] === rune.id;
                  return (
                    <button key={rune.id} onClick={() => pick(slot, rune.id)}
                      className={`text-left border-2 p-2.5 transition-all hover:-translate-y-0.5 ${active ? 'bg-[#1a1430]' : 'border-[#263943] bg-[#101b23]'}`}
                      style={active ? { borderColor: rune.color, boxShadow: `0 0 12px ${rune.color}44` } : {}}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 border border-black/50" style={{ background: rune.color }} />
                        <span className="font-pixel text-[8px]" style={{ color: active ? rune.color : '#c8d8dc' }}>{rune.name}</span>
                        {active && <span className="ml-auto text-[10px] text-[#40c060]">✓</span>}
                      </div>
                      <p className="text-[12px] text-[#8aa0a8] leading-snug">{rune.desc}</p>
                      {rune.stats && (
                        <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-[#8ae08a]">
                          {Object.entries(rune.stats).map(([k, v]) => (
                            <span key={k}>+{['as', 'lifesteal', 'mpen', 'cdr'].includes(k) ? `${Math.round((v as number) * 100)}%` : v} {STAT_LABEL[k] ?? k}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* resumo */}
          <div className="border-2 border-[#263943] bg-[#101b23] p-3">
            <h3 className="font-pixel text-[9px] text-[#5ad0c0] mb-2">RESUMO DA PÁGINA</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {[page.keystone, page.secondary, page.minor].map(id => {
                const r = RUNE_BY_ID[id];
                if (!r) return null;
                return (
                  <span key={id} className="text-[12px] px-2 py-1 border" style={{ borderColor: r.color, color: r.color }}>
                    {r.name}
                  </span>
                );
              })}
            </div>
            {activeStats.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[12px] text-[#8ae08a]">
                {activeStats.map(([k, v]) => (
                  <div key={k}>+{['as', 'lifesteal', 'mpen', 'cdr'].includes(k) ? `${Math.round(v * 100)}%` : v} <span className="text-[#7a909a]">{STAT_LABEL[k] ?? k}</span></div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#5f7880]">Esta combinação não concede atributos passivos diretos.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input value={pageName} onChange={e => setPageName(e.target.value)} placeholder="Nome da página..." maxLength={16}
              className="bg-[#091117] border-2 border-[#263943] px-2 py-2 text-[14px] text-[#e8d8b0] focus:border-[#8c5ae0] outline-none" />
            <button onClick={savePage} className="font-pixel text-[8px] px-3 py-2 border-2 border-[#347a58] bg-[#163a2a] text-[#9ff0bb]">SALVAR PÁGINA</button>
            <span className="text-[12px] text-[#718994] mr-auto">{msg}</span>
            <button onClick={confirm} className="font-pixel text-[10px] px-6 py-3 bg-[#8c5ae0] text-[#120a20] border-2 border-[#c0a0ff] hover:bg-[#a070f0] transition-all">
              ✓ CONFIRMAR RUNAS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
