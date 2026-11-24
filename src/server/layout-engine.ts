import type {
  CatalogEntry,
  CommonWingRecord,
  ComputedCampus,
  Direction,
  FurnitureInstance,
  ProjectBayRecord,
  WorldFurnitureInstance,
  ZoneBounds,
  ZoneId,
} from "../shared/types.js";

export const ZONE_SIZE = 6;
export const MODULE_PITCH_X = 7; // 6-tile zone + 1-tile vertical divider/aisle
export const MODULE_PITCH_Y = 8; // 6-tile zone + 2-tile main horizontal corridor
export const BAYS_PER_ROW = 3; // col 0 = common wing, cols 1..3 = project bays

export function getRotatedFootprint(
  base: [number, number],
  direction: Direction,
): [number, number] {
  if (direction === "sw" || direction === "ne") {
    return [base[1], base[0]];
  }
  return [base[0], base[1]];
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
      { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 5, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-cooler`, zoneId, lx: 5, ly: 2, assetId: "water-cooler", direction: "sw", layer: "object", placedBy: "system" },
    ],
  };
}

export function createDefaultBayFurniture(bayId: string): FurnitureInstance[] {
  const zoneId: ZoneId = `bay:${bayId}`;
  return [
    { id: `${zoneId}-desk-0`, zoneId, lx: 1, ly: 1, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-chair-0`, zoneId, lx: 1, ly: 2, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    { id: `${zoneId}-desk-1`, zoneId, lx: 3, ly: 1, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-chair-1`, zoneId, lx: 4, ly: 2, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    { id: `${zoneId}-rack`, zoneId, lx: 5, ly: 0, assetId: "server-rack", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-shelf`, zoneId, lx: 0, ly: 0, assetId: "bookshelf-wood", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-plant`, zoneId, lx: 0, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "system" },
    { id: `${zoneId}-sign`, zoneId, lx: 5, ly: 5, assetId: "bay-sign-post", direction: "se", layer: "object", placedBy: "system" },
  ];
}

export function createExtraBayWorkstations(bayId: string, desiredDeskSlots: number, existing: FurnitureInstance[]): FurnitureInstance[] {
  const zoneId: ZoneId = `bay:${bayId}`;
  const added: FurnitureInstance[] = [];
  const hasId = (id: string) => existing.some((f) => f.id === id);

  if (desiredDeskSlots >= 3 && !hasId(`${zoneId}-desk-2`)) {
    added.push(
      { id: `${zoneId}-desk-2`, zoneId, lx: 1, ly: 3, assetId: "desk-security-ops", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-chair-2`, zoneId, lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    );
  }
  if (desiredDeskSlots >= 4 && !hasId(`${zoneId}-desk-3`)) {
    added.push(
      { id: `${zoneId}-desk-3`, zoneId, lx: 3, ly: 3, assetId: "desk-dev-dual", direction: "se", layer: "object", placedBy: "system" },
      { id: `${zoneId}-chair-3`, zoneId, lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "nw", layer: "object", placedBy: "system" },
    );
  }
  return added;
}

