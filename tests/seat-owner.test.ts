import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OfficeSimulation } from "../src/client/sim.js";
import { computeCampusLayout, createDefaultBayFurniture, createDefaultCommonWing } from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, EmployeeRecord, OfficeState, ProjectBayRecord } from "../src/shared/types.js";

const entry = (id: string, footprintTiles: [number, number], category = "furniture"): [string, CatalogEntry] =>
  [id, { id, category, layer: "object", footprintTiles, source: "starter", frames: ["default"] }];
const catalog = new Map<string, CatalogEntry>([
  entry("desk-dev-dual", [2, 1]),
  entry("chair-office-swivel", [1, 1]),
  entry("table-conference", [2, 2]),
  entry("plant-potted", [1, 1], "decor"),
  entry("server-rack", [1, 1], "tech"),
  entry("bookshelf-wood", [1, 1]),
  entry("whiteboard-arch", [2, 1], "decor"),
  entry("hypersleep-capsule", [1, 2]),
]);

const employee = (id: string, visualState: EmployeeRecord["visualState"], isEphemeral = false): EmployeeRecord => ({
  id, bayId: "b0", provider: "claude", spriteId: "agent-claude", displayName: id, role: "Lead",
  isEphemeral, deskIndex: 0, visualState, toolCategory: "code", lastUpdatedAt: 1,
});

function setup(employees: EmployeeRecord[], ownedBy?: string) {
  const bay: ProjectBayRecord = {
    id: "b0", projectPath: "/p/a", displayName: "alpha", accentColor: "#38bdf8", archived: false,
    deskSlots: 2, furniture: createDefaultBayFurniture("b0"), createdAt: 1, lastActiveAt: 1,
  };
  const wing = createDefaultCommonWing(0);
  const campus = computeCampusLayout([bay], [wing], catalog);
  const chairs = campus.worldFurniture
    .filter((f) => f.zoneId === "cowork:0" && f.assetId === "chair-office-swivel")
    .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  // Own the last shared chair so ownership, not ordering, decides the seat.
  const owned = chairs[chairs.length - 1];
  if (ownedBy) owned.ownerEmployeeId = ownedBy;
  const state: OfficeState = { version: 1, theme: "office", bays: [bay], commonWings: [wing], activityLog: [], employees };
  const sim = new OfficeSimulation();
  sim.syncFromServer(state, campus);
  let out = sim.step(50);
  for (let i = 0; i < 600; i++) out = sim.step(50);
  const at = (id: string) => {
    const v = out.visuals.find((visual) => visual.id === id)!;
    return { ...v, tile: [Math.round(v.x), Math.round(v.y)] };
  };
  return { chairs, owned, at };
}

describe("Seat owners and resting at the desk", () => {
  it("seats an owner at their own chair and keeps it free from everyone else", () => {
    const { chairs, owned, at } = setup([employee("e1", "working"), employee("e2", "working")], "e2");
    expect(at("e2").tile).toEqual([owned.tx, owned.ty]);
    expect(at("e1").tile).toEqual([chairs[0].tx, chairs[0].ty]);
  });

  it("lets a permanent agent doze at its own chair while resting", () => {
    const { owned, at } = setup([employee("e1", "resting")], "e1");
    const e1 = at("e1");
    expect(e1.tile).toEqual([owned.tx, owned.ty]);
    expect(e1.clipName).toBe("sit_type_0");
    expect(e1.dozing).toBe(true);
    expect(e1.bubbleIcon).toBe("💤");
  });

  it("does not give subagents owned chairs, and idle subagents release their desk", () => {
    const { chairs, owned, at } = setup(
      [employee("e1", "resting"), employee("sub-work", "working", true), employee("sub-idle", "resting", true)],
      "e1",
    );
    // Permanent agents claim desks first, then working subagents take the next shared chair.
    expect(at("sub-work").tile).toEqual([chairs[0].tx, chairs[0].ty]);
    expect(at("sub-work").tile).not.toEqual([owned.tx, owned.ty]);
    const idle = at("sub-idle");
    expect(chairs.some((chair) => chair.tx === idle.tile[0] && chair.ty === idle.tile[1])).toBe(false);
    expect(idle.dozing).toBe(false);
    expect(idle.bubbleIcon).toBeUndefined();
  });
});

