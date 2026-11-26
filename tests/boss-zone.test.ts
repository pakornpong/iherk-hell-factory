import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeCampusLayout, createDefaultBossOffice } from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import { isInBossArea } from "../src/shared/layers.js";
import type { CatalogEntry } from "../src/shared/types.js";

const entry = (id: string, footprintTiles: [number, number], layer: CatalogEntry["layer"] = "object"): [string, CatalogEntry] =>
  [id, { id, category: "furniture", layer, footprintTiles, source: "starter", frames: ["default"] }];
const catalog = new Map<string, CatalogEntry>([
  entry("desk-dev-dual", [2, 1]),
  entry("chair-office-swivel", [1, 1]),
  entry("table-conference", [2, 2]),
  entry("plant-potted", [1, 1]),
  entry("server-rack", [1, 1]),
  entry("bookshelf-wood", [1, 1]),
  entry("whiteboard-arch", [2, 1]),
  entry("prop-desk-lamp", [1, 1], "tabletop"),
  entry("prop-coffee-mug", [1, 1], "tabletop"),
]);

async function newEngine() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-boss-zone-"));
  const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 10_000 });
  await engine.init();
  // Default rooms use more props than the base catalog lists; register them so import validation passes
  const known = new Map(catalog);
  const { state, campus } = engine.getSnapshot();
  const stored = [...state.bays.flatMap((b) => b.furniture), ...state.commonWings.flatMap((w) => w.furniture)];
  for (const item of [...campus.worldFurniture, ...stored]) {
    if (!known.has(item.assetId)) {
      const footprintTiles = "footprintTiles" in item ? item.footprintTiles : [1, 1] as [number, number];
      known.set(item.assetId, { id: item.assetId, category: "furniture", layer: item.layer, footprintTiles, source: "starter", frames: ["default"] });
    }
  }
  engine.updateCatalog([...known.values()]);
  return { dir, engine };
}

