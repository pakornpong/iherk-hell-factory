import {
  AMENITY_THEME_ORDER,
  classifyDepartmentFromPath,
  DEPARTMENT_ORDER,
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
  type WorldFurnitureInstance,
  type ZoneBounds,
  type ZoneId,
} from "../shared/types.js";
import { bayLayoutKey, commonLayoutKey, getRoomLayout, toFurniture } from "../shared/room-layouts.js";

export const ZONE_SIZE = 6;
/**
 * Gap between neighbouring zones: a walled room's wall + 1 walkway tile + the next room's wall.
 * Between open-plan areas (no walls) the whole gap is walkway; inside one lot it is shared floor.
 */
export const ZONE_GAP = 3;
/** 6-tile zone + 3-tile gap. */
export const MODULE_PITCH_X = ZONE_SIZE + ZONE_GAP;
export const MODULE_PITCH_Y = MODULE_PITCH_X;
/** Fixed slot of the shared co-working room where every project's subagents sit (next to the Boss Office). */
export const COWORK_SLOT = { col: 1, row: 0 } as const;

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
    furniture: toFurniture("boss:0", getRoomLayout("boss").items),
  };
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

function bayLayoutItems(bayId: string, department: DepartmentId) {
  const { key, mirrored } = bayLayoutKey(department, bayId);
  return getRoomLayout(key, mirrored).items;
}

/** A project's team room: one of 3 department-flavoured layouts, possibly mirrored, chosen from the bay id. */
export function createDefaultBayFurniture(bayId: string, department: DepartmentId = "general"): FurnitureInstance[] {
  return toFurniture(`bay:${bayId}`, bayLayoutItems(bayId, department).filter((it) => !it.extra));
}

