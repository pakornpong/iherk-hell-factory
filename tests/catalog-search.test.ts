import { describe, expect, it } from "vitest";
import { getCatalogCategoryLabel, getCatalogTags, matchesCatalogSearch } from "../src/client/catalog-search.js";
import type { CatalogEntry } from "../src/shared/types.js";

function item(id: string, category: string): CatalogEntry {
  return { id, category, layer: "object", footprintTiles: [1, 1], source: "library" };
}

describe("catalog search", () => {
  it("provides Thai category names and keeps unknown catalog categories discoverable", () => {
    expect(getCatalogCategoryLabel("worktables")).toBe("โต๊ะทำงาน");
    expect(getCatalogCategoryLabel("airfield-service")).toBe("Airfield Service");
    const asset = item("airport-stairway", "airfield-service");
    expect(getCatalogTags(asset)).toEqual(["Airfield Service"]);
    expect(getCatalogCategoryLabel("room-divider")).toBe("ฉากกั้นห้อง");
    expect(matchesCatalogSearch(asset, getCatalogTags(asset), "airfield service")).toBe(true);
  });

  it("combines translated tags, variant terms, category names, and full IDs", () => {
    const asset = item("worktable-drafting-rectangular-pedestal", "worktables");
    const tags = getCatalogTags(asset);
    expect(tags).toEqual(["โต๊ะ", "ทรงเหลี่ยม"]);
    expect(matchesCatalogSearch(asset, tags, asset.id)).toBe(true);
    expect(matchesCatalogSearch(asset, tags, "โต๊ะ drafting")).toBe(true);
    expect(matchesCatalogSearch(asset, tags, "#โต๊ะ ทรงเหลี่ยม")).toBe(true);
    expect(matchesCatalogSearch(asset, tags, "desk pedestal")).toBe(true);
    expect(matchesCatalogSearch(asset, tags, "โต๊ะ เก้าอี้")).toBe(false);
  });

  it("recognizes material and size labels without classifying partial words as tags", () => {
    expect(getCatalogTags(item("divider-solid-slate", "architecture"))).toEqual(["ฉากกั้น", "ทึบ"]);
    expect(getCatalogTags(item("compact-steel-office-chair-swivel", "seating")))
      .toEqual(["เก้าอี้", "โลหะ", "หมุนได้", "กะทัดรัด"]);
    expect(getCatalogTags(item("spotlight-case", "storage"))).not.toContain("ไฟ");
    const labAsset = item("centrifuge", "lab-instruments");
    expect(matchesCatalogSearch(labAsset, getCatalogTags(labAsset), "ห้องแล็บ centrifuge")).toBe(true);
  });
});
