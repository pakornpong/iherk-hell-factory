import { supportsHalfTilePlacement } from "../shared/layers.js";
import type { WallMountSelection } from "../shared/wall-mounts.js";
import type { Direction, FurnitureInstance, WorldFurnitureInstance } from "../shared/types.js";

const DIR_ORDER: Direction[] = ["se", "sw", "nw", "ne"];

export interface DecorateApiClient {
  placeFurniture(req: Partial<WallMountSelection> & {
    tx: number;
    ty: number;
    assetId: string;
    direction: Direction;
    manualPosition?: boolean;
  }): Promise<FurnitureInstance>;
  moveFurniture?(
    instanceId: string,
    req: Partial<WallMountSelection> & { tx: number; ty: number; direction?: Direction; manualPosition?: boolean },
  ): Promise<FurnitureInstance>;
  removeFurniture(instanceId: string): Promise<void>;
  paintFloorTiles?(
    tiles: Array<{ tx: number; ty: number; assetId: string | null }>,
  ): Promise<void>;
}

type HistoryAction =
  | { kind: "place"; item: FurnitureInstance; tx: number; ty: number }
  | { kind: "remove"; item: FurnitureInstance; tx: number; ty: number }
  | {
      kind: "move";
      itemId: string;
      fromTx: number;
      fromTy: number;
      fromDir: Direction;
      toTx: number;
      toTy: number;
      toDir: Direction;
      wallMount?: { before: WallMountSelection; after: WallMountSelection };
      manualPosition?: { before: boolean; after: boolean };
    }
  | {
      kind: "floor";
      changes: Array<{ tx: number; ty: number; before: string | null; after: string | null }>;
    };

export function isEditableFurniture(item?: FurnitureInstance): item is FurnitureInstance {
  return Boolean(item && !item.id.startsWith("sys-div-"));
}

export function isFloorAssetId(assetId?: string | null): boolean {
  return Boolean(assetId && assetId.startsWith("floor-"));
}

function getWallMount(item: FurnitureInstance): WallMountSelection | undefined {
  if (!item.wallMountId) return;
  return { wallMountId: item.wallMountId, wallMountPosition: item.wallMountPosition };
}

