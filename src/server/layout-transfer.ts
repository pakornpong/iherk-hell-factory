import { getWallMountSurfaces, isMountedAsset, wallMountFits, wallMountOverlaps, wallMountPositionLimits } from "../shared/wall-mounts.js";
import { expandEdgeDividerSegments, isEdgeDividerAsset, isInBossArea, isOwnableChair, supportsHalfTilePlacement } from "../shared/layers.js";
import {
  OfficeLayoutFileSchema,
  type CatalogEntry,
  type ComputedCampus,
  type FurnitureInstance,
  type OfficeLayoutFile,
  type OfficeState,
} from "../shared/types.js";
import { createDefaultBossOffice } from "./layout-engine.js";

export function exportOfficeLayout(state: OfficeState, campus: ComputedCampus): OfficeLayoutFile {
  return OfficeLayoutFileSchema.parse({
    format: "iherk-office-layout",
    version: 1,
    theme: state.theme,
    widthTiles: campus.widthTiles,
    depthTiles: campus.depthTiles,
    bossFurniture: (state.bossOffice ?? createDefaultBossOffice()).furniture,
    ...(state.bossOffice?.x !== undefined ? { bossX: state.bossOffice.x } : {}),
    ...(state.bossOffice?.y !== undefined ? { bossY: state.bossOffice.y } : {}),
    ...(state.bossOffice?.width !== undefined ? { bossWidth: state.bossOffice.width } : {}),
    ...(state.bossOffice?.height !== undefined ? { bossHeight: state.bossOffice.height } : {}),
    ...(state.bossOffice?.hubX !== undefined ? { hubX: state.bossOffice.hubX } : {}),
    ...(state.bossOffice?.hubY !== undefined ? { hubY: state.bossOffice.hubY } : {}),
    zoneOverrides: state.zoneOverrides ?? {},
    bayFurniture: Object.fromEntries(state.bays.map((bay) => [`bay:${bay.id}`, bay.furniture])),
    commonFurniture: Object.fromEntries(state.commonWings.map((wing) => [wing.zoneId, wing.furniture])),
    customZones: state.customZones ?? [],
    floorTileOverrides: state.floorTileOverrides ?? {},
    tilePermissionOverrides: state.tilePermissionOverrides ?? {},
  });
}

export function getStoredFurniture(state: OfficeState): FurnitureInstance[] {
  return [
    ...(state.bossOffice ?? createDefaultBossOffice()).furniture,
    ...Object.values(state.zoneOverrides ?? {}).flat(),
    ...state.bays.flatMap((bay) => bay.furniture),
    ...state.commonWings.flatMap((wing) => wing.furniture),
  ];
}

function countFurnitureIds(state: OfficeState, campus: ComputedCampus): Map<string, number> {
  const counts = new Map<string, number>();
  const count = ({ id }: FurnitureInstance) => counts.set(id, (counts.get(id) ?? 0) + 1);
  getStoredFurniture(state).forEach(count);
  for (const item of campus.worldFurniture) {
    if ((item.zoneId === "cowork:0" || item.zoneId === "hypersleep:0") && !state.zoneOverrides?.[item.zoneId]) {
      count(item);
    }
  }
  return counts;
}

