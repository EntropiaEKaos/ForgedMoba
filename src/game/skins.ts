// ============ SISTEMA DE SKINS ============
// Skins recolorizam o `look` do herói + adicionam modificadores visuais
// (aura, cor de rastro, partículas de ataque).
import type { HeroDef } from './heroes';

export interface SkinMods {
  // rastro/aura visual (opcional)
  trailColor?: string;       // cor do rastro de projéteis deste herói
  auraColor?: string;        // aura pulsante ao redor da base
  particleColor?: string;    // cor das partículas de ataque básico
  glowColor?: string;        // brilho da arma/o corpo
}

export interface Skin {
  id: string;
  heroId: string;
  name: string;
  desc: string;
  rarity: 'comum' | 'rara' | 'épica' | 'lendária';
  // override completo das cores do look
  look: {
    skin: string; hair: string; armor: string; trim: string; legs: string;
    weaponColor: string; cape?: string; helmet?: boolean; hood?: boolean; robot?: boolean; furry?: boolean;
  };
  mods?: SkinMods;
}

// ---------- SKINS POR HERÓI ----------
// Cada skin substitui as cores. As "lendárias" mudam a silhueta (via booleans/tintas especiais).
export const SKINS: Skin[] = [
  // Gareth — Cavaleiro de Demacia
  {
    id: 'gareth_commander', heroId: 'gareth', name: 'Comandante de Aço', desc: 'Uma armadura reluzente forjada para a glória.', rarity: 'rara',
    look: { skin: '#e8bd92', hair: '#6b4a2b', armor: '#8a9ab0', trim: '#c8d8e8', legs: '#4a5a6a', weaponColor: '#e8f0f8', cape: '#3a4a6a' },
    mods: { trailColor: '#c0d8f0', particleColor: '#e8f0ff' },
  },
  {
    id: 'gareth_ember', heroId: 'gareth', name: 'Cavaleiro de Brasas', desc: 'A fúria das forjas demacianas o consome.', rarity: 'épica',
    look: { skin: '#d9a47a', hair: '#8c3a1e', armor: '#a83a1e', trim: '#ffb040', legs: '#5c1e0e', weaponColor: '#ff8040', cape: '#7c2410' },
    mods: { trailColor: '#ff9050', particleColor: '#ffc070', auraColor: '#ff6020', glowColor: '#ff8040' },
  },
  {
    id: 'gareth_void', heroId: 'gareth', name: 'Cavaleiro do Vazio', desc: 'Corrompido pelas profundezas do Vazio.', rarity: 'lendária',
    look: { skin: '#8a5aa0', hair: '#2a1030', armor: '#5c3a7c', trim: '#c080ff', legs: '#2a1a3c', weaponColor: '#a060e0', cape: '#3a1a4c', robot: false },
    mods: { trailColor: '#b080ff', particleColor: '#d0b0ff', auraColor: '#8040c0', glowColor: '#c090ff' },
  },

  // Anya — A Criança Sombria
  {
    id: 'anya_mecha', heroId: 'anya', name: 'Anya 3000', desc: 'A criança que virou máquina de guerra.', rarity: 'épica',
    look: { skin: '#c0c8d0', hair: '#e0e8f0', armor: '#cc5555', trim: '#ffe080', legs: '#333a44', weaponColor: '#ff8855', robot: true },
    mods: { trailColor: '#ffb060', particleColor: '#ffd0a0', auraColor: '#ff8050' },
  },
  {
    id: 'anya_pumpkin', heroId: 'anya', name: 'Mestra da Abóbora', desc: 'Assombrando Summoner\'s Rift no Dia das Bruxas.', rarity: 'rara',
    look: { skin: '#f2cba8', hair: '#5c3a2a', armor: '#e86a20', trim: '#ffe800', legs: '#4a2a14', weaponColor: '#ff9040', hood: true },
    mods: { trailColor: '#ff8040', particleColor: '#ffc060' },
  },

  // Ashka — Arqueira do Gelo
  {
    id: 'ashka_amazed', heroId: 'ashka', name: 'Arqueira Maravilha', desc: 'Ela vê tudo e não erra nenhum alvo.', rarity: 'épica',
    look: { skin: '#f6dcc4', hair: '#f0c858', armor: '#6a5ac8', trim: '#ffd860', legs: '#3a2a6a', weaponColor: '#ffd060' },
    mods: { trailColor: '#ffd870', particleColor: '#ffe8a0' },
  },
  {
    id: 'ashka_frostqueen', heroId: 'ashka', name: 'Rainha do Gelo', desc: 'Seu coração pertence ao inverno.', rarity: 'lendária',
    look: { skin: '#ffffff', hair: '#c0e8ff', armor: '#40b8e8', trim: '#e8f8ff', legs: '#1e5a7c', weaponColor: '#80d8ff', cape: '#1e6a9c' },
    mods: { trailColor: '#a0e8ff', particleColor: '#e0f8ff', auraColor: '#60c8ff', glowColor: '#c0f0ff' },
  },

  // Yamir — Espadachim Wuju
  {
    id: 'yamir_assassin', heroId: 'yamir', name: 'Fantasma Juju', desc: 'A lâmina invisível que corta da sombra.', rarity: 'rara',
    look: { skin: '#c2c8d0', hair: '#2a2a2a', armor: '#4a8c64', trim: '#e8d060', legs: '#1e3c2a', weaponColor: '#c0f0d0', helmet: false },
    mods: { trailColor: '#50e0a0', particleColor: '#c0ffd0' },
  },
  {
    id: 'yamir_duelist', heroId: 'yamir', name: 'Duelista Carmesim', desc: 'Um duelo de honra ao pôr do sol.', rarity: 'épica',
    look: { skin: '#e8c8a0', hair: '#3a1e1e', armor: '#c02828', trim: '#ffe8a0', legs: '#5c1a1a', weaponColor: '#ffe060' },
    mods: { trailColor: '#ff6070', particleColor: '#ffd0a0' },
  },

  // Rizar — Mago Rúnico
  {
    id: 'rizar_darkchills', heroId: 'rizar', name: 'Mago das Trevas', desc: 'Runas antigas de poder proibido.', rarity: 'épica',
    look: { skin: '#a8b8d0', hair: '#e0e0e0', armor: '#2a2a3c', trim: '#e8c860', legs: '#1a1a2a', weaponColor: '#b090ff' },
    mods: { trailColor: '#a080ff', particleColor: '#d0c0ff', auraColor: '#8040ff' },
  },

  // Timo — Explorador Veloz
  {
    id: 'timo_happy', heroId: 'timo', name: 'Timo Feliz', desc: 'Ninguém desconfia do dano que ele causa.', rarity: 'comum',
    look: { skin: '#f0dab4', hair: '#e8e0c0', armor: '#3e9c3e', trim: '#ffe060', legs: '#2a5c2a', weaponColor: '#80d050', furry: true },
  },
  {
    id: 'timo_recon', heroId: 'timo', name: 'Rebelde Urso', desc: 'Pronto para caçar. Ninguém é invulnerável.', rarity: 'lendária',
    look: { skin: '#e0b890', hair: '#3a2a1a', armor: '#e86830', trim: '#404040', legs: '#2a1a10', weaponColor: '#c0c0c8', helmet: true, furry: true },
    mods: { trailColor: '#ff9050', particleColor: '#ffc070', glowColor: '#ff8040' },
  },

  // Luxana — Dama Luminosa
  {
    id: 'lux_star', heroId: 'luxana', name: 'Lux das Estrelas', desc: 'Brilha como uma nebulosa distante.', rarity: 'épica',
    look: { skin: '#f1d6b0', hair: '#f0d880', armor: '#e0dcf0', trim: '#ffd34e', legs: '#8a80c0', weaponColor: '#ffd34e' },
    mods: { trailColor: '#ffe8a0', particleColor: '#fff8e0', auraColor: '#ffd860', glowColor: '#fff0c0' },
  },

  // Darion — Mão de Noxus
  {
    id: 'darion_rubytitan', heroId: 'darion', name: 'Titã de Rubi', desc: 'Sua fúria é eterna como cristal.', rarity: 'épica',
    look: { skin: '#d9a888', hair: '#2a1a1a', armor: '#c01860', trim: '#ffd060', legs: '#5c0e28', weaponColor: '#ff78a0', cape: '#7c0e34' },
    mods: { trailColor: '#ff5080', particleColor: '#ffb0c0', auraColor: '#ff2060' },
  },
  {
    id: 'darion_cyber', heroId: 'darion', name: 'Noxus Cibernético', desc: 'Reforçado além da carne.', rarity: 'lendária',
    look: { skin: '#9aa4ae', hair: '#2a2a2a', armor: '#3a4a6a', trim: '#50ffc0', legs: '#1a2a3a', weaponColor: '#20c8ff', robot: false },
    mods: { trailColor: '#50e0ff', particleColor: '#c0f8ff', auraColor: '#20c0ff', glowColor: '#70f0ff' },
  },

  // Katya — Adaga Sinistra
  {
    id: 'katya_ivory', heroId: 'katya', name: 'Lâmina de Marfim', desc: 'Elegante como a morte.', rarity: 'rara',
    look: { skin: '#f2d0b0', hair: '#f0c0d0', armor: '#a03050', trim: '#ffe0f0', legs: '#4a1a2a', weaponColor: '#f0e8f0' },
    mods: { trailColor: '#ffa0c0', particleColor: '#ffe0f0' },
  },

  // Blitz — Golem a Vapor
  {
    id: 'blitz_machn', heroId: 'blitz', name: 'Goleta Mecânica', desc: 'Mais rápido, mais forte, mais ferro.', rarity: 'épica',
    look: { skin: '#e0b060', hair: '#111', armor: '#2e6a9c', trim: '#c8a848', legs: '#1e4a6a', weaponColor: '#ffd060', robot: true },
    mods: { trailColor: '#60c0ff', particleColor: '#c0e8ff', auraColor: '#40a0ff' },
  },
  {
    id: 'blitz_pilot', heroId: 'blitz', name: 'Golem Piloto', desc: 'Um relâmpago em forma de punho.', rarity: 'lendária',
    look: { skin: '#c8d0d8', hair: '#101820', armor: '#1a1030', trim: '#ffe860', legs: '#2a2a2a', weaponColor: '#ffe860', robot: true },
    mods: { trailColor: '#ffe860', particleColor: '#fff0c0', auraColor: '#ffd000', glowColor: '#ffe860' },
  },

  // Warrik — Lobo de Zaun
  {
    id: 'warrik_zombie', heroId: 'warrik', name: 'Lobo Carniceiro', desc: 'Uma fome que nem a morte apaga.', rarity: 'épica',
    look: { skin: '#7a8a7a', hair: '#5a6a5a', armor: '#4a6a3a', trim: '#ff7060', legs: '#2e4a2a', weaponColor: '#ff5060', furry: true },
    mods: { trailColor: '#ff6070', particleColor: '#ffb0a0', auraColor: '#50ff80' },
  },

  // Morgause — Anja Caída
  {
    id: 'morg_ghostly', heroId: 'morgause', name: 'Anja Espectral', desc: 'Um eco de doce vingança.', rarity: 'épica',
    look: { skin: '#fff', hair: '#6a4aa0', armor: '#e0e0f0', trim: '#a0c0ff', legs: '#c0c8e0', weaponColor: '#c0d0ff', cape: '#8080c0' },
    mods: { trailColor: '#c0d0ff', particleColor: '#e8f0ff', auraColor: '#a080ff' },
  },
];

export const SKIN_BY_ID: Record<string, Skin> = Object.fromEntries(SKINS.map(s => [s.id, s]));
export const SKINS_BY_HERO: Record<string, Skin[]> = SKINS.reduce((acc, s) => {
  (acc[s.heroId] ||= []).push(s);
  return acc;
}, {} as Record<string, Skin[]>);

/** Aplica uma skin ao `look` base, devolvendo um novo `look` combinado. */
export function applySkin(base: HeroDef['look'], skin: Skin): HeroDef['look'] {
  return {
    ...base,
    skin: skin.look.skin,
    hair: skin.look.hair,
    armor: skin.look.armor,
    trim: skin.look.trim,
    legs: skin.look.legs,
    weaponColor: skin.look.weaponColor,
    cape: skin.look.cape ?? base.cape,
    helmet: skin.look.helmet ?? base.helmet,
    hood: skin.look.hood ?? base.hood,
    robot: skin.look.robot ?? base.robot,
    furry: skin.look.furry ?? base.furry,
  };
}

export function getSkinRarityColor(r: Skin['rarity']): string {
  return r === 'comum' ? '#9ab0b8' : r === 'rara' ? '#40c060' : r === 'épica' ? '#a060ff' : '#ffb040';
}
