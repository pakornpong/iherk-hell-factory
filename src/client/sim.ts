import {
  getOrgRoleMeta,
  type ComputedCampus,
  type Direction,
  type EmployeeRecord,
  type OfficeState,
  type VisualState,
  type ZoneBounds,
} from "../shared/types.js";
import type { RenderedEmployeeInput, SyncPacketVisual } from "./iso-renderer.js";
import { buildWalkableGrid, findTilePath, type WalkableGrid } from "./pathfinding.js";
import { bayLayoutKey, commonLayoutKey, facingToward, getRoomLayout } from "../shared/room-layouts.js";

export interface SimEmployeeVisual extends RenderedEmployeeInput {
  id: string;
  isMoving: boolean;
}

type RestActivity = "coffee" | "sofa" | "stroll" | "nap";

interface AgentSimState {
  record: EmployeeRecord;
  x: number;
  y: number;
  direction: Direction;
  targetDirection: Direction;
  path: Array<[number, number]>;
  goalTile: [number, number];
  animClockMs: number;
  restActivity: RestActivity;
  nextRestSwitchMs: number;
  lastVisualState: VisualState;
}

const WALK_SPEED_TILES_PER_SEC = 5.5;

/**
 * Phase 2 character facing matches chair-office-swivel 1:1:
 *   +X -> "ne", -X -> "sw", +Y -> "se", -Y -> "nw"
 */
export function deltaToDir(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "ne" : "sw";
  }
  if (Math.abs(dy) > 1e-4) {
    return dy > 0 ? "se" : "nw";
  }
  return fallback;
}

export class OfficeSimulation {
  private agents = new Map<string, AgentSimState>();
  private campus: ComputedCampus | null = null;
  private grid: WalkableGrid | null = null;
  private state: OfficeState | null = null;
  private simTimeMs = 0;
  private bayPopAnimations = new Map<string, number>();

  triggerBayPop(bayId: string): void {
    this.bayPopAnimations.set(bayId, 0.05);
  }

  getBayPopAnimations(): Map<string, number> {
    return this.bayPopAnimations;
  }

  syncFromServer(state: OfficeState, campus: ComputedCampus): void {
    this.state = state;
    this.campus = campus;
    this.grid = buildWalkableGrid(campus, state.tilePermissionOverrides);

    const activeBayIds = new Set(campus.zones.filter((z) => z.kind === "bay" && z.bayId).map((z) => z.bayId!));
    const liveIds = new Set<string>();

    for (const emp of state.employees) {
      if (!activeBayIds.has(emp.bayId)) continue;
      liveIds.add(emp.id);

      let sim = this.agents.get(emp.id);
      if (!sim) {
        const spawn = this.pickGoalForEmployee(emp, "coffee");
        sim = {
          record: emp,
          x: spawn.tile[0],
          y: spawn.tile[1],
          direction: spawn.facing,
          targetDirection: spawn.facing,
          path: [],
          goalTile: spawn.tile,
          animClockMs: Math.random() * 600,
          restActivity: "coffee",
          nextRestSwitchMs: this.simTimeMs + 14_000 + (emp.deskIndex * 3100) % 8000,
          lastVisualState: emp.visualState,
        };
        this.agents.set(emp.id, sim);
        // Walk from bay entrance when newly spawned into an active state
        const bayZone = this.findBayZone(emp.bayId);
        if (bayZone && emp.visualState !== "resting") {
          sim.x = bayZone.originX + 2;
          sim.y = bayZone.originY + 5;
          this.routeAgentTo(sim, spawn.tile, spawn.facing);
        }
      } else {
        const prevState = sim.lastVisualState;
        sim.record = emp;
        sim.lastVisualState = emp.visualState;
        const desired = this.pickGoalForEmployee(emp, sim.restActivity);
        const goalChanged =
          prevState !== emp.visualState ||
          desired.tile[0] !== sim.goalTile[0] ||
          desired.tile[1] !== sim.goalTile[1];
        if (goalChanged) {
          this.routeAgentTo(sim, desired.tile, desired.facing);
        }
      }
    }

    // Remove despawned / archived agents
    for (const id of [...this.agents.keys()]) {
      if (!liveIds.has(id)) {
        this.agents.delete(id);
      }
    }
  }

