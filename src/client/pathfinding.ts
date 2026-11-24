import type { ComputedCampus } from "../shared/types.js";

export interface WalkableGrid {
  width: number;
  height: number;
  blocked: Uint8Array;
}

const PASSABLE_INTERACTION_ASSETS = new Set(["chair-office-swivel"]);

export function buildWalkableGrid(campus: ComputedCampus): WalkableGrid {
  const width = Math.max(1, campus.widthTiles);
  const height = Math.max(1, campus.depthTiles);
  const blocked = new Uint8Array(width * height);

  for (const f of campus.worldFurniture) {
    if (f.layer !== "object") continue;
    if (PASSABLE_INTERACTION_ASSETS.has(f.assetId)) continue;
    const [fw, fd] = f.footprintTiles;
    for (let dy = 0; dy < fd; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        const tx = f.tx + dx;
        const ty = f.ty + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          blocked[ty * width + tx] = 1;
        }
      }
    }
  }
  return { width, height, blocked };
}

export function findTilePath(
  grid: WalkableGrid,
  startRaw: [number, number],
  goalRaw: [number, number],
  maxExpansions = 2500,
): Array<[number, number]> {
  const clampX = (x: number) => Math.max(0, Math.min(grid.width - 1, Math.round(x)));
  const clampY = (y: number) => Math.max(0, Math.min(grid.height - 1, Math.round(y)));

  const sx = clampX(startRaw[0]);
  const sy = clampY(startRaw[1]);
  const gx = clampX(goalRaw[0]);
  const gy = clampY(goalRaw[1]);

  if (sx === gx && sy === gy) return [[sx, sy]];

  const idx = (x: number, y: number) => y * grid.width + x;
  const h = (x: number, y: number) => Math.abs(x - gx) + Math.abs(y - gy);

  const open: number[] = [idx(sx, sy)];
  const inOpen = new Uint8Array(grid.width * grid.height);
  const closed = new Uint8Array(grid.width * grid.height);
  const cameFrom = new Int32Array(grid.width * grid.height).fill(-1);
  const gScore = new Float32Array(grid.width * grid.height).fill(Infinity);
  const fScore = new Float32Array(grid.width * grid.height).fill(Infinity);

  const startIdx = idx(sx, sy);
  const goalIdx = idx(gx, gy);
  inOpen[startIdx] = 1;
  gScore[startIdx] = 0;
  fScore[startIdx] = h(sx, sy);

  let bestFallbackIdx = startIdx;
  let bestFallbackDist = h(sx, sy);
  let expansions = 0;

  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0 && expansions < maxExpansions) {
    expansions++;
    // Pick lowest fScore in open list
    let bestPos = 0;
    let current = open[0];
    let bestF = fScore[current];
    for (let i = 1; i < open.length; i++) {
      const node = open[i];
      if (fScore[node] < bestF) {
        bestF = fScore[node];
        current = node;
        bestPos = i;
      }
    }

    open.splice(bestPos, 1);
    inOpen[current] = 0;
    closed[current] = 1;

    const cx = current % grid.width;
    const cy = Math.floor(current / grid.width);
    const distToGoal = h(cx, cy);
    if (grid.blocked[current] === 0 && distToGoal < bestFallbackDist) {
      bestFallbackDist = distToGoal;
      bestFallbackIdx = current;
    }

    if (current === goalIdx) {
      return reconstructPath(cameFrom, current, grid.width);
    }

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;
      const nIdx = idx(nx, ny);
      if (closed[nIdx]) continue;
      if (grid.blocked[nIdx] !== 0) continue;

      const tentativeG = gScore[current] + 1;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + h(nx, ny);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  return reconstructPath(cameFrom, bestFallbackIdx, grid.width);
}

function reconstructPath(cameFrom: Int32Array, endIdx: number, width: number): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  let cur = endIdx;
  while (cur !== -1) {
    path.push([cur % width, Math.floor(cur / width)]);
    cur = cameFrom[cur];
  }
  path.reverse();
  return path;
}
