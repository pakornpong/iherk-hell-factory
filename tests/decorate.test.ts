import { describe, expect, it } from "vitest";
import { DecorateController, type DecorateApiClient } from "../src/client/decorate.js";
import type { FurnitureInstance } from "../src/shared/types.js";

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
});
