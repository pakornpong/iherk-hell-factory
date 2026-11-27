import { isMountedAsset } from "../shared/wall-mounts.js";
import type { RenderLayer, TilePermission } from "../shared/layers.js";
import {
  AMENITY_THEME_META,
  CAMPUS_ZONE_GROUP_META,
  getOrgRoleMeta,
  type CampusZoneGroup,
  type CatalogEntry,
  type ComputedCampus,
  type CustomZoneRecord,
  type CustomZoneRole,
  type EmployeeRecord,
  type OfficeSnapshotPayload,
  type ThemeMode,
} from "../shared/types.js";
import type { AtlasManager } from "./atlas-loader.js";
import { getCatalogCategoryLabel, getCatalogTags, matchesCatalogSearch } from "./catalog-search.js";
import type { DecorateController } from "./decorate.js";
import type { LayerOverlayMode } from "./iso-renderer.js";
import type { SimEmployeeVisual } from "./sim.js";

export type LayerBrush = "inspect" | "auto" | TilePermission;

export interface LayerEditorState {
  mode: LayerOverlayMode;
  brush: LayerBrush;
  selectedFurnitureId: string | null;
}

/** Sentinel editingZoneId while the user draws the Boss corner on the map. */
export const BOSS_ZONE_EDIT_ID = "boss:0";

export interface ZoneEditorState {
  active: boolean;
  startTile: [number, number] | null;
  editingZoneId: string | null;
  draftName: string;
  draftIcon: string;
  draftColor: string;
  draftRole: CustomZoneRole;
}

export interface HudCallbacks {
  onFocusBay(bayId: string): void;
  onFocusZoneGroup?(group: CampusZoneGroup): void;
  onFocusCustomZone?(zone: CustomZoneRecord): void;
  onEditCustomZone?(zone: CustomZoneRecord): void;
  onCancelEditZone?(): void;
  onSaveEditingZoneMeta?(): void;
  onStartEditPodsZone?(): void;
  onRelocatePodsToZone?(zoneId: string): void;
  onDeleteCustomZone?(zoneId: string): void;
  onResizeFloor?(delta: { deltaWidth?: number; deltaDepth?: number }): void;
  onResizeBossZone?(delta: { deltaWidth?: number; deltaDepth?: number }): void;
  onStartDrawBossZone?(): void;
  onToggleZonePanel?(open?: boolean): void;
  onZoneDraftChanged?(): void;
  onFocusEmployee?(employeeId: string): void;
  onToggleArchive(bayId: string, archived: boolean): void;
  onSetTheme(theme: ThemeMode): void;
  onToggleDemo(): void;
  onSetZoom(zoom: number): void;
  onRotateView(turn: -1 | 1): void;
  onSelectEmployee(id: string | null): void;
  onMinimapClick(tx: number, ty: number): void;
  onDecorateChanged(): void;
  onLayerOverlayChange?(mode: LayerOverlayMode): void;
  onLayerBrushChange?(brush: LayerBrush): void;
  onResetTilePermissions?(): void;
  onSetFurnitureLayer?(instanceId: string, layer: RenderLayer): void;
}

const STATE_LABELS: Record<string, string> = {
  assigning: "📋 Assigning",
  working: "💻 Working",
  teamwork: "🤝 Teamwork",
  meeting: "💬 Meeting",
  reporting: "👑 Reporting to Boss",
  resting: "💤 Resting",
};

const THEME_CYCLE: readonly ThemeMode[] = ["office", "night", "day"] as const;

const THEME_LABELS: Record<ThemeMode, string> = {
  office: "🏢 Office",
  night: "🌙 Night",
  day: "☀️ Day",
};

export function nextThemeMode(current: ThemeMode): ThemeMode {
  const idx = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
}

export function isEmployeeActive(emp: EmployeeRecord): boolean {
  return emp.visualState !== "resting";
}

const ACTIVE_STATE_PRIORITY: Record<string, number> = {
  reporting: 0,
  working: 1,
  teamwork: 2,
  assigning: 3,
  meeting: 4,
  resting: 5,
};

export function sortActiveAgents(employees: readonly EmployeeRecord[]): EmployeeRecord[] {
  return [...employees].sort((a, b) => {
    const aErr = a.toolCategory === "error" ? -1 : 0;
    const bErr = b.toolCategory === "error" ? -1 : 0;
    if (aErr !== bErr) return aErr - bErr;
    const pa = ACTIVE_STATE_PRIORITY[a.visualState] ?? 9;
    const pb = ACTIVE_STATE_PRIORITY[b.visualState] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.lastUpdatedAt - a.lastUpdatedAt || a.displayName.localeCompare(b.displayName);
  });
}

function agentStatusColor(emp: EmployeeRecord): string {
  if (emp.toolCategory === "error") return "#ef4444";
  switch (emp.visualState) {
    case "working":
    case "teamwork":
      return "#22c55e";
    case "assigning":
      return "#38bdf8";
    case "meeting":
      return "#a855f7";
    case "reporting":
      return "#f59e0b";
    default:
      return "#64748b";
  }
}

export class OfficeHud {
  private baySearch = "";
  private catalogSearch = "";
  private catalogCategory = "all";
  private catalogPage = 0;
  private catalogSubcategory = "";
  private catalogTag = "";
  private indexedCatalog?: readonly CatalogEntry[];
  private catalogTagsById = new Map<string, string[]>();
  private readonly previewQueue = new Map<HTMLImageElement, () => Promise<void>>();
  private readonly previewJobs = new WeakMap<HTMLImageElement, () => Promise<void>>();
  private readonly previewFailures = new Set<string>();
  private previewLoads = 0;
  private previewObserver?: IntersectionObserver;
  private showArchived = false;
  private activeAgentsTab: "working" | "all" = "working";
  private activeAgentsCollapsed = false;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private lastCampus: ComputedCampus | null = null;
  private lastSelectedLayerFurnId: string | null = null;

  constructor(
    private readonly decorate: DecorateController,
    private readonly cb: HudCallbacks,
  ) {
    this.minimapCanvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext("2d")!;
    this.bindStaticControls();
  }

