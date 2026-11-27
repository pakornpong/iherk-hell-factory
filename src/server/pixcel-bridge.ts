import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveAssetLayerConfig, TILE_PERM } from "../shared/layers.js";
import { CatalogEntrySchema, type AssetLayer, type CatalogEntry, type Direction, type ThemeMode } from "../shared/types.js";

export const CHARACTER_CLIPS = [
  "idle_0",
  "idle_1",
  "walk_0",
  "walk_1",
  "walk_2",
  "walk_3",
  "sit_type_0",
  "sit_type_1",
  "inspect_0",
  "inspect_1",
  "talk_0",
  "talk_1",
  "assign_0",
  "assign_1",
  "rest_coffee_0",
  "rest_coffee_1",
  "rest_sleep_0",
  "rest_sleep_1",
] as const;

export interface CharacterBuilderSpec {
  id: string;
  role?: string;
  palette?: string;
  skinTone?: string;
  hairStyle?: "short" | "spiky" | "bob" | "ponytail" | "parted" | "hood_up";
  hairColor?: string;
  outfitStyle?: "hoodie" | "blazer" | "tshirt" | "sweater";
  outfitColor?: string;
  accentColor?: string;
  pantsColor?: string;
  shoeColor?: string;
  glasses?: boolean;
  headset?: boolean;
  emissiveAccent?: boolean;
}

export const PHASE2_CHARACTER_SPECS: readonly CharacterBuilderSpec[] = [
  {
    id: "agent-boss",
    role: "boss",
    skinTone: "warm",
    hairStyle: "parted",
    hairColor: "#2b211b",
    outfitStyle: "blazer",
    outfitColor: "#1e3a5f",
    accentColor: "#f59e0b",
    pantsColor: "#0f172a",
    shoeColor: "#090d16",
    glasses: true,
    emissiveAccent: false,
  },
  {
    id: "agent-starter",
    role: "starter",
    skinTone: "warm",
    hairStyle: "short",
    hairColor: "#334155",
    outfitStyle: "sweater",
    outfitColor: "#475569",
    accentColor: "#94a3b8",
    pantsColor: "#1e293b",
    shoeColor: "#0f172a",
    emissiveAccent: false,
  },
  {
    id: "agent-claude",
    role: "claude",
    skinTone: "light",
    hairStyle: "short",
    hairColor: "#3d2314",
    outfitStyle: "hoodie",
    outfitColor: "#d97757",
    accentColor: "#fbbf24",
    pantsColor: "#3a2a22",
    shoeColor: "#1c1410",
    emissiveAccent: true,
  },
  {
    id: "agent-claude-v1",
    role: "claude",
    skinTone: "warm",
    hairStyle: "spiky",
    hairColor: "#7c2d12",
    outfitStyle: "hoodie",
    outfitColor: "#c2410c",
    accentColor: "#fcd34d",
    pantsColor: "#3a2a22",
    shoeColor: "#1c1410",
    emissiveAccent: true,
  },
  {
    id: "agent-claude-v2",
    role: "claude",
    skinTone: "tan",
    hairStyle: "ponytail",
    hairColor: "#1f2937",
    outfitStyle: "sweater",
    outfitColor: "#e0764a",
    accentColor: "#fdba74",
    pantsColor: "#2b2320",
    shoeColor: "#1c1410",
    emissiveAccent: true,
  },
  {
    id: "agent-claude-v3",
    role: "claude",
    skinTone: "light",
    hairStyle: "bob",
    hairColor: "#a16207",
    outfitStyle: "tshirt",
    outfitColor: "#b9422f",
    accentColor: "#fbbf24",
    pantsColor: "#3a2a22",
    shoeColor: "#1c1410",
    glasses: true,
    emissiveAccent: true,
  },
  {
    id: "agent-gemini",
    role: "gemini",
    skinTone: "light",
    hairStyle: "parted",
    hairColor: "#1e293b",
    outfitStyle: "hoodie",
    outfitColor: "#4f46e5",
    accentColor: "#38bdf8",
    pantsColor: "#172033",
    shoeColor: "#0f172a",
    glasses: true,
    emissiveAccent: true,
  },
  {
    id: "agent-gemini-v1",
    role: "gemini",
    skinTone: "warm",
    hairStyle: "short",
    hairColor: "#312e81",
    outfitStyle: "hoodie",
    outfitColor: "#2563eb",
    accentColor: "#22d3ee",
    pantsColor: "#172033",
    shoeColor: "#0f172a",
    glasses: true,
    emissiveAccent: true,
  },
  {
    id: "agent-gemini-v2",
    role: "gemini",
    skinTone: "brown",
    hairStyle: "bob",
    hairColor: "#475569",
    outfitStyle: "sweater",
    outfitColor: "#0284c7",
    accentColor: "#a5f3fc",
    pantsColor: "#1b2a3d",
    shoeColor: "#0f172a",
    emissiveAccent: true,
  },
  {
    id: "agent-gemini-v3",
    role: "gemini",
    skinTone: "tan",
    hairStyle: "spiky",
    hairColor: "#78350f",
    outfitStyle: "tshirt",
    outfitColor: "#6d28d9",
    accentColor: "#67e8f9",
    pantsColor: "#172033",
    shoeColor: "#0f172a",
    headset: true,
    emissiveAccent: true,
  },
] as const;

const ALL_DIRECTIONS: Direction[] = ["se", "sw", "nw", "ne"];

/**
 * Phase 2 characters natively face +Y in "se", -X in "sw", -Y in "nw", +X in "ne",
 * matching chair-office-swivel 1:1 without any directional offset.
 */
export function pixcelRenderDirection(
  _asset: { category: string; animations?: Record<string, unknown> },
  dir: Direction,
): Direction {
  return dir;
}

