import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Texture,
} from 'pixi.js';
import { GlowFilter } from 'pixi-filters/glow';
import type { SimulationState } from '../simulation/types.ts';
import {
  environmentDecorBudget,
  generateEnvironmentDecor,
  type EnvironmentDecor,
} from './environmentModel.ts';
import { nextVisualRandom } from './fxModel.ts';
import { VISUAL_QUALITY, type VisualQuality } from './quality.ts';

interface AmbientParticle {
  particle: Particle;
  baseX: number;
  baseY: number;
  phase: number;
  drift: number;
  lift: number;
}

export class EnvironmentRuntime {
  readonly background = new Container();
  readonly foreground = new Container();
  readonly ambientParticles = new ParticleContainer({
    dynamicProperties: {
      position: true,
      vertex: true,
      rotation: true,
      color: true,
    },
    boundsArea: new Rectangle(0, 0, 100_000, 100_000),
  });

  private readonly river = new Graphics();
  private readonly decorLayer = new Container();
  private readonly auraLayer = new Graphics();
  private readonly auraGlow = new GlowFilter({
    distance: 18,
    outerStrength: 1.1,
    innerStrength: 0.15,
    color: 0xffffff,
    quality: 0.18,
  });
  private readonly decorNodes = new Map<number, Graphics>();
  private ambient: AmbientParticle[] = [];
  private decor: EnvironmentDecor[] = [];
  private key = '';
  private elapsed = 0;

  constructor() {
    this.auraLayer.filters = [this.auraGlow];
    this.background.addChild(this.river);
    this.background.addChild(this.decorLayer);
    this.foreground.addChild(this.auraLayer);
  }

  update(
    deltaMs: number,
    state: SimulationState,
    localPlayerId: string | undefined,
    quality: VisualQuality,
  ): void {
    this.elapsed += Math.max(0, Math.min(50, deltaMs)) / 1000;
    this.auraGlow.enabled = quality === 'high' || quality === 'ultra';
    this.ensureWorld(state.width, state.height, quality);
    this.animateRiver(state.width, state.height);
    this.animateDecor(quality);
    this.updateAmbient(quality);
    this.updateAuras(state, localPlayerId, quality);
  }

  destroy(): void {
    for (const live of this.ambient) this.ambientParticles.removeParticle(live.particle);
    this.ambient = [];
    this.decorNodes.clear();
    this.background.destroy({ children: true });
    this.foreground.destroy({ children: true });
    this.ambientParticles.destroy();
  }

  private ensureWorld(width: number, height: number, quality: VisualQuality): void {
    const budget = environmentDecorBudget(quality);
    const key = width + ':' + height + ':' + quality + ':' + budget;
    if (key === this.key) return;
    this.key = key;

    this.decor = generateEnvironmentDecor(width, height, budget);
    this.decorLayer.removeChildren().forEach((child) => child.destroy());
    this.decorNodes.clear();

    for (const entry of this.decor) {
      const graphic = new Graphics();
      if (entry.kind === 'vegetation') {
        graphic
          .ellipse(0, 0, 13 * entry.scale, 22 * entry.scale)
          .fill({ color: 0x214b34, alpha: 0.88 })
          .ellipse(7 * entry.scale, -7 * entry.scale, 9 * entry.scale, 17 * entry.scale)
          .fill({ color: 0x2e6543, alpha: 0.82 });
      } else if (entry.kind === 'torch') {
        graphic
          .rect(-2, 0, 4, 18 * entry.scale)
          .fill({ color: 0x5c4030, alpha: 0.9 })
          .circle(0, -3, 7 * entry.scale)
          .fill({ color: 0xffa642, alpha: 0.92 });
        if (VISUAL_QUALITY[quality].dynamicLights > 0) {
          graphic
            .circle(0, -3, 28 * entry.scale)
            .fill({ color: 0xffb24f, alpha: quality === 'ultra' ? 0.12 : 0.07 });
        }
      } else {
        graphic
          .ellipse(0, 0, 42 * entry.scale, 18 * entry.scale)
          .fill({ color: 0xbfd8dc, alpha: 0.055 });
      }

      graphic.position.set(entry.x, entry.y);
      this.decorNodes.set(entry.id, graphic);
      this.decorLayer.addChild(graphic);
    }

    this.rebuildAmbient(width, height, quality);
  }

  private rebuildAmbient(width: number, height: number, quality: VisualQuality): void {
    for (const live of this.ambient) this.ambientParticles.removeParticle(live.particle);
    this.ambient = [];

    const count = Math.min(
      VISUAL_QUALITY[quality].environmentParticles,
      quality === 'low' ? 50 : quality === 'medium' ? 120 : quality === 'high' ? 260 : 520,
    );
    let seed = ((width * 73856093) ^ (height * 19349663) ^ 0x51f15e) >>> 0 || 1;

    for (let i = 0; i < count; i += 1) {
      const a = nextVisualRandom(seed); seed = a.state;
      const b = nextVisualRandom(seed); seed = b.state;
      const c = nextVisualRandom(seed); seed = c.state;
      const d = nextVisualRandom(seed); seed = d.state;
      const x = a.value * width;
      const y = b.value * height;
      const size = 1.5 + c.value * (quality === 'ultra' ? 4.5 : 3.2);
      const particle = new Particle({
        texture: Texture.WHITE,
        x,
        y,
        scaleX: size,
        scaleY: size,
        tint: d.value > 0.72 ? 0xd4efc8 : 0xc7d6cf,
        alpha: 0.08 + c.value * 0.18,
      });
      this.ambientParticles.addParticle(particle);
      this.ambient.push({
        particle,
        baseX: x,
        baseY: y,
        phase: c.value * Math.PI * 2,
        drift: 8 + d.value * 22,
        lift: 4 + a.value * 15,
      });
    }
  }

