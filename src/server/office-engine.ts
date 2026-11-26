import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { isSurfaceHostAsset, isTabletopAsset, toTileKey, type RenderLayer, type TilePermission } from "../shared/layers.js";
import {
  AgentTelemetryEventSchema,
  type ActivityLogEntry,
  type AgentTelemetryEvent,
  type CatalogEntry,
  type ComputedCampus,
  type CustomZoneRecord,
  type CustomZoneRole,
  type DepartmentId,
  type Direction,
  type EmployeeRecord,
  type FurnitureInstance,
  type OfficeLayoutFile,
  type OfficeSnapshotPayload,
  type OfficeState,
  type ProjectBayRecord,
  type Provider,
  type ThemeMode,
  type ToolCategory,
  type ZoneId,
} from "../shared/types.js";
import {
  computeCampusLayout,
  createAmenityFurniture,
  createCoworkFurniture,
  createDefaultBayFurniture,
  createDefaultBossOffice,
  createDefaultCommonWing,
  createExtraBayWorkstations,
  createHypersleepFurniture,
  DEFAULT_FLOOR_DEPTH,
  DEFAULT_FLOOR_WIDTH,
  FLOOR_EXPAND_STEP,
  getAmenityTheme,
  getRotatedFootprint,
  MAX_FLOOR_SIDE,
  MIN_FLOOR_SIDE,
  resolveWorldToZone,
  validateFurniturePlacement,
} from "./layout-engine.js";
import { exportOfficeLayout, prepareOfficeLayoutImport } from "./layout-transfer.js";
import type { OfficeStore } from "./store.js";

const BAY_ACCENT_PALETTE = [
  "#38bdf8",
  "#d97757",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#60a5fa",
  "#fb7185",
];

const STALE_ACTIVITY_TIMEOUT_MS = 120_000;
const SUBAGENT_TOMBSTONE_MS = 60_000;

function normalizeProjectPath(raw: string): string {
  const resolved = path.resolve(raw);
  return resolved.length > 1 && resolved.endsWith(path.sep) ? resolved.slice(0, -1) : resolved;
}

function classifyToolCategory(toolName?: string): ToolCategory {
  if (!toolName) return "code";
  const t = toolName.toLowerCase();
  if (
    t.includes("edit") ||
    t.includes("write") ||
    t.includes("notebook") ||
    t.includes("patch")
  ) {
    return "code";
  }
  if (t.includes("bash") || t.includes("command") || t.includes("exec") || t.includes("shell")) {
    return "shell";
  }
  if (
    t.includes("read") ||
    t.includes("grep") ||
    t.includes("glob") ||
    t.includes("search") ||
    t.includes("web") ||
    t.includes("lsp") ||
    t.includes("list") ||
    t.includes("find")
  ) {
    return "search";
  }
  return "code";
}

function isMeetingTool(toolName?: string): boolean {
  if (!toolName) return false;
  const t = toolName.toLowerCase();
  return t === "swarm" || t.includes("brainstorm") || t.includes("plan");
}

function isQuestionTool(toolName?: string): boolean {
  if (!toolName) return false;
  const t = toolName.toLowerCase();
  return t === "ask_question";
}

function isAssignTool(toolName?: string): boolean {
  if (!toolName) return false;
  const t = toolName.toLowerCase();
  return t === "agent" || t === "invoke_subagent" || t === "task";
}

const PROVIDER_LABEL: Record<Provider, string> = { claude: "Claude", gemini: "Gemini", codex: "Codex" };

export class OfficeEngine extends EventEmitter {
  private state: OfficeState;
  private campus: ComputedCampus;
  private readonly store: OfficeStore;
  private catalogById: Map<string, CatalogEntry>;
  private readonly now: () => number;
  private readonly restCooldownMs: number;
  private readonly assignDurationMs: number;
  private demoBackupState: OfficeState | null = null;
  private demoMode = false;
  private queuedRealEventsDuringDemo: AgentTelemetryEvent[] = [];
  private readonly stoppedSubagents = new Map<string, number>();
  private opQueue: Promise<unknown> = Promise.resolve();

  private runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.opQueue.then(fn, fn);
    this.opQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private assertNotDemoMode(): void {
    if (this.demoMode) {
      throw new Error("Cannot edit office layout while Demo Mode is active — stop Demo Mode first");
    }
  }

  constructor(opts: {
    store: OfficeStore;
    catalogById: Map<string, CatalogEntry>;
    now?: () => number;
    restCooldownMs?: number;
    assignDurationMs?: number;
  }) {
    super();
    this.store = opts.store;
    this.catalogById = new Map(opts.catalogById);
    this.now = opts.now ?? (() => Date.now());
    this.restCooldownMs = opts.restCooldownMs ?? 15_000;
    this.assignDurationMs = opts.assignDurationMs ?? 2_500;
    this.state = this.createFreshState();
    this.campus = this.computeLayoutForState(this.state);
  }

  private computeLayoutForState(state: OfficeState): ComputedCampus {
    const activeBayIds = new Set(state.bays.filter((b) => !b.archived).map((b) => b.id));
    const employeeCount = state.employees.filter((e) => activeBayIds.has(e.bayId)).length;
    return computeCampusLayout(
      state.bays,
      state.commonWings,
      this.catalogById,
      state.bossOffice,
      state.theme,
      state.tilePermissionOverrides,
      state.zoneOverrides,
      {
        employeeCount,
        floorWidthTiles: state.floorWidthTiles,
        floorDepthTiles: state.floorDepthTiles,
        floorTileOverrides: state.floorTileOverrides,
        customZones: state.customZones,
      },
    );
  }

  private createFreshState(): OfficeState {
    const ts = this.now();
    const starterBayId = "bay-0";
    return {
      version: 1,
      theme: "office",
      bossOffice: createDefaultBossOffice(),
      commonWings: [createDefaultCommonWing(0), createDefaultCommonWing(1)],
      bays: [
        {
          id: starterBayId,
          projectPath: null,
          displayName: "Starter Studio",
          accentColor: BAY_ACCENT_PALETTE[0],
          archived: false,
          deskSlots: 2,
          furniture: createDefaultBayFurniture(starterBayId),
          createdAt: ts,
          lastActiveAt: ts,
        },
      ],
      employees: [
        {
          id: "emp-starter-0",
          bayId: starterBayId,
          spriteId: "agent-starter",
          displayName: "Starter Dev",
          role: "Lead",
          isEphemeral: false,
          deskIndex: 0,
          visualState: "resting",
          toolCategory: "idle",
          detail: "Waiting for first project...",
          lastUpdatedAt: ts,
        },
      ],
      activityLog: [],
    };
  }

  async init(): Promise<void> {
    const loaded = await this.store.load();
    if (loaded && loaded.bays.length > 0) {
      // Remove any leftover ephemeral subagents from a previous crash
      loaded.employees = loaded.employees.filter((e) => !e.isEphemeral);
      // Missing or untouched Boss Office gets the current designed layout
      if (!loaded.bossOffice || loaded.bossOffice.furniture.every((f) => f.placedBy === "system")) {
        loaded.bossOffice = { ...createDefaultBossOffice(), displayName: loaded.bossOffice?.displayName ?? "BOSS OFFICE" };
      }
      for (const b of loaded.bays) {
        // Refresh untouched rooms so new default props reach existing saves.
        if (b.furniture.every((f) => f.placedBy === "system")) {
          const base = createDefaultBayFurniture(b.id);
          b.furniture = [...base, ...createExtraBayWorkstations(b.id, b.deskSlots, base)];
        }
      }
      for (const w of loaded.commonWings) {
        if (w.furniture.every((f) => f.placedBy === "system")) {
          w.furniture = createDefaultCommonWing(w.row).furniture;
        }
      }
      this.state = loaded;
    } else {
      this.state = this.createFreshState();
      await this.store.save(this.state);
    }
    this.ensureCommonWingsForActiveRows();
    this.recomputeCampus();
  }

