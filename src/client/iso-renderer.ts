import {
  classifyDepartmentFromPath,
  AMENITY_THEME_META,
  DEPARTMENT_META,
  type CatalogEntry,
  type ComputedCampus,
  type Direction,
  type EmployeeRecord,
  type OfficeState,
  type ThemeMode,
  type ToolCategory,
} from "../shared/types.js";
import type { AtlasManager, ResolvedSpriteFrame } from "./atlas-loader.js";
import { STEP_X, STEP_Y, type IsoCamera } from "./camera.js";

export interface DepthRenderItem {
  id: string;
  x: number;
  y: number;
  footprintX: number;
  footprintY: number;
}

export interface RenderedEmployeeInput {
  record: EmployeeRecord;
  x: number;
  y: number;
  direction: Direction;
  clipName: string;
  bubbleIcon?: string;
  bubbleText?: string;
}

export interface SyncPacketVisual {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
}

export interface DecorateGhostInput {
  tx: number;
  ty: number;
  assetId: string;
  direction: Direction;
  valid: boolean;
}

export interface RenderSceneInput {
  state: OfficeState;
  campus: ComputedCampus;
  camera: IsoCamera;
  atlas: AtlasManager;
  catalogById?: Map<string, CatalogEntry>;
  employees: RenderedEmployeeInput[];
  syncPackets: SyncPacketVisual[];
  selectedEmployeeId?: string | null;
  bayPopAnimations?: Map<string, number>; // bayId -> 0..1 progress
  ghost?: DecorateGhostInput | null;
  timeMs: number;
}

export function resolveAssetAnimationFrame(
  assetId: string,
  timeMs: number,
  catalogById?: Map<string, CatalogEntry>,
): string {
  const frames = catalogById?.get(assetId)?.frames;
  if (frames && frames.length > 0) {
    if (frames.length === 1) return frames[0];
    return frames[Math.floor(timeMs / 650) % frames.length];
  }
  const tick = Math.floor(timeMs / 650);
  if (assetId === "server-rack") return `blink_${tick % 3}`;
  if (assetId === "desk-security-ops") return `alert_${tick % 2}`;
  if (
    assetId === "desk-dev-dual" ||
    assetId === "coffee-machine-bar" ||
    assetId === "printer-copier" ||
    assetId === "robot-vacuum"
  ) {
    return `idle_${tick % 2}`;
  }
  return "default";
}

export interface ScreenHitBox {
  kind: "employee" | "furniture";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function isoScreenXRange(item: DepthRenderItem): [number, number] {
  return [item.x - (item.y + item.footprintY), item.x + item.footprintX - item.y];
}

function depthSortKey(item: DepthRenderItem): number {
  return item.x + item.footprintX + item.y + item.footprintY;
}

export function sortUnifiedIsoEntities<T extends DepthRenderItem>(items: T[]): T[] {
  const n = items.length;
  if (n <= 1) return [...items];

  const EPS = 1e-4;
  // Precompute bounds and sort indices by screen-X start for fast sweep-line overlap culling
  const minSX = new Float64Array(n);
  const maxSX = new Float64Array(n);
  const x0 = new Float64Array(n);
  const x1 = new Float64Array(n);
  const y0 = new Float64Array(n);
  const y1 = new Float64Array(n);
  const dKey = new Float64Array(n);
  const order = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const it = items[i];
    x0[i] = it.x;
    x1[i] = it.x + it.footprintX;
    y0[i] = it.y;
    y1[i] = it.y + it.footprintY;
    minSX[i] = it.x - y1[i];
    maxSX[i] = x1[i] - it.y;
    dKey[i] = x1[i] + y1[i];
    order[i] = i;
  }
  order.sort((a, b) => minSX[a] - minSX[b]);

  const adj: number[][] = Array.from({ length: n }, () => []);
  const inDeg = new Int32Array(n);

  for (let oi = 0; oi < n; oi++) {
    const i = order[oi];
    const aMaxSX = maxSX[i];
    const ax0 = x0[i];
    const ax1 = x1[i];
    const ay0 = y0[i];
    const ay1 = y1[i];

    for (let oj = oi + 1; oj < n; oj++) {
      const j = order[oj];
      // Sweep-line early break: all subsequent items start at or past aMaxSX
      if (minSX[j] >= aMaxSX - EPS) break;

      const bx0 = x0[j];
      const bx1 = x1[j];
      const by0 = y0[j];
      const by1 = y1[j];

      const aBehindB = ax1 <= bx0 + EPS || ay1 <= by0 + EPS;
      const bBehindA = bx1 <= ax0 + EPS || by1 <= ay0 + EPS;

      if (aBehindB && !bBehindA) {
        adj[i].push(j);
        inDeg[j]++;
      } else if (bBehindA && !aBehindB) {
        adj[j].push(i);
        inDeg[i]++;
      } else if (!aBehindB && !bBehindA) {
        // Overlapping footprints: an occupant fully inside another item's footprint
        // (character seated on a chair) draws after the item it occupies.
        const aInsideB = ax0 >= bx0 - EPS && ax1 <= bx1 + EPS && ay0 >= by0 - EPS && ay1 <= by1 + EPS;
        const bInsideA = bx0 >= ax0 - EPS && bx1 <= ax1 + EPS && by0 >= ay0 - EPS && by1 <= ay1 + EPS;
        if (aInsideB && !bInsideA) {
          adj[j].push(i);
          inDeg[i]++;
        } else if (bInsideA && !aInsideB) {
          adj[i].push(j);
          inDeg[j]++;
        }
      }
    }
  }

