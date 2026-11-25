import { describe, expect, it } from "vitest";
import { findTilePath } from "../src/client/pathfinding.js";
import { OfficeSimulation } from "../src/client/sim.js";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultCommonWing,
} from "../src/server/layout-engine.js";
import type { CatalogEntry, OfficeState, ProjectBayRecord } from "../src/shared/types.js";

describe("A* pathfinding & OfficeSimulation", () => {
  it("routes around furniture obstacles and falls back to nearest reachable tile when goal is boxed in", () => {
    const blocked = new Uint8Array(6 * 6);
    for (const [bx, by] of [
      [3, 4],
      [5, 4],
      [4, 3],
      [4, 5],
      [4, 4],
    ]) {
      blocked[by * 6 + bx] = 1;
    }
    const path = findTilePath({ width: 6, height: 6, blocked }, [0, 0], [4, 4]);
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(blocked[last[1] * 6 + last[0]]).toBe(0);
    expect(Math.abs(last[0] - 4) + Math.abs(last[1] - 4)).toBeLessThanOrEqual(2);
  });

  it("switches between 30 FPS while moving and 8 FPS when seated, and drives all 5 animation clips", () => {
    const catalog = new Map<string, CatalogEntry>([
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
    ]);
    const bay: ProjectBayRecord = {
      id: "b0",
      projectPath: "/p/a",
      displayName: "alpha",
      accentColor: "#38bdf8",
      archived: false,
      deskSlots: 2,
      furniture: createDefaultBayFurniture("b0"),
      createdAt: 1,
      lastActiveAt: 1,
    };
    const wing = createDefaultCommonWing(0);
    const campus = computeCampusLayout([bay], [wing], catalog, undefined, "office", undefined, {
      "cowork:0": [{
        id: "half-seat", zoneId: "cowork:0", assetId: "chair-office-swivel",
        lx: 2.5, ly: 4, layer: "object", direction: "nw", placedBy: "user",
      }],
    });

    const sim = new OfficeSimulation();
    const state: OfficeState = {
      version: 1,
      theme: "night",
      bays: [bay],
      commonWings: [wing],
      activityLog: [],
      employees: [
        {
          id: "e1",
          bayId: "b0",
          provider: "claude",
          spriteId: "agent-claude",
          displayName: "Claude",
          role: "Lead",
          isEphemeral: false,
          deskIndex: 0,
          visualState: "working",
          toolCategory: "code",
          detail: "Editing",
          lastUpdatedAt: 1,
        },
      ],
    };
    sim.syncFromServer(state, campus);
    let out = sim.step(16);
    if (out.visuals[0].isMoving) expect(out.targetFps).toBe(30);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect(out.visuals[0].isMoving).toBe(false);
    expect(out.visuals[0].clipName).toMatch(/^sit_type_/);
    expect([out.visuals[0].x, out.visuals[0].y]).toEqual([8.5, 4]);
    expect(out.targetFps).toBe(8);

    // Move the seat half a tile under the desk facing southeast. Rounding its Y
    // would send an agent to the blocked desk tile, so it must approach from Y=2.
    const tuckedCampus = computeCampusLayout([bay], [wing], catalog, undefined, "office", undefined, {
      "cowork:0": [
        { id: "half-seat", zoneId: "cowork:0", assetId: "chair-office-swivel",
          lx: 2.5, ly: 2.5, layer: "object", direction: "se", placedBy: "user" },
        { id: "tuck-desk", zoneId: "cowork:0", assetId: "desk-dev-dual",
          lx: 2, ly: 3, layer: "object", direction: "nw", placedBy: "user" },
      ],
    });
    sim.syncFromServer(state, tuckedCampus);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect(out.visuals[0].isMoving).toBe(false);
    expect(out.visuals[0].clipName).toMatch(/^sit_type_/);
    expect([out.visuals[0].x, out.visuals[0].y]).toEqual([8.5, 2.5]);

    // Switch to meeting -> walks to conference area and plays talk clip
    state.employees[0].visualState = "meeting";
    sim.syncFromServer(state, tuckedCampus);
    out = sim.step(50);
    expect(out.visuals[0].isMoving).toBe(true);
    expect(out.targetFps).toBe(30);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect(out.visuals[0].clipName).toMatch(/^talk_/);
  });
});