interface PixcelMaterialDef {
  color: string;
  kind: "matte" | "wood" | "metal" | "glass" | "emissive";
  glowRadius?: number;
  glowIntensity?: number;
}

export interface PixcelAssetLike {
  schemaVersion: 1;
  id: string;
  category: string;
  layer: AssetLayer;
  outlineMode: "silhouette" | "none" | "top-only";
  tilePreset: "64x32" | "64x31" | "32x16";
  voxelsPerTile: 16 | 32;
  footprintTiles: [number, number];
  palette: string;
  materials: Record<string, PixcelMaterialDef>;
  ops: unknown[];
  decals: unknown[];
  frames?: Array<{ name: string; durationMs: number; ops?: unknown[]; decals?: unknown[]; partTransforms?: unknown }>;
  parts?: unknown;
  animations?: Record<
    string,
    {
      frames: Array<{
        name: string;
        durationMs?: number;
        ops?: unknown[];
        decals?: unknown[];
        partTransforms?: unknown;
      }>;
    } & Record<string, unknown>
  >;
}

type CompiledFrameLike = { name: string; durationMs: number; grid: unknown };

interface RGBAImageLike {
  width: number;
  height: number;
  data: Uint8Array;
}

interface PixcelCoreModules {
  PixcelAssetSchema: { parse: (v: unknown) => PixcelAssetLike };
  compileAsset: (asset: PixcelAssetLike) => {
    frames: CompiledFrameLike[];
    baseGrid: { getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } | null };
  };
  compileAssetAnimations: (asset: PixcelAssetLike) => Map<string, CompiledFrameLike[]>;
  buildCharacterAsset: (spec: CharacterBuilderSpec) => PixcelAssetLike;
  renderAssetFrame: (
    asset: PixcelAssetLike,
    grid: unknown,
    palette: { name: string; colors: Record<string, string> },
    opts: { direction: Direction; emissiveMode: "baked" | "split" | "both" },
  ) => {
    main: RGBAImageLike;
    emissive?: RGBAImageLike;
    anchor: { x: number; y: number };
    footprintTiles: [number, number];
  };
  packSpriteAtlas: (
    sprites: Array<{
      key: string;
      assetId: string;
      direction: Direction;
      frameName: string;
      durationMs: number;
      layer: AssetLayer;
      footprintTiles: [number, number];
      anchor: { x: number; y: number };
      image: RGBAImageLike;
      emissive?: RGBAImageLike;
    }>,
    opts: { imageName: string; emissiveImageName?: string; tilePreset: "64x32"; padding?: number },
  ) => { sheet: RGBAImageLike; emissiveSheet?: RGBAImageLike; atlas: Record<string, unknown> };
  createRGBAImage: (w: number, h: number) => RGBAImageLike;
  encodePNG: (img: RGBAImageLike) => Buffer;
}

const DAY_HEX_REMAP: Record<string, string> = {
  // Walls & structural dark slate -> warm sunlit cream/stone (Isometric Interiors vibe)
  "#1e2538": "#dcd6c8",
  "#242c42": "#e4dfd2",
  "#2a334d": "#ebe6da",
  "#171c2b": "#c4bdb0",
  "#141926": "#b5aea0",
  "#343f5c": "#cfc8b9",
  // Night window panes -> bright daylight sky glass
  "#13294b": "#7dd3fc",
  "#28548a": "#bae6fd",
  "#0f223d": "#60a5fa",
  "#183661": "#7dd3fc",
  // Dark oak wood planks -> sunlit honey oak
  "#543725": "#b88a5b",
  "#5f3e29": "#c69968",
  "#4c3120": "#aa7d50",
  "#382216": "#8a623c",
  "#4b3121": "#9d6e43",
  "#6b442a": "#b58354",
  // Lounge rug dark navy -> warm sage/teal studio rug
  "#26384d": "#4d7c74",
  "#344f6b": "#65968d",
  "#1e2e40": "#3b665e",
  // Dark sofa -> warm coastal teal
  "#1e3a52": "#3a6b7c",
  "#2b5272": "#4d8599",
};

const OFFICE_HEX_REMAP: Record<string, string> = {
  // Dark oak wood -> Pixel Salvaje honey oak
  "#543725": "#c87d42",
  "#5f3e29": "#d48c50",
  "#4c3120": "#b56c35",
  "#382216": "#98582a",
  "#4b3121": "#a66330",
  "#62402a": "#c87d42",
  "#6b442a": "#c87d42",
  // Lounge rug dark navy -> crisp office teal rug
  "#26384d": "#2d8a8a",
  "#344f6b": "#3da3a3",
  "#1e2e40": "#226e6e",
  // Sofa -> bright slate blue
  "#1e3a52": "#3b6f8c",
  "#2b5272": "#4e89ab",
};

export function remapAssetToDayTheme(asset: PixcelAssetLike): PixcelAssetLike {
  const cloned = structuredClone(asset);
  const isWall = asset.layer === "wall" || asset.id.startsWith("wall-") || asset.id.startsWith("room-");
  const isCorridorFloor = asset.id === "floor-corridor-tile";
  for (const [matName, mat] of Object.entries(cloned.materials)) {
    const key = mat.color.toLowerCase();
    if (isCorridorFloor) {
      if (matName === "stone_a") mat.color = "#cfc9be";
      else if (matName === "stone_b") mat.color = "#dcd7cd";
      else if (matName === "grout") mat.color = "#b5aea2";
      continue;
    }
    if (key in DAY_HEX_REMAP) {
      mat.color = DAY_HEX_REMAP[key];
    } else if (isWall && mat.kind !== "emissive" && mat.kind !== "glass") {
      if (matName.includes("cap") || matName === "frame") {
        mat.color = "#948e82";
      } else if (matName === "wall_trim" || matName === "baseboard") {
        mat.color = "#cfc8b9";
      } else if (/^#[0-3][0-9a-f][0-3][0-9a-f][0-5][0-9a-f]$/i.test(key)) {
        mat.color = "#dcd6c8";
      }
    } else if (mat.kind === "glass" && (asset.id.includes("window") || asset.id.includes("clerestory") || asset.id.startsWith("room-"))) {
      mat.color = "#93c5fd";
    } else if (matName.includes("plank") && /^#[0-6]/.test(key)) {
      mat.color = "#b88a5b";
    }
  }
  return cloned;
}

