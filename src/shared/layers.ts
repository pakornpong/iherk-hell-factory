import type { CatalogEntry, ComputedCampus, Direction, AssetLayer } from "./types.js";

/**
 * Pokémon GBA-inspired tile movement permissions.
 *  - 0: Blocked (impassable — solid furniture, obstacles, blocked overrides)
 *  - 1: Walkable (normal open floor)
 *  - 2: Seat / Interactable (walkable for sitting/interaction, e.g. swivel chairs)
 *  - 3: Doorway / Transition (walkable doorway between rooms)
 */
export const TILE_PERM = {
  BLOCKED: 0,
  WALKABLE: 1,
  SEAT: 2,
  DOOR: 3,
} as const;

export type TilePermission = (typeof TILE_PERM)[keyof typeof TILE_PERM];

export interface TilePermissionMeta {
  code: TilePermission;
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  fillRgba: string;
}

export const TILE_PERM_META: Record<TilePermission, TilePermissionMeta> = {
  [TILE_PERM.BLOCKED]: {
    code: 0,
    key: "blocked",
    label: "0 · Blocked (เหยียบไม่ได้)",
    shortLabel: "0",
    color: "#ef4444",
    fillRgba: "rgba(239, 68, 68, 0.30)",
  },
  [TILE_PERM.WALKABLE]: {
    code: 1,
    key: "walkable",
    label: "1 · Walkable (เดินได้)",
    shortLabel: "1",
    color: "#22c55e",
    fillRgba: "rgba(34, 197, 94, 0.22)",
  },
  [TILE_PERM.SEAT]: {
    code: 2,
    key: "seat",
    label: "2 · Seat / Interact (ที่นั่ง)",
    shortLabel: "2",
    color: "#38bdf8",
    fillRgba: "rgba(56, 189, 248, 0.30)",
  },
  [TILE_PERM.DOOR]: {
    code: 3,
    key: "door",
    label: "3 · Doorway (ประตู)",
    shortLabel: "3",
    color: "#f59e0b",
    fillRgba: "rgba(245, 158, 11, 0.30)",
  },
};

/**
 * Explicit render elevation layers (Character = 4).
 *
 * In isometric depth-sorting:
 *  - Layer 1 (FLOOR) is always drawn before layers >= 2 (flat floor/mats never cover characters).
 *  - Layers 2..6 obey spatial isometric (x, y) occlusion when spatially separated (so a tabletop
 *    prop or chair backrest in a back room never pokes through a glass wall into the front room),
 *    and obey `renderLayer` ascending when footprints overlap (e.g. chair 2 -> char 4 -> backrest 6,
 *    or desk 4 -> tabletop prop 5).
 *  - Layer 7 (OVERLAY) is always drawn on top of layers <= 6.
 */
export const RENDER_LAYER = {
  FLOOR: 1,
  LOW: 2,
  BACK: 3,
  CHARACTER: 4,
  TABLETOP: 5,
  FOREGROUND: 6,
  OVERLAY: 7,
} as const;

export type RenderLayer = (typeof RENDER_LAYER)[keyof typeof RENDER_LAYER];

export interface RenderLayerMeta {
  layer: RenderLayer;
  key: string;
  label: string;
  badge: string;
  color: string;
}

