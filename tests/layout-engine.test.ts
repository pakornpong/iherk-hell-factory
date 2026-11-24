import { describe, expect, it } from "vitest";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
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
  it("lays out 25 active bays with periodic common wings, zero zone overlap, and continuous perimeter walls", () => {
    const bays = Array.from({ length: 25 }, (_, i) => makeBay(i));
    const rows = Math.ceil(25 / 3);
    const wings = Array.from({ length: rows }, (_, r) => createDefaultCommonWing(r));
    const campus = computeCampusLayout(bays, wings, mockCatalog);

    expect(campus.zones.filter((z) => z.kind === "bay")).toHaveLength(25);
    expect(campus.zones.filter((z) => z.kind === "common")).toHaveLength(rows);
    expect(campus.walls.some((w) => w.edge === "corner" && w.tx === 0 && w.ty === 0)).toBe(true);

    // Every NW perimeter tile (ty=0) and NE perimeter tile (tx=0) has a wall
    for (let tx = 1; tx < campus.widthTiles; tx++) {
      expect(campus.walls.some((w) => w.edge === "nw" && w.tx === tx && w.ty === 0)).toBe(true);
    }
    for (let ty = 1; ty < campus.depthTiles; ty++) {
      expect(campus.walls.some((w) => w.edge === "ne" && w.tx === 0 && w.ty === ty)).toBe(true);
    }

    // Zero overlap between any two zones
    for (let i = 0; i < campus.zones.length; i++) {
      for (let j = i + 1; j < campus.zones.length; j++) {
        const a = campus.zones[i];
        const b = campus.zones[j];
        const overlap =
          a.originX < b.originX + b.width &&
          a.originX + a.width > b.originX &&
          a.originY < b.originY + b.height &&
          a.originY + a.height > b.originY;
        expect(overlap).toBe(false);
      }
    }
  });

  it("compacts active bays on archive without moving common wing furniture", () => {
    const bays = [makeBay(0), makeBay(1, true), makeBay(2)];
    const wings = [createDefaultCommonWing(0)];
    const campus = computeCampusLayout(bays, wings, mockCatalog);
    const activeBays = campus.zones.filter((z) => z.kind === "bay");
    expect(activeBays.map((z) => z.bayId)).toEqual(["bay-0", "bay-2"]);
    expect(activeBays[1].col).toBe(2);
    expect(campus.zones.find((z) => z.zoneId === "common:0")?.originX).toBe(0);
  });

  it("rejects furniture straddling zone borders, colliding with existing items, or blocking zone entrance", () => {
    const bays = [makeBay(0)];
    const wings = [createDefaultCommonWing(0)];
    const campus = computeCampusLayout(bays, wings, mockCatalog);

    // Corridor tile between zones resolves to null
    expect(resolveWorldToZone(campus, 6, 0)).toBeNull();
    // 2x1 desk overflowing zone boundary (lx=5, width=2) fails
    const straddle = validateFurniturePlacement(
      campus,
      bays[0].furniture,
      { zoneId: "bay:bay-0", lx: 5, ly: 3, assetId: "desk-dev-dual", direction: "se" },
      mockCatalog,
    );
    expect(straddle.ok).toBe(false);

    // Overlapping existing furniture fails
    const first = bays[0].furniture[0];
    const overlap = validateFurniturePlacement(
      campus,
      bays[0].furniture,
      { zoneId: "bay:bay-0", lx: first.lx, ly: first.ly, assetId: "plant-potted", direction: "se" },
      mockCatalog,
    );
    expect(overlap.ok).toBe(false);

    // Blocking BOTH entrance tiles (lx=2,ly=5 and lx=3,ly=5) fails
    const blockEntrance = validateFurniturePlacement(
      campus,
      bays[0].furniture,
      { zoneId: "bay:bay-0", lx: 2, ly: 5, assetId: "sofa-lounge", direction: "se" },
      mockCatalog,
    );
    expect(blockEntrance.ok).toBe(false);
  });
});