export function remapAssetToOfficeTheme(asset: PixcelAssetLike): PixcelAssetLike {
  const cloned = structuredClone(asset);
  if (cloned.category === "character" || cloned.palette === "office-day") {
    return cloned;
  }

  const isWall = cloned.layer === "wall" || cloned.id.startsWith("wall-") || cloned.id.startsWith("room-");
  const isCorridorFloor = cloned.id === "floor-corridor-tile";
  const isDeskOrTable = cloned.id.startsWith("desk-") || cloned.id.startsWith("table-");
  const isCoffeeBar = cloned.id === "coffee-machine-bar";

  for (const [matName, mat] of Object.entries(cloned.materials)) {
    const key = mat.color.toLowerCase();

    if (isCorridorFloor) {
      if (matName === "stone_a") mat.color = "#94a3b8";
      else if (matName === "stone_b") mat.color = "#aab7c6";
      else if (matName === "grout") mat.color = "#64748b";
      continue;
    }

    if (isWall) {
      if (matName.includes("cap")) {
        mat.color = "#5d5355";
      } else if (matName === "frame") {
        mat.color = "#5d5355";
      } else if (mat.kind === "glass" || matName.includes("glass")) {
        mat.color = "#7dd3fc";
      } else if (mat.kind === "emissive" && (cloned.id.includes("window") || cloned.id.includes("clerestory"))) {
        mat.color = "#e0f2fe";
      } else if (matName === "wall_trim" || matName === "baseboard") {
        mat.color = "#c8cdd5";
      } else if (matName === "wall_main" || /^#[0-3][0-9a-f][0-3][0-9a-f][0-5][0-9a-f]$/i.test(key)) {
        mat.color = "#dadde2";
      }
      continue;
    }

    if (isCoffeeBar) {
      if (matName === "metal_dark") {
        mat.color = "#dc2626";
        continue;
      }
      if (matName === "steel") {
        mat.color = "#cbd5e1";
        continue;
      }
      if (matName === "wood_top") {
        mat.color = "#c87d42";
        continue;
      }
      if (matName === "wood_dark") {
        mat.color = "#a66330";
        continue;
      }
    }

    if (isDeskOrTable) {
      if (matName === "wood_top") {
        mat.color = "#c87d42";
        continue;
      }
      if (matName === "wood_trim") {
        mat.color = "#a66330";
        continue;
      }
      if (matName === "metal_dark") {
        mat.color = "#8b95a5";
        continue;
      }
      if (matName === "metal_mid") {
        mat.color = "#a3adbc";
        continue;
      }
    }

    if (key in OFFICE_HEX_REMAP) {
      mat.color = OFFICE_HEX_REMAP[key];
    } else if (matName.includes("plank") && /^#[0-6]/.test(key)) {
      mat.color = "#c87d42";
    }
  }

  return cloned;
}

function blitRGBA(src: RGBAImageLike, dst: RGBAImageLike, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const si = (y * src.width + x) * 4;
      const sa = src.data[si + 3];
      if (sa === 0) continue;
      const di = (ty * dst.width + tx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = sa;
    }
  }
}

/** Phase 2 assets (`animations`) flatten every clip (frames named `<clip>_<i>`); legacy assets use `frames`. */
function compileFrames(core: PixcelCoreModules, asset: PixcelAssetLike): CompiledFrameLike[] {
  if (asset.animations && Object.keys(asset.animations).length > 0) {
    return [...core.compileAssetAnimations(asset).values()].flat();
  }
  return core.compileAsset(asset).frames;
}

function frameNames(asset: PixcelAssetLike): string[] {
  if (asset.animations && Object.keys(asset.animations).length > 0) {
    return Object.values(asset.animations).flatMap((clip) => clip.frames.map((f) => f.name));
  }
  return asset.frames?.map((f) => f.name) ?? ["default"];
}

