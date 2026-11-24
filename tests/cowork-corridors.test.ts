import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWalkableGrid, findTilePath } from "../src/client/pathfinding.js";
import { OfficeSimulation } from "../src/client/sim.js";
import {
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

  it("keeps a narrow walkway between areas of different zones", () => {
    expect(MODULE_PITCH_X).toBe(ZONE_SIZE + ZONE_GAP);
    expect(ZONE_GAP).toBe(3);
    const cowork = campus.zones.find((z) => z.kind === "cowork")!;
    // Boss Office (walled) | wall at 6 | walkway 7..8 | open-plan co-working from 9
    expect(cowork.originX).toBe(ZONE_SIZE + ZONE_GAP);
    expect(wallAt(ZONE_SIZE, 0)).toBe(true);
    for (const tx of [ZONE_SIZE + 1, ZONE_SIZE + 2]) {
      for (let ty = 0; ty < ZONE_SIZE; ty++) {
        expect(walkable(tx, ty)).toBe(true);
        expect(floorAt(tx, ty)).toBe("floor-corridor-tile");
      }
    }
  });

  it("walls every lot (with 2-tile doorways onto the walkway); only co-working is open plan", () => {
    const rightWallBlocked = [0, 1, 2, 3, 4, 5].filter((o) => !walkable(ZONE_SIZE, o));
    expect(rightWallBlocked).toEqual([0, 1, 4, 5]);
    const glassOn = (kind: string) =>
      campus.worldFurniture.some(
        (f) =>
          campus.zones.some((z) => z.zoneId === f.zoneId && z.kind === kind) &&
          (f.assetId === "room-wall-glass" || f.assetId === "room-junction-corner"),
      );
    expect(glassOn("bay")).toBe(true);
    expect(glassOn("cowork")).toBe(false);
  });

  it("joins projects of the same department into one lot with shared floor and a low divider", () => {
    const bays = campus.zones.filter((z) => z.kind === "bay");
    const a = bays.find((z) => bays.some((b) => b.col === z.col + 1 && b.row === z.row))!;
    const gapX = a.originX + ZONE_SIZE;
    expect(floorAt(gapX, a.originY)).not.toBe("floor-corridor-tile");
    expect(
      campus.worldFurniture.some((f) => f.tx === gapX + 1 && f.ty === a.originY && f.assetId.startsWith("divider-")),
    ).toBe(true);
    expect(walkable(gapX + 1, a.originY + 2)).toBe(true); // pass-through between the two projects
  });

  it("connects every room to every other room through doorways and corridors", () => {
    // First walkable tile of the room's central cross (some rooms keep a desk on the exact centre)
    const centre = (z: (typeof campus.zones)[number]): [number, number] => {
      for (const [lx, ly] of [[2, 2], [3, 3], [2, 3], [3, 2], [2, 5], [3, 5], [2, 0], [3, 0]]) {
        if (walkable(z.originX + lx, z.originY + ly)) return [z.originX + lx, z.originY + ly];
      }
      throw new Error(`no walkable centre in ${z.zoneId}`);
    };
    const boss = campus.zones.find((z) => z.kind === "boss")!;
    for (const z of campus.zones) {
      const pathTiles = findTilePath(grid, centre(boss), centre(z));
      expect(pathTiles.at(-1), `unreachable ${z.zoneId}`).toEqual(centre(z));
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
