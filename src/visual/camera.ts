export interface CameraViewport {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface Point2 {
  x: number;
  y: number;
}

export function clampCameraCenter(view: CameraViewport): CameraViewport {
  const zoom = Math.max(0.35, Math.min(2.5, view.zoom));
  const halfW = view.screenWidth / Math.max(0.001, zoom) / 2;
  const halfH = view.screenHeight / Math.max(0.001, zoom) / 2;
  return {
    ...view,
    zoom,
    centerX: Math.max(halfW, Math.min(view.worldWidth - halfW, view.centerX)),
    centerY: Math.max(halfH, Math.min(view.worldHeight - halfH, view.centerY)),
  };
}

export function worldToScreen(view: CameraViewport, point: Point2): Point2 {
  const safe = clampCameraCenter(view);
  return {
    x: (point.x - safe.centerX) * safe.zoom + safe.screenWidth / 2,
    y: (point.y - safe.centerY) * safe.zoom + safe.screenHeight / 2,
  };
}

export function screenToWorld(view: CameraViewport, point: Point2): Point2 {
  const safe = clampCameraCenter(view);
  return {
    x: Math.max(0, Math.min(
      safe.worldWidth,
      (point.x - safe.screenWidth / 2) / safe.zoom + safe.centerX,
    )),
    y: Math.max(0, Math.min(
      safe.worldHeight,
      (point.y - safe.screenHeight / 2) / safe.zoom + safe.centerY,
    )),
  };
}
