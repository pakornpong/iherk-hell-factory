import { TILE_PERM } from "../shared/layers.js";
import type { ComputedCampus, Direction } from "../shared/types.js";

const FACING: Record<Direction, readonly [number, number]> = {
  ne: [1, 0],
  sw: [-1, 0],
  se: [0, 1],
  nw: [0, -1],
};

/** A single chair can straddle the two tiles along a desk's seating edge. */
export function getCenteredChairTile(
  campus: Pick<ComputedCampus, "widthTiles" | "depthTiles" | "worldFurniture" | "tilePermissions" | "wallSegments">,
  tx: number,
  ty: number,
  direction: Direction,
  chairId?: string,
): [number, number] {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return [tx, ty];
  const [dx, dy] = FACING[direction];
  const frontX = tx + dx;
  const frontY = ty + dy;
  const desk = campus.worldFurniture.find((item) =>
    (item.assetId.startsWith("desk-") || item.assetId.startsWith("table-")) &&
    item.footprintTiles[dx === 0 ? 0 : 1] === 2 &&
    frontX >= item.tx && frontX < item.tx + item.footprintTiles[0] &&
    frontY >= item.ty && frontY < item.ty + item.footprintTiles[1],
  );
  if (!desk || !Number.isInteger(desk.tx) || !Number.isInteger(desk.ty)) return [tx, ty];

  const otherX = dx === 0 ? desk.tx * 2 + 1 - tx : tx;
  const otherY = dy === 0 ? desk.ty * 2 + 1 - ty : ty;
  const crossesDivider = campus.wallSegments?.some(({ blocks }) => blocks && (
    dx === 0
      ? blocks.side === "w" && blocks.x === Math.max(tx, otherX) && blocks.y === ty
      : blocks.side === "n" && blocks.x === tx && blocks.y === Math.max(ty, otherY)
  ));
  const otherPermission = campus.tilePermissions?.[otherY * campus.widthTiles + otherX];
  if (
    otherX < 0 || otherX >= campus.widthTiles || otherY < 0 || otherY >= campus.depthTiles ||
    otherPermission === TILE_PERM.BLOCKED || crossesDivider ||
    campus.worldFurniture.some((item) =>
      item.id !== chairId &&
      otherX >= item.tx && otherX < item.tx + item.footprintTiles[0] &&
      otherY >= item.ty && otherY < item.ty + item.footprintTiles[1],
    )
  ) return [tx, ty];

  return [(tx + otherX) / 2, (ty + otherY) / 2];
}

/** Prefer the designated chair, then a replacement within the Boss corner. */
export function findBossChair(campus: Pick<ComputedCampus, "zones" | "worldFurniture">) {
  const designated = campus.worldFurniture.find((item) => item.id === "boss:0-boss-chair");
  if (designated) return designated;

  const zone = campus.zones.find((item) => item.kind === "boss");
  if (!zone) return;
  return campus.worldFurniture
    .filter((item) =>
      item.assetId === "chair-office-swivel" && !item.id.startsWith("boss:0-visitor-") &&
      item.tx >= zone.originX && item.tx < zone.originX + zone.width &&
      item.ty >= zone.originY && item.ty < zone.originY + zone.height,
    )
    .sort((a, b) => {
      const distance = (item: typeof a) =>
        Math.abs(item.tx - zone.originX - 2) + Math.abs(item.ty - zone.originY - 1);
      return distance(a) - distance(b) || a.id.localeCompare(b.id);
    })[0];
}
