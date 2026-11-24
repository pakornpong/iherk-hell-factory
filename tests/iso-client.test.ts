import { describe, expect, it } from "vitest";
import { IsoCamera, tileToWorld, worldToTile } from "../src/client/camera.js";
import { isInWorldBounds, sortUnifiedIsoEntities } from "../src/client/iso-renderer.js";

describe("IsoCamera & unified topological depth-sorter", () => {
  it("round-trips tile <-> world <-> screen picking across integer zooms 1..4", () => {
    const cam = new IsoCamera();
    for (const z of [1, 2, 3, 4]) {
      cam.setZoom(z);
      cam.glideToTile(12, 7, 1280, 720);
      for (let i = 0; i < 60; i++) cam.update(16);
      const [tx, ty] = cam.screenToTile(640, 360, 1280, 720);
      expect(Math.round(tx)).toBe(12);
      expect(Math.round(ty)).toBe(7);
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
});
