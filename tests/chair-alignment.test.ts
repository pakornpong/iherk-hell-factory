import { describe, expect, it } from "vitest";
import { IsoCamera, tileToWorld } from "../src/client/camera.js";
import { IsoRenderer } from "../src/client/iso-renderer.js";
import { getCenteredChairTile } from "../src/client/chair-alignment.js";
import type { ComputedCampus, WorldFurnitureInstance } from "../src/shared/types.js";

function furniture(
  assetId: string, id: string, tx: number, ty: number,
  footprintTiles: [number, number] = [1, 1],
): WorldFurnitureInstance {
  return { assetId, id, tx, ty, lx: tx, ly: ty, footprintTiles, zoneId: "floor:0", direction: "nw", layer: "object", placedBy: "user" };
}

const desk = furniture("desk-dev-dual", "desk", 7, 3, [2, 1]);
const chair = furniture("chair-office-swivel", "chair", 7, 4);
type AlignmentCampus = Parameters<typeof getCenteredChairTile>[0];
const camp = (items: WorldFurnitureInstance[], wallSegments: ComputedCampus["wallSegments"] = []): AlignmentCampus =>
  ({ widthTiles: 24, depthTiles: 24, worldFurniture: items, wallSegments });

describe("centered swivel chairs", () => {
  it("centers a chair clicked in either tile along the actual Cowork desk row", () => {
    const layout = camp([desk, furniture("desk-dev-dual", "next-desk", 9, 3, [2, 1])]);
    expect(getCenteredChairTile(layout, 7, 4, "nw")).toEqual([7.5, 4]);
    expect(getCenteredChairTile(layout, 8, 4, "nw")).toEqual([7.5, 4]);
    expect(getCenteredChairTile(layout, 9, 4, "nw")).toEqual([9.5, 4]);
    expect(getCenteredChairTile(layout, 7, 4, "se")).toEqual([7, 4]);
    expect(getCenteredChairTile(camp([desk, chair]), 8, 4, "nw", chair.id)).toEqual([7.5, 4]);
  });

  it("also centers beside desks with a footprint rotated to the other axis", () => {
    const layout = camp([furniture("desk-dev-dual", "vertical", 7, 3, [1, 2])]);
    expect(getCenteredChairTile(layout, 6, 4, "ne")).toEqual([6, 3.5]);
    expect(getCenteredChairTile(layout, 8, 3, "sw")).toEqual([8, 3.5]);
  });

  it("keeps paired chairs separate and respects a divider along the shared boundary", () => {
    const paired = camp([desk, chair, furniture("chair-office-swivel", "other", 8, 4)]);
    expect(getCenteredChairTile(paired, 7, 4, "nw", chair.id)).toEqual([7, 4]);
    expect(getCenteredChairTile(paired, 8, 4, "nw", "other")).toEqual([8, 4]);
    const isolated = camp([desk], [{
      id: "edge", axis: "y", rx: 7.5, ry: 4, assetId: "divider-low-glass", direction: "sw",
      blocks: { x: 8, y: 4, side: "w" },
    }]);
    expect(getCenteredChairTile(isolated, 7, 4, "nw")).toEqual([7, 4]);
  });
});

it("draws the saved chair, seated agent and placement preview at the same spot through all four views", () => {
  const width = 800;
  const height = 600;
  const camera = new IsoCamera();
  camera.setFloorSize(24, 24, width, height);
  camera.snapToTile(7, 4, width, height);
  const renderer = new IsoRenderer();
  const sprite = {
    image: {},
    frame: { x: 0, y: 0, w: 20, h: 20 },
    anchor: { x: 0, y: 0 },
    footprintTiles: [1, 1],
  };
  let preview: [number, number] | undefined;
  const mock = {
    canvas: { width, height },
    globalAlpha: 1,
    drawImage(_image: unknown, _x: number, _y: number, _w: number, _h: number, x: number, y: number) {
      if (this.globalAlpha === 0.75) preview = [x, y];
    },
  };
  const ctx = new Proxy(mock, {
    get(target, key) { return Reflect.get(target, key) ?? (() => undefined); },
  }) as unknown as CanvasRenderingContext2D;
  const campus: ComputedCampus = {
    widthTiles: 24, depthTiles: 24, worldFurniture: [desk, chair], wallSegments: [],
    floors: [], walls: [], wallDecor: [], zones: [],
  };
  for (let turn = 0; turn < 4; turn++) {
    preview = undefined;
    renderer.render(ctx, {
      campus,
      camera,
      state: { version: 1, theme: "office", demoMode: false, bays: [], commonWings: [], employees: [] },
      atlas: { getFrame: (_theme: string, assetId: string) => assetId === desk.assetId ? null : sprite } as never,
      employees: [{
        x: 7, y: 4, direction: "nw", clipName: "sit_type_0",
        record: {
          id: "worker", bayId: "office", spriteId: "agent-gemini", displayName: "Worker", role: "Worker",
          isEphemeral: false, deskIndex: 0, visualState: "working", toolCategory: "idle", lastUpdatedAt: 0,
        },
      }],
      syncPackets: [],
      movingFurnitureId: chair.id,
      ghost: { assetId: chair.assetId, tx: 8, ty: 4, direction: "nw", valid: true },
      timeMs: 0,
    });
    const expected = camera.worldToScreen(...tileToWorld(...camera.view.toView(7.5, 4)));
    for (const id of [chair.id, "worker"]) {
      const hit = renderer.lastHitBoxes.find((box) => box.id === id);
      expect([hit?.x, hit?.y]).toEqual(expected);
    }
    expect(preview).toEqual(expected);
    camera.rotate(1, width, height);
  }
});
