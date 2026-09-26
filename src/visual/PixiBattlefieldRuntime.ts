import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
} from 'pixi.js';
import type { InterpolatedFrame } from '../network/interpolation.ts';
import type { SimEntity, SimulationState } from '../simulation/types.ts';
import { screenToWorld, type CameraViewport, type Point2 } from './camera.ts';
import {
  effectiveResolution,
  VISUAL_QUALITY,
  type VisualQuality,
} from './quality.ts';
import { CombatFxRuntime } from './CombatFxRuntime.ts';
import { EnvironmentRuntime } from './EnvironmentRuntime.ts';
import {
  cameraCueForEvent,
  CinematicObserver,
  type CinematicCameraCue,
} from './cinematicModel.ts';
import { ArtAssetRegistry } from './art/ArtAssetRegistry.ts';
import type { HeroArtAnimation, WorldArtKey } from './art/types.ts';

interface ActiveCameraCue extends CinematicCameraCue {
  startedAt: number;
  until: number;
}

interface EntityNode {
  root: Container;
  aura: Graphics;
  sigil: Graphics;
  shadow: Graphics;
  selection: Graphics;
  art: Sprite;
  body: Graphics;
  health: Graphics;
  label: Text;
  signature: string;
  pose: HeroArtAnimation;
  poseStartedAt: number;
  poseUntil: number;
  lastAttackCooldown: number;
  lastQCooldown: number;
}

export interface BattlefieldRenderInput {
  state: SimulationState;
  interpolated: InterpolatedFrame | null;
  localPlayerId?: string;
  quality: VisualQuality;
}

const ENTITY_COLORS = {
  blueHero: 0x58bfff,
  redHero: 0xff7272,
  localHero: 0xf0d05c,
  blueMinion: 0x5c86b0,
  redMinion: 0xad6969,
  blueTower: 0x4aa8ff,
  redTower: 0xff5f5f,
  monster: 0x8b6f47,
  objective: 0xb06cff,
  blueWard: 0x6ad5ff,
  redWard: 0xff8aa8,
} as const;

function displayColor(entity: SimEntity, isLocal: boolean): number {
  if (entity.kind === 'hero') {
    if (isLocal) return ENTITY_COLORS.localHero;
    return entity.team === 0 ? ENTITY_COLORS.blueHero : ENTITY_COLORS.redHero;
  }
  if (entity.kind === 'minion') return entity.team === 0 ? ENTITY_COLORS.blueMinion : ENTITY_COLORS.redMinion;
  if (entity.kind === 'tower') return entity.team === 0 ? ENTITY_COLORS.blueTower : ENTITY_COLORS.redTower;
  if (entity.kind === 'monster') return ENTITY_COLORS.monster;
  if (entity.kind === 'objective') return ENTITY_COLORS.objective;
  return entity.team === 0 ? ENTITY_COLORS.blueWard : ENTITY_COLORS.redWard;
}


function worldArtKey(entity: SimEntity): WorldArtKey | null {
  if (entity.kind === 'minion') return entity.team === 0 ? 'blue-minion' : 'red-minion';
  if (entity.kind === 'tower') return entity.team === 0 ? 'blue-tower' : 'red-tower';
  if (entity.kind === 'monster') return 'jungle-monster';
  if (entity.kind === 'objective') return 'epic-objective';
  if (entity.kind === 'ward') return entity.team === 0 ? 'blue-ward' : 'red-ward';
  return null;
}

function entityLabel(entity: SimEntity): string {
  if (entity.kind === 'hero') return entity.heroId ?? 'hero';
  if (entity.kind === 'monster' || entity.kind === 'objective') return entity.campId ?? entity.kind;
  return '';
}

function signature(entity: SimEntity, isLocal: boolean): string {
  return [
    entity.kind,
    entity.team,
    entity.radius,
    entity.heroId ?? '',
    entity.campId ?? '',
    isLocal ? 'local' : 'remote',
  ].join(':');
}