/** Workstations 3 and 4 of the same layout, added as the team grows (only those not placed yet). */
export function createExtraBayWorkstations(
  bayId: string,
  desiredDeskSlots: number,
  existing: FurnitureInstance[],
  department: DepartmentId = "general",
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

export function computeCampusLayout(
  bays: ProjectBayRecord[],
  commonWings: CommonWingRecord[],
  catalogById: Map<string, CatalogEntry>,
  bossOffice?: BossOfficeRecord,
  theme: ThemeMode = "office",
): ComputedCampus {
  const deptRank = (bay: ProjectBayRecord): number => {
    const dept = bay.department ?? classifyDepartmentFromPath(bay.projectPath);
    const idx = DEPARTMENT_ORDER.indexOf(dept);
    return idx === -1 ? DEPARTMENT_ORDER.length : idx;
  };
  const activeBays = bays
    .filter((b) => !b.archived)
    .slice()
    .sort((a, b) => deptRank(a) - deptRank(b));
  const wingByRow = new Map<number, CommonWingRecord>();
  for (const w of commonWings) wingByRow.set(w.row, w);

  const zones: ZoneBounds[] = [];
  const worldFurniture: WorldFurnitureInstance[] = [];

  const pushFurniture = (zone: ZoneBounds, items: FurnitureInstance[]) => {
    for (const item of items) {
      const cat = catalogById.get(item.assetId);
      const baseFootprint: [number, number] = cat?.footprintTiles ?? [1, 1];
      const footprintTiles = getRotatedFootprint(baseFootprint, item.direction);
      worldFurniture.push({
        ...item,
        tx: zone.originX + item.lx,
        ty: zone.originY + item.ly,
        footprintTiles,
      });
    }
  };

  // 1. Boss Office permanently anchored at the top-most apex (col=0, row=0)
  const bossRec = bossOffice ?? createDefaultBossOffice();
  const bossZone: ZoneBounds = {
    zoneId: "boss:0",
    kind: "boss",
    row: 0,
    col: 0,
    originX: 0,
    originY: 0,
    width: ZONE_SIZE,
    height: ZONE_SIZE,
  };
  zones.push(bossZone);
  pushFurniture(bossZone, bossRec.furniture);

  // 2. Primary Common Lounge & Meeting Hub at (col=0, row=1)
  const common0Zone: ZoneBounds = {
    zoneId: "common:0",
    kind: "common",
    row: 1,
    col: 0,
    originX: 0,
    originY: MODULE_PITCH_Y,
    width: ZONE_SIZE,
    height: ZONE_SIZE,
  };
  zones.push(common0Zone);
  const wing0 = wingByRow.get(0) ?? createDefaultCommonWing(0);
  pushFurniture(common0Zone, wing0.furniture);

  // 2b. Shared co-working room for subagents at (col=1, row=0), right next to the Boss Office
  const coworkZone: ZoneBounds = {
    zoneId: "cowork:0",
    kind: "cowork",
    lotId: "cowork",
    row: COWORK_SLOT.row,
    col: COWORK_SLOT.col,
    originX: COWORK_SLOT.col * MODULE_PITCH_X,
    originY: COWORK_SLOT.row * MODULE_PITCH_Y,
    width: ZONE_SIZE,
    height: ZONE_SIZE,
  };
  zones.push(coworkZone);
  pushFurniture(coworkZone, createCoworkFurniture());

  // 3. Pack department "lots". Each department is ONE rectangular open-plan lot sized by how many projects
  // it has (1 -> 1x1, 2 -> 2x1, 3-4 -> 2x2, 5-6 -> 3x2, 7-9 -> 3x3, ...). Lots, extra lounges and themed rooms
  // are packed as close to the Boss Office as possible; the square grid grows only when they do not fit.
  const baysByDept = new Map<DepartmentId, ProjectBayRecord[]>();
  for (const bay of activeBays) {
    const dept = bay.department ?? classifyDepartmentFromPath(bay.projectPath);
    const list = baysByDept.get(dept) ?? [];
    list.push(bay);
    baysByDept.set(dept, list);
  }
  const deptLots = [...baysByDept.entries()];
  const extraCommonCount = Math.floor(activeBays.length / 10);

  const lotShapes = (n: number, side: number): Array<[number, number]> => {
    const shapes: Array<[number, number]> = [];
    for (let w = 1; w <= side; w++) {
      for (let h = 1; h <= side; h++) {
        if (w * h >= n && w * h - n <= Math.max(1, Math.floor(n / 3))) shapes.push([w, h]);
      }
    }
    // Most compact block first (shortest long side), then least wasted cells, then wider-than-deep
    return shapes.sort(
      (a, b) => Math.max(...a) - Math.max(...b) || a[0] * a[1] - b[0] * b[1] || b[0] - a[0],
    );
  };

  type Placed = { col: number; row: number; w: number; h: number };
  const tryPack = (
    side: number,
  ): { lots: Placed[]; commons: Placed[]; free: Array<[number, number]> } | null => {
    const used = new Set<string>(["0,0", "0,1", `${COWORK_SLOT.col},${COWORK_SLOT.row}`]);
    const fits = (c: number, r: number, w: number, h: number) => {
      if (c + w > side || r + h > side) return false;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used.has(`${x},${y}`)) return false;
      return true;
    };
    const take = (c: number, r: number, w: number, h: number) => {
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used.add(`${x},${y}`);
    };
    // Candidate positions, nearest to the Boss Office corner first
    const place = (w: number, h: number): Placed | null => {
      let best: Placed | null = null;
      let bestKey = Infinity;
      for (let r = 0; r < side; r++) {
        for (let c = 0; c < side; c++) {
          if (!fits(c, r, w, h)) continue;
          const key = Math.max(c + w, r + h) * side * side + r * side + c;
          if (key < bestKey) {
            bestKey = key;
            best = { col: c, row: r, w, h };
          }
        }
      }
      if (best) take(best.col, best.row, w, h);
      return best;
    };

    const lots: Placed[] = [];
    for (const [, bays] of deptLots) {
      let placed: Placed | null = null;
      for (const [w, h] of lotShapes(bays.length, side)) {
        placed = place(w, h);
        if (placed) break;
      }
      if (!placed) return null;
      lots.push(placed);
    }
    const commons: Placed[] = [];
    for (let i = 0; i < extraCommonCount; i++) {
      const p = place(1, 1);
      if (!p) return null;
      commons.push(p);
    }
    const free: Array<[number, number]> = [];
    for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) if (!used.has(`${c},${r}`)) free.push([c, r]);
    free.sort((a, b) => Math.max(a[0], a[1]) - Math.max(b[0], b[1]) || a[1] - b[1] || a[0] - b[0]);
    if (free.length < MIN_AMENITY_ROOMS) return null;
    return { lots, commons, free };
  };

  let maxGridSide = 2;
  let packed = tryPack(maxGridSide);
  while (!packed) packed = tryPack(++maxGridSide);

  packed.lots.forEach((lot, i) => {
    const [dept, bays] = deptLots[i];
    bays.forEach((bay, k) => {
      const col = lot.col + (k % lot.w);
      const row = lot.row + Math.floor(k / lot.w);
      const bayZone: ZoneBounds = {
        zoneId: `bay:${bay.id}`,
        kind: "bay",
        bayId: bay.id,
        department: dept,
        lotId: `dept:${dept}`,
        row,
        col,
        originX: col * MODULE_PITCH_X,
        originY: row * MODULE_PITCH_Y,
        width: ZONE_SIZE,
        height: ZONE_SIZE,
      };
      zones.push(bayZone);
      pushFurniture(bayZone, bay.furniture);
    });
  });

  packed.commons.forEach((slot, i) => {
    const cIdx = i + 1;
    const cZone: ZoneBounds = {
      zoneId: `common:${cIdx}`,
      kind: "common",
      row: slot.row,
      col: slot.col,
      originX: slot.col * MODULE_PITCH_X,
      originY: slot.row * MODULE_PITCH_Y,
      width: ZONE_SIZE,
      height: ZONE_SIZE,
    };
    zones.push(cZone);
    pushFurniture(cZone, (wingByRow.get(cIdx) ?? createDefaultCommonWing(cIdx)).furniture);
  });

  // 3b. Themed amenity rooms (game, music, gym, lab, ...) take the free cells, one per theme.
  packed.free.slice(0, AMENITY_THEME_ORDER.length).forEach(([col, row], idx) => {
    const amenityTheme = getAmenityTheme(idx);
    const aZone: ZoneBounds = {
      zoneId: `amenity:${idx}`,
      kind: "amenity",
      amenityTheme,
      row,
      col,
      originX: col * MODULE_PITCH_X,
      originY: row * MODULE_PITCH_Y,
      width: ZONE_SIZE,
      height: ZONE_SIZE,
    };
    zones.push(aZone);
    pushFurniture(aZone, createAmenityFurniture(idx, amenityTheme));
  });

  // Exact square overall campus dimensions (widthTiles === depthTiles)
  const sideTiles = campusSideTiles(maxGridSide);
  const widthTiles = sideTiles;
  const depthTiles = sideTiles;

  // 4. Rooms, corridors and walls are resolved per tile.
  // Along each axis a module is [zone 0..5][gap 6..8] (pitch 9). A gap between two zones is:
  //   - walkway when they belong to different lots (departments / zone types), so areas read as separate;
  //   - shared open-plan floor with a low cubicle divider (at 7) when both are in the same lot.
  // Every lot (a department's projects, Boss Office, lounges, themed rooms) is a glass-walled room with a
  // 2-tile doorway at offset 2..3 of every outer side and corner posts closing each box. Only the
  // co-working area is open plan (face-to-face desk pods, no walls).
  const zoneAt = new Map<string, ZoneBounds>();
  for (const z of zones) zoneAt.set(`${z.col},${z.row}`, z);

  const sameDepartment = (a?: ZoneBounds, b?: ZoneBounds): boolean =>
    Boolean(a && b && a.lotId && a.lotId === b.lotId);
  // Every zone is a walled room except the co-working area, which is an open bench of face-to-face desks
  const isEnclosedKind = (z?: ZoneBounds): boolean => Boolean(z && z.kind !== "cowork");

  const P = MODULE_PITCH_X;
  /** Zone whose floor a tile belongs to (room interior or a merged same-department gap), else undefined. */
  const interiorZoneAt = (tx: number, ty: number): ZoneBounds | undefined => {
    if (tx < 0 || ty < 0 || tx >= widthTiles || ty >= depthTiles) return undefined;
    const col = Math.floor(tx / P);
    const row = Math.floor(ty / P);
    const ox = tx % P;
    const oy = ty % P;
    const here = zoneAt.get(`${col},${row}`);
    if (!here) return undefined;
    const inGapX = isOutsideRoomOffset(ox);
    const inGapY = isOutsideRoomOffset(oy);
    if (!inGapX && !inGapY) return here;
    const right = zoneAt.get(`${col + 1},${row}`);
    const below = zoneAt.get(`${col},${row + 1}`);
    if (inGapX && !inGapY) return sameDepartment(here, right) ? here : undefined;
    if (inGapY && !inGapX) return sameDepartment(here, below) ? here : undefined;
    // Gap crossing between four rooms: open only when all four are one department
    const diag = zoneAt.get(`${col + 1},${row + 1}`);
    return sameDepartment(here, right) && sameDepartment(here, below) && sameDepartment(here, diag) ? here : undefined;
  };

  const worldWallSet = new Set<string>();
  const addRoomWallTile = (
    id: string,
    zoneId: ZoneId,
    tx: number,
    ty: number,
    assetId: string,
    direction: Direction,
  ) => {
    const key = `${tx},${ty}`;
    if (worldWallSet.has(key)) return;
    worldWallSet.add(key);
    worldFurniture.push({
      id,
      zoneId,
      lx: 5,
      ly: 5,
      assetId,
      direction,
      layer: "object",
      placedBy: "system",
      tx,
      ty,
      footprintTiles: [1, 1],
    });
  };

  const isDoorOffset = (o: number) => o === 2 || o === 3;
  const cubicleDividerAssetId = theme === "office" ? "divider-cubicle-amber" : "divider-low-glass";

  /** Interior of an enclosed (walled) room at this tile, else undefined. */
  const enclosedAt = (tx: number, ty: number): ZoneBounds | undefined => {
    const z = interiorZoneAt(tx, ty);
    return isEnclosedKind(z) ? z : undefined;
  };

  // 4a. Straight walls on every non-room tile that touches an enclosed room's floor
  for (let ty = 0; ty < depthTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      if (interiorZoneAt(tx, ty)) continue;
      const left = enclosedAt(tx - 1, ty);
      const right = enclosedAt(tx + 1, ty);
      const up = enclosedAt(tx, ty - 1);
      const down = enclosedAt(tx, ty + 1);
      const xSide = left ?? right;
      const ySide = up ?? down;
      if (xSide && ySide) {
        addRoomWallTile(`sys-wall-${tx}-${ty}`, xSide.zoneId, tx, ty, "room-junction-corner", left && up ? "nw" : left ? "sw" : up ? "ne" : "se");
      } else if (xSide) {
        // Vertical wall (constant tx); doorway where the room side is at local offset 2..3
        if (isDoorOffset(ty % P)) continue;
        addRoomWallTile(`sys-wall-${tx}-${ty}`, xSide.zoneId, tx, ty, "room-wall-glass", "sw");
      } else if (ySide) {
        if (isDoorOffset(tx % P)) continue;
        addRoomWallTile(`sys-wall-${tx}-${ty}`, ySide.zoneId, tx, ty, "room-wall-glass", "se");
      }
    }
  }

  // 4b. Corner posts where two walls meet diagonally to a room's corner
  for (let ty = 0; ty < depthTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      const key = `${tx},${ty}`;
      if (worldWallSet.has(key) || interiorZoneAt(tx, ty)) continue;
      const negX = worldWallSet.has(`${tx - 1},${ty}`);
      const posX = worldWallSet.has(`${tx + 1},${ty}`);
      const negY = worldWallSet.has(`${tx},${ty - 1}`);
      const posY = worldWallSet.has(`${tx},${ty + 1}`);
      if (!((negX || posX) && (negY || posY))) continue;
      const diagZone =
        enclosedAt(tx - 1, ty - 1) ?? enclosedAt(tx + 1, ty - 1) ?? enclosedAt(tx - 1, ty + 1) ?? enclosedAt(tx + 1, ty + 1);
      if (!diagZone) continue;
      let dir: Direction;
      if (posX && posY) dir = "se";
      else if (posY && negX) dir = "sw";
      else if (negX && negY) dir = "nw";
      else dir = "ne";
      addRoomWallTile(`sys-wall-c-${tx}-${ty}`, diagZone.zoneId, tx, ty, "room-junction-corner", dir);
    }
  }

  // 4c. Low cubicle dividers between projects of one lot (keeping a 2-tile pass-through at offset 2..3)
  for (const z of zones) {
    const right = zoneAt.get(`${z.col + 1},${z.row}`);
    if (sameDepartment(z, right)) {
      for (let o = 0; o < ZONE_SIZE; o++) {
        if (isDoorOffset(o)) continue;
        addRoomWallTile(`sys-div-v-${z.col}-${z.row}-${o}`, z.zoneId, z.originX + ZONE_SIZE + 1, z.originY + o, cubicleDividerAssetId, "sw");
      }
    }
    const below = zoneAt.get(`${z.col},${z.row + 1}`);
    if (sameDepartment(z, below)) {
      for (let o = 0; o < ZONE_SIZE; o++) {
        if (isDoorOffset(o)) continue;
        addRoomWallTile(`sys-div-h-${z.col}-${z.row}-${o}`, z.zoneId, z.originX + o, z.originY + ZONE_SIZE + 1, cubicleDividerAssetId, "se");
      }
    }
  }

  // 5. Seamless square floors with architectural room borders/thresholds and rug accents
  const bossRugSet = new Set<string>();
  for (let y = 1; y <= 4; y++) {
    for (let x = 1; x <= 4; x++) {
      bossRugSet.add(`${x},${y}`); // Boss Office executive rug
    }
  }
  const loungeRugSet = new Set<string>();
  for (const z of zones) {
    if (z.kind !== "common") continue;
    for (let ly = 3; ly <= 5; ly++) {
      for (let lx = 3; lx <= 5; lx++) {
        loungeRugSet.add(`${z.originX + lx},${z.originY + ly}`);
      }
    }
  }

  const baseFloorAsset = theme === "office" ? "floor-office-carpet" : "floor-wood-plank";
  const bossRugAsset = theme === "office" ? "floor-boss-rug" : "floor-lounge-rug";

  const floors: ComputedCampus["floors"] = [];
  for (let ty = 0; ty < depthTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      const key = `${tx},${ty}`;
      // Walls + corridors between rooms get the hallway tile so each room reads as its own zone
      const isCorridor = !interiorZoneAt(tx, ty);
      const assetId = isCorridor
        ? "floor-corridor-tile"
        : bossRugSet.has(key)
          ? bossRugAsset
          : loungeRugSet.has(key)
            ? "floor-lounge-rug"
            : baseFloorAsset;
      floors.push({
        tx,
        ty,
        assetId,
        direction: "se",
      });
    }
  }

  // 6. Mount rich wall decor (boards, TVs, clocks, charts, calendars, certificates, AC) flush along BOTH rear walls
  // so perimeter windows never sit hidden behind wall decor
  const wallDecor: ComputedCampus["wallDecor"] = [];
  const decorBlockedTx = new Set<number>();
  const decorBlockedTy = new Set<number>();

  for (const z of zones) {
    // Rear NE wall (ty = 0) for top-row rooms
    if (z.row === 0) {
      if (z.col > 0 && z.originX < widthTiles) {
        wallDecor.push({
          tx: z.originX,
          ty: 0,
          assetId: z.col % 2 === 1 ? "wall-chart-org" : "wall-calendar",
          edge: "ne",
        });
        decorBlockedTx.add(z.originX);
      }
      if (z.originX + 2 < widthTiles) {
        const useCorkboard =
          z.kind === "bay" && (z.department === "erp" || z.department === "accounting" || z.col % 2 === 1);
        const boardAsset = useCorkboard
          ? "wall-corkboard"
          : z.col > 0 && z.col % 2 === 0
            ? "wall-tv-monitor"
            : "whiteboard-arch";
        const dtx = z.originX + 1;
        wallDecor.push({ tx: dtx, ty: 0, assetId: boardAsset, edge: "ne" });
        decorBlockedTx.add(dtx);
        decorBlockedTx.add(dtx + 1);
      }
      if (z.originX + 3 < widthTiles) {
        const midAsset =
          z.kind === "boss" ? "wall-clock" : z.col % 2 === 1 ? "wall-calendar" : "wall-certificate";
        wallDecor.push({ tx: z.originX + 3, ty: 0, assetId: midAsset, edge: "ne" });
        decorBlockedTx.add(z.originX + 3);
      }
      if (z.originX + 5 < widthTiles) {
        const dtx = z.originX + 4;
        wallDecor.push({ tx: dtx, ty: 0, assetId: "wall-ac-unit", edge: "ne" });
        decorBlockedTx.add(dtx);
        decorBlockedTx.add(dtx + 1);
      }
    }

    // Rear NW wall (tx = 0) for left-column rooms (keeps ty=2 window open in Boss Office)
    if (z.col === 0) {
      if (z.row === 0) {
        if (1 < depthTiles) {
          wallDecor.push({ tx: 0, ty: 1, assetId: "wall-certificate", edge: "nw" });
          decorBlockedTy.add(1);
        }
        if (4 < depthTiles) {
          wallDecor.push({ tx: 0, ty: 3, assetId: "wall-tv-monitor", edge: "nw" });
          decorBlockedTy.add(3);
          decorBlockedTy.add(4);
        }
      } else {
        if (z.originY < depthTiles) {
          wallDecor.push({
            tx: 0,
            ty: z.originY,
            assetId: z.row % 2 === 1 ? "wall-clock" : "wall-certificate",
            edge: "nw",
          });
          decorBlockedTy.add(z.originY);
        }
        if (z.originY + 2 < depthTiles) {
          const dty = z.originY + 1;
          wallDecor.push({
            tx: 0,
            ty: dty,
            assetId: z.kind === "common" ? "wall-corkboard" : "wall-tv-monitor",
            edge: "nw",
          });
          decorBlockedTy.add(dty);
          decorBlockedTy.add(dty + 1);
        }
        if (z.originY + 4 < depthTiles) {
          wallDecor.push({ tx: 0, ty: z.originY + 4, assetId: "wall-calendar", edge: "nw" });
          decorBlockedTy.add(z.originY + 4);
        }
        if (z.originY + 5 < depthTiles) {
          wallDecor.push({ tx: 0, ty: z.originY + 5, assetId: "wall-chart-org", edge: "nw" });
          decorBlockedTy.add(z.originY + 5);
        }
      }
    }
  }

  // Cutaway outer perimeter walls along full square rear edges: ty=0 (NE edge) and tx=0 (NW edge)
  const walls: ComputedCampus["walls"] = [
    { tx: 0, ty: 0, assetId: "wall-corner-pillar", edge: "corner" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "nw" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "ne" },
  ];

  for (let tx = 1; tx < widthTiles; tx++) {
    // Keep windows over room interiors; corridors/room walls meet the perimeter as plain wall
    const hitsInteriorWall = isOutsideRoomOffset(tx % MODULE_PITCH_X);
    const isWindowSlot = tx % 4 === 2 && !hitsInteriorWall;
    const assetId = !isWindowSlot
      ? "wall-slate-plain"
      : decorBlockedTx.has(tx)
        ? "wall-loft-clerestory"
        : "wall-night-window";
    walls.push({
      tx,
      ty: 0,
      assetId,
      edge: "ne",
    });
  }
  for (let ty = 1; ty < depthTiles; ty++) {
    const hitsInteriorWall = isOutsideRoomOffset(ty % MODULE_PITCH_Y);
    const isWindow = ty % 4 === 2 && !decorBlockedTy.has(ty) && !hitsInteriorWall;
    walls.push({
      tx: 0,
      ty,
      assetId: isWindow ? "wall-night-window" : "wall-slate-plain",
      edge: "nw",
    });
  }

  return { widthTiles, depthTiles, zones, floors, walls, wallDecor, worldFurniture };
}

