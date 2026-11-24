import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CatalogEntry, Direction, ThemeMode } from "../shared/types.js";

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
  layer: "floor" | "wall" | "wall-decor" | "object";
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
  animations?: Record<string, { frames: Array<{ name: string; durationMs?: number }> } & Record<string, unknown>>;
}

type CompiledFrameLike = { name: string; durationMs: number; grid: unknown };

interface RGBAImageLike {
  width: number;
  height: number;
  data: Uint8Array;
}

interface PixcelCoreModules {
  PixcelAssetSchema: { parse: (v: unknown) => PixcelAssetLike };
  compileAsset: (asset: PixcelAssetLike) => { frames: CompiledFrameLike[] };
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
      layer: "floor" | "wall" | "wall-decor" | "object";
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
    } else if (mat.kind === "glass" && (asset.id.includes("window") || asset.id.startsWith("room-"))) {
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
      } else if (mat.kind === "emissive" && cloned.id.includes("window")) {
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

export class PixcelBridge {
  private corePromise: Promise<PixcelCoreModules> | null = null;
  private readonly starterDir: string;
  private readonly propsDir: string;
  private readonly charsDir: string;
  private readonly customDir: string;

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
      asset: core.buildCharacterAsset(spec),
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
      for (const dir of dirs) {
        for (const frame of frames) {
          const rendered = core.renderAssetFrame(asset, frame.grid, dummyPalette, {
            direction: pixcelRenderDirection(asset, dir),
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
    return items.map(({ asset, source }) => ({
      id: asset.id,
      category: asset.category,
      layer: asset.layer,
      footprintTiles: asset.footprintTiles,
      source,
      frames: frameNames(asset),
    }));
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    const [starter, props, chars, custom] = await Promise.all([
      this.readAssetsFromDir(this.starterDir, "starter"),
      this.readAssetsFromDir(this.propsDir, "prop"),
      this.loadCharacterAssets(),
      this.readAssetsFromDir(this.customDir, "custom"),
    ]);
    return this.toCatalogEntries([...starter, ...props, ...chars, ...custom]);
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

    const allCore = [...starter, ...props, ...chars];
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
    const catalogEntry: CatalogEntry = {
      id: asset.id,
      category: asset.category,
      layer: asset.layer,
      footprintTiles: asset.footprintTiles,
      source: "custom",
      frames: frameNames(asset),
    };

    return {
      assetId: asset.id,
      catalogEntry,
      contactSheetPng,
      customAtlasPath: atlasPath,
    };
  }
}