describe("Boss corner is for briefing and reporting only", () => {
  it("never seats working, resting or meeting agents on chairs inside the Boss area", () => {
    const bay: ProjectBayRecord = {
      id: "b0", projectPath: "/p/a", displayName: "alpha", accentColor: "#38bdf8", archived: false,
      deskSlots: 2, furniture: createDefaultBayFurniture("b0"), createdAt: 1, lastActiveAt: 1,
    };
    const wing = createDefaultCommonWing(0);
    // A user-placed chair inside the Boss corner, owned by e0, next to a conference table there
    const bossAreaChair = {
      id: "furn-boss-area-chair", zoneId: "floor:0", lx: 5, ly: 5, assetId: "chair-office-swivel",
      direction: "nw" as const, layer: "object" as const, placedBy: "user" as const, ownerEmployeeId: "e0",
    };
    const bossAreaTable = {
      id: "furn-boss-area-table", zoneId: "floor:0", lx: 4, ly: 4, assetId: "table-conference",
      direction: "se" as const, layer: "object" as const, placedBy: "user" as const,
    };
    const campus = computeCampusLayout([bay], [wing], catalog, undefined, "office", undefined, { "floor:0": [bossAreaChair, bossAreaTable] });
    const employees = [
      employee("e0", "resting"),
      ...Array.from({ length: 11 }, (_, i) => employee(`w${i}`, "working")),
      employee("m0", "meeting"),
    ];
    const state: OfficeState = { version: 1, theme: "office", bays: [bay], commonWings: [wing], activityLog: [], employees };
    const sim = new OfficeSimulation();
    sim.syncFromServer(state, campus);
    let out = sim.step(50);
    for (let i = 0; i < 800; i++) out = sim.step(50);
    const bossChairs = campus.worldFurniture.filter((f) => f.assetId === "chair-office-swivel" && (f.zoneId === "boss:0" || (f.tx < 6 && f.ty < 6)));
    expect(bossChairs.length).toBeGreaterThanOrEqual(4);
    for (const visual of out.visuals) {
      const tile = [Math.round(visual.x), Math.round(visual.y)];
      expect(bossChairs.some((chair) => chair.tx === tile[0] && chair.ty === tile[1]), `${visual.id} sat in the Boss area`).toBe(false);
    }
  });

  it("still sends assigning and reporting agents to the Boss desk", () => {
    const { at } = setup([employee("r0", "reporting")]);
    const r0 = at("r0");
    expect(r0.tile[0]).toBeLessThan(6);
    expect(r0.tile[1]).toBeLessThan(6);
  });
});

describe("Seat owner validation (server)", () => {
  it("accepts one chair per permanent employee and rejects subagents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-seat-owner-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 10_000 });
    await engine.init();
    const base = { provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/seat" } as const;
    await engine.ingestEvent({ ...base, eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ ...base, agentId: "sub-a", eventType: "subagent_start" });

    const { state, campus } = engine.getSnapshot();
    const lead = state.employees.find((e) => !e.isEphemeral)!;
    const sub = state.employees.find((e) => e.isEphemeral)!;
    const [first, second] = campus.worldFurniture.filter((f) => f.zoneId === "cowork:0" && f.assetId === "chair-office-swivel");

    await engine.moveFurniture(first.id, { ownerEmployeeId: lead.id });
    const saved = engine.getSnapshot().campus.worldFurniture.find((f) => f.id === first.id)!;
    expect(saved.ownerEmployeeId).toBe(lead.id);

    await expect(engine.moveFurniture(second.id, { ownerEmployeeId: lead.id })).rejects.toThrow(/already owns/);
    await expect(engine.moveFurniture(second.id, { ownerEmployeeId: sub.id })).rejects.toThrow(/permanent/);

    // Boss corner chairs (visitor chairs and user-placed ones inside its bounds) cannot be owned
    await expect(engine.moveFurniture("boss:0-visitor-0", { ownerEmployeeId: lead.id })).rejects.toThrow(/seat owner/);
    const bossAreaChair = await engine.placeFurniture({ zoneId: "floor:0", lx: 5, ly: 5, assetId: "chair-office-swivel", direction: "nw", placedBy: "user" });
    await expect(engine.moveFurniture(bossAreaChair.id, { ownerEmployeeId: null })).resolves.toBeDefined();
    await engine.moveFurniture(first.id, { ownerEmployeeId: null });
    await expect(engine.moveFurniture(bossAreaChair.id, { ownerEmployeeId: lead.id })).rejects.toThrow(/Boss area/);

    expect(engine.getSnapshot().campus.worldFurniture.find((f) => f.id === first.id)!.ownerEmployeeId).toBeUndefined();
  });
});