/** Replace upright nap pose with a horizontal lying-down pose that fits inside the 1x2 Space Haven hypersleep pod. */
function applyLyingHypersleepPose(asset: PixcelAssetLike, spec: CharacterBuilderSpec): PixcelAssetLike {
  if (!asset.animations?.rest_sleep) return asset;
  const hideAllParts = {
    head: { hide: true },
    torso: { hide: true },
    arm_l: { hide: true },
    arm_r: { hide: true },
    leg_l: { hide: true },
    leg_r: { hide: true },
  };
  const sleeveMat = spec.outfitStyle === "tshirt" ? "skin" : "outfit";
  const buildLyingOps = (breath: number) => [
    { op: "box", from: [12, 1, 10], to: [19, 3, 16], material: "hair" },
    { op: "box", from: [11, 2, 11], to: [12, 8, 15], material: "hair" },
    { op: "box", from: [19, 2, 11], to: [20, 8, 15], material: "hair" },
    { op: "box", from: [12, 3, 10], to: [19, 9, 15], material: "skin" },
    { op: "box", from: [12, 3, 15], to: [19, 4, 16], material: "hair" },
    { op: "box", from: [13, 6, 15], to: [14, 6, 15], material: "eye" },
    { op: "box", from: [17, 6, 15], to: [18, 6, 15], material: "eye" },
    ...(spec.glasses
      ? [
          { op: "box", from: [12, 6, 16], to: [19, 6, 16], material: "glasses_frame" },
          { op: "box", from: [13, 6, 16], to: [14, 6, 16], material: "glasses_lens" },
          { op: "box", from: [17, 6, 16], to: [18, 6, 16], material: "glasses_lens" },
        ]
      : []),
    { op: "box", from: [14, 10, 10], to: [17, 10, 12], material: "skin" },
    { op: "box", from: [12, 11, 8], to: [19, 19, 13 + breath], material: "outfit" },
    { op: "box", from: [14, 13, 13 + breath], to: [17, 16, 13 + breath], material: "accent" },
    { op: "box", from: [10, 11, 8], to: [11, 17, 11], material: sleeveMat },
    { op: "box", from: [10, 18, 8], to: [11, 19, 10], material: "skin" },
    { op: "box", from: [20, 11, 8], to: [21, 17, 11], material: sleeveMat },
    { op: "box", from: [20, 18, 8], to: [21, 19, 10], material: "skin" },
    { op: "box", from: [12, 20, 8], to: [19, 22, 12], material: "pants" },
    { op: "box", from: [12, 23, 8], to: [14, 28, 12], material: "pants" },
    { op: "box", from: [17, 23, 8], to: [19, 28, 12], material: "pants" },
    { op: "box", from: [12, 29, 8], to: [14, 30, 12], material: "shoe" },
    { op: "box", from: [17, 29, 8], to: [19, 30, 12], material: "shoe" },
  ];
  asset.animations.rest_sleep = {
    ...asset.animations.rest_sleep,
    frames: [
      { name: "rest_sleep_0", durationMs: 900, partTransforms: hideAllParts, ops: buildLyingOps(0), decals: [] },
      { name: "rest_sleep_1", durationMs: 900, partTransforms: hideAllParts, ops: buildLyingOps(1), decals: [] },
    ],
  };
  return asset;
}

/** Make glass voxels on Space Haven hypersleep pods genuinely translucent. */
function renderHypersleepWithTranslucentGlass(
  core: PixcelCoreModules,
  asset: PixcelAssetLike,
  grid: unknown,
  dummyPalette: { name: string; colors: Record<string, string> },
  renderDir: Direction,
) {
  const full = core.renderAssetFrame(asset, grid, dummyPalette, { direction: renderDir, emissiveMode: "both" });
  const glassMatNames = new Set(
    Object.entries(asset.materials)
      .filter(([, def]) => def.kind === "glass")
      .map(([name]) => name),
  );
  if (glassMatNames.size === 0) return full;

  const maskAsset: PixcelAssetLike = {
    ...structuredClone(asset),
    outlineMode: "none",
    materials: Object.fromEntries(
      Object.entries(asset.materials).map(([name]) => [
        name,
        glassMatNames.has(name)
          ? { color: "#ff00ff", kind: "emissive" as const, glowRadius: 0, glowIntensity: 0 }
          : { color: "#000000", kind: "emissive" as const, glowRadius: 0, glowIntensity: 0 },
      ]),
    ),
  };
  const maskRendered = core.renderAssetFrame(maskAsset, grid, dummyPalette, { direction: renderDir, emissiveMode: "baked" });
  const isOverlayCanopy = asset.id === "hypersleep-capsule-front";
  const maskDx = full.anchor.x - maskRendered.anchor.x;
  const maskDy = full.anchor.y - maskRendered.anchor.y;

  let underImg: RGBAImageLike | null = null;
  let underDx = 0;
  let underDy = 0;
  if (!isOverlayCanopy) {
    const opaqueAsset = structuredClone(asset);
    opaqueAsset.ops = opaqueAsset.ops.filter((op) => {
      const mat = (op as { material?: string | null }).material;
      return !mat || !glassMatNames.has(mat);
    });
    const opaqueFrames = compileFrames(core, opaqueAsset);
    const opaqueRendered = core.renderAssetFrame(opaqueAsset, opaqueFrames[0].grid, dummyPalette, {
      direction: renderDir,
      emissiveMode: "baked",
    });
    underImg = opaqueRendered.main;
    underDx = full.anchor.x - opaqueRendered.anchor.x;
    underDy = full.anchor.y - opaqueRendered.anchor.y;
  }

  const out = full.main;
  for (let y = 0; y < out.height; y++) {
    const my = y - maskDy;
    if (my < 0 || my >= maskRendered.main.height) continue;
    for (let x = 0; x < out.width; x++) {
      const mx = x - maskDx;
      if (mx < 0 || mx >= maskRendered.main.width) continue;
      const mi = (my * maskRendered.main.width + mx) * 4;
      if (
        maskRendered.main.data[mi + 3] < 200 ||
        maskRendered.main.data[mi] < 200 ||
        maskRendered.main.data[mi + 1] > 40 ||
        maskRendered.main.data[mi + 2] < 200
      ) {
        continue;
      }
      const oi = (y * out.width + x) * 4;
      const gr = out.data[oi];
      const gg = out.data[oi + 1];
      const gb = out.data[oi + 2];
      const isHighlight = gr + gg + gb >= 600;
      const glassAlpha = isOverlayCanopy ? (isHighlight ? 168 : 104) : isHighlight ? 185 : 122;

      if (isOverlayCanopy || !underImg) {
        out.data[oi + 3] = glassAlpha;
      } else {
        const ux = x - underDx;
        const uy = y - underDy;
        const hasUnder =
          ux >= 0 &&
          ux < underImg.width &&
          uy >= 0 &&
          uy < underImg.height &&
          underImg.data[(uy * underImg.width + ux) * 4 + 3] > 0;
        if (hasUnder) {
          const ui = (uy * underImg.width + ux) * 4;
          const a = glassAlpha / 255;
          const inv = 1 - a;
          out.data[oi] = Math.round(gr * a + underImg.data[ui] * inv);
          out.data[oi + 1] = Math.round(gg * a + underImg.data[ui + 1] * inv);
          out.data[oi + 2] = Math.round(gb * a + underImg.data[ui + 2] * inv);
          out.data[oi + 3] = 255;
        } else {
          out.data[oi + 3] = glassAlpha;
        }
      }
    }
  }
  return full;
}

