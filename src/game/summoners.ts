// ============ FEITIÇOS DE INVOCADOR ============
export interface SummonerDef {
  id: string;
  name: string;
  desc: string;
  cd: number;
  icon: string;
  color: string;
}

export const SUMMONERS: Record<string, SummonerDef> = {
  flash: { id: 'flash', name: 'Flash', desc: 'Teleporta instantaneamente até 200px na direção do cursor. (OBRIGATÓRIO)', cd: 180, icon: '✦', color: '#ffe080' },
  ignite: { id: 'ignite', name: 'Incendiar', desc: 'Queima o alvo por 5s, causando dano verdadeiro e reduzindo cura.', cd: 150, icon: '🔥', color: '#ff6030' },
  heal: { id: 'heal', name: 'Cura', desc: 'Restaura 180 + 15×nv de vida a você e ao aliado mais próximo.', cd: 180, icon: '✚', color: '#60e080' },
  smite: { id: 'smite', name: 'Castigar', desc: 'Causa 500 de dano verdadeiro a um monstro. Recompensa de ouro extra na selva.', cd: 60, icon: '⚡', color: '#c080ff' },
  exhaust: { id: 'exhaust', name: 'Esgotar', desc: 'Reduz o dano e a velocidade do alvo por 2,5s.', cd: 180, icon: '☠', color: '#c0a060' },
  teleport: { id: 'teleport', name: 'Teleporte', desc: 'Canaliza 3,5s e teleporta até um aliado, torre ou ward.', cd: 240, icon: '⟲', color: '#60a0ff' },
  barrier: { id: 'barrier', name: 'Barreira', desc: 'Escudo que absorve 120 + 20×nv de dano por 2s.', cd: 150, icon: '🛡', color: '#a0d0ff' },
  clarity: { id: 'clarity', name: 'Clareza', desc: 'Restaura 40% da mana máxima a você e aliados próximos.', cd: 180, icon: '💧', color: '#80c0ff' },
};

export const DEFAULT_SUMMONERS = ['flash', 'ignite'];
