import { Filter } from 'pixi.js';

export interface EnergyPulseFilter extends Filter {
  resources: Filter['resources'] & {
    timeUniforms: {
      uniforms: {
        uTime: number;
        uStrength: number;
      };
    };
  };
}

export function createEnergyPulseFilter(): EnergyPulseFilter {
  return Filter.from({
    gl: {
      fragment: `
        in vec2 vTextureCoord;
        out vec4 finalColor;
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform float uStrength;

        void main() {
          vec4 color = texture(uTexture, vTextureCoord);
          float band = 0.5 + 0.5 * sin((vTextureCoord.x + vTextureCoord.y) * 22.0 - uTime * 5.0);
          float energy = 1.0 + band * 0.22 * uStrength;
          finalColor = vec4(color.rgb * energy, color.a);
        }
      `,
    },
    resources: {
      timeUniforms: {
        uTime: { value: 0, type: 'f32' },
        uStrength: { value: 1, type: 'f32' },
      },
    },
  }) as EnergyPulseFilter;
}

export function advanceEnergyPulse(filter: EnergyPulseFilter, deltaMs: number, strength: number): void {
  filter.resources.timeUniforms.uniforms.uTime += Math.max(0, Math.min(50, deltaMs)) / 1000;
  filter.resources.timeUniforms.uniforms.uStrength = strength;
}
