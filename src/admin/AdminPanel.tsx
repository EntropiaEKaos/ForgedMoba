import { useMemo, useState } from 'react';
import { HEROES, type AbilitySlot, type HeroDef } from '../game/heroes';
import { ITEMS, type ItemDef } from '../game/items';
import {
  createHeroTemplate, createItemTemplate, loadAdminContent, resetAdminContent,
  saveAdminContent, type AdminContent, type AdminRecord,
} from './content';
import type { AdminTheme, GameModeDef, MapPresetDef } from './types';
import { CURRENT_AUTHORITATIVE_CONTENT } from '../shared/authoritativeContent';

type Tab = 'heroes' | 'items' | 'modes' | 'maps' | 'published';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function Field({ label, value, onChange, type = 'text', min, max, step }: {
  label: string; value: string | number; onChange: (value: string) => void;
  type?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] uppercase tracking-wider text-[#6f8790] mb-1">{label}</span>
      <input type={type} value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value)}
        className="w-full bg-[#091117] border border-[#2a3b46] px-2 py-1.5 text-[#d8e4e8] outline-none focus:border-[#d8bb5b]" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-[#6f8790] mb-1">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={3}
        className="w-full resize-y bg-[#091117] border border-[#2a3b46] px-2 py-1.5 text-[#d8e4e8] outline-none focus:border-[#d8bb5b]" />
    </label>
  );
}

