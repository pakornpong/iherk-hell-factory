import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeCampusLayout,
  createAmenityFurniture,
  createDefaultBayFurniture,
  createDefaultCommonWing,
  getRotatedFootprint,
  validateFurniturePlacement,
  ZONE_SIZE,
} from "../src/server/layout-engine.js";
import {
  AMENITY_THEME_ORDER,
  type CatalogEntry,
  type FurnitureInstance,
  type ProjectBayRecord,
} from "../src/shared/types.js";

const ROOT = path.resolve(__dirname, "..");
const ASSET_DIRS = [
  path.join(ROOT, "assets/pixcel/props"),
  path.join(ROOT, "../iherk-pixcel/assets/office-starter"),
];

function loadCatalog(): Map<string, CatalogEntry> {
  const catalog = new Map<string, CatalogEntry>();
  for (const dir of ASSET_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".pixcel.json")) continue;
      const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      catalog.set(doc.id, {
        id: doc.id,
        category: doc.category ?? "furniture",
        layer: doc.layer ?? "object",
        footprintTiles: doc.footprintTiles ?? [1, 1],
        source: "prop",
      });
    }
  }
  return catalog;
}

const catalog = loadCatalog();

function makeBay(i: number): ProjectBayRecord {
  const id = `bay-${i}-abcd`;
  return {
    id,
    projectPath: `/tmp/project-${i}`,
    displayName: `p${i}`,
    department: "general",
    accentColor: "#94a3b8",
    archived: false,
    deskSlots: 2,
    furniture: createDefaultBayFurniture(id, "general"),
    createdAt: 0,
    lastActiveAt: 0,
  };
}

describe("themed amenity rooms", () => {
  it.each(AMENITY_THEME_ORDER.map((t, i) => [t, i] as const))(
    "%s room uses real assets, keeps all doorways open and leaves no floor sealed off",
    (theme, idx) => {
      const items = createAmenityFurniture(idx, theme);
      const campus = computeCampusLayout([makeBay(0)], [createDefaultCommonWing(0)], catalog);
      const zone = { ...campus.zones[0], zoneId: items[0].zoneId };
      const fakeCampus = { ...campus, zones: [zone] };
      // Every item is valid where it stands given all the others (bounds, no overlap, nothing sealed off)
      for (const item of items) {
        expect(catalog.has(item.assetId), `missing asset ${item.assetId}`).toBe(true);
        const res = validateFurniturePlacement(fakeCampus, items, { ...item, ignoreInstanceId: item.id }, catalog);
        expect(res, `${theme}: ${item.assetId}`).toEqual({ ok: true });
      }
      // All eight 2-tile doorways (offset 2..3 on every side) stay empty
      const doorways = new Set(["2,0", "3,0", "0,2", "0,3", "5,2", "5,3", "2,5", "3,5"]);
      for (const item of items) {
        const [w, d] = getRotatedFootprint(catalog.get(item.assetId)!.footprintTiles, item.direction);
        for (let dy = 0; dy < d; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const x = item.lx + dx;
            const y = item.ly + dy;
            expect(doorways.has(`${x},${y}`), `${theme}: ${item.assetId} blocks doorway (${x},${y})`).toBe(false);
            expect(x < ZONE_SIZE && y < ZONE_SIZE).toBe(true);
          }
        }
      }
    },
  );

  it("uses open customizable floor with Boss and Central Hub, without spawning hypersleep pods", () => {
    for (const count of [1, 2, 7, 13]) {
      const bays = Array.from({ length: count }, (_, i) => makeBay(i));
      const campus = computeCampusLayout(bays, [], catalog, undefined, "office", undefined, undefined, {
        employeeCount: count,
      });
      expect(campus.zones.map((z) => z.kind)).toEqual(["boss", "cowork", "hypersleep", "floor"]);
      expect(campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(0);
      expect(campus.wallSegments).toHaveLength(0);
    }
  });
});
