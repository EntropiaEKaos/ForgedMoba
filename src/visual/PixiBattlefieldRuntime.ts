import {
  Application,
  Container,
  Graphics,
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

interface EntityNode {
  root: Container;
  shadow: Graphics;
  selection: Graphics;
  body: Graphics;
  health: Graphics;
  label: Text;
  signature: string;
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
  private readonly terrain = new Graphics();
  private readonly entities = new Container();
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

    this.world.addChild(this.terrain);
    this.world.addChild(this.entities);
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

    const local = Object.values(input.state.entities)
      .filter((entity) => entity.ownerPlayerId === input.localPlayerId)
      .sort((a, b) => a.id - b.id)[0] ?? null;

    if (local && !local.dead) {
      this.cameraX += (local.x - this.cameraX) * 0.14;
      this.cameraY += (local.y - this.cameraY) * 0.14;
    }

    const minZoom = Math.max(
      0.45,
      Math.min(0.82, Math.min(this.screenWidth / 1500, this.screenHeight / 950)),
    );
    this.cameraZoom += (minZoom - this.cameraZoom) * 0.08;
    this.clampCamera();

    this.world.pivot.set(this.cameraX, this.cameraY);
    this.world.position.set(this.screenWidth / 2, this.screenHeight / 2);
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
      this.updateEntity(entity, x, y, hp, maxHp, isLocal);
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
    if (this.initialized) this.app.destroy();
    this.initialized = false;
  }

  private clampCamera(): void {
    const halfW = this.screenWidth / Math.max(0.001, this.cameraZoom) / 2;
    const halfH = this.screenHeight / Math.max(0.001, this.cameraZoom) / 2;
    this.cameraX = Math.max(halfW, Math.min(this.worldWidth - halfW, this.cameraX));
    this.cameraY = Math.max(halfH, Math.min(this.worldHeight - halfH, this.cameraY));
  }

  private ensureTerrain(): void {
    const key = this.worldWidth + ':' + this.worldHeight + ':' + this.quality;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
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
    const shadow = new Graphics();
    const selection = new Graphics();
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

    root.addChild(shadow, selection, body, health, label);
    this.entities.addChild(root);
    const node = { root, shadow, selection, body, health, label, signature: '' };
    this.nodes.set(entity.id, node);
    this.rebuildNode(node, entity, isLocal);
    return node;
  }

  private rebuildNode(node: EntityNode, entity: SimEntity, isLocal: boolean): void {
    const color = displayColor(entity, isLocal);
    const radius = Math.max(7, entity.radius * 1.2);
    node.signature = signature(entity, isLocal);

    node.shadow.clear()
      .ellipse(4, Math.max(4, radius * 0.65), radius * 1.05, Math.max(3, radius * 0.46))
      .fill({ color: 0x000000, alpha: this.quality === 'low' ? 0.25 : 0.42 });

    node.body.clear();
    if (entity.kind === 'tower') {
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
      node.selection.circle(0, 0, radius + 8)
        .stroke({ color: 0xffef9a, alpha: 0.9, width: 3 });
    }

    node.label.text = entityLabel(entity);
    node.label.visible = Boolean(node.label.text);
    node.label.position.set(0, -radius - 10);
  }

  private updateEntity(
    entity: SimEntity,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    isLocal: boolean,
  ): void {
    const node = this.nodes.get(entity.id) ?? this.createNode(entity, isLocal);
    if (node.signature !== signature(entity, isLocal)) this.rebuildNode(node, entity, isLocal);
    node.root.position.set(x, y);

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
