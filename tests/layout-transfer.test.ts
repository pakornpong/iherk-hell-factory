import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry } from "../src/shared/types.js";

const fixtures: string[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createOffice() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-layout-transfer-"));
  fixtures.push(dir);
  const store = new OfficeStore(dir);
  const engine = new OfficeEngine({ store, catalogById: new Map(), now: () => 1_000 });
  await engine.init();
  const initial = engine.exportLayout();
  const catalogById = new Map<string, CatalogEntry>();
  for (const item of [
    ...initial.bossFurniture,
    ...Object.values(initial.bayFurniture).flat(),
    ...Object.values(initial.commonFurniture).flat(),
    ...engine.getSnapshot().campus.worldFurniture,
  ]) {
    catalogById.set(item.assetId, {
      id: item.assetId, layer: item.layer, category: "test", footprintTiles: [1, 1], source: "starter",
    });
  }
  catalogById.set("plant-potted", {
    id: "plant-potted", layer: "object", category: "decor", footprintTiles: [1, 1], source: "starter",
  });
  catalogById.set("floor-carpet-test", {
    id: "floor-carpet-test", layer: "floor", category: "floor", footprintTiles: [1, 1], source: "starter",
  });
  engine.updateCatalog([...catalogById.values()]);
  return { engine, store, catalogById };
}

describe("Office layout files", () => {
  it("restores placement, floor, permissions and zones while preserving provider and project state", async () => {
    const { engine, store, catalogById } = await createOffice();
    await engine.resizeFloor({ widthTiles: 30, depthTiles: 28 });
    const plant = await engine.placeFurniture({
      tx: 18.5, ty: 13.5, assetId: "plant-potted", direction: "sw", placedBy: "user",
    });
    await engine.setFloorTiles([{ tx: 19, ty: 13, assetId: "floor-carpet-test" }]);
    await engine.setTilePermissionOverride(19, 13, 0);
    const zone = await engine.createCustomZone({ x: 17, y: 12, width: 4, height: 5, name: "Studio" });
    await engine.setTheme("day");

    const exported = engine.exportLayout();
    expect(exported).toMatchObject({ format: "iherk-office-layout", version: 1, widthTiles: 30, depthTiles: 28 });
    expect(exported).not.toHaveProperty("employees");
    expect(exported).not.toHaveProperty("activityLog");
    expect(JSON.stringify(exported)).not.toContain("projectPath");

    await engine.moveFurniture(plant.id, { tx: 20, ty: 15 });
    await engine.clearFloorTileOverrides();
    await engine.clearTilePermissionOverrides();
    await engine.ingestEvent({
      eventType: "prompt_submit", sessionId: "new-session", provider: "codex", source: "codex",
      projectPath: "/private/new-project",
    });
    // The imported file was exported before the new project was created.
    const afterActivity = engine.getSnapshot();
    const result = await engine.importLayout(JSON.parse(JSON.stringify(exported)));
    expect(result.state.employees).toEqual(afterActivity.state.employees);
    expect(result.state.activityLog).toEqual(afterActivity.state.activityLog);
    expect(result.state.bays.map((bay) => bay.projectPath)).toEqual(afterActivity.state.bays.map((bay) => bay.projectPath));
    expect(result.state.customZones).toContainEqual(zone);
    expect(result.state.floorTileOverrides).toEqual({ "19,13": "floor-carpet-test" });
    expect(result.state.tilePermissionOverrides).toEqual({ "19,13": 0 });
    expect(result.campus.worldFurniture.find((item) => item.id === plant.id)).toMatchObject({
      tx: 18.5, ty: 13.5, direction: "sw",
    });
    const reloaded = new OfficeEngine({ store, catalogById, now: () => 1_000 });
    await reloaded.init();
    expect(reloaded.getSnapshot().state.zoneOverrides).toEqual(result.state.zoneOverrides);
  });

  it("rejects invalid dimensions, unknown assets and save failures without publishing a replacement", async () => {
    const { engine, store } = await createOffice();
    const before = engine.getSnapshot();
    const onSnapshot = vi.fn();
    engine.on("snapshot", onSnapshot);
    const layout = engine.exportLayout();
    const invalidZone = { ...layout, customZones: [{ id: "outside", name: "Outside", x: 95, y: 0, width: 2, height: 1 }] };
    await expect(engine.importLayout(invalidZone)).rejects.toThrow("outside the imported floor");
    const invalidAsset = { ...layout, bossFurniture: [{ ...layout.bossFurniture[0], assetId: "missing-asset" }] };
    await expect(engine.importLayout(invalidAsset)).rejects.toThrow("Unknown furniture asset");
    const first = layout.bossFurniture[0];
    const wrongLayer = { ...layout, bossFurniture: [{ ...first, layer: "tabletop" }] };
    await expect(engine.importLayout(wrongLayer)).rejects.toThrow("does not match the layer");
    const duplicate = { ...layout, bossFurniture: [...layout.bossFurniture, first] };
    await expect(engine.importLayout(duplicate)).rejects.toThrow("Duplicate furniture ID");
    vi.spyOn(store, "save").mockRejectedValueOnce(new Error("simulated disk failure"));
    await expect(engine.importLayout({ ...layout, theme: "night" })).rejects.toThrow("simulated disk failure");
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toEqual(before);
    expect(await store.load()).toEqual(before.state);
  });
});
