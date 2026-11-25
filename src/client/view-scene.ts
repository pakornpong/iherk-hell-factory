import { expandEdgeDividerSegments, isEdgeDividerAsset, parseTileKey, toTileKey } from "../shared/layers.js";
import type { CatalogEntry, ComputedCampus, OfficeState } from "../shared/types.js";
import type { IsoView } from "./camera.js";
import type { DecorateGhostInput, RenderSceneInput } from "./iso-renderer.js";

type WallSegment = ComputedCampus["wallSegments"][number];

export function rotateWallSegment<T extends Pick<WallSegment, "axis" | "rx" | "ry" | "direction" | "blocks">>(
  segment: T,
  view: IsoView,
): T {
  const [rx, ry] = view.toView(segment.rx, segment.ry);
  if (segment.axis === "point") {
    return { ...segment, rx, ry, direction: view.toViewDirection(segment.direction) };
  }
  const axis = view.swapsAxes ? (segment.axis === "x" ? "y" : "x") : segment.axis;
  const blocks = segment.blocks
    ? axis === "x" ? { x: rx, y: ry + 0.5, side: "n" as const } : { x: rx + 0.5, y: ry, side: "w" as const }
    : null;
  return { ...segment, rx, ry, axis, blocks, direction: axis === "x" ? "se" : "sw" };
}

export function getViewDividerSegments(
  assetId: string,
  tx: number,
  ty: number,
  direction: DecorateGhostInput["direction"],
  view: IsoView,
) {
  const [x, y] = view.toOffice(tx, ty);
  return expandEdgeDividerSegments(assetId, x, y, view.toOfficeDirection(direction)).map((segment) =>
    view.turns === 0 ? segment : rotateWallSegment(segment, view),
  );
}

function cutawayWalls(campus: ComputedCampus, width: number, depth: number, view: IsoView): ComputedCampus["walls"] {
  // The decorative cutaway is drawn behind the floor from each camera angle.
  // Reuse the edge styles supplied by the campus, including windows and corner pillars.
  const { walls } = campus;
  const corner = walls.filter((wall) => wall.edge === "corner").map((wall) => ({ ...wall, tx: 0, ty: 0 }));
  const makeEdge = (edge: "nw" | "ne", length: number) => {
    const sourceEdge = view.swapsAxes ? (edge === "nw" ? "ne" : "nw") : edge;
    const styles = walls.filter((wall) => wall.edge === sourceEdge);
    if (!styles.length) return [];
    return Array.from({ length }, (_, i) => ({
      ...styles[i % styles.length],
      tx: edge === "ne" ? i : 0,
      ty: edge === "nw" ? i : 0,
      edge,
    }));
  };
  return [...corner, ...makeEdge("ne", width), ...makeEdge("nw", depth)];
}

export function rotateCampus(campus: ComputedCampus, view: IsoView): ComputedCampus {
  if (view.turns === 0) return campus;
  const { widthTiles: width, depthTiles: depth } = campus;
  const [widthTiles, depthTiles] = view.swapsAxes ? [depth, width] : [width, depth];
  const tilePermissions = campus.tilePermissions?.slice();
  if (tilePermissions && campus.tilePermissions) {
    for (const [index, permission] of campus.tilePermissions.entries()) {
      const [x, y] = view.toView(index % width, Math.floor(index / width));
      tilePermissions[y * widthTiles + x] = permission;
    }
  }
  return {
    ...campus,
    widthTiles,
    depthTiles,
    tilePermissions,
    zones: campus.zones.map((zone) => {
      const [originX, originY, width, height] = view.rect(zone.originX, zone.originY, zone.width, zone.height);
      return { ...zone, originX, originY, width, height };
    }),
    floors: campus.floors.map((floor) => {
      const [tx, ty] = view.toView(floor.tx, floor.ty);
      return { ...floor, tx, ty, direction: view.toViewDirection(floor.direction) };
    }),
    walls: cutawayWalls(campus, widthTiles, depthTiles, view),
    wallDecor: campus.wallDecor.flatMap<ComputedCampus["wallDecor"][number]>((decor) => {
      const [tx, ty] = view.toView(decor.tx, decor.ty);
      const [nx, ny] = view.toView(decor.tx - Number(decor.edge === "nw"), decor.ty - Number(decor.edge === "ne"));
      if (nx === -1) return [{ ...decor, tx, ty, edge: "nw" as const }];
      if (ny === -1) return [{ ...decor, tx, ty, edge: "ne" as const }];
      return [];
    }),
    wallSegments: campus.wallSegments.map((segment) => rotateWallSegment(segment, view)),
    worldFurniture: campus.worldFurniture.map((furniture) => {
      const [tx, ty, w, h] = view.rect(furniture.tx, furniture.ty, ...furniture.footprintTiles);
      return { ...furniture, tx, ty, footprintTiles: [w, h], direction: view.toViewDirection(furniture.direction) };
    }),
  };
}

