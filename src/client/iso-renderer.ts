import type {
  CatalogEntry,
  ComputedCampus,
  Direction,
  EmployeeRecord,
  OfficeState,
  ThemeMode,
  ToolCategory,
} from "../shared/types.js";
import type { AtlasManager, ResolvedSpriteFrame } from "./atlas-loader.js";
import { STEP_X, STEP_Y, type IsoCamera } from "./camera.js";

export interface DepthRenderItem {
  id: string;
  x: number;
  y: number;
  footprintX: number;
  footprintY: number;
}

export interface RenderedEmployeeInput {
  record: EmployeeRecord;
  x: number;
  y: number;
  direction: Direction;
  clipName: string;
  bubbleIcon?: string;
  bubbleText?: string;
}

export interface SyncPacketVisual {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
}

export interface DecorateGhostInput {
  tx: number;
  ty: number;
  assetId: string;
  direction: Direction;
  valid: boolean;
}

export interface RenderSceneInput {
  state: OfficeState;
  campus: ComputedCampus;
  camera: IsoCamera;
  atlas: AtlasManager;
  catalogById?: Map<string, CatalogEntry>;
  employees: RenderedEmployeeInput[];
  syncPackets: SyncPacketVisual[];
  selectedEmployeeId?: string | null;
  bayPopAnimations?: Map<string, number>; // bayId -> 0..1 progress
  ghost?: DecorateGhostInput | null;
  timeMs: number;
}

export function resolveAssetAnimationFrame(
  assetId: string,
  timeMs: number,
  catalogById?: Map<string, CatalogEntry>,
): string {
  const frames = catalogById?.get(assetId)?.frames;
  if (frames && frames.length > 0) {
    if (frames.length === 1) return frames[0];
    return frames[Math.floor(timeMs / 650) % frames.length];
  }
  const tick = Math.floor(timeMs / 650);
  if (assetId === "server-rack") return `blink_${tick % 3}`;
  if (assetId === "desk-security-ops") return `alert_${tick % 2}`;
  if (assetId === "desk-dev-dual" || assetId === "coffee-machine-bar") return `idle_${tick % 2}`;
  return "default";
}

export interface ScreenHitBox {
  kind: "employee" | "furniture";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function isoScreenXRange(item: DepthRenderItem): [number, number] {
  return [item.x - (item.y + item.footprintY), item.x + item.footprintX - item.y];
}

function depthSortKey(item: DepthRenderItem): number {
  return item.x + item.footprintX + item.y + item.footprintY;
}

export function sortUnifiedIsoEntities<T extends DepthRenderItem>(items: T[]): T[] {
  const n = items.length;
  if (n <= 1) return [...items];

  const adj: number[][] = Array.from({ length: n }, () => []);
  const inDeg = new Int32Array(n);
  const EPS = 1e-4;

  for (let i = 0; i < n; i++) {
    const a = items[i];
    const [aMinSX, aMaxSX] = isoScreenXRange(a);
    const ax0 = a.x;
    const ax1 = a.x + a.footprintX;
    const ay0 = a.y;
    const ay1 = a.y + a.footprintY;

    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      const [bMinSX, bMaxSX] = isoScreenXRange(b);
      if (aMaxSX <= bMinSX + EPS || bMaxSX <= aMinSX + EPS) continue;

      const bx0 = b.x;
      const bx1 = b.x + b.footprintX;
      const by0 = b.y;
      const by1 = b.y + b.footprintY;

      const aBehindB = ax1 <= bx0 + EPS || ay1 <= by0 + EPS;
      const bBehindA = bx1 <= ax0 + EPS || by1 <= ay0 + EPS;

      if (aBehindB && !bBehindA) {
        adj[i].push(j);
        inDeg[j]++;
      } else if (bBehindA && !aBehindB) {
        adj[j].push(i);
        inDeg[i]++;
      }
    }
  }

  const compareIdx = (ia: number, ib: number): number => {
    const a = items[ia];
    const b = items[ib];
    const dk = depthSortKey(a) - depthSortKey(b);
    if (Math.abs(dk) > EPS) return dk;
    if (Math.abs(a.x - b.x) > EPS) return a.x - b.x;
    if (Math.abs(a.y - b.y) > EPS) return a.y - b.y;
    return a.id.localeCompare(b.id);
  };