const LIBRARY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIBRARY_ATLAS_VERSION = "v1";

interface LibraryAsset {
  filePath: string;
  catalog: CatalogEntry;
}

export class PixcelBridge {
  private corePromise: Promise<PixcelCoreModules> | null = null;
  private readonly starterDir: string;
  private readonly propsDir: string;
  private readonly charsDir: string;
  private readonly customDir: string;
  private readonly libraryDir: string;
  private libraryPromise?: Promise<Map<string, LibraryAsset>>;
  private readonly pendingLibraryAtlases = new Map<string, Promise<Record<string, unknown>>>();

  constructor(
    private readonly opts: {
      pixcelRoot: string;
      projectRoot: string;
      runtimeOutDir: string;
    },
  ) {
    this.starterDir = path.join(opts.pixcelRoot, "assets", "office-starter");
    this.propsDir = path.join(opts.projectRoot, "assets", "pixcel", "props");
    this.charsDir = path.join(opts.projectRoot, "assets", "pixcel", "characters");
    this.customDir = path.join(opts.projectRoot, "assets", "pixcel", "custom");
    this.libraryDir = path.join(opts.projectRoot, "assets", "pixcel", "library");
  }

  private async loadCore(): Promise<PixcelCoreModules> {
    if (!this.corePromise) {
      this.corePromise = (async () => {
        const coreDir = path.join(this.opts.pixcelRoot, "dist", "core");
        const [schemaMod, dslMod, charMod, postMod, atlasMod, pngMod] = await Promise.all([
          import(pathToFileURL(path.join(coreDir, "schema.js")).href),
          import(pathToFileURL(path.join(coreDir, "dsl-compiler.js")).href),
          import(pathToFileURL(path.join(coreDir, "character-builder.js")).href),
          import(pathToFileURL(path.join(coreDir, "postprocess.js")).href),
          import(pathToFileURL(path.join(coreDir, "exporters", "atlas.js")).href),
          import(pathToFileURL(path.join(coreDir, "exporters", "png.js")).href),
        ]);
        return {
          PixcelAssetSchema: schemaMod.PixcelAssetSchema,
          compileAsset: dslMod.compileAsset,
          compileAssetAnimations: dslMod.compileAssetAnimations,
          buildCharacterAsset: charMod.buildCharacterAsset,
          renderAssetFrame: postMod.renderAssetFrame,
          packSpriteAtlas: atlasMod.packSpriteAtlas,
          createRGBAImage: pngMod.createRGBAImage,
          encodePNG: pngMod.encodePNG,
        };
      })();
    }
    return this.corePromise;
  }

