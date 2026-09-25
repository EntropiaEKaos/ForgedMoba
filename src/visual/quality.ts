export type VisualQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface VisualQualityPreset {
  dprCap: number;
  antialias: boolean;
  powerPreference: 'low-power' | 'high-performance';
  shadowSamples: number;
  particles: number;
  environmentParticles: number;
  bloom: boolean;
  distortion: boolean;
  dynamicLights: number;
  screenShakeScale: number;
}

export const VISUAL_QUALITY: Readonly<Record<VisualQuality, VisualQualityPreset>> = {
  low: {
    dprCap: 1,
    antialias: false,
    powerPreference: 'low-power',
    shadowSamples: 0,
    particles: 160,
    environmentParticles: 40,
    bloom: false,
    distortion: false,
    dynamicLights: 0,
    screenShakeScale: 0.6,
  },
  medium: {
    dprCap: 1.25,
    antialias: true,
    powerPreference: 'high-performance',
    shadowSamples: 1,
    particles: 420,
    environmentParticles: 100,
    bloom: false,
    distortion: true,
    dynamicLights: 4,
    screenShakeScale: 0.8,
  },
  high: {
    dprCap: 1.5,
    antialias: true,
    powerPreference: 'high-performance',
    shadowSamples: 2,
    particles: 900,
    environmentParticles: 220,
    bloom: true,
    distortion: true,
    dynamicLights: 8,
    screenShakeScale: 1,
  },
  ultra: {
    dprCap: 2,
    antialias: true,
    powerPreference: 'high-performance',
    shadowSamples: 4,
    particles: 1800,
    environmentParticles: 500,
    bloom: true,
    distortion: true,
    dynamicLights: 16,
    screenShakeScale: 1.15,
  },
};

const STORAGE_KEY = 'forgedmoba_visual_quality';

export function normalizeVisualQuality(value: unknown): VisualQuality {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'ultra'
    ? value
    : 'high';
}

export function readVisualQuality(): VisualQuality {
  if (typeof window === 'undefined') return 'high';
  return normalizeVisualQuality(window.localStorage.getItem(STORAGE_KEY));
}

export function saveVisualQuality(value: VisualQuality): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value);
}

export function effectiveResolution(quality: VisualQuality, devicePixelRatio: number): number {
  return Math.max(1, Math.min(VISUAL_QUALITY[quality].dprCap, devicePixelRatio || 1));
}
