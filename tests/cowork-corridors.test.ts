import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWalkableGrid, findTilePath } from "../src/client/pathfinding.js";
import { OfficeSimulation } from "../src/client/sim.js";
import {
  IN_ZONE_GAP,
  MODULE_PITCH_X,
  ZONE_GAP,
  ZONE_SIZE,
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
} from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, ProjectBayRecord } from "../src/shared/types.js";

const obj = (id: string, fp: [number, number]): [string, CatalogEntry] => [
  id,
  { id, category: "furniture", layer: "object", footprintTiles: fp, source: "starter" },
];
const catalog = new Map<string, CatalogEntry>([
  obj("desk-dev-dual", [2, 1]),
  obj("pc-desk-triple", [2, 1]),
  obj("desk-drafting", [2, 1]),
  obj("desk-security-ops", [2, 1]),
  obj("chair-office-swivel", [1, 1]),
  obj("table-conference", [2, 2]),
  obj("coffee-machine-bar", [2, 1]),
  obj("sofa-lounge", [2, 1]),
  obj("plant-potted", [1, 1]),
  obj("server-rack", [1, 1]),
  obj("bookshelf-wood", [1, 1]),
  obj("hypersleep-capsule", [1, 2]),
  obj("bay-sign-post", [1, 1]),
  obj("water-cooler", [1, 1]),
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

describe("Corridors between rooms & shared co-working room", () => {
  const campus = computeCampusLayout(
    Array.from({ length: 5 }, (_, i) => makeBay(i)),
    [createDefaultCommonWing(0)],
    catalog,
    createDefaultBossOffice(),
    "office",
    undefined,
    // Pods are no longer spawned per agent; place 5 explicitly for the reachability check
    {
      "hypersleep:0": Array.from({ length: 5 }, (_, i) => ({
        id: `hypersleep:0-pod-${i}`, zoneId: "hypersleep:0", lx: i, ly: 0,
        assetId: "hypersleep-capsule", direction: "se" as const, layer: "object" as const, placedBy: "user" as const,
      })),
    },
  );
  const grid = buildWalkableGrid(campus);
  const walkable = (x: number, y: number) => grid.blocked[y * grid.width + x] === 0;

  const wallAt = (x: number, y: number) =>
    campus.worldFurniture.some((f) => f.tx === x && f.ty === y && f.assetId.startsWith("room-"));
  const floorAt = (x: number, y: number) => campus.floors.find((f) => f.tx === x && f.ty === y)?.assetId;

  it("keeps the floor completely open with zero interior walls and clean walkable blank space", () => {
    expect(IN_ZONE_GAP).toBe(0);
    expect(MODULE_PITCH_X).toBe(ZONE_SIZE);
    expect(ZONE_GAP).toBe(0);
    expect(campus.wallSegments).toHaveLength(0);
    expect(campus.wallDecor).toHaveLength(0);
    expect(campus.zones.map((z) => z.kind)).toEqual(["boss", "cowork", "hypersleep", "floor"]);
    expect(walkable(18, 18)).toBe(true);
  });

  it("never spawns hypersleep pods for agents, but a placed pod can be moved/rotated and survives new agents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-hypersleep-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 50_000 });
    await engine.init();
    const podCount = () => engine.getSnapshot().campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule").length;

    expect(podCount()).toBe(0);
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/a", eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ provider: "gemini", source: "antigravity", sessionId: "s2", projectPath: "/work/b", eventType: "tool_start", toolName: "Read" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-1", projectPath: "/work/a", eventType: "subagent_start" });
    expect(engine.getSnapshot().state.employees.length).toBe(3);
    expect(podCount()).toBe(0);

    // Pods remain available as decor the user places by hand
    await engine.placeFurniture({ zoneId: "floor:0", lx: 13, ly: 1, assetId: "hypersleep-capsule", direction: "se", placedBy: "user" });
    const pods = engine.getSnapshot().campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(pods).toHaveLength(1);

    // Expand floor adds +6x+6 open space
    const expanded = await engine.expandFloor({ addWidth: 6, addDepth: 6 });
    expect(expanded.widthTiles).toBe(30);
    expect(expanded.depthTiles).toBe(30);

    // Moving & rotating a 1x2 hypersleep pod (even overlapping its previous footprint or onto open floor) must succeed
    const pod0 = pods[0];
    await engine.moveFurniture(pod0.id, { tx: pod0.tx, ty: pod0.ty + 1, direction: "se" });
    await engine.moveFurniture(pod0.id, { tx: 4, ty: 12, direction: "sw" });
    const afterMove = engine.getSnapshot();
    const movedPod = afterMove.campus.worldFurniture.find((f) => f.id === pod0.id)!;
    expect([movedPod.tx, movedPod.ty, movedPod.direction]).toEqual([4, 12, "sw"]);
    expect(movedPod.footprintTiles).toEqual([2, 1]);

    // A new agent does not add a pod and does not reset the moved one
    await engine.ingestEvent({ provider: "gemini", source: "antigravity", sessionId: "s3", projectPath: "/work/c", eventType: "tool_start", toolName: "Edit" });
    const afterNewAgent = engine.getSnapshot();
    const podsAfter = afterNewAgent.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(podsAfter).toHaveLength(1);
    const stillMoved = podsAfter.find((f) => f.id === pod0.id)!;
    expect([stillMoved.tx, stillMoved.ty, stillMoved.direction]).toEqual([4, 12, "sw"]);
  });

  it("connects Boss, Central Work Hub, and every Hypersleep Capsule via A* pathfinding", () => {
    const bossTile: [number, number] = [2, 4];
    const cowork = campus.zones.find((z) => z.kind === "cowork")!;
    const pods = campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(pods).toHaveLength(5);

    const pathToHub = findTilePath(grid, bossTile, [cowork.originX + 2, cowork.originY + 1]);
    expect(pathToHub.at(-1)).toEqual([cowork.originX + 2, cowork.originY + 1]);

    for (const pod of pods) {
      const p = findTilePath(grid, bossTile, [pod.tx, pod.ty]);
      expect(p.at(-1), `unreachable pod ${pod.id}`).toEqual([pod.tx, pod.ty]);
    }
  });

  it("places the co-working bench next to the Boss Office with 8 face-to-face seats", () => {
    const cowork = campus.zones.find((z) => z.kind === "cowork")!;
    expect([cowork.col, cowork.row]).toEqual([1, 0]);
    const chairs = campus.worldFurniture.filter(
      (f) => f.zoneId === cowork.zoneId && f.assetId === "chair-office-swivel",
    );
    expect(chairs).toHaveLength(8);
    // Two pods: 4 chairs face "se" across the desks from 4 chairs facing "nw"
    expect(chairs.filter((c) => c.direction === "se")).toHaveLength(4);
    expect(chairs.filter((c) => c.direction === "nw")).toHaveLength(4);
  });

  it("seats subagents from different projects in the co-working room, not in their project room", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-cowork-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 50_000 });
    await engine.init();
    for (const [proj, agent] of [
      ["/work/a", "sub-1"],
      ["/work/b", "sub-2"],
    ]) {
      await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: proj, projectPath: proj, eventType: "prompt_submit" });
      await engine.ingestEvent({
        provider: "claude",
        source: "claude-code",
        sessionId: proj,
        agentId: agent,
        agentRole: "Explore",
        projectPath: proj,
        eventType: "subagent_start",
      });
      await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: proj, agentId: agent, projectPath: proj, eventType: "tool_start", toolName: "Read" });
    }

    const snap = engine.getSnapshot();
    const subs = snap.state.employees.filter((e) => e.isEphemeral);
    expect(subs.map((s) => s.deskIndex).sort()).toEqual([0, 1]);

    const sim = new OfficeSimulation();
    sim.syncFromServer(snap.state, snap.campus);
    const cowork = snap.campus.zones.find((z) => z.kind === "cowork")!;
    const inCowork = (x: number, y: number) =>
      x >= cowork.originX && x < cowork.originX + ZONE_SIZE && y >= cowork.originY && y < cowork.originY + ZONE_SIZE;
    for (const sub of subs) {
      const goal = (sim as unknown as { agents: Map<string, { goalTile: [number, number] }> }).agents.get(sub.id)!.goalTile;
      expect(inCowork(goal[0], goal[1]), `${sub.displayName} goal ${goal}`).toBe(true);
    }
  });

  it("briefs in front of Boss desk, thinks seated at work desk, and meets seated at Meeting Zone chairs", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-zones-sim-"));
    let clock = 10_000;
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => clock });
    await engine.init();

    // Create a Meeting Zone at (2, 12, 6x5) with a conference table & swivel chair
    await engine.createCustomZone({
      name: "Boardroom",
      icon: "🤝",
      color: "#a78bfa",
      role: "meeting",
      x: 2,
      y: 12,
      width: 6,
      height: 5,
    });
    await engine.placeFurniture({
      assetId: "table-conference",
      tx: 4,
      ty: 13,
      direction: "se",
      placedBy: "user",
    });
    await engine.placeFurniture({
      assetId: "chair-office-swivel",
      tx: 4,
      ty: 15,
      direction: "nw",
      placedBy: "user",
    });

    // 1. Briefing (prompt_submit -> assigning) -> stands/sits in front of Boss's desk facing Boss ("nw")
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "prompt_submit",
    });
    const sim = new OfficeSimulation();
    let snap = engine.getSnapshot();
    sim.syncFromServer(snap.state, snap.campus);
    let out = sim.step(50);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    // Boss chair is at (2,1) facing "se", Boss desk at (2,2) -> front visitor ring is y=3, facing "nw"
    expect(Math.round(out.visuals[0].y)).toBe(3);
    expect(out.visuals[0].direction).toBe("nw");

    // 2. Thinking (after assignDuration expires -> working with Thinking...) -> sits at work chair with 💭
    clock += 4_000;
    await engine.tick();
    snap = engine.getSnapshot();
    expect(snap.state.employees[0].visualState).toBe("working");
    expect(snap.state.employees[0].detail).toBe("Thinking...");
    sim.syncFromServer(snap.state, snap.campus);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect(out.visuals[0].clipName).toMatch(/^sit_type_/);
    expect(out.visuals[0].bubbleIcon).toBe("💭");
    // Must NOT pick the Meeting Zone chair at (4, 15) for working
    expect([Math.round(out.visuals[0].x), Math.round(out.visuals[0].y)]).not.toEqual([4, 15]);

    // 3. Meeting (swarm / planning tool) -> sits at the Meeting Zone swivel chair (4, 15) facing "nw"
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "tool_start",
      toolName: "swarm",
    });
    snap = engine.getSnapshot();
    sim.syncFromServer(snap.state, snap.campus);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect([Math.round(out.visuals[0].x), Math.round(out.visuals[0].y)]).toEqual([4, 15]);
    expect(out.visuals[0].direction).toBe("nw");
    expect(out.visuals[0].clipName).toMatch(/^sit_type_/);
    expect(out.visuals[0].bubbleIcon).toBe("💬");
  });

  it("supports editing Pods Zone, relocating placed pods into it, updating cryo deck floor, and not spawning pods for new agents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-pods-zone-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 20_000 });
    await engine.init();

    // 2 agents join (no pods spawned), then the user places 2 pods by hand
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "p1", projectPath: "/work/p1", eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ provider: "gemini", source: "gemini-cli", sessionId: "p2", projectPath: "/work/p2", eventType: "tool_start", toolName: "Read" });
    for (const lx of [13, 15]) {
      await engine.placeFurniture({ zoneId: "floor:0", lx, ly: 1, assetId: "hypersleep-capsule", direction: "se", placedBy: "user" });
    }

    // Create a custom Pods Zone at bottom-left (2, 14, 6x6)
    const podsZone = await engine.createCustomZone({
      name: "Cryo Deck South",
      icon: "🧊",
      color: "#14b8a6",
      role: "hypersleep",
      x: 2,
      y: 14,
      width: 6,
      height: 6,
    });

    // Cryo deck floor should now follow the custom Pods Zone (not default 13,1)
    let snap = engine.getSnapshot();
    expect(snap.campus.floors.find((f) => f.tx === 2 && f.ty === 14)?.assetId).toBe("floor-corridor-tile");
    expect(snap.campus.floors.find((f) => f.tx === 13 && f.ty === 1)?.assetId).not.toBe("floor-corridor-tile");

    // Relocate all existing pods into the custom Pods Zone
    const relocated = await engine.relocateHypersleepPodsToZone(podsZone.id);
    expect(relocated).toEqual({ moved: 2, total: 2, remaining: 0 });
    snap = engine.getSnapshot();
    const pods = snap.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(pods).toHaveLength(2);
    for (const p of pods) {
      expect(p.tx).toBeGreaterThanOrEqual(2);
      expect(p.tx + p.footprintTiles[0]).toBeLessThanOrEqual(8);
      expect(p.ty).toBeGreaterThanOrEqual(14);
      expect(p.ty + p.footprintTiles[1]).toBeLessThanOrEqual(20);
    }

    // A 3rd agent does not spawn another pod; the relocated pods stay put
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "p3", projectPath: "/work/p3", eventType: "tool_start", toolName: "Bash" });
    snap = engine.getSnapshot();
    const podsAfter = snap.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(podsAfter).toHaveLength(2);
    for (const p of podsAfter) {
      expect(p.tx).toBeGreaterThanOrEqual(2);
      expect(p.tx + p.footprintTiles[0]).toBeLessThanOrEqual(8);
      expect(p.ty).toBeGreaterThanOrEqual(14);
      expect(p.ty + p.footprintTiles[1]).toBeLessThanOrEqual(20);
    }
  });
});