export function resolveWorldToZone(
  campus: ComputedCampus,
  tx: number,
  ty: number,
): { zoneId: ZoneId; lx: number; ly: number } | null {
  for (const z of campus.zones) {
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
  if (cat.layer !== "object") {
    return { ok: false, reason: `Asset "${candidate.assetId}" is layer "${cat.layer}" and cannot be placed as furniture` };
  }

  const [fw, fd] = getRotatedFootprint(cat.footprintTiles, candidate.direction);
  if (
    candidate.lx < 0 ||
    candidate.ly < 0 ||
    candidate.lx + fw > ZONE_SIZE ||
    candidate.ly + fd > ZONE_SIZE
  ) {
    return {
      ok: false,
      reason: `Furniture "${candidate.assetId}" (${fw}x${fd}) at (${candidate.lx},${candidate.ly}) overflows zone "${candidate.zoneId}" (${ZONE_SIZE}x${ZONE_SIZE})`,
    };
  }

  const occ = new Set<string>();
  for (const item of existingInZone) {
    if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
    const itemCat = catalogById.get(item.assetId);
    const [iw, id] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], item.direction);
    for (let dy = 0; dy < id; dy++) {
      for (let dx = 0; dx < iw; dx++) {
        occ.add(`${item.lx + dx},${item.ly + dy}`);
      }
    }
  }

  for (let dy = 0; dy < fd; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      const key = `${candidate.lx + dx},${candidate.ly + dy}`;
      if (occ.has(key)) {
        return { ok: false, reason: `Tile (${candidate.lx + dx},${candidate.ly + dy}) in "${candidate.zoneId}" is already occupied` };
      }
      occ.add(key);
    }
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
    if (assetId === "chair-office-swivel") return;
    const c = catalogById.get(assetId);
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
