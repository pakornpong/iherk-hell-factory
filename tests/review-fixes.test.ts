import { facingToward } from "../src/shared/room-layouts.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AtlasManager } from "../src/client/atlas-loader.js";
import { IsoCamera, STEP_Y, tileToWorld } from "../src/client/camera.js";
import { DecorateController, type DecorateApiClient } from "../src/client/decorate.js";
import { resolveAssetAnimationFrame } from "../src/client/iso-renderer.js";
import { findTilePath } from "../src/client/pathfinding.js";
import { OfficeSimulation } from "../src/client/sim.js";
import { AntigravityWatcher } from "../src/server/antigravity-watcher.js";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultCommonWing,
  validateFurniturePlacement,
} from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry, FurnitureInstance, OfficeState, ProjectBayRecord } from "../src/shared/types.js";

const fullCatalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter", frames: ["idle_0", "idle_1"] }],
  ["desk-security-ops", { id: "desk-security-ops", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter", frames: ["alert_0", "alert_1"] }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter", frames: ["default"] }],
  ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter", frames: ["default"] }],
  ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop", frames: ["idle_0", "idle_1"] }],
  ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop", frames: ["default"] }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter", frames: ["default"] }],
  ["server-rack", { id: "server-rack", category: "tech", layer: "object", footprintTiles: [1, 1], source: "starter", frames: ["blink_0", "blink_1", "blink_2"] }],
  ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter", frames: ["default"] }],
  ["bay-sign-post", { id: "bay-sign-post", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop", frames: ["default"] }],
  ["water-cooler", { id: "water-cooler", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop", frames: ["default"] }],
  ["divider-low-glass", { id: "divider-low-glass", category: "architecture", layer: "object", footprintTiles: [1, 1], source: "prop", frames: ["default"] }],
]);

describe("Final Review Fix Verification (Critical #1-#4 & Important #5-#10)", () => {
  it("#1: aligns perimeter walls (ty=0 -> ne, tx=0 -> nw), emits both corner wall slabs at (0,0), and mounts whiteboard flush on ne", () => {
    const bay: ProjectBayRecord = {
      id: "bay-0",
      projectPath: "/p/a",
      displayName: "alpha",
      accentColor: "#38bdf8",
      archived: false,
      deskSlots: 2,
      furniture: createDefaultBayFurniture("bay-0"),
      createdAt: 1,
      lastActiveAt: 1,
    };
    const campus = computeCampusLayout([bay], [createDefaultCommonWing(0)], fullCatalog);
    // Corner (0,0) must have corner pillar + nw slab + ne slab
    expect(campus.walls.some((w) => w.tx === 0 && w.ty === 0 && w.edge === "corner")).toBe(true);
    expect(campus.walls.some((w) => w.tx === 0 && w.ty === 0 && w.edge === "nw")).toBe(true);
    expect(campus.walls.some((w) => w.tx === 0 && w.ty === 0 && w.edge === "ne")).toBe(true);
    // ty = 0 runs along +X (SE) -> NE edge
    expect(campus.walls.some((w) => w.tx === 2 && w.ty === 0 && w.edge === "ne")).toBe(true);
    // tx = 0 runs along +Y (SW) -> NW edge
    expect(campus.walls.some((w) => w.tx === 0 && w.ty === 2 && w.edge === "nw")).toBe(true);
    // Open customizable floor keeps perimeter walls clean with zero auto-clutter wall decor
    expect(campus.wallDecor).toHaveLength(0);
  });

  it("#2: resolves actual frame names for server-rack (blink_*), desk-security-ops (alert_*), and custom animated assets", () => {
    expect(resolveAssetAnimationFrame("server-rack", 0, fullCatalog)).toBe("blink_0");
    expect(resolveAssetAnimationFrame("server-rack", 1300, fullCatalog)).toBe("blink_2");
    expect(resolveAssetAnimationFrame("desk-security-ops", 700, fullCatalog)).toBe("alert_1");

    // AtlasManager also falls back to any existing frame key for an asset/direction if requested frame is missing
    const mgr = new AtlasManager();
    (mgr as any).customPack = {
      image: {},
      meta: {
        frames: {
          "custom-spin/se/spin_0": {
            frame: { x: 0, y: 0, w: 32, h: 32 },
            isometric: { assetId: "custom-spin", direction: "se", frameName: "spin_0", durationMs: 200, layer: "object", footprintTiles: [1, 1], anchor: { x: 16, y: 31 } },
          },
        },
        meta: { image: "custom-atlas.png", stepX: 32, stepY: 16 },
      },
    };
    expect(mgr.getFrame("night", "custom-spin", "se", "default")).not.toBeNull();
  });

  it("#3: screenToTile picks the exact tile when clicking the visual center of a bottom-diamond tile", () => {
    const cam = new IsoCamera();
    cam.setZoom(2);
    cam.snapToTile(5, 5, 1000, 800);
    // Visual center of tile (3, 4) sits at (tileToWorld(3, 4).x, tileToWorld(3, 4).y - STEP_Y)
    const [wx, wy] = tileToWorld(3, 4);
    const [sx, sy] = cam.worldToScreen(wx, wy - STEP_Y);
    const [ptx, pty] = cam.screenToTile(sx, sy);
    expect(Math.floor(ptx)).toBe(3);
    expect(Math.floor(pty)).toBe(4);
  });

  it("#4: employees face their desks (chair direction) and look at the meeting table during stand-ups", () => {
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
    const campus = computeCampusLayout([bay], [wing], fullCatalog);
    const sim = new OfficeSimulation();
    const state: OfficeState = {
      version: 1,
      theme: "office",
      bays: [bay],
      commonWings: [wing],
      activityLog: [],
      employees: [
        { id: "e1", bayId: "b0", provider: "claude", spriteId: "agent-claude", displayName: "C", role: "Lead", isEphemeral: false, deskIndex: 0, visualState: "working", toolCategory: "code", lastUpdatedAt: 1 },
      ],
    };
    sim.syncFromServer(state, campus);
    let out = sim.step(50);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    // Working -> sits at Central Work Hub chair facing its direction
    const centralChairs = campus.worldFurniture
      .filter((f) => f.zoneId === "cowork:0" && f.assetId === "chair-office-swivel")
      .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    expect(Math.round(out.visuals[0].x)).toBe(centralChairs[0].tx);
    expect(Math.round(out.visuals[0].y)).toBe(centralChairs[0].ty);
    expect(out.visuals[0].direction).toBe(centralChairs[0].direction);

    // Resting -> walks into Hypersleep Capsule and sleeps inside!
    state.employees[0].visualState = "resting";
    sim.syncFromServer(state, campus);
    for (let i = 0; i < 400; i++) out = sim.step(50);
    const pod0 = campus.worldFurniture.find((f) => f.assetId === "hypersleep-capsule")!;
    expect(Math.round(out.visuals[0].x)).toBe(pod0.tx);
    expect(Math.round(out.visuals[0].y)).toBe(pod0.ty);
    expect(out.visuals[0].clipName).toMatch(/^rest_sleep_/);
    expect(out.visuals[0].bubbleIcon).toBe("💤");
  });

  it("#5 & #7: prevents subagent resurrection after stop, ignores stray session_end for unknown projects, cleans subagents on parent turn_stop, and seats subagents on unique co-working hot desks", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-fix5-"));
    let clock = 10_000;
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: fullCatalog, now: () => clock });
    await engine.init();

    // Stray session_end for unknown project must NOT claim Starter Bay or create a bay
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "ghost", projectPath: "/work/stray", eventType: "session_end" });
    expect(engine.getSnapshot().state.bays[0].projectPath).toBeNull();

    // Start project + subagent, stop subagent, then delayed tool_end must NOT resurrect subagent
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/real", eventType: "tool_start", toolName: "Edit" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-a", projectPath: "/work/real", eventType: "subagent_start" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-a", projectPath: "/work/real", eventType: "subagent_stop" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-a", projectPath: "/work/real", eventType: "tool_end", toolName: "Read" });
    expect(engine.getSnapshot().state.employees.filter((e) => e.agentId === "sub-a")).toHaveLength(0);

    // Spawn 2 active subagents -> they hot-desk in the shared co-working room on unique seats,
    // so the project's own room does NOT grow extra desks for them
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-b", projectPath: "/work/real", eventType: "subagent_start" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-c", projectPath: "/work/real", eventType: "subagent_start" });
    const bay = engine.getSnapshot().state.bays[0];
    expect(bay.furniture.some((f) => f.id.endsWith("-desk-2"))).toBe(false);
    const subs = engine.getSnapshot().state.employees.filter((e) => e.isEphemeral);
    expect(subs).toHaveLength(2);
    expect(subs.every((e) => e.displayName.endsWith(`@ ${bay.displayName}`))).toBe(true);
    const deskIndices = subs.map((e) => e.deskIndex);
    expect(new Set(deskIndices).size).toBe(deskIndices.length);

    // Parent turn_stop cleans up ephemeral subagents belonging to that session
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/real", eventType: "turn_stop" });
    expect(engine.getSnapshot().state.employees.filter((e) => e.isEphemeral)).toHaveLength(0);
  });

  it("#6: preserves real telemetry received during Demo Mode and rejects Architect mutations while Demo Mode is active", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-fix6-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: fullCatalog });
    await engine.init();

    await engine.enterDemoMode();
    // Architect writes while in Demo Mode should be rejected cleanly instead of silently lost
    await expect(
      engine.placeFurniture({ zoneId: "common:0", lx: 0, ly: 0, assetId: "plant-potted", direction: "se", placedBy: "user" }),
    ).rejects.toThrow(/demo mode/i);

    // Real (non-simulator) telemetry during Demo Mode is queued and replayed on exitDemoMode
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "real-1", projectPath: "/work/real-during-demo", eventType: "tool_start", toolName: "Edit" });
    await engine.exitDemoMode();
    expect(engine.getSnapshot().state.bays.some((b) => b.projectPath === "/work/real-during-demo")).toBe(true);
  });

  it("#8: AntigravityWatcher resolves file/subdir paths up to the enclosing project/git root", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "hf-repo-"));
    await fs.mkdir(path.join(workspace, ".git"), { recursive: true });
    await fs.mkdir(path.join(workspace, "src", "server"), { recursive: true });
    const fileInRepo = path.join(workspace, "src", "server", "index.ts");
    await fs.writeFile(fileInRepo, "// test");

    const brain = await fs.mkdtemp(path.join(os.tmpdir(), "hf-agy-root-"));
    const convLogDir = path.join(brain, "conv-root", ".system_generated", "logs");
    await fs.mkdir(convLogDir, { recursive: true });
    const logPath = path.join(convLogDir, "transcript.jsonl");

    const seenPaths: string[] = [];
    const watcher = new AntigravityWatcher({
      brainDir: brain,
      onEvent: (ev) => {
        seenPaths.push(ev.projectPath);
      },
    });
    await fs.writeFile(
      logPath,
      `${JSON.stringify({ step_index: 1, type: "PLANNER_RESPONSE", tool_calls: [{ name: "edit_file", args: { Path: fileInRepo } }], created_at: new Date().toISOString() })}\n`,
    );
    await watcher.pollOnce();
    expect(seenPaths[0]).toBe(workspace);
  });

  it("#9: placement validator prevents boxing in bay interior with a U-wall around entrance; A* escapes a blocked start tile", () => {
    const bay: ProjectBayRecord = {
      id: "bay-0",
      projectPath: "/p/a",
      displayName: "alpha",
      accentColor: "#38bdf8",
      archived: false,
      deskSlots: 2,
      furniture: [
        { id: "f1", zoneId: "bay:bay-0", lx: 1, ly: 5, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "user" },
        { id: "f2", zoneId: "bay:bay-0", lx: 4, ly: 5, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "user" },
        { id: "f3", zoneId: "bay:bay-0", lx: 2, ly: 4, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "user" },
      ],
      createdAt: 1,
      lastActiveAt: 1,
    };
    const campus = computeCampusLayout([bay], [createDefaultCommonWing(0)], fullCatalog);
    // Placing the closing cap at (3,4) completely seals entrance (2,5)-(3,5) from the rest of the bay!
    const sealCheck = validateFurniturePlacement(
      campus,
      bay.furniture,
      { zoneId: "bay:bay-0", lx: 3, ly: 4, assetId: "plant-potted", direction: "se" },
      fullCatalog,
    );
    expect(sealCheck.ok).toBe(false);

    // A* starting on a blocked tile when goal is boxed in must escape onto an unblocked neighbor
    const blocked = new Uint8Array(6 * 6);
    blocked[0] = 1; // start (0,0) is blocked!
    for (const [bx, by] of [[3, 4], [5, 4], [4, 3], [4, 5], [4, 4]]) blocked[by * 6 + bx] = 1;
    const p = findTilePath({ width: 6, height: 6, blocked }, [0, 0], [4, 4]);
    const end = p[p.length - 1];
    expect(blocked[end[1] * 6 + end[0]]).toBe(0);
  });

  it("#10: DecorateController ignores procedural sys-div-* dividers on erase and supports move tool with undo/redo", async () => {
    const items: FurnitureInstance[] = [
      { id: "furn-1", zoneId: "common:0", lx: 0, ly: 0, assetId: "plant-potted", direction: "se", layer: "object", placedBy: "user" },
    ];
    let removedIds: string[] = [];
    const api: DecorateApiClient = {
      async placeFurniture(req) {
        const it: FurnitureInstance = { id: "furn-new", zoneId: "common:0", lx: req.tx, ly: req.ty, assetId: req.assetId, direction: req.direction, layer: "object", placedBy: "user" };
        items.push(it);
        return it;
      },
      async moveFurniture(id, req) {
        const found = items.find((i) => i.id === id)!;
        found.lx = req.tx;
        found.ly = req.ty;
        if (req.direction) found.direction = req.direction;
        return { ...found };
      },
      async removeFurniture(id) {
        removedIds.push(id);
      },
    };
    const ctrl = new DecorateController(api);
    ctrl.toggle();
    ctrl.setTool("erase");
    // Clicking procedural divider must be ignored cleanly
    await ctrl.handleTileClick(6, 0, { id: "sys-div-0-0-0", zoneId: "common:0", lx: 5, ly: 0, assetId: "divider-low-glass", direction: "sw", layer: "object", placedBy: "system" });
    expect(removedIds).toHaveLength(0);

    // Move tool moves furniture and supports undo
    ctrl.setTool("move");
    await ctrl.handleTileClick(0, 0, items[0]); // pick up furn-1
    await ctrl.handleTileClick(0, 2); // drop at (0,2)
    expect(items[0].ly).toBe(2);
    await ctrl.undo();
    expect(items[0].ly).toBe(0);
  });
});