  private bindStaticControls(): void {
    const searchInput = document.getElementById("bay-search") as HTMLInputElement;
    searchInput.addEventListener("input", () => {
      this.baySearch = searchInput.value.trim().toLowerCase();
      this.cb.onDecorateChanged();
    });

    const catSearchInput = document.getElementById("catalog-search") as HTMLInputElement | null;
    catSearchInput?.addEventListener("input", () => {
      this.catalogSearch = catSearchInput.value.trim().toLowerCase();
      this.catalogPage = 0;
      this.cb.onDecorateChanged();
    });

    const subcategory = document.getElementById("catalog-subcategory") as HTMLSelectElement;
    subcategory.addEventListener("change", () => {
      this.catalogSubcategory = subcategory.value;
      this.catalogTag = "";
      this.catalogPage = 0;
      this.cb.onDecorateChanged();
    });
    const tag = document.getElementById("catalog-tag") as HTMLSelectElement;
    tag.addEventListener("change", () => {
      this.catalogTag = tag.value;
      this.catalogPage = 0;
      this.cb.onDecorateChanged();
    });

    const archToggle = document.getElementById("toggle-archived") as HTMLButtonElement;
    archToggle.addEventListener("click", () => {
      this.showArchived = !this.showArchived;
      archToggle.classList.toggle("active", this.showArchived);
      this.cb.onDecorateChanged();
    });

    const btnDecorate = document.getElementById("btn-decorate") as HTMLButtonElement;
    btnDecorate.addEventListener("click", () => {
      this.decorate.toggle();
      if (this.decorate.active) {
        this.cb.onLayerOverlayChange?.("off");
        this.cb.onToggleZonePanel?.(false);
      }
      this.cb.onDecorateChanged();
    });

    document.getElementById("btn-shrink-floor")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: -6, deltaDepth: -6 });
    });
    document.getElementById("btn-expand-floor")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: 6, deltaDepth: 6 });
    });

    document.getElementById("btn-zones")?.addEventListener("click", () => {
      this.cb.onToggleZonePanel?.();
    });

    for (const [id, delta] of [
      ["btn-boss-w-minus", { deltaWidth: -1 }],
      ["btn-boss-w-plus", { deltaWidth: 1 }],
      ["btn-boss-d-minus", { deltaDepth: -1 }],
      ["btn-boss-d-plus", { deltaDepth: 1 }],
    ] as const) {
      document.getElementById(id)?.addEventListener("click", () => this.cb.onResizeBossZone?.(delta));
    }

    document.getElementById("btn-floor-w-minus")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: -2, deltaDepth: 0 });
    });
    document.getElementById("btn-floor-w-plus")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: 2, deltaDepth: 0 });
    });
    document.getElementById("btn-floor-d-minus")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: 0, deltaDepth: -2 });
    });
    document.getElementById("btn-floor-d-plus")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: 0, deltaDepth: 2 });
    });
    document.getElementById("btn-floor-shrink6")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: -6, deltaDepth: -6 });
    });
    document.getElementById("btn-floor-grow6")?.addEventListener("click", () => {
      this.cb.onResizeFloor?.({ deltaWidth: 6, deltaDepth: 6 });
    });

    const btnLayers = document.getElementById("btn-layers") as HTMLButtonElement | null;
    btnLayers?.addEventListener("click", () => {
      const panel = document.getElementById("layer-panel");
      const isOpen = panel ? !panel.classList.contains("hidden") : false;
      if (isOpen) {
        this.cb.onLayerOverlayChange?.("off");
      } else {
        this.decorate.setActive(false);
        this.cb.onToggleZonePanel?.(false);
        this.cb.onLayerOverlayChange?.("permissions");
      }
      this.cb.onDecorateChanged();
    });

    document.getElementById("layer-mode-permissions")?.addEventListener("click", () => {
      this.cb.onLayerOverlayChange?.("permissions");
      this.cb.onDecorateChanged();
    });
    document.getElementById("layer-mode-layers")?.addEventListener("click", () => {
      this.cb.onLayerOverlayChange?.("layers");
      this.cb.onDecorateChanged();
    });

    const brushButtons = document.querySelectorAll<HTMLButtonElement>(".layer-brush-btn");
    brushButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.dataset.brush ?? "inspect";
        const brush: LayerBrush =
          raw === "0" ? 0 : raw === "1" ? 1 : raw === "2" ? 2 : raw === "3" ? 3 : raw === "auto" ? "auto" : "inspect";
        this.cb.onLayerBrushChange?.(brush);
        this.cb.onDecorateChanged();
      });
    });

    document.getElementById("btn-reset-perms")?.addEventListener("click", () => {
      this.cb.onResetTilePermissions?.();
    });

    const elevButtons = document.querySelectorAll<HTMLButtonElement>(".layer-elev-btn");
    elevButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.lastSelectedLayerFurnId) return;
        const layerNum = Number(btn.dataset.layer) as RenderLayer;
        if (layerNum >= 1 && layerNum <= 7) {
          this.cb.onSetFurnitureLayer?.(this.lastSelectedLayerFurnId, layerNum);
        }
      });
    });

    const btnRotate = document.getElementById("btn-rotate") as HTMLButtonElement;
    btnRotate.addEventListener("click", () => {
      this.decorate.rotateCw();
      this.cb.onDecorateChanged();
    });

    const btnMove = document.getElementById("btn-move") as HTMLButtonElement | null;
    btnMove?.addEventListener("click", () => {
      this.decorate.setTool(this.decorate.tool === "move" ? "place" : "move");
      this.cb.onDecorateChanged();
    });

    const btnErase = document.getElementById("btn-erase") as HTMLButtonElement;
    btnErase.addEventListener("click", () => {
      this.decorate.setTool(this.decorate.tool === "erase" ? "place" : "erase");
      this.cb.onDecorateChanged();
    });

    const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
    btnUndo.addEventListener("click", () => {
      void this.decorate.undo().then(() => this.cb.onDecorateChanged());
    });

    const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
    btnRedo.addEventListener("click", () => {
      void this.decorate.redo().then(() => this.cb.onDecorateChanged());
    });

    document.querySelectorAll<HTMLButtonElement>(".floor-brush-btn[data-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const size = Number(btn.dataset.size);
        if (size === 1 || size === 2 || size === 3) {
          this.decorate.setFloorBrushSize(size);
          this.cb.onDecorateChanged();
        }
      });
    });

    document.getElementById("btn-floor-reset")?.addEventListener("click", () => {
      this.decorate.toggleFloorResetMode();
      this.cb.onDecorateChanged();
    });

    document.getElementById("btn-draw-boss-zone")?.addEventListener("click", () => this.cb.onStartDrawBossZone?.());
    document.getElementById("btn-edit-pods-zone")?.addEventListener("click", () => {
      this.cb.onStartEditPodsZone?.();
    });
    document.getElementById("btn-relocate-pods")?.addEventListener("click", () => {
      const btn = document.getElementById("btn-relocate-pods") as HTMLButtonElement | null;
      const zId = btn?.dataset.zoneId;
      if (zId) this.cb.onRelocatePodsToZone?.(zId);
    });
    document.getElementById("btn-zone-save-meta")?.addEventListener("click", () => {
      this.cb.onSaveEditingZoneMeta?.();
    });
    document.getElementById("btn-zone-cancel-edit")?.addEventListener("click", () => {
      this.cb.onCancelEditZone?.();
    });

    const zoneButtons = document.querySelectorAll<HTMLButtonElement>(".zone-jump-btn");
    zoneButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.zone as CampusZoneGroup | undefined;
        if (val === "hq" || val === "workspace" || val === "amenity" || val === "hypersleep" || val === "floor") {
          this.cb.onFocusZoneGroup?.(val);
        }
      });
    });

    const btnTheme = document.getElementById("btn-theme") as HTMLButtonElement;
    btnTheme.addEventListener("click", () => {
      const current = (btnTheme.dataset.theme as ThemeMode) || "office";
      this.cb.onSetTheme(nextThemeMode(current));
    });

    const btnDemo = document.getElementById("btn-demo") as HTMLButtonElement;
    btnDemo.addEventListener("click", () => {
      this.cb.onToggleDemo();
    });

    for (const z of [1, 2, 3, 4]) {
      const btn = document.getElementById(`zoom-${z}`) as HTMLButtonElement | null;
      btn?.addEventListener("click", () => this.cb.onSetZoom(z));
    }

    document.getElementById("rotate-view-left")?.addEventListener("click", () => this.cb.onRotateView(-1));
    document.getElementById("rotate-view-right")?.addEventListener("click", () => this.cb.onRotateView(1));

    document.getElementById("inspector-close")?.addEventListener("click", () => {
      this.cb.onSelectEmployee(null);
    });

    document.getElementById("btn-toggle-active-panel")?.addEventListener("click", () => {
      this.activeAgentsCollapsed = !this.activeAgentsCollapsed;
      this.cb.onDecorateChanged();
    });

    const activeTabBtns = document.querySelectorAll<HTMLButtonElement>(".active-tab-btn");
    activeTabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab === "all" ? "all" : "working";
        this.activeAgentsTab = tab;
        this.cb.onDecorateChanged();
      });
    });

    this.minimapCanvas.addEventListener("click", (ev) => {
      if (!this.lastCampus) return;
      const rect = this.minimapCanvas.getBoundingClientRect();
      const rx = (ev.clientX - rect.left) / rect.width;
      const ry = (ev.clientY - rect.top) / rect.height;
      this.cb.onMinimapClick(rx * this.lastCampus.widthTiles, ry * this.lastCampus.depthTiles);
    });
  }

  showToast(message: string, isError = false): void {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${isError ? "error" : ""}`;
    setTimeout(() => {
      el.classList.remove("show");
    }, 2800);
  }

  renderHud(
    snapshot: OfficeSnapshotPayload,
    catalog: CatalogEntry[],
    selectedEmployeeId: string | null,
    currentZoom: number,
    layerState?: LayerEditorState,
    atlas?: AtlasManager,
    zoneEditor?: ZoneEditorState,
  ): void {
    this.lastCampus = snapshot.campus;
    const { state, demoMode } = snapshot;

    // Header status counters
    const activeBays = state.bays.filter((b) => !b.archived);
    const workingCount = state.employees.filter(
      (e) => e.visualState === "working" || e.visualState === "teamwork" || e.visualState === "assigning",
    ).length;
    const statsEl = document.getElementById("office-stats");
    if (statsEl) {
      statsEl.textContent = `${snapshot.campus.widthTiles}×${snapshot.campus.depthTiles} · ${activeBays.length} Projects · ${state.employees.length} Staff (${workingCount} active)`;
    }

    // Top buttons
    const btnTheme = document.getElementById("btn-theme") as HTMLButtonElement;
    btnTheme.dataset.theme = state.theme;
    btnTheme.textContent = THEME_LABELS[state.theme] ?? "🏢 Office";

    const btnDemo = document.getElementById("btn-demo") as HTMLButtonElement;
    btnDemo.classList.toggle("active", demoMode);
    btnDemo.textContent = demoMode ? "⏹ Stop Demo" : "▶ Demo Mode";

    const btnDecorate = document.getElementById("btn-decorate") as HTMLButtonElement;
    btnDecorate.classList.toggle("active", this.decorate.active);

    const layerMode: LayerOverlayMode = layerState?.mode ?? "off";
    const layerBrush: LayerBrush = layerState?.brush ?? "inspect";
    const selectedLayerFurnId = layerState?.selectedFurnitureId ?? null;
    this.lastSelectedLayerFurnId = selectedLayerFurnId;
    const layerOpen = layerMode !== "off";
    document.getElementById("btn-layers")?.classList.toggle("active", layerOpen);
    const layerPanel = document.getElementById("layer-panel");
    if (layerPanel) {
      layerPanel.classList.toggle("hidden", !layerOpen);
      document.getElementById("layer-mode-permissions")?.classList.toggle("active", layerMode === "permissions");
      document.getElementById("layer-mode-layers")?.classList.toggle("active", layerMode === "layers");
      document.getElementById("layer-brush-section")?.classList.toggle("hidden", layerMode !== "permissions");
      document.getElementById("layer-elev-section")?.classList.toggle("hidden", layerMode !== "layers");
      const brushButtons = layerPanel.querySelectorAll<HTMLButtonElement>(".layer-brush-btn");
      brushButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.brush === String(layerBrush));
      });
      const overrideCount = Object.keys(state.tilePermissionOverrides ?? {}).length;
      const resetBtn = document.getElementById("btn-reset-perms") as HTMLButtonElement | null;
      if (resetBtn) {
        resetBtn.disabled = overrideCount === 0;
        resetBtn.textContent = `Reset Overrides (${overrideCount})`;
      }

      if (layerMode === "layers") {
        const selectedFurn = selectedLayerFurnId
          ? snapshot.campus.worldFurniture.find((f) => f.id === selectedLayerFurnId) ?? null
          : null;
        const targetEl = document.getElementById("layer-elev-target");
        if (targetEl) {
          targetEl.textContent = selectedFurn
            ? `${selectedFurn.assetId} (${selectedFurn.zoneId} @ ${selectedFurn.tx},${selectedFurn.ty}) · current L${selectedFurn.renderLayer ?? 4}`
            : "Click any furniture piece on the map to adjust its layer.";
        }
        const elevButtons = layerPanel.querySelectorAll<HTMLButtonElement>(".layer-elev-btn");
        elevButtons.forEach((btn) => {
          btn.disabled = !selectedFurn;
          btn.classList.toggle("active", Boolean(selectedFurn && Number(btn.dataset.layer) === (selectedFurn.renderLayer ?? 4)));
        });
      }
    }

    const decoratePanel = document.getElementById("decorate-panel")!;
    decoratePanel.classList.toggle("hidden", !this.decorate.active);
    document.getElementById("btn-rotate")!.textContent = `↻ ${this.decorate.direction.toUpperCase()}`;
    const btnMoveEl = document.getElementById("btn-move");
    if (btnMoveEl) {
      btnMoveEl.classList.toggle("active", this.decorate.tool === "move");
      btnMoveEl.textContent = this.decorate.movingItem ? "✋ Drop…" : "✋ Move";
    }
    const hintEl = decoratePanel.querySelector<HTMLElement>(".hint");
    if (hintEl) {
      hintEl.textContent = this.decorate.movingItem
        ? `Moving ${this.decorate.movingItem.item.assetId} · R: rotate · Esc: cancel`
        : this.decorate.isFloorPainting()
          ? this.decorate.floorResetMode
            ? `Reset Floor (${this.decorate.floorBrushSize}×${this.decorate.floorBrushSize}) · Esc: exit`
            : `Paint Floor (${this.decorate.floorBrushSize}×${this.decorate.floorBrushSize}) · Esc: exit`
          : "R: rotate · Esc: exit";
    }
    const floorBrushBar = document.getElementById("floor-brush-bar");
    if (floorBrushBar) {
      const showFloorBar = this.decorate.isFloorPainting() || this.catalogCategory === "floor";
      floorBrushBar.classList.toggle("hidden", !showFloorBar);
      floorBrushBar.querySelectorAll<HTMLButtonElement>(".floor-brush-btn[data-size]").forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.size) === this.decorate.floorBrushSize);
      });
      document.getElementById("btn-floor-reset")?.classList.toggle("active", this.decorate.floorResetMode);
    }

    // Zones & Floor Panel
    const zoneOpen = Boolean(zoneEditor?.active);
    document.getElementById("btn-zones")?.classList.toggle("active", zoneOpen);
    const zonePanel = document.getElementById("zone-panel");
    if (zonePanel) {
      zonePanel.classList.toggle("hidden", !zoneOpen);
      const sizeEl = document.getElementById("floor-size-readout");
      if (sizeEl) sizeEl.textContent = `${snapshot.campus.widthTiles} × ${snapshot.campus.depthTiles}`;
      const bossZone = snapshot.campus.zones.find((zone) => zone.kind === "boss");
      const bossSizeEl = document.getElementById("boss-size-readout");
      if (bossSizeEl && bossZone) bossSizeEl.textContent = `${bossZone.width} × ${bossZone.height}`;

      const czs = state.customZones ?? [];
      const editingZone = zoneEditor?.editingZoneId ? czs.find((z) => z.id === zoneEditor.editingZoneId) ?? null : null;
      const customPodsZone = czs.find((z) => z.role === "hypersleep") ?? null;

      const btnEditPods = document.getElementById("btn-edit-pods-zone") as HTMLButtonElement | null;
      if (btnEditPods) {
        btnEditPods.textContent = customPodsZone ? "✏️ แก้โซน Pods" : "🧊 กำหนด / ย้ายโซน Pods";
      }
      const btnRelocatePods = document.getElementById("btn-relocate-pods") as HTMLButtonElement | null;
      if (btnRelocatePods) {
        const targetPodsZone = editingZone?.role === "hypersleep" ? editingZone : customPodsZone;
        btnRelocatePods.classList.toggle("hidden", !targetPodsZone);
        if (targetPodsZone) btnRelocatePods.dataset.zoneId = targetPodsZone.id;
      }

      const formTitle = document.getElementById("zone-form-title");
      if (formTitle) {
        formTitle.textContent = editingZone
          ? `EDIT ZONE · ${editingZone.name.toUpperCase()}`
          : "CREATE ZONE (2 CLICKS ON MAP)";
      }
      document.getElementById("zone-edit-actions")?.classList.toggle("hidden", !editingZone);

      const statusEl = document.getElementById("zone-draw-status");
      const drawingBoss = zoneEditor?.editingZoneId === BOSS_ZONE_EDIT_ID;
      if (formTitle && drawingBoss) formTitle.textContent = "DRAW BOSS ZONE";
      if (statusEl && zoneEditor) {
        if (drawingBoss) {
          statusEl.textContent = zoneEditor.startTile
            ? `2. คลิกมุมตรงข้ามของโซน Boss (เริ่ม ${zoneEditor.startTile[0]},${zoneEditor.startTile[1]} · Esc ยกเลิก)`
            : "1. คลิกมุมแรกของโซน Boss บนพื้น (กว้าง 4–12 · ลึก 4–24 ช่อง)";
        } else if (editingZone) {
          statusEl.textContent = zoneEditor.startTile
            ? `2. เลือกมุมตรงข้ามเพื่อย้าย/ปรับขนาด "${editingZone.name}" (เริ่ม ${zoneEditor.startTile[0]},${zoneEditor.startTile[1]})`
            : `แก้ชื่อ/บทบาทแล้วกด 💾 บันทึก หรือคลิก 2 มุมบนพื้นเพื่อย้าย/ปรับขนาดโซนนี้`;
        } else {
          statusEl.textContent = zoneEditor.startTile
            ? `2. เลือกมุมตรงข้ามเพื่อสร้างโซน (เริ่มที่ ${zoneEditor.startTile[0]},${zoneEditor.startTile[1]} · Esc ยกเลิก)`
            : "1. คลิกมุมแรกบนพื้นเพื่อเริ่มลากกรอบโซน";
        }
      }

      const countEl = document.getElementById("custom-zone-count");
      if (countEl) countEl.textContent = String(czs.length);
      const listEl = document.getElementById("custom-zone-list");
      if (listEl) {
        listEl.innerHTML = "";
        if (czs.length === 0) {
          listEl.innerHTML = '<div class="active-empty">ยังไม่มีโซนที่กำหนดเอง</div>';
        } else {
          for (const cz of czs) {
            const row = document.createElement("div");
            row.className = `custom-zone-row${zoneEditor?.editingZoneId === cz.id ? " editing" : ""}`;
            const roleTag =
              cz.role === "work"
                ? " · WORK"
                : cz.role === "meeting"
                  ? " · MEET"
                  : cz.role === "hypersleep"
                    ? " · PODS"
                    : cz.role === "lounge"
                      ? " · LOUNGE"
                      : "";
            row.innerHTML = `
              <div class="custom-zone-main">
                <span class="bay-dot" style="background:${cz.color}"></span>
                <span class="custom-zone-name">${escapeHtml(cz.icon)} ${escapeHtml(cz.name)}</span>
                <span class="custom-zone-meta">${cz.width}×${cz.height}${roleTag}</span>
              </div>
              <div class="custom-zone-actions">
                ${cz.role === "hypersleep" ? '<button class="custom-zone-btn custom-zone-pack" title="จัด Pods ทั้งหมดเข้าโซนนี้">📦</button>' : ""}
                <button class="custom-zone-btn custom-zone-edit" title="แก้ไข / ย้ายกรอบโซน">✏️</button>
                <button class="custom-zone-del" title="ลบโซน">×</button>
              </div>
            `;
            row.querySelector(".custom-zone-main")?.addEventListener("click", () => {
              this.cb.onFocusCustomZone?.(cz);
            });
            row.querySelector(".custom-zone-pack")?.addEventListener("click", (e) => {
              e.stopPropagation();
              this.cb.onRelocatePodsToZone?.(cz.id);
            });
            row.querySelector(".custom-zone-edit")?.addEventListener("click", (e) => {
              e.stopPropagation();
              this.cb.onEditCustomZone?.(cz);
            });
            row.querySelector(".custom-zone-del")?.addEventListener("click", (e) => {
              e.stopPropagation();
              this.cb.onDeleteCustomZone?.(cz.id);
            });
            listEl.appendChild(row);
          }
        }
      }
    }

    // Custom Zone quick-jump chips in left sidebar
    const customJumpEl = document.getElementById("custom-zone-jumps");
    if (customJumpEl) {
      customJumpEl.innerHTML = "";
      for (const cz of state.customZones ?? []) {
        const chip = document.createElement("button");
        chip.className = "zone-jump-btn";
        chip.style.borderColor = cz.color;
        chip.textContent = `${cz.icon} ${cz.name}`;
        chip.addEventListener("click", () => this.cb.onFocusCustomZone?.(cz));
        customJumpEl.appendChild(chip);
      }
    }
    document.getElementById("btn-erase")!.classList.toggle("active", this.decorate.tool === "erase");
    (document.getElementById("btn-undo") as HTMLButtonElement).disabled = !this.decorate.canUndo();
    (document.getElementById("btn-redo") as HTMLButtonElement).disabled = !this.decorate.canRedo();

    for (const z of [1, 2, 3, 4]) {
      document.getElementById(`zoom-${z}`)?.classList.toggle("active", z === currentZoom);
    }

    // Bay Quick-Jump list (flat Workspace list — no departments)
    const bayListEl = document.getElementById("bay-list")!;
    bayListEl.innerHTML = "";
    const filteredBays = state.bays.filter((b) => {
      if (b.archived !== this.showArchived) return false;
      if (!this.baySearch) return true;
      return (
        b.displayName.toLowerCase().includes(this.baySearch) ||
        (b.projectPath?.toLowerCase().includes(this.baySearch) ?? false)
      );
    });

    for (const bay of filteredBays) {
      const team = state.employees.filter((e) => e.bayId === bay.id);
      const hasClaude = team.some((e) => e.provider === "claude");
      const hasGemini = team.some((e) => e.provider === "gemini");
      const hasCodex = team.some((e) => e.provider === "codex");
      const row = document.createElement("div");
      row.className = "bay-item";
      row.innerHTML = `
        <div class="bay-item-main">
          <span class="bay-dot" style="background:${bay.accentColor}"></span>
          <span class="bay-name">${escapeHtml(bay.displayName)}</span>
        </div>
        <div class="bay-item-meta">
          ${hasClaude ? '<span class="badge claude">C</span>' : ""}
          ${hasGemini ? '<span class="badge gemini">G</span>' : ""}
          ${hasCodex ? '<span class="badge" title="Codex">CX</span>' : ""}
          <span class="bay-count">${team.length}</span>
          <button class="bay-arch-btn" title="${bay.archived ? "Restore" : "Archive"}">${bay.archived ? "↩" : "×"}</button>
        </div>
      `;
      row.querySelector(".bay-item-main")?.addEventListener("click", () => {
        if (!bay.archived) this.cb.onFocusBay(bay.id);
      });
      row.querySelector(".bay-arch-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.cb.onToggleArchive(bay.id, !bay.archived);
      });
      bayListEl.appendChild(row);
    }

    // Furniture & Floor Catalog (when Decorate Mode is open)
    if (this.decorate.active) {
      if (this.indexedCatalog !== catalog) {
        this.indexedCatalog = catalog;
        this.catalogTagsById = new Map(catalog.map((item) => [item.id, getCatalogTags(item)]));
      }
      const placeables = catalog
        .filter(
          (c) =>
            (c.layer === "object" || c.layer === "tabletop" || c.layer === "floor" || isMountedAsset(c)) &&
            c.source !== "character" &&
            !c.id.endsWith("-back") &&
            !c.id.endsWith("-front") &&
            !c.id.startsWith("room-wall-") &&
            !c.id.startsWith("room-junction-"),
        )
        .map((c) => (c.layer === "floor" ? { ...c, category: "floor" } : c));

      const categoryLabels: Record<string, string> = {
        all: "All",
        library: "Pixcel Library",
        floor: "🎨 Floor",
        tabletop: "💡 Tabletop",
        lab: "🧪 Lab",
        science: "🔬 Sci",
        server: "🖥️ Server",
        computer: "💻 PC",
        music: "🎸 Music",
        streaming: "🎙️ Stream",
        gadget: "⌚ Gadget",
        game: "🎮 Game",
        office: "🏢 Office",
        home: "🛋️ Home",
        gym: "🏋️ Gym",
        furniture: "🪑 Furn",
        tech: "⚡ Tech",
        decor: "🌿 Decor",
        mounted: "ติดผนัง",
        architecture: "🧱 Arch",
      };
      const categoryOrder = [
        "all",
        "library",
        "floor",
        "tabletop",
        "lab",
        "science",
        "server",
        "computer",
        "music",
        "streaming",
        "gadget",
        "game",
        "office",
        "home",
        "gym",
        "furniture",
        "tech",
        "decor",
        "mounted",
        "architecture",
      ];
      const availableCats = new Set(placeables.map((p) => p.category));
      if (placeables.some((item) => item.source === "library")) availableCats.add("library");
      if (placeables.some(isMountedAsset)) availableCats.add("mounted");
      const filterEl = document.getElementById("catalog-filters");
      if (filterEl) {
        filterEl.innerHTML = "";
        for (const cat of categoryOrder) {
          if (cat !== "all" && !availableCats.has(cat)) continue;
          const btn = document.createElement("button");
          btn.className = `cat-filter-btn ${this.catalogCategory === cat ? "active" : ""}`;
          btn.textContent = categoryLabels[cat] ?? cat;
          btn.addEventListener("click", () => {
            this.catalogCategory = cat;
            this.catalogSubcategory = "";
            this.catalogTag = "";
            this.catalogPage = 0;
            this.cb.onDecorateChanged();
          });
          filterEl.appendChild(btn);
        }
      }

      const scope = placeables.filter((item) => this.catalogCategory === "all" ||
        (this.catalogCategory === "library" && item.source === "library") ||
        (this.catalogCategory === "mounted" && isMountedAsset(item)) ||
        item.category === this.catalogCategory);
      const subcategories = Array.from(new Set(scope.map((item) => item.category)));
      this.catalogSubcategory = this.updateCatalogFilter(
        "catalog-subcategory", "ทุกหมวด", subcategories, this.catalogSubcategory, getCatalogCategoryLabel,
      );
      const categoryMatches = this.catalogSubcategory
        ? scope.filter((item) => item.category === this.catalogSubcategory) : scope;
      const tags = new Set<string>();
      for (const item of categoryMatches) {
        for (const tag of this.catalogTagsById.get(item.id) ?? []) tags.add(tag);
      }
      this.catalogTag = this.updateCatalogFilter("catalog-tag", "ทุกแท็ก", tags, this.catalogTag);
      const filteredPlaceables = categoryMatches.filter((item) => {
        const tags = this.catalogTagsById.get(item.id) ?? [];
        return (!this.catalogTag || tags.includes(this.catalogTag)) &&
          matchesCatalogSearch(item, tags, this.catalogSearch);
      });

      const catEl = document.getElementById("catalog-list")!;
      this.previewObserver?.disconnect();
      this.previewQueue.clear();
      catEl.innerHTML = "";
      if (!filteredPlaceables.length) {
        const empty = document.createElement("div");
        empty.className = "catalog-empty";
        empty.textContent = "ไม่พบ asset ที่ตรงกับตัวกรอง";
        catEl.appendChild(empty);
      }
      const pageSize = 80;
      this.catalogPage = Math.min(this.catalogPage, Math.max(0, Math.ceil(filteredPlaceables.length / pageSize) - 1));
      const pageStart = this.catalogPage * pageSize;
      for (const item of filteredPlaceables.slice(pageStart, pageStart + pageSize)) {
        const btn = document.createElement("button");
        btn.className = `cat-item ${this.decorate.selectedAssetId === item.id && this.decorate.tool === "place" ? "selected" : ""}`;
        const thumbUrl = atlas?.getThumbnailDataUrl(state.theme, item.id, 30);
        const previewPending = item.source === "library" && atlas && !thumbUrl;
        const thumbHtml = thumbUrl
          ? `<img class="cat-thumb" src="${thumbUrl}" alt="" />`
          : previewPending ? '<img class="cat-thumb" alt="" />' : "";
        const tags = this.catalogTagsById.get(item.id) ?? [];
        const categoryLabel = getCatalogCategoryLabel(item.category);
        btn.title = [item.id, categoryLabel, ...tags].join(" · ");
        btn.innerHTML = `
          <span class="cat-item-left">
            ${thumbHtml}
            <span class="cat-item-details">
              <span class="cat-item-name">${escapeHtml(item.id)}</span>
              <span class="cat-item-keywords">${escapeHtml([categoryLabel, ...tags.slice(0, 3)].join(" · "))}</span>
            </span>
          </span>
          <span class="cat-tag">${item.source === "custom" ? "✨ Gemini" : item.layer === "floor" ? "🎨 Floor" : isMountedAsset(item) ? "ติดผนัง" : item.layer === "tabletop" ? "💡 Top" : `${item.footprintTiles[0]}×${item.footprintTiles[1]}`}</span>
        `;
        btn.addEventListener("click", () => {
          this.decorate.selectAsset(item.id);
          if (isMountedAsset(item)) this.showToast("คลิกผนังทึบหรือหน้าฉากกั้นเพื่อติดตั้ง");
          this.cb.onDecorateChanged();
          if (item.source === "library" && atlas) {
            void atlas.loadLibraryAsset(state.theme, item.id)
              .then(() => {
                if (this.decorate.selectedAssetId === item.id) this.cb.onDecorateChanged();
              })
              .catch(() => this.showToast(`โหลดภาพ ${item.id} ไม่สำเร็จ`, true));
          }
        });
        catEl.appendChild(btn);
        if (previewPending) {
          const image = btn.querySelector<HTMLImageElement>(".cat-thumb");
          if (image) this.observeLibraryPreview(catEl, image, atlas, state.theme, item.id);
        }
      }
      if (filteredPlaceables.length > pageSize) {
        const pagination = document.createElement("div");
        pagination.className = "catalog-pagination";
        pagination.setAttribute("role", "group");
        pagination.setAttribute("aria-label", "หน้าแค็ตตาล็อก");
        const addPageButton = (label: string, delta: number, disabled: boolean) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.disabled = disabled;
          button.addEventListener("click", () => {
            this.catalogPage += delta;
            catEl.scrollTop = 0;
            this.cb.onDecorateChanged();
          });
          pagination.appendChild(button);
        };
        addPageButton("← ก่อนหน้า", -1, this.catalogPage === 0);
        const pageLabel = document.createElement("span");
        pageLabel.textContent = `${this.catalogPage + 1} / ${Math.ceil(filteredPlaceables.length / pageSize)}`;
        pagination.appendChild(pageLabel);
        addPageButton("ถัดไป →", 1, pageStart + pageSize >= filteredPlaceables.length);
        catEl.prepend(pagination);
      }
    }

    // Top-right Active Agents panel (auto-hides when Decorate, Layer, or Zone panel occupies the top-right slot)
    this.renderActiveAgentsPanel(snapshot, selectedEmployeeId, this.decorate.active || layerOpen || zoneOpen);

    // Employee Inspector Card
    const inspEl = document.getElementById("employee-inspector")!;
    const emp = selectedEmployeeId ? state.employees.find((e) => e.id === selectedEmployeeId) : null;
    if (!emp) {
      inspEl.classList.add("hidden");
    } else {
      inspEl.classList.remove("hidden");
      this.renderInspector(emp, snapshot);
    }
  }

  private updateCatalogFilter(
    id: string,
    placeholder: string,
    values: Iterable<string>,
    current: string,
    getLabel: (value: string) => string = (value) => value,
  ): string {
    const select = document.getElementById(id) as HTMLSelectElement;
    const choices = Array.from(values, (value) => ({ value, label: getLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
    const normalized = choices.some(({ value }) => value === current) ? current : "";
    const optionsChanged = select.options.length !== choices.length + 1 ||
      choices.some(({ value, label }, index) =>
        select.options[index + 1].value !== value || select.options[index + 1].text !== label,
      );
    if (optionsChanged) {
      select.replaceChildren(new Option(placeholder, ""), ...choices.map(({ value, label }) => new Option(label, value)));
    }
    select.value = normalized;
    select.disabled = choices.length === 0;
    return normalized;
  }

  private observeLibraryPreview(
    catalogList: HTMLElement,
    image: HTMLImageElement,
    atlas: AtlasManager,
    theme: ThemeMode,
    assetId: string,
  ): void {
    const key = `${theme}:${assetId}`;
    if (this.previewFailures.has(key)) return;
    this.previewObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const image = entry.target as HTMLImageElement;
        if (!entry.isIntersecting) {
          this.previewQueue.delete(image);
          continue;
        }
        const job = this.previewJobs.get(image);
        if (job) this.previewQueue.set(image, job);
      }
      this.loadVisiblePreviews();
    }, { root: catalogList });

    this.previewJobs.set(image, async () => {
      try {
        await atlas.loadLibraryAsset(theme, assetId);
        const url = atlas.getThumbnailDataUrl(theme, assetId, 30);
        if (url && image.isConnected) image.src = url;
      } catch {
        this.previewFailures.add(key);
      }
    });
    this.previewObserver.observe(image);
  }

  private loadVisiblePreviews(): void {
    for (const [image, load] of this.previewQueue) {
      if (this.previewLoads >= 2) return;
      this.previewQueue.delete(image);
      this.previewObserver?.unobserve(image);
      if (!image.isConnected) continue;
      this.previewLoads++;
      void load().finally(() => {
        this.previewLoads--;
        this.loadVisiblePreviews();
      });
    }
  }

  private renderActiveAgentsPanel(
    snapshot: OfficeSnapshotPayload,
    selectedEmployeeId: string | null,
    hideForRightDrawer: boolean,
  ): void {
    const panel = document.getElementById("active-agents-panel");
    if (!panel) return;
    panel.classList.toggle("hidden", hideForRightDrawer);
    if (hideForRightDrawer) return;

    const { state } = snapshot;
    const bayById = new Map(state.bays.map((b) => [b.id, b]));
    const activeBayIds = new Set(state.bays.filter((b) => !b.archived).map((b) => b.id));
    const visibleEmployees = state.employees.filter((e) => activeBayIds.has(e.bayId));
    const workingEmployees = visibleEmployees.filter(isEmployeeActive);
    const workingCount = workingEmployees.length;

    panel.classList.toggle("collapsed", this.activeAgentsCollapsed);
    document.getElementById("active-agents-body")?.classList.toggle("hidden", this.activeAgentsCollapsed);
    const toggleBtn = document.getElementById("btn-toggle-active-panel");
    if (toggleBtn) toggleBtn.textContent = this.activeAgentsCollapsed ? "+" : "−";

    const dotEl = document.getElementById("active-agents-dot");
    dotEl?.classList.toggle("live", workingCount > 0);
    const countEl = document.getElementById("active-agents-count");
    if (countEl) {
      countEl.textContent = String(workingCount);
      countEl.classList.toggle("live", workingCount > 0);
    }

    const tabWorking = document.getElementById("active-tab-working");
    if (tabWorking) {
      tabWorking.textContent = `⚡ Active (${workingCount})`;
      tabWorking.classList.toggle("active", this.activeAgentsTab === "working");
    }
    const tabAll = document.getElementById("active-tab-all");
    if (tabAll) {
      tabAll.textContent = `👥 All (${visibleEmployees.length})`;
      tabAll.classList.toggle("active", this.activeAgentsTab === "all");
    }

    if (this.activeAgentsCollapsed) return;

    const listEl = document.getElementById("active-agents-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const shown = sortActiveAgents(this.activeAgentsTab === "working" ? workingEmployees : visibleEmployees);
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "active-empty";
      empty.textContent =
        this.activeAgentsTab === "working"
          ? "ไม่มีเอเจนต์กำลังทำงานอยู่ (พักผ่อน ☕)"
          : "ยังไม่มีเอเจนต์ในออฟฟิศ";
      listEl.appendChild(empty);
      return;
    }

    for (const emp of shown) {
      const bay = bayById.get(emp.bayId);
      const roleMeta = getOrgRoleMeta(emp.role);
      const statusColor = agentStatusColor(emp);
      const isErr = emp.toolCategory === "error";
      const detailText = emp.detail || (emp.toolName ? `Running ${emp.toolName}` : "");

      const item = document.createElement("div");
      item.className = `active-agent-item ${emp.visualState === "resting" ? "resting" : ""} ${
        selectedEmployeeId === emp.id ? "selected" : ""
      }`;
      item.style.borderLeftColor = statusColor;
      item.innerHTML = `
        <div class="active-agent-top">
          <div class="active-agent-name-wrap">
            <span class="agent-status-dot" style="background:${statusColor}"></span>
            <span class="active-agent-name">${escapeHtml(emp.displayName)}</span>
          </div>
          <div class="active-agent-badges">
            <span class="badge">${emp.isEphemeral ? "ชั่วคราว" : "ประจำ"}</span>
            ${roleMeta ? `<span class="role-badge" style="color:${roleMeta.color}">${roleMeta.shortLabel}</span>` : ""}
            <span class="badge ${emp.provider ?? "starter"}">${emp.provider === "claude" ? "C" : emp.provider === "gemini" ? "G" : emp.provider === "codex" ? "CX" : "S"}</span>
          </div>
        </div>
        <div class="active-agent-meta">
          <span class="active-agent-project">
            <span class="bay-dot" style="background:${bay?.accentColor ?? "#64748b"}"></span>
            ${escapeHtml(bay?.displayName ?? emp.bayId)}
          </span>
          <span class="active-agent-state">${STATE_LABELS[emp.visualState] ?? emp.visualState}</span>
        </div>
        ${detailText ? `<div class="active-agent-detail ${isErr ? "error" : ""}">${escapeHtml(detailText)}</div>` : ""}
      `;
      item.addEventListener("click", () => {
        if (this.cb.onFocusEmployee) {
          this.cb.onFocusEmployee(emp.id);
        } else {
          this.cb.onSelectEmployee(emp.id);
        }
      });
      listEl.appendChild(item);
    }
  }

  private renderInspector(emp: EmployeeRecord, snapshot: OfficeSnapshotPayload): void {
    const bay = snapshot.state.bays.find((b) => b.id === emp.bayId);
    const zoneMeta = emp.isEphemeral ? CAMPUS_ZONE_GROUP_META.hq : CAMPUS_ZONE_GROUP_META.workspace;
    const roleMeta = getOrgRoleMeta(emp.role);
    const logs = snapshot.state.activityLog.filter((l) => l.employeeId === emp.id).slice(0, 6);
    const body = document.getElementById("inspector-body")!;
    body.innerHTML = `
      <div class="insp-header">
        <strong>${escapeHtml(emp.displayName)}</strong>
        <span class="badge ${emp.provider ?? "starter"}">${(emp.provider ?? "starter").toUpperCase()}</span>
      </div>
      <div class="insp-row">
        <span>Role:</span>
        <span>${
          roleMeta
            ? `<span class="role-badge" style="color:${roleMeta.color}">${roleMeta.icon} ${escapeHtml(emp.role)}</span>`
            : escapeHtml(emp.role)
        }</span>
      </div>
      <div class="insp-row"><span>Zone:</span><span style="color:${zoneMeta.color}">${zoneMeta.icon} ${emp.isEphemeral ? "CO-WORKING (HQ)" : zoneMeta.label}</span></div>
      <div class="insp-row"><span>ประเภท:</span><span>${emp.isEphemeral ? "Subagent ชั่วคราว" : "Agent ประจำ"}</span></div>
      <div class="insp-row"><span>State:</span><span>${STATE_LABELS[emp.visualState] ?? emp.visualState}</span></div>
      <div class="insp-row"><span>Project:</span><span>${escapeHtml(bay?.displayName ?? "-")}</span></div>
      <div class="insp-path">${escapeHtml(bay?.projectPath ?? "Unclaimed Starter Studio")}</div>
      <div class="insp-detail">${escapeHtml(emp.detail ?? "Idle")}</div>
      <div class="insp-logs">
        ${logs
          .map(
            (l) =>
              `<div class="insp-log-line">[${new Date(l.timestamp).toLocaleTimeString()}] ${escapeHtml(l.toolName ?? l.eventType)} · ${escapeHtml(l.detail ?? "")}</div>`,
          )
          .join("")}
      </div>
    `;
  }

  renderMinimap(campus: ComputedCampus, visuals: SimEmployeeVisual[]): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    // Walkway / corridor background shows clearly between functional zones
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / Math.max(1, campus.widthTiles);
    const scaleY = h / Math.max(1, campus.depthTiles);

    for (const z of campus.zones) {
      const grpMeta = z.zoneGroup ? CAMPUS_ZONE_GROUP_META[z.zoneGroup] : undefined;
      ctx.fillStyle =
        z.kind === "boss"
          ? "#92400e"
          : z.kind === "cowork"
            ? "#134e4a"
            : z.kind === "common"
              ? "#1e3a5f"
              : z.kind === "amenity"
                ? "#2e1065"
                : "#1e293b";
      ctx.fillRect(z.originX * scaleX, z.originY * scaleY, z.width * scaleX, z.height * scaleY);
      ctx.strokeStyle =
        z.kind === "boss"
          ? "#f59e0b"
          : z.kind === "cowork"
            ? "#14b8a6"
            : z.amenityTheme
              ? AMENITY_THEME_META[z.amenityTheme].color
              : grpMeta?.color ?? "#38bdf8";
      ctx.strokeRect(z.originX * scaleX, z.originY * scaleY, z.width * scaleX, z.height * scaleY);
    }

    for (const v of visuals) {
      ctx.fillStyle =
        v.record.toolCategory === "error"
          ? "#ef4444"
          : v.record.provider === "claude"
            ? "#d97757"
            : v.record.provider === "gemini"
              ? "#38bdf8"
              : "#94a3b8";
      ctx.fillRect(Math.round(v.x * scaleX) - 2, Math.round(v.y * scaleY) - 2, 4, 4);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