  private findBayZone(bayId: string): ZoneBounds | undefined {
    return this.campus?.zones.find((z) => z.kind === "bay" && z.bayId === bayId);
  }

  private findCoworkZone(): ZoneBounds | undefined {
    return this.campus?.zones.find((z) => z.kind === "cowork");
  }

  /** Subagents hot-desk in the shared co-working room: sit on its chairs, or wait at its centre when full. */
  private pickCoworkGoal(emp: EmployeeRecord): { tile: [number, number]; facing: Direction } | null {
    const cowork = this.findCoworkZone();
    if (!cowork || !this.campus) return null;
    const isSitting =
      emp.visualState === "working" || emp.visualState === "teamwork" || emp.visualState === "resting";
    if (isSitting) {
      const chairs = this.campus.worldFurniture
        .filter((f) => f.zoneId === cowork.zoneId && f.assetId === "chair-office-swivel")
        .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
      if (emp.deskIndex < chairs.length) {
        const chair = chairs[emp.deskIndex];
        return { tile: [chair.tx, chair.ty], facing: chair.direction };
      }
    }
    // Assigning (or no free chair): stand in the walkable centre cross of the room
    const spot = emp.deskIndex % 4;
    return {
      tile: [cowork.originX + 2 + (spot % 2), cowork.originY + 2 + Math.floor(spot / 2)],
      facing: "se",
    };
  }

  private findBossZone(): ZoneBounds | undefined {
    return this.campus?.zones.find((z) => z.kind === "boss");
  }

  private findCommonWingForRow(row: number): ZoneBounds | undefined {
    return (
      this.campus?.zones.find((z) => z.kind === "common" && z.row === row) ??
      this.campus?.zones.find((z) => z.kind === "common")
    );
  }

  /** World tiles of a room's designed stand spots that are still walkable (furniture may have been moved). */
  private openSpots(zone: ZoneBounds, spots?: Array<[number, number]>): Array<[number, number]> {
    if (!spots) return [];
    const world = spots.map(([x, y]) => [zone.originX + x, zone.originY + y] as [number, number]);
    if (!this.grid) return world;
    const grid = this.grid;
    return world.filter(([x, y]) => x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.blocked[y * grid.width + x] === 0);
  }

  /** Centre (world tiles) of the first furniture item in a zone matching `pred`. */
  private furnitureCentre(
    zone: ZoneBounds,
    pred: (f: ComputedCampus["worldFurniture"][number]) => boolean,
  ): [number, number] | undefined {
    const f = this.campus?.worldFurniture.find((w) => w.zoneId === zone.zoneId && pred(w));
    if (!f) return undefined;
    return [f.tx + (f.footprintTiles[0] - 1) / 2, f.ty + (f.footprintTiles[1] - 1) / 2];
  }