export function computeCampusLayout(
  bays: ProjectBayRecord[],
  commonWings: CommonWingRecord[],
  catalogById: Map<string, CatalogEntry>,
): ComputedCampus {
  const activeBays = bays.filter((b) => !b.archived);
  const bayCount = Math.max(1, activeBays.length);
  const rowCount = Math.max(1, Math.ceil(bayCount / BAYS_PER_ROW));
  const maxColsInAnyRow = activeBays.length === 0 ? 2 : Math.min(1 + activeBays.length, 1 + BAYS_PER_ROW);

  const widthTiles = maxColsInAnyRow * MODULE_PITCH_X - 1;
  const depthTiles = rowCount * MODULE_PITCH_Y - 2;

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

  // 1. Common wings anchored at col=0 of every active row
  for (let row = 0; row < rowCount; row++) {
    const zoneId: ZoneId = `common:${row}`;
    const zone: ZoneBounds = {
      zoneId,
      kind: "common",
      row,
      col: 0,
      originX: 0,
      originY: row * MODULE_PITCH_Y,
      width: ZONE_SIZE,
      height: ZONE_SIZE,
    };
    zones.push(zone);
    const wing = wingByRow.get(row) ?? createDefaultCommonWing(row);
    pushFurniture(zone, wing.furniture);
  }

  // 2. Active project bays compacted into consecutive (row, col = 1..3) slots
  activeBays.forEach((bay, idx) => {
    const row = Math.floor(idx / BAYS_PER_ROW);
    const col = 1 + (idx % BAYS_PER_ROW);
    const zone: ZoneBounds = {
      zoneId: `bay:${bay.id}`,
      kind: "bay",
      bayId: bay.id,
      row,
      col,
      originX: col * MODULE_PITCH_X,
      originY: row * MODULE_PITCH_Y,
      width: ZONE_SIZE,
      height: ZONE_SIZE,
    };
    zones.push(zone);
    pushFurniture(zone, bay.furniture);
  });

  // 3. Low dividers in the 1-tile seam between adjacent modules in the same row (leaves bottom walkway open!)
  for (let row = 0; row < rowCount; row++) {
    const rowZones = zones.filter((z) => z.row === row).sort((a, b) => a.col - b.col);
    for (let i = 0; i < rowZones.length - 1; i++) {
      const left = rowZones[i];
      const dividerTx = left.originX + ZONE_SIZE;
      for (const offsetY of [0, 1, 2]) {
        worldFurniture.push({
          id: `sys-div-${row}-${i}-${offsetY}`,
          zoneId: left.zoneId,
          lx: 5,
          ly: offsetY,
          assetId: "divider-low-glass",
          direction: "sw",
          layer: "object",
          placedBy: "system",
          tx: dividerTx,
          ty: left.originY + offsetY,
          footprintTiles: [1, 1],
        });
      }
    }
  }

  // 4. Seamless floors across the entire campus
  const floors: ComputedCampus["floors"] = [];
  for (let ty = 0; ty < depthTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      // Cozy rug tiles under the lounge corner of every Common Wing
      const inCommonX = tx >= 3 && tx <= 5;
      const localY = ty % MODULE_PITCH_Y;
      const isLoungeRug = inCommonX && localY >= 3 && localY <= 5;
      floors.push({
        tx,
        ty,
        assetId: isLoungeRug ? "floor-lounge-rug" : "floor-wood-plank",
        direction: "se",
      });
    }
  }

  // 5. Cutaway outer perimeter walls ONLY along ty = 0 (NW) and tx = 0 (NE)
  const walls: ComputedCampus["walls"] = [
    { tx: 0, ty: 0, assetId: "wall-corner-pillar", edge: "corner" },
  ];
  const wallDecor: ComputedCampus["wallDecor"] = [];

  for (let tx = 1; tx < widthTiles; tx++) {
    const isWindow = tx % 4 === 2;
    walls.push({
      tx,
      ty: 0,
      assetId: isWindow ? "wall-night-window" : "wall-slate-plain",
      edge: "nw",
    });
  }
  for (let ty = 1; ty < depthTiles; ty++) {
    const isWindow = ty % 3 === 1;
    walls.push({
      tx: 0,
      ty,
      assetId: isWindow ? "wall-night-window" : "wall-slate-plain",
      edge: "ne",
    });
  }

  // Mount architecture whiteboards along back wall of row-0 zones
  for (const z of zones) {
    if (z.row === 0 && z.originX + 1 < widthTiles) {
      wallDecor.push({
        tx: z.originX + 1,
        ty: 0,
        assetId: "whiteboard-arch",
        edge: "nw",
      });
    }
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

  // Build occupancy grid for this 6x6 zone
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
  if (occ.has("2,5") && occ.has("3,5")) {
    return { ok: false, reason: `Cannot block both entrance tiles (2,5) and (3,5) of zone "${candidate.zoneId}"` };
  }

  return { ok: true };
}
