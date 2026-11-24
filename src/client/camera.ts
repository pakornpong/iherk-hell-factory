export const STEP_X = 32;
export const STEP_Y = 16;

export function tileToWorld(tx: number, ty: number): [number, number] {
  return [(tx - ty) * STEP_X, (tx + ty) * STEP_Y];
}

export function worldToTile(wx: number, wy: number): [number, number] {
  const a = wx / STEP_X; // tx - ty
  const b = wy / STEP_Y; // tx + ty
  return [(a + b) / 2, (b - a) / 2];
}

export class IsoCamera {
  panX = 0;
  panY = 80;
  zoom = 2;
  private targetPanX: number | null = null;
  private targetPanY: number | null = null;

  setZoom(z: number): void {
    this.zoom = Math.max(1, Math.min(4, Math.round(z)));
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.targetPanX = null;
    this.targetPanY = null;
    this.panX += dxScreen / this.zoom;
    this.panY += dyScreen / this.zoom;
  }

  glideToTile(tx: number, ty: number, viewportW: number, viewportH: number): void {
    const [wx, wy] = tileToWorld(tx, ty);
    this.targetPanX = viewportW / (2 * this.zoom) - wx;
    this.targetPanY = viewportH / (2 * this.zoom) - wy;
  }

  snapToTile(tx: number, ty: number, viewportW: number, viewportH: number): void {
    const [wx, wy] = tileToWorld(tx, ty);
    this.panX = viewportW / (2 * this.zoom) - wx;
    this.panY = viewportH / (2 * this.zoom) - wy;
    this.targetPanX = null;
    this.targetPanY = null;
  }

  update(dtMs: number): boolean {
    if (this.targetPanX === null || this.targetPanY === null) return false;
    const factor = 1 - Math.exp(-dtMs / 110);
    this.panX += (this.targetPanX - this.panX) * factor;
    this.panY += (this.targetPanY - this.panY) * factor;
    if (
      Math.abs(this.targetPanX - this.panX) < 0.25 &&
      Math.abs(this.targetPanY - this.panY) < 0.25
    ) {
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.targetPanX = null;
      this.targetPanY = null;
      return false;
    }
    return true;
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [Math.round((wx + this.panX) * this.zoom), Math.round((wy + this.panY) * this.zoom)];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [sx / this.zoom - this.panX, sy / this.zoom - this.panY];
  }

  screenToTile(sx: number, sy: number, _viewportW?: number, _viewportH?: number): [number, number] {
    const [wx, wy] = this.screenToWorld(sx, sy);
    return worldToTile(wx, wy);
  }

  getVisibleWorldBounds(
    viewportW: number,
    viewportH: number,
    marginPx = 140,
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    const [minX, minY] = this.screenToWorld(-marginPx, -marginPx);
    const [maxX, maxY] = this.screenToWorld(viewportW + marginPx, viewportH + marginPx);
    return { minX, minY, maxX, maxY };
  }
}
