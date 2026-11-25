import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IsoCamera } from "../src/client/camera.js";
import { IsoRenderer, sortUnifiedIsoEntities } from "../src/client/iso-renderer.js";
import { buildWalkableGrid, findTilePath } from "../src/client/pathfinding.js";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
} from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import {
  buildTilePermissionMap,
  isSurfaceHostAsset,
  RENDER_LAYER,
  resolveAssetLayerConfig,
  TILE_PERM,
} from "../src/shared/layers.js";
import type { CatalogEntry, ProjectBayRecord } from "../src/shared/types.js";

const MOCK_CATALOG = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
  ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["gym-yoga-mat-corner", { id: "gym-yoga-mat-corner", category: "gym", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["prop-laptop", { id: "prop-laptop", category: "tech", layer: "tabletop", footprintTiles: [1, 1], source: "prop" }],
]);

describe("Pokémon GBA-style Layer & Movement Permission System", () => {
  it("resolves default renderLayer, tilePermission, surface host height, and split foreground config", () => {
    const floor = resolveAssetLayerConfig("floor-office-carpet", "floor");
    expect(floor.renderLayer).toBe(RENDER_LAYER.FLOOR);
    expect(floor.tilePermission).toBe(TILE_PERM.WALKABLE);

    const yogaMat = resolveAssetLayerConfig("gym-yoga-mat-corner", "object");
    expect(yogaMat.renderLayer).toBe(RENDER_LAYER.FLOOR);
    expect(yogaMat.tilePermission).toBe(TILE_PERM.WALKABLE);

    const chair = resolveAssetLayerConfig("chair-office-swivel", "object");
    expect(chair.renderLayer).toBe(RENDER_LAYER.LOW);
    expect(chair.tilePermission).toBe(TILE_PERM.SEAT);
    expect(chair.foregroundAssetId).toBe("chair-office-swivel-back");
    expect(chair.foregroundDirections).toEqual(["nw", "sw"]);

    const desk = resolveAssetLayerConfig("desk-dev-dual", "object");
    expect(desk.renderLayer).toBe(RENDER_LAYER.CHARACTER);
    expect(desk.tilePermission).toBe(TILE_PERM.BLOCKED);
    expect(desk.surfaceHeightVoxels).toBeGreaterThan(0);
    expect(isSurfaceHostAsset("desk-dev-dual")).toBe(true);
    expect(isSurfaceHostAsset("plant-potted")).toBe(false);

    const laptop = resolveAssetLayerConfig("prop-laptop", "tabletop");
    expect(laptop.renderLayer).toBe(RENDER_LAYER.TABLETOP);

    const chairBack = resolveAssetLayerConfig("chair-office-swivel-back", "foreground");
    expect(chairBack.renderLayer).toBe(RENDER_LAYER.FOREGROUND);
  });

  it("sorts overlapping elevation layers (L2 seat -> L4 char -> L6 backrest) while preserving isometric X/Y occlusion across walls", () => {
    // 1. Seated character on swivel chair with rear backrest (L6) behind a desk (L4)
    const chair = { id: "chair", x: 2, y: 1, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.LOW };
    const char = { id: "char", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };
    const backrest = { id: "backrest", x: 2, y: 1, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.FOREGROUND };
    const desk = { id: "desk", x: 2, y: 2, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };

    expect(sortUnifiedIsoEntities([desk, backrest, char, chair]).map((s) => s.id)).toEqual([
      "chair",
      "char",
      "backrest",
      "desk",
    ]);

    // 2. Tabletop prop (L5) sits cleanly on top of its host desk (L4), even with an identical footprint,
    // while sorting behind characters in front and in front of characters behind.
    const charBehind = { id: "char-behind", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };
    const hostDesk = { id: "host-desk", x: 2, y: 2, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };
    const laptopSameFp = { id: "laptop-same", x: 2, y: 2, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.TABLETOP };
    const laptopLeft = { id: "laptop-left", x: 2, y: 2, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.TABLETOP };
    const charFront = { id: "char-front", x: 2.2, y: 3.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };

    const sortedDesk = sortUnifiedIsoEntities([charFront, laptopSameFp, laptopLeft, hostDesk, charBehind]).map((s) => s.id);
    expect(sortedDesk[0]).toBe("char-behind");
    expect(sortedDesk[1]).toBe("host-desk");
    expect(sortedDesk.slice(2, 4).sort()).toEqual(["laptop-left", "laptop-same"]);
    expect(sortedDesk[4]).toBe("char-front");

    // 3. Back-room tabletop (L5) and backrest (L6) NEVER poke through a glass wall (L4) into the front room
    const roomALaptop = { id: "roomA-laptop", x: 2, y: 5, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.TABLETOP };
    const roomABackrest = { id: "roomA-backrest", x: 2, y: 5, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.FOREGROUND };
    const glassWall = { id: "glass-wall", x: 2, y: 6, footprintX: 1, footprintY: 0, renderLayer: RENDER_LAYER.CHARACTER };
    const roomBChar = { id: "roomB-char", x: 2.2, y: 6.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };

    const sortedRooms = sortUnifiedIsoEntities([roomBChar, glassWall, roomABackrest, roomALaptop]).map((s) => s.id);
    expect(sortedRooms.indexOf("roomA-laptop")).toBeLessThan(sortedRooms.indexOf("glass-wall"));
    expect(sortedRooms.indexOf("roomA-backrest")).toBeLessThan(sortedRooms.indexOf("glass-wall"));
    expect(sortedRooms.indexOf("glass-wall")).toBeLessThan(sortedRooms.indexOf("roomB-char"));

    // 3b. Zero-thickness boundary walls & corner posts ALWAYS sort strictly behind front-corner furniture
    //     and strictly in front of back-room furniture (regression for corner desks/treadmills/green-screens).
    const backDesk = { id: "back-desk", x: 5, y: 5, footprintX: 1, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };
    const cornerPost = { id: "post-6-6", x: 6, y: 6, footprintX: 0, footprintY: 0, renderLayer: RENDER_LAYER.CHARACTER };
    const wallH0 = { id: "wall-h-6-6", x: 6, y: 6, footprintX: 1, footprintY: 0, renderLayer: RENDER_LAYER.CHARACTER };
    const wallH1 = { id: "wall-h-7-6", x: 7, y: 6, footprintX: 1, footprintY: 0, renderLayer: RENDER_LAYER.CHARACTER };
    const wallV0 = { id: "wall-v-6-6", x: 6, y: 6, footprintX: 0, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };
    const frontDesk2x1 = { id: "front-desk", x: 6, y: 6, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.CHARACTER };

    const sortedCorner = sortUnifiedIsoEntities([frontDesk2x1, wallV0, wallH1, wallH0, cornerPost, backDesk]).map((s) => s.id);
    expect(sortedCorner.indexOf("back-desk")).toBeLessThan(sortedCorner.indexOf("post-6-6"));
    expect(sortedCorner.indexOf("post-6-6")).toBeLessThan(sortedCorner.indexOf("front-desk"));
    expect(sortedCorner.indexOf("wall-h-6-6")).toBeLessThan(sortedCorner.indexOf("front-desk"));
    expect(sortedCorner.indexOf("wall-h-7-6")).toBeLessThan(sortedCorner.indexOf("front-desk"));
    expect(sortedCorner.indexOf("wall-v-6-6")).toBeLessThan(sortedCorner.indexOf("front-desk"));

    // 4. Flat floor mat (L1) ALWAYS draws beneath a standing character (L4), and global overlay (L7) ALWAYS draws last
    const flatMat = { id: "flat-mat", x: 2, y: 3, footprintX: 2, footprintY: 1, renderLayer: RENDER_LAYER.FLOOR };
    const standingBehindMat = { id: "char-back", x: 2.2, y: 2.2, footprintX: 0.6, footprintY: 0.6, renderLayer: RENDER_LAYER.CHARACTER };
    const globalHud = { id: "overlay", x: 0, y: 0, footprintX: 10, footprintY: 10, renderLayer: RENDER_LAYER.OVERLAY };

    const sortedFloor = sortUnifiedIsoEntities([globalHud, standingBehindMat, flatMat]).map((s) => s.id);
    expect(sortedFloor).toEqual(["flat-mat", "char-back", "overlay"]);
  });

  it("builds tile permissions (0=blocked, 1=walkable, 2=seat, 3=door) and obeys manual overrides in A* pathfinding", () => {
    const bay: ProjectBayRecord = {
      id: "bay-alpha",
      projectPath: "/demo/iherk-alpha",
      displayName: "alpha",
      department: "iherk",
      accentColor: "#38bdf8",
      archived: false,
      deskSlots: 2,
      furniture: createDefaultBayFurniture("bay-alpha", "iherk"),
      createdAt: 1,
      lastActiveAt: 1,
    };
    const wing = createDefaultCommonWing(0);
    const campus = computeCampusLayout([bay], [wing], MOCK_CATALOG, createDefaultBossOffice(), "office");

    expect(campus.tilePermissions?.length).toBe(campus.widthTiles * campus.depthTiles);
    const permMap = buildTilePermissionMap(campus, undefined, MOCK_CATALOG);
    const w = permMap.width;

    // Boss desk is BLOCKED (0), boss chair & hypersleep capsule are SEAT (2)
    const bossDesk = campus.worldFurniture.find((f) => f.id === "boss:0-boss-desk")!;
    const bossChair = campus.worldFurniture.find((f) => f.id === "boss:0-boss-chair")!;
    const pod0 = campus.worldFurniture.find((f) => f.assetId === "hypersleep-capsule")!;
    expect(permMap.permissions[bossDesk.ty * w + bossDesk.tx]).toBe(TILE_PERM.BLOCKED);
    expect(permMap.permissions[bossChair.ty * w + bossChair.tx]).toBe(TILE_PERM.SEAT);
    expect(permMap.permissions[pod0.ty * w + pod0.tx]).toBe(TILE_PERM.SEAT);
    expect(bossChair.renderLayer).toBe(RENDER_LAYER.LOW);
    expect(bossDesk.renderLayer).toBe(RENDER_LAYER.CHARACTER);

    // Path across open floor works normally
    const openGrid = buildWalkableGrid(campus);
    const openPath = findTilePath(openGrid, [2, 4], [2, 7]);
    expect(openPath[openPath.length - 1]).toEqual([2, 7]);

    // Manual override blocking (2, 5) with 0 forces pathfinding around that tile
    const overriddenGrid = buildWalkableGrid(campus, { "2,5": TILE_PERM.BLOCKED });
    expect(overriddenGrid.permissions?.[5 * w + 2]).toBe(TILE_PERM.BLOCKED);
    expect(overriddenGrid.blocked[5 * w + 2]).toBe(1);
    const rerouted = findTilePath(overriddenGrid, [2, 4], [2, 7]);
    expect(rerouted.some(([x, y]) => x === 2 && y === 5)).toBe(false);
  });

  it("persists tilePermissionOverrides and renderLayer updates in OfficeEngine", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-layer-sys-"));
    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({ store, catalogById: MOCK_CATALOG });
    await engine.init();

    // Paint override on Boss Office tile (3, 4) -> BLOCKED (0)
    await engine.setTilePermissionOverride(3, 4, TILE_PERM.BLOCKED);
    const snap1 = engine.getSnapshot();
    expect(snap1.state.tilePermissionOverrides?.["3,4"]).toBe(TILE_PERM.BLOCKED);
    expect(snap1.campus.tilePermissions?.[4 * snap1.campus.widthTiles + 3]).toBe(TILE_PERM.BLOCKED);

    // Verify out-of-bounds throws
    await expect(engine.setTilePermissionOverride(999, 999, TILE_PERM.BLOCKED)).rejects.toThrow(/outside campus bounds/i);

    // Update furniture renderLayer override
    const bossVisitor = snap1.state.bossOffice!.furniture.find((f) => f.id === "boss:0-visitor-0")!;
    const updated = await engine.moveFurniture(bossVisitor.id, { renderLayer: RENDER_LAYER.FOREGROUND });
    expect(updated.renderLayer).toBe(RENDER_LAYER.FOREGROUND);
    const snap2 = engine.getSnapshot();
    const worldVisitor = snap2.campus.worldFurniture.find((f) => f.id === bossVisitor.id)!;
    expect(worldVisitor.renderLayer).toBe(RENDER_LAYER.FOREGROUND);

    // Reload from disk and verify persistence
    const engine2 = new OfficeEngine({ store, catalogById: MOCK_CATALOG });
    await engine2.init();
    expect(engine2.getSnapshot().state.tilePermissionOverrides?.["3,4"]).toBe(TILE_PERM.BLOCKED);

    // Clear overrides
    await engine2.clearTilePermissionOverrides();
    expect(engine2.getSnapshot().state.tilePermissionOverrides).toBeUndefined();
  });

  it("renders Pokémon GBA permission overlay and elevation layer badges cleanly", () => {
    const campus = computeCampusLayout([], [createDefaultCommonWing(0)], MOCK_CATALOG, createDefaultBossOffice(), "office");
    const cam = new IsoCamera();
    cam.setZoom(2);
    cam.snapToTile(3, 3, 800, 600);

    const texts: string[] = [];
    const mockCtx = {
      canvas: { width: 800, height: 600 },
      imageSmoothingEnabled: true,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect() {},
      strokeRect() {},
      fillText(t: string) {
        texts.push(t);
      },
      measureText: (t: string) => ({ width: t.length * 6 }),
      drawImage() {},
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      ellipse() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D;

    const renderer = new IsoRenderer();
    renderer.render(mockCtx, {
      state: { version: 1, theme: "office", bays: [], commonWings: [], employees: [], activityLog: [] },
      campus,
      camera: cam,
      atlas: { getFrame: () => null } as never,
      catalogById: MOCK_CATALOG,
      employees: [],
      syncPackets: [],
      layerOverlayMode: "permissions",
      hoverTile: [2, 2],
      timeMs: 0,
    });

    expect(texts).toContain("0");
    expect(texts).toContain("1");
    expect(texts).toContain("2");
  });
});
