import type {
  CatalogEntry,
  ComputedCampus,
  EmployeeRecord,
  OfficeSnapshotPayload,
  ThemeMode,
} from "../shared/types.js";
import type { DecorateController } from "./decorate.js";
import type { SimEmployeeVisual } from "./sim.js";

export interface HudCallbacks {
  onFocusBay(bayId: string): void;
  onToggleArchive(bayId: string, archived: boolean): void;
  onSetTheme(theme: ThemeMode): void;
  onToggleDemo(): void;
  onSetZoom(zoom: number): void;
  onSelectEmployee(id: string | null): void;
  onMinimapClick(tx: number, ty: number): void;
  onDecorateChanged(): void;
}

const STATE_LABELS: Record<string, string> = {
  assigning: "📋 Assigning",
  working: "💻 Working",
  teamwork: "🤝 Teamwork",
  meeting: "💬 Meeting",
  reporting: "👑 Reporting to Boss",
  resting: "☕ Resting",
};

export class OfficeHud {
  private baySearch = "";
  private showArchived = false;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private lastCampus: ComputedCampus | null = null;

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

    const archToggle = document.getElementById("toggle-archived") as HTMLButtonElement;
    archToggle.addEventListener("click", () => {
      this.showArchived = !this.showArchived;
      archToggle.classList.toggle("active", this.showArchived);
      this.cb.onDecorateChanged();
    });

    const btnDecorate = document.getElementById("btn-decorate") as HTMLButtonElement;
    btnDecorate.addEventListener("click", () => {
      this.decorate.toggle();
      this.cb.onDecorateChanged();
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

    const btnTheme = document.getElementById("btn-theme") as HTMLButtonElement;
    btnTheme.addEventListener("click", () => {
      const next = btnTheme.dataset.theme === "night" ? "day" : "night";
      this.cb.onSetTheme(next);
    });

    const btnDemo = document.getElementById("btn-demo") as HTMLButtonElement;
    btnDemo.addEventListener("click", () => {
      this.cb.onToggleDemo();
    });

    for (const z of [1, 2, 3, 4]) {
      const btn = document.getElementById(`zoom-${z}`) as HTMLButtonElement | null;
      btn?.addEventListener("click", () => this.cb.onSetZoom(z));
    }

    document.getElementById("inspector-close")?.addEventListener("click", () => {
      this.cb.onSelectEmployee(null);
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
      statsEl.textContent = `${activeBays.length} Bays · ${state.employees.length} Staff (${workingCount} active)`;
    }

    // Top buttons
    const btnTheme = document.getElementById("btn-theme") as HTMLButtonElement;
    btnTheme.dataset.theme = state.theme;
    btnTheme.textContent = state.theme === "night" ? "🌙 Night" : "☀️ Day";

    const btnDemo = document.getElementById("btn-demo") as HTMLButtonElement;
    btnDemo.classList.toggle("active", demoMode);
    btnDemo.textContent = demoMode ? "⏹ Stop Demo" : "▶ Demo Mode";

    const btnDecorate = document.getElementById("btn-decorate") as HTMLButtonElement;
    btnDecorate.classList.toggle("active", this.decorate.active);

    const decoratePanel = document.getElementById("decorate-panel")!;
    decoratePanel.classList.toggle("hidden", !this.decorate.active);
    document.getElementById("btn-rotate")!.textContent = `↻ ${this.decorate.direction.toUpperCase()}`;
    document.getElementById("btn-move")?.classList.toggle("active", this.decorate.tool === "move");
    document.getElementById("btn-erase")!.classList.toggle("active", this.decorate.tool === "erase");
    (document.getElementById("btn-undo") as HTMLButtonElement).disabled = !this.decorate.canUndo();
    (document.getElementById("btn-redo") as HTMLButtonElement).disabled = !this.decorate.canRedo();

    for (const z of [1, 2, 3, 4]) {
      document.getElementById(`zoom-${z}`)?.classList.toggle("active", z === currentZoom);
    }

    // Bay Quick-Jump list
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

    // Furniture Catalog (when Decorate Mode is open)
    if (this.decorate.active) {
      const catEl = document.getElementById("catalog-list")!;
      catEl.innerHTML = "";
      const placeables = catalog.filter((c) => c.layer === "object" && c.source !== "character");
      for (const item of placeables) {
        const btn = document.createElement("button");
        btn.className = `cat-item ${this.decorate.selectedAssetId === item.id && this.decorate.tool === "place" ? "selected" : ""}`;
        btn.innerHTML = `
          <span>${escapeHtml(item.id)}</span>
          <span class="cat-tag">${item.source === "custom" ? "✨ Gemini" : `${item.footprintTiles[0]}×${item.footprintTiles[1]}`}</span>
        `;
        btn.addEventListener("click", () => {
          this.decorate.selectAsset(item.id);
          this.cb.onDecorateChanged();
        });
        catEl.appendChild(btn);
      }
    }

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

  private renderInspector(emp: EmployeeRecord, snapshot: OfficeSnapshotPayload): void {
    const bay = snapshot.state.bays.find((b) => b.id === emp.bayId);
    const logs = snapshot.state.activityLog.filter((l) => l.employeeId === emp.id).slice(0, 6);
    const body = document.getElementById("inspector-body")!;
    body.innerHTML = `
      <div class="insp-header">
        <strong>${escapeHtml(emp.displayName)}</strong>
        <span class="badge ${emp.provider ?? "starter"}">${(emp.provider ?? "starter").toUpperCase()}</span>
      </div>
      <div class="insp-row"><span>Role:</span><span>${escapeHtml(emp.role)}</span></div>
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
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / Math.max(1, campus.widthTiles);
    const scaleY = h / Math.max(1, campus.depthTiles);

    for (const z of campus.zones) {
      ctx.fillStyle =
        z.kind === "boss" ? "#92400e" : z.kind === "common" ? "#1e3a5f" : "#1e293b";
      ctx.fillRect(z.originX * scaleX, z.originY * scaleY, z.width * scaleX, z.height * scaleY);
      ctx.strokeStyle = z.kind === "boss" ? "#f59e0b" : "#334155";
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