export function AdminPanel({ onClose, onContentChange }: { onClose: () => void; onContentChange: (content: AdminContent) => void }) {
  const [tab, setTab] = useState<Tab>('heroes');
  const [content, setContent] = useState<AdminContent>(() => loadAdminContent());
  const [message, setMessage] = useState('Alterações são persistidas no navegador.');
  const [heroDraft, setHeroDraft] = useState<HeroDef>(() => clone(HEROES[0]));
  const [heroCustom, setHeroCustom] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDef>(() => clone(ITEMS[0]));
  const [itemCustom, setItemCustom] = useState(false);
  const [modeDraft, setModeDraft] = useState<GameModeDef>(() => clone(content.modes[0]));
  const [mapDraft, setMapDraft] = useState<MapPresetDef>(() => clone(content.maps[0]));

  const recordForHero = (id: string) => content.heroes.find(record => record.data.id === id);
  const recordForItem = (id: string) => content.items.find(record => record.data.id === id);
  const allRecipes = useMemo(() => ITEMS.map(item => item.id).join(', '), [content]);

  const persist = (next: AdminContent, note: string) => {
    setContent(next);
    saveAdminContent(next);
    onContentChange(next);
    setMessage(note);
  };

  const saveHero = () => {
    if (!heroDraft.id.trim() || !heroDraft.name.trim()) return setMessage('Herói precisa de ID e nome.');
    const record: AdminRecord<HeroDef> = { data: clone(heroDraft), custom: heroCustom };
    const next = { ...content, heroes: [...content.heroes.filter(entry => entry.data.id !== heroDraft.id), record] };
    persist(next, `Herói ${heroDraft.name} salvo e aplicado ao runtime.`);
  };

  const resetOrDeleteHero = () => {
    const next = { ...content, heroes: content.heroes.filter(entry => entry.data.id !== heroDraft.id) };
    persist(next, heroCustom ? 'Herói customizado removido.' : 'Herói restaurado para os valores do código-base.');
    setHeroDraft(clone(HEROES[0])); setHeroCustom(false);
  };

  const saveItem = () => {
    if (!itemDraft.id.trim() || !itemDraft.name.trim()) return setMessage('Item precisa de ID e nome.');
    const record: AdminRecord<ItemDef> = { data: clone(itemDraft), custom: itemCustom };
    const next = { ...content, items: [...content.items.filter(entry => entry.data.id !== itemDraft.id), record] };
    persist(next, `Item ${itemDraft.name} salvo e aplicado à loja.`);
  };

  const resetOrDeleteItem = () => {
    const next = { ...content, items: content.items.filter(entry => entry.data.id !== itemDraft.id) };
    persist(next, itemCustom ? 'Item customizado removido.' : 'Item restaurado para os valores do código-base.');
    setItemDraft(clone(ITEMS[0])); setItemCustom(false);
  };

  const saveMode = () => {
    if (!modeDraft.id.trim() || !modeDraft.name.trim()) return setMessage('Modo precisa de ID e nome.');
    const next = { ...content, modes: [...content.modes.filter(mode => mode.id !== modeDraft.id), clone(modeDraft)] };
    persist(next, `Modo ${modeDraft.name} salvo.`);
  };

  const saveMap = () => {
    if (!mapDraft.id.trim() || !mapDraft.name.trim()) return setMessage('Mapa precisa de ID e nome.');
    const next = { ...content, maps: [...content.maps.filter(map => map.id !== mapDraft.id), clone(mapDraft)] };
    persist(next, `Mapa ${mapDraft.name} salvo.`);
  };

  const num = (value: string) => Number(value) || 0;
  const updateHero = <K extends keyof HeroDef>(key: K, value: HeroDef[K]) => setHeroDraft(prev => ({ ...prev, [key]: value }));
  const updateItem = <K extends keyof ItemDef>(key: K, value: ItemDef[K]) => setItemDraft(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 p-3 sm:p-6 font-body text-[#d8e4e8]" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="mx-auto flex h-full max-w-7xl flex-col border-4 border-[#745d27] bg-[#0d151c] shadow-[10px_10px_0_#000]">
        <header className="flex flex-wrap items-center gap-2 border-b-2 border-[#263943] px-4 py-3">
          <div className="mr-auto">
            <h1 className="font-pixel text-[12px] text-[#e2c45e]">PAINEL ADMIN</h1>
            <p className="text-[13px] text-[#718994]">Ctrl + Shift + A abre ou fecha este painel</p>
          </div>
          {(['heroes', 'items', 'modes', 'maps', 'published'] as Tab[]).map(entry => (
            <button key={entry} onClick={() => setTab(entry)} className={`border-2 px-3 py-2 font-pixel text-[8px] uppercase ${tab === entry ? 'border-[#d8bb5b] bg-[#252719] text-[#f0dc87]' : 'border-[#263943] bg-[#101b23] text-[#81959d]'}`}>
              {entry === 'heroes' ? 'Heróis' : entry === 'items' ? 'Itens' : entry === 'modes' ? 'Modos' : entry === 'maps' ? 'Mapas' : 'Publicado'}
            </button>
          ))}
          <button onClick={onClose} className="border-2 border-[#743739] bg-[#40191c] px-3 py-2 font-pixel text-[8px] text-[#ffb0a8]">Fechar</button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {tab === 'heroes' && (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <aside>
                <button onClick={() => { setHeroDraft(createHeroTemplate()); setHeroCustom(true); }} className="mb-2 w-full border-2 border-[#347a58] bg-[#163a2a] py-2 font-pixel text-[8px] text-[#9ff0bb]">Criar herói</button>
                <select value={heroDraft.id} onChange={event => {
                  const hero = HEROES.find(entry => entry.id === event.target.value)!;
                  const record = recordForHero(hero.id);
                  setHeroDraft(clone(record?.data ?? hero)); setHeroCustom(record?.custom ?? false);
                }} className="w-full bg-[#091117] border border-[#2a3b46] p-2">
                  {HEROES.map(hero => <option key={hero.id} value={hero.id}>{hero.name} ({hero.id})</option>)}
                </select>
                <p className="mt-2 text-[12px] text-[#718994]">Heróis customizados usam o fallback funcional do motor quando suas keys de habilidade não possuem implementação dedicada.</p>
              </aside>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="ID" value={heroDraft.id} onChange={value => updateHero('id', value)} />
                  <Field label="Nome" value={heroDraft.name} onChange={value => updateHero('name', value)} />
                  <Field label="Título" value={heroDraft.title} onChange={value => updateHero('title', value)} />
                  <Field label="Função" value={heroDraft.role} onChange={value => updateHero('role', value)} />
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
                  {([['hp','Vida'],['mp','Mana'],['ad','AD'],['armor','Armadura'],['mr','RM'],['as','AS'],['ms','Movimento'],['atkRange','Alcance']] as const).map(([key,label]) =>
                    <Field key={key} label={label} type="number" step={key === 'as' ? 0.01 : 1} value={heroDraft[key]} onChange={value => updateHero(key, num(value) as never)} />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Passiva" value={heroDraft.passive.name} onChange={value => updateHero('passive', { ...heroDraft.passive, name: value })} />
                  <Field label="Key passiva" value={heroDraft.passive.key} onChange={value => updateHero('passive', { ...heroDraft.passive, key: value })} />
                </div>
                <TextArea label="Descrição da passiva" value={heroDraft.passive.desc} onChange={value => updateHero('passive', { ...heroDraft.passive, desc: value })} />
                <div className="grid gap-3 xl:grid-cols-2">
                  {(['Q','W','E','R'] as AbilitySlot[]).map(slot => {
                    const ability = heroDraft.abilities[slot];
                    const setAbility = (next: typeof ability) => updateHero('abilities', { ...heroDraft.abilities, [slot]: next });
                    return <div key={slot} className="border border-[#263943] bg-[#101b23] p-3">
                      <h3 className="mb-2 font-pixel text-[9px] text-[#e2c45e]">{slot}</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Nome" value={ability.name} onChange={value => setAbility({ ...ability, name: value })} />
                        <Field label="Key" value={ability.key} onChange={value => setAbility({ ...ability, key: value })} />
                        <Field label="Recarga" type="number" value={ability.cd} onChange={value => setAbility({ ...ability, cd: num(value) })} />
                        <Field label="Mana" type="number" value={ability.mana} onChange={value => setAbility({ ...ability, mana: num(value) })} />
                        <Field label="Alcance" type="number" value={ability.range} onChange={value => setAbility({ ...ability, range: num(value) })} />
                      </div>
                      {/* ===== CAMPOS DE ESCALONAMENTO DE DANOS E ATRIBUTOS (CONEXÃO COM ITENS) ===== */}
                      <div className="mt-2 grid gap-1.5 grid-cols-2 sm:grid-cols-4 bg-[#0a1218] p-2 border border-[#1a2c34] rounded">
                        <Field label="Dano Base" type="number" value={ability.dmgBase ?? 60} onChange={value => setAbility({ ...ability, dmgBase: num(value) })} />
                        <Field label="Dano/Nível" type="number" value={ability.dmgPerLevel ?? 15} onChange={value => setAbility({ ...ability, dmgPerLevel: num(value) })} />
                        <Field label="Escala AD %" type="number" step={0.05} value={ability.ratioAd ?? 0.4} onChange={value => setAbility({ ...ability, ratioAd: num(value) })} />
                        <Field label="Escala AP %" type="number" step={0.05} value={ability.ratioAp ?? 0.5} onChange={value => setAbility({ ...ability, ratioAp: num(value) })} />
                        <Field label="Escala Armad." type="number" step={0.05} value={ability.ratioArmor ?? 0} onChange={value => setAbility({ ...ability, ratioArmor: num(value) })} />
                        <Field label="Escala RM" type="number" step={0.05} value={ability.ratioMr ?? 0} onChange={value => setAbility({ ...ability, ratioMr: num(value) })} />
                        <Field label="Escala HP %" type="number" step={0.05} value={ability.ratioHp ?? 0} onChange={value => setAbility({ ...ability, ratioHp: num(value) })} />
                      </div>
                      <div className="mt-2">
                        <TextArea label="Descrição" value={ability.desc} onChange={value => setAbility({ ...ability, desc: value })} />
                      </div>
                    </div>;
                  })}
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
                  {(['skin','hair','armor','trim','legs','weaponColor'] as const).map(key => <Field key={key} label={key} type="color" value={heroDraft.look[key]} onChange={value => updateHero('look', { ...heroDraft.look, [key]: value })} />)}
                  <Field label="Arma" value={heroDraft.look.weapon} onChange={value => updateHero('look', { ...heroDraft.look, weapon: value as HeroDef['look']['weapon'] })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveHero} className="border-2 border-[#347a58] bg-[#163a2a] px-5 py-2 font-pixel text-[8px] text-[#9ff0bb]">Salvar herói</button>
                  <button onClick={resetOrDeleteHero} className="border-2 border-[#743739] bg-[#40191c] px-5 py-2 font-pixel text-[8px] text-[#ffb0a8]">{heroCustom ? 'Excluir' : 'Restaurar'}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'items' && (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <aside>
                <button onClick={() => { setItemDraft(createItemTemplate()); setItemCustom(true); }} className="mb-2 w-full border-2 border-[#347a58] bg-[#163a2a] py-2 font-pixel text-[8px] text-[#9ff0bb]">Criar item</button>
                <select value={itemDraft.id} onChange={event => {
                  const item = ITEMS.find(entry => entry.id === event.target.value)!;
                  const record = recordForItem(item.id);
                  setItemDraft(clone(record?.data ?? item)); setItemCustom(record?.custom ?? false);
                }} className="w-full bg-[#091117] border border-[#2a3b46] p-2">
                  {ITEMS.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
                </select>
              </aside>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="ID" value={itemDraft.id} onChange={value => updateItem('id', value)} />
                  <Field label="Nome" value={itemDraft.name} onChange={value => updateItem('name', value)} />
                  <Field label="Custo" type="number" value={itemDraft.totalCost} onChange={value => updateItem('totalCost', num(value))} />
                  <Field label="Tier" type="number" min={1} max={3} value={itemDraft.tier} onChange={value => updateItem('tier', clampTier(num(value)))} />
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-6">
                  {(['ad','ap','hp','mp','armor','mr','as','ms','crit','lifesteal','hpRegen','mpRegen','mpen'] as const).map(key =>
                    <Field key={key} label={key} type="number" step={['as','lifesteal','mpen'].includes(key) ? 0.01 : 1} value={itemDraft.stats[key] ?? 0} onChange={value => updateItem('stats', { ...itemDraft.stats, [key]: num(value) })} />
                  )}
                </div>
                <Field label="Receita (IDs separados por vírgula)" value={itemDraft.recipe.join(', ')} onChange={value => updateItem('recipe', value.split(',').map(entry => entry.trim()).filter(Boolean))} />
                <p className="text-[11px] text-[#617985]">IDs disponíveis: {allRecipes}</p>
                <TextArea label="Passiva" value={itemDraft.passive ?? ''} onChange={value => updateItem('passive', value)} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Key da passiva" value={itemDraft.passiveKey ?? ''} onChange={value => updateItem('passiveKey', value)} />
                  <Field label="Cor de fundo" type="color" value={itemDraft.icon.bg} onChange={value => updateItem('icon', { ...itemDraft.icon, bg: value })} />
                  <Field label="Cor frontal" type="color" value={itemDraft.icon.fg} onChange={value => updateItem('icon', { ...itemDraft.icon, fg: value })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveItem} className="border-2 border-[#347a58] bg-[#163a2a] px-5 py-2 font-pixel text-[8px] text-[#9ff0bb]">Salvar item</button>
                  <button onClick={resetOrDeleteItem} className="border-2 border-[#743739] bg-[#40191c] px-5 py-2 font-pixel text-[8px] text-[#ffb0a8]">{itemCustom ? 'Excluir' : 'Restaurar'}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'modes' && (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-2">
                <button onClick={() => setModeDraft({ id: `mode-${Date.now()}`, name: 'Novo Modo', description: 'Descreva as regras.', mapId: content.maps[0]?.id ?? 'rift', teamSize: 5, startingGold: 475, waveInterval: 30, maxLevel: 18, passiveGoldRate: 2.4, respawnScale: 1 })} className="w-full border-2 border-[#347a58] bg-[#163a2a] py-2 font-pixel text-[8px] text-[#9ff0bb]">Criar modo</button>
                {content.modes.map(mode => <button key={mode.id} onClick={() => setModeDraft(clone(mode))} className={`w-full border px-2 py-2 text-left ${mode.id === content.activeModeId ? 'border-[#d8bb5b] text-[#f0dc87]' : 'border-[#263943] text-[#8ba0a8]'}`}>{mode.name}</button>)}
              </aside>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ID" value={modeDraft.id} onChange={value => setModeDraft(prev => ({ ...prev, id: value }))} />
                  <Field label="Nome" value={modeDraft.name} onChange={value => setModeDraft(prev => ({ ...prev, name: value }))} />
                </div>
                <TextArea label="Descrição" value={modeDraft.description} onChange={value => setModeDraft(prev => ({ ...prev, description: value }))} />
                <label className="block"><span className="block text-[11px] uppercase text-[#6f8790] mb-1">Mapa</span><select value={modeDraft.mapId} onChange={event => setModeDraft(prev => ({ ...prev, mapId: event.target.value }))} className="w-full bg-[#091117] border border-[#2a3b46] p-2">{content.maps.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                  <Field label="Tamanho do time" type="number" min={1} max={5} value={modeDraft.teamSize} onChange={value => setModeDraft(prev => ({ ...prev, teamSize: Math.max(1, Math.min(5, num(value))) }))} />
                  <Field label="Ouro inicial" type="number" value={modeDraft.startingGold} onChange={value => setModeDraft(prev => ({ ...prev, startingGold: num(value) }))} />
                  <Field label="Intervalo de ondas" type="number" value={modeDraft.waveInterval} onChange={value => setModeDraft(prev => ({ ...prev, waveInterval: Math.max(5, num(value)) }))} />
                  <Field label="Nível máximo" type="number" value={modeDraft.maxLevel} onChange={value => setModeDraft(prev => ({ ...prev, maxLevel: Math.max(1, num(value)) }))} />
                  <Field label="Ouro passivo/s" type="number" step={0.1} value={modeDraft.passiveGoldRate} onChange={value => setModeDraft(prev => ({ ...prev, passiveGoldRate: num(value) }))} />
                  <Field label="Escala respawn" type="number" step={0.05} value={modeDraft.respawnScale} onChange={value => setModeDraft(prev => ({ ...prev, respawnScale: num(value) }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveMode} className="border-2 border-[#347a58] bg-[#163a2a] px-5 py-2 font-pixel text-[8px] text-[#9ff0bb]">Salvar modo</button>
                  <button onClick={() => persist({ ...content, activeModeId: modeDraft.id }, `${modeDraft.name} definido como modo ativo.`)} className="border-2 border-[#745d27] bg-[#302711] px-5 py-2 font-pixel text-[8px] text-[#f0dc87]">Definir ativo</button>
                  <button onClick={() => persist({ ...content, modes: content.modes.filter(mode => mode.id !== modeDraft.id), activeModeId: content.activeModeId === modeDraft.id ? content.modes[0]?.id ?? 'classic' : content.activeModeId }, 'Modo removido.')} className="border-2 border-[#743739] bg-[#40191c] px-5 py-2 font-pixel text-[8px] text-[#ffb0a8]">Excluir</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'published' && (
            <div className="space-y-4">
              <div className="border-2 border-[#745d27] bg-[#17160f] p-5">
                <h2 className="font-pixel text-[11px] text-[#e2c45e] mb-2">CONTEÚDO AUTORITATIVO PUBLICADO</h2>
                <p className="text-[13px] text-[#9aaab0] max-w-4xl">
                  Este pack é o único conteúdo aceito em partidas online nesta versão. Alterações salvas nas abas de Heróis/Itens continuam sendo drafts locais do protótipo e não ganham autoridade de servidor automaticamente.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="border border-[#3d4528] bg-[#0d151c] p-3">
                    <div className="text-[10px] uppercase text-[#6f8790]">Versão</div>
                    <div className="font-mono text-[#e8d8b0]">{CURRENT_AUTHORITATIVE_CONTENT.manifest.version}</div>
                  </div>
                  <div className="border border-[#3d4528] bg-[#0d151c] p-3">
                    <div className="text-[10px] uppercase text-[#6f8790]">Hash</div>
                    <div className="font-mono text-[#80e0a0]">{CURRENT_AUTHORITATIVE_CONTENT.manifest.hash}</div>
                  </div>
                  <div className="border border-[#3d4528] bg-[#0d151c] p-3">
                    <div className="text-[10px] uppercase text-[#6f8790]">Content Version</div>
                    <div className="font-mono text-[12px] break-all text-[#8ac8ff]">{CURRENT_AUTHORITATIVE_CONTENT.contentVersion}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-[#263943] bg-[#101b23] p-4">
                  <h3 className="font-pixel text-[9px] text-[#5ad0c0] mb-3">HERÓIS ONLINE</h3>
                  <div className="space-y-2">
                    {CURRENT_AUTHORITATIVE_CONTENT.payload.heroes.map(hero => (
                      <div key={hero.id} className="border border-[#263943] bg-[#091117] p-3">
                        <div className="font-mono text-[#e8d8b0]">{hero.id}</div>
                        <div className="text-[12px] text-[#879ca5]">
                          HP {hero.maxHp} · AD {hero.attackDamage} · range {hero.attackRange} · move/tick {hero.moveSpeedPerTick}
                        </div>
                        <div className="text-[12px] text-[#c5b56f]">
                          Q {hero.q.runtime} · dano {hero.q.damageBase} + {hero.q.damageAdPermille / 10}% AD · CD {hero.q.cooldownTicks} ticks
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[#263943] bg-[#101b23] p-4">
                  <h3 className="font-pixel text-[9px] text-[#5ad0c0] mb-3">ITENS ONLINE</h3>
                  <div className="space-y-2">
                    {CURRENT_AUTHORITATIVE_CONTENT.payload.items.map(item => (
                      <div key={item.id} className="border border-[#263943] bg-[#091117] p-3">
                        <div className="flex justify-between gap-3">
                          <span className="font-mono text-[#e8d8b0]">{item.name} ({item.id})</span>
                          <span className="text-[#e8c860]">{item.cost}g</span>
                        </div>
                        <div className="text-[12px] text-[#879ca5]">
                          {Object.entries(item.stats).map(([key, value]) => key + ' +' + value).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-[#384b55] bg-[#0c151d] p-4 text-[12px] text-[#91a6af]">
                <b className="text-[#ffcf7a]">Pipeline seguro:</b> draft local → revisão/validação → pack publicado → hash novo → clientes e servidor precisam carregar exatamente o mesmo hash. Uma futura API administrativa protegida poderá automatizar a etapa de publicação sem dar autoridade ao navegador.
              </div>
            </div>
          )}

          {tab === 'maps' && (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-2">
                <button onClick={() => setMapDraft({ id: `map-${Date.now()}`, name: 'Novo Mapa', description: 'Variante visual do mapa.', theme: 'forest', ambientColor: '#5b8d55', fogOpacity: 0.68, riverColor: '#5a9cc5', laneColor: '#9c835c', forestColor: '#345a38' })} className="w-full border-2 border-[#347a58] bg-[#163a2a] py-2 font-pixel text-[8px] text-[#9ff0bb]">Criar mapa</button>
                {content.maps.map(map => <button key={map.id} onClick={() => setMapDraft(clone(map))} className="w-full border border-[#263943] px-2 py-2 text-left text-[#8ba0a8]">{map.name}</button>)}
              </aside>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ID" value={mapDraft.id} onChange={value => setMapDraft(prev => ({ ...prev, id: value }))} />
                  <Field label="Nome" value={mapDraft.name} onChange={value => setMapDraft(prev => ({ ...prev, name: value }))} />
                </div>
                <TextArea label="Descrição" value={mapDraft.description} onChange={value => setMapDraft(prev => ({ ...prev, description: value }))} />
                <label className="block"><span className="block text-[11px] uppercase text-[#6f8790] mb-1">Tema</span><select value={mapDraft.theme} onChange={event => setMapDraft(prev => ({ ...prev, theme: event.target.value as AdminTheme }))} className="w-full bg-[#091117] border border-[#2a3b46] p-2">{['forest','desert','frost','void','volcanic'].map(theme => <option key={theme}>{theme}</option>)}</select></label>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Field label="Ambiente" type="color" value={mapDraft.ambientColor} onChange={value => setMapDraft(prev => ({ ...prev, ambientColor: value }))} />
                  <Field label="Rio" type="color" value={mapDraft.riverColor} onChange={value => setMapDraft(prev => ({ ...prev, riverColor: value }))} />
                  <Field label="Rotas" type="color" value={mapDraft.laneColor} onChange={value => setMapDraft(prev => ({ ...prev, laneColor: value }))} />
                  <Field label="Floresta" type="color" value={mapDraft.forestColor} onChange={value => setMapDraft(prev => ({ ...prev, forestColor: value }))} />
                  <Field label="Opacidade fog" type="number" min={0} max={0.95} step={0.01} value={mapDraft.fogOpacity} onChange={value => setMapDraft(prev => ({ ...prev, fogOpacity: Math.max(0, Math.min(0.95, num(value))) }))} />
                </div>
                <div className="h-28 border-2 border-[#263943]" style={{ background: `linear-gradient(135deg, ${mapDraft.forestColor}, ${mapDraft.laneColor} 45%, ${mapDraft.riverColor} 70%, ${mapDraft.ambientColor})` }} />
                <div className="flex gap-2">
                  <button onClick={saveMap} className="border-2 border-[#347a58] bg-[#163a2a] px-5 py-2 font-pixel text-[8px] text-[#9ff0bb]">Salvar mapa</button>
                  <button onClick={() => persist({ ...content, maps: content.maps.filter(map => map.id !== mapDraft.id) }, 'Mapa removido.')} className="border-2 border-[#743739] bg-[#40191c] px-5 py-2 font-pixel text-[8px] text-[#ffb0a8]">Excluir</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t-2 border-[#263943] px-4 py-2 text-[12px] text-[#77909a]">
          <span className="mr-auto">{message}</span>
          <span>{HEROES.length} heróis · {ITEMS.length} itens · {content.modes.length} modos · {content.maps.length} mapas</span>
          <button onClick={() => { const next = resetAdminContent(); setContent(next); onContentChange(next); setMessage('Conteúdo administrativo restaurado.'); }} className="border border-[#743739] px-2 py-1 text-[#ff9d95]">Restaurar tudo</button>
        </footer>
      </section>
    </div>
  );
}

function clampTier(value: number): 1 | 2 | 3 {
  return Math.max(1, Math.min(3, Math.round(value))) as 1 | 2 | 3;
}