export const RENDER_LAYER_META: Record<RenderLayer, RenderLayerMeta> = {
  [RENDER_LAYER.FLOOR]: {
    layer: 1,
    key: "floor",
    label: "L1 · Floor / Mat (พื้น/พรม)",
    badge: "L1",
    color: "#22c55e",
  },
  [RENDER_LAYER.LOW]: {
    layer: 2,
    key: "low",
    label: "L2 · Low / Seat (ฐานเตี้ย/เบาะ)",
    badge: "L2",
    color: "#38bdf8",
  },
  [RENDER_LAYER.BACK]: {
    layer: 3,
    key: "back",
    label: "L3 · Back Plane (หลังตัวละคร)",
    badge: "L3",
    color: "#94a3b8",
  },
  [RENDER_LAYER.CHARACTER]: {
    layer: 4,
    key: "character",
    label: "L4 · Character / Object / Wall",
    badge: "L4",
    color: "#a78bfa",
  },
  [RENDER_LAYER.TABLETOP]: {
    layer: 5,
    key: "tabletop",
    label: "L5 · Tabletop (ของวางบนโต๊ะ)",
    badge: "L5",
    color: "#f59e0b",
  },
  [RENDER_LAYER.FOREGROUND]: {
    layer: 6,
    key: "foreground",
    label: "L6 · Foreground (บังหน้าตัวละคร)",
    badge: "L6",
    color: "#f472b6",
  },
  [RENDER_LAYER.OVERLAY]: {
    layer: 7,
    key: "overlay",
    label: "L7 · Overlay (บนสุดเสมอ)",
    badge: "L7",
    color: "#facc15",
  },
};

export interface AssetLayerConfig {
  renderLayer: RenderLayer;
  tilePermission: TilePermission;
  /** If > 0, this furniture acts as a tabletop host whose surface sits this many voxels above the floor. */
  surfaceHeightVoxels?: number;
  /** Optional split-sprite foreground attachment drawn on RENDER_LAYER.FOREGROUND (6) when occupied. */
  foregroundAssetId?: string;
  /** Directions where `foregroundAssetId` overlays a seated/occupying character. */
  foregroundDirections?: readonly Direction[];
}

const FLAT_FLOOR_PROP_IDS = new Set([
  "gym-yoga-mat-corner",
]);

const TABLETOP_PROP_IDS = new Set([
  "prop-desk-lamp",
  "prop-laptop",
  "prop-book-stack",
  "prop-coffee-mug",
  "prop-mini-plant",
]);

const SEAT_PROP_CONFIGS: Record<string, AssetLayerConfig> = {
  "chair-office-swivel": {
    renderLayer: RENDER_LAYER.LOW,
    tilePermission: TILE_PERM.SEAT,
    foregroundAssetId: "chair-office-swivel-back",
    foregroundDirections: ["nw", "sw"],
  },
};

/** Measured tabletop surface heights (in voxels above z=0) so tabletop props sit flush on each host. */
const SURFACE_HOST_HEIGHTS: Record<string, number> = {
  "desk-dev-dual": 17,
  "desk-security-ops": 17,
  "desk-drafting": 20,
  "table-conference": 17,
  "coffee-machine-bar": 18,
  "stream-desk-pro": 19,
  "stream-podcast-table": 18,
  "home-dining-set": 17,
  "lab-bench-microscope": 18,
  "lab-centrifuge-table": 18,
  "maker-solder-bench": 18,
  "pc-workstation-mac": 18,
};

export function toTileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function parseTileKey(key: string): [number, number] | null {
  const parts = key.split(",");
  if (parts.length !== 2) return null;
  const tx = Number(parts[0]);
  const ty = Number(parts[1]);
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
  return [tx, ty];
}

export function isWalkablePermission(perm: TilePermission | number): boolean {
  return perm !== TILE_PERM.BLOCKED;
}

