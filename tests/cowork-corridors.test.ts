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

  it("spawns 1 hypersleep capsule per agent, supports moving/rotating pods, and auto-spawns for new agents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-hypersleep-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => 50_000 });
    await engine.init();

    expect(engine.getSnapshot().campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(1);

    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/a", eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ provider: "gemini", source: "antigravity", sessionId: "s2", projectPath: "/work/b", eventType: "tool_start", toolName: "Read" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-1", projectPath: "/work/a", eventType: "subagent_start" });
    const snap = engine.getSnapshot();
    const pods = snap.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(pods).toHaveLength(snap.state.employees.length);
    expect(pods.length).toBe(3);

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

    // Adding a new agent after customizing pods still spawns 1 new capsule without resetting the moved pod
    await engine.ingestEvent({ provider: "gemini", source: "antigravity", sessionId: "s3", projectPath: "/work/c", eventType: "tool_start", toolName: "Edit" });
    const afterNewAgent = engine.getSnapshot();
    const podsAfter = afterNewAgent.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule");
    expect(podsAfter).toHaveLength(afterNewAgent.state.employees.length);
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
});
