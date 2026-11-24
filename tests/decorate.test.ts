import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DecorateController, type DecorateApiClient } from "../src/client/decorate.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, FurnitureInstance, WorldFurnitureInstance } from "../src/shared/types.js";

describe("DecorateController", () => {
  it("rotates clockwise through all 4 directions and supports place -> undo -> redo", async () => {
    const placed: FurnitureInstance[] = [];
    let counter = 0;

    const api: DecorateApiClient = {
      async placeFurniture(req) {
        const item: FurnitureInstance = {
          id: `f-${++counter}`,
          zoneId: "common:0",
          lx: req.tx,
          ly: req.ty,
          assetId: req.assetId,
          direction: req.direction,
          layer: "object",
          placedBy: "user",
        };
        placed.push(item);
        return item;
      },
      async removeFurniture(id) {
        const idx = placed.findIndex((p) => p.id === id);
        if (idx !== -1) placed.splice(idx, 1);
      },
    };

    const ctrl = new DecorateController(api);
    ctrl.toggle();
    expect(ctrl.active).toBe(true);
    expect(ctrl.direction).toBe("se");
    ctrl.rotateCw();
    expect(ctrl.direction).toBe("sw");
    ctrl.rotateCw();
    expect(ctrl.direction).toBe("nw");
    ctrl.rotateCw();
    expect(ctrl.direction).toBe("ne");
    ctrl.rotateCw();
    expect(ctrl.direction).toBe("se");

    ctrl.selectAsset("plant-potted");
    await ctrl.handleTileClick(2, 4);
    expect(placed).toHaveLength(1);
    expect(ctrl.canUndo()).toBe(true);

    await ctrl.undo();
    expect(placed).toHaveLength(0);
    expect(ctrl.canRedo()).toBe(true);

    await ctrl.redo();
    expect(placed).toHaveLength(1);
    expect(placed[0].assetId).toBe("plant-potted");
  });

  it("preserves exact item origin on multi-tile move+undo and supports cancelMove()", async () => {
    const moves: Array<{ id: string; tx: number; ty: number; direction?: string }> = [];
    const api: DecorateApiClient = {
      async placeFurniture() {
        throw new Error("unused");
      },
      async moveFurniture(id, req) {
        moves.push({ id, ...req });
        return {
          id,
          zoneId: "boss:0",
          lx: req.tx,
          ly: req.ty,
          assetId: "desk-dev-dual",
          direction: req.direction ?? "se",
          layer: "object",
          placedBy: "user",
        };
      },
      async removeFurniture() {},
    };

    const desk: WorldFurnitureInstance = {
      id: "boss:0-boss-desk",
      zoneId: "boss:0",
      lx: 2,
      ly: 2,
      tx: 2,
      ty: 2,
      footprintTiles: [2, 1],
      assetId: "desk-dev-dual",
      direction: "nw",
      layer: "object",
      placedBy: "system",
    };

    const ctrl = new DecorateController(api);
    ctrl.setActive(true);
    ctrl.setTool("move");

    // Pick up by clicking secondary tile (3, 2) -> origin must be recorded as actual (2, 2)
    await ctrl.handleTileClick(3, 2, desk);
    expect(ctrl.movingItem?.originTx).toBe(2);
    expect(ctrl.movingItem?.originTy).toBe(2);

    // Cancel move puts it down cleanly without exiting Decorate Mode
    expect(ctrl.cancelMove()).toBe(true);
    expect(ctrl.movingItem).toBeNull();
    expect(ctrl.active).toBe(true);

    // Pick up again and drop at (1, 3), then undo -> restores exact (2, 2)
    await ctrl.handleTileClick(3, 2, desk);
    await ctrl.handleTileClick(1, 3);
    expect(moves[0]).toEqual({ id: "boss:0-boss-desk", tx: 1, ty: 3, direction: "nw" });

    await ctrl.undo();
    expect(moves[1]).toEqual({ id: "boss:0-boss-desk", tx: 2, ty: 2, direction: "nw" });
  });

  it("allows moving, rotating, and persisting furniture in cowork:0 and amenity:* rooms without teleporting off back walls", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-move-all-zones-"));
    const catalog = new Map<string, CatalogEntry>([
      ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
      ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
      ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
      ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
      ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
      ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
      ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
      ["office-locker-bank", { id: "office-locker-bank", category: "office", layer: "object", footprintTiles: [1, 1], source: "prop" }],
      ["printer-copier", { id: "printer-copier", category: "tech", layer: "object", footprintTiles: [1, 1], source: "prop" }],
      ["water-cooler", { id: "water-cooler", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
    ]);

    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({ store, catalogById: catalog });
    await engine.init();

    // 1. Move a furniture piece inside cowork:0
    const snap0 = engine.getSnapshot();
    const coworkZone = snap0.campus.zones.find((z) => z.zoneId === "cowork:0")!;
    const coworkPlant = snap0.campus.worldFurniture.find(
      (f) => f.zoneId === "cowork:0" && f.assetId === "plant-potted",
    )!;
    const movedCowork = await engine.moveFurniture(coworkPlant.id, {
      tx: coworkZone.originX + 2,
      ty: coworkZone.originY + 0,
      direction: "sw",
    });
    expect(movedCowork.zoneId).toBe("cowork:0");
    expect(movedCowork.lx).toBe(2);
    expect(movedCowork.ly).toBe(0);
    expect(movedCowork.direction).toBe("sw");

    // 2. Move a furniture piece inside an amenity:* room
    const amenityZone = snap0.campus.zones.find((z) => z.zoneId === "amenity:0")!;
    const amenityItem = snap0.campus.worldFurniture.find((f) => f.zoneId === "amenity:0")!;
    // Register its asset in catalog if not already present
    if (!catalog.has(amenityItem.assetId)) {
      catalog.set(amenityItem.assetId, {
        id: amenityItem.assetId,
        category: "decor",
        layer: "object",
        footprintTiles: amenityItem.footprintTiles,
        source: "prop",
      });
      engine.updateCatalog([...catalog.values()]);
    }
    const movedAmenity = await engine.moveFurniture(amenityItem.id, {
      tx: amenityZone.originX + 3,
      ty: amenityZone.originY + 3,
    });
    expect(movedAmenity.zoneId).toBe("amenity:0");
    expect(movedAmenity.lx).toBe(3);
    expect(movedAmenity.ly).toBe(3);

    // 3. Wide furniture placed at ly = 0 stays at exact ly = 0 (no silent teleport)
    const bossSofa = snap0.campus.worldFurniture.find(
      (f) => f.zoneId === "boss:0" && f.assetId === "sofa-lounge",
    )!;
    await engine.moveFurniture(bossSofa.id, { zoneId: "boss:0", lx: 2, ly: 0, direction: "se" });
    const afterBoss = engine.getSnapshot().campus.worldFurniture.find((f) => f.id === bossSofa.id)!;
    expect(afterBoss.tx).toBe(2);
    expect(afterBoss.ty).toBe(0);

    // 4. Persists across restart
    const engine2 = new OfficeEngine({ store, catalogById: catalog });
    await engine2.init();
    const persistedCowork = engine2.getSnapshot().campus.worldFurniture.find((f) => f.id === coworkPlant.id)!;
    expect(persistedCowork.lx).toBe(2);
    expect(persistedCowork.ly).toBe(0);
    expect(persistedCowork.direction).toBe("sw");
  });
});