  updateCatalog(catalog: CatalogEntry[]): void {
    this.catalogById = new Map(catalog.map((c) => [c.id, c]));
    this.recomputeCampus();
    this.emitSnapshot();
  }

  getCatalog(): CatalogEntry[] {
    return [...this.catalogById.values()];
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  async enterDemoMode(): Promise<void> {
    return this.runSerialized(async () => {
      if (this.demoMode) return;
      this.demoBackupState = structuredClone(this.state);
      this.queuedRealEventsDuringDemo = [];
      this.demoMode = true;
      this.state = this.createFreshState();
      this.recomputeCampus();
      this.emitSnapshot();
    });
  }

  async exitDemoMode(): Promise<void> {
    return this.runSerialized(async () => {
      if (!this.demoMode) return;
      this.demoMode = false;
      if (this.demoBackupState) {
        this.state = this.demoBackupState;
        this.demoBackupState = null;
      }
      this.ensureCommonWingsForActiveRows();
      this.recomputeCampus();
      const queued = this.queuedRealEventsDuringDemo.splice(0);
      for (const ev of queued) {
        await this.ingestEventUnlocked(ev);
      }
      this.emitSnapshot();
    });
  }

  getSnapshot(): OfficeSnapshotPayload {
    return {
      state: structuredClone(this.state),
      campus: structuredClone(this.campus),
      demoMode: this.demoMode,
    };
  }

  exportLayout(): OfficeLayoutFile {
    this.assertNotDemoMode();
    return exportOfficeLayout(this.state, this.campus);
  }

  async importLayout(value: unknown): Promise<OfficeSnapshotPayload> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const catalog = this.catalogById;
      const { state, campus } = prepareOfficeLayoutImport(
        value, this.state, this.campus, catalog, (next) => this.computeLayoutForState(next),
      );
      await this.store.save(state);
      this.state = state;
      this.campus = catalog === this.catalogById ? campus : this.computeLayoutForState(state);
      this.emitSnapshot();
      return this.getSnapshot();
    });
  }

  private recomputeCampus(): void {
    this.campus = this.computeLayoutForState(this.state);
  }

  private ensureCommonWingsForActiveRows(): void {
    // HQ & Hub zone always contains two lounges (common:0 and common:1)
    for (let idx = 0; idx < 2; idx++) {
      if (!this.state.commonWings.some((w) => w.row === idx)) {
        this.state.commonWings.push(createDefaultCommonWing(idx));
      }
    }
  }

  private async persist(): Promise<void> {
    if (this.demoMode) return;
    await this.store.save(this.state);
  }

  private emitSnapshot(): void {
    this.emit("snapshot", this.getSnapshot());
  }

  private providerBaseSprite(provider: Provider): string {
    return provider === "codex" ? "agent-starter" : `agent-${provider}`;
  }

  private providerVariantSprite(provider: Provider, variantIdx: number): string {
    const base = this.providerBaseSprite(provider);
    if (variantIdx <= 0 || provider === "codex") return base;
    return `${base}-v${((variantIdx - 1) % 3) + 1}`;
  }

  private getOrCreateBayForProject(
    projectPath: string,
    projectName: string | undefined,
    ts: number,
  ): { bay: ProjectBayRecord; expanded: boolean } {
    const existing = this.state.bays.find((b) => b.projectPath === projectPath);
    if (existing) {
      const wasArchived = existing.archived;
      existing.archived = false;
      existing.lastActiveAt = ts;
      if (wasArchived) {
        this.ensureCommonWingsForActiveRows();
      }
      return { bay: existing, expanded: wasArchived };
    }

    // Claim unclaimed Starter Bay 0 if available
    const starterBay = this.state.bays.find((b) => b.projectPath === null);
    const displayName = projectName?.trim() || path.basename(projectPath) || "Project";
    if (starterBay) {
      starterBay.projectPath = projectPath;
      starterBay.displayName = displayName;
      starterBay.accentColor = BAY_ACCENT_PALETTE[0];
      if (starterBay.furniture.every((f) => f.placedBy === "system")) {
        starterBay.furniture = createDefaultBayFurniture(starterBay.id);
      }
      starterBay.archived = false;
      starterBay.lastActiveAt = ts;
      return { bay: starterBay, expanded: false };
    }

    // Expand a brand-new project bay
    const nextIndex = this.state.bays.length;
    const bayId = `bay-${nextIndex}-${crypto.randomBytes(2).toString("hex")}`;
    const newBay: ProjectBayRecord = {
      id: bayId,
      projectPath,
      displayName,
      accentColor: BAY_ACCENT_PALETTE[nextIndex % BAY_ACCENT_PALETTE.length],
      archived: false,
      deskSlots: 2,
      furniture: createDefaultBayFurniture(bayId),
      createdAt: ts,
      lastActiveAt: ts,
    };
    this.state.bays.push(newBay);
    this.ensureCommonWingsForActiveRows();
    return { bay: newBay, expanded: true };
  }

  /** Desk in the project's own room — only persistent (lead) employees sit there. */
  private allocateDeskIndex(bayId: string): number {
    const used = new Set(
      this.state.employees.filter((e) => e.bayId === bayId && !e.isEphemeral).map((e) => e.deskIndex),
    );
    let idx = 0;
    while (used.has(idx)) idx++;
    return idx;
  }

  /** Hot-desk seat in the shared co-working room, unique across every project's subagents. */
  private allocateCoworkSeat(): number {
    const used = new Set(this.state.employees.filter((e) => e.isEphemeral).map((e) => e.deskIndex));
    let idx = 0;
    while (used.has(idx)) idx++;
    return idx;
  }

  private resolveOrSpawnEmployee(bay: ProjectBayRecord, ev: AgentTelemetryEvent, ts: number): EmployeeRecord | null {
    const bayEmployees = this.state.employees.filter((e) => e.bayId === bay.id);

    // Ephemeral subagent
    if (ev.agentId) {
      const subId = `sub:${bay.id}:${ev.provider}:${ev.agentId}`;
      const existingSub = this.state.employees.find((e) => e.id === subId);
      if (existingSub) {
        existingSub.sessionId = ev.sessionId;
        existingSub.lastUpdatedAt = ts;
        return existingSub;
      }
      if (
        ev.eventType === "subagent_stop" ||
        ev.eventType === "session_end" ||
        ev.eventType === "turn_stop" ||
        ev.eventType === "tool_end"
      ) {
        return null; // Idempotent ignore for unknown/already-cleaned subagent
      }
      // Prevent delayed async hook events from resurrecting a recently stopped subagent
      const stoppedAt = this.stoppedSubagents.get(subId);
      if (stoppedAt !== undefined && ts - stoppedAt < SUBAGENT_TOMBSTONE_MS && ev.eventType !== "subagent_start") {
        return null;
      }
      this.stoppedSubagents.delete(subId);

      const variantIdx = bayEmployees.filter((e) => e.provider === ev.provider).length;
      const emp: EmployeeRecord = {
        id: subId,
        bayId: bay.id,
        provider: ev.provider,
        spriteId: this.providerVariantSprite(ev.provider, Math.max(1, variantIdx)),
        // Name says which project it works for, since every project's subagents share the co-working room
        displayName: `${ev.agentRole
          ? `${PROVIDER_LABEL[ev.provider]} · ${ev.agentRole}`
          : `${PROVIDER_LABEL[ev.provider]} Sub`} @ ${bay.displayName}`.slice(0, 128),
        role: ev.agentRole ?? "Subagent",
        sessionId: ev.sessionId,
        agentId: ev.agentId,
        parentAgentId: ev.parentAgentId,
        isEphemeral: true,
        deskIndex: this.allocateCoworkSeat(),
        visualState: "assigning",
        toolCategory: "idle",
        lastUpdatedAt: ts,
      };
      // Subagents work from the shared co-working room, so the project's own room does not grow desks
      this.state.employees.push(emp);
      this.recomputeCampus();
      this.ensureHypersleepPodForNewEmployee();
      return emp;
    }

    // Bind unbound starter employee on first real project claim
    const unboundStarter = bayEmployees.find((e) => !e.provider && e.spriteId === "agent-starter");
    if (unboundStarter) {
      unboundStarter.provider = ev.provider;
      unboundStarter.spriteId = this.providerBaseSprite(ev.provider);
      unboundStarter.displayName = `${PROVIDER_LABEL[ev.provider]} Lead`;
      if (ev.agentRole) unboundStarter.role = ev.agentRole;
      unboundStarter.sessionId = ev.sessionId;
      unboundStarter.lastUpdatedAt = ts;
      return unboundStarter;
    }

    // Primary persistent employee for (bay, provider)
    const primary = bayEmployees.find((e) => !e.isEphemeral && e.provider === ev.provider);
    if (primary) {
      primary.sessionId = ev.sessionId;
      if (ev.agentRole) primary.role = ev.agentRole;
      primary.lastUpdatedAt = ts;
      return primary;
    }

    // Spawn persistent lead for this provider in this bay
    const emp: EmployeeRecord = {
      id: `emp:${bay.id}:${ev.provider}`,
      bayId: bay.id,
      provider: ev.provider,
      spriteId: this.providerBaseSprite(ev.provider),
      displayName: `${PROVIDER_LABEL[ev.provider]} Lead`,
      role: ev.agentRole ?? "Lead",
      sessionId: ev.sessionId,
      isEphemeral: false,
      deskIndex: this.allocateDeskIndex(bay.id),
      visualState: "assigning",
      toolCategory: "idle",
      lastUpdatedAt: ts,
    };
    this.state.employees.push(emp);
    this.recomputeCampus();
    this.ensureHypersleepPodForNewEmployee();
    this.ensureBayDesksForTeam(bay);
    return emp;
  }

  /**
   * When the user has customized hypersleep:0 (moved/rotated pods) or defined a custom hypersleep zone,
   * keep auto-spawning 1 new capsule whenever a new agent joins and total capsules on campus are fewer
   * than the active employee count.
   */
  private ensureHypersleepPodForNewEmployee(): void {
    const customPods = this.state.zoneOverrides?.["hypersleep:0"];
    const customHsZones = (this.state.customZones ?? []).filter((z) => z.role === "hypersleep");
    if (!customPods && customHsZones.length === 0) return;
    const activeBayIds = new Set(this.state.bays.filter((b) => !b.archived).map((b) => b.id));
    const empCount = this.state.employees.filter((e) => activeBayIds.has(e.bayId)).length;
    const totalPods = this.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule").length;
    if (totalPods >= empCount) return;

    const hsZone = this.campus.zones.find((z) => z.zoneId === "hypersleep:0");
    const floorZone = this.campus.zones.find((z) => z.zoneId === "floor:0");
    if (!hsZone && !floorZone) return;

    const occupied = new Set<string>();
    for (const wf of this.campus.worldFurniture) {
      const cat = this.catalogById.get(wf.assetId);
      if (isTabletopAsset(wf.assetId, wf.layer, cat)) continue;
      if (wf.assetId.startsWith("divider-")) continue;
      for (let dy = 0; dy < wf.footprintTiles[1]; dy++) {
        for (let dx = 0; dx < wf.footprintTiles[0]; dx++) {
          occupied.add(`${wf.tx + dx},${wf.ty + dy}`);
        }
      }
    }

    const podId = `hypersleep:0-pod-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;

    // 1. Prefer user-defined custom hypersleep zone(s) first
    if (customHsZones.length > 0 && floorZone) {
      const floorList = this.getZoneFurnitureArray("floor:0");
      if (floorList) {
        for (const cz of customHsZones) {
          for (const stepY of [3, 2]) {
            for (let ly = 0; ly + 2 <= cz.height; ly += stepY) {
              for (let lx = 0; lx < cz.width; lx++) {
                const wx = cz.x + lx;
                const wy = cz.y + ly;
                if (!occupied.has(`${wx},${wy}`) && !occupied.has(`${wx},${wy + 1}`)) {
                  floorList.push({
                    id: podId,
                    zoneId: "floor:0",
                    lx: wx,
                    ly: wy,
                    assetId: "hypersleep-capsule",
                    direction: "se",
                    layer: "object",
                    placedBy: "system",
                  });
                  this.recomputeCampus();
                  return;
                }
              }
            }
          }
        }
      }
    }

    // 2. Fallback to built-in hypersleep:0 bounds
    if (hsZone && customPods) {
      for (let ly = 0; ly + 2 <= hsZone.height; ly += 3) {
        for (let lx = 0; lx < hsZone.width; lx++) {
          const wx = hsZone.originX + lx;
          const wy = hsZone.originY + ly;
          if (!occupied.has(`${wx},${wy}`) && !occupied.has(`${wx},${wy + 1}`)) {
            customPods.push({
              id: podId,
              zoneId: "hypersleep:0",
              lx,
              ly,
              assetId: "hypersleep-capsule",
              direction: "se",
              layer: "object",
              placedBy: "system",
            });
            this.recomputeCampus();
            return;
          }
        }
      }
    }

    // 3. Fallback to open floor
    if (floorZone) {
      const floorList = this.getZoneFurnitureArray("floor:0");
      if (!floorList) return;
      for (let y = 1; y + 2 <= floorZone.height; y += 3) {
        for (let x = 1; x < floorZone.width - 1; x++) {
          if (!occupied.has(`${x},${y}`) && !occupied.has(`${x},${y + 1}`)) {
            floorList.push({
              id: podId,
              zoneId: "floor:0",
              lx: x,
              ly: y,
              assetId: "hypersleep-capsule",
              direction: "se",
              layer: "object",
              placedBy: "system",
            });
            this.recomputeCampus();
            return;
          }
        }
      }
    }
  }

  private ensureBayDesksForTeam(bay: ProjectBayRecord): void {
    const teamSize = this.state.employees.filter((e) => e.bayId === bay.id && !e.isEphemeral).length;
    const desired = Math.min(4, Math.max(bay.deskSlots, teamSize));
    if (desired > bay.deskSlots) {
      bay.deskSlots = desired;
      const added = createExtraBayWorkstations(
        bay.id,
        desired,
        bay.furniture,
      );
      for (const f of added) {
        // Only add if spot is currently free (respects user/Gemini custom furniture!)
        const check = validateFurniturePlacement(this.campus, bay.furniture, f, this.catalogById);
        if (check.ok) bay.furniture.push(f);
      }
    }
  }

  private reconcileBayTeamwork(bayId: string): void {
    const members = this.state.employees.filter((e) => e.bayId === bayId);
    const activeWorkers = members.filter(
      (e) => e.visualState === "working" || e.visualState === "teamwork",
    );
    if (activeWorkers.length >= 2) {
      for (const w of activeWorkers) {
        w.visualState = "teamwork";
      }
    } else if (activeWorkers.length === 1 && activeWorkers[0].visualState === "teamwork") {
      activeWorkers[0].visualState = "working";
    }
  }

  async ingestEvent(raw: AgentTelemetryEvent): Promise<void> {
    return this.runSerialized(async () => {
      const ev = AgentTelemetryEventSchema.parse(raw);
      // Queue real telemetry during Demo Mode so it is never lost when exiting demo
      if (this.demoMode && ev.source !== "simulator") {
        this.queuedRealEventsDuringDemo.push(ev);
        return;
      }
      await this.ingestEventUnlocked(ev);
    });
  }

  private async ingestEventUnlocked(ev: AgentTelemetryEvent): Promise<void> {
    const ts = ev.timestamp ?? this.now();
    const normalizedPath = normalizeProjectPath(ev.projectPath);

    // Do not create or claim a bay for closing/orphan events referencing an unknown project
    const existingBayForPath = this.state.bays.find((b) => b.projectPath === normalizedPath);
    if (
      !existingBayForPath &&
      (ev.eventType === "subagent_stop" ||
        ev.eventType === "session_end" ||
        ev.eventType === "turn_stop" ||
        ev.eventType === "tool_end")
    ) {
      return;
    }

    // Handle subagent_stop cleanly with tombstone to prevent delayed async hook resurrection
    if (ev.eventType === "subagent_stop" && ev.agentId && existingBayForPath) {
      const subId = `sub:${existingBayForPath.id}:${ev.provider}:${ev.agentId}`;
      this.stoppedSubagents.set(subId, ts);
      const idx = this.state.employees.findIndex((e) => e.id === subId);
      if (idx !== -1) {
        this.state.employees.splice(idx, 1);
        this.reconcileBayTeamwork(existingBayForPath.id);
        this.recomputeCampus();
        await this.persist();
        this.emitSnapshot();
      }
      return;
    }

    const { bay, expanded } = this.getOrCreateBayForProject(normalizedPath, ev.projectName, ts);
    if (expanded) this.recomputeCampus();
    const emp = this.resolveOrSpawnEmployee(bay, ev, ts);
    if (!emp) return;

    emp.lastUpdatedAt = ts;
    if (ev.detail) emp.detail = ev.detail;
    if (ev.toolName) emp.toolName = ev.toolName;

    switch (ev.eventType) {
      case "session_start": {
        emp.restAt = undefined;
        if (emp.visualState === "resting") {
          emp.visualState = "assigning";
          emp.assignUntil = ts + this.assignDurationMs;
          emp.detail = ev.detail ?? "Clocking in";
        }
        break;
      }
      case "prompt_submit": {
        emp.restAt = undefined;
        emp.visualState = "assigning";
        emp.assignUntil = ts + this.assignDurationMs;
        emp.toolCategory = "idle";
        emp.detail = ev.detail ?? "New task assigned";
        break;
      }
      case "subagent_start": {
        emp.restAt = undefined;
        emp.visualState = "assigning";
        emp.assignUntil = ts + this.assignDurationMs;
        emp.detail = ev.detail ?? `Joined ${bay.displayName}`;
        // Lead also briefly shows assigning animation
        const lead = this.state.employees.find(
          (e) => e.bayId === bay.id && !e.isEphemeral && e.provider === ev.provider,
        );
        if (lead && lead.id !== emp.id) {
          lead.visualState = "assigning";
          lead.assignUntil = ts + this.assignDurationMs;
          lead.detail = `Delegating to ${emp.role}`;
          lead.restAt = undefined;
        }
        break;
      }
      case "tool_start": {
        emp.restAt = undefined;
        emp.assignUntil = undefined;
        emp.reportReason = undefined;
        if (isQuestionTool(ev.toolName)) {
          emp.visualState = "reporting";
          emp.reportReason = "question";
          emp.toolCategory = "idle";
          emp.detail = ev.detail ?? "Has a question for Boss";
        } else if (isMeetingTool(ev.toolName)) {
          emp.visualState = "meeting";
          emp.toolCategory = "search";
          emp.detail = ev.detail ?? `Discussing (${ev.toolName})`;
        } else if (isAssignTool(ev.toolName)) {
          emp.visualState = "assigning";
          emp.assignUntil = ts + this.assignDurationMs;
          emp.detail = ev.detail ?? `Delegating (${ev.toolName})`;
        } else {
          emp.visualState = "working";
          emp.toolCategory = classifyToolCategory(ev.toolName);
          emp.detail = ev.detail ?? `Running ${ev.toolName ?? "tool"}`;
          // If a subagent starts working after handoff, finish the delegating lead's assigning animation
          if (emp.isEphemeral) {
            const lead = this.state.employees.find(
              (e) =>
                e.bayId === bay.id &&
                !e.isEphemeral &&
                e.provider === ev.provider &&
                e.visualState === "assigning",
            );
            if (lead) {
              lead.visualState = "working";
              lead.assignUntil = undefined;
            }
          }
        }
        break;
      }
      case "tool_end": {
        if (emp.visualState === "working" || emp.visualState === "teamwork") {
          emp.toolName = undefined;
          emp.detail = ev.detail ?? "Thinking...";
        }
        break;
      }
      case "tool_error": {
        emp.restAt = undefined;
        emp.reportReason = undefined;
        emp.visualState = "working";
        emp.toolCategory = "error";
        emp.errorUntil = ts + 4_000;
        emp.detail = ev.detail ?? `${ev.toolName ?? "Tool"} failed`;
        break;
      }
      case "waiting_user": {
        emp.restAt = undefined;
        emp.assignUntil = undefined;
        emp.visualState = "reporting";
        emp.reportReason = "question";
        emp.toolCategory = "idle";
        emp.detail = ev.detail ?? "Question for Boss";
        break;
      }
      case "turn_stop":
      case "session_end": {
        if (emp.isEphemeral) {
          this.stoppedSubagents.set(emp.id, ts);
          this.state.employees = this.state.employees.filter((e) => e.id !== emp.id);
        } else {
          emp.assignUntil = undefined;
          emp.visualState = "reporting";
          emp.reportReason = "result";
          emp.restAt = ts + this.restCooldownMs;
          emp.detail = ev.detail ?? "Reporting results to Boss";
          // Also clean up ephemeral subagents belonging to this parent session (e.g., Antigravity subagents)
          for (const sub of this.state.employees) {
            if (sub.isEphemeral && sub.bayId === bay.id && sub.sessionId === ev.sessionId) {
              this.stoppedSubagents.set(sub.id, ts);
            }
          }
          this.state.employees = this.state.employees.filter(
            (e) => !(e.isEphemeral && e.bayId === bay.id && e.sessionId === ev.sessionId),
          );
        }
        break;
      }
    }

    this.reconcileBayTeamwork(bay.id);

    const logEntry: ActivityLogEntry = {
      id: `act-${ts}-${crypto.randomBytes(3).toString("hex")}`,
      timestamp: ts,
      bayId: bay.id,
      employeeId: emp.id,
      provider: ev.provider,
      eventType: ev.eventType,
      toolName: ev.toolName,
      detail: emp.detail,
    };
    this.state.activityLog.unshift(logEntry);
    if (this.state.activityLog.length > 100) {
      this.state.activityLog.length = 100;
    }

    this.recomputeCampus();
    await this.persist();
    if (expanded) {
      this.emit("bay_expanded", { bayId: bay.id, displayName: bay.displayName });
    }
    this.emit("activity", logEntry);
    this.emitSnapshot();
  }

  async tick(): Promise<void> {
    return this.runSerialized(async () => {
      const ts = this.now();
      for (const [id, stoppedAt] of [...this.stoppedSubagents.entries()]) {
        if (ts - stoppedAt >= SUBAGENT_TOMBSTONE_MS) this.stoppedSubagents.delete(id);
      }
      let changed = false;
      const touchedBays = new Set<string>();

      for (const emp of this.state.employees) {
        if (emp.assignUntil && ts >= emp.assignUntil && emp.visualState === "assigning") {
          emp.assignUntil = undefined;
          emp.visualState = "working";
          emp.toolCategory = emp.toolCategory === "idle" ? "code" : emp.toolCategory;
          if (!emp.toolName) {
            emp.detail = "Thinking...";
          }
          touchedBays.add(emp.bayId);
          changed = true;
        }
        if (emp.errorUntil && ts >= emp.errorUntil && emp.toolCategory === "error") {
          emp.errorUntil = undefined;
          emp.toolCategory = "code";
          changed = true;
        }
        if (emp.restAt && ts >= emp.restAt && emp.visualState !== "resting") {
          emp.restAt = undefined;
          emp.visualState = "resting";
          emp.toolCategory = "idle";
          emp.detail = "Taking a break";
          touchedBays.add(emp.bayId);
          changed = true;
        }
        // Guard against stale zombie sessions where no stop hook ever arrived
        if (
          emp.visualState !== "resting" &&
          !emp.restAt &&
          ts - emp.lastUpdatedAt >= STALE_ACTIVITY_TIMEOUT_MS
        ) {
          if (emp.isEphemeral) {
            emp.restAt = ts; // cleaned below
          } else {
            emp.visualState = "resting";
            emp.toolCategory = "idle";
            emp.detail = "Idle — taking a break";
            touchedBays.add(emp.bayId);
            changed = true;
          }
        }
      }

      const beforeLen = this.state.employees.length;
      this.state.employees = this.state.employees.filter(
        (e) => !(e.isEphemeral && ts - e.lastUpdatedAt >= STALE_ACTIVITY_TIMEOUT_MS),
      );
      if (this.state.employees.length !== beforeLen) {
        changed = true;
        for (const b of this.state.bays) touchedBays.add(b.id);
      }

      for (const bayId of touchedBays) {
        this.reconcileBayTeamwork(bayId);
      }

      if (changed) {
        this.recomputeCampus();
        await this.persist();
        this.emitSnapshot();
      }
    });
  }

  private getZoneFurnitureArray(zoneId: ZoneId): FurnitureInstance[] | null {
    if (zoneId === "boss:0") {
      if (!this.state.bossOffice) this.state.bossOffice = createDefaultBossOffice();
      return this.state.bossOffice.furniture;
    }
    if (zoneId.startsWith("common:")) {
      const wing = this.state.commonWings.find((w) => w.zoneId === zoneId);
      return wing ? wing.furniture : null;
    }
    if (zoneId.startsWith("bay:")) {
      const bayId = zoneId.slice(4);
      const bay = this.state.bays.find((b) => b.id === bayId);
      return bay ? bay.furniture : null;
    }
    if (zoneId === "floor:0") {
      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      if (!this.state.zoneOverrides[zoneId]) {
        this.state.zoneOverrides[zoneId] = [];
      }
      return this.state.zoneOverrides[zoneId];
    }
    if (zoneId === "cowork:0") {
      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      if (!this.state.zoneOverrides[zoneId]) {
        this.state.zoneOverrides[zoneId] = createCoworkFurniture();
      }
      return this.state.zoneOverrides[zoneId];
    }
    if (zoneId === "hypersleep:0") {
      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      if (!this.state.zoneOverrides[zoneId]) {
        const hsZone = this.campus.zones.find((z) => z.zoneId === "hypersleep:0");
        const existing = this.campus.worldFurniture
          .filter((f) => f.zoneId === "hypersleep:0")
          .map((f): FurnitureInstance => ({
            id: f.id,
            zoneId: "hypersleep:0",
            lx: f.lx,
            ly: f.ly,
            assetId: f.assetId,
            direction: f.direction,
            layer: f.layer,
            ...(f.renderLayer !== undefined ? { renderLayer: f.renderLayer } : {}),
            ...(f.surfaceHostId ? { surfaceHostId: f.surfaceHostId } : {}),
            placedBy: f.placedBy,
          }));
        this.state.zoneOverrides[zoneId] =
          existing.length > 0
            ? existing
            : createHypersleepFurniture(Math.max(1, this.state.employees.length), hsZone?.width ?? 10);
      }
      return this.state.zoneOverrides[zoneId];
    }
    if (zoneId.startsWith("amenity:")) {
      const idx = Number(zoneId.slice("amenity:".length));
      const exists = this.campus.zones.some((z) => z.zoneId === zoneId);
      if (!exists || !Number.isInteger(idx) || idx < 0) return null;
      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      if (!this.state.zoneOverrides[zoneId]) {
        const zone = this.campus.zones.find((z) => z.zoneId === zoneId);
        this.state.zoneOverrides[zoneId] = createAmenityFurniture(idx, zone?.amenityTheme ?? getAmenityTheme(idx));
      }
      return this.state.zoneOverrides[zoneId];
    }
    return null;
  }

  private resolveTargetZoneCoord(input: {
    zoneId?: string;
    lx?: number;
    ly?: number;
    tx?: number;
    ty?: number;
  }): { zoneId: ZoneId; lx: number; ly: number } {
    if (input.zoneId !== undefined && input.lx !== undefined && input.ly !== undefined) {
      return { zoneId: input.zoneId as ZoneId, lx: input.lx, ly: input.ly };
    }
    if (input.tx !== undefined && input.ty !== undefined) {
      const resolved = resolveWorldToZone(this.campus, input.tx, input.ty);
      if (!resolved) {
        throw new Error(`World tile (${input.tx}, ${input.ty}) is outside any placeable zone (corridor or out of bounds)`);
      }
      return resolved;
    }
    throw new Error("Must provide either (zoneId, lx, ly) or world (tx, ty)");
  }

  async placeFurniture(input: {
    zoneId?: string;
    tx?: number;
    manualPosition?: boolean;
    ty?: number;
    lx?: number;
    ly?: number;
    assetId: string;
    direction: Direction;
    placedBy: "user" | "gemini";
  }): Promise<FurnitureInstance> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const { zoneId, lx, ly } = this.resolveTargetZoneCoord(input);
      const list = this.getZoneFurnitureArray(zoneId);
      if (!list) throw new Error(`Unknown zone "${zoneId}"`);

      const check = validateFurniturePlacement(
        this.campus,
        list,
        { zoneId, lx, ly, assetId: input.assetId, direction: input.direction },
        this.catalogById,
      );
      if (!check.ok) throw new Error(check.reason);

      const cat = this.catalogById.get(input.assetId)!;
      const isTop = isTabletopAsset(input.assetId, cat.layer, cat);
      let surfaceHostId: string | undefined;
      if (isTop) {
        const host = list.find((item) => {
          const itemCat = this.catalogById.get(item.assetId);
          if (isTabletopAsset(item.assetId, item.layer, itemCat)) return false;
          if (!isSurfaceHostAsset(item.assetId, itemCat)) return false;
          const [iw, id] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], item.direction);
          return lx >= item.lx && lx < item.lx + iw && ly >= item.ly && ly < item.ly + id;
        });
        surfaceHostId = host?.id;
      }
      const instance: FurnitureInstance = {
        id: `furn-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        zoneId,
        lx,
        ly,
        assetId: input.assetId,
        direction: input.direction,
        layer: isTop ? "tabletop" : cat.layer,
        ...(surfaceHostId ? { surfaceHostId } : {}),
        placedBy: input.placedBy,
        ...(input.manualPosition !== undefined ? { manualPosition: input.manualPosition } : {}),
      };
      list.push(instance);
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return instance;
    });
  }

  async moveFurniture(
    instanceId: string,
    input: {
      zoneId?: string;
      tx?: number;
    manualPosition?: boolean;
      ty?: number;
      lx?: number;
      ly?: number;
      direction?: Direction;
      renderLayer?: RenderLayer;
    },
  ): Promise<FurnitureInstance> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const found = this.findFurnitureById(instanceId);
      if (!found) throw new Error(`Furniture instance "${instanceId}" not found`);

      const targetCoord =
        input.zoneId !== undefined || input.tx !== undefined
          ? this.resolveTargetZoneCoord(input)
          : { zoneId: found.item.zoneId, lx: input.lx ?? found.item.lx, ly: input.ly ?? found.item.ly };
      const nextDir = input.direction ?? found.item.direction;

      const targetList = this.getZoneFurnitureArray(targetCoord.zoneId);
      if (!targetList) throw new Error(`Unknown zone "${targetCoord.zoneId}"`);

      const check = validateFurniturePlacement(
        this.campus,
        targetList,
        {
          zoneId: targetCoord.zoneId,
          lx: targetCoord.lx,
          ly: targetCoord.ly,
          assetId: found.item.assetId,
          direction: nextDir,
          ignoreInstanceId: instanceId,
        },
        this.catalogById,
      );
      if (!check.ok) throw new Error(check.reason);

      const oldLx = found.item.lx;
      const oldLy = found.item.ly;
      const oldDir = found.item.direction;
      const itemCat = this.catalogById.get(found.item.assetId);
      const isMovingTabletop = isTabletopAsset(found.item.assetId, found.item.layer, itemCat);
      const isMovingHost = !isMovingTabletop && isSurfaceHostAsset(found.item.assetId, itemCat);

      // Collect hosted tabletop props sitting on this desk/table before moving it
      const hostedProps: Array<{ item: FurnitureInstance; relX: number; relY: number }> = [];
      if (isMovingHost) {
        const [oldW, oldD] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], oldDir);
        for (const other of found.list) {
          if (other.id === found.item.id) continue;
          const otherCat = this.catalogById.get(other.assetId);
          if (!isTabletopAsset(other.assetId, other.layer, otherCat)) continue;
          const onFootprint =
            other.lx >= oldLx && other.lx < oldLx + oldW && other.ly >= oldLy && other.ly < oldLy + oldD;
          if (other.surfaceHostId === found.item.id || onFootprint) {
            hostedProps.push({ item: other, relX: other.lx - oldLx, relY: other.ly - oldLy });
          }
        }
      }

      if (found.list !== targetList) {
        found.list.splice(found.index, 1);
        targetList.push(found.item);
      }
      found.item.zoneId = targetCoord.zoneId;
      found.item.lx = targetCoord.lx;
      found.item.ly = targetCoord.ly;
      found.item.direction = nextDir;
      if (input.manualPosition !== undefined) found.item.manualPosition = input.manualPosition;
      if (input.renderLayer !== undefined) {
        found.item.renderLayer = input.renderLayer;
      }

      // If moving a tabletop prop, update its surfaceHostId to the new host desk underneath
      if (isMovingTabletop) {
        const newHost = targetList.find((other) => {
          if (other.id === found.item.id) return false;
          const otherCat = this.catalogById.get(other.assetId);
          if (isTabletopAsset(other.assetId, other.layer, otherCat)) return false;
          if (!isSurfaceHostAsset(other.assetId, otherCat)) return false;
          const [ow, od] = getRotatedFootprint(otherCat?.footprintTiles ?? [1, 1], other.direction);
          return (
            targetCoord.lx >= other.lx &&
            targetCoord.lx < other.lx + ow &&
            targetCoord.ly >= other.ly &&
            targetCoord.ly < other.ly + od
          );
        });
        found.item.surfaceHostId = newHost?.id;
      }

      // Carry hosted tabletop props along with their host surface (remapped cleanly inside new rotated footprint)
      if (hostedProps.length > 0) {
        const [newW, newD] = getRotatedFootprint(itemCat?.footprintTiles ?? [1, 1], nextDir);
        const usedSlots = new Set<string>();
        for (const hp of hostedProps) {
          let nx = targetCoord.lx + Math.min(Math.max(0, hp.relX), newW - 1);
          let ny = targetCoord.ly + Math.min(Math.max(0, hp.relY), newD - 1);
          if (usedSlots.has(`${nx},${ny}`)) {
            // Find first unused slot on the host's new footprint
            for (let dy = 0; dy < newD; dy++) {
              for (let dx = 0; dx < newW; dx++) {
                const cx = targetCoord.lx + dx;
                const cy = targetCoord.ly + dy;
                if (!usedSlots.has(`${cx},${cy}`)) {
                  nx = cx;
                  ny = cy;
                  break;
                }
              }
            }
          }
          usedSlots.add(`${nx},${ny}`);
          if (found.list !== targetList) {
            const idx = found.list.indexOf(hp.item);
            if (idx !== -1) found.list.splice(idx, 1);
            targetList.push(hp.item);
          }
          hp.item.zoneId = targetCoord.zoneId;
          hp.item.lx = nx;
          hp.item.ly = ny;
          hp.item.surfaceHostId = found.item.id;
        }
      }

      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(found.item);
    });
  }

  async setTilePermissionOverride(
    tx: number,
    ty: number,
    permission: TilePermission | null,
  ): Promise<Record<string, TilePermission>> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      if (
        !Number.isInteger(tx) ||
        !Number.isInteger(ty) ||
        tx < 0 ||
        ty < 0 ||
        tx >= this.campus.widthTiles ||
        ty >= this.campus.depthTiles
      ) {
        throw new Error(
          `Tile (${tx}, ${ty}) is outside campus bounds (${this.campus.widthTiles}x${this.campus.depthTiles})`,
        );
      }
      const key = toTileKey(tx, ty);
      const next: Record<string, TilePermission> = { ...(this.state.tilePermissionOverrides ?? {}) };
      if (permission === null) {
        delete next[key];
      } else {
        next[key] = permission;
      }
      this.state.tilePermissionOverrides = Object.keys(next).length > 0 ? next : undefined;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(this.state.tilePermissionOverrides ?? {});
    });
  }

  async clearTilePermissionOverrides(): Promise<void> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      this.state.tilePermissionOverrides = undefined;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
    });
  }

  /** Paint one or more floor tiles with a `floor-*` asset (or pass `assetId: null` to restore default). */
  async setFloorTiles(
    tiles: Array<{ tx: number; ty: number; assetId: string | null }>,
  ): Promise<Record<string, string>> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const next: Record<string, string> = { ...(this.state.floorTileOverrides ?? {}) };
      for (const t of tiles) {
        if (
          !Number.isInteger(t.tx) ||
          !Number.isInteger(t.ty) ||
          t.tx < 0 ||
          t.ty < 0 ||
          t.tx >= this.campus.widthTiles ||
          t.ty >= this.campus.depthTiles
        ) {
          throw new Error(
            `Tile (${t.tx}, ${t.ty}) is outside campus bounds (${this.campus.widthTiles}x${this.campus.depthTiles})`,
          );
        }
        const key = toTileKey(t.tx, t.ty);
        if (t.assetId === null) {
          delete next[key];
        } else {
          const cat = this.catalogById.get(t.assetId);
          if (!cat || cat.layer !== "floor") {
            throw new Error(`Asset "${t.assetId}" is not a valid floor tile`);
          }
          next[key] = t.assetId;
        }
      }
      this.state.floorTileOverrides = Object.keys(next).length > 0 ? next : undefined;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(this.state.floorTileOverrides ?? {});
    });
  }

  async clearFloorTileOverrides(): Promise<void> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      this.state.floorTileOverrides = undefined;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
    });
  }

  async removeFurniture(instanceId: string): Promise<void> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const found = this.findFurnitureById(instanceId);
      if (!found) throw new Error(`Furniture instance "${instanceId}" not found`);
      const removed = found.item;
      const removedCat = this.catalogById.get(removed.assetId);
      const wasHost =
        !isTabletopAsset(removed.assetId, removed.layer, removedCat) &&
        isSurfaceHostAsset(removed.assetId, removedCat);
      found.list.splice(found.index, 1);

      // Remove hosted tabletop props sitting on a deleted desk/table so nothing floats in mid-air
      if (wasHost) {
        const [rw, rd] = getRotatedFootprint(removedCat?.footprintTiles ?? [1, 1], removed.direction);
        for (let i = found.list.length - 1; i >= 0; i--) {
          const other = found.list[i];
          const otherCat = this.catalogById.get(other.assetId);
          if (!isTabletopAsset(other.assetId, other.layer, otherCat)) continue;
          const onFootprint =
            other.lx >= removed.lx &&
            other.lx < removed.lx + rw &&
            other.ly >= removed.ly &&
            other.ly < removed.ly + rd;
          if (other.surfaceHostId === removed.id || onFootprint) {
            found.list.splice(i, 1);
          }
        }
      }

      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
    });
  }

  private findFurnitureById(
    instanceId: string,
  ): { item: FurnitureInstance; list: FurnitureInstance[]; index: number } | null {
    if (this.state.bossOffice) {
      const idx = this.state.bossOffice.furniture.findIndex((f) => f.id === instanceId);
      if (idx !== -1) {
        return { item: this.state.bossOffice.furniture[idx], list: this.state.bossOffice.furniture, index: idx };
      }
    }
    for (const w of this.state.commonWings) {
      const idx = w.furniture.findIndex((f) => f.id === instanceId);
      if (idx !== -1) return { item: w.furniture[idx], list: w.furniture, index: idx };
    }
    for (const b of this.state.bays) {
      const idx = b.furniture.findIndex((f) => f.id === instanceId);
      if (idx !== -1) return { item: b.furniture[idx], list: b.furniture, index: idx };
    }
    if (this.state.zoneOverrides) {
      for (const list of Object.values(this.state.zoneOverrides)) {
        const idx = list.findIndex((f) => f.id === instanceId);
        if (idx !== -1) return { item: list[idx], list, index: idx };
      }
    }
    // Lazily materialize cowork / hypersleep / amenity zones into state.zoneOverrides when editing one of their default items
    const worldHit = this.campus.worldFurniture.find((f) => f.id === instanceId);
    if (
      worldHit &&
      (worldHit.zoneId === "cowork:0" || worldHit.zoneId === "hypersleep:0" || worldHit.zoneId.startsWith("amenity:"))
    ) {
      const list = this.getZoneFurnitureArray(worldHit.zoneId);
      if (list) {
        const idx = list.findIndex((f) => f.id === instanceId);
        if (idx !== -1) return { item: list[idx], list, index: idx };
      }
    }
    return null;
  }

  async manageBay(
    bayId: string,
    patch: { displayName?: string; accentColor?: string; archived?: boolean; department?: DepartmentId },
  ): Promise<ProjectBayRecord> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const bay = this.state.bays.find((b) => b.id === bayId);
      if (!bay) throw new Error(`Bay "${bayId}" not found`);
      if (patch.displayName !== undefined) bay.displayName = patch.displayName.slice(0, 128);
      if (patch.accentColor !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(patch.accentColor)) {
          throw new Error(`Invalid hex color "${patch.accentColor}"`);
        }
        bay.accentColor = patch.accentColor;
      }
      if (patch.archived !== undefined) {
        bay.archived = patch.archived;
        if (!patch.archived) {
          this.ensureCommonWingsForActiveRows();
        }
      }
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(bay);
    });
  }

  async resizeFloor(input?: {
    deltaWidth?: number;
    deltaDepth?: number;
    widthTiles?: number;
    depthTiles?: number;
  }): Promise<{ widthTiles: number; depthTiles: number }> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const curW = this.campus.widthTiles;
      const curD = this.campus.depthTiles;

      const rawNextW =
        input?.widthTiles !== undefined
          ? Math.round(input.widthTiles)
          : curW + Math.round(input?.deltaWidth ?? 0);
      const rawNextD =
        input?.depthTiles !== undefined
          ? Math.round(input.depthTiles)
          : curD + Math.round(input?.deltaDepth ?? 0);

      let nextW = Math.max(MIN_FLOOR_SIDE, Math.min(MAX_FLOOR_SIDE, rawNextW));
      let nextD = Math.max(MIN_FLOOR_SIDE, Math.min(MAX_FLOOR_SIDE, rawNextD));

      const shrinkingW = nextW < curW;
      const shrinkingD = nextD < curD;

      if (shrinkingW || shrinkingD) {
        let minOccupiedW = MIN_FLOOR_SIDE;
        let minOccupiedD = MIN_FLOOR_SIDE;
        let blockerW: string | null = null;
        let blockerD: string | null = null;

        const hasCustomHypersleep = this.state.zoneOverrides?.["hypersleep:0"] !== undefined;
        for (const wf of this.campus.worldFurniture) {
          if (!hasCustomHypersleep && wf.zoneId === "hypersleep:0") continue;
          const endX = Math.ceil(wf.tx + wf.footprintTiles[0]);
          const endY = Math.ceil(wf.ty + wf.footprintTiles[1]);
          if (endX > minOccupiedW) {
            minOccupiedW = endX;
            blockerW = `${wf.assetId} (${wf.tx},${wf.ty})`;
          }
          if (endY > minOccupiedD) {
            minOccupiedD = endY;
            blockerD = `${wf.assetId} (${wf.tx},${wf.ty})`;
          }
        }
        for (const cz of this.state.customZones ?? []) {
          const endX = cz.x + cz.width;
          const endY = cz.y + cz.height;
          if (endX > minOccupiedW) {
            minOccupiedW = endX;
            blockerW = `zone "${cz.name}"`;
          }
          if (endY > minOccupiedD) {
            minOccupiedD = endY;
            blockerD = `zone "${cz.name}"`;
          }
        }

        if (shrinkingW && nextW < minOccupiedW) {
          if (curW <= minOccupiedW) {
            throw new Error(`ลดความกว้างไม่ได้แล้ว (ติด ${blockerW ?? "เฟอร์นิเจอร์"} ที่ขอบ x=${minOccupiedW})`);
          }
          nextW = minOccupiedW;
        }
        if (shrinkingD && nextD < minOccupiedD) {
          if (curD <= minOccupiedD) {
            throw new Error(`ลดความลึกไม่ได้แล้ว (ติด ${blockerD ?? "เฟอร์นิเจอร์"} ที่ขอบ y=${minOccupiedD})`);
          }
          nextD = minOccupiedD;
        }
      }

      const prevW = this.state.floorWidthTiles;
      const prevD = this.state.floorDepthTiles;
      this.state.floorWidthTiles = nextW;
      this.state.floorDepthTiles = nextD;
      this.recomputeCampus();

      if ((shrinkingW || shrinkingD) && this.campus.widthTiles >= curW && this.campus.depthTiles >= curD) {
        this.state.floorWidthTiles = prevW;
        this.state.floorDepthTiles = prevD;
        this.recomputeCampus();
        throw new Error(
          `ลดขนาดพื้นไม่ได้แล้ว — ขอบต่ำสุดตอนนี้คือ ${this.campus.widthTiles}×${this.campus.depthTiles} (ย้าย/ลบของที่ชิดขอบก่อนลดเพิ่ม)`,
        );
      }

      if (this.state.floorTileOverrides) {
        const kept: Record<string, string> = {};
        for (const [k, v] of Object.entries(this.state.floorTileOverrides)) {
          const [tx, ty] = k.split(",").map(Number);
          if (tx >= 0 && ty >= 0 && tx < this.campus.widthTiles && ty < this.campus.depthTiles) {
            kept[k] = v;
          }
        }
        this.state.floorTileOverrides = Object.keys(kept).length > 0 ? kept : undefined;
      }
      if (this.state.tilePermissionOverrides) {
        const kept: Record<string, TilePermission> = {};
        for (const [k, v] of Object.entries(this.state.tilePermissionOverrides)) {
          const [tx, ty] = k.split(",").map(Number);
          if (tx >= 0 && ty >= 0 && tx < this.campus.widthTiles && ty < this.campus.depthTiles) {
            kept[k] = v;
          }
        }
        this.state.tilePermissionOverrides = Object.keys(kept).length > 0 ? kept : undefined;
      }

      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return { widthTiles: this.campus.widthTiles, depthTiles: this.campus.depthTiles };
    });
  }

  async expandFloor(input?: { addWidth?: number; addDepth?: number }): Promise<{ widthTiles: number; depthTiles: number }> {
    const addW = Math.max(0, Math.min(24, Math.round(input?.addWidth ?? FLOOR_EXPAND_STEP)));
    const addD = Math.max(0, Math.min(24, Math.round(input?.addDepth ?? FLOOR_EXPAND_STEP)));
    return this.resizeFloor({ deltaWidth: addW, deltaDepth: addD });
  }

  async createCustomZone(input: {
    name: string;
    icon?: string;
    color?: string;
    role?: CustomZoneRole;
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<CustomZoneRecord> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const name = input.name.trim().slice(0, 64);
      if (!name) throw new Error("Zone name is required");
      const x = Math.round(input.x);
      const y = Math.round(input.y);
      const width = Math.round(input.width);
      const height = Math.round(input.height);
      if (
        x < 0 ||
        y < 0 ||
        width < 1 ||
        height < 1 ||
        x + width > this.campus.widthTiles ||
        y + height > this.campus.depthTiles
      ) {
        throw new Error(
          `Zone (${x},${y} ${width}×${height}) is outside campus bounds (${this.campus.widthTiles}×${this.campus.depthTiles})`,
        );
      }
      const color = input.color && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#38bdf8";
      const zone: CustomZoneRecord = {
        id: `cz-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`,
        name,
        icon: (input.icon?.trim() || "🏷️").slice(0, 8),
        color,
        role: input.role ?? "label",
        x,
        y,
        width,
        height,
      };
      if (!this.state.customZones) this.state.customZones = [];
      this.state.customZones.push(zone);
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(zone);
    });
  }

  async updateCustomZone(
    id: string,
    patch: Partial<Pick<CustomZoneRecord, "name" | "icon" | "color" | "role" | "x" | "y" | "width" | "height">>,
  ): Promise<CustomZoneRecord> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const list = this.state.customZones ?? [];
      const zone = list.find((z) => z.id === id);
      if (!zone) throw new Error(`Custom zone "${id}" not found`);
      const nextX = patch.x !== undefined ? Math.round(patch.x) : zone.x;
      const nextY = patch.y !== undefined ? Math.round(patch.y) : zone.y;
      const nextW = patch.width !== undefined ? Math.round(patch.width) : zone.width;
      const nextH = patch.height !== undefined ? Math.round(patch.height) : zone.height;
      if (
        nextX < 0 ||
        nextY < 0 ||
        nextW < 1 ||
        nextH < 1 ||
        nextX + nextW > this.campus.widthTiles ||
        nextY + nextH > this.campus.depthTiles
      ) {
        throw new Error(`Updated zone bounds exceed campus (${this.campus.widthTiles}×${this.campus.depthTiles})`);
      }
      if (patch.name !== undefined) {
        const trimmed = patch.name.trim().slice(0, 64);
        if (!trimmed) throw new Error("Zone name cannot be empty");
        zone.name = trimmed;
      }
      if (patch.icon !== undefined) zone.icon = (patch.icon.trim() || "🏷️").slice(0, 8);
      if (patch.color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(patch.color)) throw new Error(`Invalid hex color "${patch.color}"`);
        zone.color = patch.color;
      }
      if (patch.role !== undefined) zone.role = patch.role;
      zone.x = nextX;
      zone.y = nextY;
      zone.width = nextW;
      zone.height = nextH;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return structuredClone(zone);
    });
  }

  async deleteCustomZone(id: string): Promise<void> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const list = this.state.customZones ?? [];
      const idx = list.findIndex((z) => z.id === id);
      if (idx === -1) throw new Error(`Custom zone "${id}" not found`);
      list.splice(idx, 1);
      if (list.length === 0) this.state.customZones = undefined;
      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
    });
  }

  /**
   * Relocate all existing hypersleep-capsule pods cleanly into rows inside a custom hypersleep zone.
   * Clears default system pods at (13, 1) and packs pods neatly into floor:0 inside the zone rectangle.
   */
  async relocateHypersleepPodsToZone(
    zoneId: string,
  ): Promise<{ moved: number; total: number; remaining: number }> {
    return this.runSerialized(async () => {
      this.assertNotDemoMode();
      const zone = (this.state.customZones ?? []).find((z) => z.id === zoneId);
      if (!zone) throw new Error(`Custom zone "${zoneId}" not found`);
      if (zone.role !== "hypersleep") {
        throw new Error(`Zone "${zone.name}" is not a Hypersleep zone (role: ${zone.role})`);
      }

      const existingPods = this.campus.worldFurniture
        .filter((f) => f.assetId === "hypersleep-capsule")
        .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
      const total = existingPods.length;
      if (total === 0) {
        return { moved: 0, total: 0, remaining: 0 };
      }

      // Compute tiles occupied by non-pod, non-tabletop, non-divider furniture
      const occupied = new Set<string>();
      for (const wf of this.campus.worldFurniture) {
        if (wf.assetId === "hypersleep-capsule") continue;
        const cat = this.catalogById.get(wf.assetId);
        if (isTabletopAsset(wf.assetId, wf.layer, cat)) continue;
        if (wf.assetId.startsWith("divider-")) continue;
        for (let dy = 0; dy < wf.footprintTiles[1]; dy++) {
          for (let dx = 0; dx < wf.footprintTiles[0]; dx++) {
            occupied.add(`${wf.tx + dx},${wf.ty + dy}`);
          }
        }
      }

      // Build candidate slots inside zone: prefer 1x2 vertical with 1-tile walking aisles, then tight 1x2, then 2x1
      const slots: Array<{ x: number; y: number; direction: Direction }> = [];
      const reserved = new Set<string>(occupied);
      const tryClaim = (x: number, y: number, fw: number, fd: number, direction: Direction): boolean => {
        if (x < zone.x || y < zone.y || x + fw > zone.x + zone.width || y + fd > zone.y + zone.height) {
          return false;
        }
        for (let dy = 0; dy < fd; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            if (reserved.has(`${x + dx},${y + dy}`)) return false;
          }
        }
        for (let dy = 0; dy < fd; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            reserved.add(`${x + dx},${y + dy}`);
          }
        }
        slots.push({ x, y, direction });
        return true;
      };

      // Pass 1: 1x2 ("se") rows with 1-tile walking aisle
      for (let ly = 0; ly + 2 <= zone.height && slots.length < total; ly += 3) {
        for (let lx = 0; lx < zone.width && slots.length < total; lx++) {
          tryClaim(zone.x + lx, zone.y + ly, 1, 2, "se");
        }
      }
      // Pass 2: tight 1x2 ("se") rows if zone needs denser packing
      if (slots.length < total) {
        for (let ly = 0; ly + 2 <= zone.height && slots.length < total; ly++) {
          for (let lx = 0; lx < zone.width && slots.length < total; lx++) {
            tryClaim(zone.x + lx, zone.y + ly, 1, 2, "se");
          }
        }
      }
      // Pass 3: 2x1 ("sw") orientation if narrow horizontal strip
      if (slots.length < total) {
        for (let ly = 0; ly < zone.height && slots.length < total; ly++) {
          for (let lx = 0; lx + 2 <= zone.width && slots.length < total; lx++) {
            tryClaim(zone.x + lx, zone.y + ly, 2, 1, "sw");
          }
        }
      }

      if (slots.length === 0) {
        throw new Error(`โซน "${zone.name}" (${zone.width}×${zone.height}) เล็กเกินไปหรือมีเฟอร์นิเจอร์เต็ม ไม่สามารถวาง Pod ขนาด 1×2 ได้`);
      }

      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      // Clear built-in hypersleep:0 overrides & remove existing pods from floor:0 before re-placing
      const floorList = (this.state.zoneOverrides["floor:0"] ?? []).filter(
        (f) => f.assetId !== "hypersleep-capsule",
      );
      this.state.zoneOverrides["hypersleep:0"] = [];

      const movedCount = Math.min(total, slots.length);
      for (let i = 0; i < movedCount; i++) {
        const pod = existingPods[i];
        const slot = slots[i];
        floorList.push({
          id: pod.id,
          zoneId: "floor:0",
          lx: slot.x,
          ly: slot.y,
          assetId: "hypersleep-capsule",
          direction: slot.direction,
          layer: "object",
          placedBy: "user",
        });
      }
      // Keep any overflow pods at their previous world coordinates on floor:0 so zero pods are lost
      for (let i = movedCount; i < total; i++) {
        const pod = existingPods[i];
        floorList.push({
          id: pod.id,
          zoneId: "floor:0",
          lx: pod.tx,
          ly: pod.ty,
          assetId: "hypersleep-capsule",
          direction: pod.direction,
          layer: "object",
          placedBy: pod.placedBy,
        });
      }
      this.state.zoneOverrides["floor:0"] = floorList;

      this.recomputeCampus();
      await this.persist();
      this.emitSnapshot();
      return { moved: movedCount, total, remaining: total - movedCount };
    });
  }

  async setTheme(theme: ThemeMode): Promise<void> {
    return this.runSerialized(async () => {
      // Allow toggling visual Office/Night/Day theme even in Demo Mode; also apply to backup so it persists cleanly
      this.state.theme = theme;
      this.recomputeCampus();
      if (this.demoBackupState) {
        this.demoBackupState.theme = theme;
        await this.store.save(this.demoBackupState);
      } else {
        await this.persist();
      }
      this.emitSnapshot();
    });
  }
}
