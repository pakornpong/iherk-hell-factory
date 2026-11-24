import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeCampusLayout,
  createAmenityFurniture,
  createDefaultBayFurniture,
  createDefaultCommonWing,
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
    "%s room uses real assets and keeps corridor + doorways walkable",
    (theme, idx) => {
      const items = createAmenityFurniture(idx, theme);
      const campus = computeCampusLayout([makeBay(0)], [createDefaultCommonWing(0)], catalog);
      const zone = { ...campus.zones[0], zoneId: items[0].zoneId };
      const fakeCampus = { ...campus, zones: [zone] };
      const placed: FurnitureInstance[] = [];
      for (const item of items) {
        expect(catalog.has(item.assetId), `missing asset ${item.assetId}`).toBe(true);
        const res = validateFurniturePlacement(fakeCampus, placed, { ...item }, catalog);
        expect(res, `${theme}: ${item.assetId}`).toEqual({ ok: true });
        placed.push(item);
      }
      // Corridor lx 2..3 and side doorways (ly 2..3 at lx 0/5) stay empty
      for (const item of placed) {
        const [w, d] = catalog.get(item.assetId)!.footprintTiles;
        for (let dy = 0; dy < d; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const x = item.lx + dx;
            const y = item.ly + dy;
            expect(x === 2 || x === 3, `${item.assetId} blocks corridor`).toBe(false);
            expect(y === 2 || y === 3, `${item.assetId} blocks side door`).toBe(false);
            expect(x < ZONE_SIZE && y < ZONE_SIZE).toBe(true);
          }
        }
      }
    },
  );

  it("always shows at least 4 themed rooms, even when the bay ring is exactly full", () => {
    for (const count of [1, 2, 7, 13]) {
      const bays = Array.from({ length: count }, (_, i) => makeBay(i));
      const campus = computeCampusLayout(bays, [createDefaultCommonWing(0), createDefaultCommonWing(1)], catalog);
      const amenities = campus.zones.filter((z) => z.kind === "amenity");
      expect(amenities.length, `bays=${count}`).toBeGreaterThanOrEqual(4);
      expect(amenities.length).toBeLessThanOrEqual(AMENITY_THEME_ORDER.length);
      expect(new Set(amenities.map((z) => z.amenityTheme)).size).toBe(amenities.length);
      expect(campus.zones.filter((z) => z.kind === "bay")).toHaveLength(count);
      const cells = new Set(campus.zones.map((z) => `${z.col},${z.row}`));
      expect(cells.size).toBe(campus.zones.length);
      for (const z of amenities) {
        expect(z.amenityTheme).toBeDefined();
        expect((z.col + 1) * 7 - 1).toBeLessThanOrEqual(campus.widthTiles);
        expect((z.row + 1) * 7 - 1).toBeLessThanOrEqual(campus.depthTiles);
      }
    }
  });
});
