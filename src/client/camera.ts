import type { Direction } from "../shared/types.js";

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

const DIRECTIONS: readonly Direction[] = ["se", "sw", "nw", "ne"];

export class IsoView {
  constructor(
    readonly turns = 0,
    readonly width = 0,
    readonly height = 0,
  ) {}

  get swapsAxes(): boolean {
    return this.turns % 2 !== 0;
  }

  toView(x: number, y: number): [number, number] {
    switch (this.turns) {
      case 1: return [this.height - 1 - y, x];
      case 2: return [this.width - 1 - x, this.height - 1 - y];
      case 3: return [y, this.width - 1 - x];
      default: return [x, y];
    }
  }

  toOffice(x: number, y: number): [number, number] {
    switch (this.turns) {
      case 1: return [y, this.height - 1 - x];
      case 2: return [this.width - 1 - x, this.height - 1 - y];
      case 3: return [this.width - 1 - y, x];
      default: return [x, y];
    }
  }

  rect(x: number, y: number, width: number, height: number): [number, number, number, number] {
    const [ax, ay] = this.toView(x, y);
    const [bx, by] = this.toView(x + width - 1, y + height - 1);
    return [Math.min(ax, bx), Math.min(ay, by), this.swapsAxes ? height : width, this.swapsAxes ? width : height];
  }

  toViewDirection(direction: Direction): Direction {
    return DIRECTIONS[(DIRECTIONS.indexOf(direction) + this.turns) % DIRECTIONS.length];
  }

  toOfficeDirection(direction: Direction): Direction {
    return DIRECTIONS[(DIRECTIONS.indexOf(direction) - this.turns + DIRECTIONS.length) % DIRECTIONS.length];
  }
}

export class IsoCamera {
  private currentView = new IsoView();

  get view(): IsoView {
    return this.currentView;
  }

  setFloorSize(width: number, height: number, viewportW: number, viewportH: number): void {
    if (width === this.view.width && height === this.view.height) return;
    this.changeView(new IsoView(this.view.turns, width, height), viewportW, viewportH);
  }

  rotate(turn: -1 | 1, viewportW: number, viewportH: number): void {
    this.changeView(new IsoView((this.view.turns + turn + 4) % 4, this.view.width, this.view.height), viewportW, viewportH);
  }

  private changeView(next: IsoView, viewportW: number, viewportH: number): void {
    const centerX = viewportW / 2;
    const centerY = viewportH / 2;
    const [tx, ty] = this.screenToTile(centerX, centerY);
    this.currentView = next;
    this.snapToTile(tx - 0.5, ty - 0.5, viewportW, viewportH);
  }

  panX = 0;
  panY = 80;
  zoom = 2;
  private targetPanX: number | null = null;
  private targetPanY: number | null = null;

  setZoom(z: number, anchorScreenX?: number, anchorScreenY?: number): void {
    const prevZoom = this.zoom;
    const nextZoom = Math.max(1, Math.min(4, Math.round(z)));
    if (nextZoom === prevZoom) return;
    if (anchorScreenX !== undefined && anchorScreenY !== undefined) {
      // Keep the world point under (anchorScreenX, anchorScreenY) pinned at the exact same screen pixel
      const deltaScale = 1 / nextZoom - 1 / prevZoom;
      this.panX += anchorScreenX * deltaScale;
      this.panY += anchorScreenY * deltaScale;
      if (this.targetPanX !== null && this.targetPanY !== null) {
        this.targetPanX += anchorScreenX * deltaScale;
        this.targetPanY += anchorScreenY * deltaScale;
      }
    }
    this.zoom = nextZoom;
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.targetPanX = null;
    this.targetPanY = null;
    this.panX += dxScreen / this.zoom;
    this.panY += dyScreen / this.zoom;
  }

  glideToTile(tx: number, ty: number, viewportW: number, viewportH: number): void {
    const [wx, wy] = tileToWorld(...this.view.toView(tx, ty));
    this.targetPanX = viewportW / (2 * this.zoom) - wx;
    // Visual center of bottom-diamond anchored tile (tx, ty) is at wy - STEP_Y
    this.targetPanY = viewportH / (2 * this.zoom) - (wy - STEP_Y);
  }

  snapToTile(tx: number, ty: number, viewportW: number, viewportH: number): void {
    const [wx, wy] = tileToWorld(...this.view.toView(tx, ty));
    this.panX = viewportW / (2 * this.zoom) - wx;
    this.panY = viewportH / (2 * this.zoom) - (wy - STEP_Y);
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
    // Offset by +2*STEP_Y because bottom-diamond anchor places tile (tx, ty)'s top tip at wy - 2*STEP_Y and bottom tip at wy
    const [tx, ty] = worldToTile(wx, wy + STEP_Y);
    const [officeX, officeY] = this.view.toOffice(tx, ty);
    return [officeX + 0.5, officeY + 0.5];
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
