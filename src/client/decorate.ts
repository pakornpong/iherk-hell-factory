import type { Direction, FurnitureInstance } from "../shared/types.js";

const DIR_ORDER: Direction[] = ["se", "sw", "nw", "ne"];

export interface DecorateApiClient {
  placeFurniture(req: {
    tx: number;
    ty: number;
    assetId: string;
    direction: Direction;
  }): Promise<FurnitureInstance>;
  removeFurniture(instanceId: string): Promise<void>;
}

type HistoryAction =
  | { kind: "place"; item: FurnitureInstance; tx: number; ty: number }
  | { kind: "remove"; item: FurnitureInstance; tx: number; ty: number };

export class DecorateController {
  active = false;
  tool: "place" | "erase" = "place";
  selectedAssetId: string | null = "plant-potted";
  direction: Direction = "se";
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];

  constructor(private readonly api: DecorateApiClient) {}

  toggle(): void {
    this.active = !this.active;
  }

  setActive(next: boolean): void {
    this.active = next;
  }

  setTool(tool: "place" | "erase"): void {
    this.tool = tool;
  }

  selectAsset(assetId: string): void {
    this.selectedAssetId = assetId;
    this.tool = "place";
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

  async handleTileClick(tx: number, ty: number, existingInstance?: FurnitureInstance): Promise<void> {
    if (!this.active) return;
    if (this.tool === "erase") {
      if (!existingInstance) return;
      await this.api.removeFurniture(existingInstance.id);
      this.undoStack.push({ kind: "remove", item: existingInstance, tx, ty });
      this.redoStack.length = 0;
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

  async undo(): Promise<void> {
    const action = this.undoStack.pop();
    if (!action) return;
    if (action.kind === "place") {
      await this.api.removeFurniture(action.item.id);
      this.redoStack.push(action);
    } else {
      const recreated = await this.api.placeFurniture({
        tx: action.tx,
        ty: action.ty,
        assetId: action.item.assetId,
        direction: action.item.direction,
      });
      this.redoStack.push({ ...action, item: recreated });
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
    } else {
      await this.api.removeFurniture(action.item.id);
      this.undoStack.push(action);
    }
  }
}
