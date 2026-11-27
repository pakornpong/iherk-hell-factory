import type { CatalogEntry, ComputedCampus, Direction, FurnitureInstance, WallMountPosition, WorldFurnitureInstance } from "./types.js";

const VOXELS_PER_TILE = 32;
export const WALL_MOUNT_PIVOT_X = 16;

export interface WallMountSurface {
  id: string;
  hostId?: string;
  wall?: "nw" | "ne";
  tx: number;
  ty: number;
  direction: Direction;
  centerHeight: number;
  bounds: WallMountRect;
  legacyOffset?: number;
}

interface WallMountRect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export type WallMountSelection = Pick<FurnitureInstance, "wallMountPosition"> & { wallMountId: string };

const TANGENTS: Record<Direction, readonly [number, number]> = {
  se: [1, 0], sw: [0, 1], nw: [-1, 0], ne: [0, -1],
};

export function wallMountTangent(direction: Direction): readonly [number, number] {
  return TANGENTS[direction];
}

export function isMountedAsset(asset?: CatalogEntry): asset is CatalogEntry & {
  layer: "wall-decor"; source: "library"; footprintTiles: [1, 1];
} {
  return asset?.layer === "wall-decor" && asset.source === "library" &&
    asset.footprintTiles[0] === 1 && asset.footprintTiles[1] === 1;
}

export function getWallMountSurfaces(
  campus: Pick<ComputedCampus, "walls" | "wallSegments" | "worldFurniture">,
): WallMountSurface[] {
  const surfaces: WallMountSurface[] = [];
  for (const { tx, ty, edge, assetId } of campus.walls) {
    if (edge === "corner" || assetId !== "wall-slate-plain") continue;
    surfaces.push({
      id: `wall:${edge}:${edge === "nw" ? ty : tx}`,
      wall: edge,
      tx: tx + (edge === "nw" ? 4 / VOXELS_PER_TILE : 0),
      ty: ty + (edge === "ne" ? 4 / VOXELS_PER_TILE : 0),
      direction: edge === "nw" ? "ne" : "se",
      centerHeight: 52,
      bounds: { left: -16, right: 16, bottom: 0, top: 96 },
    });
  }

  const furnitureById = new Map(campus.worldFurniture.map((item) => [item.id, item]));
  for (const segment of campus.wallSegments) {
    if (!segment.id.startsWith("ef:") || !segment.blocks || segment.axis === "point") continue;
    const hostId = segment.id.slice(3, segment.id.lastIndexOf(":"));
    const direction = furnitureById.get(hostId)?.direction;
    const low = segment.assetId === "divider-solid-slate";
    addPanelFaces(surfaces, segment.id, hostId, segment.axis, segment.rx, segment.ry,
      low ? 11 : 28, direction === "sw" || direction === "nw", 19,
      { left: -16, right: 16, bottom: 0, top: low ? 22 : 57 });
  }

  for (const item of campus.worldFurniture) {
    const panel = STANDING_PANELS.get(item.assetId);
    if (!panel) continue;
    const [dx, dy] = wallMountTangent(item.direction);
    const axis = dx === 0 ? "y" : "x";
    const reverseSlotOrder = dx < 0 || dy < 0;
    const faceIsReversed = item.direction === "nw" || item.direction === "sw";
    const length = item.footprintTiles[axis === "x" ? 0 : 1];
    for (let slot = 0; slot < length; slot++) {
      const offset = reverseSlotOrder ? length - 1 - slot : slot;
      // The original center-only mounts numbered the Y-oriented slots in reverse.
      const legacySlot = faceIsReversed ? length - 1 - slot : slot;
      const localStart = slot * VOXELS_PER_TILE + WALL_MOUNT_PIVOT_X;
      const left = Math.max(-16, panel.left - localStart);
      const right = Math.min(16, panel.right - localStart);
      const forward = !reverseSlotOrder;
      addPanelFaces(surfaces, `panel:${item.id}:${slot}`, item.id, axis,
        item.tx + (axis === "x" ? offset : 0), item.ty + (axis === "y" ? offset : 0),
        panel.centerHeight, faceIsReversed, panel.depth,
        { left: forward ? left : -right, right: forward ? right : -left, bottom: panel.bottom, top: panel.top },
        legacySlot - offset);
    }
  }
  return surfaces;
}

const STANDING_PANELS = new Map([
  ["divider-open-oak-slat-screen", { centerHeight: 22, depth: 17, left: 4, right: 60, bottom: 7, top: 31 }],
  ["divider-moss-felt-privacy-panel", { centerHeight: 19, depth: 21, left: 4, right: 28, bottom: 6, top: 33 }],
]);

function addPanelFaces(
  surfaces: WallMountSurface[], key: string, hostId: string, axis: "x" | "y", tx: number, ty: number,
  centerHeight: number, reverse: boolean, depth: number, bounds: WallMountRect, legacySlotDifference = 0,
): void {
  for (const side of [1, -1]) {
    const sign = reverse ? -side : side;
    const offset = sign * depth / VOXELS_PER_TILE;
    const direction = axis === "x" ? (sign > 0 ? "se" : "nw") : (sign > 0 ? "ne" : "sw");
    const [dx, dy] = wallMountTangent(direction);
    surfaces.push({
      id: `${key}:${side}`, hostId,
      tx: tx + (axis === "y" ? offset : 0),
      ty: ty + (axis === "x" ? offset : 0),
      direction,
      centerHeight,
      bounds: dx < 0 || dy < 0 ? { ...bounds, left: -bounds.right, right: -bounds.left } : bounds,
      ...(legacySlotDifference ? { legacyOffset: legacySlotDifference * (dx || dy) * VOXELS_PER_TILE } : {}),
    });
  }
}