describe("Resizable Boss zone", () => {
  it("sizes the Boss corner from the record and shifts the co-working hub to its right edge", () => {
    const base = computeCampusLayout([], [], catalog, createDefaultBossOffice());
    const wide = computeCampusLayout([], [], catalog, { ...createDefaultBossOffice(), width: 8, height: 10 });
    const zone = (campus: typeof base, kind: string) => campus.zones.find((z) => z.kind === kind)!;

    expect([zone(base, "boss").width, zone(base, "boss").height, zone(base, "cowork").originX]).toEqual([6, 6, 6]);
    expect([zone(wide, "boss").width, zone(wide, "boss").height, zone(wide, "cowork").originX]).toEqual([8, 10, 8]);

    const hubTiles = (campus: typeof base) => campus.worldFurniture.filter((f) => f.zoneId === "cowork:0").map((f) => [f.tx, f.ty]);
    expect(hubTiles(wide)).toEqual(hubTiles(base).map(([x, y]) => [x + 2, y]));
    expect(wide.floors.find((f) => f.tx === 6 && f.ty === 8)?.assetId).toBe("floor-boss-rug");
    expect(isInBossArea(wide, { id: "x", zoneId: "floor:0", tx: 7, ty: 9 })).toBe(true);
    expect(isInBossArea(base, { id: "x", zoneId: "floor:0", tx: 7, ty: 9 })).toBe(false);
  });

  it("resizes through the engine, persists across restarts and survives layout export/import", async () => {
    const { dir, engine } = await newEngine();
    expect(await engine.resizeBossZone({ deltaWidth: 2, deltaDepth: 3 })).toEqual({ width: 8, height: 9 });
    expect(await engine.resizeBossZone({ width: 99 })).toEqual({ width: 12, height: 9 });
    await engine.resizeBossZone({ width: 8 });

    const reloaded = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 10_000 });
    await reloaded.init();
    const boss = reloaded.getSnapshot().campus.zones.find((z) => z.kind === "boss")!;
    expect([boss.width, boss.height]).toEqual([8, 9]);

    const layout = reloaded.exportLayout();
    expect([layout.bossWidth, layout.bossHeight]).toEqual([8, 9]);
    const { engine: other } = await newEngine();
    await other.importLayout(layout);
    const imported = other.getSnapshot().campus.zones.find((z) => z.kind === "boss")!;
    expect([imported.width, imported.height]).toEqual([8, 9]);
  });

  it("refuses to shrink past Boss furniture", async () => {
    const { engine } = await newEngine();
    await engine.placeFurniture({ zoneId: "boss:0", lx: 4, ly: 4, assetId: "plant-potted", direction: "se", placedBy: "user" });
    await expect(engine.resizeBossZone({ width: 4 })).rejects.toThrow(/ย่อ Boss zone ไม่ได้/);
    expect(await engine.resizeBossZone({ width: 5, height: 5 })).toEqual({ width: 5, height: 5 });
  });

  it("pushes the rest of the layout with the corner edges and grows the floor", async () => {
    const { engine } = await newEngine();
    const before = engine.getSnapshot().campus;
    const east = await engine.placeFurniture({ tx: 13, ty: 2, assetId: "plant-potted", direction: "se", placedBy: "user" });
    const south = await engine.placeFurniture({ tx: 2, ty: 8, assetId: "plant-potted", direction: "se", placedBy: "user" });
    const west = await engine.placeFurniture({ tx: 8, ty: 8, assetId: "server-rack", direction: "se", placedBy: "user" });
    const zone = await engine.createCustomZone({ name: "East", x: 14, y: 8, width: 3, height: 3 });

    expect(await engine.resizeBossZone({ deltaWidth: 2, deltaDepth: 3 })).toEqual({ width: 8, height: 9 });
    const { campus, state } = engine.getSnapshot();
    const at = (id: string) => { const f = campus.worldFurniture.find((x) => x.id === id)!; return [f.tx, f.ty]; };
    expect(at(east.id)).toEqual([15, 2]);
    expect(at(south.id)).toEqual([2, 11]);
    expect(at(west.id)).toEqual([10, 8]);
    expect(state.customZones?.find((z) => z.id === zone.id)).toMatchObject({ x: 16, y: 8 });
    expect([campus.widthTiles, campus.depthTiles]).toEqual([before.widthTiles + 2, before.depthTiles + 3]);
    expect(campus.zones.find((z) => z.kind === "cowork")!.originX).toBe(8);

    // Shrinking pulls it back; the floor keeps its size
    expect(await engine.resizeBossZone({ width: 6, height: 6 })).toEqual({ width: 6, height: 6 });
    const back = engine.getSnapshot().campus;
    const at2 = (id: string) => { const f = back.worldFurniture.find((x) => x.id === id)!; return [f.tx, f.ty]; };
    expect([at2(east.id), at2(south.id), at2(west.id)]).toEqual([[13, 2], [2, 8], [8, 8]]);
  });

  it("refuses a resize that would make furniture overlap, and leaves the layout unchanged", async () => {
    const { engine } = await newEngine();
    // A plant inside the Boss column that the hub's corner plant (6,5) would slide onto
    await engine.placeFurniture({ tx: 5, ty: 5, assetId: "plant-potted", direction: "se", placedBy: "user" });
    await expect(engine.resizeBossZone({ width: 5 })).rejects.toThrow(/จะทับกัน/);
    const after = engine.getSnapshot().campus;
    expect(after.zones.find((z) => z.kind === "boss")!.width).toBe(6);
    expect(after.zones.find((z) => z.kind === "cowork")!.originX).toBe(6);
    expect(after.worldFurniture.some((f) => f.zoneId === "cowork:0" && f.tx === 6 && f.ty === 5)).toBe(true);
  });

  it("draws the Boss zone anywhere: Boss furniture moves with it, the hub stays, and it survives restart/export", async () => {
    const { dir, engine } = await newEngine();
    const before = engine.getSnapshot().campus;
    const hub = before.zones.find((z) => z.kind === "cowork")!;
    const bossItems = before.worldFurniture.filter((f) => f.zoneId === "boss:0").map((f) => [f.id, f.tx, f.ty] as const);
    const placedInside = await engine.placeFurniture({ tx: 5, ty: 5, assetId: "plant-potted", direction: "se", placedBy: "user" });
    const placedOutside = await engine.placeFurniture({ tx: 14, ty: 2, assetId: "plant-potted", direction: "se", placedBy: "user" });
    bossItems.push([placedInside.id, 5, 5]);

    expect(await engine.setBossZoneRect({ x: 2, y: 12, width: 7, height: 6 })).toEqual({ x: 2, y: 12, width: 7, height: 6 });
    const after = engine.getSnapshot().campus;
    const boss = after.zones.find((z) => z.kind === "boss")!;
    expect([boss.originX, boss.originY, boss.width, boss.height]).toEqual([2, 12, 7, 6]);
    const hubAfter = after.zones.find((z) => z.kind === "cowork")!;
    expect([hubAfter.originX, hubAfter.originY]).toEqual([hub.originX, hub.originY]);
    for (const [id, tx, ty] of bossItems) {
      const moved = after.worldFurniture.find((f) => f.id === id)!;
      expect([moved.tx, moved.ty]).toEqual([tx + 2, ty + 12]);
    }
    const outside = after.worldFurniture.find((f) => f.id === placedOutside.id)!;
    expect([outside.tx, outside.ty]).toEqual([14, 2]);
    expect(isInBossArea(after, { id: "x", zoneId: "floor:0", tx: 3, ty: 13 })).toBe(true);
    expect(isInBossArea(after, { id: "x", zoneId: "floor:0", tx: 1, ty: 1 })).toBe(false);
    expect(after.floors.find((f) => f.tx === 3 && f.ty === 13)?.assetId).toBe("floor-boss-rug");

    // Widening the drawn corner pushes the pinned hub only if it lies east of it (it does not here)
    await engine.resizeBossZone({ deltaWidth: 1 });
    expect(engine.getSnapshot().campus.zones.find((z) => z.kind === "cowork")!.originX).toBe(hub.originX);

    const reloaded = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 10_000 });
    await reloaded.init();
    const z = reloaded.getSnapshot().campus.zones.find((zone) => zone.kind === "boss")!;
    expect([z.originX, z.originY, z.width, z.height]).toEqual([2, 12, 8, 6]);
    const layout = reloaded.exportLayout();
    expect([layout.bossX, layout.bossY, layout.hubX, layout.hubY]).toEqual([2, 12, hub.originX, hub.originY]);
  });

  it("rejects Boss rects that overlap the hub, leave the floor, or are out of size range", async () => {
    const { engine } = await newEngine();
    await expect(engine.setBossZoneRect({ x: 4, y: 0, width: 6, height: 6 })).rejects.toThrow(/Central Work Hub/);
    await expect(engine.setBossZoneRect({ x: 20, y: 20, width: 6, height: 6 })).rejects.toThrow(/พื้นออฟฟิศ/);
    await expect(engine.setBossZoneRect({ x: 0, y: 10, width: 3, height: 6 })).rejects.toThrow(/กว้าง 4–12/);
    const boss = engine.getSnapshot().campus.zones.find((z) => z.kind === "boss")!;
    expect([boss.originX, boss.originY]).toEqual([0, 0]);
  });
});