  const compareIdx = (ia: number, ib: number): number => {
    const dk = dKey[ia] - dKey[ib];
    if (Math.abs(dk) > EPS) return dk;
    const dx = x0[ia] - x0[ib];
    if (Math.abs(dx) > EPS) return dx;
    const dy = y0[ia] - y0[ib];
    if (Math.abs(dy) > EPS) return dy;
    return items[ia].id.localeCompare(items[ib].id);
  };

  // Incremental sorted ready queue (binary insert avoids O(N^2 log N) full scans)
  const ready: number[] = [];
  const insertReady = (idx: number) => {
    let lo = 0;
    let hi = ready.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compareIdx(ready[mid], idx) <= 0) lo = mid + 1;
      else hi = mid;
    }
    ready.splice(lo, 0, idx);
  };

  for (let i = 0; i < n; i++) {
    if (inDeg[i] === 0) insertReady(i);
  }

  const emitted = new Uint8Array(n);
  const result: T[] = [];

  while (result.length < n) {
    let pick: number;
    if (ready.length > 0) {
      pick = ready.shift()!;
    } else {
      pick = -1;
      for (let i = 0; i < n; i++) {
        if (!emitted[i] && (pick === -1 || compareIdx(i, pick) < 0)) pick = i;
      }
    }
    emitted[pick] = 1;
    result.push(items[pick]);
    for (const next of adj[pick]) {
      inDeg[next]--;
      if (inDeg[next] === 0 && !emitted[next]) {
        insertReady(next);
      }
    }
  }

  return result;
}

export function isInWorldBounds(
  wx: number,
  wy: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return wx >= bounds.minX && wx <= bounds.maxX && wy >= bounds.minY && wy <= bounds.maxY;
}

function toAnchorWorld(x: number, y: number, fx: number, fy: number): [number, number] {
  const ax = x + fx - 1;
  const ay = y + fy - 1;
  return [(ax - ay) * STEP_X, (ax + ay) * STEP_Y];
}

function edgeToDir(edge: "nw" | "ne" | "corner"): Direction {
  return edge === "ne" ? "sw" : "se";
}

function toolGlowColor(cat: ToolCategory): string {
  switch (cat) {
    case "code":
      return "rgba(56, 189, 248, 0.35)";
    case "shell":
      return "rgba(245, 158, 11, 0.38)";
    case "search":
      return "rgba(34, 197, 94, 0.35)";
    case "error":
      return "rgba(239, 68, 68, 0.55)";
    default:
      return "rgba(56, 189, 248, 0.12)";
  }
}

export interface FloorSlabPalette {
  rimTop: string;
  rimBevel: string;
  faceLeft: string;
  faceLeftBottom: string;
  faceRight: string;
  faceRightBottom: string;
  innerSeam: string;
  cornerCrease: string;
  outline: string;
  shadowColor: string;
}

export const FLOOR_SLAB_PALETTES: Record<ThemeMode, FloorSlabPalette> = {
  office: {
    rimTop: "#7a6e6f",
    rimBevel: "#8d8081",
    faceLeft: "#4d4446",
    faceLeftBottom: "#3f3739",
    faceRight: "#5e5355",
    faceRightBottom: "#504648",
    innerSeam: "#292325",
    cornerCrease: "#362f31",
    outline: "#1c1218",
    shadowColor: "rgba(0, 0, 0, 0.28)",
  },
  day: {
    rimTop: "#dcd5c8",
    rimBevel: "#ede7dc",
    faceLeft: "#9c9183",
    faceLeftBottom: "#8a7f72",
    faceRight: "#b8ada0",
    faceRightBottom: "#a69b8d",
    innerSeam: "#6b6156",
    cornerCrease: "#7d7265",
    outline: "#2b241f",
    shadowColor: "rgba(15, 23, 42, 0.18)",
  },
  night: {
    rimTop: "#334254",
    rimBevel: "#43566d",
    faceLeft: "#1a2234",
    faceLeftBottom: "#131928",
    faceRight: "#253147",
    faceRightBottom: "#1d273a",
    innerSeam: "#0e1320",
    cornerCrease: "#121826",
    outline: "#04060c",
    shadowColor: "rgba(0, 0, 0, 0.35)",
  },
};

export interface FloorSlabGeometry {
  leftX: number;
  leftY: number;
  bottomX: number;
  bottomY: number;
  rightX: number;
  rightY: number;
  rimHeight: number;
  faceHeight: number;
  slabDepth: number;
  wallCutawayStart: number;
}

export function computeFloorSlabGeometry(widthTiles: number, depthTiles: number): FloorSlabGeometry {
  const rimHeight = 3; // 2px cutaway top rim + 1px bevel highlight
  const faceHeight = 10; // 8px vertical slab face + 2px shaded bottom lip
  const slabDepth = 1 + rimHeight + faceHeight; // 14 world px below floor edge (before 1px outer outline)
  return {
    leftX: -depthTiles * STEP_X + 1,
    leftY: (depthTiles - 2) * STEP_Y,
    bottomX: (widthTiles - depthTiles) * STEP_X,
    bottomY: (widthTiles + depthTiles - 2) * STEP_Y,
    rightX: widthTiles * STEP_X - 1,
    rightY: (widthTiles - 2) * STEP_Y,
    rimHeight,
    faceHeight,
    slabDepth,
    wallCutawayStart: 94, // double-volume loft height: sits directly beneath the 2px top wall cap (z=94..95)
  };
}