  private hashSlot(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  private pickGoalForEmployee(
    emp: EmployeeRecord,
    restActivity: RestActivity,
  ): { tile: [number, number]; facing: Direction } {
    const bayZone = this.findBayZone(emp.bayId);
    if (!bayZone || !this.campus) {
      return { tile: [2, 2], facing: "se" };
    }
    const common = this.findCommonWingForRow(bayZone.row) ?? bayZone;

    if (emp.isEphemeral && emp.visualState !== "reporting" && emp.visualState !== "meeting") {
      const coworkGoal = this.pickCoworkGoal(emp);
      if (coworkGoal) return coworkGoal;
    }

    // Resolve actual swivel chairs in this bay first so moved furniture updates seating
    const bayChairs = this.campus.worldFurniture.filter(
      (f) => f.zoneId === bayZone.zoneId && f.assetId === "chair-office-swivel",
    );
    const defaultChairOffsets: Array<[number, number]> = [
      [1, 1],
      [4, 1],
      [1, 4],
      [4, 4],
    ];
    const [cx, cy] = defaultChairOffsets[emp.deskIndex % defaultChairOffsets.length];

    // Phase 2 character models match chair-office-swivel 1:1:
    // "se" = +Y, "sw" = -X, "nw" = -Y, "ne" = +X
    switch (emp.visualState) {
      case "working":
      case "teamwork":
      case "resting": {
        const chair = bayChairs[emp.deskIndex % Math.max(1, bayChairs.length)];
        if (chair) {
          return { tile: [chair.tx, chair.ty], facing: chair.direction };
        }
        return { tile: [bayZone.originX + cx, bayZone.originY + cy], facing: "nw" };
      }

      case "assigning": {
        // Briefing spots come from the room's designed layout (mirrored with it)
        const dept = bayZone.department ?? "general";
        const { key, mirrored } = bayLayoutKey(dept, emp.bayId);
        const spots = this.openSpots(bayZone, getRoomLayout(key, mirrored).standSpots);
        if (spots.length > 0) {
          return { tile: spots[emp.deskIndex % spots.length], facing: "se" };
        }
        return { tile: [bayZone.originX + 2 + (emp.deskIndex % 2), bayZone.originY + 4], facing: "se" };
      }

      case "reporting": {
        const boss = this.findBossZone();
        if (boss) {
          // Visitors stand in front of the boss desk, looking at it
          const spots = this.openSpots(boss, getRoomLayout("boss").standSpots);
          const desk = this.furnitureCentre(boss, (f) => f.id === "boss:0-boss-desk");
          if (spots.length > 0) {
            const tile = spots[(emp.deskIndex + this.hashSlot(emp.id)) % spots.length];
            return { tile, facing: desk ? facingToward(tile, desk) : "nw" };
          }
          return { tile: [boss.originX + 1, boss.originY + 3], facing: "nw" };
        }
        return { tile: [1, 3], facing: "nw" };
      }

      case "meeting": {
        // Stand-up spots around the lounge's meeting table (open floor, so talk_* legs never clip chairs)
        const row = Number(common.zoneId.split(":")[1] ?? 0);
        const layout =
          common.kind === "common" ? getRoomLayout(commonLayoutKey(row).key, commonLayoutKey(row).mirrored) : undefined;
        const spots = this.openSpots(common, layout?.standSpots);
        const table = this.furnitureCentre(common, (f) => f.assetId === "table-conference");
        if (spots.length > 0) {
          const tile = spots[(emp.deskIndex + this.hashSlot(emp.id)) % spots.length];
          return { tile, facing: table ? facingToward(tile, table) : "nw" };
        }
        return { tile: [common.originX + 2, common.originY + 4], facing: "nw" };
      }
    }
  }

  private routeAgentTo(sim: AgentSimState, goal: [number, number], facing: Direction): void {
    sim.goalTile = goal;
    sim.targetDirection = facing;
    if (!this.grid) {
      sim.path = [goal];
      return;
    }
    const rawPath = findTilePath(this.grid, [Math.round(sim.x), Math.round(sim.y)], goal);
    // Drop the starting tile if already at it
    sim.path = rawPath.length > 1 ? rawPath.slice(1) : [];
  }

  step(dtMs: number): {
    visuals: SimEmployeeVisual[];
    syncPackets: SyncPacketVisual[];
    targetFps: 30 | 8;
  } {
    const clampedDt = Math.min(250, Math.max(0, dtMs));
    this.simTimeMs += clampedDt;

    let anyMoving = false;

    // Advance bay expansion pop-in animations
    for (const [bayId, p] of [...this.bayPopAnimations.entries()]) {
      const next = p + clampedDt / 420;
      if (next >= 1) {
        this.bayPopAnimations.delete(bayId);
      } else {
        this.bayPopAnimations.set(bayId, next);
        anyMoving = true;
      }
    }

    const visuals: SimEmployeeVisual[] = [];

    for (const sim of this.agents.values()) {
      sim.animClockMs += clampedDt;

      let isMoving = false;
      if (sim.path.length > 0) {
        isMoving = true;
        anyMoving = true;
        let remainingDist = (WALK_SPEED_TILES_PER_SEC * clampedDt) / 1000;
        while (remainingDist > 0 && sim.path.length > 0) {
          const [tx, ty] = sim.path[0];
          const dx = tx - sim.x;
          const dy = ty - sim.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= remainingDist) {
            sim.x = tx;
            sim.y = ty;
            sim.direction = deltaToDir(dx, dy, sim.direction);
            remainingDist -= dist;
            sim.path.shift();
          } else {
            sim.x += (dx / dist) * remainingDist;
            sim.y += (dy / dist) * remainingDist;
            sim.direction = deltaToDir(dx, dy, sim.direction);
            remainingDist = 0;
          }
        }
        if (sim.path.length === 0) {
          sim.direction = sim.targetDirection;
          isMoving = false;
        }
      }

      const { clipName, bubbleIcon, bubbleText } = this.resolveClipAndBubble(sim, isMoving);
      visuals.push({
        id: sim.record.id,
        record: sim.record,
        x: sim.x,
        y: sim.y,
        direction: sim.direction,
        clipName,
        bubbleIcon,
        bubbleText,
        isMoving,
      });
    }

    // Generate teamwork sync packets between active teammates in the same bay
    const syncPackets: SyncPacketVisual[] = [];
    const byBay = new Map<string, SimEmployeeVisual[]>();
    for (const v of visuals) {
      if (v.record.visualState === "teamwork" && !v.isMoving) {
        const list = byBay.get(v.record.bayId) ?? [];
        list.push(v);
        byBay.set(v.record.bayId, list);
      }
    }
    for (const members of byBay.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length - 1; i++) {
        const a = members[i];
        const b = members[i + 1];
        const phase = ((this.simTimeMs + i * 700) % 1800) / 1800;
        const forward = Math.floor((this.simTimeMs + i * 700) / 1800) % 2 === 0;
        syncPackets.push({
          fromX: forward ? a.x : b.x,
          fromY: forward ? a.y : b.y,
          toX: forward ? b.x : a.x,
          toY: forward ? b.y : a.y,
          progress: phase,
        });
      }
      anyMoving = true; // Keep sync packets smooth at 30fps
    }

