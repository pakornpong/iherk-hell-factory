import { describe, expect, it } from "vitest";
import { IsoCamera, tileToWorld, worldToTile } from "../src/client/camera.js";
import {
  computeFloorSlabGeometry,
  FLOOR_SLAB_PALETTES,
  isInWorldBounds,
  IsoRenderer,
  sortUnifiedIsoEntities,
} from "../src/client/iso-renderer.js";

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
});
