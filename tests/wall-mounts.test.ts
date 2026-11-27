import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { IsoView } from "../src/client/camera.js";
import { DecorateController } from "../src/client/decorate.js";
import { pickWallMount, projectWallMountOrigin, rotateCampus } from "../src/client/view-scene.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, FurnitureInstance, WorldFurnitureInstance } from "../src/shared/types.js";
import { getWallMountSurfaces, wallMountPose, wallMountTangent } from "../src/shared/wall-mounts.js";

const smallAsset: CatalogEntry = {
  id: "mounted-small", category: "wall-decor", layer: "wall-decor", source: "library", footprintTiles: [1, 1],
  wallMountHeightVoxels: 8, wallMountBounds: { left: 12, right: 20, bottom: 0, top: 8 },
};

it("mounts furniture on solid wall and partition faces and follows the partition without blocking the floor", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-wall-mounts-"));
  const assets: CatalogEntry[] = [
    smallAsset,
    {
      id: "mounted-test-shelf", layer: "wall-decor", category: "wall-decor", source: "library", footprintTiles: [1, 1],
      wallMountBounds: { left: 12, right: 20, bottom: 0, top: 28 },
    },
    { id: "divider-solid-slate", layer: "object", category: "architecture", source: "prop", footprintTiles: [1, 1] },
    { id: "plant-potted", layer: "object", category: "decor", source: "starter", footprintTiles: [1, 1] },
  ];
  const options = { store: new OfficeStore(dir), catalogById: new Map(assets.map((asset) => [asset.id, asset])) };
  try {
    const engine = new OfficeEngine(options);
    await engine.init();
    const layout = engine.exportLayout();
    const defaults = [
      ...layout.bossFurniture, ...Object.values(layout.zoneOverrides).flat(),
      ...Object.values(layout.commonFurniture).flat(), ...Object.values(layout.bayFurniture).flat(),
    ];
    for (const item of defaults) {
      if (options.catalogById.has(item.assetId)) continue;
      options.catalogById.set(item.assetId, {
        id: item.assetId, category: "furniture", layer: item.layer, source: "starter", footprintTiles: [1, 1],
      });
    }
    engine.updateCatalog([...options.catalogById.values()]);
    const snapshot = () => engine.getSnapshot().campus;
    const request = { assetId: "mounted-test-shelf", direction: "se", placedBy: "user" } as const;
    const find = (id: string) => snapshot().worldFurniture.find((item) => item.id === id)!;

    await expect(engine.placeFurniture(request)).rejects.toThrow("เลือกผนัง");
    await expect(engine.placeFurniture({ ...request, wallMountId: "wall:ne:2" })).rejects.toThrow("เลือกผนัง");
    const beforeWall = snapshot().tilePermissions;
    const wall = await engine.placeFurniture({ ...request, wallMountId: "wall:ne:3" });
    expect(find(wall.id).wallMountPose).toEqual({ tx: 3, ty: 0.125, wall: "ne", direction: "se" });
    expect(find(wall.id).surfaceOffsetY).toBe(38);
    expect(snapshot().tilePermissions).toEqual(beforeWall);
    const { widthTiles, depthTiles } = snapshot();
    expect(rotateCampus(snapshot(), new IsoView(1, widthTiles, depthTiles)).worldFurniture
      .some((item) => item.id === wall.id)).toBe(false);
    await expect(engine.placeFurniture({ ...request, wallMountId: wall.wallMountId })).rejects.toThrow("มีของติด");

    const hang = (wallMountId: string, offset: number, lift: number) => engine.placeFurniture({
      ...request, assetId: smallAsset.id, wallMountId, wallMountPosition: { offset, lift },
    });
    const crossesSeam = await hang("wall:ne:3", 15, 12);
    const above = await hang("wall:ne:3", 15, 20);
    const beside = await hang("wall:ne:4", -9, 12);
    expect(find(crossesSeam.id).wallMountPose?.tx).toBe(3 + 15 / 32);
    expect(find(above.id).surfaceOffsetY).toBe(20);
    expect(find(beside.id).wallMountPose?.tx).toBe(4 - 9 / 32);
    await expect(hang("wall:ne:3", 13, 12)).rejects.toThrow("มีของติด");
    await expect(hang("wall:ne:4", -14, 12)).rejects.toThrow("มีของติด");
    await expect(hang("wall:ne:3", -13, 12)).rejects.toThrow("ล้ำขอบ");
    await expect(hang("wall:ne:3", 0, 89)).rejects.toThrow("ล้ำขอบ");
    await expect(hang("wall:ne:3", 0.5, 8)).rejects.toThrow("ล้ำขอบ");

    const panel = await engine.placeFurniture({ tx: 17, ty: 14, assetId: "divider-solid-slate", direction: "se", placedBy: "user" });
    const surfaces = () => getWallMountSurfaces(snapshot()).filter(({ hostId }) => hostId === panel.id);
    const [front, back] = surfaces();
    expect(front.direction).toBe("se");
    expect(back.direction).toBe("nw");
    const beforeMount = snapshot().tilePermissions;
    const shelf = await engine.placeFurniture({ ...request, wallMountId: front.id });
    const lowMount = await hang(front.id, 8, 0);
    await expect(hang(front.id, 8, 15)).rejects.toThrow("ล้ำขอบ");
    expect(snapshot().tilePermissions).toEqual(beforeMount);
    expect(find(shelf.id).wallMountPose?.tx).toBe(17);
    expect(find(lowMount.id).wallMountPose?.tx).toBe(17 + 8 / 32);

    await engine.moveFurniture(panel.id, { tx: 18, ty: 15, direction: "sw" });
    expect(find(shelf.id).wallMountPose?.direction).toBe("sw");
    expect(find(shelf.id).wallMountPose?.ty).toBe(15);
    expect(find(lowMount.id).wallMountPose?.ty).toBe(15 + 8 / 32);
    expect(find(lowMount.id).wallMountPosition).toEqual({ offset: 8, lift: 0 });
    await expect(engine.moveFurniture(lowMount.id, { wallMountPosition: { offset: 0, lift: 1 } })).rejects.toThrow("มีของติด");
    await engine.moveFurniture(lowMount.id, { wallMountPosition: { offset: 10, lift: 2 } });
    expect(find(lowMount.id).wallMountPose?.ty).toBe(15 + 10 / 32);
    expect(find(lowMount.id).surfaceOffsetY).toBe(2);
    await expect(engine.removeFurniture(panel.id)).rejects.toThrow("นำของที่ติด");
    await engine.moveFurniture(shelf.id, { wallMountId: back.id });

    const exported = JSON.parse(JSON.stringify(engine.exportLayout()));
    await engine.importLayout(exported);
    expect(find(shelf.id).wallMountId).toBe(back.id);
    expect(find(shelf.id).wallMountPosition).toBeUndefined();
    expect(find(crossesSeam.id).wallMountPosition).toEqual({ offset: 15, lift: 12 });
    const invalid = engine.exportLayout();
    invalid.zoneOverrides["floor:0"].find((item) => item.id === beside.id)!.wallMountPosition = { offset: -14, lift: 12 };
    await expect(engine.importLayout(invalid)).rejects.toThrow("Unavailable wall attachment");
    expect(find(beside.id).wallMountPosition).toEqual({ offset: -9, lift: 12 });
    const clone = new OfficeEngine(options);
    await clone.init();
    expect(clone.getSnapshot().campus.worldFurniture.find((item) => item.id === shelf.id)?.wallMountPose?.direction).toBe("ne");
    expect(clone.getSnapshot().campus.worldFurniture.find((item) => item.id === lowMount.id)?.wallMountPosition)
      .toEqual({ offset: 10, lift: 2 });

    const rotated = rotateCampus(snapshot(), new IsoView(1, widthTiles, depthTiles));
    expect(rotated.walls.find((item) => item.edge === "ne" && item.tx === depthTiles - 3)?.assetId).toBe("wall-night-window");
    const last = await hang(`wall:ne:${widthTiles - 1}`, -8, 10);
    await expect(engine.resizeFloor({ widthTiles: widthTiles - 2 })).rejects.toThrow("ลดความกว้างไม่ได้");
    expect(find(last.id).wallMountPose?.tx).toBe(widthTiles - 1 - 8 / 32);
    await engine.removeFurniture(lowMount.id);
    await engine.removeFurniture(shelf.id);
    await engine.removeFurniture(panel.id);
    expect(find(panel.id)).toBeUndefined();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

it("inverts the mounted sprite projection and follows the cursor under camera rotation", () => {
  const mount = getWallMountSurfaces({
    walls: [{ tx: 4, ty: 0, assetId: "wall-slate-plain", edge: "ne" }], wallSegments: [], worldFurniture: [],
  })[0];
  const surfaces = new Map([[mount.id, mount]]);
  for (const turns of [0, 3]) {
    const view = new IsoView(turns, 20, 20);
    const [x, y] = projectWallMountOrigin(mount, view);
    const [dx, dy] = wallMountTangent(view.toViewDirection(mount.direction));
    const [offset, lift] = [7, 36];
    const hit = pickWallMount(surfaces, view, x + (dx - dy) * offset, y + (dx + dy) * offset / 2 - (lift + 4), smallAsset);
    expect(hit).toMatchObject({ mount: { id: mount.id }, position: { offset, lift }, fits: true });
    const placed = wallMountPose(mount, smallAsset, hit?.position);
    expect(placed).toEqual({ pose: { tx: 4 + 7 / 32, ty: 0.125, direction: "se", wall: "ne" }, lift });
    expect(pickWallMount(surfaces, view, x, y - 150, smallAsset)).toBeUndefined();
  }
});

it("keeps legacy centered positions on two-tile standing screens oriented along Y", () => {
  const panel: WorldFurnitureInstance = {
    id: "screen", zoneId: "floor:0", assetId: "divider-open-oak-slat-screen", layer: "object",
    footprintTiles: [1, 2], direction: "sw", lx: 5, ly: 5, tx: 5, ty: 5, placedBy: "user",
  };
  for (const direction of ["sw", "ne"] as const) {
    const mount = getWallMountSurfaces({ walls: [], wallSegments: [], worldFurniture: [{ ...panel, direction }] })
      .find(({ id }) => id === "panel:screen:0:1")!;
    expect(wallMountPose(mount, smallAsset).pose).toMatchObject({
      tx: 5 + (direction === "sw" ? -17 : 17) / 32, ty: direction === "sw" ? 6 : 5, direction,
    });
    expect(wallMountPose(mount, smallAsset, { offset: 4, lift: 10 }).pose.ty)
      .toBe(direction === "sw" ? 5 + 4 / 32 : 6 - 4 / 32);
  }
});

it("preserves free mount positions and current instance IDs across move, erase, undo and redo", async () => {
  const items = new Map<string, FurnitureInstance>();
  let count = 0;
  const controller = new DecorateController({
    async placeFurniture({ assetId, direction, wallMountId, wallMountPosition }) {
      const item = {
        id: `mounted-${++count}`, zoneId: "floor:0" as const, lx: 0, ly: 0, assetId, direction,
        layer: "wall-decor" as const, placedBy: "user" as const, wallMountId, wallMountPosition,
      };
      items.set(item.id, item);
      return item;
    },
    async moveFurniture(id, { wallMountId, wallMountPosition }) {
      expect(items.has(id)).toBe(true);
      const item = { ...items.get(id)!, wallMountId, wallMountPosition };
      items.set(id, item);
      return item;
    },
    async removeFurniture(id) {
      expect(items.delete(id)).toBe(true);
    },
  });
  const placed = () => [...items.values()][0];
  const before = { wallMountId: "wall:ne:3", wallMountPosition: { offset: -8, lift: 20 } };
  const after = { wallMountId: "wall:ne:3", wallMountPosition: { offset: 7, lift: 31 } };
  controller.setActive(true);
  controller.selectAsset(smallAsset.id);
  await controller.handleTileClick(0, 0, undefined, before);
  controller.setTool("move");
  await controller.handleTileClick(0, 0, placed());
  await controller.handleTileClick(0, 0, undefined, after);
  expect(placed()).toMatchObject(after);
  await controller.undo();
  expect(placed()).toMatchObject(before);
  await controller.undo();
  expect(items.size).toBe(0);
  await controller.redo();
  expect(placed()).toMatchObject(before);
  await controller.redo();
  expect(placed()).toMatchObject(after);
  controller.setTool("erase");
  await controller.handleTileClick(0, 0, placed());
  await controller.undo();
  expect(placed()).toMatchObject(after);
  await controller.redo();
  expect(items.size).toBe(0);
});
