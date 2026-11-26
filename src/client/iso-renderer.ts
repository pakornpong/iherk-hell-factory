import {
  buildTilePermissionMap,
  isEdgeDividerAsset,
  RENDER_LAYER,
  RENDER_LAYER_META,
  resolveAssetLayerConfig,
  TILE_PERM_META,
  toTileKey,
  type RenderLayer,
  type TilePermission,
} from "../shared/layers.js";
import {
  AMENITY_THEME_META,
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
import { findBossChair, getCenteredChairTile } from "./chair-alignment.js";
import { getViewDividerSegments, ViewScene } from "./view-scene.js";

export type LayerOverlayMode = "off" | "permissions" | "layers";

export interface DepthRenderItem {
  id: string;
  x: number;
  y: number;
  footprintX: number;
  footprintY: number;
  /** Render elevation layer (1=floor, 2=low/seat, 3=back, 4=character/object/wall, 5=tabletop, 6=foreground, 7=overlay). */
  renderLayer?: RenderLayer;
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
  manualPosition?: boolean;
  tx: number;
  ty: number;
  assetId: string;
  direction: Direction;
  valid: boolean;
  /** Vertical world-pixel lift when previewing a tabletop prop over a desk/table surface. */
  surfaceOffsetY?: number;
  /** When set, previews a square floor-painting brush (1x1, 2x2, or 3x3) on the ground tiles. */
  brushSize?: number;
  /** When true alongside brushSize, previews restoring floor tiles back to default. */
  floorReset?: boolean;
}

export interface ZoneEditorOverlayInput {
  active: boolean;
  startTile: [number, number] | null;
  hoverTile: [number, number] | null;
  draftColor: string;
  draftLabel: string;
  editingZoneId?: string | null;
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
  furnitureHover?: { tool: "move" | "erase"; pick(boxes: ScreenHitBox[]): string | undefined };
  movingFurnitureId?: string | null;
  selectedLayerFurnitureId?: string | null;
  bayPopAnimations?: Map<string, number>; // bayId -> 0..1 progress
  ghost?: DecorateGhostInput | null;
  zoneEditor?: ZoneEditorOverlayInput | null;
  showZones?: boolean;
  layerOverlayMode?: LayerOverlayMode;
  hoverTile?: [number, number] | null;
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
  const layer = new Uint8Array(n);
  const order = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const it = items[i];
    x0[i] = it.x;
    x1[i] = it.x + it.footprintX;
    y0[i] = it.y;
    y1[i] = it.y + it.footprintY;
    // Slight sweep-line margin ensures zero-thickness boundary planes & corner posts
    // are always compared against touching neighbours without widening their occlusion box.
    minSX[i] = it.x - y1[i] - 0.1;
    maxSX[i] = x1[i] - it.y + 0.1;
    dKey[i] = x1[i] + y1[i];
    layer[i] = it.renderLayer ?? RENDER_LAYER.CHARACTER;
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
    const la = layer[i];

    for (let oj = oi + 1; oj < n; oj++) {
      const j = order[oj];
      // Sweep-line early break: all subsequent items start at or past aMaxSX
      if (minSX[j] >= aMaxSX - EPS) break;

      const lb = layer[j];

      // Global floor (layer 1) always draws beneath everything above it;
      // Global overlay (layer 7) always draws above everything beneath it.
      if ((la === RENDER_LAYER.FLOOR && lb > RENDER_LAYER.FLOOR) || (lb === RENDER_LAYER.OVERLAY && la < RENDER_LAYER.OVERLAY)) {
        adj[i].push(j);
        inDeg[j]++;
        continue;
      }
      if ((lb === RENDER_LAYER.FLOOR && la > RENDER_LAYER.FLOOR) || (la === RENDER_LAYER.OVERLAY && lb < RENDER_LAYER.OVERLAY)) {
        adj[j].push(i);
        inDeg[i]++;
        continue;
      }

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
        // Overlapping footprints: explicit renderLayer resolves vertical stacking deterministically
        // (e.g. chair seat L2 -> seated character L4 -> chair backrest L6, or desk L4 -> tabletop L5).
        if (la < lb) {
          adj[i].push(j);
          inDeg[j]++;
        } else if (lb < la) {
          adj[j].push(i);
          inDeg[i]++;
        } else {
          // Same layer fallback: an occupant fully inside another item's footprint draws after it.
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
  }

  const compareIdx = (ia: number, ib: number): number => {
    const la = layer[ia];
    const lb = layer[ib];
    if (la === RENDER_LAYER.FLOOR && lb !== RENDER_LAYER.FLOOR) return -1;
    if (lb === RENDER_LAYER.FLOOR && la !== RENDER_LAYER.FLOOR) return 1;
    if (la === RENDER_LAYER.OVERLAY && lb !== RENDER_LAYER.OVERLAY) return 1;
    if (lb === RENDER_LAYER.OVERLAY && la !== RENDER_LAYER.OVERLAY) return -1;
    const dk = dKey[ia] - dKey[ib];
    if (Math.abs(dk) > EPS) return dk;
    if (la !== lb) return la - lb;
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

/** Exact geometric center (in world pixels) of a zone's isometric floor diamond. */
export function getZoneCenterWorld(z: {
  originX: number;
  originY: number;
  width: number;
  height: number;
}): [number, number] {
  const [wx, wy] = toAnchorWorld(z.originX + (z.width - 1) / 2, z.originY + (z.height - 1) / 2, 1, 1);
  return [wx, wy - STEP_Y];
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

  private readonly viewScene = new ViewScene();
  private chairAlignmentCampus?: ComputedCampus;
  private readonly chairAlignment = new Map<string, [number, number]>();

  private updateChairAlignment(campus: ComputedCampus): void {
    if (this.chairAlignmentCampus === campus) return;
    this.chairAlignmentCampus = campus;
    this.chairAlignment.clear();
    for (const chair of campus.worldFurniture) {
      if (chair.assetId !== "chair-office-swivel" || chair.manualPosition) continue;
      const position = getCenteredChairTile(campus, chair.tx, chair.ty, chair.direction, chair.id);
      if (position[0] !== chair.tx || position[1] !== chair.ty) this.chairAlignment.set(chair.id, position);
    }
  }

  render(ctx: CanvasRenderingContext2D, scene: RenderSceneInput): void {
    const bossChairId = findBossChair(scene.campus)?.id;
    const input = this.viewScene.project(scene);
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
          kind: "foreground";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          assetId: string;
        })
      | (DepthRenderItem & {
          kind: "employee";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          emp: RenderedEmployeeInput;
          occludedBackGlow?: boolean;
        });

    this.updateChairAlignment(scene.campus);
    const chairAlignmentByTile = new Map<string, { position: [number, number]; direction: Direction }>();
    const furnitureTile = (item: ComputedCampus["worldFurniture"][number]): [number, number] => {
      const centered = this.chairAlignment.get(item.id);
      return centered ? camera.view.toView(...centered) : [item.tx, item.ty];
    };
    const seatedChairTile = (emp: RenderedEmployeeInput): [number, number] => {
      const seat = emp.clipName.startsWith("sit_") && chairAlignmentByTile.get(toTileKey(emp.x, emp.y));
      return seat && seat.direction === emp.direction ? seat.position : [emp.x, emp.y];
    };

    const unified: UnifiedItem[] = [];
    // Track split-layer foreground attachments (e.g. rear-facing swivel chair backrests,
    // 1x2 closed hypersleep canopies) so they participate natively in the unified depth sort at RENDER_LAYER.FOREGROUND (6).
    type ForegroundAttach = {
      assetId: string;
      direction: Direction;
      originTx: number;
      originTy: number;
      footprintX: number;
      footprintY: number;
    };
    const foregroundAttachByTile = new Map<string, ForegroundAttach>();

    for (const f of campus.worldFurniture) {
      const [drawTx, drawTy] = furnitureTile(f);
      if (drawTx !== f.tx || drawTy !== f.ty) {
        chairAlignmentByTile.set(toTileKey(f.tx, f.ty), { position: [drawTx, drawTy], direction: f.direction });
      }
      const cfg = resolveAssetLayerConfig(f.assetId, f.layer, input.catalogById?.get(f.assetId));
      const frameName = animFrameForAsset(f.assetId);
      const sprite = atlas.getFrame(theme, f.assetId, f.direction, frameName);
      if (cfg.foregroundAssetId && (!cfg.foregroundDirections || cfg.foregroundDirections.includes(f.direction))) {
        const fw = sprite?.footprintTiles[0] ?? f.footprintTiles[0] ?? 1;
        const fd = sprite?.footprintTiles[1] ?? f.footprintTiles[1] ?? 1;
        const attach: ForegroundAttach = {
          assetId: cfg.foregroundAssetId,
          direction: f.direction,
          originTx: drawTx,
          originTy: drawTy,
          footprintX: fw,
          footprintY: fd,
        };
        for (let dy = 0; dy < fd; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            foregroundAttachByTile.set(toTileKey(f.tx + dx, f.ty + dy), attach);
          }
        }
      }
      if (isEdgeDividerAsset(f.assetId)) {
        // Render user-placed glass partitions on the exact tile boundary line (zero-thickness depth plane)
        // so furniture on BOTH sides sits 100% flush with zero half-tile gap and exact depth sorting!
        const segs = getViewDividerSegments(f.assetId, f.tx, f.ty, f.direction, camera.view);
        segs.forEach((seg, idx) => {
          const segSprite = atlas.getFrame(theme, seg.assetId, seg.direction, animFrameForAsset(seg.assetId));
          if (!segSprite) return;
          const [swx, swy] = toAnchorWorld(seg.rx, seg.ry, segSprite.footprintTiles[0], segSprite.footprintTiles[1]);
          if (!isInWorldBounds(swx, swy, bounds)) return;
          const alongY = seg.axis === "y";
          const alongX = seg.axis === "x";
          unified.push({
            id: `f:${f.id}:e${idx}`,
            kind: "furniture",
            x: alongX ? seg.rx : seg.rx + 0.5,
            y: alongY ? seg.ry : seg.ry + 0.5,
            footprintX: alongX ? segSprite.footprintTiles[0] : 0,
            footprintY: alongY ? segSprite.footprintTiles[1] : 0,
            renderLayer: f.renderLayer ?? RENDER_LAYER.CHARACTER,
            sprite: segSprite,
            wx: swx,
            wy: swy,
            zoneId: f.zoneId,
            assetId: seg.assetId,
            furnitureId: f.id,
          });
        });
        continue;
      }
      if (!sprite) continue;
      const [wx, rawWy] = toAnchorWorld(drawTx, drawTy, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      const wy = rawWy - (f.surfaceOffsetY ?? 0);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      unified.push({
        id: `f:${f.id}`,
        kind: "furniture",
        x: drawTx,
        y: drawTy,
        footprintX: sprite.footprintTiles[0],
        footprintY: sprite.footprintTiles[1],
        renderLayer: f.renderLayer ?? cfg.renderLayer,
        sprite,
        wx,
        wy,
        zoneId: f.zoneId,
        assetId: f.assetId,
        furnitureId: f.id,
      });
    }

    // Room walls stand on the exact boundary line between two tiles, so they use zero-thickness planes
    // on the line (footprintY = 0 along x, footprintX = 0 along y, 0x0 for corner posts).
    // Skip `ef:*` segments already emitted from worldFurniture above so Move dimming & hitBoxes stay intact.
    for (const w of campus.wallSegments ?? []) {
      if (w.id.startsWith("ef:")) continue;
      const sprite = atlas.getFrame(theme, w.assetId, w.direction, animFrameForAsset(w.assetId));
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(w.rx, w.ry, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const alongY = w.axis === "y";
      const alongX = w.axis === "x";
      unified.push({
        id: `w:${w.id}`,
        kind: "furniture",
        x: alongX ? w.rx : w.rx + 0.5,
        y: alongY ? w.ry : w.ry + 0.5,
        footprintX: alongX ? sprite.footprintTiles[0] : 0,
        footprintY: alongY ? sprite.footprintTiles[1] : 0,
        renderLayer: RENDER_LAYER.CHARACTER,
        sprite,
        wx,
        wy,
        zoneId: "",
        assetId: w.assetId,
        furnitureId: w.id,
      });
    }


    // Boss avatar seated permanently at Boss executive chair (follows the chair anywhere on campus + rotates with it)
    const bossZone = campus.zones.find((z) => z.kind === "boss");
    const bossChair = bossChairId ? campus.worldFurniture.find((item) => item.id === bossChairId) : undefined;
    if (bossZone || bossChair) {
      const [bx, by] = bossChair
        ? furnitureTile(bossChair)
        : [(bossZone?.originX ?? 0) + 2, (bossZone?.originY ?? 0) + 1];
      const bossDir: Direction = bossChair?.direction ?? "se";
      const hasVisitor = employees.some(
        (e) => e.record.visualState === "reporting" || e.record.visualState === "assigning",
      );
      const bossClip = `sit_type_${Math.floor(timeMs / (hasVisitor ? 300 : 750)) % 2}`;
      const bossSprite =
        atlas.getFrame(theme, "agent-boss", bossDir, bossClip) ??
        atlas.getFrame(theme, "agent-starter", bossDir, bossClip);
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
            renderLayer: RENDER_LAYER.CHARACTER,
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
              direction: bossDir,
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
      const seatTx = Math.round(emp.x);
      const seatTy = Math.round(emp.y);
      const isSleepingClip = emp.clipName.startsWith("rest_sleep_");
      const isSeatedClip = emp.clipName.startsWith("sit_") || isSleepingClip;
      const fgAttach = isSeatedClip ? foregroundAttachByTile.get(toTileKey(seatTx, seatTy)) : undefined;
      const hasFgOverlay = Boolean(fgAttach && fgAttach.direction === emp.direction);
      const isMultiTilePod = Boolean(
        hasFgOverlay && fgAttach && isSleepingClip && (fgAttach.footprintX > 1 || fgAttach.footprintY > 1),
      );

      // Center lying-down sleeping agents cleanly on the mattress of a 1x2 hypersleep pod
      const [drawTileX, drawTileY] = isMultiTilePod && fgAttach
        ? [fgAttach.originTx + (fgAttach.footprintX - 1) / 2, fgAttach.originTy + (fgAttach.footprintY - 1) / 2]
        : seatedChairTile(emp);
      const [wx, wy] = toAnchorWorld(drawTileX, drawTileY, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;

      unified.push({
        id: `e:${emp.record.id}`,
        kind: "employee",
        x: drawTileX + 0.2,
        y: drawTileY + 0.2,
        footprintX: 0.6,
        footprintY: 0.6,
        renderLayer: RENDER_LAYER.CHARACTER,
        sprite,
        wx,
        wy,
        emp,
        occludedBackGlow: hasFgOverlay,
      });

      if (hasFgOverlay && fgAttach) {
        const fgSprite = atlas.getFrame(theme, fgAttach.assetId, fgAttach.direction, "default");
        if (fgSprite) {
          const fw = fgSprite.footprintTiles[0] ?? fgAttach.footprintX;
          const fd = fgSprite.footprintTiles[1] ?? fgAttach.footprintY;
          const [cwx, cwy] = toAnchorWorld(fgAttach.originTx, fgAttach.originTy, fw, fd);
          unified.push({
            id: `fg:${emp.record.id}:${fgAttach.assetId}`,
            kind: "foreground",
            x: fgAttach.originTx,
            y: fgAttach.originTy,
            footprintX: fw,
            footprintY: fd,
            renderLayer: RENDER_LAYER.FOREGROUND,
            sprite: fgSprite,
            wx: cwx,
            wy: cwy,
            assetId: fgAttach.assetId,
          });
        }
      }
    }

    const sorted = sortUnifiedIsoEntities(unified);
    const hitBoxes: ScreenHitBox[] = [];
    const emissiveDraws: Array<{ sprite: ResolvedSpriteFrame; wx: number; wy: number; pop: number }> = [];

    for (const item of sorted) {
      if (item.kind === "furniture") {
        const bayId = item.zoneId.startsWith("bay:") ? item.zoneId.slice(4) : undefined;
        const pop = bayId && input.bayPopAnimations?.has(bayId) ? input.bayPopAnimations.get(bayId)! : 1;
        const isBeingMoved = Boolean(input.movingFurnitureId && item.furnitureId === input.movingFurnitureId);
        const box = drawSprite(item.sprite, item.wx, item.wy, {
          popScaleY: pop,
          ...(isBeingMoved ? { alpha: 0.35 } : {}),
        });
        hitBoxes.push({ kind: "furniture", id: item.furnitureId, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        if (item.sprite.emissiveImage && !isBeingMoved) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop });
        }
      } else if (item.kind === "foreground") {
        drawSprite(item.sprite, item.wx, item.wy);
        if (item.sprite.emissiveImage) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop: 1 });
        }
      } else {
        const box = drawSprite(item.sprite, item.wx, item.wy);
        hitBoxes.push({ kind: "employee", id: item.emp.record.id, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        if (item.sprite.emissiveImage && !item.occludedBackGlow) {
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

    const hoverId = input.furnitureHover?.pick(hitBoxes);
    const hoveredBoxes = hoverId ? hitBoxes.filter((box) => box.kind === "furniture" && box.id === hoverId) : [];
    if (hoveredBoxes.length) {
      const left = Math.min(...hoveredBoxes.map((box) => box.x)) - 2;
      const top = Math.min(...hoveredBoxes.map((box) => box.y)) - 2;
      const right = Math.max(...hoveredBoxes.map((box) => box.x + box.w)) + 2;
      const bottom = Math.max(...hoveredBoxes.map((box) => box.y + box.h)) + 2;
      ctx.save();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 4;
      ctx.strokeRect(left, top, right - left, bottom - top);
      ctx.strokeStyle = input.furnitureHover?.tool === "erase" ? "#fb7185" : "#38bdf8";
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, right - left, bottom - top);
      ctx.restore();
    }

    // 5. Decorate Mode Ghost Preview (supports floor brushes, animated props, tabletop surface lift & exact footprint tiles)
    if (ghost) {
      if (ghost.brushSize && ghost.brushSize >= 1) {
        const floorSprite = ghost.floorReset ? null : atlas.getFrame(theme, ghost.assetId, ghost.direction, "default");
        ctx.save();
        ctx.fillStyle = ghost.floorReset
          ? "rgba(245, 158, 11, 0.28)"
          : ghost.valid
            ? "rgba(56, 189, 248, 0.22)"
            : "rgba(239, 68, 68, 0.28)";
        ctx.strokeStyle = ghost.floorReset ? "#f59e0b" : ghost.valid ? "#38bdf8" : "#ef4444";
        ctx.lineWidth = Math.max(1.5, zoom);
        for (let dy = 0; dy < ghost.brushSize; dy++) {
          for (let dx = 0; dx < ghost.brushSize; dx++) {
            const gx = ghost.tx + dx;
            const gy = ghost.ty + dy;
            if (gx < 0 || gy < 0 || gx >= campus.widthTiles || gy >= campus.depthTiles) continue;
            const [twx, twy] = toAnchorWorld(gx, gy, 1, 1);
            if (floorSprite) {
              drawSprite(floorSprite, twx, twy, { alpha: 0.78 });
            }
            const [topX, topY] = camera.worldToScreen(twx, twy - STEP_Y * 2);
            const [rightX, rightY] = camera.worldToScreen(twx + STEP_X, twy - STEP_Y);
            const [botX, botY] = camera.worldToScreen(twx, twy);
            const [leftX, leftY] = camera.worldToScreen(twx - STEP_X, twy - STEP_Y);
            ctx.beginPath();
            ctx.moveTo(topX, topY);
            ctx.lineTo(rightX, rightY);
            ctx.lineTo(botX, botY);
            ctx.lineTo(leftX, leftY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (isEdgeDividerAsset(ghost.assetId)) {
        // Preview edge-mounted glass partition(s) right on the exact tile boundary line(s)
        const segs = getViewDividerSegments(ghost.assetId, ghost.tx, ghost.ty, ghost.direction, camera.view);
        ctx.save();
        ctx.strokeStyle = ghost.valid ? "#22c55e" : "#ef4444";
        ctx.lineWidth = Math.max(2.5, zoom * 1.5);
        for (const seg of segs) {
          const alongX = seg.axis === "x";
          const x0 = alongX ? seg.rx : seg.rx + 0.5;
          const y0 = alongX ? seg.ry + 0.5 : seg.ry;
          const x1 = alongX ? x0 + 1 : x0;
          const y1 = alongX ? y0 : y0 + 1;
          // Convert tile-corner (x, y) to world pixels: ((x - y) * STEP_X, (x + y) * STEP_Y - STEP_Y * 2)
          const [sx0, sy0] = camera.worldToScreen((x0 - y0) * STEP_X, (x0 + y0) * STEP_Y - STEP_Y * 2);
          const [sx1, sy1] = camera.worldToScreen((x1 - y1) * STEP_X, (x1 + y1) * STEP_Y - STEP_Y * 2);
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
          const segSprite = atlas.getFrame(theme, seg.assetId, seg.direction, "default");
          if (segSprite) {
            const [swx, swy] = toAnchorWorld(seg.rx, seg.ry, segSprite.footprintTiles[0], segSprite.footprintTiles[1]);
            drawSprite(segSprite, swx, swy, { alpha: 0.72 });
          }
        }
        ctx.restore();
      } else {
        const sprite =
          atlas.getFrame(theme, ghost.assetId, ghost.direction, animFrameForAsset(ghost.assetId)) ??
          atlas.getFrame(theme, ghost.assetId, ghost.direction, "default");
        const [fw, fd] = sprite?.footprintTiles ?? [1, 1];
        const liftY = ghost.surfaceOffsetY ?? 0;
        const [ghostX, ghostY] = scene.ghost?.assetId === "chair-office-swivel" && !scene.ghost.manualPosition
          ? camera.view.toView(...getCenteredChairTile(
            scene.campus, scene.ghost.tx, scene.ghost.ty, scene.ghost.direction, scene.movingFurnitureId ?? undefined,
          ))
          : [ghost.tx, ghost.ty];
        ctx.save();
        ctx.fillStyle = ghost.valid ? "rgba(34, 197, 94, 0.24)" : "rgba(239, 68, 68, 0.28)";
        ctx.strokeStyle = ghost.valid ? "#22c55e" : "#ef4444";
        ctx.lineWidth = Math.max(1.5, zoom);
        for (let dy = 0; dy < fd; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const [twx, rawTwy] = toAnchorWorld(ghostX + dx, ghostY + dy, 1, 1);
            const twy = rawTwy - liftY;
            const [topX, topY] = camera.worldToScreen(twx, twy - STEP_Y * 2);
            const [rightX, rightY] = camera.worldToScreen(twx + STEP_X, twy - STEP_Y);
            const [botX, botY] = camera.worldToScreen(twx, twy);
            const [leftX, leftY] = camera.worldToScreen(twx - STEP_X, twy - STEP_Y);
            ctx.beginPath();
            ctx.moveTo(topX, topY);
            ctx.lineTo(rightX, rightY);
            ctx.lineTo(botX, botY);
            ctx.lineTo(leftX, leftY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
        if (sprite) {
          const [wx, rawWy] = toAnchorWorld(ghostX, ghostY, sprite.footprintTiles[0], sprite.footprintTiles[1]);
          drawSprite(sprite, wx, rawWy - liftY, { alpha: 0.75 });
        }
      }
    }

    // 5b. Custom Zone Editor Overlay (highlight existing custom zones + live 2-click rectangle draft)
    const drawIsoRectOutline = (rx: number, ry: number, rw: number, rh: number, color: string, fillAlpha: number, dashed = false) => {
      const [topWx, topWy] = toAnchorWorld(rx, ry, 1, 1);
      const [rightWx, rightWy] = toAnchorWorld(rx + rw - 1, ry, 1, 1);
      const [botWx, botWy] = toAnchorWorld(rx + rw - 1, ry + rh - 1, 1, 1);
      const [leftWx, leftWy] = toAnchorWorld(rx, ry + rh - 1, 1, 1);
      const [p0x, p0y] = camera.worldToScreen(topWx, topWy - STEP_Y * 2);
      const [p1x, p1y] = camera.worldToScreen(rightWx + STEP_X, rightWy - STEP_Y);
      const [p2x, p2y] = camera.worldToScreen(botWx, botWy);
      const [p3x, p3y] = camera.worldToScreen(leftWx - STEP_X, leftWy - STEP_Y);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.closePath();
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, zoom * 1.2);
      if (dashed) ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    };

    const customZones = state.customZones ?? [];
    const showZoneOverlays = input.showZones !== false || Boolean(input.zoneEditor?.active);
    if (input.zoneEditor?.active) {
      for (const cz of customZones) {
        const isEditing = input.zoneEditor.editingZoneId === cz.id;
        drawIsoRectOutline(cz.x, cz.y, cz.width, cz.height, cz.color, isEditing ? 0.30 : 0.16, false);
      }
      const ze = input.zoneEditor;
      const h = ze.hoverTile;
      if (h && h[0] >= 0 && h[1] >= 0 && h[0] < campus.widthTiles && h[1] < campus.depthTiles) {
        const s = ze.startTile ?? h;
        const x0 = Math.min(s[0], h[0]);
        const y0 = Math.min(s[1], h[1]);
        const w = Math.abs(h[0] - s[0]) + 1;
        const hh = Math.abs(h[1] - s[1]) + 1;
        drawIsoRectOutline(x0, y0, w, hh, ze.draftColor, 0.24, true);
        const [cwx, cwy] = getZoneCenterWorld({ originX: x0, originY: y0, width: w, height: hh });
        const [csx, csy] = camera.worldToScreen(cwx, cwy);
        ctx.save();
        ctx.font = `bold ${Math.max(10, 6 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = "center";
        const [draftWidth, draftHeight] = camera.view.swapsAxes ? [hh, w] : [w, hh];
        const previewText = `${ze.draftLabel} (${draftWidth}×${draftHeight})`;
        const tw = ctx.measureText(previewText).width + 14;
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.fillRect(Math.round(csx - tw / 2), Math.round(csy - 10), Math.round(tw), 20);
        ctx.strokeStyle = ze.draftColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(Math.round(csx - tw / 2), Math.round(csy - 10), Math.round(tw), 20);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(previewText, Math.round(csx), Math.round(csy + 4));
        ctx.restore();
      }
    } else if (showZoneOverlays) {
      for (const cz of customZones) {
        drawIsoRectOutline(cz.x, cz.y, cz.width, cz.height, cz.color, 0.05, true);
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

    // 7. Zone Nameplates & Employee Speech/Tool Bubbles
    const bayById = new Map(state.bays.map((b) => [b.id, b]));
    const allPods = campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    const totalPods = allPods.length;
    const hasCustomHypersleepZone = customZones.some((cz) => cz.role === "hypersleep");
    const sleepingCount = employees.filter((e) => e.record.visualState === "resting").length;
    ctx.save();
    ctx.font = `bold ${Math.max(10, 6 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";

    for (const z of showZoneOverlays ? campus.zones : []) {
      // Skip blank floor and Boss zone (Boss already has the live 👑 BOSS badge above his chair)
      if (z.kind === "floor" || z.kind === "boss") continue;
      // Skip default built-in Hypersleep nameplate when user defined their own editable Pods Zone
      if (z.kind === "hypersleep" && hasCustomHypersleepZone) continue;

      let centerZone: { originX: number; originY: number; width: number; height: number } = z;
      if (z.kind === "hypersleep" && allPods.length > 0) {
        const minX = Math.min(...allPods.map((p) => p.tx));
        const minY = Math.min(...allPods.map((p) => p.ty));
        const maxX = Math.max(...allPods.map((p) => p.tx + p.footprintTiles[0]));
        const maxY = Math.max(...allPods.map((p) => p.ty + p.footprintTiles[1]));
        centerZone = { originX: minX, originY: minY, width: maxX - minX, height: maxY - minY };
      }

      const [wx, wy] = getZoneCenterWorld(centerZone);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = camera.worldToScreen(wx, wy);
      const bay = z.bayId ? bayById.get(z.bayId) : undefined;

      const label =
        z.kind === "cowork"
          ? "💻 CENTRAL WORK HUB"
          : z.kind === "hypersleep"
            ? `🧊 HYPERSLEEP BAY · ${sleepingCount}/${totalPods}`
            : z.kind === "common"
              ? `LOUNGE & MEETING · #${z.zoneId.split(":")[1] ?? "0"}`
              : z.kind === "amenity" && z.amenityTheme
                ? `${AMENITY_THEME_META[z.amenityTheme].icon} ${AMENITY_THEME_META[z.amenityTheme].label}`
                : bay?.displayName ?? z.zoneId;
      const activeTeamCount = z.bayId
        ? employees.filter(
            (e) =>
              e.record.bayId === z.bayId &&
              (e.record.visualState === "working" || e.record.visualState === "teamwork"),
          ).length
        : 0;
      const fullLabel = activeTeamCount >= 2 ? `${label} · TEAM` : label;
      const textW = ctx.measureText(fullLabel).width + 14;
      const borderColor =
        z.kind === "cowork"
          ? "#38bdf8"
          : z.kind === "hypersleep"
            ? "#22d3ee"
            : z.amenityTheme
              ? AMENITY_THEME_META[z.amenityTheme].color
              : bay?.accentColor ?? "#64748b";
      const boxX = Math.round(sx - textW / 2);
      const boxY = Math.round(sy - 9);
      ctx.fillStyle = theme === "day" ? "rgba(15, 23, 42, 0.84)" : "rgba(15, 23, 42, 0.90)";
      ctx.fillRect(boxX, boxY, Math.round(textW), 18);
      if (bay) {
        ctx.fillStyle = bay.accentColor;
        ctx.fillRect(boxX, boxY, 4, 18);
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = z.kind === "hypersleep" ? 1.5 : 1;
      ctx.strokeRect(boxX, boxY, Math.round(textW), 18);
      ctx.fillStyle = z.kind === "hypersleep" ? "#a5f3fc" : "#f8fafc";
      ctx.fillText(fullLabel, Math.round(sx + (bay ? 2 : 0)), Math.round(sy + 4));
    }

    // User-defined Custom Zone centered nameplates
    for (const cz of showZoneOverlays ? customZones : []) {
      const [wx, wy] = getZoneCenterWorld({ originX: cz.x, originY: cz.y, width: cz.width, height: cz.height });
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = camera.worldToScreen(wx, wy);
      const roleSuffix =
        cz.role === "work"
          ? " · WORK"
          : cz.role === "meeting"
            ? " · MEETING"
            : cz.role === "hypersleep"
              ? ` · ${sleepingCount}/${totalPods}`
              : "";
      const fullLabel = `${cz.icon} ${cz.name}${roleSuffix}`;
      const textW = ctx.measureText(fullLabel).width + 14;
      const boxX = Math.round(sx - textW / 2);
      const boxY = Math.round(sy - 9);
      ctx.fillStyle = theme === "day" ? "rgba(15, 23, 42, 0.86)" : "rgba(15, 23, 42, 0.92)";
      ctx.fillRect(boxX, boxY, Math.round(textW), 18);
      ctx.fillStyle = cz.color;
      ctx.fillRect(boxX, boxY, 4, 18);
      ctx.strokeStyle = cz.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, Math.round(textW), 18);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(fullLabel, Math.round(sx + 2), Math.round(sy + 4));
    }

    // Floating 👑 BOSS badge above Boss avatar (follows Boss chair anywhere on campus)
    if (bossZone || bossChair) {
      const [bx, by] = bossChair
        ? furnitureTile(bossChair)
        : [(bossZone?.originX ?? 0) + 2, (bossZone?.originY ?? 0) + 1];
      const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
      if (isInWorldBounds(wx, wy, bounds)) {
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
      const isSleepingClip = emp.clipName.startsWith("rest_sleep_");
      const fgAttach = isSleepingClip
        ? foregroundAttachByTile.get(toTileKey(Math.round(emp.x), Math.round(emp.y)))
        : undefined;
      const isInMultiPod = Boolean(
        fgAttach && fgAttach.direction === emp.direction && (fgAttach.footprintX > 1 || fgAttach.footprintY > 1),
      );
      const [bx, by] = isInMultiPod && fgAttach
        ? [fgAttach.originTx + (fgAttach.footprintX - 1) / 2, fgAttach.originTy + (fgAttach.footprintY - 1) / 2]
        : seatedChairTile(emp);
      const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const bob = Math.sin(timeMs / 400 + emp.x) * 1.5;
      const [sx, sy] = camera.worldToScreen(wx, wy - (isInMultiPod ? 32 : 52) + bob);

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

    // 8. Pokémon GBA-style Movement Permission / Render Layer Overlay
    if (input.layerOverlayMode && input.layerOverlayMode !== "off") {
      this.drawLayerOverlay(ctx, input, sorted, bounds);
    }
  }

  private drawLayerOverlay(
    ctx: CanvasRenderingContext2D,
    input: RenderSceneInput,
    sortedEntities: Array<{
      kind: "furniture" | "foreground" | "employee";
      furnitureId?: string;
      x: number;
      y: number;
      footprintX: number;
      footprintY: number;
      renderLayer?: RenderLayer;
      wx: number;
      wy: number;
    }>,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    const { campus, state, camera, layerOverlayMode, hoverTile } = input;
    const zoom = camera.zoom;
    const overrides = state.tilePermissionOverrides ?? {};
    const permMap = buildTilePermissionMap(campus, overrides, input.catalogById);
    const width = permMap.width;
    const height = permMap.height;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw isometric tile diamonds + permission codes (0=blocked, 1=walkable, 2=seat, 3=door)
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const [wx, wy] = toAnchorWorld(tx, ty, 1, 1);
        if (!isInWorldBounds(wx, wy, bounds)) continue;

        const idx = ty * width + tx;
        const perm = (campus.tilePermissions?.[idx] ?? permMap.permissions[idx] ?? 1) as TilePermission;
        const meta = TILE_PERM_META[perm] ?? TILE_PERM_META[1];
        const isOverridden = Object.prototype.hasOwnProperty.call(overrides, toTileKey(tx, ty));
        const isHovered = Boolean(hoverTile && hoverTile[0] === tx && hoverTile[1] === ty);

        const [topX, topY] = camera.worldToScreen(wx, wy - STEP_Y * 2);
        const [rightX, rightY] = camera.worldToScreen(wx + STEP_X, wy - STEP_Y);
        const [botX, botY] = camera.worldToScreen(wx, wy);
        const [leftX, leftY] = camera.worldToScreen(wx - STEP_X, wy - STEP_Y);
        const [cx, cy] = camera.worldToScreen(wx, wy - STEP_Y);

        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(rightX, rightY);
        ctx.lineTo(botX, botY);
        ctx.lineTo(leftX, leftY);
        ctx.closePath();

        if (layerOverlayMode === "permissions") {
          ctx.fillStyle = meta.fillRgba;
          ctx.fill();
          ctx.strokeStyle = isHovered
            ? "#ffffff"
            : isOverridden
              ? "#f8fafc"
              : "rgba(15, 23, 42, 0.45)";
          ctx.lineWidth = isHovered ? Math.max(2, zoom) : isOverridden ? Math.max(1.5, zoom * 0.75) : 1;
          ctx.stroke();

          if (zoom >= 1) {
            ctx.font = `700 ${Math.max(10, 7 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
            ctx.fillText(meta.shortLabel, cx + 1, cy + 1);
            ctx.fillStyle = meta.color;
            ctx.fillText(meta.shortLabel, cx, cy);
          }
        } else {
          // "layers" mode: subtle tile grid with hover highlight
          ctx.strokeStyle = isHovered ? "#38bdf8" : "rgba(148, 163, 184, 0.25)";
          ctx.lineWidth = isHovered ? Math.max(2, zoom) : 1;
          ctx.stroke();
        }

        // Draw boundary-line walls along blockedW (top->left) and blockedN (top->right)
        if (permMap.blockedW[idx]) {
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.lineTo(leftX, leftY);
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = Math.max(2.5, 1.5 * zoom);
          ctx.stroke();
        }
        if (permMap.blockedN[idx]) {
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.lineTo(rightX, rightY);
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = Math.max(2.5, 1.5 * zoom);
          ctx.stroke();
        }
      }
    }

    // In "layers" mode, draw elevation badges (L1..L7) on visible furniture, foreground & characters
    if (layerOverlayMode === "layers") {
      ctx.font = `700 ${Math.max(9, 5 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      for (const item of sortedEntities) {
        const layer = (item.renderLayer ?? RENDER_LAYER.CHARACTER) as RenderLayer;
        const meta = RENDER_LAYER_META[layer] ?? RENDER_LAYER_META[RENDER_LAYER.CHARACTER];
        const isSelected = Boolean(
          input.selectedLayerFurnitureId && item.furnitureId === input.selectedLayerFurnitureId,
        );
        const label = item.kind === "employee" ? `👤${layer}` : isSelected ? `★${meta.badge}` : meta.badge;
        const yLift = item.kind === "employee" ? 26 : item.kind === "foreground" ? 18 : 12;
        const [sx, sy] = camera.worldToScreen(item.wx, item.wy - yLift);
        const bw = ctx.measureText(label).width + 8;
        const bh = Math.max(14, 7 * zoom);
        ctx.fillStyle = isSelected ? "#0284c7" : "rgba(15, 23, 42, 0.88)";
        ctx.fillRect(Math.round(sx - bw / 2), Math.round(sy - bh / 2), Math.round(bw), Math.round(bh));
        ctx.strokeStyle = isSelected ? "#ffffff" : meta.color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(Math.round(sx - bw / 2), Math.round(sy - bh / 2), Math.round(bw), Math.round(bh));
        ctx.fillStyle = isSelected ? "#ffffff" : meta.color;
        ctx.fillText(label, Math.round(sx), Math.round(sy));
      }
    }

    ctx.restore();
  }
}
