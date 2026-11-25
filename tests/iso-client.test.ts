import { describe, expect, it } from "vitest";
import { IsoCamera, IsoView, STEP_Y, tileToWorld, worldToTile } from "../src/client/camera.js";
import { isEmployeeActive, sortActiveAgents } from "../src/client/hud.js";
import {
  computeFloorSlabGeometry,
  FLOOR_SLAB_PALETTES,
  getZoneCenterWorld,
  isInWorldBounds,
  IsoRenderer,
  sortUnifiedIsoEntities,
} from "../src/client/iso-renderer.js";
import { getViewDividerSegments, rotateCampus } from "../src/client/view-scene.js";
import { computeCampusLayout } from "../src/server/layout-engine.js";
import { expandEdgeDividerSegments } from "../src/shared/layers.js";
import type { EmployeeRecord } from "../src/shared/types.js";

describe("IsoCamera & unified topological depth-sorter", () => {
  it("round-trips tile <-> world <-> screen picking across integer zooms 1..4", () => {
    const cam = new IsoCamera();
    for (const z of [1, 2, 3, 4]) {
      cam.setZoom(z);
      cam.glideToTile(12, 7, 1280, 720);
      for (let i = 0; i < 60; i++) cam.update(16);
      const [tx, ty] = cam.screenToTile(640, 360, 1280, 720);
      expect(Math.floor(tx)).toBe(12);
      expect(Math.floor(ty)).toBe(7);
    }
    const [wx, wy] = tileToWorld(5, 3);
    const [rtX, rtY] = worldToTile(wx, wy);
    expect(rtX).toBeCloseTo(5, 5);
    expect(rtY).toBeCloseTo(3, 5);
  });

  it("rotates a rectangular floor around the viewport center and keeps picking in office coordinates", () => {
    const camera = new IsoCamera();
    camera.setFloorSize(24, 18, 1200, 800);
    camera.setZoom(3);
    camera.snapToTile(4.25, 7.125, 1200, 800);
    const originalPan = [camera.panX, camera.panY];

    for (const expected of [1, 2, 3, 0]) {
      camera.rotate(1, 1200, 800);
      expect(camera.view.turns).toBe(expected);
      expect(camera.zoom).toBe(3);
      expect(camera.screenToTile(600, 400)).toEqual([4.75, 7.625]);

      for (const [tx, ty] of [[0, 0], [23, 17], [5, 11]]) {
        const [wx, wy] = tileToWorld(...camera.view.toView(tx, ty));
        const [sx, sy] = camera.worldToScreen(wx, wy - STEP_Y);
        expect(camera.screenToTile(sx, sy).map(Math.floor)).toEqual([tx, ty]);
      }
    }

    expect([camera.panX, camera.panY]).toEqual(originalPan);
    camera.rotate(-1, 1200, 800);
    expect(camera.view.turns).toBe(3);
    camera.glideToTile(23, 17, 1200, 800);
    for (let i = 0; i < 60; i++) camera.update(16);
    expect(camera.screenToTile(600, 400).map(Math.floor)).toEqual([23, 17]);
  });

  it("projects the floor, multi-tile furniture, overrides and corner cutaway into the rotated view", () => {
    const campus = computeCampusLayout([], [], new Map(), undefined, "office", { "4,3": 0 }, undefined, {
      floorWidthTiles: 24,
      floorDepthTiles: 18,
      floorTileOverrides: { "4,3": "floor-wood-plank" },
    });
    const view = new IsoView(1, campus.widthTiles, campus.depthTiles);
    const rotated = rotateCampus(campus, view);
    expect([rotated.widthTiles, rotated.depthTiles]).toEqual([18, 24]);
    expect(rotated.floors.find((f) => f.tx === 14 && f.ty === 4)).toMatchObject({
      assetId: "floor-wood-plank", direction: "sw",
    });
    expect(rotated.tilePermissions?.[4 * 18 + 14]).toBe(0);
    expect(rotated.worldFurniture.find((f) => f.assetId === "hypersleep-capsule")).toMatchObject({
      tx: 15, ty: 13, footprintTiles: [2, 1], direction: "sw",
    });
    expect(rotated.walls.every((wall) => wall.tx === 0 || wall.ty === 0)).toBe(true);
    expect(campus.floors.find((f) => f.tx === 4 && f.ty === 3)?.direction).toBe("se");
  });

  it("rotates each modular glass edge around its actual fractional tile position", () => {
    const asset = "divider-low-glass-tee";
    const original = expandEdgeDividerSegments(asset, 5, 4, "se");
    const view = new IsoView(1, 24, 18);
    const [tx, ty] = view.toView(5, 4);
    const projected = getViewDividerSegments(asset, tx, ty, view.toViewDirection("se"), view);
    expect(projected.map(({ rx, ry, axis }) => [rx, ry, axis])).toEqual(
      original.map(({ rx, ry, axis }) => [17 - ry, rx, axis === "x" ? "y" : "x"]),
    );
    expect(projected[0].blocks).toEqual({ x: 14, y: 4, side: "w" });
  });

  it("sorts fractional moving characters cleanly behind and in front of a 2x1 desk", () => {
    const desk = { id: "desk", x: 2, y: 2, footprintX: 2, footprintY: 1 };
    const behind = { id: "char-behind", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6 };
    const inFront = { id: "char-front", x: 2.2, y: 3.1, footprintX: 0.6, footprintY: 0.6 };
    const sorted = sortUnifiedIsoEntities([inFront, desk, behind]);
    expect(sorted.map((s) => s.id)).toEqual(["char-behind", "desk", "char-front"]);
  });

  it("draws a character seated on a chair tile after the chair it sits on", () => {
    const chair = { id: "f:boss-chair", x: 2, y: 1, footprintX: 1, footprintY: 1 };
    const boss = { id: "e:boss-avatar", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6 };
    const desk = { id: "f:boss-desk", x: 2, y: 2, footprintX: 2, footprintY: 1 };
    expect(sortUnifiedIsoEntities([boss, desk, chair]).map((s) => s.id)).toEqual([
      "f:boss-chair",
      "e:boss-avatar",
      "f:boss-desk",
    ]);
  });

  it("culls far-away bays outside camera viewport bounds", () => {
    const cam = new IsoCamera();
    cam.setZoom(2);
    cam.glideToTile(2, 2, 800, 600);
    for (let i = 0; i < 60; i++) cam.update(16);
    const bounds = cam.getVisibleWorldBounds(800, 600, 128);
    const [nearX, nearY] = tileToWorld(2, 2);
    const [farX, farY] = tileToWorld(80, 80);
    expect(isInWorldBounds(nearX, nearY, bounds)).toBe(true);
    expect(isInWorldBounds(farX, farY, bounds)).toBe(false);
  });

  it("computes exact diorama floor cutaway slab corners and renders across all themes", () => {
    const geo = computeFloorSlabGeometry(13, 13);
    expect(geo.leftX).toBe(-13 * 32 + 1);
    expect(geo.leftY).toBe(11 * 16);
    expect(geo.bottomX).toBe(0);
    expect(geo.bottomY).toBe(24 * 16);
    expect(geo.rightX).toBe(13 * 32 - 1);
    expect(geo.rightY).toBe(11 * 16);
    expect(geo.slabDepth).toBeGreaterThan(10);

    for (const theme of ["office", "day", "night"] as const) {
      const pal = FLOOR_SLAB_PALETTES[theme];
      expect(pal.rimTop).toMatch(/^#/);
      expect(pal.faceLeft).not.toBe(pal.faceRight);
      expect(pal.outline).toMatch(/^#/);

      const rects: Array<{ fillStyle: string; x: number; y: number; w: number; h: number }> = [];
      const mockCtx = {
        canvas: { width: 1280, height: 720 },
        imageSmoothingEnabled: true,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        font: "",
        textAlign: "left",
        fillRect(x: number, y: number, w: number, h: number) {
          rects.push({ fillStyle: String(this.fillStyle), x, y, w, h });
        },
        strokeRect() {},
        fillText() {},
        measureText: () => ({ width: 40 }),
        drawImage() {},
        save() {},
        restore() {},
        beginPath() {},
        ellipse() {},
        stroke() {},
      } as unknown as CanvasRenderingContext2D;

      const cam = new IsoCamera();
      cam.setZoom(2);
      cam.snapToTile(3, 3, 1280, 720);

      const renderer = new IsoRenderer();
      renderer.render(mockCtx, {
        state: { version: 1, theme, demoMode: false, bays: [], commonWings: [], employees: [] },
        campus: {
          widthTiles: 6,
          depthTiles: 6,
          zones: [],
          floors: [],
          walls: [{ tx: 0, ty: 0, assetId: "wall-slate-plain", edge: "nw" }],
          wallDecor: [],
          worldFurniture: [],
        },
        camera: cam,
        atlas: { getFrame: () => null } as never,
        employees: [],
        syncPackets: [],
        timeMs: 0,
      });

      const usedColors = new Set(rects.map((r) => r.fillStyle));
      expect(usedColors.has(pal.rimTop)).toBe(true);
      expect(usedColors.has(pal.faceLeft)).toBe(true);
      expect(usedColors.has(pal.faceRight)).toBe(true);
      expect(usedColors.has(pal.outline)).toBe(true);
    }
  });

  it("identifies active agents and sorts them by urgency (error -> reporting -> working -> resting)", () => {
    const mk = (id: string, visualState: EmployeeRecord["visualState"], toolCategory: EmployeeRecord["toolCategory"] = "idle", lastUpdatedAt = 100): EmployeeRecord => ({
      id,
      bayId: "bay-0",
      provider: "claude",
      spriteId: "agent-claude",
      displayName: id,
      role: "Lead",
      isEphemeral: false,
      deskIndex: 0,
      visualState,
      toolCategory,
      lastUpdatedAt,
    });
    const list = [
      mk("rest", "resting", "idle", 500),
      mk("work-old", "working", "code", 100),
      mk("work-new", "working", "code", 300),
      mk("report", "reporting", "idle", 200),
      mk("err", "working", "error", 50),
    ];
    expect(list.filter(isEmployeeActive).map((e) => e.id)).toEqual(["work-old", "work-new", "report", "err"]);
    expect(sortActiveAgents(list).map((e) => e.id)).toEqual(["err", "report", "work-new", "work-old", "rest"]);
  });

  it("computes the exact isometric diamond center for room nameplates", () => {
    // 6x6 block at (0,0): top vertex (0,-32), bottom vertex (0,160), left (-192,64), right (192,64) -> center (0,64)
    expect(getZoneCenterWorld({ originX: 0, originY: 0, width: 6, height: 6 })).toEqual([0, 64]);
    // Shifted 6x6 block at (6,14): center shifts by ((6-14)*32, (6+14)*16) = (-256, 320) -> (-256, 384)
    expect(getZoneCenterWorld({ originX: 6, originY: 14, width: 6, height: 6 })).toEqual([-256, 384]);
  });
});