  private animateRiver(width: number, height: number): void {
    const riverX = width * 0.5;
    const half = 86;
    const wave = Math.sin(this.elapsed * 1.25) * 9;
    const second = Math.sin(this.elapsed * 0.7 + 1.3) * 14;
    this.river.clear()
      .rect(riverX - half, 0, half * 2, height)
      .fill({ color: 0x153e51, alpha: 0.36 })
      .rect(riverX - 54 + wave, 0, 4, height)
      .fill({ color: 0x75c6d8, alpha: 0.08 })
      .rect(riverX + 28 + second, 0, 3, height)
      .fill({ color: 0xa3e0eb, alpha: 0.06 });
  }

  private animateDecor(quality: VisualQuality): void {
    const animateVegetation = quality !== 'low';
    for (const entry of this.decor) {
      const node = this.decorNodes.get(entry.id);
      if (!node) continue;
      if (entry.kind === 'vegetation' && animateVegetation) {
        node.rotation = Math.sin(this.elapsed * 1.1 + entry.phase) * 0.035;
        node.scale.x = 1 + Math.sin(this.elapsed * 0.82 + entry.phase) * 0.025;
      } else if (entry.kind === 'torch') {
        node.alpha = 0.88 + Math.sin(this.elapsed * 7.3 + entry.phase) * 0.12;
      } else if (entry.kind === 'mist') {
        node.x = entry.x + Math.sin(this.elapsed * 0.18 + entry.phase) * 34;
        node.alpha = 0.7 + Math.sin(this.elapsed * 0.3 + entry.phase) * 0.2;
      }
    }
  }

  private updateAmbient(quality: VisualQuality): void {
    if (quality === 'low') {
      for (const live of this.ambient) live.particle.alpha *= 0.985;
      return;
    }
    for (const live of this.ambient) {
      live.particle.x = live.baseX + Math.sin(this.elapsed * 0.28 + live.phase) * live.drift;
      live.particle.y = live.baseY - (this.elapsed * live.lift % 90) + Math.cos(this.elapsed * 0.42 + live.phase) * 8;
      live.particle.alpha = 0.06 + (Math.sin(this.elapsed * 0.8 + live.phase) + 1) * 0.055;
    }
  }

  private updateAuras(
    state: SimulationState,
    localPlayerId: string | undefined,
    quality: VisualQuality,
  ): void {
    this.auraLayer.clear();

    const local = Object.values(state.entities)
      .filter((entity) => entity.ownerPlayerId === localPlayerId)
      .sort((a, b) => a.id - b.id)[0];
    const localTeam = local?.team;

    for (const entity of Object.values(state.entities)) {
      if (entity.dead) continue;

      if (entity.kind === 'objective') {
        const pulse = 1 + Math.sin(this.elapsed * 2.3) * 0.08;
        this.auraLayer
          .circle(entity.x, entity.y, Math.max(50, entity.radius * 2.8) * pulse)
          .fill({ color: 0x9b5de5, alpha: quality === 'low' ? 0.045 : 0.085 })
          .circle(entity.x, entity.y, Math.max(58, entity.radius * 3.1) * pulse)
          .stroke({ color: 0xc59aff, alpha: 0.18, width: 2 });
      }

      if (entity.kind === 'tower' && quality !== 'low') {
        const towerColor = entity.team === 0 ? 0x55bdff : 0xff6868;
        const pulse = 1 + Math.sin(this.elapsed * 1.45 + entity.id * 0.7) * 0.06;
        this.auraLayer
          .ellipse(entity.x, entity.y + entity.radius * 0.7, entity.radius * 1.75 * pulse, entity.radius * 0.72 * pulse)
          .fill({ color: towerColor, alpha: quality === 'ultra' ? 0.055 : 0.035 })
          .ellipse(entity.x, entity.y + entity.radius * 0.7, entity.radius * 2.05 * pulse, entity.radius * 0.88 * pulse)
          .stroke({ color: towerColor, alpha: 0.14, width: 2 });
      }

      if (entity.kind === 'hero' && entity.ownerPlayerId === localPlayerId && quality !== 'low') {
        const radius = Math.max(36, entity.radius * 2.25);
        const pulse = 1 + Math.sin(this.elapsed * 3.1) * 0.05;
        this.auraLayer
          .circle(entity.x, entity.y + 4, radius * pulse)
          .stroke({ color: 0xffdc70, alpha: quality === 'ultra' ? 0.18 : 0.11, width: 2 })
          .circle(entity.x, entity.y + 4, radius * 1.28 * pulse)
          .stroke({ color: 0x78cfff, alpha: quality === 'ultra' ? 0.075 : 0.045, width: 1.5 });
      }

      if (entity.kind === 'monster' && quality !== 'low') {
        this.auraLayer
          .circle(entity.x, entity.y, Math.max(28, entity.radius * 2.1))
          .fill({ color: 0x6d9f62, alpha: 0.04 });
      }

      if (
        entity.kind === 'ward' &&
        localTeam !== undefined &&
        entity.team === localTeam &&
        quality !== 'low'
      ) {
        this.auraLayer
          .circle(entity.x, entity.y, entity.visionRadius)
          .stroke({
            color: entity.team === 0 ? 0x69d8ff : 0xff8cad,
            alpha: quality === 'ultra' ? 0.1 : 0.065,
            width: 2,
          });
      }
    }
  }
}
