import {
  buildTilePermissionMap,
  expandEdgeDividerSegments,
  isEdgeDividerAsset,
  isSurfaceHostAsset,
  isTabletopAsset,
  isWalkablePermission,
  RENDER_LAYER,
  resolveAssetLayerConfig,
  surfaceVoxelsToWorldOffsetY,
  type TilePermission,
} from "../shared/layers.js";
import {
  AMENITY_THEME_ORDER,
  type AmenityThemeId,
  type BossOfficeRecord,
  type CatalogEntry,
  type CommonWingRecord,
  type ComputedCampus,
  type DepartmentId,
  type Direction,
  type FurnitureInstance,
  type ProjectBayRecord,
  type ThemeMode,
  type TilePermissionValue,
  type WorldFurnitureInstance,
  type ZoneBounds,
  type ZoneId,
} from "../shared/types.js";
import { bayLayoutKey, bayLayoutKeyForBay, commonLayoutKey, getRoomLayout, toFurniture } from "../shared/room-layouts.js";

export const ZONE_SIZE = 6;
/** Rooms inside the same functional zone sit flush and share boundary-line walls. */
export const IN_ZONE_GAP = 0;
/** Walkway corridor width (kept exported for compatibility). */
export const ZONE_GAP = 0;
/** 6-tile room pitch. */
export const MODULE_PITCH_X = ZONE_SIZE + IN_ZONE_GAP;
export const MODULE_PITCH_Y = MODULE_PITCH_X;
/** Fixed slot of the Central Work Hub right next to Boss. */
export const COWORK_SLOT = { col: 1, row: 0 } as const;
/** Open sandbox floor defaults and expansion step. */
export const DEFAULT_FLOOR_WIDTH = 24;
export const DEFAULT_FLOOR_DEPTH = 24;
export const FLOOR_EXPAND_STEP = 6;
export const MIN_FLOOR_SIDE = 12;
export const MAX_FLOOR_SIDE = 96;
/** Hypersleep Bay top-left tile origin. */
export const HYPERSLEEP_ORIGIN = { x: 13, y: 1 } as const;

/** Square campus side length for a grid of `gridSide` x `gridSide` room slots. */
export function campusSideTiles(gridSide: number): number {
  return (gridSide - 1) * MODULE_PITCH_X + ZONE_SIZE;
}

/** True when the local offset inside a module (tx % pitch) is a room wall or corridor, not room floor. */
export function isOutsideRoomOffset(offset: number): boolean {
  return offset >= ZONE_SIZE;
}
export const BAYS_PER_ROW = 3; // kept exported for compatibility
/** Minimum themed amenity rooms shown; if the outer ring has fewer free slots, one more ring is opened. */
export const MIN_AMENITY_ROOMS = 4;

export function getRotatedFootprint(
  base: [number, number],
  direction: Direction,
): [number, number] {
  if (direction === "sw" || direction === "ne") {
    return [base[1], base[0]];
  }
  return [base[0], base[1]];
}

export function createDefaultBossOffice(): BossOfficeRecord {
  return {
    zoneId: "boss:0",
    displayName: "BOSS OFFICE",
    furniture: [
      { id: "boss:0-boss-chair", zoneId: "boss:0", lx: 2, ly: 1, assetId: "chair-office-swivel", direction: "se", layer: "object", placedBy: "system" },
      { id: "boss:0-boss-desk", zoneId: "boss:0", lx: 2, ly: 2, assetId: "desk-dev-dual", direction: "nw", layer: "object", placedBy: "system" },
      { id: "boss:0-boss-lamp", zoneId: "boss:0", lx: 2, ly: 2, assetId: "prop-desk-lamp", direction: "se", layer: "tabletop", surfaceHostId: "boss:0-boss-desk", placedBy: "system" },
      { id: "boss:0-boss-mug", zoneId: "boss:0", lx: 3, ly: 2, assetId: "prop-coffee-mug", direction: "se", layer: "tabletop", surfaceHostId: "boss:0-boss-desk", placedBy: "system" },
      { id: "boss:0-visitor-0", zoneId: "boss:0", lx: 2, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
      { id: "boss:0-visitor-1", zoneId: "boss:0", lx: 3, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    ],
  };
}

/** Auto-generated 1x2 horizontal hypersleep pods: 1 capsule per agent, arranged in rows with 1-tile walking aisles. */
export function createHypersleepFurniture(capsuleCount: number, cols: number): FurnitureInstance[] {
  const count = Math.max(1, capsuleCount);
  const safeCols = Math.max(1, cols);
  const items: FurnitureInstance[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `hypersleep:0-pod-${i}`,
      zoneId: "hypersleep:0",
      lx: i % safeCols,
      ly: Math.floor(i / safeCols) * 3,
      assetId: "hypersleep-capsule",
      direction: "se",
      layer: "object",
      placedBy: "system",
    });
  }
  return items;
}

