import {
  Container,
  Graphics,
  MeshSimple,
  Particle,
  ParticleContainer,
  Rectangle,
  Text,
  Texture,
} from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';
import { GlowFilter } from 'pixi-filters/glow';
import type { SimulationState } from '../simulation/types.ts';
import {
  fxSeed,
  nextVisualRandom,
  type CombatFxEvent,
} from './fxModel.ts';
import { profileForEvent } from './capabilityRegistry.ts';
import { VisualEventBus } from './visualEventBus.ts';
import { advanceEnergyPulse, createEnergyPulseFilter } from './energyPulseFilter.ts';
import { VISUAL_QUALITY, type VisualQuality } from './quality.ts';

interface LiveParticle {
  particle: Particle;
  vx: number;
  vy: number;
  gravity: number;
  lifeMs: number;
  maxLifeMs: number;
}

interface LiveBeam {
  mesh: MeshSimple;
  lifeMs: number;
  maxLifeMs: number;
}

interface LiveRing {
  graphic: Graphics;
  x: number;
  y: number;
  startRadius: number;
  endRadius: number;
  lifeMs: number;
  maxLifeMs: number;
  color: number;
}

interface LiveLabel {
  text: Text;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
}

function eventKey(event: CombatFxEvent): string {
  return [
    event.type,
    event.tick,
    'entityId' in event ? event.entityId : event.team,
    'slot' in event ? event.slot : '',
    'itemId' in event ? event.itemId : '',
    'targetId' in event ? event.targetId : '',
    'status' in event ? event.status : '',
  ].join(':');
}

export class CombatFxRuntime {
  readonly particles = new ParticleContainer({
    dynamicProperties: {
      position: true,
      vertex: true,
      rotation: true,
      color: true,
    },
    boundsArea: new Rectangle(0, 0, 100_000, 100_000),
  });
  readonly meshes = new Container();
  readonly overlay = new Container();

  private readonly eventBus = new VisualEventBus();
  private readonly glowFilter = new GlowFilter({
    distance: 12,
    outerStrength: 1.7,
    innerStrength: 0.25,
    color: 0xffffff,
    quality: 0.25,
  });
  private readonly bloomFilter = new AdvancedBloomFilter({
    threshold: 0.42,
    bloomScale: 0.72,
    brightness: 1.04,
    blur: 4,
    quality: 2,
  });
  private readonly energyFilter = createEnergyPulseFilter();
  private liveParticles: LiveParticle[] = [];
  private beams: LiveBeam[] = [];
  private rings: LiveRing[] = [];
  private labels: LiveLabel[] = [];
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private shakeEnergy = 0;
  private shakePhase = 0;
  private flashUntil = new Map<number, number>();

  constructor() {
    this.overlay.filters = [this.glowFilter];
    this.meshes.filters = [this.bloomFilter, this.energyFilter];
  }

  observe(state: SimulationState, quality: VisualQuality): void {
    const events = this.eventBus.observe(state);
    for (const event of events) {
      const key = eventKey(event);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      this.seenOrder.push(key);
      if (this.seenOrder.length > 512) {
        const oldest = this.seenOrder.shift();
        if (oldest) this.seen.delete(oldest);
      }
      this.consume(event, quality);
    }
  }

