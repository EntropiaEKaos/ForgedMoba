export type AdminTheme = 'forest' | 'desert' | 'frost' | 'void' | 'volcanic';

export interface GameModeDef {
  id: string;
  name: string;
  description: string;
  mapId: string;
  teamSize: number;
  startingGold: number;
  waveInterval: number;
  maxLevel: number;
  passiveGoldRate: number;
  respawnScale: number;
}

export interface MapPresetDef {
  id: string;
  name: string;
  description: string;
  theme: AdminTheme;
  ambientColor: string;
  fogOpacity: number;
  riverColor: string;
  laneColor: string;
  forestColor: string;
}