  private async readAssetsFromDir(
    dir: string,
    source: CatalogEntry["source"],
  ): Promise<Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }>> {
    const core = await this.loadCore();
    let entries: string[] = [];
    try {
      entries = (await fs.readdir(dir)).filter((f) => f.endsWith(".pixcel.json")).sort();
    } catch {
      return [];
    }
    const result: Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }> = [];
    for (const file of entries) {
      const raw = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
      const parsed = core.PixcelAssetSchema.parse(raw);
      result.push({ asset: parsed, source });
    }
    return result;
  }

  private async loadCharacterAssets(): Promise<Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }>> {
    const core = await this.loadCore();
    const built = PHASE2_CHARACTER_SPECS.map((spec) => ({
      asset: applyLyingHypersleepPose(core.buildCharacterAsset(spec), spec),
      source: "character" as const,
    }));
    const builtIds = new Set(built.map((item) => item.asset.id));
    const diskExtras = (await this.readAssetsFromDir(this.charsDir, "character")).filter(
      (item) => !builtIds.has(item.asset.id),
    );
    return [...built, ...diskExtras];
  }

  private renderAssetsToSprites(
    core: PixcelCoreModules,
    assets: PixcelAssetLike[],
    theme: ThemeMode,
  ) {
    const dummyPalette = {
      name: theme === "office" ? "office-salvaje" : theme === "day" ? "office-day" : "office-night",
      colors: {},
    };
    const sprites: Parameters<PixcelCoreModules["packSpriteAtlas"]>[0] = [];
    for (const original of assets) {
      const asset =
        original.category === "character"
          ? original
          : theme === "office"
            ? remapAssetToOfficeTheme(original)
            : theme === "day"
              ? remapAssetToDayTheme(original)
              : original;
      const frames = compileFrames(core, asset);
      const dirs: Direction[] = asset.layer === "floor" ? ["se"] : ALL_DIRECTIONS;
      const useTranslucentGlass = asset.id.startsWith("hypersleep-capsule");
      for (const dir of dirs) {
        const renderDir = pixcelRenderDirection(asset, dir);
        for (const frame of frames) {
          const rendered = useTranslucentGlass
            ? renderHypersleepWithTranslucentGlass(core, asset, frame.grid, dummyPalette, renderDir)
            : core.renderAssetFrame(asset, frame.grid, dummyPalette, {
                direction: renderDir,
                emissiveMode: "both",
              });
          sprites.push({
            key: `${asset.id}/${dir}/${frame.name}`,
            assetId: asset.id,
            direction: dir,
            frameName: frame.name,
            durationMs: frame.durationMs,
            layer: asset.layer,
            footprintTiles: rendered.footprintTiles,
            anchor: rendered.anchor,
            image: rendered.main,
            emissive: rendered.emissive,
          });
        }
      }
    }
    return sprites;
  }

  private toCatalogEntries(items: Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }>): CatalogEntry[] {
    return items.map(({ asset, source }) => {
      const effectiveLayer: AssetLayer = asset.category === "tabletop" ? "tabletop" : asset.layer;
      const cfg = resolveAssetLayerConfig(asset.id, effectiveLayer);
      return {
        id: asset.id,
        category: asset.category,
        layer: effectiveLayer,
        footprintTiles: asset.footprintTiles,
        source,
        frames: frameNames(asset),
        renderLayer: cfg.renderLayer,
        tilePermission: cfg.tilePermission,
        ...(cfg.surfaceHeightVoxels !== undefined ? { surfaceHeightVoxels: cfg.surfaceHeightVoxels } : {}),
        ...(cfg.foregroundAssetId ? { foregroundAssetId: cfg.foregroundAssetId } : {}),
      };
    });
  }

  private getLibraryRegistry(): Promise<Map<string, LibraryAsset>> {
    this.libraryPromise ??= this.readLibraryRegistry().catch((error) => {
      this.libraryPromise = undefined;
      throw error;
    });
    return this.libraryPromise;
  }

  private async readLibraryRegistry(): Promise<Map<string, LibraryAsset>> {
    const registry = new Map<string, LibraryAsset>();
    const entries = await fs.readdir(this.libraryDir, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    if (entries.length === 0) return registry;
    const libraryRoot = await fs.realpath(this.libraryDir);
    const categories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const category of categories) {
      const categoryDir = path.join(this.libraryDir, category);
      const indexPath = await fs.realpath(path.join(categoryDir, "index.json")).catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (!indexPath) continue;
      if (!indexPath.startsWith(libraryRoot + path.sep)) {
        throw new Error(`Pixcel library index resolves outside the library: ${category}`);
      }
      const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as unknown;
      if (!Array.isArray(index)) throw new Error(`Invalid Pixcel library index: ${category}`);
      for (const row of index) {
        const id = row?.id;
        const file = row?.file;
        if (typeof id !== "string" || id.length > 128 || !LIBRARY_ID.test(id) ||
            typeof file !== "string" || !/^\d{3}\/[^/]+\.pixcel\.json$/.test(file) ||
            path.basename(file) !== `${id}.pixcel.json`) {
          throw new Error(`Invalid Pixcel library entry: ${category}`);
        }
        if (registry.has(id)) throw new Error(`Duplicate Pixcel library ID: ${id}`);

        const filePath = await fs.realpath(path.join(categoryDir, file));
        if (!filePath.startsWith(libraryRoot + path.sep)) {
          throw new Error(`Pixcel library entry resolves outside the library: ${id}`);
        }
        const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
        if (raw.id !== id || raw.category !== row.category) {
          throw new Error(`Mismatched Pixcel library entry: ${id}`);
        }
        const layer = raw.category === "tabletop" ? "tabletop" : raw.layer;
        const cfg = resolveAssetLayerConfig(id, layer);
        let wallMountBounds: CatalogEntry["wallMountBounds"];
        if (layer === "wall-decor") {
          const core = await this.loadCore();
          const asset = core.PixcelAssetSchema.parse(raw);
          const bounds = core.compileAsset(asset).baseGrid.getBounds();
          const scale = raw.voxelsPerTile === 16 ? 2 : 1;
          if (bounds) {
            wallMountBounds = {
              left: bounds.minX * scale, right: (bounds.maxX + 1) * scale,
              bottom: bounds.minZ * scale, top: (bounds.maxZ + 1) * scale,
            };
          }
        }
        const catalog = CatalogEntrySchema.parse({
          id,
          category: raw.category,
          layer,
          footprintTiles: raw.footprintTiles,
          source: "library",
          frames: frameNames(raw),
          renderLayer: cfg.renderLayer,
          tilePermission: layer === "wall-decor" ? TILE_PERM.WALKABLE : cfg.tilePermission,
          wallMountBounds,
          wallMountHeightVoxels: wallMountBounds ? Math.min(96, wallMountBounds.top) : undefined,
          surfaceHeightVoxels: cfg.surfaceHeightVoxels,
          foregroundAssetId: cfg.foregroundAssetId,
        });
        registry.set(id, { filePath, catalog });
      }
    }
    return registry;
  }

  async getLibraryAtlas(id: string, theme: ThemeMode): Promise<Record<string, unknown> | null> {
    if (!LIBRARY_ID.test(id)) return null;
    const entry = (await this.getLibraryRegistry()).get(id);
    if (!entry) return null;
    const key = `${theme}:${id}`;
    const current = this.pendingLibraryAtlases.get(key);
    if (current) return current;

    const loading = this.buildLibraryAtlas(entry, theme).finally(() => this.pendingLibraryAtlases.delete(key));
    this.pendingLibraryAtlases.set(key, loading);
    return loading;
  }

  private async buildLibraryAtlas(entry: LibraryAsset, theme: ThemeMode): Promise<Record<string, unknown>> {
    const source = await fs.readFile(entry.filePath, "utf8");
    const digest = createHash("sha256").update(LIBRARY_ATLAS_VERSION).update(source).digest("hex").slice(0, 16);
    const baseName = `${entry.catalog.id}-${theme}-${digest}`;
    const outDir = path.join(this.opts.runtimeOutDir, "library");
    const atlasPath = path.join(outDir, `${baseName}.json`);
    const cached = await fs.readFile(atlasPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (cached) return JSON.parse(cached) as Record<string, unknown>;

    const core = await this.loadCore();
    const asset = core.PixcelAssetSchema.parse(JSON.parse(source));
    if (asset.id !== entry.catalog.id) throw new Error("Library asset ID changed");
    const packed = core.packSpriteAtlas(this.renderAssetsToSprites(core, [asset], theme), {
      imageName: `${baseName}.png`,
      emissiveImageName: `${baseName}_emissive.png`,
      tilePreset: "64x32",
      padding: 1,
    });
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, `${baseName}.png`), core.encodePNG(packed.sheet));
    if (packed.emissiveSheet) {
      await fs.writeFile(path.join(outDir, `${baseName}_emissive.png`), core.encodePNG(packed.emissiveSheet));
    }
    const temporaryAtlasPath = `${atlasPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryAtlasPath, JSON.stringify(packed.atlas), "utf8");
    await fs.rename(temporaryAtlasPath, atlasPath);
    return packed.atlas;
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    const [starter, props, chars, custom, library] = await Promise.all([
      this.readAssetsFromDir(this.starterDir, "starter"),
      this.readAssetsFromDir(this.propsDir, "prop"),
      this.loadCharacterAssets(),
      this.readAssetsFromDir(this.customDir, "custom"),
      this.getLibraryRegistry(),
    ]);
    // Local project props override starter assets of the same id (e.g. ergonomic chair-office-swivel)
    const byId = new Map<string, { asset: PixcelAssetLike; source: CatalogEntry["source"] }>();
    for (const item of [...starter, ...props, ...chars, ...custom]) {
      byId.set(item.asset.id, item);
    }
    return [
      ...this.toCatalogEntries([...byId.values()]),
      ...[...library.values()].filter(({ catalog }) => !byId.has(catalog.id)).map(({ catalog }) => catalog),
    ];
  }

  async buildCoreAtlases(): Promise<{
    officeAtlasPath: string;
    nightAtlasPath: string;
    dayAtlasPath: string;
    catalog: CatalogEntry[];
  }> {
    const core = await this.loadCore();
    await fs.mkdir(this.opts.runtimeOutDir, { recursive: true });

    const [starter, props, chars] = await Promise.all([
      this.readAssetsFromDir(this.starterDir, "starter"),
      this.readAssetsFromDir(this.propsDir, "prop"),
      this.loadCharacterAssets(),
    ]);

    const byId = new Map<string, { asset: PixcelAssetLike; source: CatalogEntry["source"] }>();
    for (const item of [...starter, ...props, ...chars]) {
      byId.set(item.asset.id, item);
    }
    const allCore = [...byId.values()];
    const assets = allCore.map((a) => a.asset);

    const officeSprites = this.renderAssetsToSprites(core, assets, "office");
    const officePacked = core.packSpriteAtlas(officeSprites, {
      imageName: "atlas-office.png",
      emissiveImageName: "atlas-office_emissive.png",
      tilePreset: "64x32",
      padding: 1,
    });

    const nightSprites = this.renderAssetsToSprites(core, assets, "night");
    const nightPacked = core.packSpriteAtlas(nightSprites, {
      imageName: "atlas-night.png",
      emissiveImageName: "atlas-night_emissive.png",
      tilePreset: "64x32",
      padding: 1,
    });

    const daySprites = this.renderAssetsToSprites(core, assets, "day");
    const dayPacked = core.packSpriteAtlas(daySprites, {
      imageName: "atlas-day.png",
      emissiveImageName: "atlas-day_emissive.png",
      tilePreset: "64x32",
      padding: 1,
    });

    const officeAtlasPath = path.join(this.opts.runtimeOutDir, "atlas-office.json");
    const nightAtlasPath = path.join(this.opts.runtimeOutDir, "atlas-night.json");
    const dayAtlasPath = path.join(this.opts.runtimeOutDir, "atlas-day.json");

    await Promise.all([
      fs.writeFile(path.join(this.opts.runtimeOutDir, "atlas-office.png"), core.encodePNG(officePacked.sheet)),
      officePacked.emissiveSheet
        ? fs.writeFile(
            path.join(this.opts.runtimeOutDir, "atlas-office_emissive.png"),
            core.encodePNG(officePacked.emissiveSheet),
          )
        : Promise.resolve(),
      fs.writeFile(officeAtlasPath, `${JSON.stringify(officePacked.atlas, null, 2)}\n`, "utf8"),

      fs.writeFile(path.join(this.opts.runtimeOutDir, "atlas-night.png"), core.encodePNG(nightPacked.sheet)),
      nightPacked.emissiveSheet
        ? fs.writeFile(
            path.join(this.opts.runtimeOutDir, "atlas-night_emissive.png"),
            core.encodePNG(nightPacked.emissiveSheet),
          )
        : Promise.resolve(),
      fs.writeFile(nightAtlasPath, `${JSON.stringify(nightPacked.atlas, null, 2)}\n`, "utf8"),

      fs.writeFile(path.join(this.opts.runtimeOutDir, "atlas-day.png"), core.encodePNG(dayPacked.sheet)),
      dayPacked.emissiveSheet
        ? fs.writeFile(
            path.join(this.opts.runtimeOutDir, "atlas-day_emissive.png"),
            core.encodePNG(dayPacked.emissiveSheet),
          )
        : Promise.resolve(),
      fs.writeFile(dayAtlasPath, `${JSON.stringify(dayPacked.atlas, null, 2)}\n`, "utf8"),
    ]);

    // Ensure an empty or populated custom atlas also exists
    await this.rebuildCustomAtlas();
    const catalog = await this.listCatalog();
    return { officeAtlasPath, nightAtlasPath, dayAtlasPath, catalog };
  }

  async rebuildCustomAtlas(): Promise<{ atlasPath: string; catalog: CatalogEntry[] }> {
    const core = await this.loadCore();
    await fs.mkdir(this.opts.runtimeOutDir, { recursive: true });
    const customItems = await this.readAssetsFromDir(this.customDir, "custom");
    const atlasPath = path.join(this.opts.runtimeOutDir, "custom-atlas.json");

    if (customItems.length === 0) {
      const emptyImg = core.createRGBAImage(2, 2);
      const emptyMeta = {
        frames: {},
        meta: {
          app: "iherk-pixcel",
          version: "1",
          image: "custom-atlas.png",
          emissiveImage: "custom-atlas_emissive.png",
          format: "RGBA8888",
          size: { w: 2, h: 2 },
          scale: "1",
          tilePreset: "64x32",
          stepX: 32,
          stepY: 16,
          tileOverlapY: 0,
        },
      };
      await Promise.all([
        fs.writeFile(path.join(this.opts.runtimeOutDir, "custom-atlas.png"), core.encodePNG(emptyImg)),
        fs.writeFile(path.join(this.opts.runtimeOutDir, "custom-atlas_emissive.png"), core.encodePNG(emptyImg)),
        fs.writeFile(atlasPath, `${JSON.stringify(emptyMeta, null, 2)}\n`, "utf8"),
      ]);
      return { atlasPath, catalog: await this.listCatalog() };
    }

    // Custom assets render as authored in all themes
    const sprites = this.renderAssetsToSprites(
      core,
      customItems.map((c) => c.asset),
      "night",
    );
    const packed = core.packSpriteAtlas(sprites, {
      imageName: "custom-atlas.png",
      emissiveImageName: "custom-atlas_emissive.png",
      tilePreset: "64x32",
      padding: 1,
    });

    const tmpPng = path.join(this.opts.runtimeOutDir, "custom-atlas.png.tmp");
    const tmpEm = path.join(this.opts.runtimeOutDir, "custom-atlas_emissive.png.tmp");
    const tmpJson = path.join(this.opts.runtimeOutDir, "custom-atlas.json.tmp");

    await fs.writeFile(tmpPng, core.encodePNG(packed.sheet));
    if (packed.emissiveSheet) {
      await fs.writeFile(tmpEm, core.encodePNG(packed.emissiveSheet));
    }
    await fs.writeFile(tmpJson, `${JSON.stringify(packed.atlas, null, 2)}\n`, "utf8");

    await fs.rename(tmpPng, path.join(this.opts.runtimeOutDir, "custom-atlas.png"));
    if (packed.emissiveSheet) {
      await fs.rename(tmpEm, path.join(this.opts.runtimeOutDir, "custom-atlas_emissive.png"));
    }
    await fs.rename(tmpJson, atlasPath);

    return { atlasPath, catalog: await this.listCatalog() };
  }

  async craftCustomAsset(rawAsset: unknown): Promise<{
    assetId: string;
    catalogEntry: CatalogEntry;
    contactSheetPng: Buffer;
    customAtlasPath: string;
  }> {
    const core = await this.loadCore();
    // 1. Validate schema & compile in memory BEFORE writing anything to disk
    const asset = core.PixcelAssetSchema.parse(rawAsset);
    const firstFrame = compileFrames(core, asset)[0];
    const dummyPalette = { name: "office-night", colors: {} };

    // 2. Render 4-direction contact sheet for Gemini visual self-verification
    const renders = ALL_DIRECTIONS.map((dir) =>
      core.renderAssetFrame(asset, firstFrame.grid, dummyPalette, {
        direction: dir,
        emissiveMode: "baked",
      }),
    );
    const pad = 8;
    const totalW = renders.reduce((acc, r) => acc + r.main.width, 0) + pad * (renders.length + 1);
    const maxH = Math.max(...renders.map((r) => r.main.height)) + pad * 2;
    const contactImg = core.createRGBAImage(totalW, maxH);
    // Dark navy backdrop matching office preview
    for (let i = 0; i < contactImg.data.length; i += 4) {
      contactImg.data[i] = 10;
      contactImg.data[i + 1] = 14;
      contactImg.data[i + 2] = 26;
      contactImg.data[i + 3] = 255;
    }
    let cursorX = pad;
    for (const r of renders) {
      const y = maxH - pad - r.main.height;
      blitRGBA(r.main, contactImg, cursorX, y);
      cursorX += r.main.width + pad;
    }
    const contactSheetPng = core.encodePNG(contactImg);

    // 3. Persist validated asset file and atomically rebuild custom atlas
    await fs.mkdir(this.customDir, { recursive: true });
    const filePath = path.join(this.customDir, `${asset.id}.pixcel.json`);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, filePath);

    const { atlasPath } = await this.rebuildCustomAtlas();
    const effectiveLayer: AssetLayer = asset.category === "tabletop" ? "tabletop" : asset.layer;
    const cfg = resolveAssetLayerConfig(asset.id, effectiveLayer);
    const catalogEntry: CatalogEntry = {
      id: asset.id,
      category: asset.category,
      layer: effectiveLayer,
      footprintTiles: asset.footprintTiles,
      source: "custom",
      frames: frameNames(asset),
      renderLayer: cfg.renderLayer,
      tilePermission: cfg.tilePermission,
      ...(cfg.surfaceHeightVoxels !== undefined ? { surfaceHeightVoxels: cfg.surfaceHeightVoxels } : {}),
      ...(cfg.foregroundAssetId ? { foregroundAssetId: cfg.foregroundAssetId } : {}),
    };

    return {
      assetId: asset.id,
      catalogEntry,
      contactSheetPng,
      customAtlasPath: atlasPath,
    };
  }
}
