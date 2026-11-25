import { findBossChair } from "./chair-alignment.js";
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
import { commonLayoutKey, facingToward, getRoomLayout } from "../shared/room-layouts.js";

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
  seatedOnChair: boolean;
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

    const activeBayIds = new Set(state.bays.filter((b) => !b.archived).map((b) => b.id));
    const liveIds = new Set<string>();
    const visibleEmployees = state.employees.filter((e) => activeBayIds.has(e.bayId));
    const workingEmployees = visibleEmployees.filter(
      (e) => e.visualState === "working" || e.visualState === "teamwork",
    );
    const meetingEmployees = visibleEmployees.filter((e) => e.visualState === "meeting");

    for (let capsuleIdx = 0; capsuleIdx < visibleEmployees.length; capsuleIdx++) {
      const emp = visibleEmployees[capsuleIdx];
      liveIds.add(emp.id);
      const workSeatIdx = Math.max(0, workingEmployees.findIndex((e) => e.id === emp.id));
      const meetingSeatIdx = Math.max(0, meetingEmployees.findIndex((e) => e.id === emp.id));

      let sim = this.agents.get(emp.id);
      if (!sim) {
        const spawn = this.pickGoalForEmployee(emp, "coffee", capsuleIdx, workSeatIdx, meetingSeatIdx);
        sim = {
          record: emp,
          x: spawn.tile[0],
          y: spawn.tile[1],
          direction: spawn.facing,
          targetDirection: spawn.facing,
          path: [],
          goalTile: spawn.tile,
          seatedOnChair: Boolean(spawn.seatedOnChair),
          animClockMs: Math.random() * 600,
          restActivity: "coffee",
          nextRestSwitchMs: this.simTimeMs + 14_000 + (emp.deskIndex * 3100) % 8000,
          lastVisualState: emp.visualState,
        };
        this.agents.set(emp.id, sim);
        // Walk from their hypersleep capsule to their target spot when newly spawned into an active state
        if (emp.visualState !== "resting") {
          const podGoal = this.pickHypersleepGoal(capsuleIdx);
          if (podGoal) {
            sim.x = podGoal.tile[0];
            sim.y = podGoal.tile[1];
            this.routeAgentTo(sim, spawn.tile, spawn.facing);
          }
        }
      } else {
        const prevState = sim.lastVisualState;
        sim.record = emp;
        sim.lastVisualState = emp.visualState;
        const desired = this.pickGoalForEmployee(emp, sim.restActivity, capsuleIdx, workSeatIdx, meetingSeatIdx);
        sim.seatedOnChair = Boolean(desired.seatedOnChair);
        const goalChanged =
          prevState !== emp.visualState ||
          desired.tile[0] !== sim.goalTile[0] ||
          desired.tile[1] !== sim.goalTile[1] ||
          desired.facing !== sim.targetDirection;
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

  private isInCustomZoneRole(tx: number, ty: number, role: "work" | "meeting" | "hypersleep" | "lounge"): boolean {
    const zones = this.state?.customZones ?? [];
    return zones.some(
      (z) => z.role === role && tx >= z.x && tx < z.x + z.width && ty >= z.y && ty < z.y + z.height,
    );
  }

  private isBossChair(id: string): boolean {
    return id.startsWith("boss:0-visitor-") || Boolean(this.campus && findBossChair(this.campus)?.id === id);
  }

  private pickHypersleepGoal(capsuleIndex: number): { tile: [number, number]; facing: Direction; seatedOnChair?: boolean } | null {
    if (!this.campus) return null;
    const pods = this.campus.worldFurniture
      .filter((f) => f.assetId === "hypersleep-capsule")
      .sort((a, b) => {
        const aInZone = this.isInCustomZoneRole(a.tx, a.ty, "hypersleep") ? 0 : 1;
        const bInZone = this.isInCustomZoneRole(b.tx, b.ty, "hypersleep") ? 0 : 1;
        return aInZone - bInZone || a.ty - b.ty || a.tx - b.tx;
      });
    if (pods.length === 0) return null;
    const pod = pods[capsuleIndex % pods.length];
    return { tile: [pod.tx, pod.ty], facing: pod.direction };
  }

  /**
   * Work/Thinking seating: prioritizes swivel chairs in user-defined Work Zones, then Central Work Hub,
   * then any other swivel chair placed on the open floor (excluding Boss chairs & Meeting Zone chairs).
   */
  private pickWorkGoal(seatIndex: number): { tile: [number, number]; facing: Direction; seatedOnChair?: boolean } | null {
    const cowork = this.findCoworkZone();
    if (!this.campus) return null;

    const allWorkChairs = this.campus.worldFurniture
      .filter(
        (f) =>
          f.assetId === "chair-office-swivel" &&
          !this.isBossChair(f.id) &&
          !this.isInCustomZoneRole(f.tx, f.ty, "meeting"),
      )
      .sort((a, b) => {
        const tierOf = (f: ComputedCampus["worldFurniture"][number]) => {
          if (this.isInCustomZoneRole(f.tx, f.ty, "work")) return 0;
          if ((cowork && f.zoneId === cowork.zoneId) || f.id.startsWith("cowork:0-")) return 1;
          return 2;
        };
        return tierOf(a) - tierOf(b) || a.ty - b.ty || a.tx - b.tx;
      });

    if (allWorkChairs.length > 0) {
      const chair = allWorkChairs[seatIndex % allWorkChairs.length];
      return { tile: [chair.tx, chair.ty], facing: chair.direction, seatedOnChair: true };
    }

    if (!cowork) return null;
    const spot = seatIndex % 6;
    return {
      tile: [cowork.originX + (spot % 6), cowork.originY + 5],
      facing: "nw",
      seatedOnChair: false,
    };
  }

  /**
   * Meeting seating: sits at swivel chairs inside Meeting Zones or beside conference tables,
   * or gathers inside Meeting Zones / around conference tables.
   */
  private pickMeetingGoal(meetingIndex: number): { tile: [number, number]; facing: Direction; seatedOnChair?: boolean } | null {
    if (!this.campus) return null;
    const meetingZones = (this.state?.customZones ?? []).filter((z) => z.role === "meeting");
    const tables = this.campus.worldFurniture.filter((f) => f.assetId === "table-conference");

    const isNearTable = (tx: number, ty: number) =>
      tables.some(
        (t) =>
          tx >= t.tx - 1 &&
          tx <= t.tx + t.footprintTiles[0] &&
          ty >= t.ty - 1 &&
          ty <= t.ty + t.footprintTiles[1],
      );

    // 1. Chairs inside Meeting Custom Zones
    const meetingZoneChairs = this.campus.worldFurniture
      .filter(
        (f) =>
          f.assetId === "chair-office-swivel" &&
          !this.isBossChair(f.id) &&
          this.isInCustomZoneRole(f.tx, f.ty, "meeting"),
      )
      .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    if (meetingZoneChairs.length > 0) {
      const chair = meetingZoneChairs[meetingIndex % meetingZoneChairs.length];
      return { tile: [chair.tx, chair.ty], facing: chair.direction, seatedOnChair: true };
    }

    // 2. Chairs adjacent to any conference table on the map
    const tableChairs = this.campus.worldFurniture
      .filter(
        (f) =>
          f.assetId === "chair-office-swivel" &&
          !this.isBossChair(f.id) &&
          isNearTable(f.tx, f.ty),
      )
      .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    if (tableChairs.length > 0) {
      const chair = tableChairs[meetingIndex % tableChairs.length];
      return { tile: [chair.tx, chair.ty], facing: chair.direction, seatedOnChair: true };
    }

    const isWalkableTile = (x: number, y: number): boolean => {
      if (!this.grid) return x >= 0 && y >= 0;
      return x >= 0 && y >= 0 && x < this.grid.width && y < this.grid.height && this.grid.blocked[y * this.grid.width + x] === 0;
    };

    // 3. Walkable tiles inside Meeting Custom Zone(s), facing table or zone center
    if (meetingZones.length > 0) {
      const mz = meetingZones[meetingIndex % meetingZones.length];
      const zoneTable = tables.find(
        (t) => t.tx >= mz.x && t.tx < mz.x + mz.width && t.ty >= mz.y && t.ty < mz.y + mz.height,
      );
      const lookTarget: [number, number] = zoneTable
        ? [zoneTable.tx + (zoneTable.footprintTiles[0] - 1) / 2, zoneTable.ty + (zoneTable.footprintTiles[1] - 1) / 2]
        : [mz.x + (mz.width - 1) / 2, mz.y + (mz.height - 1) / 2];
      const openTiles: Array<[number, number]> = [];
      for (let y = mz.y; y < mz.y + mz.height; y++) {
        for (let x = mz.x; x < mz.x + mz.width; x++) {
          if (isWalkableTile(x, y)) openTiles.push([x, y]);
        }
      }
      if (openTiles.length > 0) {
        const tile = openTiles[meetingIndex % openTiles.length];
        return { tile, facing: facingToward(tile, lookTarget), seatedOnChair: false };
      }
    }

    // 4. Walkable tiles around any conference table on the map
    if (tables.length > 0) {
      const tbl = tables[meetingIndex % tables.length];
      const center: [number, number] = [
        tbl.tx + (tbl.footprintTiles[0] - 1) / 2,
        tbl.ty + (tbl.footprintTiles[1] - 1) / 2,
      ];
      const around: Array<[number, number]> = [];
      for (let y = Math.floor(tbl.ty) - 1; y <= Math.ceil(tbl.ty + tbl.footprintTiles[1]); y++) {
        for (let x = Math.floor(tbl.tx) - 1; x <= Math.ceil(tbl.tx + tbl.footprintTiles[0]); x++) {
          const inside =
            x >= tbl.tx &&
            x < tbl.tx + tbl.footprintTiles[0] &&
            y >= tbl.ty &&
            y < tbl.ty + tbl.footprintTiles[1];
          if (!inside && isWalkableTile(x, y)) around.push([x, y]);
        }
      }
      if (around.length > 0) {
        const tile = around[meetingIndex % around.length];
        return { tile, facing: facingToward(tile, center), seatedOnChair: false };
      }
    }

    // 5. Fallback stand-up spot (e.g. bare campus without a Meeting Zone or Conference Table)
    const cowork = this.findCoworkZone();
    if (cowork) {
      const spot = meetingIndex % 6;
      return {
        tile: [cowork.originX + (spot % 6), cowork.originY + 5],
        facing: "nw",
        seatedOnChair: false,
      };
    }
    return null;
  }

  private findBossZone(): ZoneBounds | undefined {
    return this.campus?.zones.find((z) => z.kind === "boss");
  }

  /** Compute walkable stand spots directly in front of Boss's actual chair position & facing direction. */
  private pickBossReportGoal(emp: EmployeeRecord): { tile: [number, number]; facing: Direction } {
    const bossChair = this.campus && findBossChair(this.campus);
    const bossDesk = this.campus?.worldFurniture.find((f) => f.id === "boss:0-boss-desk");
    const bossZone = this.findBossZone();

    const bx = bossChair ? Math.round(bossChair.tx) : (bossZone?.originX ?? 0) + 2;
    const by = bossChair ? Math.round(bossChair.ty) : (bossZone?.originY ?? 0) + 1;
    const bossDir: Direction = bossChair?.direction ?? "se";

    const dirVec: Record<Direction, [number, number]> = {
      se: [0, 1],
      nw: [0, -1],
      ne: [1, 0],
      sw: [-1, 0],
    };
    const oppositeDir: Record<Direction, Direction> = {
      se: "nw",
      nw: "se",
      ne: "sw",
      sw: "ne",
    };
    const [fx, fy] = dirVec[bossDir];
    const [px, py] = [-fy, fx];

    const frontX = bx + fx;
    const frontY = by + fy;
    const hasDeskInFront = Boolean(
      bossDesk &&
        frontX >= bossDesk.tx &&
        frontX < bossDesk.tx + bossDesk.footprintTiles[0] &&
        frontY >= bossDesk.ty &&
        frontY < bossDesk.ty + bossDesk.footprintTiles[1],
    );

    const isWalkableTile = (x: number, y: number): boolean => {
      if (!this.grid) return x >= 0 && y >= 0;
      return x >= 0 && y >= 0 && x < this.grid.width && y < this.grid.height && this.grid.blocked[y * this.grid.width + x] === 0;
    };

    const ring1: Array<[number, number]> = [
      [bx + fx, by + fy],
      [bx + fx + px, by + fy + py],
      [bx + fx - px, by + fy - py],
    ];
    const ring2: Array<[number, number]> = [
      [bx + fx * 2, by + fy * 2],
      [bx + fx * 2 + px, by + fy * 2 + py],
      [bx + fx * 2 - px, by + fy * 2 - py],
    ];
    const ring3: Array<[number, number]> = [
      [bx + px, by + py],
      [bx - px, by - py],
      [bx + fx * 3, by + fy * 3],
      [bx - fx, by - fy],
    ];

    const preferredRings: Array<{ tiles: Array<[number, number]>; isFront: boolean }> = hasDeskInFront
      ? [
          { tiles: ring2, isFront: true },
          { tiles: ring1, isFront: true },
          { tiles: ring3, isFront: false },
        ]
      : [
          { tiles: ring1, isFront: true },
          { tiles: ring2, isFront: true },
          { tiles: ring3, isFront: false },
        ];

    const lookTarget: [number, number] = hasDeskInFront && bossDesk
      ? [bossDesk.tx + (bossDesk.footprintTiles[0] - 1) / 2, bossDesk.ty + (bossDesk.footprintTiles[1] - 1) / 2]
      : [bx, by];

    const bossVisitors = (this.state?.employees ?? []).filter(
      (e) => e.visualState === "reporting" || e.visualState === "assigning",
    );
    const visitorRank = Math.max(0, bossVisitors.findIndex((e) => e.id === emp.id));

    for (const ring of preferredRings) {
      const open = ring.tiles.filter(([x, y]) => isWalkableTile(x, y));
      if (open.length > 0) {
        const tile = open[visitorRank % open.length];
        return { tile, facing: ring.isFront ? oppositeDir[bossDir] : facingToward(tile, lookTarget) };
      }
    }
    const fallback: [number, number] = [Math.max(0, bx + fx), Math.max(0, by + fy)];
    return { tile: fallback, facing: oppositeDir[bossDir] };
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
    _restActivity: RestActivity,
    capsuleIdx = 0,
    workSeatIdx = 0,
    meetingSeatIdx = 0,
  ): { tile: [number, number]; facing: Direction; seatedOnChair?: boolean } {
    if (!this.campus) {
      return { tile: [2, 2], facing: "se" };
    }

    // 1. Reporting & Briefing (รับบรีฟ) -> walk directly in front of Boss's desk and face Boss
    if (emp.visualState === "reporting" || emp.visualState === "assigning") {
      return this.pickBossReportGoal(emp);
    }

    // 2. Resting (idle) -> sleep inside their dedicated Hypersleep Capsule!
    if (emp.visualState === "resting") {
      const podGoal = this.pickHypersleepGoal(capsuleIdx);
      if (podGoal) return podGoal;
    }

    // 3. Meeting (ประชุม) -> sit at chairs in Meeting Zone / around conference table
    if (emp.visualState === "meeting") {
      const meetingGoal = this.pickMeetingGoal(meetingSeatIdx);
      if (meetingGoal) return meetingGoal;
    }

    // 4. Thinking / Working / Teamwork -> sit directly at a desk chair (Work Zones -> Central Hub -> any open-floor chair)
    const workGoal = this.pickWorkGoal(workSeatIdx);
    if (workGoal) return workGoal;

    const bayZone = this.findBayZone(emp.bayId);
    if (!bayZone) {
      return { tile: [2, 2], facing: "se" };
    }
    const common = this.findCommonWingForRow(bayZone.row) ?? bayZone;

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
    const grid = this.grid;
    const [gx, gy] = goal;
    const rounded: [number, number] = [Math.round(gx), Math.round(gy)];
    const fractional = gx !== rounded[0] || gy !== rounded[1];
    let approach = rounded;
    if (fractional && grid.blocked[rounded[1] * grid.width + rounded[0]] !== 0) {
      const [left, top] = [Math.floor(gx), Math.floor(gy)];
      const touched: Array<[number, number]> = [[left, rounded[1]], [rounded[0], top], [left, top]];
      approach = touched.find(([x, y]) =>
        x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.blocked[y * grid.width + x] === 0,
      ) ?? rounded;
    }

    const rawPath = findTilePath(grid, [Math.round(sim.x), Math.round(sim.y)], approach);
    // Drop the starting tile if already at it.
    sim.path = rawPath.length > 1 ? rawPath.slice(1) : [];
    const lastTile = rawPath.at(-1);
    if (fractional && lastTile?.[0] === approach[0] && lastTile[1] === approach[1] &&
        grid.blocked[approach[1] * grid.width + approach[0]] === 0) {
      // A tucked chair can touch a blocked desk tile. Walk to its exposed tile first.
      sim.path.push(goal);
    }
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
        const isThinking = !sim.record.toolName && sim.record.detail === "Thinking...";
        const icon =
          sim.record.toolCategory === "error"
            ? "⚠️"
            : isThinking
              ? "💭"
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
          clipName: sim.seatedOnChair ? `sit_type_${t2}` : `talk_${t2}`,
          bubbleIcon: "💬",
          bubbleText: `${rolePrefix}${sim.record.detail ?? "In meeting"}`,
        };
      case "resting":
        return { clipName: `rest_sleep_${tSlow}`, bubbleIcon: "💤" };
    }
  }
}
