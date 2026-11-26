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

function setup(employees: EmployeeRecord[], ownedBy?: string, customZones?: OfficeState["customZones"]) {
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
  const state: OfficeState = {
    version: 1, theme: "office", bays: [bay], commonWings: [wing], activityLog: [], employees, customZones,
  };
  const sim = new OfficeSimulation();
  const syncEmployees = (nextEmployees: EmployeeRecord[], nextCampus = campus) =>
    sim.syncFromServer({ ...state, employees: nextEmployees }, nextCampus);
  const sync = (nextEmployees: EmployeeRecord[], nextCampus = campus) => {
    syncEmployees(nextEmployees, nextCampus);
    let out = sim.step(50);
    for (let i = 0; i < 600; i++) out = sim.step(50);
    return (id: string) => {
      const v = out.visuals.find((visual) => visual.id === id)!;
      return { ...v, tile: [Math.round(v.x), Math.round(v.y)] };
    };
  };
  return { chairs, owned, campus, sim, sync, syncEmployees, at: sync(employees) };
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

  it("keeps coworkers at their desks when one agent leaves for a briefing and returns", () => {
    const a = employee("a", "working");
    const b = employee("b", "working");
    const c = employee("c", "working");
    const { at, sim, sync, syncEmployees } = setup([a, b, c]);
    const assigning = { ...a, visualState: "assigning" as const };

    syncEmployees([assigning, b, c]);
    const firstFrame = sim.step(16).visuals;
    expect(firstFrame.filter((visual) => visual.isMoving).map((visual) => visual.id)).toEqual(["a"]);
    const briefing = sync([assigning, b, c]);
    expect(briefing("a").tile).not.toEqual(at("a").tile);
    expect(briefing("b").tile).toEqual(at("b").tile);
    expect(briefing("c").tile).toEqual(at("c").tile);

    const d = employee("d", "working");
    expect(sync([assigning, b, c, d])("d").tile).toEqual(at("a").tile);
    const returned = sync([a, b, c, d]);
    for (const id of ["b", "c"]) expect(returned(id).tile).toEqual(at(id).tile);
    expect(returned("d").tile).toEqual(at("a").tile);
    expect(new Set([a, b, c, d].map(({ id }) => returned(id).tile.join(","))).size).toBe(4);
  });

  it("honors changed chair ownership and current layout when retaining desks", () => {
    const a = employee("a", "working");
    const b = employee("b", "working");
    const c = employee("c", "working");
    const { at, chairs, campus, sync } = setup([a, b, c]);
    const [aChair, bChair, cChair, spare] = chairs;
    const nextCampus = {
      ...campus,
      worldFurniture: campus.worldFurniture.map((chair) => {
        if (chair.id === aChair.id) return { ...chair, ownerEmployeeId: c.id };
        if (chair.id === bChair.id) return { ...chair, tx: spare.tx, ty: spare.ty, direction: "se" as const };
        if (chair.id === spare.id) return { ...chair, tx: bChair.tx, ty: bChair.ty };
        return chair;
      }),
    };

    const changed = sync([a, b, c], nextCampus);
    expect(changed("c").tile).toEqual(at("a").tile);
    expect(changed("b").tile).toEqual([Math.round(spare.tx), Math.round(spare.ty)]);
    expect(changed("b").direction).toBe("se");
    expect(changed("a").tile).not.toEqual(changed("b").tile);
    expect(changed("a").tile).not.toEqual(changed("c").tile);
    expect(changed("c").tile).not.toEqual([Math.round(cChair.tx), Math.round(cChair.ty)]);
  });

  it("retains and reuses separate shared chairs that have the same legacy ID", () => {
    const a = employee("a", "working");
    const b = employee("b", "working");
    const { chairs, campus, sync } = setup([]);
    const [first, second] = chairs;
    const legacyCampus = {
      ...campus,
      worldFurniture: campus.worldFurniture.map((chair) => chair.id === second.id ? { ...chair, id: first.id } : chair),
    };

    const initial = sync([a, b], legacyCampus);
    expect(initial("a").tile).toEqual([first.tx, first.ty]);
    expect(initial("b").tile).toEqual([second.tx, second.ty]);
    const next = sync([b, employee("c", "working")], legacyCampus);
    expect(next("b").tile).toEqual(initial("b").tile);
    expect(next("c").tile).toEqual(initial("a").tile);
  });

  it("does not make an agent walk when only its working animation changes at a fractional chair", () => {
    const a = employee("a", "teamwork");
    const { campus, owned, sim, sync, syncEmployees } = setup([a], a.id);
    const tilePermissions = [...campus.tilePermissions!];
    tilePermissions[owned.ty * campus.widthTiles + owned.tx] = 0;
    const nextCampus = {
      ...campus,
      tilePermissions,
      worldFurniture: campus.worldFurniture.map((chair) =>
        chair.id === owned.id ? { ...chair, tx: chair.tx - 0.5 } : chair,
      ),
    };
    const seated = sync([a], nextCampus)("a");
    expect(seated.x).toBe(owned.tx - 0.5);
    syncEmployees([{ ...a, visualState: "working" }], nextCampus);
    const [visual] = sim.step(16).visuals;
    expect(visual.isMoving).toBe(false);
    expect(visual.x).toBe(seated.x);
    expect(visual.y).toBe(seated.y);
    expect(visual.record.visualState).toBe("working");
  });

  it("retries a chair it could not reach when a later state change opens the route", () => {
    const a = employee("a", "assigning");
    const { campus, owned, sync } = setup([a], a.id);
    const tilePermissions = [...campus.tilePermissions!];
    tilePermissions[owned.ty * campus.widthTiles + owned.tx] = 0;
    const target = [owned.tx, owned.ty];
    const blocked = sync([{ ...a, visualState: "working" }], { ...campus, tilePermissions })("a");
    expect(blocked.tile).not.toEqual(target);
    expect(blocked.isMoving).toBe(false);

    expect(sync([{ ...a, visualState: "teamwork" }])("a").tile).toEqual(target);
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

  it("keeps existing visitors in place when an earlier employee arrives at the Boss desk", () => {
    const a = employee("a", "working");
    const b = employee("b", "reporting");
    const c = employee("c", "reporting");
    const { at, sync } = setup([a, b, c]);
    const briefing = sync([{ ...a, visualState: "assigning" }, b, c]);
    expect(briefing("b").tile).toEqual(at("b").tile);
    expect(briefing("c").tile).toEqual(at("c").tile);
    expect(new Set([a, b, c].map(({ id }) => briefing(id).tile.join(","))).size).toBe(3);
    const replacement = sync([{ ...a, visualState: "assigning" }, { ...b, visualState: "working" }, c, employee("d", "reporting")]);
    expect(replacement("d").tile).toEqual(at("b").tile);
    expect(replacement("a").tile).toEqual(briefing("a").tile);
    expect(replacement("c").tile).toEqual(at("c").tile);
  });

  it("fills an open visitor position after the Boss area was overcrowded", () => {
    const visitors = ["a", "b", "c", "d"].map((id) => employee(id, "reporting"));
    const { at, sync } = setup(visitors);
    expect(at("a").tile).toEqual(at("d").tile);

    sync([visitors[3]]);
    const next = sync([visitors[3], employee("e", "assigning")]);
    expect(next("d").tile).toEqual(at("d").tile);
    expect(next("e").tile).toEqual(at("b").tile);
  });
});

describe("Meeting placement", () => {
  it("keeps other attendees in place when one leaves for a briefing", () => {
    const a = employee("a", "meeting");
    const b = employee("b", "meeting");
    const c = employee("c", "meeting");
    const { at, sync } = setup([a, b, c]);
    const briefing = sync([{ ...a, visualState: "assigning" }, b, c]);
    expect(briefing("a").tile).not.toEqual(at("a").tile);
    expect(briefing("b").tile).toEqual(at("b").tile);
    expect(briefing("c").tile).toEqual(at("c").tile);
  });

  it("fills an open meeting chair after the meeting was overcrowded", () => {
    const [a, b, c] = ["a", "b", "c"].map((id) => employee(id, "meeting"));
    const { at, sync } = setup([a, b, c], undefined, [
      { id: "meeting", name: "Meeting", icon: "🤝", color: "#38bdf8", role: "meeting", x: 7, y: 1, width: 2, height: 1 },
    ]);
    expect(at("a").tile).toEqual(at("c").tile);

    sync([c]);
    const next = sync([c, employee("d", "meeting")]);
    expect(next("c").tile).toEqual(at("c").tile);
    expect(next("d").tile).toEqual(at("b").tile);
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