export function getAmenityTheme(index: number): AmenityThemeId {
  return AMENITY_THEME_ORDER[index % AMENITY_THEME_ORDER.length];
}

/** System-generated (not persisted, not user-editable) furniture for a themed amenity room. */
export function createAmenityFurniture(index: number, theme: AmenityThemeId): FurnitureInstance[] {
  // Repeat visits to the same theme (index >= theme count) get the mirrored layout
  const mirrored = Math.floor(index / AMENITY_THEME_ORDER.length) % 2 === 1;
  return toFurniture(`amenity:${index}`, getRoomLayout(`amenity-${theme}`, mirrored).items);
}

/** Open-plan co-working bench for subagents of every project: face-to-face desk pods, 8 seats. */
export function createCoworkFurniture(): FurnitureInstance[] {
  return toFurniture("cowork:0", getRoomLayout("cowork").items);
}

export function createDefaultCommonWing(row: number): CommonWingRecord {
  const zoneId: ZoneId = `common:${row}`;
  const { key, mirrored } = commonLayoutKey(row);
  return { row, zoneId, furniture: toFurniture(zoneId, getRoomLayout(key, mirrored).items) };
}

function bayLayoutItems(bayId: string, department?: DepartmentId) {
  const { key, mirrored } = department ? bayLayoutKey(department, bayId) : bayLayoutKeyForBay(bayId);
  return getRoomLayout(key, mirrored).items;
}

/** A project's team room: chosen deterministically from the bay id across all designed bay interiors. */
export function createDefaultBayFurniture(bayId: string, department?: DepartmentId): FurnitureInstance[] {
  return toFurniture(`bay:${bayId}`, bayLayoutItems(bayId, department).filter((it) => !it.extra));
}

/** Workstations 3 and 4 of the same layout, added as the team grows (only those not placed yet). */
export function createExtraBayWorkstations(
  bayId: string,
  desiredDeskSlots: number,
  existing: FurnitureInstance[],
  department?: DepartmentId,
): FurnitureInstance[] {
  const zoneId: ZoneId = `bay:${bayId}`;
  const hasId = (id: string) => existing.some((f) => f.id === id);
  const wanted = new Set<string>();
  if (desiredDeskSlots >= 3) wanted.add("desk-2").add("chair-2");
  if (desiredDeskSlots >= 4) wanted.add("desk-3").add("chair-3");
  const extras = bayLayoutItems(bayId, department).filter((it) => it.extra && wanted.has(it.key));
  return toFurniture(zoneId, extras).filter((f) => !hasId(f.id));
}

/**
 * Generates module coordinates (col, row) for square ring `k` in exact visual CLOCKWISE order
 * around the top-most corner (0, 0) in 2:1 isometric view:
 *   (k, 0) [3 o'clock] -> (k, 1) -> ... -> (k, k) [6 o'clock] -> (k-1, k) -> ... -> (0, k) [9 o'clock]
 */
export function getClockwiseRingCoords(ring: number): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (let row = 0; row <= ring; row++) {
    coords.push([ring, row]);
  }
  for (let col = ring - 1; col >= 0; col--) {
    coords.push([col, ring]);
  }
  return coords;
}

