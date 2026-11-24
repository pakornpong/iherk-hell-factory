import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { isSurfaceHostAsset, isTabletopAsset, toTileKey, type RenderLayer, type TilePermission } from "../shared/layers.js";
import {
  AgentTelemetryEventSchema,
  classifyDepartmentFromPath,
  DEPARTMENT_META,
  type ActivityLogEntry,
  type AgentTelemetryEvent,
  type CatalogEntry,
  type ComputedCampus,
  type DepartmentId,
  type Direction,
  type EmployeeRecord,
  type FurnitureInstance,
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
  getAmenityTheme,
  getRotatedFootprint,
  resolveWorldToZone,
  validateFurniturePlacement,
} from "./layout-engine.js";
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
    this.campus = computeCampusLayout(
      this.state.bays,
      this.state.commonWings,
      this.catalogById,
      this.state.bossOffice,
      this.state.theme,
      this.state.tilePermissionOverrides,
      this.state.zoneOverrides,
    );
  }

  private createFreshState(): OfficeState {
    const ts = this.now();
    const starterBayId = "bay-0";
    return {
      version: 1,
      theme: "office",
      bossOffice: createDefaultBossOffice(),
      commonWings: [createDefaultCommonWing(0)],
      bays: [
        {
          id: starterBayId,
          projectPath: null,
          displayName: "Starter Studio",
          department: "general",
          accentColor: BAY_ACCENT_PALETTE[0],
          archived: false,
          deskSlots: 2,
          furniture: createDefaultBayFurniture(starterBayId, "general"),
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
        if (!b.department) {
          b.department = classifyDepartmentFromPath(b.projectPath);
        }
        // Refresh untouched rooms so new default props (themed decor) reach existing saves.
        if (b.furniture.every((f) => f.placedBy === "system")) {
          const base = createDefaultBayFurniture(b.id, b.department);
          b.furniture = [...base, ...createExtraBayWorkstations(b.id, b.deskSlots, base, b.department)];
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

  private recomputeCampus(): void {
    this.campus = computeCampusLayout(
      this.state.bays,
      this.state.commonWings,
      this.catalogById,
      this.state.bossOffice,
      this.state.theme,
      this.state.tilePermissionOverrides,
      this.state.zoneOverrides,
    );
  }

  private ensureCommonWingsForActiveRows(): void {
    const activeCount = Math.max(1, this.state.bays.filter((b) => !b.archived).length);
    const neededWings = Math.max(1, 1 + Math.floor(activeCount / 10));
    for (let idx = 0; idx < neededWings; idx++) {
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
    return provider === "claude" ? "agent-claude" : "agent-gemini";
  }

  private providerVariantSprite(provider: Provider, variantIdx: number): string {
    const base = this.providerBaseSprite(provider);
    if (variantIdx <= 0) return base;
    return `${base}-v${((variantIdx - 1) % 3) + 1}`;
  }

  private getOrCreateBayForProject(
    projectPath: string,
    projectName: string | undefined,
    explicitDepartment: DepartmentId | undefined,
    ts: number,
  ): { bay: ProjectBayRecord; expanded: boolean } {
    const dept = classifyDepartmentFromPath(projectPath, explicitDepartment);
    const existing = this.state.bays.find((b) => b.projectPath === projectPath);
    if (existing) {
      const wasArchived = existing.archived;
      existing.archived = false;
      existing.lastActiveAt = ts;
      if (explicitDepartment && existing.department !== explicitDepartment) {
        existing.department = explicitDepartment;
        existing.accentColor = DEPARTMENT_META[explicitDepartment].color;
      } else if (!existing.department) {
        existing.department = dept;
      }
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
      starterBay.department = dept;
      starterBay.accentColor = DEPARTMENT_META[dept].color;
      if (starterBay.furniture.every((f) => f.placedBy === "system")) {
        starterBay.furniture = createDefaultBayFurniture(starterBay.id, dept);
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
      department: dept,
      accentColor: DEPARTMENT_META[dept].color ?? BAY_ACCENT_PALETTE[nextIndex % BAY_ACCENT_PALETTE.length],
      archived: false,
      deskSlots: 2,
      furniture: createDefaultBayFurniture(bayId, dept),
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
          ? `${ev.provider === "claude" ? "Claude" : "Gemini"} · ${ev.agentRole}`
          : `${ev.provider === "claude" ? "Claude" : "Gemini"} Sub`} @ ${bay.displayName}`.slice(0, 128),
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
      return emp;
    }

    // Bind unbound starter employee on first real project claim
    const unboundStarter = bayEmployees.find((e) => !e.provider && e.spriteId === "agent-starter");
    if (unboundStarter) {
      unboundStarter.provider = ev.provider;
      unboundStarter.spriteId = this.providerBaseSprite(ev.provider);
      unboundStarter.displayName = ev.provider === "claude" ? "Claude Lead" : "Gemini Lead";
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
      displayName: ev.provider === "claude" ? "Claude Lead" : "Gemini Lead",
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
    this.ensureBayDesksForTeam(bay);
    return emp;
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
        bay.department ?? classifyDepartmentFromPath(bay.projectPath),
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

    const { bay, expanded } = this.getOrCreateBayForProject(normalizedPath, ev.projectName, ev.department, ts);
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
          emp.detail = ev.detail ?? `Finished ${ev.toolName ?? "tool"}`;
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
    if (zoneId === "cowork:0") {
      if (!this.state.zoneOverrides) this.state.zoneOverrides = {};
      if (!this.state.zoneOverrides[zoneId]) {
        this.state.zoneOverrides[zoneId] = createCoworkFurniture();
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
          ignoreInstanceId: found.item.zoneId === targetCoord.zoneId ? instanceId : undefined,
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
    // Lazily materialize cowork / amenity zones into state.zoneOverrides when editing one of their default items
    const worldHit = this.campus.worldFurniture.find((f) => f.id === instanceId);
    if (worldHit && (worldHit.zoneId === "cowork:0" || worldHit.zoneId.startsWith("amenity:"))) {
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
      if (patch.department !== undefined) {
        bay.department = patch.department;
        if (patch.accentColor === undefined) {
          bay.accentColor = DEPARTMENT_META[patch.department].color;
        }
      }
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
