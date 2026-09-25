import assert from 'node:assert/strict';
import test from 'node:test';
import { screenToWorld, worldToScreen, type CameraViewport } from './camera.ts';

const view: CameraViewport = {
  screenWidth: 1200,
  screenHeight: 800,
  worldWidth: 3000,
  worldHeight: 3000,
  zoom: 1,
  centerX: 1500,
  centerY: 1500,
};

test('camera transforms are reversible around the viewport center', () => {
  const world = { x: 1710, y: 1330 };
  const screen = worldToScreen(view, world);
  const restored = screenToWorld(view, screen);
  assert.deepEqual(restored, world);
});

test('screen-to-world stays inside authoritative world bounds', () => {
  const world = screenToWorld(view, { x: -10000, y: 20000 });
  assert.ok(world.x >= 0 && world.x <= view.worldWidth);
  assert.ok(world.y >= 0 && world.y <= view.worldHeight);
});
