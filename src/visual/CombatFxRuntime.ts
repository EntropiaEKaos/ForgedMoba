import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Text,
  Texture,
} from 'pixi.js';
import type { SimulationState } from '../simulation/types.ts';
import {
  captureVisualProbe,
  deriveCombatFx,
  fxSeed,
  nextVisualRandom,
  type CombatFxEvent,
  type VisualStateProbe,
} from './fxModel.ts';
import { VISUAL_QUALITY, type VisualQuality } from './quality.ts';

interface LiveParticle {
  particle: Particle;
  vx: number;
  vy: number;
  gravity: number;
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
  ].join(':');
}

function eventColor(event: CombatFxEvent): number {
  if (event.type === 'q-cast') return event.heroId === 'gareth' ? 0xffc34d : 0x71d8ff;
  if (event.type === 'status-impact') {
    if (event.status === 'root') return 0x9a70ff;
    if (event.status === 'stun') return 0xffe45e;
    return 0x63b6ff;
  }
  if (event.type === 'objective') return 0xc077ff;
  if (event.type === 'death') return event.kind === 'objective' ? 0xc077ff : 0xff665d;
  return 0xffefdb;
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
  readonly overlay = new Container();

  private liveParticles: LiveParticle[] = [];
  private rings: LiveRing[] = [];
  private labels: LiveLabel[] = [];
  private lastProbe: VisualStateProbe | null = null;
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private shakeEnergy = 0;
  private shakePhase = 0;
  private flashUntil = new Map<number, number>();

  observe(state: SimulationState, quality: VisualQuality): void {
    const probe = captureVisualProbe(state);
    if (this.lastProbe && probe.tick < this.lastProbe.tick) {
      this.lastProbe = probe;
      return;
    }

    const events = deriveCombatFx(this.lastProbe, probe);
    this.lastProbe = probe;
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
    this.rings = [];
    this.labels = [];
    this.particles.destroy();
    this.overlay.destroy({ children: true });
  }

  private consume(event: CombatFxEvent, quality: VisualQuality): void {
    const color = eventColor(event);
    const multiplier =
      quality === 'low' ? 0.55 :
      quality === 'medium' ? 0.8 :
      quality === 'ultra' ? 1.45 :
      1;

    if (event.type === 'damage') {
      this.flashUntil.set(event.entityId, performance.now() + 115);
      this.spawnBurst(event.x, event.y, color, Math.ceil(8 * multiplier), 115, 520, fxSeed(event));
      this.spawnDamageLabel(event.x, event.y - 20, event.amount);
      this.spawnRing(event.x, event.y, 8, 32, 260, color);
      this.shakeEnergy = Math.min(10, this.shakeEnergy + Math.min(3.2, event.amount / 90));
      return;
    }

    if (event.type === 'q-cast') {
      this.spawnBurst(event.x, event.y, color, Math.ceil(16 * multiplier), 145, 680, fxSeed(event));
      this.spawnRing(event.x, event.y, 18, event.heroId === 'gareth' ? 95 : 125, 420, color);
      this.shakeEnergy = Math.min(10, this.shakeEnergy + 1.3);
      return;
    }

    if (event.type === 'status-impact') {
      this.spawnTrail(
        event.sourceX,
        event.sourceY,
        event.x,
        event.y,
        color,
        Math.ceil(13 * multiplier),
        fxSeed(event),
      );
      this.spawnBurst(event.x, event.y, color, Math.ceil(12 * multiplier), 85, 700, fxSeed(event));
      this.spawnRing(event.x, event.y, 12, 58, 500, color);
      return;
    }

    if (event.type === 'death') {
      this.spawnBurst(event.x, event.y, color, Math.ceil(28 * multiplier), 210, 900, fxSeed(event));
      this.spawnRing(event.x, event.y, 25, event.kind === 'objective' ? 210 : 120, 760, color);
      this.shakeEnergy = Math.min(14, this.shakeEnergy + (event.kind === 'objective' ? 7 : 3.2));
      return;
    }

    this.spawnBurst(event.x, event.y, color, Math.ceil(48 * multiplier), 260, 1250, fxSeed(event));
    this.spawnRing(event.x, event.y, 35, 260, 1100, color);
    this.shakeEnergy = Math.min(16, this.shakeEnergy + 8);
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

  private spawnDamageLabel(x: number, y: number, amount: number): void {
    const text = new Text({
      text: '-' + Math.round(amount),
      style: {
        fill: 0xffe4d0,
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