    return {
      visuals,
      syncPackets,
      targetFps: anyMoving ? 30 : 8,
    };
  }

  private resolveClipAndBubble(
    sim: AgentSimState,
    isMoving: boolean,
  ): { clipName: string; bubbleIcon?: string; bubbleText?: string } {
    if (isMoving) {
      const idx = Math.floor(sim.animClockMs / 140) % 4;
      return {
        clipName: `walk_${idx}`,
        bubbleIcon:
          sim.record.visualState === "reporting"
            ? sim.record.reportReason === "question"
              ? "❓"
              : "✅"
            : sim.record.visualState === "meeting"
              ? "💬"
              : sim.record.visualState === "assigning"
                ? "📋"
                : undefined,
      };
    }

    const t2 = Math.floor(sim.animClockMs / 300) % 2;
    const tSlow = Math.floor(sim.animClockMs / 650) % 2;
    const roleMeta = getOrgRoleMeta(sim.record.role);
    const rolePrefix = roleMeta ? `${roleMeta.shortLabel} · ` : "";

    switch (sim.record.visualState) {
      case "reporting": {
        const isQ = sim.record.reportReason === "question";
        return {
          clipName: isQ ? `talk_${t2}` : `assign_${t2}`,
          bubbleIcon: isQ ? "❓" : "✅",
          bubbleText: sim.record.detail ?? (isQ ? "Question for Boss" : "Report ready"),
        };
      }
      case "assigning":
        return {
          clipName: `assign_${t2}`,
          bubbleIcon: roleMeta?.id === "Orchestrator" ? "🎯" : "📋",
          bubbleText: `${rolePrefix}${sim.record.detail ?? "Assigning task"}`,
        };
      case "working": {
        const icon =
          sim.record.toolCategory === "error"
            ? "⚠️"
            : roleMeta
              ? roleMeta.icon
              : sim.record.toolCategory === "shell"
                ? "⚡"
                : sim.record.toolCategory === "search"
                  ? "🔎"
                  : "💻";
        return {
          clipName: `sit_type_${t2}`,
          bubbleIcon: icon,
          bubbleText: `${rolePrefix}${sim.record.toolName ?? sim.record.detail ?? "Working"}`,
        };
      }
      case "teamwork": {
        // Stay seated on the swivel chair (avoid standing talk/inspect legs clipping through the chair)
        return {
          clipName: `sit_type_${t2}`,
          bubbleIcon: roleMeta ? roleMeta.icon : "🤝",
          bubbleText: `${rolePrefix}${sim.record.toolName ?? "Team sync"}`,
        };
      }
      case "meeting":
        return {
          clipName: `talk_${t2}`,
          bubbleIcon: "💬",
          bubbleText: `${rolePrefix}${sim.record.detail ?? "In meeting"}`,
        };
      case "resting":
        return { clipName: `rest_sleep_${tSlow}`, bubbleIcon: "💤" };
    }
  }
}