export function prepareOfficeLayoutImport(
  value: unknown,
  current: OfficeState,
  currentCampus: ComputedCampus,
  catalog: ReadonlyMap<string, CatalogEntry>,
  computeCampus: (state: OfficeState) => ComputedCampus,
): { state: OfficeState; campus: ComputedCampus } {
  const layout = OfficeLayoutFileSchema.parse(value);
  const width = layout.widthTiles;
  const depth = layout.depthTiles;

  for (const tiles of [layout.floorTileOverrides, layout.tilePermissionOverrides]) {
    for (const key of Object.keys(tiles)) {
      const [x, y] = key.split(",").map(Number);
      if (x >= width || y >= depth) throw new Error(`Tile ${key} is outside the imported floor`);
    }
  }
  for (const assetId of Object.values(layout.floorTileOverrides)) {
    if (catalog.get(assetId)?.layer !== "floor") throw new Error(`Unknown floor asset: ${assetId}`);
  }

  const zoneIds = new Set<string>();
  for (const zone of layout.customZones) {
    if (zoneIds.has(zone.id)) throw new Error(`Duplicate custom zone ID: ${zone.id}`);
    zoneIds.add(zone.id);
    if (zone.x + zone.width > width || zone.y + zone.height > depth) {
      throw new Error(`Zone "${zone.name}" is outside the imported floor`);
    }
  }

  const previouslyStored = getStoredFurniture(current);
  const permanentEmployees = new Set(current.employees.filter((employee) => !employee.isEphemeral).map((employee) => employee.id));
  const checkGroup = (zoneId: string, furniture: FurnitureInstance[]) => {
    for (const item of furniture) {
      if (item.zoneId !== zoneId) throw new Error(`Furniture ${item.id} belongs to the wrong zone`);
      const asset = catalog.get(item.assetId);
      if (!asset) throw new Error(`Unknown furniture asset: ${item.assetId}`);
      if (isMountedAsset(asset) !== Boolean(item.wallMountId) || (item.wallMountId && zoneId !== "floor:0") ||
        (item.wallMountPosition && !item.wallMountId)) {
        throw new Error(`Invalid wall attachment: ${item.id}`);
      }
      if (asset.layer !== item.layer) {
        const legacy = previouslyStored.some((previous) =>
          previous.id === item.id && Object.keys(previous).length === Object.keys(item).length &&
          (Object.keys(item) as Array<keyof FurnitureInstance>).every((key) => previous[key] === item[key]),
        );
        if (!legacy) throw new Error(`Furniture ${item.id} does not match the layer of asset ${item.assetId}`);
      }
      if (item.ownerEmployeeId && !permanentEmployees.has(item.ownerEmployeeId)) delete item.ownerEmployeeId;
      if (!supportsHalfTilePlacement(item.assetId) && (!Number.isInteger(item.lx) || !Number.isInteger(item.ly))) {
        throw new Error(`Furniture ${item.id} requires whole-tile coordinates`);
      }
    }
  };
  checkGroup("boss:0", layout.bossFurniture);
  for (const groups of [layout.zoneOverrides, layout.bayFurniture, layout.commonFurniture]) {
    for (const [zoneId, furniture] of Object.entries(groups)) checkGroup(zoneId, furniture);
  }

  const next: OfficeState = {
    ...current,
    theme: layout.theme,
    floorWidthTiles: width,
    floorDepthTiles: depth,
    bossOffice: (() => {
      // The file defines the Boss corner size; older files without it get the default 6x6
      const { x: _x, y: _y, width: _w, height: _h, hubX: _hx, hubY: _hy, ...base } = current.bossOffice ?? createDefaultBossOffice();
      return {
        ...base,
        furniture: layout.bossFurniture,
        ...(layout.bossX !== undefined ? { x: layout.bossX } : {}),
        ...(layout.bossY !== undefined ? { y: layout.bossY } : {}),
        ...(layout.bossWidth !== undefined ? { width: layout.bossWidth } : {}),
        ...(layout.bossHeight !== undefined ? { height: layout.bossHeight } : {}),
        ...(layout.hubX !== undefined ? { hubX: layout.hubX } : {}),
        ...(layout.hubY !== undefined ? { hubY: layout.hubY } : {}),
      };
    })(),
    zoneOverrides: layout.zoneOverrides,
    bays: current.bays.map((bay) => ({
      ...bay, furniture: layout.bayFurniture[`bay:${bay.id}`] ?? bay.furniture,
    })),
    commonWings: current.commonWings.map((wing) => ({
      ...wing, furniture: layout.commonFurniture[wing.zoneId] ?? wing.furniture,
    })),
    customZones: layout.customZones,
    floorTileOverrides: layout.floorTileOverrides,
    tilePermissionOverrides: layout.tilePermissionOverrides,
  };
  // Validate assignments across imported and retained furniture.
  const assigned = new Set<string>();
  for (const item of getStoredFurniture(next)) {
    const owner = item.ownerEmployeeId;
    if (!owner || !permanentEmployees.has(owner)) continue;
    if (!isOwnableChair(item)) throw new Error(`Furniture ${item.id} cannot have a seat owner`);
    if (assigned.has(owner)) throw new Error(`Employee ${owner} already owns another chair`);
    assigned.add(owner);
  }

  const campus = computeCampus(next);
  const bossZone = campus.zones.find((zone) => zone.kind === "boss");
  for (const item of campus.worldFurniture) {
    if (bossZone && item.zoneId === "boss:0" &&
      (item.tx + item.footprintTiles[0] > bossZone.originX + bossZone.width ||
        item.ty + item.footprintTiles[1] > bossZone.originY + bossZone.height)) {
      throw new Error(`Furniture ${item.id} is outside the imported Boss zone`);
    }
    if (item.ownerEmployeeId && isInBossArea(campus, item)) {
      throw new Error(`Furniture ${item.id} is in the Boss area and cannot have a seat owner`);
    }
  }
  // Existing layouts can contain historical duplicate IDs. Preserve those
  // arrangements, but do not introduce new ambiguous furniture references.
  const currentCounts = countFurnitureIds(current, currentCampus);
  for (const [id, count] of countFurnitureIds(next, campus)) {
    if (count > Math.max(1, currentCounts.get(id) ?? 0)) throw new Error(`Duplicate furniture ID: ${id}`);
  }

  const surfaces = new Map(getWallMountSurfaces(campus).map((surface) => [surface.id, surface]));
  for (const item of campus.worldFurniture) {
    if (item.wallMountId) {
      const surface = surfaces.get(item.wallMountId);
      const asset = catalog.get(item.assetId);
      if (!surface || (item.wallMountPosition &&
        !wallMountFits(wallMountPositionLimits(surfaces.values(), surface, asset), item.wallMountPosition)) ||
        wallMountOverlaps(campus.worldFurniture, surfaces, catalog, surface, asset, item.wallMountPosition, item.id)) {
        throw new Error(`Unavailable wall attachment: ${item.wallMountId}`);
      }
      continue;
    }
    // Generated Pods adapt to the recipient's employee count. Explicit placements are fixed.
    if (item.zoneId === "hypersleep:0" && layout.zoneOverrides["hypersleep:0"] === undefined) continue;
    const outside = isEdgeDividerAsset(item.assetId)
      ? expandEdgeDividerSegments(item.assetId, item.tx, item.ty, item.direction).some(({ axis, rx, ry }) =>
        rx < (axis === "x" ? 0 : -0.5) || ry < (axis === "y" ? 0 : -0.5) ||
        rx > width - (axis === "x" ? 1 : 0.5) || ry > depth - (axis === "y" ? 1 : 0.5),
      )
      : item.tx < 0 || item.ty < 0 ||
        item.tx + item.footprintTiles[0] > width || item.ty + item.footprintTiles[1] > depth;
    if (outside) throw new Error(`Furniture ${item.id} is outside the imported floor`);
  }
  return { state: next, campus };
}
