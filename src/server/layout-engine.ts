import {
  classifyDepartmentFromPath,
  DEPARTMENT_ORDER,
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

export const ZONE_SIZE = 6;
export const MODULE_PITCH_X = 7; // 6-tile zone + 1-tile aisle
export const MODULE_PITCH_Y = 7; // 6-tile zone + 1-tile aisle -> exact square S*7 - 1
export const BAYS_PER_ROW = 3; // kept exported for compatibility

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
  const zoneId = "boss:0" as const;
  return {
    zoneId,
    displayName: "BOSS OFFICE",
    furniture: [
      { id: `${zoneId}-shelf`, zoneId, lx: 0, ly: 0, assetId: "bookshelf-wood", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-plant-r`, zoneId, lx: 5, ly: 0, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-boss-chair`, zoneId, lx: 2, ly: 1, assetId: "chair-office-swivel", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-boss-desk`, zoneId, lx: 2, ly: 2, assetId: "desk-dev-dual", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-visitor-0`, zoneId, lx: 2, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-visitor-1`, zoneId, lx: 3, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-plant-l`, zoneId, lx: 0, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-sign`, zoneId, lx: 5, ly: 4, assetId: "bay-sign-post", direction: "se", layer: "object", placedBy: "system" },
    ],
  };
}

export function createDefaultCommonWing(row: number): CommonWingRecord {
  const zoneId: ZoneId = `common:${row}`;
  return {
    row,
    zoneId,
    furniture: [
      { id: `${zoneId}-conf`, zoneId, lx: 1, ly: 1, assetId: "table-conference", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-c1`, zoneId, lx: 1, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-c2`, zoneId, lx: 2, ly: 3, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-c3`, zoneId, lx: 3, ly: 1, assetId: "chair-office-swivel", direction: "sw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-coffee`, zoneId, lx: 4, ly: 0, assetId: "coffee-machine-bar", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-sofa`, zoneId, lx: 4, ly: 4, assetId: "sofa-lounge", direction: "nw", layer: "object", placedBy: "system" },
      { id: `${zoneId}-vac`, zoneId, lx: 0, ly: 4, assetId: "robot-vacuum", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 5, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-cooler`, zoneId, lx: 5, ly: 5, assetId: "water-cooler", direction: "sw", layer: "object", placedBy: "system" },
    ],
  };
}

export function createDefaultBayFurniture(bayId: string, department: DepartmentId = "general"): FurnitureInstance[] {
  const zoneId: ZoneId = `bay:${bayId}`;
  // Symmetric room layout with wide 2-tile central corridor (lx=2..3) and clear doorways on all 4 room sides
  const base: FurnitureInstance[] = [
    { id: `${zoneId}-desk-0`, zoneId, lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-chair-0`, zoneId, lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    { id: `${zoneId}-desk-1`, zoneId, lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-chair-1`, zoneId, lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    { id: `${zoneId}-sign`, zoneId, lx: 5, ly: 5, assetId: "bay-sign-post", direction: "se", layer: "object", placedBy: "system" },
  ];

  switch (department) {
    case "iherk":
      return [
        ...base,
        { id: `${zoneId}-rack`, zoneId, lx: 5, ly: 4, assetId: "server-rack", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-shelf`, zoneId, lx: 0, ly: 5, assetId: "bookshelf-wood", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      ];
    case "dev":
      return [
        ...base,
        { id: `${zoneId}-rack`, zoneId, lx: 5, ly: 4, assetId: "server-rack", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-printer`, zoneId, lx: 0, ly: 5, assetId: "printer-copier", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      ];
    case "erp":
      return [
        ...base,
        { id: `${zoneId}-rack`, zoneId, lx: 5, ly: 4, assetId: "server-rack", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-cabinet`, zoneId, lx: 0, ly: 5, assetId: "filing-cabinet", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-printer`, zoneId, lx: 0, ly: 4, assetId: "printer-copier", direction: "se", layer: "object", placedBy: "system" },
      ];
    case "accounting":
      return [
        ...base,
        { id: `${zoneId}-cabinet-r`, zoneId, lx: 5, ly: 4, assetId: "filing-cabinet", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-cabinet-l`, zoneId, lx: 0, ly: 5, assetId: "filing-cabinet", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-printer`, zoneId, lx: 0, ly: 4, assetId: "printer-copier", direction: "se", layer: "object", placedBy: "system" },
      ];
    case "general":
    default:
      return [
        ...base,
        { id: `${zoneId}-rack`, zoneId, lx: 5, ly: 4, assetId: "server-rack", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-shelf`, zoneId, lx: 0, ly: 5, assetId: "bookshelf-wood", direction: "se", layer: "object", placedBy: "system" },
        { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      ];
  }
}

export function createExtraBayWorkstations(
  bayId: string,
  desiredDeskSlots: number,
  existing: FurnitureInstance[],
): FurnitureInstance[] {
  const zoneId: ZoneId = `bay:${bayId}`;
  const added: FurnitureInstance[] = [];
  const hasId = (id: string) => existing.some((f) => f.id === id);

  if (desiredDeskSlots >= 3 && !hasId(`${zoneId}-desk-2`)) {
    added.push(
      { id: `${zoneId}-desk-2`, zoneId, lx: 0, ly: 3, assetId: "desk-security-ops", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-chair-2`, zoneId, lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    );
  }
  if (desiredDeskSlots >= 4 && !hasId(`${zoneId}-desk-3`)) {
    added.push(
      { id: `${zoneId}-desk-3`, zoneId, lx: 4, ly: 3, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-chair-3`, zoneId, lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    );
  }
  return added;
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

  // 3. Allocate active Project Bays clockwise across square rings (k = 1, 2, 3, ...)
  // Ring 1 skips (0, 1) because common:0 occupies it; rings >= 3 reserve (0, k) every 2nd ring for extra common hubs
  const availableSlots: Array<{ col: number; row: number; extraCommonRow?: number }> = [];
  let maxGridSide = 2;
  let ring = 1;
  let commonIdx = 1;

  while (availableSlots.filter((s) => s.extraCommonRow === undefined).length < activeBays.length) {
    const ringCoords = getClockwiseRingCoords(ring);
    for (const [col, row] of ringCoords) {
      if (col === 0 && row === 1) continue; // reserved for common:0
      if (ring >= 3 && ring % 2 === 1 && col === 0 && row === ring) {
        availableSlots.push({ col, row, extraCommonRow: commonIdx++ });
      } else {
        availableSlots.push({ col, row });
      }
    }
    maxGridSide = Math.max(maxGridSide, ring + 1);
    ring++;
  }

  let bayCursor = 0;
  for (const slot of availableSlots) {
    if (bayCursor >= activeBays.length) break;
    if (slot.extraCommonRow !== undefined) {
      const cIdx = slot.extraCommonRow;
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
      const wing = wingByRow.get(cIdx) ?? createDefaultCommonWing(cIdx);
      pushFurniture(cZone, wing.furniture);
      continue;
    }

    const bay = activeBays[bayCursor++];
    const bayDept = bay.department ?? classifyDepartmentFromPath(bay.projectPath);
    const bayZone: ZoneBounds = {
      zoneId: `bay:${bay.id}`,
      kind: "bay",
      bayId: bay.id,
      department: bayDept,
      row: slot.row,
      col: slot.col,
      originX: slot.col * MODULE_PITCH_X,
      originY: slot.row * MODULE_PITCH_Y,
      width: ZONE_SIZE,
      height: ZONE_SIZE,
    };
    zones.push(bayZone);
    pushFurniture(bayZone, bay.furniture);
  }

  // Exact square overall campus dimensions (widthTiles === depthTiles)
  const sideTiles = maxGridSide * MODULE_PITCH_X - 1;
  const widthTiles = sideTiles;
  const depthTiles = sideTiles;

  // 4. Full architectural interior room walls with 2-tile doorways + seamless corner/T/cross junctions
  const cubicleDividerAssetId = theme === "office" ? "divider-cubicle-amber" : "divider-low-glass";
  const zoneAt = new Map<string, ZoneBounds>();
  for (const z of zones) zoneAt.set(`${z.col},${z.row}`, z);

  // Track occupied wall coordinates so junction tiles auto-tile seamlessly with zero gaps
  const wallTileSet = new Set<string>();
  const addRoomWallTile = (
    id: string,
    zoneId: ZoneId,
    tx: number,
    ty: number,
    assetId: string,
    direction: Direction,
  ) => {
    const key = `${tx},${ty}`;
    if (wallTileSet.has(key)) return;
    wallTileSet.add(key);
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

  const seamWallAsset = (a: ZoneBounds, b?: ZoneBounds): string => {
    if (b && a.kind === "bay" && b.kind === "bay" && a.department && a.department === b.department) {
      return cubicleDividerAssetId;
    }
    return "room-wall-glass";
  };

  for (const z of zones) {
    // Right vertical seam (tx = originX + 6)
    if (z.col + 1 < maxGridSide) {
      const right = zoneAt.get(`${z.col + 1},${z.row}`);
      const dividerTx = z.originX + ZONE_SIZE;
      const offsets = right ? [0, 1, 4, 5] : [0, 1, 2, 3, 4, 5]; // 2-tile doorway at offset 2..3 when room exists
      const wallAsset = seamWallAsset(z, right);
      for (const offsetY of offsets) {
        addRoomWallTile(
          `sys-div-v-${z.col}-${z.row}-${offsetY}`,
          z.zoneId,
          dividerTx,
          z.originY + offsetY,
          wallAsset,
          "sw",
        );
      }
    }
    // Left vertical seam bordering an empty slot (tx = originX - 1)
    if (z.col > 0 && !zoneAt.has(`${z.col - 1},${z.row}`)) {
      const dividerTx = z.originX - 1;
      for (const offsetY of [0, 1, 2, 3, 4, 5]) {
        addRoomWallTile(
          `sys-div-vl-${z.col}-${z.row}-${offsetY}`,
          z.zoneId,
          dividerTx,
          z.originY + offsetY,
          "room-wall-glass",
          "sw",
        );
      }
    }
    // Bottom horizontal seam (ty = originY + 6)
    if (z.row + 1 < maxGridSide) {
      const below = zoneAt.get(`${z.col},${z.row + 1}`);
      const dividerTy = z.originY + ZONE_SIZE;
      const offsets = below ? [0, 1, 4, 5] : [0, 1, 2, 3, 4, 5]; // 2-tile doorway at offset 2..3 when room exists
      const wallAsset = seamWallAsset(z, below);
      for (const offsetX of offsets) {
        addRoomWallTile(
          `sys-div-h-${z.col}-${z.row}-${offsetX}`,
          z.zoneId,
          z.originX + offsetX,
          dividerTy,
          wallAsset,
          "se",
        );
      }
    }
    // Top horizontal seam bordering an empty slot (ty = originY - 1)
    if (z.row > 0 && !zoneAt.has(`${z.col},${z.row - 1}`)) {
      const dividerTy = z.originY - 1;
      for (const offsetX of [0, 1, 2, 3, 4, 5]) {
        addRoomWallTile(
          `sys-div-ht-${z.col}-${z.row}-${offsetX}`,
          z.zoneId,
          z.originX + offsetX,
          dividerTy,
          "room-wall-glass",
          "se",
        );
      }
    }
  }

  // Auto-tile seam junction pillars (+, T, L) at every room intersection (col*7 + 6, row*7 + 6)
  for (let row = 0; row < maxGridSide - 1; row++) {
    for (let col = 0; col < maxGridSide - 1; col++) {
      const jx = col * MODULE_PITCH_X + ZONE_SIZE;
      const jy = row * MODULE_PITCH_Y + ZONE_SIZE;
      const negX = wallTileSet.has(`${jx - 1},${jy}`);
      const posX = wallTileSet.has(`${jx + 1},${jy}`);
      const negY = wallTileSet.has(`${jx},${jy - 1}`);
      const posY = wallTileSet.has(`${jx},${jy + 1}`);
      const count = (negX ? 1 : 0) + (posX ? 1 : 0) + (negY ? 1 : 0) + (posY ? 1 : 0);
      if (count === 0) continue;

      let assetId = "room-junction-cross";
      let dir: Direction = "se";
      if (count === 4) {
        assetId = "room-junction-cross";
        dir = "se";
      } else if (count === 3) {
        assetId = "room-junction-t";
        if (!negY) dir = "se"; // (-X, +X, +Y)
        else if (!posX) dir = "sw"; // (-Y, +Y, -X)
        else if (!posY) dir = "nw"; // (+X, -X, -Y)
        else dir = "ne"; // (+Y, -Y, +X)
      } else if (count === 2) {
        if (negX && posX) {
          assetId = "room-wall-glass";
          dir = "se";
        } else if (negY && posY) {
          assetId = "room-wall-glass";
          dir = "sw";
        } else {
          assetId = "room-junction-corner";
          if (posX && posY) dir = "se";
          else if (posY && negX) dir = "sw";
          else if (negX && negY) dir = "nw";
          else dir = "ne";
        }
      } else {
        assetId = "room-wall-glass";
        dir = negX || posX ? "se" : "sw";
      }

      const ownerZone =
        zoneAt.get(`${col},${row}`) ??
        zoneAt.get(`${col + 1},${row}`) ??
        zoneAt.get(`${col},${row + 1}`) ??
        zoneAt.get(`${col + 1},${row + 1}`) ??
        zones[0];
      addRoomWallTile(`sys-div-j-${col}-${row}`, ownerZone.zoneId, jx, jy, assetId, dir);
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
      const isRoomSeam = tx % MODULE_PITCH_X === ZONE_SIZE || ty % MODULE_PITCH_Y === ZONE_SIZE;
      const assetId = isRoomSeam
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

  // 6. Mount whiteboards, corkboards, and AC units flush along rear NE wall (ty=0) first
  // so perimeter windows never sit hidden behind wall decor
  const wallDecor: ComputedCampus["wallDecor"] = [];
  const decorBlockedTx = new Set<number>();

  for (const z of zones) {
    if (z.row === 0 && z.originX + 2 < widthTiles) {
      const useCorkboard =
        z.kind === "bay" && (z.department === "erp" || z.department === "accounting" || z.col % 2 === 1);
      const dtx = z.originX + 1;
      wallDecor.push({
        tx: dtx,
        ty: 0,
        assetId: useCorkboard ? "wall-corkboard" : "whiteboard-arch",
        edge: "ne",
      });
      decorBlockedTx.add(dtx);
      decorBlockedTx.add(dtx + 1);
    }
    if (z.row === 0 && z.originX + 5 < widthTiles) {
      const dtx = z.originX + 4;
      wallDecor.push({
        tx: dtx,
        ty: 0,
        assetId: "wall-ac-unit",
        edge: "ne",
      });
      decorBlockedTx.add(dtx);
      decorBlockedTx.add(dtx + 1);
    }
  }

  // Cutaway outer perimeter walls along full square rear edges: ty=0 (NE edge) and tx=0 (NW edge)
  const walls: ComputedCampus["walls"] = [
    { tx: 0, ty: 0, assetId: "wall-corner-pillar", edge: "corner" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "nw" },
    { tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "ne" },
  ];

  for (let tx = 1; tx < widthTiles; tx++) {
    const hitsInteriorWall = tx % MODULE_PITCH_X === ZONE_SIZE;
    const isWindow = tx % 4 === 2 && !decorBlockedTx.has(tx) && !hitsInteriorWall;
    walls.push({
      tx,
      ty: 0,
      assetId: isWindow ? "wall-night-window" : "wall-slate-plain",
      edge: "ne",
    });
  }
  for (let ty = 1; ty < depthTiles; ty++) {
    const hitsInteriorWall = ty % MODULE_PITCH_Y === ZONE_SIZE;
    const isWindow = ty % 4 === 2 && !hitsInteriorWall;
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
  const addWalkBlock = (assetId: string, lx: number, ly: number, dir: Direction) => {
    if (assetId === "chair-office-swivel") return;
    const c = catalogById.get(assetId);
    const [w, d] = getRotatedFootprint(c?.footprintTiles ?? [1, 1], dir);
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) {
        walkBlocked.add(`${lx + dx},${ly + dy}`);
      }
    }
  };
  for (const item of existingInZone) {
    if (candidate.ignoreInstanceId && item.id === candidate.ignoreInstanceId) continue;
    addWalkBlock(item.assetId, item.lx, item.ly, item.direction);
  }
  addWalkBlock(candidate.assetId, candidate.lx, candidate.ly, candidate.direction);

  const visited = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (const [ex, ey] of openEntrances) {
    const k = `${ex},${ey}`;
    if (!walkBlocked.has(k)) {
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
      if (visited.has(nk) || walkBlocked.has(nk)) continue;
      visited.add(nk);
      queue.push([nx, ny]);
    }
  }

  let totalWalkable = 0;
  for (let y = 0; y < ZONE_SIZE; y++) {
    for (let x = 0; x < ZONE_SIZE; x++) {
      if (!walkBlocked.has(`${x},${y}`)) totalWalkable++;
    }
  }
  if (visited.size < totalWalkable) {
    return {
      ok: false,
      reason: `Placing "${candidate.assetId}" at (${candidate.lx},${candidate.ly}) seals off part of zone "${candidate.zoneId}"`,
    };
  }

  return { ok: true };
}
