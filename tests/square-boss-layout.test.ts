import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OfficeSimulation } from "../src/client/sim.js";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
} from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, ProjectBayRecord } from "../src/shared/types.js";

const catalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["desk-security-ops", { id: "desk-security-ops", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
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

function makeBay(i: number): ProjectBayRecord {
  return {
    id: `bay-${i}`,
    projectPath: `/p/${i}`,
    displayName: `proj-${i}`,
    accentColor: "#38bdf8",
    archived: false,
    deskSlots: 2,
    furniture: createDefaultBayFurniture(`bay-${i}`),
    createdAt: i,
    lastActiveAt: i,
  };
}

describe("Square Clockwise Expansion & Boss Office (0,0)", () => {
  it("places Boss Corner at (0,0), Central Work Hub at (1,0), an empty Hypersleep Bay, and blank open floor", () => {
    const bays = Array.from({ length: 7 }, (_, i) => makeBay(i));
    const campus = computeCampusLayout(bays, [], catalog, createDefaultBossOffice(), "office", undefined, undefined, {
      employeeCount: 7,
    });

    expect(campus.widthTiles).toBeGreaterThanOrEqual(24);
    expect(campus.depthTiles).toBeGreaterThanOrEqual(24);

    const boss = campus.zones.find((z) => z.kind === "boss");
    expect(boss).toBeDefined();
    expect([boss?.originX, boss?.originY]).toEqual([0, 0]);

    const cowork = campus.zones.find((z) => z.kind === "cowork");
    expect([cowork?.col, cowork?.row]).toEqual([1, 0]);

    const pods = campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(pods).toHaveLength(0);
  });

  it("dynamically routes reporting agents directly in front of Boss after Boss chair is moved and rotated", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-boss-move-"));
    let clock = 10_000;
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => clock });
    await engine.init();

    await engine.moveFurniture("boss:0-boss-chair", { tx: 14, ty: 14, direction: "ne" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/a", eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/a", eventType: "turn_stop", detail: "Finished" });

    const snap = engine.getSnapshot();
    const sim = new OfficeSimulation();
    sim.syncFromServer(snap.state, snap.campus);
    let out = sim.step(50);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    const rep = out.visuals[0];
    expect([Math.round(rep.x), Math.round(rep.y)]).toEqual([15, 14]);
    expect(rep.direction).toBe("sw");
  });

  it("routes employees to Boss Office (0,0) when reporting finished work or asking questions", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-boss-"));
    let clock = 10_000;
    const engine = new OfficeEngine({
      store: new OfficeStore(dir),
      catalogById: catalog,
      now: () => clock,
      restCooldownMs: 15_000,
    });
    await engine.init();

    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "tool_start",
      toolName: "Edit",
    });

    // Asking a question -> reporting state routed to Boss Office (0,0)
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "waiting_user",
      detail: "Approve schema?",
    });
    let snap = engine.getSnapshot();
    expect(snap.state.employees[0].visualState).toBe("reporting");

    const sim = new OfficeSimulation();
    sim.syncFromServer(snap.state, snap.campus);
    let out = sim.step(50);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    // Must be standing inside Boss Office (0..5, 0..5)
    expect(out.visuals[0].x).toBeLessThan(6);
    expect(out.visuals[0].y).toBeLessThan(6);
    expect(out.visuals[0].bubbleIcon).toBe("❓");

    // Finishing a turn -> reports to Boss first, then goes to rest after cooldown
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "turn_stop",
      detail: "Build complete",
    });
    snap = engine.getSnapshot();
    expect(snap.state.employees[0].visualState).toBe("reporting");

    clock += 16_000;
    await engine.tick();
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("resting");
  });
});