export class PixiBattlefieldRuntime {
  private readonly canvas: HTMLCanvasElement;
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly terrainArt = new Sprite();
  private readonly terrain = new Graphics();
  private readonly entities = new Container();
  private readonly environment = new EnvironmentRuntime();
  private readonly combatFx = new CombatFxRuntime();
  private readonly cinematic = new CinematicObserver();
  private readonly artAssets = new ArtAssetRegistry();
  private readonly nodes = new Map<number, EntityNode>();
  private initialized = false;
  private destroyed = false;
  private quality: VisualQuality = 'high';
  private screenWidth = 1;
  private screenHeight = 1;
  private worldWidth = 3000;
  private worldHeight = 3000;
  private cameraX = 1500;
  private cameraY = 1500;
  private cameraZoom = 0.72;
  private terrainKey = '';
  private lastFrameAt = 0;
  private introStartedAt = 0;
  private activeCameraCue: ActiveCameraCue | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(quality: VisualQuality): Promise<void> {
    this.quality = quality;
    const preset = VISUAL_QUALITY[quality];
    await this.app.init({
      canvas: this.canvas,
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      antialias: preset.antialias,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: effectiveResolution(quality, window.devicePixelRatio || 1),
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy();
      return;
    }

    await this.artAssets.init();
    if (this.destroyed) {
      this.app.destroy();
      return;
    }
    if (this.artAssets.terrain) this.terrainArt.texture = this.artAssets.terrain;

    this.world.addChild(this.terrainArt);
    this.world.addChild(this.terrain);
    this.world.addChild(this.environment.background);
    this.world.addChild(this.environment.ambientParticles);
    this.world.addChild(this.combatFx.particles);
    this.world.addChild(this.combatFx.meshes);
    this.world.addChild(this.entities);
    this.world.addChild(this.environment.foreground);
    this.world.addChild(this.combatFx.overlay);
    this.app.stage.addChild(this.world);
    this.app.ticker.stop();
    this.initialized = true;
    this.resize(window.innerWidth, window.innerHeight);
  }

  setQuality(quality: VisualQuality): void {
    this.quality = quality;
    if (!this.initialized) return;
    const resolution = effectiveResolution(quality, window.devicePixelRatio || 1);
    this.app.renderer.resolution = resolution;
    this.resize(this.screenWidth, this.screenHeight);
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return;
    this.screenWidth = Math.max(1, Math.floor(width));
    this.screenHeight = Math.max(1, Math.floor(height));
    this.app.renderer.resize(this.screenWidth, this.screenHeight);
  }

  render(input: BattlefieldRenderInput): void {
    if (!this.initialized || this.destroyed) return;
    this.quality = input.quality;
    this.worldWidth = input.state.width;
    this.worldHeight = input.state.height;
    this.ensureTerrain();

    const now = performance.now();
    if (this.introStartedAt === 0) this.introStartedAt = now;
    const deltaMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 16.67;
    this.lastFrameAt = now;
    this.environment.update(deltaMs, input.state, input.localPlayerId, input.quality);
    this.combatFx.observe(input.state, input.quality);
    this.combatFx.update(deltaMs, input.quality);

    for (const event of this.cinematic.observe(input.state)) {
      const cue = cameraCueForEvent(event, input.localPlayerId);
      if (!cue) continue;
      if (
        !this.activeCameraCue ||
        now >= this.activeCameraCue.until ||
        cue.priority >= this.activeCameraCue.priority
      ) {
        this.activeCameraCue = {
          ...cue,
          startedAt: now,
          until: now + cue.durationMs,
        };
      }
    }

    const local = Object.values(input.state.entities)
      .filter((entity) => entity.ownerPlayerId === input.localPlayerId)
      .sort((a, b) => a.id - b.id)[0] ?? null;

    const minZoom = Math.max(
      0.45,
      Math.min(0.82, Math.min(this.screenWidth / 1500, this.screenHeight / 950)),
    );

    let targetX = local && !local.dead ? local.x : this.cameraX;
    let targetY = local && !local.dead ? local.y : this.cameraY;
    let targetZoom = minZoom;

    const introProgress = Math.max(0, Math.min(1, (now - this.introStartedAt) / 1800));
    if (local && introProgress < 1) {
      const eased = 1 - Math.pow(1 - introProgress, 3);
      targetX = input.state.width / 2 + (local.x - input.state.width / 2) * eased;
      targetY = input.state.height / 2 + (local.y - input.state.height / 2) * eased;
      targetZoom = minZoom * (0.76 + eased * 0.24);
    }

    if (this.activeCameraCue && now < this.activeCameraCue.until) {
      const span = Math.max(1, this.activeCameraCue.until - this.activeCameraCue.startedAt);
      const progress = Math.max(0, Math.min(1, (now - this.activeCameraCue.startedAt) / span));
      const cinematicPulse = Math.sin(progress * Math.PI);
      const qualityWeight =
        input.quality === 'low' ? 0.24 :
        input.quality === 'medium' ? 0.46 :
        input.quality === 'ultra' ? 0.88 :
        0.72;
      const weight = cinematicPulse * qualityWeight;
      targetX += (this.activeCameraCue.x - targetX) * weight;
      targetY += (this.activeCameraCue.y - targetY) * weight;
      targetZoom += this.activeCameraCue.zoomBoost * weight;
    } else if (this.activeCameraCue) {
      this.activeCameraCue = null;
    }

    this.cameraX += (targetX - this.cameraX) * 0.14;
    this.cameraY += (targetY - this.cameraY) * 0.14;
    this.cameraZoom += (targetZoom - this.cameraZoom) * 0.08;
    this.clampCamera();

    this.world.pivot.set(this.cameraX, this.cameraY);
    const shake = this.combatFx.shakeOffset(VISUAL_QUALITY[input.quality].screenShakeScale);
    this.world.position.set(this.screenWidth / 2 + shake.x, this.screenHeight / 2 + shake.y);
    this.world.scale.set(this.cameraZoom);

    const remote = new Map(input.interpolated?.entities.map((entity) => [entity.id, entity]) ?? []);
    const aliveIds = new Set<number>();
    const ids = Object.keys(input.state.entities).map(Number).sort((a, b) => a - b);

    for (const id of ids) {
      const entity = input.state.entities[String(id)];
      if (!entity || entity.dead) continue;
      aliveIds.add(id);
      const isLocal = entity.ownerPlayerId === input.localPlayerId;
      const interpolation = isLocal ? undefined : remote.get(id);
      const x = interpolation?.x ?? entity.x;
      const y = interpolation?.y ?? entity.y;
      const hp = interpolation?.hp ?? entity.hp;
      const maxHp = interpolation?.maxHp ?? entity.maxHp;
      this.updateEntity(entity, x, y, hp, maxHp, isLocal, now);
    }

    for (const [id, node] of this.nodes) {
      if (aliveIds.has(id)) continue;
      this.entities.removeChild(node.root);
      node.root.destroy({ children: true });
      this.nodes.delete(id);
    }

    this.app.renderer.render(this.app.stage);
  }

  screenToWorld(point: Point2): Point2 {
    return screenToWorld(this.cameraView(), point);
  }

  cameraView(): CameraViewport {
    return {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      zoom: this.cameraZoom,
      centerX: this.cameraX,
      centerY: this.cameraY,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.nodes.clear();
    if (this.initialized) {
      this.world.removeChild(this.environment.background);
      this.world.removeChild(this.environment.ambientParticles);
      this.world.removeChild(this.environment.foreground);
      this.world.removeChild(this.combatFx.particles);
      this.world.removeChild(this.combatFx.meshes);
      this.world.removeChild(this.combatFx.overlay);
      this.environment.destroy();
      this.combatFx.destroy();
      this.app.destroy();
    }
    this.initialized = false;
  }

  private clampCamera(): void {
    const halfW = this.screenWidth / Math.max(0.001, this.cameraZoom) / 2;
    const halfH = this.screenHeight / Math.max(0.001, this.cameraZoom) / 2;
    this.cameraX = Math.max(halfW, Math.min(this.worldWidth - halfW, this.cameraX));
    this.cameraY = Math.max(halfH, Math.min(this.worldHeight - halfH, this.cameraY));
  }

  private ensureTerrain(): void {
    const key = this.worldWidth + ':' + this.worldHeight + ':' + this.quality + ':' + (this.artAssets.version ?? 'fallback');
    if (key === this.terrainKey) return;
    this.terrainKey = key;

    if (this.artAssets.terrain) {
      this.terrainArt.visible = true;
      this.terrainArt.texture = this.artAssets.terrain;
      this.terrainArt.position.set(0, 0);
      this.terrainArt.width = this.worldWidth;
      this.terrainArt.height = this.worldHeight;
      this.terrain.clear();
      return;
    }

    this.terrainArt.visible = false;
    const laneY = this.worldHeight * 0.5;
    this.terrain.clear()
      .rect(0, 0, this.worldWidth, this.worldHeight)
      .fill(0x07110f)
      .rect(0, laneY - 90, this.worldWidth, 180)
      .fill(0x18241d)
      .rect(0, laneY - 3, this.worldWidth, 6)
      .fill(0x315044)
      .rect(0, 0, this.worldWidth, 420)
      .fill({ color: 0x10201a, alpha: 0.78 })
      .rect(0, this.worldHeight - 420, this.worldWidth, 420)
      .fill({ color: 0x10201a, alpha: 0.78 });

    const riverWidth = 170;
    this.terrain
      .rect(this.worldWidth / 2 - riverWidth / 2, 0, riverWidth, this.worldHeight)
      .fill({ color: 0x113342, alpha: 0.72 });
  }

  private createNode(entity: SimEntity, isLocal: boolean): EntityNode {
    const root = new Container();
    const aura = new Graphics();
    aura.blendMode = 'add';
    const sigil = new Graphics();
    sigil.blendMode = 'add';
    const shadow = new Graphics();
    const selection = new Graphics();
    const art = new Sprite();
    art.visible = false;
    const body = new Graphics();
    const health = new Graphics();
    const label = new Text({
      text: entityLabel(entity),
      style: {
        fill: 0xd8e4e8,
        fontSize: 13,
        fontFamily: 'monospace',
        fontWeight: '600',
      },
    });
    label.anchor.set(0.5, 1);

    root.addChild(aura, sigil, shadow, selection, art, body, health, label);
    this.entities.addChild(root);
    const node: EntityNode = {
      root,
      aura,
      sigil,
      shadow,
      selection,
      art,
      body,
      health,
      label,
      signature: '',
      pose: 'idle',
      poseStartedAt: 0,
      poseUntil: 0,
      lastAttackCooldown: entity.attackCooldownRemaining,
      lastQCooldown: entity.abilityCooldowns.Q,
    };
    this.nodes.set(entity.id, node);
    this.rebuildNode(node, entity, isLocal);
    return node;
  }

  private rebuildNode(node: EntityNode, entity: SimEntity, isLocal: boolean): void {
    const color = displayColor(entity, isLocal);
    const radius = Math.max(7, entity.radius * 1.2);
    node.signature = signature(entity, isLocal);

    const heroArt = entity.kind === 'hero'
      ? this.artAssets.heroDefinition(entity.heroId)
      : null;
    const worldKey = worldArtKey(entity);
    const worldArt = this.artAssets.worldDefinition(worldKey);
    const shadowScale = heroArt?.shadowScale ?? worldArt?.shadowScale ?? 1;

    node.aura.clear();
    node.sigil.clear();
    if (entity.kind === 'hero') {
      const auraColor = isLocal ? 0xffdf72 : entity.team === 0 ? 0x4cbcff : 0xff6262;
      node.aura
        .circle(0, 3, radius * (isLocal ? 2.65 : 2.15))
        .fill({ color: auraColor, alpha: isLocal ? 0.12 : 0.065 })
        .circle(0, 3, radius * 1.42)
        .stroke({ color: auraColor, alpha: isLocal ? 0.5 : 0.25, width: isLocal ? 3 : 2 });
      if (isLocal) {
        node.sigil
          .circle(0, 3, radius * 1.92)
          .stroke({ color: 0xffdf72, alpha: 0.34, width: 2 })
          .arc(0, 3, radius * 2.14, -0.28, 0.52)
          .stroke({ color: 0xffffff, alpha: 0.72, width: 3 })
          .arc(0, 3, radius * 2.14, 1.28, 2.08)
          .stroke({ color: 0xffc94f, alpha: 0.62, width: 3 })
          .arc(0, 3, radius * 2.14, 2.86, 3.66)
          .stroke({ color: 0xffffff, alpha: 0.62, width: 3 })
          .arc(0, 3, radius * 2.14, 4.42, 5.22)
          .stroke({ color: 0xffc94f, alpha: 0.62, width: 3 });
      }
    } else if (entity.kind === 'objective') {
      node.aura
        .circle(0, 0, radius * 3.4)
        .fill({ color: 0xb06cff, alpha: 0.09 })
        .circle(0, 0, radius * 2.05)
        .stroke({ color: 0xd9a2ff, alpha: 0.44, width: 4 });
      node.sigil
        .circle(0, 0, radius * 2.55)
        .stroke({ color: 0xc98cff, alpha: 0.34, width: 2 })
        .circle(0, 0, radius * 2.82)
        .stroke({ color: 0x7b4cff, alpha: 0.22, width: 2 })
        .arc(0, 0, radius * 3.02, 0, 0.72)
        .stroke({ color: 0xf0c1ff, alpha: 0.64, width: 4 })
        .arc(0, 0, radius * 3.02, 2.1, 2.82)
        .stroke({ color: 0xf0c1ff, alpha: 0.64, width: 4 })
        .arc(0, 0, radius * 3.02, 4.2, 4.92)
        .stroke({ color: 0xf0c1ff, alpha: 0.64, width: 4 });
    } else if (entity.kind === 'tower') {
      const auraColor = entity.team === 0 ? 0x4aa8ff : 0xff5f5f;
      node.aura
        .circle(0, radius * 0.75, radius * 1.65)
        .fill({ color: auraColor, alpha: 0.07 })
        .ellipse(0, radius * 1.05, radius * 1.4, radius * 0.5)
        .stroke({ color: auraColor, alpha: 0.32, width: 3 });
      node.sigil
        .arc(0, radius * 0.92, radius * 1.82, -0.45, 0.45)
        .stroke({ color: auraColor, alpha: 0.28, width: 2.5 })
        .arc(0, radius * 0.92, radius * 1.82, 2.7, 3.58)
        .stroke({ color: auraColor, alpha: 0.28, width: 2.5 });
    }

    node.shadow.clear()
      .ellipse(
        4,
        Math.max(4, radius * 0.65),
        radius * 1.05 * shadowScale,
        Math.max(3, radius * 0.46 * shadowScale),
      )
      .fill({ color: 0x000000, alpha: this.quality === 'low' ? 0.25 : 0.42 });

    const hasProductionArt = Boolean(heroArt || worldArt);
    node.art.visible = hasProductionArt;
    node.body.visible = !hasProductionArt;
    if (heroArt) {
      node.art.anchor.set(heroArt.anchor.x, heroArt.anchor.y);
      node.art.scale.set(heroArt.scale);
      const texture = this.artAssets.heroTexture(entity.heroId, 'idle', 0);
      if (texture) node.art.texture = texture;
    } else if (worldArt) {
      node.art.anchor.set(worldArt.anchor.x, worldArt.anchor.y);
      node.art.scale.set(worldArt.scale);
      const texture = this.artAssets.worldTexture(worldKey);
      if (texture) node.art.texture = texture;
    }

    node.body.clear();
    if (hasProductionArt) {
      // Production art owns the silhouette. Graphics remains the safety fallback.
    } else if (entity.kind === 'tower') {
      node.body.roundRect(-radius, -radius * 1.35, radius * 2, radius * 2.7, radius * 0.28)
        .fill(color)
        .stroke({ color: 0xffffff, alpha: 0.18, width: 2 });
    } else if (entity.kind === 'ward') {
      node.body.star(0, 0, 4, radius, radius * 0.4)
        .fill({ color, alpha: 0.9 })
        .stroke({ color: 0xffffff, alpha: 0.6, width: 1.5 });
    } else if (entity.kind === 'objective') {
      node.body.circle(0, 0, radius * 1.15)
        .fill(color)
        .stroke({ color: 0xffffff, alpha: 0.35, width: 3 });
    } else {
      node.body.circle(0, 0, radius)
        .fill(color)
        .stroke({ color: 0xffffff, alpha: entity.kind === 'hero' ? 0.28 : 0.12, width: 2 });
    }

    node.selection.clear();
    if (isLocal) {
      node.selection
        .circle(0, 1, radius + 10)
        .stroke({ color: 0xffef9a, alpha: 0.78, width: 2.5 })
        .arc(0, 1, radius + 15, -0.7, 0.55)
        .stroke({ color: 0xffffff, alpha: 0.92, width: 3.5 })
        .arc(0, 1, radius + 15, 2.45, 3.7)
        .stroke({ color: 0xffd95f, alpha: 0.86, width: 3.5 });
    }

    node.label.text = entityLabel(entity);
    node.label.visible = Boolean(node.label.text);
    node.label.position.set(
      0,
      heroArt ? -radius * 3.4 :
      worldArt && entity.kind === 'tower' ? -radius * 2.7 :
      worldArt ? -radius * 2.1 :
      -radius - 10,
    );
  }

  private resolveHeroPose(node: EntityNode, entity: SimEntity, now: number): HeroArtAnimation {
    const qCooldown = entity.abilityCooldowns.Q;
    const attackCooldown = entity.attackCooldownRemaining;

    if (qCooldown > node.lastQCooldown + 1) {
      node.pose = 'cast';
      node.poseStartedAt = now;
      node.poseUntil = now + 420;
    } else if (attackCooldown > node.lastAttackCooldown + 1) {
      node.pose = 'attack';
      node.poseStartedAt = now;
      node.poseUntil = now + 320;
    }

    node.lastQCooldown = qCooldown;
    node.lastAttackCooldown = attackCooldown;

    if (now < node.poseUntil) return node.pose;

    const next: HeroArtAnimation = entity.moveTarget ? 'run' : 'idle';
    if (node.pose !== next) {
      node.pose = next;
      node.poseStartedAt = now;
    }
    return node.pose;
  }

  private updateEntity(
    entity: SimEntity,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    isLocal: boolean,
    now: number,
  ): void {
    const node = this.nodes.get(entity.id) ?? this.createNode(entity, isLocal);
    if (node.signature !== signature(entity, isLocal)) this.rebuildNode(node, entity, isLocal);
    node.root.position.set(x, y);

    const flashing = this.combatFx.isFlashing(entity.id);
    const auraPulse = 1 + Math.sin(now / 340 + entity.id * 0.73) * 0.035;
    node.aura.scale.set(auraPulse);
    node.aura.alpha =
      entity.kind === 'objective'
        ? 0.78 + Math.sin(now / 260) * 0.18
        : entity.kind === 'hero'
          ? 0.86 + Math.sin(now / 420 + entity.id) * 0.12
          : 1;
    node.selection.rotation = now / 2200;
    node.sigil.rotation =
      entity.kind === 'objective' ? -now / 2600 :
      entity.kind === 'hero' && isLocal ? now / 3400 :
      entity.kind === 'tower' ? now / 7200 :
      0;
    node.sigil.alpha =
      entity.kind === 'objective'
        ? 0.72 + Math.sin(now / 310) * 0.18
        : entity.kind === 'hero' && isLocal
          ? 0.66 + Math.sin(now / 430) * 0.14
          : 0.72;

    node.body.scale.set(flashing ? 1.08 : 1);
    node.body.alpha = flashing ? 0.72 : 1;

    const heroArt = entity.kind === 'hero'
      ? this.artAssets.heroDefinition(entity.heroId)
      : null;
    const worldKey = worldArtKey(entity);
    const worldArt = this.artAssets.worldDefinition(worldKey);
    if (heroArt) {
      const pose = this.resolveHeroPose(node, entity, now);
      const texture = this.artAssets.heroTexture(
        entity.heroId,
        pose,
        Math.max(0, now - node.poseStartedAt),
      );
      if (texture) node.art.texture = texture;
      const flashScale = flashing ? 1.045 : 1;
      node.art.scale.set(heroArt.scale * flashScale);
      node.art.alpha = flashing ? 0.76 : 1;
      node.art.visible = true;
      node.body.visible = false;
    } else if (worldArt) {
      const texture = this.artAssets.worldTexture(worldKey);
      if (texture) node.art.texture = texture;
      const pulse =
        entity.kind === 'objective' ? 1 + Math.sin(now / 260) * 0.055 :
        entity.kind === 'ward' ? 1 + Math.sin(now / 420) * 0.035 :
        1;
      const flashScale = flashing ? 1.05 : 1;
      node.art.scale.set(worldArt.scale * pulse * flashScale);
      node.art.alpha = flashing ? 0.74 : 1;
      node.art.visible = true;
      node.body.visible = false;
    } else {
      node.art.visible = false;
      node.body.visible = true;
    }

    const radius = Math.max(7, entity.radius * 1.2);
    node.health.clear();
    if (entity.kind !== 'ward') {
      const width = Math.max(34, radius * 2.4);
      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      node.health
        .roundRect(-width / 2, radius + 9, width, 6, 2)
        .fill({ color: 0x030606, alpha: 0.9 })
        .roundRect(-width / 2, radius + 9, width * ratio, 6, 2)
        .fill(entity.team === 0 ? 0x61d6a0 : 0xf06f6f);
    }
  }
}