  const emitted = new Uint8Array(n);
  const result: T[] = [];

  while (result.length < n) {
    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!emitted[i] && inDeg[i] === 0) ready.push(i);
    }
    let pick: number;
    if (ready.length > 0) {
      ready.sort(compareIdx);
      pick = ready[0];
    } else {
      const remaining: number[] = [];
      for (let i = 0; i < n; i++) {
        if (!emitted[i]) remaining.push(i);
      }
      remaining.sort(compareIdx);
      pick = remaining[0];
    }
    emitted[pick] = 1;
    result.push(items[pick]);
    for (const next of adj[pick]) inDeg[next]--;
  }

  return result;
}

export function isInWorldBounds(
  wx: number,
  wy: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return wx >= bounds.minX && wx <= bounds.maxX && wy >= bounds.minY && wy <= bounds.maxY;
}

function toAnchorWorld(x: number, y: number, fx: number, fy: number): [number, number] {
  const ax = x + fx - 1;
  const ay = y + fy - 1;
  return [(ax - ay) * STEP_X, (ax + ay) * STEP_Y];
}

function edgeToDir(edge: "nw" | "ne" | "corner"): Direction {
  return edge === "ne" ? "sw" : "se";
}

function toolGlowColor(cat: ToolCategory): string {
  switch (cat) {
    case "code":
      return "rgba(56, 189, 248, 0.35)";
    case "shell":
      return "rgba(245, 158, 11, 0.38)";
    case "search":
      return "rgba(34, 197, 94, 0.35)";
    case "error":
      return "rgba(239, 68, 68, 0.55)";
    default:
      return "rgba(56, 189, 248, 0.12)";
  }
}

export class IsoRenderer {
  lastHitBoxes: ScreenHitBox[] = [];

  render(ctx: CanvasRenderingContext2D, input: RenderSceneInput): void {
    const { state, campus, camera, atlas, employees, syncPackets, ghost, timeMs } = input;
    const theme: ThemeMode = state.theme;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const zoom = camera.zoom;
    const bounds = camera.getVisibleWorldBounds(width, height, 150);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme === "day" ? "#cbd5e1" : "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const drawSprite = (
      sprite: ResolvedSpriteFrame,
      wx: number,
      wy: number,
      opts?: { alpha?: number; popScaleY?: number; emissive?: boolean },
    ): { sx: number; sy: number; sw: number; sh: number } => {
      const [baseSX, baseSY] = camera.worldToScreen(wx - sprite.anchor.x, wy - sprite.anchor.y);
      const sw = sprite.frame.w * zoom;
      const sh = sprite.frame.h * zoom;
      const pop = opts?.popScaleY ?? 1;
      const drawH = Math.round(sh * pop);
      const drawY = baseSY + (sh - drawH);

      if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      const img = opts?.emissive ? sprite.emissiveImage : sprite.image;
      if (img) {
        ctx.drawImage(
          img,
          sprite.frame.x,
          sprite.frame.y,
          sprite.frame.w,
          sprite.frame.h,
          baseSX,
          drawY,
          sw,
          drawH,
        );
      }
      if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
      return { sx: baseSX, sy: drawY, sw, sh: drawH };
    };

    // 1. Floors (viewport culled)
    const visibleFloors = campus.floors
      .filter((f) => {
        const [wx, wy] = toAnchorWorld(f.tx, f.ty, 1, 1);
        return isInWorldBounds(wx, wy, bounds);
      })
      .sort((a, b) => a.tx + a.ty - (b.tx + b.ty) || a.tx - b.tx);