export function resolveAssetLayerConfig(
  assetId: string,
  layer?: AssetLayer,
  catalogEntry?: CatalogEntry,
): AssetLayerConfig {
  const effectiveLayer = layer ?? catalogEntry?.layer ?? "object";

  // 1. Explicit layer categories
  if (effectiveLayer === "floor" || assetId.startsWith("floor-")) {
    return {
      renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.FLOOR,
      tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.WALKABLE,
    };
  }

  if (
    effectiveLayer === "tabletop" ||
    catalogEntry?.category === "tabletop" ||
    TABLETOP_PROP_IDS.has(assetId) ||
    assetId.startsWith("tabletop-")
  ) {
    return {
      renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.TABLETOP,
      tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.BLOCKED,
    };
  }

  if (effectiveLayer === "foreground" || assetId.endsWith("-back")) {
    return {
      renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.FOREGROUND,
      tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.WALKABLE,
    };
  }

  if (effectiveLayer === "wall" || effectiveLayer === "wall-decor") {
    return {
      renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.BACK,
      tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.BLOCKED,
    };
  }

  // 2. Special furniture rules (flat mats, seats with split backrests)
  if (FLAT_FLOOR_PROP_IDS.has(assetId)) {
    return {
      renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.FLOOR,
      tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.WALKABLE,
    };
  }

  const seatCfg = SEAT_PROP_CONFIGS[assetId];
  if (seatCfg) {
    return {
      renderLayer: catalogEntry?.renderLayer ?? seatCfg.renderLayer,
      tilePermission: catalogEntry?.tilePermission ?? seatCfg.tilePermission,
      foregroundAssetId: catalogEntry?.foregroundAssetId ?? seatCfg.foregroundAssetId,
      foregroundDirections: seatCfg.foregroundDirections,
    };
  }

  // 3. Surface host desks / tables (ready for tabletop placement)
  const knownSurface =
    catalogEntry?.surfaceHeightVoxels ??
    SURFACE_HOST_HEIGHTS[assetId] ??
    (assetId.startsWith("desk-") || assetId.startsWith("table-") ? 17 : undefined);

  return {
    renderLayer: catalogEntry?.renderLayer ?? RENDER_LAYER.CHARACTER,
    tilePermission: catalogEntry?.tilePermission ?? TILE_PERM.BLOCKED,
    ...(knownSurface !== undefined ? { surfaceHeightVoxels: knownSurface } : {}),
    ...(catalogEntry?.foregroundAssetId ? { foregroundAssetId: catalogEntry.foregroundAssetId } : {}),
  };
}

export function isTabletopAsset(assetId: string, layer?: AssetLayer, catalogEntry?: CatalogEntry): boolean {
  const cfg = resolveAssetLayerConfig(assetId, layer, catalogEntry);
  return cfg.renderLayer === RENDER_LAYER.TABLETOP;
}

export function isSurfaceHostAsset(assetId: string, catalogEntry?: CatalogEntry): boolean {
  const cfg = resolveAssetLayerConfig(assetId, catalogEntry?.layer, catalogEntry);
  return typeof cfg.surfaceHeightVoxels === "number" && cfg.surfaceHeightVoxels > 0;
}

export function getSurfaceHostHeightVoxels(assetId: string, catalogEntry?: CatalogEntry): number | null {
  const cfg = resolveAssetLayerConfig(assetId, catalogEntry?.layer, catalogEntry);
  return typeof cfg.surfaceHeightVoxels === "number" && cfg.surfaceHeightVoxels > 0
    ? cfg.surfaceHeightVoxels
    : null;
}

/** Convert a surface's voxel height into 2:1 isometric vertical world pixel lift (32 voxels/tile -> 1px/voxel). */
export function surfaceVoxelsToWorldOffsetY(voxels: number): number {
  return Math.max(0, Math.round(voxels));
}

export interface TilePermissionMap {
  width: number;
  height: number;
  /** Per-tile movement permission (0=blocked, 1=walkable, 2=seat, 3=door). */
  permissions: Uint8Array;
  /** Derived 0/1 blocked flags for fast A* checks (1 iff permissions[i] === 0). */
  blocked: Uint8Array;
  /** Wall on a tile boundary: blockedW[y * width + x] closes the step between (x - 1, y) and (x, y). */
  blockedW: Uint8Array;
  /** Wall on a tile boundary: blockedN[y * width + x] closes the step between (x, y - 1) and (x, y). */
  blockedN: Uint8Array;
}