interface IsoEdgeRun {
  x: number;
  y: number;
  w: number;
}

function collectIsoEdgeRuns(
  xStart: number,
  xEnd: number,
  yAt: (x: number) => number,
  minVisX: number,
  maxVisX: number,
): IsoEdgeRun[] {
  const clampedStart = Math.max(xStart, Math.floor(minVisX));
  const clampedEnd = Math.min(xEnd, Math.ceil(maxVisX));
  if (clampedStart > clampedEnd) return [];

  const runs: IsoEdgeRun[] = [];
  let curX = clampedStart;
  let curY = yAt(clampedStart);
  let curW = 1;

  for (let x = clampedStart + 1; x <= clampedEnd; x++) {
    const y = yAt(x);
    if (y === curY) {
      curW++;
    } else {
      runs.push({ x: curX, y: curY, w: curW });
      curX = x;
      curY = y;
      curW = 1;
    }
  }
  runs.push({ x: curX, y: curY, w: curW });
  return runs;
}

interface StaticBackdropCache {
  canvas: HTMLCanvasElement;
  campus: ComputedCampus;
  theme: ThemeMode;
  atlasImage: HTMLImageElement | null;
  minWX: number;
  minWY: number;
  width: number;
  height: number;
}

export class IsoRenderer {
  lastHitBoxes: ScreenHitBox[] = [];
  private backdropCache: StaticBackdropCache | null = null;