    for (const f of visibleFloors) {
      const sprite = atlas.getFrame(theme, f.assetId, f.direction, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(f.tx, f.ty, 1, 1);
      drawSprite(sprite, wx, wy);
    }

    // Subtle colored floor accent strips for each Project Bay
    const bayById = new Map(state.bays.map((b) => [b.id, b]));
    for (const z of campus.zones) {
      if (z.kind !== "bay" || !z.bayId) continue;
      const bay = bayById.get(z.bayId);
      if (!bay) continue;
      const [wx, wy] = toAnchorWorld(z.originX + 2.5, z.originY + 5.1, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = camera.worldToScreen(wx, wy);
      ctx.save();
      ctx.fillStyle = bay.accentColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx - 24 * zoom, sy - 2 * zoom, 48 * zoom, 4 * zoom);
      ctx.restore();
    }

    // 2. Outer Rear Walls + Wall Decor
    const wallEvents: Array<{
      tx: number;
      ty: number;
      depthKey: number;
      isDecor: boolean;
      sprite: ResolvedSpriteFrame;
      wx: number;
      wy: number;
    }> = [];

    for (const w of campus.walls) {
      const dir = edgeToDir(w.edge);
      const sprite = atlas.getFrame(theme, w.assetId, dir, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(w.tx, w.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      wallEvents.push({
        tx: w.tx,
        ty: w.ty,
        depthKey: w.tx + sprite.footprintTiles[0] - 1 + w.ty + sprite.footprintTiles[1] - 1,
        isDecor: false,
        sprite,
        wx,
        wy,
      });
    }
    for (const d of campus.wallDecor) {
      const dir = edgeToDir(d.edge);
      const sprite = atlas.getFrame(theme, d.assetId, dir, "default");
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(d.tx, d.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      wallEvents.push({
        tx: d.tx,
        ty: d.ty,
        depthKey: d.tx + sprite.footprintTiles[0] - 1 + d.ty + sprite.footprintTiles[1] - 1,
        isDecor: true,
        sprite,
        wx,
        wy,
      });
    }
    wallEvents.sort((a, b) => a.depthKey - b.depthKey || (a.isDecor ? 1 : -1) - (b.isDecor ? 1 : -1) || a.tx - b.tx);
    for (const we of wallEvents) {
      drawSprite(we.sprite, we.wx, we.wy);
    }

    // 3. Unified Furniture + Animated Characters (topological depth-sort)
    const animFrameForAsset = (assetId: string): string =>
      resolveAssetAnimationFrame(assetId, timeMs, input.catalogById);

    type UnifiedItem =
      | (DepthRenderItem & {
          kind: "furniture";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          zoneId: string;
          assetId: string;
          furnitureId: string;
        })
      | (DepthRenderItem & {
          kind: "employee";
          sprite: ResolvedSpriteFrame;
          wx: number;
          wy: number;
          emp: RenderedEmployeeInput;
        });

    const unified: UnifiedItem[] = [];

    for (const f of campus.worldFurniture) {
      const frameName = animFrameForAsset(f.assetId);
      const sprite = atlas.getFrame(theme, f.assetId, f.direction, frameName);
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(f.tx, f.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      unified.push({
        id: `f:${f.id}`,
        kind: "furniture",
        x: f.tx,
        y: f.ty,
        footprintX: sprite.footprintTiles[0],
        footprintY: sprite.footprintTiles[1],
        sprite,
        wx,
        wy,
        zoneId: f.zoneId,
        assetId: f.assetId,
        furnitureId: f.id,
      });
    }

    // Boss avatar seated permanently at Boss Office (0,0) executive chair
    const bossZone = campus.zones.find((z) => z.kind === "boss");
    if (bossZone) {
      const bossChair = campus.worldFurniture.find(
        (f) => f.zoneId === "boss:0" && f.id === "boss:0-boss-chair",
      );
      const bx = bossChair ? bossChair.tx : bossZone.originX + 2;
      const by = bossChair ? bossChair.ty : bossZone.originY + 1;
      const hasVisitor = employees.some((e) => e.record.visualState === "reporting");
      const bossClip = hasVisitor ? `talk_${Math.floor(timeMs / 350) % 2}` : `idle_${Math.floor(timeMs / 750) % 2}`;
      const bossSprite = atlas.getFrame(theme, "agent-starter", "sw", bossClip);
      if (bossSprite) {
        const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
        if (isInWorldBounds(wx, wy, bounds)) {
          unified.push({
            id: "e:boss-avatar",
            kind: "employee",
            x: bx + 0.2,
            y: by + 0.2,
            footprintX: 0.6,
            footprintY: 0.6,
            sprite: bossSprite,
            wx,
            wy,
            emp: {
              record: {
                id: "boss-avatar",
                bayId: "boss:0",
                spriteId: "agent-starter",
                displayName: "BOSS",
                role: "Boss",
                isEphemeral: false,
                deskIndex: 0,
                visualState: "working",
                toolCategory: "idle",
                lastUpdatedAt: timeMs,
              },
              x: bx,
              y: by,
              direction: "sw",
              clipName: bossClip,
              bubbleIcon: "👑",
              bubbleText: "BOSS",
            },
          });
        }
      }
    }

    for (const emp of employees) {
      const sprite = atlas.getFrame(theme, emp.record.spriteId, emp.direction, emp.clipName);
      if (!sprite) continue;
      const [wx, wy] = toAnchorWorld(emp.x, emp.y, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      unified.push({
        id: `e:${emp.record.id}`,
        kind: "employee",
        x: emp.x + 0.2,
        y: emp.y + 0.2,
        footprintX: 0.6,
        footprintY: 0.6,
        sprite,
        wx,
        wy,
        emp,
      });
    }

    const sorted = sortUnifiedIsoEntities(unified);
    const hitBoxes: ScreenHitBox[] = [];
    const emissiveDraws: Array<{ sprite: ResolvedSpriteFrame; wx: number; wy: number; pop: number }> = [];

    for (const item of sorted) {
      if (item.kind === "furniture") {
        const bayId = item.zoneId.startsWith("bay:") ? item.zoneId.slice(4) : undefined;
        const pop = bayId && input.bayPopAnimations?.has(bayId) ? input.bayPopAnimations.get(bayId)! : 1;
        const box = drawSprite(item.sprite, item.wx, item.wy, { popScaleY: pop });
        hitBoxes.push({ kind: "furniture", id: item.furnitureId, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        if (item.sprite.emissiveImage) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop });
        }
      } else {
        const box = drawSprite(item.sprite, item.wx, item.wy);
        hitBoxes.push({ kind: "employee", id: item.emp.record.id, x: box.sx, y: box.sy, w: box.sw, h: box.sh });
        if (item.sprite.emissiveImage) {
          emissiveDraws.push({ sprite: item.sprite, wx: item.wx, wy: item.wy, pop: 1 });
        }
        // Highlight selected employee ring
        if (input.selectedEmployeeId === item.emp.record.id) {
          const [cx, cy] = camera.worldToScreen(item.wx, item.wy - 4);
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = Math.max(2, zoom);
          ctx.beginPath();
          ctx.ellipse(cx, cy, 14 * zoom, 7 * zoom, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    this.lastHitBoxes = hitBoxes;

    // 4. Emissive Additive Pass (stronger glow at night)
    if (emissiveDraws.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glowAlpha = theme === "night" ? 0.55 : 0.18;
      for (const ed of emissiveDraws) {
        drawSprite(ed.sprite, ed.wx, ed.wy, { alpha: glowAlpha, popScaleY: ed.pop, emissive: true });
      }
      ctx.restore();
    }

    // 5. Decorate Mode Ghost Preview
    if (ghost) {
      const sprite = atlas.getFrame(theme, ghost.assetId, ghost.direction, "default");
      if (sprite) {
        const [wx, wy] = toAnchorWorld(ghost.tx, ghost.ty, sprite.footprintTiles[0], sprite.footprintTiles[1]);
        drawSprite(sprite, wx, wy, { alpha: 0.6 });
        const [gx, gy] = camera.worldToScreen(wx, wy - 6);
        ctx.save();
        ctx.strokeStyle = ghost.valid ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Teamwork Sync Particles between active bay teammates
    for (const pkt of syncPackets) {
      const px = pkt.fromX + (pkt.toX - pkt.fromX) * pkt.progress;
      const py = pkt.fromY + (pkt.toY - pkt.fromY) * pkt.progress;
      const [wx, wy] = toAnchorWorld(px, py, 1, 1);
      const [sx, sy] = camera.worldToScreen(wx, wy - 24 - Math.sin(pkt.progress * Math.PI) * 10);
      ctx.save();
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(sx - 2 * zoom, sy - 2 * zoom, 4 * zoom, 4 * zoom);
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(sx - zoom, sy - zoom, 2 * zoom, 2 * zoom);
      ctx.restore();
    }

    // 7. Bay Nameplates & Employee Speech/Tool Bubbles
    ctx.save();
    ctx.font = `bold ${Math.max(10, 6 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    for (const z of campus.zones) {
      const [wx, wy] = toAnchorWorld(z.originX + 3, z.originY + 5.7, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const [sx, sy] = camera.worldToScreen(wx, wy);
      const bay = z.bayId ? bayById.get(z.bayId) : undefined;
      const label =
        z.kind === "boss"
          ? "👑 BOSS OFFICE"
          : z.kind === "common"
            ? `LOUNGE & MEETING · #${z.zoneId.split(":")[1] ?? "0"}`
            : bay?.displayName ?? z.zoneId;
      const activeTeamCount = z.bayId
        ? employees.filter(
            (e) =>
              e.record.bayId === z.bayId &&
              (e.record.visualState === "working" || e.record.visualState === "teamwork"),
          ).length
        : 0;
      const fullLabel = activeTeamCount >= 2 ? `${label} · TEAM` : label;
      const textW = ctx.measureText(fullLabel).width + 12;
      ctx.fillStyle = theme === "day" ? "rgba(15, 23, 42, 0.82)" : "rgba(10, 14, 26, 0.86)";
      ctx.fillRect(Math.round(sx - textW / 2), Math.round(sy - 10), Math.round(textW), 18);
      ctx.strokeStyle = z.kind === "boss" ? "#f59e0b" : bay?.accentColor ?? "#64748b";
      ctx.lineWidth = z.kind === "boss" ? 1.5 : 1;
      ctx.strokeRect(Math.round(sx - textW / 2), Math.round(sy - 10), Math.round(textW), 18);
      ctx.fillStyle = z.kind === "boss" ? "#fde68a" : "#f8fafc";
      ctx.fillText(fullLabel, Math.round(sx), Math.round(sy + 3));
    }

    // Employee floating bubbles & subtle tool-category aura
    // Floating 👑 BOSS badge above Boss avatar in Boss Office (0,0)
    if (bossZone) {
      const bossChair = campus.worldFurniture.find(
        (f) => f.zoneId === "boss:0" && f.id === "boss:0-boss-chair",
      );
      const bx = bossChair ? bossChair.tx : bossZone.originX + 2;
      const by = bossChair ? bossChair.ty : bossZone.originY + 1;
      const [wx, wy] = toAnchorWorld(bx, by, 1, 1);
      if (isInWorldBounds(wx, wy, bounds)) {
        const [sx, sy] = camera.worldToScreen(wx, wy - 36);
        ctx.font = `700 ${Math.max(10, 5 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const label = "👑 BOSS";
        const bw = ctx.measureText(label).width + 10;
        const bh = 18;
        ctx.fillStyle = "rgba(120, 53, 15, 0.92)";
        ctx.fillRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.fillStyle = "#fef3c7";
        ctx.fillText(label, Math.round(sx), Math.round(sy - 5));
      }
    }

    for (const emp of employees) {
      const [wx, wy] = toAnchorWorld(emp.x, emp.y, 1, 1);
      if (!isInWorldBounds(wx, wy, bounds)) continue;
      const bob = Math.sin(timeMs / 400 + emp.x) * 2;
      const [sx, sy] = camera.worldToScreen(wx, wy - 36 + bob);

      if (emp.record.visualState === "working" || emp.record.visualState === "teamwork") {
        ctx.fillStyle = toolGlowColor(emp.record.toolCategory);
        ctx.beginPath();
        ctx.arc(sx, sy + 16 * zoom, 10 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      if (emp.bubbleIcon || emp.bubbleText) {
        const text = emp.bubbleIcon ? `${emp.bubbleIcon}${emp.bubbleText ? ` ${emp.bubbleText}` : ""}` : (emp.bubbleText ?? "");
        const trimmed = text.length > 22 ? `${text.slice(0, 20)}..` : text;
        ctx.font = `600 ${Math.max(10, 5 * zoom)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const bw = ctx.measureText(trimmed).width + 10;
        const bh = 18;
        ctx.fillStyle = emp.record.toolCategory === "error" ? "#7f1d1d" : "rgba(15, 23, 42, 0.92)";
        ctx.fillRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.strokeStyle =
          emp.record.provider === "claude"
            ? "#d97757"
            : emp.record.provider === "gemini"
              ? "#38bdf8"
              : "#94a3b8";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sx - bw / 2), Math.round(sy - bh), Math.round(bw), bh);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(trimmed, Math.round(sx), Math.round(sy - 5));
      }
    }
    ctx.restore();
  }
}
