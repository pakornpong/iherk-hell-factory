import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sortUnifiedIsoEntities } from "../src/client/iso-renderer.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import {
  getSurfaceHostHeightVoxels,
  isSurfaceHostAsset,
  isTabletopAsset,
  RENDER_LAYER,
  resolveAssetLayerConfig,
} from "../src/shared/layers.js";
import type { CatalogEntry } from "../src/shared/types.js";

const TABLETOP_IDS = [
  "prop-desk-lamp",
  "prop-laptop",
  "prop-book-stack",
  "prop-coffee-mug",
  "prop-mini-plant",
] as const;

function buildMockCatalog(): Map<string, CatalogEntry> {
  const entries: CatalogEntry[] = [
    { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" },
    { id: "desk-drafting", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" },
    { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" },
    { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" },
    { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" },
    { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" },
    { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" },
    { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" },
    { id: "cabinet-wood-tall", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "prop" },
    { id: "filing-cabinet", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "prop" },
    { id: "trash-bin-office", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" },
    { id: "fire-extinguisher", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" },
    { id: "bay-sign-post", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" },
    ...TABLETOP_IDS.map(
      (id): CatalogEntry => ({
        id,
        category: "tabletop",
        layer: "tabletop",
        footprintTiles: [1, 1],
        source: "prop",
        renderLayer: RENDER_LAYER.TABLETOP,
      }),
    ),
  ];
  return new Map(entries.map((e) => [e.id, e]));
}

describe("Tabletop Props & Surface Placement", () => {
  it("authors all 5 tabletop prop .pixcel.json files and resolves them to RENDER_LAYER.TABLETOP (5)", async () => {
    for (const id of TABLETOP_IDS) {
      const filePath = path.resolve("assets", "pixcel", "props", `${id}.pixcel.json`);
      const doc = JSON.parse(await fs.readFile(filePath, "utf8"));
      expect(doc.id).toBe(id);
      expect(doc.category).toBe("tabletop");
      expect(doc.layer).toBe("object"); // upstream iherk-pixcel schema layer
      expect(doc.footprintTiles).toEqual([1, 1]);
      expect(Array.isArray(doc.ops) && doc.ops.length).toBeGreaterThan(3);

      const cfg = resolveAssetLayerConfig(id, "tabletop");
      expect(cfg.renderLayer).toBe(RENDER_LAYER.TABLETOP);
      expect(isTabletopAsset(id, "tabletop")).toBe(true);
    }

    expect(isSurfaceHostAsset("desk-dev-dual")).toBe(true);
    expect(getSurfaceHostHeightVoxels("desk-dev-dual")).toBe(17);
    expect(getSurfaceHostHeightVoxels("coffee-machine-bar")).toBe(18);
    expect(getSurfaceHostHeightVoxels("desk-drafting")).toBe(20);
    expect(isSurfaceHostAsset("plant-potted")).toBe(false);
  });

  it("places tabletop props on desks/tables with surfaceOffsetY, rejects bare floor/duplicate slots, and cascades move & delete with host desk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-tabletop-"));
    const catalog = buildMockCatalog();
    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({ store, catalogById: catalog });
    await engine.init();

    const snap0 = engine.getSnapshot();
    const bossDesk = snap0.campus.worldFurniture.find((f) => f.id === "boss:0-boss-desk")!;
    expect(bossDesk.tx).toBe(2);
    expect(bossDesk.ty).toBe(2);
    expect(bossDesk.footprintTiles).toEqual([2, 1]);

    // Boss Desk comes pre-decorated with default tabletop props (lamp + coffee mug)
    const defaultLamp = snap0.campus.worldFurniture.find((f) => f.id === "boss:0-boss-lamp")!;
    const defaultMug = snap0.campus.worldFurniture.find((f) => f.id === "boss:0-boss-mug")!;
    expect(defaultLamp.renderLayer).toBe(RENDER_LAYER.TABLETOP);
    expect(defaultLamp.surfaceOffsetY).toBe(17);
    expect(defaultMug.renderLayer).toBe(RENDER_LAYER.TABLETOP);
    // Clear the default tabletop items so we can test manual placement from scratch
    await engine.removeFurniture(defaultLamp.id);
    await engine.removeFurniture(defaultMug.id);

    // 1. Reject placing tabletop prop on bare floor (1, 3) or on a non-surface chair (2, 1)
    await expect(
      engine.placeFurniture({ zoneId: "boss:0", lx: 1, ly: 3, assetId: "prop-desk-lamp", direction: "se", placedBy: "user" }),
    ).rejects.toThrow(/desk or table surface/i);
    await expect(
      engine.placeFurniture({ zoneId: "boss:0", lx: 2, ly: 1, assetId: "prop-laptop", direction: "se", placedBy: "user" }),
    ).rejects.toThrow(/desk or table surface/i);

    // 2. Place lamp on left tile (2, 2) and laptop on right tile (3, 2) of the 2x1 Boss Desk
    const lamp = await engine.placeFurniture({
      zoneId: "boss:0",
      lx: 2,
      ly: 2,
      assetId: "prop-desk-lamp",
      direction: "se",
      placedBy: "user",
    });
    const laptop = await engine.placeFurniture({
      zoneId: "boss:0",
      lx: 3,
      ly: 2,
      assetId: "prop-laptop",
      direction: "nw",
      placedBy: "user",
    });
    expect(lamp.layer).toBe("tabletop");
    expect(lamp.surfaceHostId).toBe(bossDesk.id);
    expect(laptop.surfaceHostId).toBe(bossDesk.id);

    // Verify computed worldFurniture has renderLayer=5 and surfaceOffsetY=17
    const snap1 = engine.getSnapshot();
    const worldLamp = snap1.campus.worldFurniture.find((f) => f.id === lamp.id)!;
    const worldLaptop = snap1.campus.worldFurniture.find((f) => f.id === laptop.id)!;
    expect(worldLamp.renderLayer).toBe(RENDER_LAYER.TABLETOP);
    expect(worldLamp.surfaceOffsetY).toBe(17);
    expect(worldLaptop.surfaceOffsetY).toBe(17);

    // 3. Reject placing a second tabletop prop on the exact same slot (2, 2)
    await expect(
      engine.placeFurniture({ zoneId: "boss:0", lx: 2, ly: 2, assetId: "prop-coffee-mug", direction: "se", placedBy: "user" }),
    ).rejects.toThrow(/already occupied/i);

    // 4. Moving the host desk carries BOTH lamp and laptop along to the new tiles (even when rotated 90 deg!)
    await engine.moveFurniture(bossDesk.id, { zoneId: "boss:0", lx: 4, ly: 3, direction: "ne" });
    const snap2 = engine.getSnapshot();
    const movedDesk = snap2.campus.worldFurniture.find((f) => f.id === bossDesk.id)!;
    const movedLamp = snap2.campus.worldFurniture.find((f) => f.id === lamp.id)!;
    const movedLaptop = snap2.campus.worldFurniture.find((f) => f.id === laptop.id)!;
    expect(movedDesk.tx).toBe(4);
    expect(movedDesk.ty).toBe(3);
    expect(movedDesk.footprintTiles).toEqual([1, 2]);
    // Both tabletop props must stay on the rotated desk's 1x2 tiles (4,3) & (4,4) without overlapping
    const hostedCoords = [
      `${movedLamp.tx},${movedLamp.ty}`,
      `${movedLaptop.tx},${movedLaptop.ty}`,
    ].sort();
    expect(hostedCoords).toEqual(["4,3", "4,4"]);

    // 5. Deleting the host desk removes hosted tabletop props cleanly so nothing floats in mid-air
    await engine.removeFurniture(bossDesk.id);
    const snap3 = engine.getSnapshot();
    expect(snap3.campus.worldFurniture.some((f) => f.id === lamp.id)).toBe(false);
    expect(snap3.campus.worldFurniture.some((f) => f.id === laptop.id)).toBe(false);
  });

  it("depth-sorts tabletop props after their host desk and behind front characters & front walls", () => {
    const charBehind = { id: "char-behind", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };
    const desk = { id: "desk", x: 2, y: 2, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };
    const lamp = { id: "prop-desk-lamp", x: 2, y: 2, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.TABLETOP };
    const charFront = { id: "char-front", x: 2.2, y: 3.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };

    expect(sortUnifiedIsoEntities([charFront, lamp, desk, charBehind]).map((s) => s.id)).toEqual([
      "char-behind",
      "desk",
      "prop-desk-lamp",
      "char-front",
    ]);
  });
});