  update(deltaMs: number, quality: VisualQuality): void {
    const dt = Math.max(0, Math.min(50, deltaMs)) / 1000;
    const particleBudget = VISUAL_QUALITY[quality].particles;
    const highFx = quality === 'high' || quality === 'ultra';
    this.glowFilter.enabled = highFx;
    this.bloomFilter.enabled = highFx;
    this.energyFilter.enabled = quality !== 'low';
    advanceEnergyPulse(this.energyFilter, deltaMs, quality === 'ultra' ? 1.25 : quality === 'high' ? 1 : 0.65);

    for (let i = this.liveParticles.length - 1; i >= 0; i -= 1) {
      const live = this.liveParticles[i];
      live.lifeMs -= deltaMs;
      if (live.lifeMs <= 0) {
        this.particles.removeParticle(live.particle);
        this.liveParticles.splice(i, 1);
        continue;
      }
      live.vy += live.gravity * dt;
      live.particle.x += live.vx * dt;
      live.particle.y += live.vy * dt;
      live.particle.rotation += dt * 2.6;
      live.particle.alpha = Math.max(0, live.lifeMs / live.maxLifeMs);
    }

    if (this.liveParticles.length > particleBudget) {
      const remove = this.liveParticles.length - particleBudget;
      for (let i = 0; i < remove; i += 1) {
        const live = this.liveParticles.shift();
        if (live) this.particles.removeParticle(live.particle);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i -= 1) {
      const beam = this.beams[i];
      beam.lifeMs -= deltaMs;
      if (beam.lifeMs <= 0) {
        this.meshes.removeChild(beam.mesh);
        beam.mesh.destroy();
        this.beams.splice(i, 1);
        continue;
      }
      const ratio = Math.max(0, beam.lifeMs / beam.maxLifeMs);
      beam.mesh.alpha = Math.min(1, ratio * 1.2);
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      ring.lifeMs -= deltaMs;
      if (ring.lifeMs <= 0) {
        this.overlay.removeChild(ring.graphic);
        ring.graphic.destroy();
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - ring.lifeMs / ring.maxLifeMs;
      const radius = ring.startRadius + (ring.endRadius - ring.startRadius) * progress;
      ring.graphic.clear()
        .circle(ring.x, ring.y, radius)
        .stroke({
          color: ring.color,
          alpha: Math.max(0, (1 - progress) * 0.8),
          width: Math.max(2, 5 * (1 - progress)),
        });
    }

    for (let i = this.labels.length - 1; i >= 0; i -= 1) {
      const label = this.labels[i];
      label.lifeMs -= deltaMs;
      if (label.lifeMs <= 0) {
        this.overlay.removeChild(label.text);
        label.text.destroy();
        this.labels.splice(i, 1);
        continue;
      }
      label.text.y += label.vy * dt;
      label.text.alpha = Math.max(0, label.lifeMs / label.maxLifeMs);
    }

    this.shakePhase += dt * 34;
    this.shakeEnergy *= Math.pow(0.025, dt);
    if (this.shakeEnergy < 0.02) this.shakeEnergy = 0;
  }

  isFlashing(entityId: number, now = performance.now()): boolean {
    return (this.flashUntil.get(entityId) ?? 0) > now;
  }

  shakeOffset(scale: number): { x: number; y: number } {
    if (this.shakeEnergy <= 0) return { x: 0, y: 0 };
    const amount = this.shakeEnergy * scale;
    return {
      x: Math.sin(this.shakePhase * 1.7) * amount,
      y: Math.cos(this.shakePhase * 2.3) * amount * 0.72,
    };
  }

  destroy(): void {
    for (const live of this.liveParticles) this.particles.removeParticle(live.particle);
    this.liveParticles = [];
    this.beams = [];
    this.rings = [];
    this.labels = [];
    this.eventBus.reset();
    this.particles.destroy();
    this.meshes.destroy({ children: true });
    this.overlay.destroy({ children: true });
  }

  private consume(event: CombatFxEvent, quality: VisualQuality): void {
    const profile = profileForEvent(event);
    const color = profile.primary;
    const multiplier =
      (quality === 'low' ? 0.55 :
      quality === 'medium' ? 0.8 :
      quality === 'ultra' ? 1.45 :
      1) * profile.particleScale;

    if (event.type === 'damage') {
      this.flashUntil.set(event.entityId, performance.now() + 115);
      this.spawnBurst(event.x, event.y, color, Math.ceil(8 * multiplier), 115, 520, fxSeed(event));
      this.spawnDamageLabel(event.x, event.y - 20, event.amount, '-', 0xffe4d0);
      this.spawnRing(event.x, event.y, 8, 32, 260, color);
      this.shakeEnergy = Math.min(10, this.shakeEnergy + Math.min(3.2, event.amount / 90) * profile.shake);
      return;
    }

    if (event.type === 'heal') {
      this.spawnBurst(event.x, event.y, color, Math.ceil(10 * multiplier), 80, 620, fxSeed(event));
      this.spawnDamageLabel(event.x, event.y - 18, event.amount, '+', 0x8ff0ae);
      this.spawnRing(event.x, event.y, 12, 42, 380, profile.secondary);
      return;
    }

    if (event.type === 'basic-attack') {
      this.spawnBeam(event.sourceX, event.sourceY, event.x, event.y, profile.trailWidth * 0.42, color, 150);
      this.spawnTrail(event.sourceX, event.sourceY, event.x, event.y, profile.secondary, Math.ceil(5 * multiplier), fxSeed(event));
      return;
    }

    if (event.type === 'q-cast') {
      const radius = event.heroId === 'gareth' ? 108 : 145;
      this.spawnBurst(event.x, event.y, color, Math.ceil(20 * multiplier), 165, 720, fxSeed(event));
      this.spawnRing(event.x, event.y, 18, radius, 460, color);
      this.spawnRing(event.x, event.y, 32, radius * 0.72, 620, profile.secondary);
      this.shakeEnergy = Math.min(10, this.shakeEnergy + 1.6 * profile.shake);
      return;
    }

    if (event.type === 'ability-cast') {
      const scale = event.slot === 'R' ? 1.7 : event.slot === 'E' ? 1.25 : 1;
      this.spawnBurst(event.x, event.y, color, Math.ceil(18 * multiplier * scale), 150 * scale, 760, fxSeed(event));
      this.spawnRing(event.x, event.y, 20, 105 * scale, 520, color);
      this.shakeEnergy = Math.min(14, this.shakeEnergy + scale * profile.shake);
      return;
    }

    if (event.type === 'status-impact') {
      this.spawnBeam(event.sourceX, event.sourceY, event.x, event.y, profile.trailWidth * 1.35, profile.secondary, 900);
      this.spawnBeam(event.sourceX, event.sourceY, event.x, event.y, profile.trailWidth * 0.34, 0xffffff, 620);
      this.spawnTrail(event.sourceX, event.sourceY, event.x, event.y, color, Math.ceil(15 * multiplier), fxSeed(event));
      this.spawnBurst(event.x, event.y, profile.secondary, Math.ceil(14 * multiplier), 95, 720, fxSeed(event));
      this.spawnRing(event.x, event.y, 12, 64, 520, color);
      return;
    }

    if (event.type === 'level-up') {
      this.spawnPillar(event.x, event.y, 170, 24, color, 720);
      this.spawnBurst(event.x, event.y, profile.secondary, Math.ceil(30 * multiplier), 130, 880, fxSeed(event));
      this.spawnRing(event.x, event.y, 24, 135, 780, color);
      return;
    }

    if (event.type === 'item-equip') {
      this.spawnBurst(event.x, event.y, profile.secondary, Math.ceil(12 * multiplier), 90, 520, fxSeed(event));
      this.spawnRing(event.x, event.y, 10, 52, 420, color);
      return;
    }

    if (event.type === 'ward-spawn') {
      this.spawnPillar(event.x, event.y, 90, 10, color, 520);
      this.spawnRing(event.x, event.y, 8, 78, 640, profile.secondary);
      this.spawnBurst(event.x, event.y, color, Math.ceil(16 * multiplier), 72, 680, fxSeed(event));
      return;
    }

    if (event.type === 'death') {
      this.spawnBurst(event.x, event.y, color, Math.ceil(30 * multiplier), 220, 940, fxSeed(event));
      this.spawnRing(event.x, event.y, 25, event.kind === 'objective' ? 230 : 130, 800, color);
      this.shakeEnergy = Math.min(14, this.shakeEnergy + (event.kind === 'objective' ? 7 : 3.2) * profile.shake);
      return;
    }

    this.spawnBurst(event.x, event.y, color, Math.ceil(52 * multiplier), 280, 1320, fxSeed(event));
    this.spawnRing(event.x, event.y, 35, 280, 1180, color);
    this.spawnPillar(event.x, event.y, 220, 34, profile.secondary, 980);
    this.shakeEnergy = Math.min(16, this.shakeEnergy + 8 * profile.shake);
  }

  private spawnBurst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    lifeMs: number,
    seed: number,
  ): void {
    let rng = seed;
    for (let i = 0; i < count; i += 1) {
      const a = nextVisualRandom(rng);
      rng = a.state;
      const b = nextVisualRandom(rng);
      rng = b.state;
      const c = nextVisualRandom(rng);
      rng = c.state;

      const angle = a.value * Math.PI * 2;
      const velocity = speed * (0.35 + b.value * 0.65);
      const size = 3 + c.value * 6;
      const particle = new Particle({
        texture: Texture.WHITE,
        x,
        y,
        scaleX: size,
        scaleY: size * (0.45 + b.value * 0.5),
        rotation: angle,
        tint: color,
        alpha: 0.9,
      });
      this.particles.addParticle(particle);
      this.liveParticles.push({
        particle,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 18,
        gravity: 105,
        lifeMs,
        maxLifeMs: lifeMs,
      });
    }
  }

  private spawnTrail(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    count: number,
    seed: number,
  ): void {
    let rng = seed;
    for (let i = 0; i < count; i += 1) {
      const random = nextVisualRandom(rng);
      rng = random.state;
      const t = (i + random.value * 0.7) / Math.max(1, count);
      const wobble = (random.value - 0.5) * 18;
      const x = x1 + (x2 - x1) * t + wobble;
      const y = y1 + (y2 - y1) * t - wobble * 0.35;
      const particle = new Particle({
        texture: Texture.WHITE,
        x,
        y,
        scaleX: 5,
        scaleY: 2,
        rotation: Math.atan2(y2 - y1, x2 - x1),
        tint: color,
        alpha: 0.85,
      });
      this.particles.addParticle(particle);
      this.liveParticles.push({
        particle,
        vx: 0,
        vy: -14 - random.value * 20,
        gravity: 0,
        lifeMs: 360,
        maxLifeMs: 360,
      });
    }
  }

  private spawnBeam(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    color: number,
    lifeMs: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / length * width * 0.5;
    const ny = dx / length * width * 0.5;
    const mesh = new MeshSimple({
      texture: Texture.WHITE,
      vertices: new Float32Array([
        x1 + nx, y1 + ny,
        x1 - nx, y1 - ny,
        x2 - nx, y2 - ny,
        x2 + nx, y2 + ny,
      ]),
      uvs: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    mesh.tint = color;
    mesh.alpha = 0.92;
    mesh.blendMode = 'add';
    this.meshes.addChild(mesh);
    this.beams.push({ mesh, lifeMs, maxLifeMs: lifeMs });
  }

  private spawnPillar(
    x: number,
    y: number,
    height: number,
    width: number,
    color: number,
    lifeMs: number,
  ): void {
    this.spawnBeam(x, y + 18, x, y - height, width, color, lifeMs);
    this.spawnBeam(x - width, y + 10, x - width * 0.25, y - height * 0.72, width * 0.22, 0xffffff, lifeMs * 0.82);
    this.spawnBeam(x + width, y + 10, x + width * 0.25, y - height * 0.72, width * 0.22, 0xffffff, lifeMs * 0.82);
  }

  private spawnRing(
    x: number,
    y: number,
    startRadius: number,
    endRadius: number,
    lifeMs: number,
    color: number,
  ): void {
    const graphic = new Graphics();
    this.overlay.addChild(graphic);
    this.rings.push({
      graphic,
      x,
      y,
      startRadius,
      endRadius,
      lifeMs,
      maxLifeMs: lifeMs,
      color,
    });
  }

  private spawnDamageLabel(x: number, y: number, amount: number, prefix = '-', fill = 0xffe4d0): void {
    const text = new Text({
      text: prefix + Math.round(amount),
      style: {
        fill,
        fontSize: 18,
        fontFamily: 'monospace',
        fontWeight: '800',
        stroke: { color: 0x30100e, width: 3 },
      },
    });
    text.anchor.set(0.5);
    text.position.set(x, y);
    this.overlay.addChild(text);
    this.labels.push({ text, vy: -42, lifeMs: 720, maxLifeMs: 720 });
  }
}