function rotateState(state: OfficeState, view: IsoView): OfficeState {
  const tilePermissionOverrides: OfficeState["tilePermissionOverrides"] = {};
  for (const [key, value] of Object.entries(state.tilePermissionOverrides ?? {})) {
    const tile = parseTileKey(key);
    if (tile) tilePermissionOverrides[toTileKey(...view.toView(...tile))] = value;
  }
  const customZones = state.customZones?.map((zone) => {
    const [x, y, width, height] = view.rect(zone.x, zone.y, zone.width, zone.height);
    return { ...zone, x, y, width, height };
  });
  return { ...state, tilePermissionOverrides, customZones };
}

function rotateGhost(ghost: DecorateGhostInput, view: IsoView, catalog?: CatalogEntry): DecorateGhostInput {
  let [width, height] = catalog?.footprintTiles ?? [1, 1];
  if (ghost.direction === "ne" || ghost.direction === "sw") [width, height] = [height, width];
  if (ghost.brushSize) width = height = ghost.brushSize;
  if (isEdgeDividerAsset(ghost.assetId)) width = height = 1;
  const [tx, ty] = view.rect(ghost.tx, ghost.ty, width, height);
  return { ...ghost, tx, ty, direction: view.toViewDirection(ghost.direction) };
}

export class ViewScene {
  private cache?: {
    view: IsoView;
    campus: ComputedCampus;
    projectedCampus: ComputedCampus;
    state: OfficeState;
    projectedState: OfficeState;
  };

  project(input: RenderSceneInput): RenderSceneInput {
    const { camera, campus, state, zoneEditor, hoverTile, ghost } = input;
    const view = camera.view;
    if (view.turns === 0) return input;
    let cached = this.cache;
    if (!cached || cached.view !== view || cached.campus !== campus || cached.state !== state) {
      cached = this.cache = {
        view, campus, state,
        projectedCampus: cached?.view === view && cached.campus === campus ? cached.projectedCampus : rotateCampus(campus, view),
        projectedState: rotateState(state, view),
      };
    }
    return {
      ...input,
      campus: cached.projectedCampus,
      state: cached.projectedState,
      hoverTile: hoverTile ? view.toView(...hoverTile) : null,
      zoneEditor: zoneEditor && {
        ...zoneEditor,
        startTile: zoneEditor.startTile ? view.toView(...zoneEditor.startTile) : null,
        hoverTile: zoneEditor.hoverTile ? view.toView(...zoneEditor.hoverTile) : null,
      },
      ghost: ghost && rotateGhost(ghost, view, input.catalogById?.get(ghost.assetId)),
      employees: input.employees.map((employee) => {
        const [x, y] = view.toView(employee.x, employee.y);
        return { ...employee, x, y, direction: view.toViewDirection(employee.direction) };
      }),
      syncPackets: input.syncPackets.map((packet) => {
        const [fromX, fromY] = view.toView(packet.fromX, packet.fromY);
        const [toX, toY] = view.toView(packet.toX, packet.toY);
        return { ...packet, fromX, fromY, toX, toY };
      }),
    };
  }
}