export function wallMountAssetBounds(asset?: CatalogEntry): WallMountRect {
  return asset?.wallMountBounds ?? { left: 0, right: VOXELS_PER_TILE, bottom: 0, top: asset?.wallMountHeightVoxels ?? 28 };
}

function centeredPosition(surface: WallMountSurface, asset?: CatalogEntry): WallMountPosition {
  return {
    offset: surface.legacyOffset ?? 0,
    lift: Math.max(1, Math.round(surface.centerHeight - (asset?.wallMountHeightVoxels ?? 28) / 2)),
  };
}

export function wallMountPose(surface: WallMountSurface, asset?: CatalogEntry, position?: WallMountPosition) {
  const { offset, lift } = position ?? centeredPosition(surface, asset);
  const [dx, dy] = wallMountTangent(surface.direction);
  return {
    pose: {
      tx: surface.tx + dx * offset / VOXELS_PER_TILE,
      ty: surface.ty + dy * offset / VOXELS_PER_TILE,
      direction: surface.direction,
      wall: surface.wall,
    },
    lift,
  };
}

function relativeOrigin(surface: WallMountSurface, other: WallMountSurface): number {
  const [dx, dy] = wallMountTangent(surface.direction);
  return ((other.tx - surface.tx) * dx + (other.ty - surface.ty) * dy) * VOXELS_PER_TILE;
}

function sameFace(surface: WallMountSurface, other: WallMountSurface): boolean {
  if (surface.direction !== other.direction || surface.wall !== other.wall || surface.hostId !== other.hostId) return false;
  const [dx, dy] = wallMountTangent(surface.direction);
  return dx ? surface.ty === other.ty : dy !== 0 && surface.tx === other.tx;
}

export function wallMountAvailableBounds(
  surfaces: Iterable<WallMountSurface>, surface: WallMountSurface,
): WallMountRect {
  const { bottom, top } = surface.bounds;
  const sections = [...surfaces].filter((other) => sameFace(surface, other) &&
    other.bounds.bottom === bottom && other.bounds.top === top).map((other) => {
    const offset = relativeOrigin(surface, other);
    return [offset + other.bounds.left, offset + other.bounds.right];
  }).sort(([leftA], [leftB]) => leftA - leftB);
  let left = Infinity;
  let right = -Infinity;
  for (const [start, end] of sections) {
    if (start > right) {
      if (left <= surface.bounds.left && right >= surface.bounds.right) break;
      left = start;
      right = end;
    } else {
      right = Math.max(right, end);
    }
  }
  return { left, right, bottom, top };
}

export function wallMountPositionLimits(
  surfaces: Iterable<WallMountSurface>, surface: WallMountSurface, asset?: CatalogEntry,
): WallMountRect {
  const face = wallMountAvailableBounds(surfaces, surface);
  const model = wallMountAssetBounds(asset);
  return {
    left: Math.max(-32, face.left + WALL_MOUNT_PIVOT_X - model.left),
    right: Math.min(32, face.right + WALL_MOUNT_PIVOT_X - model.right),
    bottom: Math.max(0, face.bottom - model.bottom),
    top: Math.min(96, face.top - model.top),
  };
}

export function wallMountFits(limits: WallMountRect, { offset, lift }: WallMountPosition): boolean {
  return Number.isInteger(offset) && Number.isInteger(lift) &&
    offset >= limits.left && offset <= limits.right && lift >= limits.bottom && lift <= limits.top;
}

function mountedRect(surface: WallMountSurface, asset?: CatalogEntry, position?: WallMountPosition): WallMountRect {
  const { offset, lift } = position ?? centeredPosition(surface, asset);
  const shape = wallMountAssetBounds(asset);
  return {
    left: shape.left - WALL_MOUNT_PIVOT_X + offset,
    right: shape.right - WALL_MOUNT_PIVOT_X + offset,
    bottom: shape.bottom + lift,
    top: shape.top + lift,
  };
}

export function wallMountOverlaps(
  furniture: readonly WorldFurnitureInstance[],
  surfaces: ReadonlyMap<string, WallMountSurface>,
  catalog: ReadonlyMap<string, CatalogEntry>,
  surface: WallMountSurface,
  asset?: CatalogEntry,
  position?: WallMountPosition,
  ignoreId?: string,
): boolean {
  const candidate = mountedRect(surface, asset, position);
  return furniture.some((item) => {
    if (!item.wallMountId || item.id === ignoreId) return false;
    const other = surfaces.get(item.wallMountId);
    if (!other || !sameFace(surface, other)) return false;
    const shift = relativeOrigin(surface, other);
    const bounds = mountedRect(other, catalog.get(item.assetId), item.wallMountPosition);
    return candidate.left < bounds.right + shift && candidate.right > bounds.left + shift &&
      candidate.bottom < bounds.top && candidate.top > bounds.bottom;
  });
}
