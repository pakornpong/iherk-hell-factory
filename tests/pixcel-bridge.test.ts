import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHARACTER_CLIPS, PixcelBridge } from "../src/server/pixcel-bridge.js";

describe("PixcelBridge & Hell Factory voxel assets", () => {
  it("compiles all 12 starter assets, 6 props, and 3 animated characters (+ variants) into night and day atlases", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-atlas-"));
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: process.cwd(),
      runtimeOutDir: outDir,
    });
    const res = await bridge.buildCoreAtlases();
    const nightAtlas = JSON.parse(await fs.readFile(res.nightAtlasPath, "utf8"));
    const dayAtlas = JSON.parse(await fs.readFile(res.dayAtlasPath, "utf8"));

    for (const propId of [
      "floor-lounge-rug",
      "divider-low-glass",
      "coffee-machine-bar",
      "sofa-lounge",
      "water-cooler",
      "bay-sign-post",
    ]) {
      expect(nightAtlas.frames[`${propId}/se/default`] ?? nightAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
      expect(dayAtlas.frames[`${propId}/se/default`] ?? dayAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
    }

    for (const charId of [
      "agent-starter",
      "agent-claude",
      "agent-claude-v1",
      "agent-gemini",
      "agent-gemini-v1",
    ]) {
      for (const dir of ["se", "sw", "nw", "ne"]) {
        for (const clip of CHARACTER_CLIPS) {
          expect(nightAtlas.frames[`${charId}/${dir}/${clip}`]).toBeDefined();
        }
      }
    }
    expect(nightAtlas.meta.emissiveImage).toBe("atlas-night_emissive.png");
    expect(dayAtlas.meta.emissiveImage).toBe("atlas-day_emissive.png");
  });

  it("crafts custom asset with 4-dir contact sheet and preserves existing custom atlas on invalid input", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hf-custom-"));
    await fs.mkdir(path.join(tmpRoot, "assets/pixcel/custom"), { recursive: true });
    const outDir = path.join(tmpRoot, "runtime-assets");
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
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