export interface CampusLayoutOptions {
  /** Number of active employees -> determines how many hypersleep capsules are spawned (1 per agent). */
  employeeCount?: number;
  /** User-configurable open floor width in tiles (defaults to 24, expandable/shrinkable). */
  floorWidthTiles?: number;
  /** User-configurable open floor depth in tiles (defaults to 24, expandable/shrinkable). */
  floorDepthTiles?: number;
  /** Optional per-tile custom floor asset overrides keyed by "tx,ty". */
  floorTileOverrides?: Record<string, string>;
}

export function computeCampusLayout(
  bays: ProjectBayRecord[],
  _commonWings: CommonWingRecord[],
  catalogById: Map<string, CatalogEntry>,
  bossOffice?: BossOfficeRecord,
  theme: ThemeMode = "office",
  tilePermissionOverrides?: Record<string, TilePermission>,
  zoneOverrides?: Record<string, FurnitureInstance[]>,
  opts?: CampusLayoutOptions,
): ComputedCampus {
  const activeBays = bays.filter((b) => !b.archived);
  const zones: ZoneBounds[] = [];
  const worldFurniture: WorldFurnitureInstance[] = [];

  const placeFurniture = (zone: ZoneBounds, items: FurnitureInstance[]) => {
    const footOf = (item: FurnitureInstance): [number, number] =>
      getRotatedFootprint(
        catalogById.get(item.assetId)?.footprintTiles ??
          (item.assetId === "hypersleep-capsule" ? [1, 2] : [1, 1]),
        item.direction,
      );

    // Track host surface heights in this zone so tabletop props lift automatically to sit on their host
    const surfaceHeightByLocalTile = new Map<string, number>();
    for (const item of items) {
      if (item.layer === "tabletop" || item.layer === "foreground") continue;
      const cfg = resolveAssetLayerConfig(item.assetId, item.layer, catalogById.get(item.assetId));
      if (!cfg.surfaceHeightVoxels) continue;
      const [w, d] = footOf(item);
      for (let yy = 0; yy < d; yy++) {
        for (let xx = 0; xx < w; xx++) {
          surfaceHeightByLocalTile.set(`${item.lx + xx},${item.ly + yy}`, cfg.surfaceHeightVoxels);
        }
      }
    }

    for (const item of items) {
      const cfg = resolveAssetLayerConfig(item.assetId, item.layer, catalogById.get(item.assetId));
      const resolvedLayer = item.renderLayer ?? cfg.renderLayer;
      const hostVoxels =
        resolvedLayer === RENDER_LAYER.TABLETOP
          ? (surfaceHeightByLocalTile.get(`${item.lx},${item.ly}`) ?? 19)
          : undefined;
      worldFurniture.push({
        ...item,
        tx: zone.originX + item.lx,
        ty: zone.originY + item.ly,
        footprintTiles: footOf(item),
        renderLayer: resolvedLayer,
        ...(hostVoxels !== undefined ? { surfaceOffsetY: surfaceVoxelsToWorldOffsetY(hostVoxels) } : {}),
      });
    }
  };

  // =========================================================================
  // Open Customizable Sandbox Floor + 3 Core Functional Anchors:
  //   1. Boss Corner       (boss:0, 0..5 x 0..5)       — Boss desk & chair
  //   2. Central Work Hub  (cowork:0, 6..11 x 0..5)    — Shared desks where working agents sit
  //   3. Hypersleep Bay    (hypersleep:0, 13.. x 1..)  — Auto-scaled 1 capsule per agent
  //   4. Open Blank Floor  (floor:0, 0..W x 0..D)      — Empty space for user decoration, expandable!
  // =========================================================================

  const requestedW = Math.max(MIN_FLOOR_SIDE, Math.min(MAX_FLOOR_SIDE, opts?.floorWidthTiles ?? DEFAULT_FLOOR_WIDTH));
  const requestedD = Math.max(MIN_FLOOR_SIDE, Math.min(MAX_FLOOR_SIDE, opts?.floorDepthTiles ?? DEFAULT_FLOOR_DEPTH));

  const capsuleCount = Math.max(1, opts?.employeeCount ?? Math.max(1, activeBays.length));
  const hasCustomHypersleep = zoneOverrides?.["hypersleep:0"] !== undefined;
  const capsuleCols = Math.max(4, requestedW - HYPERSLEEP_ORIGIN.x - 1);
  const capsuleRows = Math.ceil(capsuleCount / capsuleCols);
  const capsuleHeight = Math.max(3, capsuleRows * 3);

  let minAutoW = HYPERSLEEP_ORIGIN.x + capsuleCols + 1;
  let minAutoD = HYPERSLEEP_ORIGIN.y + capsuleHeight + 2;
  if (hasCustomHypersleep) {
    minAutoW = MIN_FLOOR_SIDE;
    minAutoD = MIN_FLOOR_SIDE;
    for (const item of zoneOverrides?.["hypersleep:0"] ?? []) {
      const [fw, fd] = getRotatedFootprint(
        catalogById.get(item.assetId)?.footprintTiles ??
          (item.assetId === "hypersleep-capsule" ? [1, 2] : [1, 1]),
        item.direction,
      );
      minAutoW = Math.max(minAutoW, HYPERSLEEP_ORIGIN.x + item.lx + fw);
      minAutoD = Math.max(minAutoD, HYPERSLEEP_ORIGIN.y + item.ly + fd);
    }
    for (const item of zoneOverrides?.["floor:0"] ?? []) {
      const [fw, fd] = getRotatedFootprint(
        catalogById.get(item.assetId)?.footprintTiles ??
          (item.assetId === "hypersleep-capsule" ? [1, 2] : [1, 1]),
        item.direction,
      );
      minAutoW = Math.max(minAutoW, item.lx + fw);
      minAutoD = Math.max(minAutoD, item.ly + fd);
    }
  }

  const widthTiles = Math.max(requestedW, minAutoW);
  const depthTiles = Math.max(requestedD, minAutoD);

  // 1. Boss Corner (anchored at top-most apex 0,0)
  const bossRec = bossOffice ?? createDefaultBossOffice();
  const bossZone: ZoneBounds = {
    zoneId: "boss:0",
    kind: "boss",
    zoneGroup: "hq",
    row: 0,
    col: 0,
    originX: 0,
    originY: 0,
    width: ZONE_SIZE,
    height: ZONE_SIZE,
  };
  zones.push(bossZone);
  placeFurniture(bossZone, bossRec.furniture);

  // 2. Central Work Hub (shared area where all active/working agents sit)
  const coworkZone: ZoneBounds = {
    zoneId: "cowork:0",
    kind: "cowork",
    zoneGroup: "workspace",
    lotId: "cowork",
    row: COWORK_SLOT.row,
    col: COWORK_SLOT.col,
    originX: COWORK_SLOT.col * ZONE_SIZE,
    originY: COWORK_SLOT.row * ZONE_SIZE,
    width: ZONE_SIZE,
    height: ZONE_SIZE,
  };
  zones.push(coworkZone);
  placeFurniture(coworkZone, zoneOverrides?.["cowork:0"] ?? createCoworkFurniture());

  // 3. Hypersleep Bay (auto-scaled 1 pod per employee; respects user moves/edits via zoneOverrides)
  const hypersleepZone: ZoneBounds = {
    zoneId: "hypersleep:0",
    kind: "hypersleep",
    zoneGroup: "hypersleep",
    row: 0,
    col: 2,
    originX: HYPERSLEEP_ORIGIN.x,
    originY: HYPERSLEEP_ORIGIN.y,
    width: capsuleCols,
    height: capsuleHeight,
  };
  zones.push(hypersleepZone);
  placeFurniture(
    hypersleepZone,
    zoneOverrides?.["hypersleep:0"] ?? createHypersleepFurniture(capsuleCount, capsuleCols),
  );

  // 4. Open Blank Floor (spans the entire campus as the catch-all editable decoration canvas)
  const floorZone: ZoneBounds = {
    zoneId: "floor:0",
    kind: "floor",
    zoneGroup: "floor",
    row: 1,
    col: 0,
    originX: 0,
    originY: 0,
    width: widthTiles,
    height: depthTiles,
  };
  zones.push(floorZone);
  placeFurniture(floorZone, zoneOverrides?.["floor:0"] ?? []);

  // Emit zero-thickness boundary-line wall segments for every user-placed edge divider
  // so pathfinding blocks crossing solid glass walls while furniture sits 100% flush on BOTH sides!
  const wallSegments: ComputedCampus["wallSegments"] = [];
  for (const wf of worldFurniture) {
    if (!isEdgeDividerAsset(wf.assetId)) continue;
    const segs = expandEdgeDividerSegments(wf.assetId, wf.tx, wf.ty, wf.direction);
    segs.forEach((seg, idx) => {
      wallSegments.push({
        id: `ef:${wf.id}:${idx}`,
        rx: seg.rx,
        ry: seg.ry,
        axis: seg.axis,
        assetId: seg.assetId,
        direction: seg.direction,
        blocks: seg.blocks,
      });
    });
  }
  const wallDecor: ComputedCampus["wallDecor"] = [];

  // Clean open floor with subtle visual cues for Boss rug and Hypersleep cryo deck
  const baseFloorAsset = theme === "office" ? "floor-office-carpet" : "floor-wood-plank";
  const bossRugAsset = theme === "office" ? "floor-boss-rug" : "floor-lounge-rug";

  const floors: ComputedCampus["floors"] = [];
  const floorOverrides = opts?.floorTileOverrides;
  for (let ty = 0; ty < depthTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      const inBossRug = tx >= 1 && tx <= 4 && ty >= 1 && ty <= 4;
      const inHypersleepDeck =
        tx >= hypersleepZone.originX &&
        tx < hypersleepZone.originX + hypersleepZone.width &&
        ty >= hypersleepZone.originY &&
        ty < hypersleepZone.originY + hypersleepZone.height;
      const defaultAssetId = inBossRug
        ? bossRugAsset
        : inHypersleepDeck
          ? "floor-corridor-tile"
          : baseFloorAsset;
      const override = floorOverrides?.[`${tx},${ty}`];
      const assetId =
        override && (catalogById.get(override)?.layer === "floor" || override.startsWith("floor-"))
          ? override
          : defaultAssetId;
      floors.push({
        tx,
        ty,
        assetId,
        direction: "se",
      });
    }
  }

  // Cutaway outer perimeter walls along full rear edges: ty=0 (NE edge) and tx=0 (NW edge)
  const walls: ComputedCampus["walls"] = [
    { tx: 0, ty: 0, assetId: "wall-corner-pillar", edge: "corner" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "nw" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "ne" },
  ];

  for (let tx = 1; tx < widthTiles; tx++) {
    const isWindowSlot = tx % 4 === 2;
    walls.push({
      tx,
      ty: 0,
      assetId: isWindowSlot ? "wall-night-window" : "wall-slate-plain",
      edge: "ne",
    });
  }
  for (let ty = 1; ty < depthTiles; ty++) {
    const isWindow = ty % 4 === 2;
    walls.push({
      tx: 0,
      ty,
      assetId: isWindow ? "wall-night-window" : "wall-slate-plain",
      edge: "nw",
    });
  }

  const permMap = buildTilePermissionMap(
    { widthTiles, depthTiles, zones, worldFurniture, wallSegments },
    tilePermissionOverrides,
    catalogById,
  );
  const tilePermissions = Array.from(permMap.permissions) as TilePermissionValue[];

  return { widthTiles, depthTiles, zones, floors, walls, wallDecor, wallSegments, worldFurniture, tilePermissions };
}

