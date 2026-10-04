import { Filter, GlProgram } from 'pixi.js';

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

const vertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

const fragment = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uStrength;

  void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    float band = 0.5 + 0.5 * sin((vTextureCoord.x + vTextureCoord.y) * 22.0 - uTime * 5.0);
    float energy = 1.0 + band * 0.22 * uStrength;
    finalColor = vec4(color.rgb * energy, color.a);
  }
`;

export function createEnergyPulseFilter(): EnergyPulseFilter {
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment }),
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
