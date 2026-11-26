import { facingToward } from "../src/shared/room-layouts.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IsoCamera } from "../src/client/camera.js";
import { nextThemeMode } from "../src/client/hud.js";
import { sortUnifiedIsoEntities } from "../src/client/iso-renderer.js";
import { buildWalkableGrid, findTilePath } from "../src/client/pathfinding.js";
import { deltaToDir, OfficeSimulation } from "../src/client/sim.js";
import { DEMO_SCRIPT } from "../src/server/demo-simulator.js";
import {
  computeCampusLayout,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
} from "../src/server/layout-engine.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import {
  CHARACTER_CLIPS,
  PHASE2_CHARACTER_SPECS,
  PixcelBridge,
  remapAssetToOfficeTheme,
  type PixcelAssetLike,
} from "../src/server/pixcel-bridge.js";
import { OfficeStore } from "../src/server/store.js";
import {
  classifyDepartmentFromPath,
  DEPARTMENT_META,
  OfficeStateSchema,
  type CatalogEntry,
  type DepartmentId,
  type ProjectBayRecord,
} from "../src/shared/types.js";

const mockCatalog = new Map<string, CatalogEntry>([
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
  ["filing-cabinet", { id: "filing-cabinet", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["printer-copier", { id: "printer-copier", category: "tech", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["robot-vacuum", { id: "robot-vacuum", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["cabinet-wood-tall", { id: "cabinet-wood-tall", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["shelf-metal-storage", { id: "shelf-metal-storage", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["projector-screen", { id: "projector-screen", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["projector-tripod", { id: "projector-tripod", category: "tech", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["trash-bin-office", { id: "trash-bin-office", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["fire-extinguisher", { id: "fire-extinguisher", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["desk-drafting", { id: "desk-drafting", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["pc-tower-box", { id: "pc-tower-box", category: "tech", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["shredder-mini", { id: "shredder-mini", category: "tech", layer: "object", footprintTiles: [1, 1], source: "prop" }],
]);

function makeDeptBay(id: string, projectPath: string, department: DepartmentId, idx: number): ProjectBayRecord {
  return {
    id,
    projectPath,
    displayName: id,
    department,
    accentColor: DEPARTMENT_META[department].color,
    archived: false,
    deskSlots: 2,
    furniture: createDefaultBayFurniture(id, department),
    createdAt: idx,
    lastActiveAt: idx,
  };
}

describe("Pixel Salvaje Office Theme, Phase 2 Characters & AI Org Flow", () => {
  it("defaults theme to 'office', cycles Office -> Night -> Day -> Office, and remaps office palette accurately", () => {
    const parsed = OfficeStateSchema.parse({});
    expect(parsed.theme).toBe("office");
    expect(nextThemeMode("office")).toBe("night");
    expect(nextThemeMode("night")).toBe("day");
    expect(nextThemeMode("day")).toBe("office");

    const wallAsset: PixcelAssetLike = {
      schemaVersion: 1,
      id: "wall-night-window",
      category: "architecture",
      layer: "wall",
      outlineMode: "top-only",
      tilePreset: "64x32",
      voxelsPerTile: 32,
      footprintTiles: [1, 1],
      palette: "office-night",
      materials: {
        wall_main: { color: "#252e45", kind: "matte" },
        wall_trim: { color: "#33405e", kind: "matte" },
        cap_dark: { color: "#171c26", kind: "matte" },
        night_glass: { color: "#183661", kind: "glass" },
      },
      ops: [],
      decals: [],
    };
    const remappedWall = remapAssetToOfficeTheme(wallAsset);
    expect(remappedWall.materials.wall_main.color).toBe("#dadde2");
    expect(remappedWall.materials.wall_trim.color).toBe("#c8cdd5");
    expect(remappedWall.materials.cap_dark.color).toBe("#5d5355");
    expect(remappedWall.materials.night_glass.color).toBe("#7dd3fc");

    const deskAsset: PixcelAssetLike = {
      ...wallAsset,
      id: "desk-dev-dual",
      category: "furniture",
      layer: "object",
      materials: {
        wood_top: { color: "#62402a", kind: "wood" },
        metal_dark: { color: "#171c26", kind: "metal" },
      },
    };
    const remappedDesk = remapAssetToOfficeTheme(deskAsset);
    expect(remappedDesk.materials.wood_top.color).toBe("#c87d42");
    expect(remappedDesk.materials.metal_dark.color).toBe("#8b95a5");

    const coffeeAsset: PixcelAssetLike = {
      ...wallAsset,
      id: "coffee-machine-bar",
      category: "furniture",
      layer: "object",
      materials: {
        metal_dark: { color: "#1a202c", kind: "metal" },
        wood_top: { color: "#6b442a", kind: "wood" },
      },
    };
    const remappedCoffee = remapAssetToOfficeTheme(coffeeAsset);
    expect(remappedCoffee.materials.metal_dark.color).toBe("#dc2626");
    expect(remappedCoffee.materials.wood_top.color).toBe("#c87d42");
  });

  it("builds atlas-office.{png,json} (+ emissive) with all 8 office props and all 10 Phase 2 characters x 8 clips x 4 directions", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-office-atlas-"));
    const bridge = new PixcelBridge({
      pixcelRoot: process.env.IHERK_PIXCEL_ROOT ?? new URL("../../iherk-pixcel", import.meta.url).pathname,
      projectRoot: process.cwd(),
      runtimeOutDir: outDir,
    });
    const res = await bridge.buildCoreAtlases();

    const officePng = await fs.readFile(path.join(outDir, "atlas-office.png"));
    const officeEmissive = await fs.readFile(path.join(outDir, "atlas-office_emissive.png"));
    const officeAtlas = JSON.parse(await fs.readFile(res.officeAtlasPath, "utf8"));

    expect(officePng.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(officeEmissive.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(officeAtlas.meta.image).toBe("atlas-office.png");
    expect(officeAtlas.meta.emissiveImage).toBe("atlas-office_emissive.png");

    // All office props + room walls + ergonomic chair backrest overlay + expanded furniture & wall decor
    for (const propId of [
      "floor-office-carpet",
      "floor-boss-rug",
      "floor-corridor-tile",
      "divider-cubicle-amber",
      "room-wall-glass",
      "room-junction-cross",
      "chair-office-swivel-back",
      "printer-copier",
      "filing-cabinet",
      "robot-vacuum",
      "wall-ac-unit",
      "wall-corkboard",
      "cabinet-wood-tall",
      "shelf-metal-storage",
      "projector-screen",
      "projector-tripod",
      "trash-bin-office",
      "fire-extinguisher",
      "desk-drafting",
      "pc-tower-box",
      "shredder-mini",
      "wall-clock",
      "wall-tv-monitor",
      "wall-chart-org",
      "wall-calendar",
      "wall-certificate",
    ]) {
      const hasAny = Object.keys(officeAtlas.frames).some((k) => k.startsWith(`${propId}/se/`));
      expect(hasAny, `Expected ${propId} in atlas-office`).toBe(true);
    }

    // All 8 clips (18 frames) x 4 dirs x 10 characters (including agent-boss)
    expect(CHARACTER_CLIPS).toHaveLength(18);
    expect(CHARACTER_CLIPS).toContain("inspect_0");
    expect(CHARACTER_CLIPS).toContain("inspect_1");

    const bossSpec = PHASE2_CHARACTER_SPECS.find((s) => s.id === "agent-boss");
    expect(bossSpec?.outfitStyle).toBe("blazer");
    expect(bossSpec?.glasses).toBe(true);

    for (const spec of PHASE2_CHARACTER_SPECS) {
      for (const dir of ["se", "sw", "nw", "ne"] as const) {
        for (const clip of CHARACTER_CLIPS) {
          expect(officeAtlas.frames[`${spec.id}/${dir}/${clip}`]).toBeDefined();
        }
      }
    }
  });

  it("classifies all 4 AI Org departments + general fallback + explicit department override", () => {
    // IHERK
    expect(classifyDepartmentFromPath("~/Documents/IHERK/iherk-hell-factory")).toBe("iherk");
    expect(classifyDepartmentFromPath("/Users/dev3/Documents/IHERK/iherk-pixcel")).toBe("iherk");
    expect(classifyDepartmentFromPath("~/Documents/iherk-tools")).toBe("iherk");
    expect(classifyDepartmentFromPath("/demo/iherk-spider-process")).toBe("iherk");

    // DEV
    expect(classifyDepartmentFromPath("~/Documents/Github/MSV-Front-End")).toBe("dev");
    expect(classifyDepartmentFromPath("/Users/dev3/Documents/Github/MSV-Bifrost")).toBe("dev");
    expect(classifyDepartmentFromPath("/demo/msv-frontend")).toBe("dev");

    // ERP
    expect(classifyDepartmentFromPath("/demo/erp-loh-pc")).toBe("erp");
    expect(classifyDepartmentFromPath("/work/loh-pc-monitor")).toBe("erp");
    expect(classifyDepartmentFromPath("/work/msv-db-audit")).toBe("erp");
    expect(classifyDepartmentFromPath("/work/anything", "erp")).toBe("erp");

    // ACCOUNTING
    expect(classifyDepartmentFromPath("/demo/accounting-vat")).toBe("accounting");
    expect(classifyDepartmentFromPath("/work/tax-2026")).toBe("accounting");
    expect(classifyDepartmentFromPath("/work/finance-report")).toBe("accounting");
    expect(classifyDepartmentFromPath("/work/anything", "accounting")).toBe("accounting");

    // Fallback GENERAL
    expect(classifyDepartmentFromPath("/work/random-sandbox")).toBe("general");
    expect(classifyDepartmentFromPath(null)).toBe("general");
  });

  it("groups campus into 3 functional zones (hq, amenity, workspace) with no departments, separated by 2-tile walkways", () => {
    const bays: ProjectBayRecord[] = [
      makeDeptBay("bay-1", "/work/misc", "general", 1),
      makeDeptBay("bay-2", "/demo/accounting-vat", "accounting", 2),
      makeDeptBay("bay-3", "/demo/msv-frontend", "dev", 3),
      makeDeptBay("bay-4", "/demo/erp-loh-pc", "erp", 4),
      makeDeptBay("bay-5", "/demo/iherk-hell-factory", "iherk", 5),
      makeDeptBay("bay-6", "/demo/iherk-pixcel", "iherk", 6),
    ];

    const officeCampus = computeCampusLayout(
      bays,
      [createDefaultCommonWing(0), createDefaultCommonWing(1)],
      mockCatalog,
      createDefaultBossOffice(),
      "office",
    );

    // Open customizable campus: Boss Corner + Central Work Hub + empty Hypersleep Bay anchor + Blank Floor
    expect(officeCampus.zones.map((z) => z.kind)).toEqual(["boss", "cowork", "hypersleep", "floor"]);
    expect(officeCampus.wallSegments).toHaveLength(0);
    expect(officeCampus.floors.some((f) => f.assetId === "floor-office-carpet")).toBe(true);
    // No pods are spawned, so there is no default cryo deck
    expect(officeCampus.floors.some((f) => f.assetId === "floor-corridor-tile")).toBe(false);
    expect(officeCampus.floors.some((f) => f.assetId === "floor-boss-rug")).toBe(true);
    expect(officeCampus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(0);

    const walkGrid = buildWalkableGrid(officeCampus);
    for (const pod of officeCampus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")) {
      const path = findTilePath(walkGrid, [2, 4], [pod.tx, pod.ty]);
      expect(path[path.length - 1], `Pod ${pod.id} reachable`).toEqual([pod.tx, pod.ty]);
    }

    const nightCampus = computeCampusLayout(
      bays,
      [createDefaultCommonWing(0), createDefaultCommonWing(1)],
      mockCatalog,
      createDefaultBossOffice(),
      "night",
    );
    expect(nightCampus.floors.some((f) => f.assetId === "floor-wood-plank")).toBe(true);
    expect(nightCampus.floors.some((f) => f.assetId === "floor-corridor-tile")).toBe(false);
    expect(nightCampus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule")).toHaveLength(0);
  });

  it("uses Phase 2 1:1 facing directions in OfficeSimulation, supports AI Org roles, manageBay(department), and 4-dept DemoSimulator", async () => {
    expect(deltaToDir(1, 0, "se")).toBe("ne");
    expect(deltaToDir(-1, 0, "se")).toBe("sw");
    expect(deltaToDir(0, 1, "se")).toBe("se");
    expect(deltaToDir(0, -1, "se")).toBe("nw");

    // Camera zoom with anchor keeps the exact world point pinned under cursor / viewport center
    const cam = new IsoCamera();
    cam.snapToTile(8, 8, 1280, 720);
    const [wxBefore, wyBefore] = cam.screenToWorld(820, 410);
    cam.setZoom(4, 820, 410);
    const [wxAfterIn, wyAfterIn] = cam.screenToWorld(820, 410);
    expect(wxAfterIn).toBeCloseTo(wxBefore, 5);
    expect(wyAfterIn).toBeCloseTo(wyBefore, 5);
    cam.setZoom(1, 820, 410);
    const [wxAfterOut, wyAfterOut] = cam.screenToWorld(820, 410);
    expect(wxAfterOut).toBeCloseTo(wxBefore, 5);
    expect(wyAfterOut).toBeCloseTo(wyBefore, 5);

    // Depth-sorter layers desk -> chair -> seated worker cleanly (rear backrest overlay draws after worker)
    const desk = { id: "f:desk", x: 0, y: 0, footprintX: 2, footprintY: 1 };
    const chairNw = { id: "f:chair-nw", x: 1, y: 1, footprintX: 1, footprintY: 1 };
    const worker = { id: "e:worker", x: 1.2, y: 1.2, footprintX: 0.6, footprintY: 0.6 };
    expect(sortUnifiedIsoEntities([chairNw, worker, desk]).map((s) => s.id)).toEqual([
      "f:desk",
      "f:chair-nw",
      "e:worker",
    ]);

    // Idle/resting employees sit and nap (rest_sleep_*) at their own desk chair with 💤
    const restSim = new OfficeSimulation();
    const restBay = makeDeptBay("bay-rest", "/demo/iherk-hell-factory", "iherk", 1);
    const restWing = createDefaultCommonWing(0);
    const restCampus = computeCampusLayout([restBay], [restWing], mockCatalog, createDefaultBossOffice(), "office");
    restSim.syncFromServer(
      {
        version: 1,
        theme: "office",
        bays: [restBay],
        commonWings: [restWing],
        activityLog: [],
        employees: [
          {
            id: "emp-sleep",
            bayId: "bay-rest",
            provider: "claude",
            spriteId: "agent-claude",
            displayName: "Claude",
            role: "org-worker",
            isEphemeral: false,
            deskIndex: 0,
            visualState: "resting",
            toolCategory: "idle",
            lastUpdatedAt: 1,
          },
        ],
      },
      restCampus,
    );
    let stepOut = restSim.step(50);
    for (let i = 0; i < 400; i++) stepOut = restSim.step(50);
    // Permanent agents doze at a desk chair instead of entering a pod
    const restChair = restCampus.worldFurniture
      .filter((f) => f.zoneId === "cowork:0" && f.assetId === "chair-office-swivel")
      .sort((a, b) => a.ty - b.ty || a.tx - b.tx)[0];
    expect(Math.round(stepOut.visuals[0].x)).toBe(restChair.tx);
    expect(Math.round(stepOut.visuals[0].y)).toBe(restChair.ty);
    expect(stepOut.visuals[0].clipName).toBe("sit_type_0");
    expect(stepOut.visuals[0].bubbleIcon).toBe("💤");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-org-flow-"));
    const engine = new OfficeEngine({
      store: new OfficeStore(dir),
      catalogById: mockCatalog,
    });
    await engine.init();
    expect(engine.getSnapshot().state.theme).toBe("office");

    // Ingest events for all 4 departments with AI Org roles
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s-iherk",
      agentRole: "Orchestrator",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Edit",
    });
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s-iherk",
      agentId: "qa-1",
      parentAgentId: "s-iherk",
      agentRole: "org-qa",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Inspecting tests",
    });
    await engine.ingestEvent({
      provider: "gemini",
      source: "antigravity",
      sessionId: "s-acc",
      agentRole: "Orchestrator",
      department: "accounting",
      projectPath: "/work/monthly-close",
      eventType: "waiting_user",
      detail: "Approve VAT filing?",
    });

    const snap = engine.getSnapshot();
    const projA = snap.state.bays.find((b) => b.projectPath === "/demo/iherk-hell-factory");
    const projB = snap.state.bays.find((b) => b.projectPath === "/work/monthly-close");
    expect(projA).toBeDefined();
    expect(projB).toBeDefined();
    expect(projA?.department).toBeUndefined();
    expect(projB?.department).toBeUndefined();

    // manageBay updates displayName & accentColor cleanly without departments
    const updated = await engine.manageBay(projB!.id, { displayName: "Monthly Close", accentColor: "#10b981" });
    expect(updated.displayName).toBe("Monthly Close");
    expect(updated.accentColor).toBe("#10b981");

    // Simulation facing: subagent faces across its pod, visitor reporting to Boss faces the boss desk
    const sim = new OfficeSimulation();
    sim.syncFromServer(engine.getSnapshot().state, engine.getSnapshot().campus);
    let out = sim.step(50);
    for (let i = 0; i < 400; i++) out = sim.step(50);

    const qaVisual = out.visuals.find((v) => v.record.role === "org-qa");
    const reportingVisual = out.visuals.find((v) => v.record.visualState === "reporting");
    // Subagent sits on co-working seat 0: the back row of a face-to-face pod, facing "se" across the desks
    expect(qaVisual?.direction).toBe("se");
    expect(qaVisual?.bubbleIcon).toBe("🧪");
    // Visitors stand in front of the boss desk and look at it
    const bossDesk = engine.getSnapshot().campus.worldFurniture.find((f) => f.id === "boss:0-boss-desk")!;
    const deskCentre: [number, number] = [
      bossDesk.tx + (bossDesk.footprintTiles[0] - 1) / 2,
      bossDesk.ty + (bossDesk.footprintTiles[1] - 1) / 2,
    ];
    expect(reportingVisual?.direction).toBe(
      facingToward([Math.round(reportingVisual!.x), Math.round(reportingVisual!.y)], deskCentre),
    );
    expect(reportingVisual?.bubbleIcon).toBe("❓");

    // DEMO_SCRIPT covers 4 projects (department-free), AI Org roles, HITL (waiting_user), and Report (turn_stop)
    const demoProjects = new Set(DEMO_SCRIPT.map((s) => s.event.projectPath));
    expect(demoProjects.size).toBe(4);
    expect(DEMO_SCRIPT.every((s) => s.event.department === undefined)).toBe(true);
    const demoRoles = new Set(DEMO_SCRIPT.map((s) => s.event.agentRole).filter(Boolean));
    expect(demoRoles).toEqual(new Set(["Orchestrator", "org-researcher", "org-worker", "org-qa"]));
    expect(DEMO_SCRIPT.some((s) => s.event.eventType === "waiting_user")).toBe(true);
    expect(DEMO_SCRIPT.some((s) => s.event.eventType === "turn_stop")).toBe(true);
  });
});
