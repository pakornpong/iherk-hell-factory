import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultCommonWing,
  createExtraBayWorkstations,
  getRotatedFootprint,
  validateFurniturePlacement,
} from "../src/server/layout-engine.js";
import { ROOM_LAYOUTS, bayLayoutChoice, getRoomLayout, toFurniture } from "../src/shared/room-layouts.js";
import type { CatalogEntry, DepartmentId, ZoneId } from "../src/shared/types.js";

const ROOT = path.resolve(__dirname, "..");
const catalog = new Map<string, CatalogEntry>();
for (const dir of [path.join(ROOT, "assets/pixcel/props"), path.join(ROOT, "../iherk-pixcel/assets/office-starter")]) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".pixcel.json")) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    catalog.set(doc.id, { id: doc.id, category: doc.category ?? "furniture", layer: doc.layer ?? "object", footprintTiles: doc.footprintTiles ?? [1, 1], source: "prop" });
  }
}

const DOORWAYS = new Set(["2,0", "3,0", "0,2", "0,3", "5,2", "5,3", "2,5", "3,5"]);
const campus = computeCampusLayout([], [createDefaultCommonWing(0)], catalog);

function assertRoomValid(label: string, zoneId: ZoneId, items: ReturnType<typeof toFurniture>) {
  const zone = { ...campus.zones[0], zoneId };
  const fakeCampus = { ...campus, zones: [zone] };
  for (const item of items) {
    expect(catalog.has(item.assetId), `${label}: unknown asset ${item.assetId}`).toBe(true);
    const res = validateFurniturePlacement(fakeCampus, items, { ...item, ignoreInstanceId: item.id }, catalog);
    expect(res, `${label}: ${item.id}`).toEqual({ ok: true });
    const [w, d] = getRotatedFootprint(catalog.get(item.assetId)!.footprintTiles, item.direction);
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) {
        expect(DOORWAYS.has(`${item.lx + dx},${item.ly + dy}`), `${label}: ${item.id} blocks a doorway`).toBe(false);
      }
    }
  }
}

describe("designed room layouts", () => {
  it.each(Object.keys(ROOM_LAYOUTS))("%s is valid as designed and mirrored", (key) => {
    for (const mirrored of [false, true]) {
      const zoneId = (key.startsWith("bay-") ? "bay:t" : key.startsWith("common") ? "common:0" : key === "boss" ? "boss:0" : key === "cowork" ? "cowork:0" : "amenity:0") as ZoneId;
      const items = toFurniture(zoneId, getRoomLayout(key, mirrored).items);
      assertRoomValid(`${key}${mirrored ? " (mirrored)" : ""}`, zoneId, items);
    }
  });

  it("adds the 3rd and 4th workstations into every bay layout without breaking the room", () => {
    const depts: DepartmentId[] = ["iherk", "dev", "erp", "accounting", "general"];
    for (const dept of depts) {
      for (let i = 0; i < 12; i++) {
        const bayId = `bay-${dept}-${i}`;
        const base = createDefaultBayFurniture(bayId, dept);
        expect(base.some((f) => f.id.endsWith("-desk-2"))).toBe(false);
        const extras = createExtraBayWorkstations(bayId, 4, base, dept);
        expect(extras.map((f) => f.id.split("-").slice(-2).join("-")).sort()).toEqual(["chair-2", "chair-3", "desk-2", "desk-3"]);
        assertRoomValid(bayId, `bay:${bayId}` as ZoneId, [...base, ...extras]);
      }
    }
  });

  it("varies rooms: projects get different layout variants and mirrors, stable per project", () => {
    const choices = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(bayLayoutChoice(`bay-${i}-x`))));
    expect(choices.size).toBeGreaterThanOrEqual(5); // 3 variants x 2 mirrors = 6 looks
    expect(bayLayoutChoice("bay-7-x")).toEqual(bayLayoutChoice("bay-7-x"));
    const a = createDefaultCommonWing(0).furniture.map((f) => `${f.assetId}@${f.lx},${f.ly}`);
    const b = createDefaultCommonWing(1).furniture.map((f) => `${f.assetId}@${f.lx},${f.ly}`);
    expect(a).not.toEqual(b);
  });
});
