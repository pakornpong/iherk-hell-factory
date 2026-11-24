import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CatalogEntry, Direction } from "../shared/types.js";

export const CHARACTER_CLIPS = [
  "idle_0",
  "idle_1",
  "walk_0",
  "walk_1",
  "walk_2",
  "walk_3",
  "sit_type_0",
  "sit_type_1",
  "talk_0",
  "talk_1",
  "assign_0",
  "assign_1",
  "rest_coffee_0",
  "rest_coffee_1",
  "rest_sleep_0",
  "rest_sleep_1",
] as const;

const ALL_DIRECTIONS: Direction[] = ["se", "sw", "nw", "ne"];

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
}

interface RGBAImageLike {
  width: number;
  height: number;
  data: Uint8Array;
}

interface PixcelCoreModules {
  PixcelAssetSchema: { parse: (v: unknown) => PixcelAssetLike };
  compileAsset: (asset: PixcelAssetLike) => { frames: Array<{ name: string; durationMs: number; grid: unknown }> };
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

const TEAMMATE_VARIANTS: Record<string, Array<{ suffix: string; hair: string; outfitTrim: string; badge?: string }>> = {
  "agent-claude": [
    { suffix: "v1", hair: "#7c2d12", outfitTrim: "#9a3412", badge: "#fcd34d" },
    { suffix: "v2", hair: "#1f2937", outfitTrim: "#c2410c", badge: "#fdba74" },
    { suffix: "v3", hair: "#a16207", outfitTrim: "#9f1239", badge: "#fbbf24" },
  ],
  "agent-gemini": [
    { suffix: "v1", hair: "#312e81", outfitTrim: "#2563eb", badge: "#22d3ee" },
    { suffix: "v2", hair: "#475569", outfitTrim: "#0284c7", badge: "#a5f3fc" },
    { suffix: "v3", hair: "#78350f", outfitTrim: "#6d28d9", badge: "#67e8f9" },
  ],
};

export function remapAssetToDayTheme(asset: PixcelAssetLike): PixcelAssetLike {
  const cloned = structuredClone(asset);
  for (const [matName, mat] of Object.entries(cloned.materials)) {
    const key = mat.color.toLowerCase();
    if (key in DAY_HEX_REMAP) {
      mat.color = DAY_HEX_REMAP[key];
    } else if (
      (asset.layer === "wall" || asset.id.startsWith("wall-")) &&
      mat.kind !== "emissive" &&
      mat.kind !== "glass"
    ) {
      // Fallback brighten any dark slate wall colors
      if (/^#[0-3][0-9a-f][0-3][0-9a-f][0-5][0-9a-f]$/i.test(key)) {
        mat.color = "#dcd6c8";
      }
    } else if (mat.kind === "glass" && asset.id.includes("window")) {
      mat.color = "#93c5fd";
    } else if (matName.includes("plank") && /^#[0-6]/.test(key)) {
      mat.color = "#b88a5b";
    }
  }
  return cloned;
}

function buildVariantAssets(base: PixcelAssetLike): PixcelAssetLike[] {
  const defs = TEAMMATE_VARIANTS[base.id];
  if (!defs) return [];
  return defs.map((v) => {
    const cloned = structuredClone(base);
    cloned.id = `${base.id}-${v.suffix}`;
    if (cloned.materials.hair) cloned.materials.hair.color = v.hair;
    if (cloned.materials.outfit_trim) cloned.materials.outfit_trim.color = v.outfitTrim;
    if (v.badge && cloned.materials.badge) cloned.materials.badge.color = v.badge;
    return cloned;
  });
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
        const [schemaMod, dslMod, postMod, atlasMod, pngMod] = await Promise.all([
          import(pathToFileURL(path.join(coreDir, "schema.js")).href),
          import(pathToFileURL(path.join(coreDir, "dsl-compiler.js")).href),
          import(pathToFileURL(path.join(coreDir, "postprocess.js")).href),
          import(pathToFileURL(path.join(coreDir, "exporters", "atlas.js")).href),
          import(pathToFileURL(path.join(coreDir, "exporters", "png.js")).href),
        ]);
        return {
          PixcelAssetSchema: schemaMod.PixcelAssetSchema,
          compileAsset: dslMod.compileAsset,
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

  private renderAssetsToSprites(
    core: PixcelCoreModules,
    assets: PixcelAssetLike[],
    theme: "night" | "day",
  ) {
    const dummyPalette = { name: theme === "day" ? "office-day" : "office-night", colors: {} };
    const sprites: Parameters<PixcelCoreModules["packSpriteAtlas"]>[0] = [];
    for (const original of assets) {
      const asset = theme === "day" && original.category !== "character" ? remapAssetToDayTheme(original) : original;
      const { frames } = core.compileAsset(asset);
      const dirs: Direction[] = asset.layer === "floor" ? ["se"] : ALL_DIRECTIONS;
      for (const dir of dirs) {
        for (const frame of frames) {
          const rendered = core.renderAssetFrame(asset, frame.grid, dummyPalette, {
            direction: dir,
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
      frames: asset.frames?.map((f) => f.name) ?? ["default"],
    }));
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    const [starter, props, chars, custom] = await Promise.all([
      this.readAssetsFromDir(this.starterDir, "starter"),
      this.readAssetsFromDir(this.propsDir, "prop"),
      this.readAssetsFromDir(this.charsDir, "character"),
      this.readAssetsFromDir(this.customDir, "custom"),
    ]);
    const expandedChars: Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }> = [];
    for (const c of chars) {
      expandedChars.push(c);
      for (const v of buildVariantAssets(c.asset)) {
        expandedChars.push({ asset: v, source: "character" });
      }
    }
    return this.toCatalogEntries([...starter, ...props, ...expandedChars, ...custom]);
  }

  async buildCoreAtlases(): Promise<{
    nightAtlasPath: string;
    dayAtlasPath: string;
    catalog: CatalogEntry[];
  }> {
    const core = await this.loadCore();
    await fs.mkdir(this.opts.runtimeOutDir, { recursive: true });

    const [starter, props, chars] = await Promise.all([
      this.readAssetsFromDir(this.starterDir, "starter"),
      this.readAssetsFromDir(this.propsDir, "prop"),
      this.readAssetsFromDir(this.charsDir, "character"),
    ]);

    const expandedChars: Array<{ asset: PixcelAssetLike; source: CatalogEntry["source"] }> = [];
    for (const c of chars) {
      expandedChars.push(c);
      for (const v of buildVariantAssets(c.asset)) {
        expandedChars.push({ asset: v, source: "character" });
      }
    }

    const allCore = [...starter, ...props, ...expandedChars];
    const assets = allCore.map((a) => a.asset);

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

    const nightAtlasPath = path.join(this.opts.runtimeOutDir, "atlas-night.json");
    const dayAtlasPath = path.join(this.opts.runtimeOutDir, "atlas-day.json");

    await Promise.all([
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
    return { nightAtlasPath, dayAtlasPath, catalog };
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

    // Custom assets render as authored in both themes
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
    const compiled = core.compileAsset(asset);
    const firstFrame = compiled.frames[0];
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
      frames: asset.frames?.map((f) => f.name) ?? ["default"],
    };

    return {
      assetId: asset.id,
      catalogEntry,
      contactSheetPng,
      customAtlasPath: atlasPath,
    };
  }
}
