import type {
  ComputedCampus,
  Direction,
  EmployeeRecord,
  OfficeState,
  VisualState,
  ZoneBounds,
} from "../shared/types.js";
import type { RenderedEmployeeInput, SyncPacketVisual } from "./iso-renderer.js";
import { buildWalkableGrid, findTilePath, type WalkableGrid } from "./pathfinding.js";

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

const WALK_SPEED_TILES_PER_SEC = 3.2;

function deltaToDir(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "se" : "nw";
  }
  if (Math.abs(dy) > 1e-4) {
    return dy > 0 ? "sw" : "ne";
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
    this.grid = buildWalkableGrid(campus);

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

  private findBossZone(): ZoneBounds | undefined {
    return this.campus?.zones.find((z) => z.kind === "boss");
  }

  private findCommonWingForRow(row: number): ZoneBounds | undefined {
    return (
      this.campus?.zones.find((z) => z.kind === "common" && z.row === row) ??
      this.campus?.zones.find((z) => z.kind === "common")
    );
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

    // Resolve actual swivel chairs in this bay first so moved furniture updates seating
    const bayChairs = this.campus.worldFurniture.filter(
      (f) => f.zoneId === bayZone.zoneId && f.assetId === "chair-office-swivel",
    );
    const defaultChairOffsets: Array<[number, number]> = [
      [1, 2],
      [4, 2],
      [1, 4],
      [4, 4],
    ];
    const [cx, cy] = defaultChairOffsets[emp.deskIndex % defaultChairOffsets.length];

    // Character models face +X in "se", +Y in "sw", -X in "nw", -Y in "ne"
    const chairDirToCharFacing = (chairDir: Direction): Direction => {
      // chair-office-swivel faces +Y in "se", -X in "sw", -Y in "nw", +X in "ne"
      switch (chairDir) {
        case "nw":
          return "ne"; // faces -Y toward desk/table north-east
        case "sw":
          return "nw"; // faces -X toward table
        case "se":
          return "sw"; // faces +Y
        case "ne":
          return "se"; // faces +X
      }
    };

    switch (emp.visualState) {
      case "working":
      case "teamwork": {
        const chair = bayChairs[emp.deskIndex % Math.max(1, bayChairs.length)];
        if (chair) {
          return { tile: [chair.tx, chair.ty], facing: chairDirToCharFacing(chair.direction) };
        }
        return { tile: [bayZone.originX + cx, bayZone.originY + cy], facing: "ne" };
      }

      case "assigning":
        return { tile: [bayZone.originX + 2 + (emp.deskIndex % 2), bayZone.originY + 4], facing: "se" };

      case "reporting": {
        const boss = this.findBossZone();
        if (boss) {
          const visitorSpots: Array<{ tile: [number, number]; facing: Direction }> = [
            { tile: [boss.originX + 2, boss.originY + 3], facing: "ne" },
            { tile: [boss.originX + 3, boss.originY + 3], facing: "ne" },
            { tile: [boss.originX + 1, boss.originY + 3], facing: "ne" },
            { tile: [boss.originX + 4, boss.originY + 3], facing: "ne" },
          ];
          const slot = (emp.deskIndex + this.hashSlot(emp.id)) % visitorSpots.length;
          return visitorSpots[slot];
        }
        return { tile: [2, 3], facing: "ne" };
      }

      case "meeting": {
        // Spread employees across common wing chairs using employee-unique hash so different bays don't stack
        const commonChairs = this.campus.worldFurniture.filter(
          (f) => f.zoneId === common.zoneId && f.assetId === "chair-office-swivel",
        );
        const seats: Array<{ tile: [number, number]; facing: Direction }> =
          commonChairs.length > 0
            ? commonChairs.map((c) => ({ tile: [c.tx, c.ty], facing: chairDirToCharFacing(c.direction) }))
            : [
                { tile: [common.originX + 1, common.originY + 3], facing: "ne" },
                { tile: [common.originX + 2, common.originY + 3], facing: "ne" },
                { tile: [common.originX + 3, common.originY + 1], facing: "nw" },
                { tile: [common.originX + 3, common.originY + 2], facing: "nw" },
                { tile: [common.originX + 0, common.originY + 2], facing: "se" },
              ];
        const slot = (emp.deskIndex + this.hashSlot(emp.id)) % seats.length;
        return seats[slot];
      }

      case "resting": {
        const slotOffset = this.hashSlot(emp.id) % 2;
        if (restActivity === "coffee") {
          const bar = this.campus.worldFurniture.find(
            (f) => f.zoneId === common.zoneId && f.assetId === "coffee-machine-bar",
          );
          if (bar) {
            return { tile: [bar.tx + slotOffset, Math.min(this.campus.depthTiles - 1, bar.ty + 1)], facing: "ne" };
          }
          return { tile: [common.originX + 4 + slotOffset, common.originY + 1], facing: "ne" };
        }
        if (restActivity === "sofa" || restActivity === "nap") {
          const sofa = this.campus.worldFurniture.find(
            (f) => f.zoneId === common.zoneId && f.assetId === "sofa-lounge",
          );
          if (sofa) {
            return { tile: [sofa.tx + slotOffset, Math.max(0, sofa.ty - 1)], facing: "sw" };
          }
          return { tile: [common.originX + 4 + slotOffset, common.originY + 3], facing: "sw" };
        }
        return { tile: [bayZone.originX + 1 + ((emp.deskIndex + slotOffset) % 3), bayZone.originY + 5], facing: "se" };
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

      // Rotate autonomous resting routines every 14-22s
      if (sim.record.visualState === "resting" && sim.path.length === 0 && this.simTimeMs >= sim.nextRestSwitchMs) {
        const order: RestActivity[] = ["coffee", "sofa", "nap", "stroll"];
        const nextIdx = (order.indexOf(sim.restActivity) + 1) % order.length;
        sim.restActivity = order[nextIdx];
        sim.nextRestSwitchMs = this.simTimeMs + 14_000 + ((Math.round(this.simTimeMs) % 7) * 1000);
        const target = this.pickGoalForEmployee(sim.record, sim.restActivity);
        this.routeAgentTo(sim, target.tile, target.facing);
      }

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
          bubbleIcon: "📋",
          bubbleText: sim.record.detail ?? "Assigning task",
        };
      case "working": {
        const icon =
          sim.record.toolCategory === "error"
            ? "⚠️"
            : sim.record.toolCategory === "shell"
              ? "⚡"
              : sim.record.toolCategory === "search"
                ? "🔎"
                : "💻";
        return {
          clipName: `sit_type_${t2}`,
          bubbleIcon: icon,
          bubbleText: sim.record.toolName ?? sim.record.detail,
        };
      }
      case "teamwork": {
        // Alternate typing and glancing/talking to teammate
        const talkingPhase = Math.floor(sim.animClockMs / 2400) % 4 === 0;
        return {
          clipName: talkingPhase ? `talk_${t2}` : `sit_type_${t2}`,
          bubbleIcon: "🤝",
          bubbleText: sim.record.toolName ?? "Team sync",
        };
      }
      case "meeting":
        return {
          clipName: `talk_${t2}`,
          bubbleIcon: "💬",
          bubbleText: sim.record.detail ?? "In meeting",
        };
      case "resting": {
        if (sim.restActivity === "coffee") {
          return { clipName: `rest_coffee_${tSlow}`, bubbleIcon: "☕" };
        }
        if (sim.restActivity === "nap") {
          return { clipName: `rest_sleep_${tSlow}`, bubbleIcon: "💤" };
        }
        return { clipName: `idle_${tSlow}`, bubbleIcon: sim.restActivity === "sofa" ? "😌" : undefined };
      }
    }
  }
}
