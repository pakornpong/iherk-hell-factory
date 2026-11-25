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

  it("allows moving, rotating, painting floor, resizing floor, defining custom zones, and placing lockers flush against edge glass dividers", async () => {
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
      ["divider-low-glass", { id: "divider-low-glass", category: "architecture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
      ["divider-low-glass-corner", { id: "divider-low-glass-corner", category: "architecture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
      ["divider-low-glass-door", { id: "divider-low-glass-door", category: "architecture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
      ["floor-office-carpet", { id: "floor-office-carpet", category: "floor", layer: "floor", footprintTiles: [1, 1], source: "prop" }],
      ["floor-scifi-deck", { id: "floor-scifi-deck", category: "floor", layer: "floor", footprintTiles: [1, 1], source: "prop" }],
    ]);

    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({ store, catalogById: catalog });
    await engine.init();

    // 1. Place edge-mounted glass corner + door and place lockers FLUSH on the EXACT SAME tile & adjacent tile!
    await engine.placeFurniture({ tx: 8, ty: 10, assetId: "divider-low-glass-corner", direction: "nw", placedBy: "user" });
    await engine.placeFurniture({ tx: 9, ty: 10, assetId: "divider-low-glass-door", direction: "nw", placedBy: "user" });
    const lockerInside = await engine.placeFurniture({ tx: 8, ty: 10, assetId: "office-locker-bank", direction: "se", placedBy: "user" });
    const lockerOutside = await engine.placeFurniture({ tx: 8, ty: 11, assetId: "office-locker-bank", direction: "se", placedBy: "user" });
    expect([lockerInside.lx, lockerInside.ly]).toEqual([8, 10]);
    expect([lockerOutside.lx, lockerOutside.ly]).toEqual([8, 11]);
    await expect(
      engine.placeFurniture({ tx: 8, ty: 11, assetId: "divider-low-glass", direction: "se", placedBy: "user" }),
    ).rejects.toThrow(/already occupies edge/i);

    // 2. Place 2x1 desk straddling former 6x6 Boss/Central seam (x=5..6) — zero invisible 6x6 walls!
    const seamDesk = await engine.placeFurniture({ tx: 5, ty: 4, assetId: "desk-dev-dual", direction: "se", placedBy: "user" });
    expect([seamDesk.lx, seamDesk.ly]).toEqual([5, 4]);

    // 3. Floor painting (2x2 brush + Undo/Redo)
    const ctrl = new DecorateController({
      async placeFurniture() {
        throw new Error("unused");
      },
      async removeFurniture() {},
      async paintFloorTiles(tiles) {
        await engine.setFloorTiles(tiles);
      },
    });
    ctrl.setActive(true);
    ctrl.selectAsset("floor-scifi-deck");
    ctrl.setFloorBrushSize(2);
    const s0 = engine.getSnapshot();
    await ctrl.paintFloorAt(10, 12, s0.campus.widthTiles, s0.campus.depthTiles, s0.state.floorTileOverrides);
    expect(engine.getSnapshot().campus.floors.find((f) => f.tx === 11 && f.ty === 13)?.assetId).toBe("floor-scifi-deck");
    await ctrl.undo();
    expect(engine.getSnapshot().campus.floors.find((f) => f.tx === 11 && f.ty === 13)?.assetId).toBe("floor-office-carpet");
    await ctrl.redo();
    expect(engine.getSnapshot().campus.floors.find((f) => f.tx === 11 && f.ty === 13)?.assetId).toBe("floor-scifi-deck");

    // 4. Expand & Shrink Floor
    const grown = await engine.resizeFloor({ deltaWidth: 6, deltaDepth: 6 });
    expect([grown.widthTiles, grown.depthTiles]).toEqual([30, 30]);
    const shrunk = await engine.resizeFloor({ deltaWidth: -6, deltaDepth: -6 });
    expect([shrunk.widthTiles, shrunk.depthTiles]).toEqual([24, 24]);

    // 5. Custom Zones (create, persist, delete)
    const zone = await engine.createCustomZone({
      name: "Dev Lab",
      icon: "🧪",
      color: "#22c55e",
      role: "work",
      x: 2,
      y: 10,
      width: 5,
      height: 5,
    });
    expect(zone.name).toBe("Dev Lab");
    expect(engine.getSnapshot().state.customZones).toHaveLength(1);

    // 6. Persists across restart
    const engine2 = new OfficeEngine({ store, catalogById: catalog });
    await engine2.init();
    expect(engine2.getSnapshot().state.customZones?.[0].name).toBe("Dev Lab");
    expect(engine2.getSnapshot().campus.floors.find((f) => f.tx === 11 && f.ty === 13)?.assetId).toBe("floor-scifi-deck");
    await engine2.deleteCustomZone(zone.id);
    expect(engine2.getSnapshot().state.customZones).toBeUndefined();
  });
});
