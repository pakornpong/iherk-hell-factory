import type { Direction, FurnitureInstance, WorldFurnitureInstance } from "../shared/types.js";

const DIR_ORDER: Direction[] = ["se", "sw", "nw", "ne"];

export interface DecorateApiClient {
  placeFurniture(req: {
    tx: number;
    ty: number;
    assetId: string;
    direction: Direction;
  }): Promise<FurnitureInstance>;
  moveFurniture?(
    instanceId: string,
    req: { tx: number; ty: number; direction?: Direction },
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

export class DecorateController {
  active = false;
  tool: "place" | "move" | "erase" = "place";
  selectedAssetId: string | null = "plant-potted";
  direction: Direction = "se";
  floorBrushSize: 1 | 2 | 3 = 1;
  floorResetMode = false;
  movingItem: { item: FurnitureInstance; originTx: number; originTy: number } | null = null;
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

  setTool(tool: "place" | "move" | "erase"): void {
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

  async handleTileClick(
    tx: number,
    ty: number,
    existingInstance?: FurnitureInstance | WorldFurnitureInstance,
  ): Promise<void> {
    if (!this.active) return;

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
      if (!this.api.moveFurniture) return;
      const picked = this.movingItem;
      await this.api.moveFurniture(picked.item.id, { tx, ty, direction: this.direction });
      this.undoStack.push({
        kind: "move",
        itemId: picked.item.id,
        fromTx: picked.originTx,
        fromTy: picked.originTy,
        fromDir: picked.item.direction,
        toTx: tx,
        toTy: ty,
        toDir: this.direction,
      });
      this.redoStack.length = 0;
      this.movingItem = null;
      return;
    }

    if (!this.selectedAssetId) return;
    const created = await this.api.placeFurniture({
      tx,
      ty,
      assetId: this.selectedAssetId,
      direction: this.direction,
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
      });
      this.redoStack.push({ ...action, item: recreated });
    } else if (action.kind === "move" && this.api.moveFurniture) {
      await this.api.moveFurniture(action.itemId, {
        tx: action.fromTx,
        ty: action.fromTy,
        direction: action.fromDir,
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
      });
      this.undoStack.push({ ...action, item: recreated });
    } else if (action.kind === "remove") {
      await this.api.removeFurniture(action.item.id);
      this.undoStack.push(action);
    } else if (action.kind === "move" && this.api.moveFurniture) {
      await this.api.moveFurniture(action.itemId, {
        tx: action.toTx,
        ty: action.toTy,
        direction: action.toDir,
      });
      this.undoStack.push(action);
    } else if (action.kind === "floor" && this.api.paintFloorTiles) {
      await this.api.paintFloorTiles(action.changes.map((c) => ({ tx: c.tx, ty: c.ty, assetId: c.after })));
      this.undoStack.push(action);
    }
  }
}
