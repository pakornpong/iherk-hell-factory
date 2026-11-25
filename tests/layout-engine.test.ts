import { describe, expect, it } from "vitest";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
  resolveWorldToZone,
  validateFurniturePlacement,
} from "../src/server/layout-engine.js";
import type { CatalogEntry, ProjectBayRecord } from "../src/shared/types.js";

const mockCatalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
  ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["server-rack", { id: "server-rack", category: "tech", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bay-sign-post", { id: "bay-sign-post", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["water-cooler", { id: "water-cooler", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["divider-low-glass", { id: "divider-low-glass", category: "architecture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
]);

function makeBay(i: number, archived = false): ProjectBayRecord {
  return {
    id: `bay-${i}`,
    projectPath: `/p/${i}`,
    displayName: `proj-${i}`,
    accentColor: "#38bdf8",
    archived,
    deskSlots: 2,
    furniture: createDefaultBayFurniture(`bay-${i}`),
    createdAt: i,
    lastActiveAt: i,
  };
}

describe("layout-engine", () => {
  it("lays out open blank floor with Boss, Central Hub, 1 hypersleep capsule per agent, and continuous perimeter walls", () => {
    const bays = Array.from({ length: 25 }, (_, i) => makeBay(i));
    const campus = computeCampusLayout(bays, [], mockCatalog, undefined, "office", undefined, undefined, {
      employeeCount: 25,
    });

    expect(campus.zones.filter((z) => z.kind === "boss")).toHaveLength(1);
    expect(campus.zones.filter((z) => z.kind === "cowork")).toHaveLength(1);
    expect(campus.zones.filter((z) => z.kind === "hypersleep")).toHaveLength(1);
    expect(campus.zones.filter((z) => z.kind === "floor")).toHaveLength(1);
    expect(campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(25);
    expect(campus.walls.some((w) => w.edge === "corner" && w.tx === 0 && w.ty === 0)).toBe(true);

    for (let tx = 0; tx < campus.widthTiles; tx++) {
      expect(campus.walls.some((w) => w.edge === "ne" && w.tx === tx && w.ty === 0)).toBe(true);
    }
    for (let ty = 0; ty < campus.depthTiles; ty++) {
      expect(campus.walls.some((w) => w.edge === "nw" && w.tx === 0 && w.ty === ty)).toBe(true);
    }
  });

  it("grows hypersleep capsules 1-for-1 with employee count and supports expanding open floor size", () => {
    const bays = [makeBay(0), makeBay(1), makeBay(2)];
    const c1 = computeCampusLayout(bays, [], mockCatalog, undefined, "office", undefined, undefined, {
      employeeCount: 3,
      floorWidthTiles: 24,
      floorDepthTiles: 24,
    });
    expect(c1.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(3);
    expect([c1.widthTiles, c1.depthTiles]).toEqual([24, 24]);

    const c2 = computeCampusLayout(bays, [], mockCatalog, undefined, "office", undefined, undefined, {
      employeeCount: 4,
      floorWidthTiles: 30,
      floorDepthTiles: 30,
    });
    expect(c2.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(4);
    expect([c2.widthTiles, c2.depthTiles]).toEqual([30, 30]);
  });

  it("rejects furniture straddling outer floor bounds or colliding with existing items", () => {
    const bays = [makeBay(0)];
    const campus = computeCampusLayout(bays, [], mockCatalog);
    expect(resolveWorldToZone(campus, campus.widthTiles + 2, 0)).toBeNull();
    const straddle = validateFurniturePlacement(
      campus,
      [],
      { zoneId: "floor:0", lx: campus.widthTiles - 1, ly: 10, assetId: "desk-dev-dual", direction: "se" },
      mockCatalog,
    );
    expect(straddle.ok).toBe(false);

    const bossFurn = createDefaultBossOffice().furniture;
    const overlap = validateFurniturePlacement(
      campus,
      bossFurn,
      { zoneId: "boss:0", lx: 2, ly: 2, assetId: "plant-potted", direction: "se" },
      mockCatalog,
    );
    expect(overlap.ok).toBe(false);
  });
});