export function resolveWorldToZone(
  campus: ComputedCampus,
  tx: number,
  ty: number,
): { zoneId: ZoneId; lx: number; ly: number } | null {
  // In open-floor sandbox mode, resolve every in-bounds tile to `floor:0` (0..W x 0..D)
  // so multi-tile furniture can sit flush against dividers or straddle former 6x6 edges cleanly.
  const floorZone = campus.zones.find((z) => z.kind === "floor");
  if (
    floorZone &&
    tx >= floorZone.originX &&
    tx < floorZone.originX + floorZone.width &&
    ty >= floorZone.originY &&
    ty < floorZone.originY + floorZone.height
  ) {
    return {
      zoneId: floorZone.zoneId,
      lx: tx - floorZone.originX,
      ly: ty - floorZone.originY,
    };
  }
  for (const z of campus.zones) {
    if (z.kind === "hypersleep") continue;
    if (tx >= z.originX && tx < z.originX + z.width && ty >= z.originY && ty < z.originY + z.height) {
      return {
        zoneId: z.zoneId,
        lx: tx - z.originX,
        ly: ty - z.originY,
      };
    }
  }
  return null;
}

export function validateFurniturePlacement(
  campus: ComputedCampus,
  existingInZone: FurnitureInstance[],
  candidate: {
    zoneId: ZoneId;
    lx: number;
    ly: number;
    assetId: string;
    direction: Direction;
    ignoreInstanceId?: string;
  },
  catalogById: Map<string, CatalogEntry>,
): { ok: true } | { ok: false; reason: string } {
  const zone = campus.zones.find((z) => z.zoneId === candidate.zoneId);
  if (!zone) {
    return { ok: false, reason: `Zone "${candidate.zoneId}" does not exist or is archived` };
  }
  const cat = catalogById.get(candidate.assetId);
  if (!cat) {
    return { ok: false, reason: `Unknown asset "${candidate.assetId}"` };
  }
  const candidateIsTabletop = isTabletopAsset(candidate.assetId, cat.layer, cat);
  if (cat.layer !== "object" && !candidateIsTabletop) {
    return { ok: false, reason: `Asset "${candidate.assetId}" is layer "${cat.layer}" and cannot be placed as furniture` };
  }

  const [fw, fd] = getRotatedFootprint(cat.footprintTiles, candidate.direction);
  if (
    candidate.lx < 0 ||
    candidate.ly < 0 ||
    candidate.lx + fw > zone.width ||
    candidate.ly + fd > zone.height
  ) {
    return {
      ok: false,
      reason: `Furniture "${candidate.assetId}" (${fw}x${fd}) at (${candidate.lx},${candidate.ly}) overflows zone "${candidate.zoneId}" (${zone.width}x${zone.height})`,
    };
  }

  // Tabletop props must sit on top of an existing desk/table surface host and cannot overlap other tabletop props
  if (candidateIsTabletop) {
    const surfaceTiles = new Set<string>();
    const tabletopOcc = new Set<string>();
    const candWorldX = zone.originX + candidate.lx;
    const candWorldY = zone.originY + candidate.ly;
    const addHostOrTop = (wx: number, wy: number, assetId: string, layer: FurnitureInstance["layer"], dir: Direction) => {
      const itemCat = catalogById.get(assetId);
      const [iw, id] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], dir);
      const itemIsTop = isTabletopAsset(assetId, layer, itemCat);
      if (itemIsTop) {
        for (let dy = 0; dy < id; dy++) {
          for (let dx = 0; dx < iw; dx++) tabletopOcc.add(`${wx + dx},${wy + dy}`);
        }
      } else if (isSurfaceHostAsset(assetId, itemCat)) {
        for (let dy = 0; dy < id; dy++) {
          for (let dx = 0; dx < iw; dx++) surfaceTiles.add(`${wx + dx},${wy + dy}`);
        }
      }
    };
    for (const item of existingInZone) {
      if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
      addHostOrTop(zone.originX + item.lx, zone.originY + item.ly, item.assetId, item.layer, item.direction);
    }
    if (zone.kind === "floor") {
      for (const wf of campus.worldFurniture) {
        if (candidate.ignoreInstanceId && wf.id === candidate.ignoreInstanceId) continue;
        if (wf.zoneId === zone.zoneId) continue;
        addHostOrTop(wf.tx, wf.ty, wf.assetId, wf.layer, wf.direction);
      }
    }
    for (let dy = 0; dy < fd; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        const key = `${candWorldX + dx},${candWorldY + dy}`;
        if (!surfaceTiles.has(key)) {
          return {
            ok: false,
            reason: `Tabletop prop "${candidate.assetId}" at (${candidate.lx + dx},${candidate.ly + dy}) must be placed on a desk or table surface`,
          };
        }
        if (tabletopOcc.has(key)) {
          return {
            ok: false,
            reason: `Tabletop slot (${candidate.lx + dx},${candidate.ly + dy}) in "${candidate.zoneId}" is already occupied`,
          };
        }
      }
    }
    return { ok: true };
  }

  // Edge-mounted glass dividers live on tile boundary lines: they never collide with floor furniture
  // (lockers/desks sit 100% flush on both sides!), only with another edge-divider on the exact same edge.
  if (isEdgeDividerAsset(candidate.assetId)) {
    const candWorldX = zone.originX + candidate.lx;
    const candWorldY = zone.originY + candidate.ly;
    const candSegs = expandEdgeDividerSegments(candidate.assetId, candWorldX, candWorldY, candidate.direction);
    for (const seg of candSegs) {
      if (
        seg.rx < -0.5 ||
        seg.ry < -0.5 ||
        seg.rx >= campus.widthTiles + 0.5 ||
        seg.ry >= campus.depthTiles + 0.5
      ) {
        return {
          ok: false,
          reason: `Partition "${candidate.assetId}" at (${candWorldX},${candWorldY}) extends outside floor bounds`,
        };
      }
    }
    const existingEdgeKeys = new Set<string>();
    for (const item of existingInZone) {
      if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
      if (!isEdgeDividerAsset(item.assetId)) continue;
      for (const seg of expandEdgeDividerSegments(
        item.assetId,
        zone.originX + item.lx,
        zone.originY + item.ly,
        item.direction,
      )) {
        existingEdgeKeys.add(seg.edgeKey);
      }
    }
    if (zone.kind === "floor" || zone.kind === "hypersleep") {
      for (const wf of campus.worldFurniture) {
        if (candidate.ignoreInstanceId && wf.id === candidate.ignoreInstanceId) continue;
        if (wf.zoneId === zone.zoneId || !isEdgeDividerAsset(wf.assetId)) continue;
        for (const seg of expandEdgeDividerSegments(wf.assetId, wf.tx, wf.ty, wf.direction)) {
          existingEdgeKeys.add(seg.edgeKey);
        }
      }
    }
    for (const seg of candSegs) {
      if (existingEdgeKeys.has(seg.edgeKey)) {
        return {
          ok: false,
          reason: `An edge partition already occupies edge ${seg.edgeKey}`,
        };
      }
    }
    return { ok: true };
  }

  const worldOcc = new Set<string>();
  const occ = new Set<string>();
  for (const item of existingInZone) {
    if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
    if (isEdgeDividerAsset(item.assetId)) continue;
    const itemCat = catalogById.get(item.assetId);
    if (isTabletopAsset(item.assetId, item.layer, itemCat)) continue;
    const [iw, id] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], item.direction);
    for (let dy = 0; dy < id; dy++) {
      for (let dx = 0; dx < iw; dx++) {
        occ.add(`${item.lx + dx},${item.ly + dy}`);
        worldOcc.add(`${zone.originX + item.lx + dx},${zone.originY + item.ly + dy}`);
      }
    }
  }
  // On open floor & hypersleep zones, also prevent overlapping furniture belonging to neighbouring zones
  if (zone.kind === "floor" || zone.kind === "hypersleep") {
    for (const wf of campus.worldFurniture) {
      if (candidate.ignoreInstanceId && wf.id === candidate.ignoreInstanceId) continue;
      if (wf.zoneId === zone.zoneId) continue;
      if (isEdgeDividerAsset(wf.assetId)) continue;
      const itemCat = catalogById.get(wf.assetId);
      if (isTabletopAsset(wf.assetId, wf.layer, itemCat)) continue;
      const [iw, id] = wf.footprintTiles;
      for (let dy = 0; dy < id; dy++) {
        for (let dx = 0; dx < iw; dx++) {
          worldOcc.add(`${wf.tx + dx},${wf.ty + dy}`);
        }
      }
    }
  }

  for (let dy = 0; dy < fd; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      const localKey = `${candidate.lx + dx},${candidate.ly + dy}`;
      const worldKey = `${zone.originX + candidate.lx + dx},${zone.originY + candidate.ly + dy}`;
      if (occ.has(localKey) || worldOcc.has(worldKey)) {
        return { ok: false, reason: `Tile (${candidate.lx + dx},${candidate.ly + dy}) in "${candidate.zoneId}" is already occupied` };
      }
      occ.add(localKey);
    }
  }

  // Open sandbox areas have no walled 6x6 doorway constraints — decorate freely anywhere
  if (zone.kind === "floor" || zone.kind === "boss" || zone.kind === "cowork" || zone.kind === "hypersleep") {
    return { ok: true };
  }

  // Keep at least one entrance tile open at the front corridor side (ly = 5, lx ∈ {2, 3})
  const openEntrances: Array<[number, number]> = [];
  if (!occ.has("2,5")) openEntrances.push([2, 5]);
  if (!occ.has("3,5")) openEntrances.push([3, 5]);
  if (openEntrances.length === 0) {
    return { ok: false, reason: `Cannot block both entrance tiles (2,5) and (3,5) of zone "${candidate.zoneId}"` };
  }

  const walkBlocked = new Set<string>();
  const addWalkBlock = (set: Set<string>, assetId: string, lx: number, ly: number, dir: Direction) => {
    const c = catalogById.get(assetId);
    if (isTabletopAsset(assetId, c?.layer, c)) return;
    const cfg = resolveAssetLayerConfig(assetId, c?.layer, c);
    if (isWalkablePermission(cfg.tilePermission)) return;
    const [w, d] = getRotatedFootprint(c?.footprintTiles ?? [1, 1], dir);
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) {
        set.add(`${lx + dx},${ly + dy}`);
      }
    }
  };
  for (const item of existingInZone) {
    if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
    addWalkBlock(walkBlocked, item.assetId, item.lx, item.ly, item.direction);
  }
  const blockedWithCandidate = new Set(walkBlocked);
  addWalkBlock(blockedWithCandidate, candidate.assetId, candidate.lx, candidate.ly, candidate.direction);

  const reachable = (blocked: Set<string>): Set<string> => {
    const visited = new Set<string>();
    const queue: Array<[number, number]> = [];
    for (const [ex, ey] of openEntrances) {
      const k = `${ex},${ey}`;
      if (!blocked.has(k)) {
        visited.add(k);
        queue.push([ex, ey]);
      }
    }
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= ZONE_SIZE || ny < 0 || ny >= ZONE_SIZE) continue;
        const nk = `${nx},${ny}`;
        if (visited.has(nk) || blocked.has(nk)) continue;
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }
    return visited;
  };

  // Reject only if this placement cuts off floor that is reachable today (a pocket that already exists,
  // e.g. from an asset whose footprint changed, must not freeze the whole room for editing)
  const before = reachable(walkBlocked);
  const after = reachable(blockedWithCandidate);
  for (const tile of before) {
    if (!blockedWithCandidate.has(tile) && !after.has(tile)) {
      return {
        ok: false,
        reason: `Placing "${candidate.assetId}" at (${candidate.lx},${candidate.ly}) seals off part of zone "${candidate.zoneId}"`,
      };
    }
  }

  return { ok: true };
}