export class DecorateController {
  active = false;
  tool: "place" | "move" | "erase" | "owner" = "place";
  selectedAssetId: string | null = "plant-potted";
  direction: Direction = "se";
  floorBrushSize: 1 | 2 | 3 = 1;
  floorResetMode = false;
  movingItem: { item: FurnitureInstance; originTx: number; originTy: number; keyboardTarget?: [number, number] } | null = null;
  private movePending = false;
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];

  constructor(private readonly api: DecorateApiClient) {}

  isFloorPainting(): boolean {
    return this.tool === "place" && (this.floorResetMode || isFloorAssetId(this.selectedAssetId));
  }

  setFloorBrushSize(size: 1 | 2 | 3): void {
    this.floorBrushSize = size;
  }

  toggleFloorResetMode(): void {
    this.floorResetMode = !this.floorResetMode;
    if (this.floorResetMode) {
      this.tool = "place";
      this.movingItem = null;
    }
  }

  toggle(): void {
    this.active = !this.active;
    if (!this.active) this.movingItem = null;
  }

  setActive(next: boolean): void {
    this.active = next;
    if (!this.active) this.movingItem = null;
  }

  setTool(tool: "place" | "move" | "erase" | "owner"): void {
    this.tool = tool;
    this.movingItem = null;
    if (tool !== "place") this.floorResetMode = false;
  }

  cancelMove(): boolean {
    if (!this.movingItem) return false;
    this.movingItem = null;
    return true;
  }

  selectAsset(assetId: string): void {
    this.selectedAssetId = assetId;
    this.tool = "place";
    this.movingItem = null;
    this.floorResetMode = false;
  }

  rotateCw(): void {
    const idx = DIR_ORDER.indexOf(this.direction);
    this.direction = DIR_ORDER[(idx + 1) % DIR_ORDER.length];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getPointerPlacementTarget(x: number, y: number): [number, number] {
    const assetId = this.tool === "place" ? this.selectedAssetId : this.movingItem?.item.assetId;
    const scale = assetId && supportsHalfTilePlacement(assetId) ? 2 : 1;
    return [Math.floor(x * scale) / scale, Math.floor(y * scale) / scale];
  }

  resetLayoutHistory(): void {
    this.movingItem = null;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  nudgeMove(dx: number, dy: number, visualOrigin?: [number, number]): void {
    const item = this.movingItem;
    if (!item || this.movePending) return;
    const [x, y] = item.keyboardTarget ?? visualOrigin ?? [item.originTx, item.originTy];
    const step = supportsHalfTilePlacement(item.item.assetId) ? 0.5 : 1;
    item.keyboardTarget = [x + dx * step, y + dy * step];
  }

  resumePointerMove(): void {
    if (this.movingItem) delete this.movingItem.keyboardTarget;
  }

  async handleTileClick(
    tx: number,
    ty: number,
    existingInstance?: FurnitureInstance | WorldFurnitureInstance,
    wallMount?: WallMountSelection,
  ): Promise<void> {
    if (!this.active || this.tool === "owner") return;

    const itemOriginTx = (existingInstance as Partial<WorldFurnitureInstance> | undefined)?.tx ?? tx;
    const itemOriginTy = (existingInstance as Partial<WorldFurnitureInstance> | undefined)?.ty ?? ty;

    if (this.tool === "erase") {
      if (!isEditableFurniture(existingInstance)) return;
      await this.api.removeFurniture(existingInstance.id);
      this.undoStack.push({ kind: "remove", item: existingInstance, tx: itemOriginTx, ty: itemOriginTy });
      this.redoStack.length = 0;
      return;
    }

    if (this.tool === "move") {
      if (!this.movingItem) {
        if (!isEditableFurniture(existingInstance)) return;
        this.movingItem = { item: existingInstance, originTx: itemOriginTx, originTy: itemOriginTy };
        this.direction = existingInstance.direction;
        return;
      }
      if (!this.api.moveFurniture || this.movePending) return;
      const picked = this.movingItem;
      const direction = this.direction;
      const manualPosition = picked.item.assetId === "chair-office-swivel" ? true : undefined;
      this.movePending = true;
      try {
        await this.api.moveFurniture(picked.item.id, {
          tx, ty, direction, ...wallMount, ...(manualPosition !== undefined ? { manualPosition } : {}),
        });
      } finally {
        this.movePending = false;
      }
      const previousMount = getWallMount(picked.item);
      this.undoStack.push({
        kind: "move",
        itemId: picked.item.id,
        fromTx: picked.originTx,
        fromTy: picked.originTy,
        fromDir: picked.item.direction,
        toTx: tx,
        toTy: ty,
        toDir: direction,
        ...(previousMount && wallMount
          ? { wallMount: { before: previousMount, after: wallMount } }
          : {}),
        ...(manualPosition !== undefined
          ? { manualPosition: { before: picked.item.manualPosition ?? false, after: manualPosition } }
          : {}),
      });
      this.redoStack.length = 0;
      if (this.movingItem === picked) this.movingItem = null;
      return;
    }

    if (!this.selectedAssetId) return;
    const created = await this.api.placeFurniture({
      tx,
      ty,
      assetId: this.selectedAssetId,
      direction: this.direction,
      ...wallMount,
      ...(this.selectedAssetId === "chair-office-swivel" ? { manualPosition: true } : {}),
    });
    this.undoStack.push({ kind: "place", item: created, tx, ty });
    this.redoStack.length = 0;
  }

  async paintFloorAt(
    tx: number,
    ty: number,
    campusWidth: number,
    campusHeight: number,
    currentOverrides?: Record<string, string>,
    overrideAssetId?: string | null,
  ): Promise<boolean> {
    if (!this.active || !this.api.paintFloorTiles) return false;
    const targetAsset =
      overrideAssetId !== undefined ? overrideAssetId : this.floorResetMode ? null : this.selectedAssetId;
    if (targetAsset !== null && !isFloorAssetId(targetAsset)) return false;

    const size = overrideAssetId !== undefined ? 1 : this.floorBrushSize;
    const changes: Array<{ tx: number; ty: number; before: string | null; after: string | null }> = [];
    const payload: Array<{ tx: number; ty: number; assetId: string | null }> = [];
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = tx + dx;
        const cy = ty + dy;
        if (cx < 0 || cy < 0 || cx >= campusWidth || cy >= campusHeight) continue;
        const before = currentOverrides?.[`${cx},${cy}`] ?? null;
        if (before === targetAsset) continue;
        changes.push({ tx: cx, ty: cy, before, after: targetAsset });
        payload.push({ tx: cx, ty: cy, assetId: targetAsset });
      }
    }
    if (payload.length === 0) return false;
    await this.api.paintFloorTiles(payload);
    this.undoStack.push({ kind: "floor", changes });
    this.redoStack.length = 0;
    return true;
  }

  async undo(): Promise<void> {
    const action = this.undoStack.pop();
    if (!action) return;
    if (action.kind === "place") {
      await this.api.removeFurniture(action.item.id);
      this.redoStack.push(action);
    } else if (action.kind === "remove") {
      const recreated = await this.api.placeFurniture({
        tx: action.tx,
        ty: action.ty,
        assetId: action.item.assetId,
        direction: action.item.direction,
        ...getWallMount(action.item),
        ...(action.item.manualPosition !== undefined ? { manualPosition: action.item.manualPosition } : {}),
      });
      this.remapHistoryId(action.item.id, recreated.id);
      this.redoStack.push({ ...action, item: recreated });
    } else if (action.kind === "move" && this.api.moveFurniture) {
      await this.api.moveFurniture(action.itemId, {
        tx: action.fromTx,
        ty: action.fromTy,
        direction: action.fromDir,
        ...action.wallMount?.before,
        ...(action.manualPosition ? { manualPosition: action.manualPosition.before } : {}),
      });
      this.redoStack.push(action);
    } else if (action.kind === "floor" && this.api.paintFloorTiles) {
      await this.api.paintFloorTiles(action.changes.map((c) => ({ tx: c.tx, ty: c.ty, assetId: c.before })));
      this.redoStack.push(action);
    }
  }

  async redo(): Promise<void> {
    const action = this.redoStack.pop();
    if (!action) return;
    if (action.kind === "place") {
      const recreated = await this.api.placeFurniture({
        tx: action.tx,
        ty: action.ty,
        assetId: action.item.assetId,
        direction: action.item.direction,
        ...getWallMount(action.item),
        ...(action.item.manualPosition !== undefined ? { manualPosition: action.item.manualPosition } : {}),
      });
      this.remapHistoryId(action.item.id, recreated.id);
      this.undoStack.push({ ...action, item: recreated });
    } else if (action.kind === "remove") {
      await this.api.removeFurniture(action.item.id);
      this.undoStack.push(action);
    } else if (action.kind === "move" && this.api.moveFurniture) {
      await this.api.moveFurniture(action.itemId, {
        tx: action.toTx,
        ty: action.toTy,
        direction: action.toDir,
        ...action.wallMount?.after,
        ...(action.manualPosition ? { manualPosition: action.manualPosition.after } : {}),
      });
      this.undoStack.push(action);
    } else if (action.kind === "floor" && this.api.paintFloorTiles) {
      await this.api.paintFloorTiles(action.changes.map((c) => ({ tx: c.tx, ty: c.ty, assetId: c.after })));
      this.undoStack.push(action);
    }
  }

  private remapHistoryId(oldId: string, newId: string): void {
    const remapHost = (mountId: string) => {
      for (const kind of ["ef:", "panel:"]) {
        const prefix = `${kind}${oldId}:`;
        if (mountId.startsWith(prefix)) return `${kind}${newId}:${mountId.slice(prefix.length)}`;
      }
      return mountId;
    };
    for (const action of [...this.undoStack, ...this.redoStack]) {
      if (action.kind === "move") {
        if (action.itemId === oldId) action.itemId = newId;
        if (action.wallMount) {
          for (const mount of [action.wallMount.before, action.wallMount.after]) {
            mount.wallMountId = remapHost(mount.wallMountId);
          }
        }
      } else if (action.kind !== "floor") {
        action.item = {
          ...action.item,
          id: action.item.id === oldId ? newId : action.item.id,
          ...(action.item.wallMountId ? { wallMountId: remapHost(action.item.wallMountId) } : {}),
        };
      }
    }
  }
}
