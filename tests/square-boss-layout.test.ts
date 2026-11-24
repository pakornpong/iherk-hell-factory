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
  it("places Boss Office at (0,0), Lounge at (0,1), packs a department into one lot, and keeps overall floor square", () => {
    const bays = Array.from({ length: 7 }, (_, i) => makeBay(i));
    const campus = computeCampusLayout(bays, [createDefaultCommonWing(0)], catalog, createDefaultBossOffice());

    // Exact square campus
    expect(campus.widthTiles).toBe(campus.depthTiles);

    // Top-most corner (0,0) is Boss Office
    const boss = campus.zones.find((z) => z.kind === "boss");
    expect(boss).toBeDefined();
    expect(boss?.col).toBe(0);
    expect(boss?.row).toBe(0);
    expect(boss?.originX).toBe(0);
    expect(boss?.originY).toBe(0);

    // Common Lounge is at (0,1)
    const lounge = campus.zones.find((z) => z.zoneId === "common:0");
    expect(lounge?.col).toBe(0);
    expect(lounge?.row).toBe(1);

    // Co-working area for subagents is fixed at (1,0), right next to the Boss Office
    const cowork = campus.zones.find((z) => z.kind === "cowork");
    expect([cowork?.col, cowork?.row]).toEqual([1, 0]);

    // All 7 bays share one department -> one rectangular open-plan lot sized to fit them (at most 2 spare cells)
    const activeBays = campus.zones.filter((z) => z.kind === "bay");
    expect(new Set(activeBays.map((z) => z.lotId)).size).toBe(1);
    const cols = activeBays.map((z) => z.col);
    const rows = activeBays.map((z) => z.row);
    const lotArea = (Math.max(...cols) - Math.min(...cols) + 1) * (Math.max(...rows) - Math.min(...rows) + 1);
    expect(lotArea - activeBays.length).toBeLessThanOrEqual(2);
    expect(new Set(activeBays.map((z) => `${z.col},${z.row}`)).size).toBe(7);
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
