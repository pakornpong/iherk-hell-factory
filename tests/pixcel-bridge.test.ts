import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHARACTER_CLIPS, PixcelBridge, pixcelRenderDirection } from "../src/server/pixcel-bridge.js";

describe("pixcelRenderDirection", () => {
  it("renders Phase 2 builder characters 1:1 with chair-office-swivel facing (se=+Y, sw=-X, nw=-Y, ne=+X)", () => {
    const builderChar = { category: "character", animations: { idle: { frames: [] } } };
    expect(pixcelRenderDirection(builderChar, "se")).toBe("se");
    expect(pixcelRenderDirection(builderChar, "sw")).toBe("sw");
    expect(pixcelRenderDirection(builderChar, "nw")).toBe("nw");
    expect(pixcelRenderDirection(builderChar, "ne")).toBe("ne");
  });

  it("leaves furniture and legacy frame-based assets unrotated", () => {
    expect(pixcelRenderDirection({ category: "furniture" }, "sw")).toBe("sw");
    expect(pixcelRenderDirection({ category: "character", frames: [] }, "sw")).toBe("sw");
  });
});

describe("PixcelBridge & Hell Factory voxel assets", () => {
  it("compiles all starter assets, office props, and Phase 2 characters (+ variants & boss) into office, night, and day atlases", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-atlas-"));
    const bridge = new PixcelBridge({
      pixcelRoot: process.env.IHERK_PIXCEL_ROOT ?? new URL("../../iherk-pixcel", import.meta.url).pathname,
      projectRoot: process.cwd(),
      runtimeOutDir: outDir,
    });
    const res = await bridge.buildCoreAtlases();
    const officeAtlas = JSON.parse(await fs.readFile(res.officeAtlasPath, "utf8"));
    const nightAtlas = JSON.parse(await fs.readFile(res.nightAtlasPath, "utf8"));
    const dayAtlas = JSON.parse(await fs.readFile(res.dayAtlasPath, "utf8"));

    for (const propId of [
      "floor-lounge-rug",
      "floor-office-carpet",
      "floor-boss-rug",
      "divider-low-glass",
      "divider-cubicle-amber",
      "coffee-machine-bar",
      "sofa-lounge",
      "water-cooler",
      "bay-sign-post",
      "printer-copier",
      "filing-cabinet",
      "robot-vacuum",
      "wall-ac-unit",
      "wall-corkboard",
    ]) {
      expect(officeAtlas.frames[`${propId}/se/default`] ?? officeAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
      expect(nightAtlas.frames[`${propId}/se/default`] ?? nightAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
      expect(dayAtlas.frames[`${propId}/se/default`] ?? dayAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
    }

    for (const charId of [
      "agent-boss",
      "agent-starter",
      "agent-claude",
      "agent-claude-v1",
      "agent-claude-v2",
      "agent-claude-v3",
      "agent-gemini",
      "agent-gemini-v1",
      "agent-gemini-v2",
      "agent-gemini-v3",
    ]) {
      for (const dir of ["se", "sw", "nw", "ne"]) {
        for (const clip of CHARACTER_CLIPS) {
          expect(officeAtlas.frames[`${charId}/${dir}/${clip}`]).toBeDefined();
          expect(nightAtlas.frames[`${charId}/${dir}/${clip}`]).toBeDefined();
        }
      }
    }
    const claude = res.catalog.find((c) => c.id === "agent-claude");
    expect(claude?.frames).toEqual(expect.arrayContaining([...CHARACTER_CLIPS]));
    expect(officeAtlas.meta.emissiveImage).toBe("atlas-office_emissive.png");
    expect(nightAtlas.meta.emissiveImage).toBe("atlas-night_emissive.png");
    expect(dayAtlas.meta.emissiveImage).toBe("atlas-day_emissive.png");
  });

  it("lists the bundled library without rendering it, then caches requested asset atlases", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-library-"));
    const bridge = new PixcelBridge({
      pixcelRoot: process.env.IHERK_PIXCEL_ROOT ?? new URL("../../iherk-pixcel", import.meta.url).pathname,
      projectRoot: process.cwd(),
      runtimeOutDir: outDir,
    });

    try {
      const catalog = await bridge.listCatalog();
      const assetId = "access-threshold-ramp-pair-compact-guide-path";
      expect(catalog.find((asset) => asset.id === assetId)).toMatchObject({
        id: assetId, source: "library", category: "accessibility",
      });
      expect(catalog.find((asset) => asset.id === "mounted-art-alpine-sunrise")).toMatchObject({
        wallMountBounds: { left: 4, right: 28, bottom: 0, top: 17 },
      });
      expect(await fs.readdir(outDir)).toEqual([]);
      expect(await bridge.getLibraryAtlas("../outside", "office")).toBeNull();

      const [first, second] = await Promise.all([
        bridge.getLibraryAtlas(assetId, "office"),
        bridge.getLibraryAtlas(assetId, "office"),
      ]);
      const atlas = first as { frames: Record<string, unknown>; meta: { image: string } };
      expect(first).toBe(second);
      expect(Object.keys(atlas.frames)).toHaveLength(4);
      expect(await fs.stat(path.join(outDir, "library", atlas.meta.image))).toHaveProperty("size", expect.any(Number));
      expect(await bridge.getLibraryAtlas(assetId, "office")).toEqual(first);
    } finally {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  });

  it("crafts custom asset with 4-dir contact sheet and preserves existing custom atlas on invalid input", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hf-custom-"));
    await fs.mkdir(path.join(tmpRoot, "assets/pixcel/custom"), { recursive: true });
    const outDir = path.join(tmpRoot, "runtime-assets");
    const bridge = new PixcelBridge({
      pixcelRoot: process.env.IHERK_PIXCEL_ROOT ?? new URL("../../iherk-pixcel", import.meta.url).pathname,
      projectRoot: tmpRoot,
      runtimeOutDir: outDir,
    });
    const valid = await bridge.craftCustomAsset({
      schemaVersion: 1,
      id: "custom-lamp",
      category: "decor",
      layer: "object",
      outlineMode: "silhouette",
      tilePreset: "64x32",
      voxelsPerTile: 32,
      footprintTiles: [1, 1],
      palette: "office-night",
      materials: {
        base: { color: "#334155", kind: "metal" },
        bulb: { color: "#facc15", kind: "emissive", glowRadius: 2, glowIntensity: 0.6 },
      },
      ops: [
        { op: "box", from: [12, 12, 0], to: [19, 19, 14], material: "base" },
        { op: "box", from: [13, 13, 15], to: [18, 18, 19], material: "bulb" },
      ],
      decals: [],
    });
    expect(valid.contactSheetPng.subarray(0, 4).toString("hex")).toBe("89504e47");
    const beforeAtlas = await fs.readFile(valid.customAtlasPath, "utf8");

    await expect(
      bridge.craftCustomAsset({
        schemaVersion: 1,
        id: "bad-lamp",
        ops: [{ op: "box", from: [0, 0, 0], to: [5, 5, 5], material: "missing_mat" }],
        materials: {},
      }),
    ).rejects.toThrow();
    expect(await fs.readFile(valid.customAtlasPath, "utf8")).toBe(beforeAtlas);
  });
});