  private drawStaticBackdrop(
    ctx: CanvasRenderingContext2D,
    input: RenderSceneInput,
    zoom: number,
    baseScreenX: number,
    baseScreenY: number,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    const { state, campus, atlas } = input;
    const theme: ThemeMode = state.theme;

    const worldToScreen = (wx: number, wy: number): [number, number] => [
      Math.round(baseScreenX + wx * zoom),
      Math.round(baseScreenY + wy * zoom),
    ];

    const drawStaticSprite = (sprite: ResolvedSpriteFrame, wx: number, wy: number): void => {
      const [sx, sy] = worldToScreen(wx - sprite.anchor.x, wy - sprite.anchor.y);
      ctx.drawImage(
        sprite.image,
        sprite.frame.x,
        sprite.frame.y,
        sprite.frame.w,
        sprite.frame.h,
        sx,
        sy,
        sprite.frame.w * zoom,
        sprite.frame.h * zoom,
      );
    };

    const fillWorldRect = (wx: number, wy: number, ww: number, wh: number) => {
      ctx.fillRect(baseScreenX + wx * zoom, baseScreenY + wy * zoom, ww * zoom, wh * zoom);
    };

    // 1. Floors (viewport culled)
    const visibleFloors = campus.floors
      .filter((f) => {
        const [wx, wy] = toAnchorWorld(f.tx, f.ty, 1, 1);
        return isInWorldBounds(wx, wy, bounds);
      })
      .sort((a, b) => a.tx + a.ty - (b.tx + b.ty) || a.tx - b.tx);

    for (const f of visibleFloors) {
      const sprite = atlas.getFrame(theme, f.assetId, f.direction, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(f.tx, f.ty, 1, 1);
      drawStaticSprite(sprite, wx, wy);
    }

    // 1b. Diorama Floor Cutaway Rim & Thick Slab (prevents flat paper-thin floor edges)
    const hasFloorPerimeter = campus.widthTiles > 0 && campus.depthTiles > 0;
    const slabPal = FLOOR_SLAB_PALETTES[theme];
    const slabGeo = hasFloorPerimeter
      ? computeFloorSlabGeometry(campus.widthTiles, campus.depthTiles)
      : null;

    if (slabGeo) {
      const { leftX, leftY, bottomX, bottomY, rightX, rightY, faceHeight, slabDepth } = slabGeo;
      const leftRuns = collectIsoEdgeRuns(
        leftX,
        bottomX,
        (x) => leftY + Math.floor((x - leftX + 1) / 2),
        bounds.minX - 2,
        bounds.maxX + 2,
      );
      const rightRuns = collectIsoEdgeRuns(
        bottomX + 1,
        rightX,
        (x) => rightY + Math.floor((rightX - x + 1) / 2),
        bounds.minX - 2,
        bounds.maxX + 2,
      );

      if (leftRuns.length > 0 || rightRuns.length > 0) {
        // Grounded contact shadow beneath the slab
        ctx.fillStyle = slabPal.shadowColor;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + slabDepth + 1, r.w, 3);
        for (const r of rightRuns) fillWorldRect(r.x, r.y + slabDepth + 1, r.w, 3);

        // 1px dark inner seam separating floor tiles from cutaway rim
        ctx.fillStyle = slabPal.innerSeam;
        for (const r of leftRuns) fillWorldRect(r.x, r.y, r.w, 1);
        for (const r of rightRuns) fillWorldRect(r.x, r.y, r.w, 1);

        // 2px top cutaway rim ledge
        ctx.fillStyle = slabPal.rimTop;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + 1, r.w, 2);
        for (const r of rightRuns) fillWorldRect(r.x, r.y + 1, r.w, 2);

        // 1px crisp bevel highlight along top edge of vertical slab face
        ctx.fillStyle = slabPal.rimBevel;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + 3, r.w, 1);
        for (const r of rightRuns) fillWorldRect(r.x, r.y + 3, r.w, 1);

        // Two-tone vertical slab faces (shaded front-left vs lit front-right)
        ctx.fillStyle = slabPal.faceLeft;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + 4, r.w, faceHeight - 2);
        ctx.fillStyle = slabPal.faceLeftBottom;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + 4 + faceHeight - 2, r.w, 2);

        ctx.fillStyle = slabPal.faceRight;
        for (const r of rightRuns) fillWorldRect(r.x, r.y + 4, r.w, faceHeight - 2);
        ctx.fillStyle = slabPal.faceRightBottom;
        for (const r of rightRuns) fillWorldRect(r.x, r.y + 4 + faceHeight - 2, r.w, 2);

        // 1px crisp outer bottom outline
        ctx.fillStyle = slabPal.outline;
        for (const r of leftRuns) fillWorldRect(r.x, r.y + slabDepth, r.w, 1);
        for (const r of rightRuns) fillWorldRect(r.x, r.y + slabDepth, r.w, 1);

        // Outer left & right vertical 1px outlines + front apex corner crease
        if (leftX - 1 >= bounds.minX - 2 && leftX - 1 <= bounds.maxX + 2) {
          fillWorldRect(leftX - 1, leftY, 1, slabDepth + 1);
        }
        if (rightX + 1 >= bounds.minX - 2 && rightX + 1 <= bounds.maxX + 2) {
          fillWorldRect(rightX + 1, rightY, 1, slabDepth + 1);
        }
        if (bottomX >= bounds.minX - 2 && bottomX <= bounds.maxX + 2) {
          ctx.fillStyle = slabPal.cornerCrease;
          fillWorldRect(bottomX, bottomY + 4, 1, faceHeight);
          ctx.fillStyle = slabPal.outline;
          fillWorldRect(bottomX, bottomY + slabDepth, 1, 1);
        }
      }
    }

    // Subtle colored floor accent strips for each Project Bay
    const bayById = new Map(state.bays.map((b) => [b.id, b]));
    for (const z of campus.zones) {
      if (z.kind !== "bay" || !z.bayId) continue;
      const bay = bayById.get(z.bayId);
      if (!bay) continue;
      const [wx, wy] = toAnchorWorld(z.originX + 2.5, z.originY + 5.1, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = worldToScreen(wx, wy);
      ctx.save();
      ctx.fillStyle = bay.accentColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx - 24 * zoom, sy - 2 * zoom, 48 * zoom, 4 * zoom);
      ctx.restore();
    }

    // 2. Outer Rear Walls + Wall Decor
    const wallEvents: Array<{
      tx: number;
      ty: number;
      depthKey: number;
      isDecor: boolean;
      sprite: ResolvedSpriteFrame;
      wx: number;
      wy: number;
    }> = [];

    for (const w of campus.walls) {
      const dir = edgeToDir(w.edge);
      const sprite = atlas.getFrame(theme, w.assetId, dir, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(w.tx, w.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      wallEvents.push({
        tx: w.tx,
        ty: w.ty,
        depthKey: w.tx + sprite.footprintTiles[0] - 1 + w.ty + sprite.footprintTiles[1] - 1,
        isDecor: false,
        sprite,
        wx,
        wy,
      });
    }
    for (const d of campus.wallDecor) {
      const dir = edgeToDir(d.edge);
      const sprite = atlas.getFrame(theme, d.assetId, dir, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(d.tx, d.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      wallEvents.push({
        tx: d.tx,
        ty: d.ty,
        depthKey: d.tx + sprite.footprintTiles[0] - 1 + d.ty + sprite.footprintTiles[1] - 1,
        isDecor: true,
        sprite,
        wx,
        wy,
      });
    }
    wallEvents.sort((a, b) => a.depthKey - b.depthKey || (a.isDecor ? 1 : -1) - (b.isDecor ? 1 : -1) || a.tx - b.tx);
    for (const we of wallEvents) {
      drawStaticSprite(we.sprite, we.wx, we.wy);
    }

    // 2b. Seamless Vertical Wall Cutaway End-Caps (connects wall top cap straight into floor cutaway slab)
    if (slabGeo && campus.walls.length > 0) {
      const { leftX, leftY, rightX, rightY, slabDepth, wallCutawayStart } = slabGeo;
      if (leftX + 4 >= bounds.minX - 2 && leftX - 1 <= bounds.maxX + 2) {
        for (let dx = 0; dx <= 4; dx++) {
          const x = leftX + dx;
          const stepY = Math.floor((dx + 1) / 2);
          const yTop = leftY - wallCutawayStart + stepY;
          const ySlabBot = leftY + stepY + slabDepth;
          if (dx === 0) {
            ctx.fillStyle = slabPal.outline;
            fillWorldRect(x - 1, yTop - 1, 1, ySlabBot - (yTop - 1) + 1);
            ctx.fillStyle = slabPal.faceLeft;
            fillWorldRect(x, yTop, 1, ySlabBot - yTop - 2);
            ctx.fillStyle = slabPal.faceLeftBottom;
            fillWorldRect(x, ySlabBot - 2, 1, 2);
          } else if (dx === 4) {
            ctx.fillStyle = slabPal.innerSeam;
            fillWorldRect(x, yTop, 1, leftY + stepY - yTop + 1);
          } else {
            ctx.fillStyle = slabPal.faceLeft;
            fillWorldRect(x, yTop, 1, ySlabBot - yTop - 2);
            ctx.fillStyle = slabPal.faceLeftBottom;
            fillWorldRect(x, ySlabBot - 2, 1, 2);
          }
        }
      }
      if (rightX + 1 >= bounds.minX - 2 && rightX - 4 <= bounds.maxX + 2) {
        for (let dx = 0; dx <= 4; dx++) {
          const x = rightX - dx;
          const stepY = Math.floor((dx + 1) / 2);
          const yTop = rightY - wallCutawayStart + stepY;
          const ySlabBot = rightY + stepY + slabDepth;
          if (dx === 0) {
            ctx.fillStyle = slabPal.outline;
            fillWorldRect(x + 1, yTop - 1, 1, ySlabBot - (yTop - 1) + 1);
            ctx.fillStyle = slabPal.faceRight;
            fillWorldRect(x, yTop, 1, ySlabBot - yTop - 2);
            ctx.fillStyle = slabPal.faceRightBottom;
            fillWorldRect(x, ySlabBot - 2, 1, 2);
          } else if (dx === 4) {
            ctx.fillStyle = slabPal.innerSeam;
            fillWorldRect(x, yTop, 1, rightY + stepY - yTop + 1);
          } else {
            ctx.fillStyle = slabPal.faceRight;
            fillWorldRect(x, yTop, 1, ySlabBot - yTop - 2);
            ctx.fillStyle = slabPal.faceRightBottom;
            fillWorldRect(x, ySlabBot - 2, 1, 2);
          }
        }
      }
    }
  }

  private getOrBuildBackdropCache(input: RenderSceneInput): StaticBackdropCache | null {
    if (typeof document === "undefined") return null;
    const { campus, state, atlas } = input;
    if (campus.widthTiles <= 0 || campus.depthTiles <= 0) return null;
    const minWX = -campus.depthTiles * STEP_X - 40;
    const minWY = -168;
    const maxWX = campus.widthTiles * STEP_X + 40;
    const maxWY = (campus.widthTiles + campus.depthTiles) * STEP_Y + 48;
    const cacheW = Math.ceil(maxWX - minWX);
    const cacheH = Math.ceil(maxWY - minWY);
    if (cacheW > 4096 || cacheH > 4096) return null;

    const sampleFloor = campus.floors[0];
    const sampleSprite = sampleFloor
      ? atlas.getFrame(state.theme, sampleFloor.assetId, sampleFloor.direction, "default")
      : null;
    const atlasImage = sampleSprite?.image ?? null;

    const cur = this.backdropCache;
    if (cur && cur.campus === campus && cur.theme === state.theme && cur.atlasImage === atlasImage) {
      return cur;
    }

    const canvas = cur && cur.width === cacheW && cur.height === cacheH ? cur.canvas : document.createElement("canvas");
    canvas.width = cacheW;
    canvas.height = cacheH;
    const offCtx = canvas.getContext("2d");
    if (!offCtx) return null;
    offCtx.imageSmoothingEnabled = false;
    offCtx.clearRect(0, 0, cacheW, cacheH);

    this.drawStaticBackdrop(offCtx, input, 1, -minWX, -minWY, {
      minX: minWX - 64,
      minY: minWY - 64,
      maxX: maxWX + 64,
      maxY: maxWY + 64,
    });

    this.backdropCache = {
      canvas,
      campus,
      theme: state.theme,
      atlasImage,
      minWX,
      minWY,
      width: cacheW,
      height: cacheH,
    };
    return this.backdropCache;
  }

  render(ctx: CanvasRenderingContext2D, input: RenderSceneInput): void {
    const { state, campus, camera, atlas, employees, syncPackets, ghost, timeMs } = input;
    const theme: ThemeMode = state.theme;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const zoom = camera.zoom;
    const bounds = camera.getVisibleWorldBounds(width, height, 150);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme === "office" ? "#212226" : theme === "day" ? "#cbd5e1" : "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const drawSprite = (
      sprite: ResolvedSpriteFrame,
      wx: number,
      wy: number,
      opts?: { alpha?: number; popScaleY?: number; emissive?: boolean },
    ): { sx: number; sy: number; sw: number; sh: number } => {
      const [baseSX, baseSY] = camera.worldToScreen(wx - sprite.anchor.x, wy - sprite.anchor.y);
      const sw = sprite.frame.w * zoom;
      const sh = sprite.frame.h * zoom;
      const pop = opts?.popScaleY ?? 1;
      const drawH = Math.round(sh * pop);
      const drawY = baseSY + (sh - drawH);

      if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      const img = opts?.emissive ? sprite.emissiveImage : sprite.image;
      if (img) {
        ctx.drawImage(
          img,
          sprite.frame.x,
          sprite.frame.y,
          sprite.frame.w,
          sprite.frame.h,
          baseSX,
          drawY,
          sw,
          drawH,
        );
      }
      if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
      return { sx: baseSX, sy: drawY, sw, sh: drawH };
    };

    // 1-2. Static Backdrop (Floors + Cutaway Slab + Outer Walls + Wall Decor) — cached offscreen in browser!
    const cached = this.getOrBuildBackdropCache(input);
    if (cached) {
      const [sx, sy] = camera.worldToScreen(cached.minWX, cached.minWY);
      ctx.drawImage(cached.canvas, sx, sy, cached.width * zoom, cached.height * zoom);
    } else {
      const baseScreenX = Math.round(camera.panX * zoom);
      const baseScreenY = Math.round(camera.panY * zoom);
      this.drawStaticBackdrop(ctx, input, zoom, baseScreenX, baseScreenY, bounds);
    }

    // 3. Unified Furniture + Animated Characters (topological depth-sort)
    const animFrameForAsset = (assetId: string): string =>
      resolveAssetAnimationFrame(assetId, timeMs, input.catalogById);

    type UnifiedItem =
      | (DepthRenderItem & {
          kind: "furniture";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          zoneId: string;
          assetId: string;
          furnitureId: string;
        })
      | (DepthRenderItem & {
          kind: "employee";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          emp: RenderedEmployeeInput;
        });

    const unified: UnifiedItem[] = [];
    // Track rear-facing swivel chairs ("nw"/"sw") so their ergonomic backrest overlays the seated character's lower back
    // while keeping the chair seat cushion and base cleanly underneath the character.
    const rearChairByTile = new Map<string, Direction>();

    for (const f of campus.worldFurniture) {
      if (f.assetId === "chair-office-swivel" && (f.direction === "nw" || f.direction === "sw")) {
        rearChairByTile.set(`${f.tx},${f.ty}`, f.direction);
      }
      const frameName = animFrameForAsset(f.assetId);
      const sprite = atlas.getFrame(theme, f.assetId, f.direction, frameName);
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(f.tx, f.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      unified.push({
        id: `f:${f.id}`,
        kind: "furniture",
        x: f.tx,
        y: f.ty,
        footprintX: sprite.footprintTiles[0],
        footprintY: sprite.footprintTiles[1],
        sprite,
        wx,
        wy,
        zoneId: f.zoneId,
        assetId: f.assetId,
        furnitureId: f.id,
      });
    }

    // Room walls stand on the line between two tiles, so they ride the same depth sort as furniture at a
    // half-tile offset; that keeps them correctly in front of the room behind and behind the room in front.
    for (const w of campus.wallSegments ?? []) {
      const sprite = atlas.getFrame(theme, w.assetId, w.direction, animFrameForAsset(w.assetId));
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(w.rx, w.ry, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      // The sprite is drawn from (wx, wy), but for depth sorting the wall is a plane standing ON the
      // boundary line. Its box starts exactly at the line and is a hair thick, so anything in the room
      // behind ends at or before it and sorts behind for certain — even a two-tile desk, which would
      // otherwise win on the distance tiebreak and be drawn straight through the glass. The box is a
      // hair LONGER than a tile along the run so a neighbour in the room in front counts as sitting
      // inside it and draws after it.
      const thin = 0.05;
      const over = 0.05;
      const alongY = w.axis === "y";
      const alongX = w.axis === "x";
      unified.push({
        id: `w:${w.id}`,
        kind: "furniture",
        x: alongX ? w.rx - over : w.rx + 0.5,
        y: alongY ? w.ry - over : w.ry + 0.5,
        footprintX: alongX ? sprite.footprintTiles[0] + over * 2 : thin,
        footprintY: alongY ? sprite.footprintTiles[1] + over * 2 : thin,
        sprite,
        wx,
        wy,
        zoneId: "",
        assetId: w.assetId,
        furnitureId: w.id,
      });
    }


    // Boss avatar seated permanently at Boss Office (0,0) executive chair facing "se" (+Y toward desk)
    const bossZone = campus.zones.find((z) => z.kind === "boss");
    if (bossZone) {
      const bossChair = campus.worldFurniture.find(
        (f) => f.zoneId === "boss:0" && f.id === "boss:0-boss-chair",
      );
      const bx = bossChair ? bossChair.tx : bossZone.originX + 2;
      const by = bossChair ? bossChair.ty : bossZone.originY + 1;
      const hasVisitor = employees.some((e) => e.record.visualState === "reporting");
      // Boss stays seated in the executive chair; types faster while a visitor reports.
      const bossClip = `sit_type_${Math.floor(timeMs / (hasVisitor ? 300 : 750)) % 2}`;
      const bossSprite =
        atlas.getFrame(theme, "agent-boss", "se", bossClip) ??
        atlas.getFrame(theme, "agent-starter", "se", bossClip);
      if (bossSprite) {
        const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
        if (isInWorldBounds(wx, wy, bounds)) {
          unified.push({
            id: "e:boss-avatar",
            kind: "employee",
            x: bx + 0.2,
            y: by + 0.2,
            footprintX: 0.6,
            footprintY: 0.6,
            sprite: bossSprite,
            wx,
            wy,
            emp: {
              record: {
                id: "boss-avatar",
                bayId: "boss:0",
                spriteId: "agent-boss",
                displayName: "BOSS",
                role: "Boss",
                isEphemeral: false,
                deskIndex: 0,
                visualState: "working",
                toolCategory: "idle",
                lastUpdatedAt: timeMs,
              },
              x: bx,
              y: by,
              direction: "se",
              clipName: bossClip,
              bubbleIcon: "👑",
              bubbleText: "BOSS",
            },
          });
        }
      }
    }

    for (const emp of employees) {
      const sprite = atlas.getFrame(theme, emp.record.spriteId, emp.direction, emp.clipName);
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(emp.x, emp.y, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      unified.push({
        id: `e:${emp.record.id}`,
        kind: "employee",
        x: emp.x + 0.2,
        y: emp.y + 0.2,
        footprintX: 0.6,
        footprintY: 0.6,
        sprite,
        wx,
        wy,
        emp,
      });
    }

    const sorted = sortUnifiedIsoEntities(unified);
    const hitBoxes: ScreenHitBox[] = [];
    const emissiveDraws: Array<{ sprite: ResolvedSpriteFrame; wx: number; wy: number; pop: number }> = [];

    for (const item of sorted) {
      if (item.kind === "furniture") {
        const bayId = item.zoneId.startsWith("bay:") ? item.zoneId.slice(4) : undefined;
        const pop = bayId && input.bayPopAnimations?.has(bayId) ? input.bayPopAnimations.get(bayId)! : 1;
        const box = drawSprite(item.sprite, item.wx, item.wy, { popScaleY: pop });
        hitBoxes.push({ kind: "furniture", id: item.furnitureId, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        if (item.sprite.emissiveImage) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop });
        }
      } else {
        const box = drawSprite(item.sprite, item.wx, item.wy);
        hitBoxes.push({ kind: "employee", id: item.emp.record.id, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        // 3-layer seating: if seated (typing or sleeping) on a rear-facing swivel chair ("nw"/"sw"),
        // draw only the ergonomic backrest in front of the character's lower back.
        const seatTx = Math.round(item.emp.x);
        const seatTy = Math.round(item.emp.y);
        const isSeatedClip =
          item.emp.clipName.startsWith("sit_") || item.emp.clipName.startsWith("rest_sleep_");
        const rearChairDir = isSeatedClip
          ? rearChairByTile.get(`${seatTx},${seatTy}`)
          : undefined;
        if (rearChairDir && rearChairDir === item.emp.direction) {
          const backSprite = atlas.getFrame(theme, "chair-office-swivel-back", rearChairDir, "default");
          if (backSprite) {
            const [cwx, cwy] = toAnchorWorld(seatTx, seatTy, 1, 1);
            drawSprite(backSprite, cwx, cwy);
          }
        }
        const occludedBackGlow = Boolean(rearChairDir && rearChairDir === item.emp.direction);
        if (item.sprite.emissiveImage && !occludedBackGlow) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop: 1 });
        }
        // Highlight selected employee ring
        if (input.selectedEmployeeId === item.emp.record.id) {
          const [cx, cy] = camera.worldToScreen(item.wx, item.wy - 4);
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = Math.max(2, zoom);
          ctx.beginPath();
          ctx.ellipse(cx, cy, 14 * zoom, 7 * zoom, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    this.lastHitBoxes = hitBoxes;

    // 4. Emissive Additive Pass (stronger glow at night)
    if (emissiveDraws.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glowAlpha = theme === "night" ? 0.55 : theme === "office" ? 0.25 : 0.18;
      for (const ed of emissiveDraws) {
        drawSprite(ed.sprite, ed.wx, ed.wy, { alpha: glowAlpha, popScaleY: ed.pop, emissive: true });
      }
      ctx.restore();
    }

    // 5. Decorate Mode Ghost Preview
    if (ghost) {
      const sprite = atlas.getFrame(theme, ghost.assetId, ghost.direction, "default");
      if (sprite) {
        const [wx, wy] = toAnchorWorld(ghost.tx, ghost.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
        drawSprite(sprite, wx, wy, { alpha: 0.6 });
        const [gx, gy] = camera.worldToScreen(wx, wy - 6);
        ctx.save();
        ctx.strokeStyle = ghost.valid ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Teamwork Sync Particles between active bay teammates
    for (const pkt of syncPackets) {
      const px = pkt.fromX + (pkt.toX - pkt.fromX) * pkt.progress;
      const py = pkt.fromY + (pkt.toY - pkt.fromY) * pkt.progress;
      const [wx, wy] = toAnchorWorld(px, py, 1, 1);
      const [sx, sy] = camera.worldToScreen(wx, wy - 24 - Math.sin(pkt.progress * Math.PI) * 10);
      ctx.save();
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(sx - 2 * zoom, sy - 2 * zoom, 4 * zoom, 4 * zoom);
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(sx - zoom, sy - zoom, 2 * zoom, 2 * zoom);
      ctx.restore();
    }

    // 7. Bay Nameplates (with Department Badges) & Employee Speech/Tool Bubbles
    const bayById = new Map(state.bays.map((b) => [b.id, b]));
    ctx.save();
    ctx.font = `bold ${Math.max(10, 6 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    const seenDepts = new Set<string>();
    for (const z of campus.zones) {
      const [wx, wy] = toAnchorWorld(z.originX + 3, z.originY + 5.7, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = camera.worldToScreen(wx, wy);
      const bay = z.bayId ? bayById.get(z.bayId) : undefined;
      const deptId =
        z.kind === "bay"
          ? (z.department ?? bay?.department ?? classifyDepartmentFromPath(bay?.projectPath))
          : undefined;
      const deptMeta = deptId ? DEPARTMENT_META[deptId] : undefined;

      const label =
        z.kind === "boss"
          ? "👑 BOSS OFFICE"
          : z.kind === "cowork"
            ? `🤝 CO-WORKING · SUBAGENTS`
          : z.kind === "common"
            ? `LOUNGE & MEETING · #${z.zoneId.split(":")[1] ?? "0"}`
            : z.kind === "amenity" && z.amenityTheme
              ? `${AMENITY_THEME_META[z.amenityTheme].icon} ${AMENITY_THEME_META[z.amenityTheme].label}`
              : `${deptMeta ? `${deptMeta.icon} ${deptMeta.shortLabel} · ` : ""}${bay?.displayName ?? z.zoneId}`;
      const activeTeamCount = z.bayId
        ? employees.filter(
            (e) =>
              e.record.bayId === z.bayId &&
              (e.record.visualState === "working" || e.record.visualState === "teamwork"),
          ).length
        : 0;
      const fullLabel = activeTeamCount >= 2 ? `${label} · TEAM` : label;
      const textW = ctx.measureText(fullLabel).width + 14;
      const borderColor = z.kind === "boss" ? "#f59e0b" : z.kind === "cowork" ? "#14b8a6" : z.amenityTheme ? AMENITY_THEME_META[z.amenityTheme].color : deptMeta?.color ?? bay?.accentColor ?? "#64748b";
      const boxX = Math.round(sx - textW / 2);
      const boxY = Math.round(sy - 10);
      ctx.fillStyle = theme === "day" ? "rgba(15, 23, 42, 0.84)" : "rgba(15, 23, 42, 0.90)";
      ctx.fillRect(boxX, boxY, Math.round(textW), 18);
      if (deptMeta) {
        ctx.fillStyle = deptMeta.color;
        ctx.fillRect(boxX, boxY, 4, 18);
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = z.kind === "boss" ? 1.5 : 1;
      ctx.strokeRect(boxX, boxY, Math.round(textW), 18);
      ctx.fillStyle = z.kind === "boss" ? "#fde68a" : "#f8fafc";
      ctx.fillText(fullLabel, Math.round(sx + (deptMeta ? 2 : 0)), Math.round(sy + 3));

      // Department Zone Header Pill above the first bay of each department group
      if (deptMeta && !seenDepts.has(deptMeta.id)) {
        seenDepts.add(deptMeta.id);
        const [zwx, zwy] = toAnchorWorld(z.originX + 2.5, z.originY + 0.3, 1, 1);
        if (isInWorldBounds(zwx, zwy, bounds)) {
          const [zsx, zsy] = camera.worldToScreen(zwx, zwy - 34);
          const zoneLabel = `${deptMeta.icon} ${deptMeta.label} ZONE`;
          const zw = ctx.measureText(zoneLabel).width + 12;
          ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
          ctx.fillRect(Math.round(zsx - zw / 2), Math.round(zsy - 14), Math.round(zw), 16);
          ctx.strokeStyle = deptMeta.color;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(Math.round(zsx - zw / 2), Math.round(zsy - 14), Math.round(zw), 16);
          ctx.fillStyle = deptMeta.color;
          ctx.fillText(zoneLabel, Math.round(zsx), Math.round(zsy - 2));
        }
      }
    }

    // Employee floating bubbles & subtle tool-category aura
    // Floating 👑 BOSS badge above Boss avatar in Boss Office (0,0)
    if (bossZone) {
      const bossChair = campus.worldFurniture.find(
        (f) => f.zoneId === "boss:0" && f.id === "boss:0-boss-chair",
      );
      const bx = bossChair ? bossChair.tx : bossZone.originX + 2;
      const by = bossChair ? bossChair.ty : bossZone.originY + 1;
      const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
      if (isInWorldBounds(wx, wy, bounds)) {
        // Sit above the seated Boss's head (sprite ~49px tall incl. chair offset) instead of over the face.
        const [sx, sy] = camera.worldToScreen(wx, wy - 50);
        ctx.font = `700 ${Math.max(10, 5 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const label = "👑 BOSS";
        const bw = ctx.measureText(label).width + 10;
        const bh = 18;
        ctx.fillStyle = "rgba(120, 53, 15, 0.92)";
        ctx.fillRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.fillStyle = "#fef3c7";
        ctx.fillText(label, Math.round(sx), Math.round(sy - 5));
      }
    }

    for (const emp of employees) {
      const [wx, wy] = toAnchorWorld(emp.x, emp.y, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const bob = Math.sin(timeMs / 400 + emp.x) * 1.5;
      // Float cleanly above the Phase 2 sprite head (~49px tall) without covering the face
      const [sx, sy] = camera.worldToScreen(wx, wy - 52 + bob);

      if (emp.bubbleIcon || emp.bubbleText) {
        const text = emp.bubbleIcon ? `${emp.bubbleIcon}${emp.bubbleText ? ` ${emp.bubbleText}` : ""}` : (emp.bubbleText ?? "");
        const trimmed = text.length > 22 ? `${text.slice(0, 20)}..` : text;
        ctx.font = `600 ${Math.max(10, 5 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const hasStatusDot = emp.record.visualState === "working" || emp.record.visualState === "teamwork";
        const dotPad = hasStatusDot ? 10 : 0;
        const bw = ctx.measureText(trimmed).width + 10 + dotPad;
        const bh = 18;
        const left = Math.round(sx - bw / 2);
        const top = Math.round(sy - bh);
        ctx.fillStyle = emp.record.toolCategory === "error" ? "#7f1d1d" : "rgba(15, 23, 42, 0.92)";
        ctx.fillRect(left, top, Math.round(bw), bh);
        ctx.strokeStyle =
          emp.record.provider === "claude"
            ? "#d97757"
            : emp.record.provider === "gemini"
              ? "#38bdf8"
              : "#94a3b8";
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, Math.round(bw), bh);
        if (hasStatusDot) {
          ctx.fillStyle = toolGlowColor(emp.record.toolCategory).replace(/0\.\d+\)$/, "1)");
          ctx.fillRect(left + 5, top + 6, 5, 5);
        }
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(trimmed, Math.round(sx + dotPad / 2), Math.round(sy - 5));
      }
    }
    ctx.restore();
  }
}