/**
 * Computes the complete Pokémon GBA-style tile permission map for a campus:
 *  1. Starts every tile as WALKABLE (1)
 *  2. Marks doorway tiles along open boundary steps between distinct rooms as DOOR (3)
 *  3. Applies furniture permissions (0 for solid objects, 2 for seats, leaves 1 for flat floor mats)
 *  4. Applies boundary-line walls to blockedW / blockedN
 *  5. Applies manual user `tilePermissionOverrides` on top
 */
export function buildTilePermissionMap(
  campus: Pick<ComputedCampus, "widthTiles" | "depthTiles" | "zones" | "worldFurniture" | "wallSegments">,
  overrides?: Record<string, TilePermission>,
  catalogById?: Map<string, CatalogEntry>,
): TilePermissionMap {
  const width = Math.max(1, campus.widthTiles);
  const height = Math.max(1, campus.depthTiles);
  const size = width * height;
  const permissions = new Uint8Array(size).fill(TILE_PERM.WALKABLE);
  const blockedW = new Uint8Array(size);
  const blockedN = new Uint8Array(size);

  for (const w of campus.wallSegments ?? []) {
    if (!w.blocks) continue;
    const { x, y, side } = w.blocks;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    (side === "w" ? blockedW : blockedN)[y * width + x] = 1;
  }

  // Detect open doorway steps between two distinct zones where no wall segment blocks the edge
  const zoneByTile = new Map<number, string>();
  for (const z of campus.zones ?? []) {
    for (let dy = 0; dy < z.height; dy++) {
      for (let dx = 0; dx < z.width; dx++) {
        const tx = z.originX + dx;
        const ty = z.originY + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          zoneByTile.set(ty * width + tx, z.lotId ? `lot:${z.lotId}` : z.zoneId);
        }
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const curZone = zoneByTile.get(idx);
      if (!curZone) continue;
      if (x > 0 && !blockedW[idx]) {
        const leftZone = zoneByTile.get(idx - 1);
        if (leftZone && leftZone !== curZone) {
          permissions[idx] = TILE_PERM.DOOR;
          permissions[idx - 1] = TILE_PERM.DOOR;
        }
      }
      if (y > 0 && !blockedN[idx]) {
        const upZone = zoneByTile.get(idx - width);
        if (upZone && upZone !== curZone) {
          permissions[idx] = TILE_PERM.DOOR;
          permissions[idx - width] = TILE_PERM.DOOR;
        }
      }
    }
  }

  // Apply furniture permissions (tabletop & foreground do not override floor permissions)
  for (const f of campus.worldFurniture ?? []) {
    if (f.layer === "floor" || f.layer === "wall" || f.layer === "wall-decor" || f.layer === "tabletop" || f.layer === "foreground") {
      continue;
    }
    const cfg = resolveAssetLayerConfig(f.assetId, f.layer, catalogById?.get(f.assetId));
    if (cfg.tilePermission === TILE_PERM.WALKABLE) continue;
    const [fw, fd] = f.footprintTiles;
    for (let dy = 0; dy < fd; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        const tx = f.tx + dx;
        const ty = f.ty + dy;
        if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
        const idx = ty * width + tx;
        // Solid BLOCKED (0) always wins over SEAT (2) or DOOR (3)
        if (cfg.tilePermission === TILE_PERM.BLOCKED || permissions[idx] !== TILE_PERM.BLOCKED) {
          permissions[idx] = cfg.tilePermission;
        }
      }
    }
  }

  // Apply explicit user overrides last
  if (overrides) {
    for (const [key, perm] of Object.entries(overrides)) {
      const parsed = parseTileKey(key);
      if (!parsed) continue;
      const [tx, ty] = parsed;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
      if (perm === 0 || perm === 1 || perm === 2 || perm === 3) {
        permissions[ty * width + tx] = perm;
      }
    }
  }

  const blocked = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    blocked[i] = permissions[i] === TILE_PERM.BLOCKED ? 1 : 0;
  }

  return { width, height, permissions, blocked, blockedW, blockedN };
}
