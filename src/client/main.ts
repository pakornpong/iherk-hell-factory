import {
  crossesWallSegment,
  expandEdgeDividerSegments,
  furnitureFootprintsCollide,
  getSurfaceHostHeightVoxels,
  isEdgeDividerAsset,
  isTabletopAsset,
  isWalkablePermission,
  resolveAssetLayerConfig,
  surfaceVoxelsToWorldOffsetY,
  supportsHalfTilePlacement,
  type RenderLayer,
} from "../shared/layers.js";
import type {
  CatalogEntry,
  CustomZoneRecord,
  CustomZoneRole,
  OfficeSnapshotPayload,
  ThemeMode,
  WsServerMessage,
} from "../shared/types.js";
import { AtlasManager } from "./atlas-loader.js";
import { findBossChair, getCenteredChairTile } from "./chair-alignment.js";
import { IsoCamera } from "./camera.js";
import { DecorateController, isEditableFurniture } from "./decorate.js";
import { OfficeHud, type LayerBrush, type LayerEditorState, type ZoneEditorState } from "./hud.js";
import { IsoRenderer, type LayerOverlayMode } from "./iso-renderer.js";
import { OfficeSimulation, type SimEmployeeVisual } from "./sim.js";

declare global {
  interface Window {
    __UI_SESSION__?: string;
  }
}

async function architectFetch<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-UI-Session": window.__UI_SESSION__ ?? "",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
  }
  return json as T;
}

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById("office-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const atlas = new AtlasManager();
  const camera = new IsoCamera();
  const renderer = new IsoRenderer();
  const sim = new OfficeSimulation();

  let snapshot: OfficeSnapshotPayload | null = null;
  let catalog: CatalogEntry[] = [];
  let catalogById = new Map<string, CatalogEntry>();
  let selectedEmployeeId: string | null = null;
  let latestVisuals: SimEmployeeVisual[] = [];
  let hoverTile: [number, number] | null = null;
  let cameraInitialized = false;
  let lastDrawTs = 0;
  const layerState: LayerEditorState = { mode: "off", brush: "inspect", selectedFurnitureId: null };
  const zoneEditorState: ZoneEditorState = {
    active: false,
    startTile: null,
    editingZoneId: null,
    draftName: "",
    draftIcon: "🏷️",
    draftColor: "#38bdf8",
    draftRole: "label",
  };

  // Bind Zone Panel draft inputs (name, role, icon, color)
  const zoneNameInput = document.getElementById("zone-name-input") as HTMLInputElement | null;
  zoneNameInput?.addEventListener("input", () => {
    zoneEditorState.draftName = zoneNameInput.value;
  });
  const zoneRoleSelect = document.getElementById("zone-role-select") as HTMLSelectElement | null;
  zoneRoleSelect?.addEventListener("change", () => {
    zoneEditorState.draftRole = (zoneRoleSelect.value as CustomZoneRole) || "label";
  });
  document.querySelectorAll<HTMLButtonElement>(".zone-icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      zoneEditorState.draftIcon = btn.dataset.icon ?? "🏷️";
      document.querySelectorAll(".zone-icon-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  document.querySelectorAll<HTMLButtonElement>(".zone-color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      zoneEditorState.draftColor = btn.dataset.color ?? "#38bdf8";
      document.querySelectorAll(".zone-color-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  const syncZoneFormInputs = () => {
    if (zoneNameInput) zoneNameInput.value = zoneEditorState.draftName;
    if (zoneRoleSelect) zoneRoleSelect.value = zoneEditorState.draftRole;
    document.querySelectorAll<HTMLButtonElement>(".zone-icon-btn").forEach((b) => {
      b.classList.toggle("active", (b.dataset.icon ?? "") === zoneEditorState.draftIcon);
    });
    document.querySelectorAll<HTMLButtonElement>(".zone-color-btn").forEach((b) => {
      b.classList.toggle("active", (b.dataset.color ?? "").toLowerCase() === zoneEditorState.draftColor.toLowerCase());
    });
  };

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const decorate = new DecorateController({
    async placeFurniture(req) {
      const res = await architectFetch<{ furniture: any }>("/api/architect/furniture", {
        method: "POST",
        body: JSON.stringify(req),
      });
      return res.furniture;
    },
    async moveFurniture(id, req) {
      const res = await architectFetch<{ furniture: any }>(`/api/architect/furniture/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      });
      return res.furniture;
    },
    async removeFurniture(id) {
      await architectFetch(`/api/architect/furniture/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    async paintFloorTiles(tiles) {
      await architectFetch("/api/architect/floor-tiles", {
        method: "PATCH",
        body: JSON.stringify({ tiles }),
      });
    },
  });

  const refreshHud = () => {
    if (!snapshot) return;
    hud.renderHud(snapshot, catalog, selectedEmployeeId, camera.zoom, layerState, atlas, zoneEditorState);
  };

  const rotateView = (turn: -1 | 1) => {
    if (!snapshot) return;
    camera.rotate(turn, canvas.width, canvas.height);
    renderer.lastHitBoxes = [];
    hoverTile = null;
    lastDrawTs = -Infinity;
  };

  const hud = new OfficeHud(decorate, {
    onRotateView: rotateView,
    onFocusBay(bayId) {
      const zone = snapshot?.campus.zones.find((z) => z.bayId === bayId);
      if (zone) {
        camera.glideToTile(zone.originX + 3, zone.originY + 3, canvas.width, canvas.height);
        return;
      }
      const bayEmps = snapshot?.state.employees.filter((e) => e.bayId === bayId) ?? [];
      const targetEmp = bayEmps.find((e) => e.visualState !== "resting") ?? bayEmps[0];
      if (targetEmp) {
        selectedEmployeeId = targetEmp.id;
        refreshHud();
        const vis = latestVisuals.find((v) => v.id === targetEmp.id);
        if (vis) {
          camera.glideToTile(vis.x, vis.y, canvas.width, canvas.height);
          return;
        }
      }
      const central = snapshot?.campus.zones.find((z) => z.kind === "cowork");
      if (central) {
        camera.glideToTile(central.originX + 3, central.originY + 3, canvas.width, canvas.height);
      }
    },
    onFocusZoneGroup(group) {
      if (group === "hq") {
        const bossChair = snapshot && findBossChair(snapshot.campus);
        if (bossChair) {
          camera.glideToTile(bossChair.tx, bossChair.ty, canvas.width, canvas.height);
          return;
        }
      }
      if (group === "hypersleep") {
        const customPodsZone = snapshot?.state.customZones?.find((z) => z.role === "hypersleep");
        if (customPodsZone) {
          camera.glideToTile(
            customPodsZone.x + customPodsZone.width / 2,
            customPodsZone.y + customPodsZone.height / 2,
            canvas.width,
            canvas.height,
          );
          return;
        }
        const pods = snapshot?.campus.worldFurniture.filter((f) => f.assetId === "hypersleep-capsule") ?? [];
        if (pods.length > 0) {
          const minX = Math.min(...pods.map((p) => p.tx));
          const maxX = Math.max(...pods.map((p) => p.tx + p.footprintTiles[0]));
          const minY = Math.min(...pods.map((p) => p.ty));
          const maxY = Math.max(...pods.map((p) => p.ty + p.footprintTiles[1]));
          camera.glideToTile((minX + maxX) / 2, (minY + maxY) / 2, canvas.width, canvas.height);
          return;
        }
      }
      const matching = snapshot?.campus.zones.filter((z) => z.zoneGroup === group);
      if (matching && matching.length > 0) {
        const minX = Math.min(...matching.map((z) => z.originX));
        const maxX = Math.max(...matching.map((z) => z.originX + z.width));
        const minY = Math.min(...matching.map((z) => z.originY));
        const maxY = Math.max(...matching.map((z) => z.originY + z.height));
        camera.glideToTile((minX + maxX) / 2, (minY + maxY) / 2, canvas.width, canvas.height);
      }
    },
    onFocusCustomZone(zone: CustomZoneRecord) {
      camera.glideToTile(zone.x + zone.width / 2, zone.y + zone.height / 2, canvas.width, canvas.height);
    },
    onEditCustomZone(zone: CustomZoneRecord) {
      zoneEditorState.active = true;
      zoneEditorState.editingZoneId = zone.id;
      zoneEditorState.startTile = null;
      zoneEditorState.draftName = zone.name;
      zoneEditorState.draftIcon = zone.icon;
      zoneEditorState.draftColor = zone.color;
      zoneEditorState.draftRole = zone.role;
      syncZoneFormInputs();
      camera.glideToTile(zone.x + zone.width / 2, zone.y + zone.height / 2, canvas.width, canvas.height);
      hud.showToast(`✏️ กำลังแก้ไข "${zone.name}" — กด 💾 บันทึก หรือคลิก 2 มุมบนพื้นเพื่อย้าย/ปรับขนาด`);
      refreshHud();
    },
    onCancelEditZone() {
      zoneEditorState.editingZoneId = null;
      zoneEditorState.startTile = null;
      zoneEditorState.draftName = "";
      syncZoneFormInputs();
      refreshHud();
    },
    onSaveEditingZoneMeta() {
      const id = zoneEditorState.editingZoneId;
      if (!id) return;
      const name = zoneEditorState.draftName.trim();
      if (!name) {
        hud.showToast("กรุณาใส่ชื่อโซน", true);
        return;
      }
      void architectFetch<{ zone: CustomZoneRecord }>(`/api/architect/zones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          icon: zoneEditorState.draftIcon,
          color: zoneEditorState.draftColor,
          role: zoneEditorState.draftRole,
        }),
      })
        .then((res) => {
          zoneEditorState.editingZoneId = null;
          zoneEditorState.startTile = null;
          hud.showToast(`💾 บันทึกโซน "${res.zone.icon} ${res.zone.name}" แล้ว`);
          refreshHud();
        })
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
    onStartEditPodsZone() {
      const existingPodsZone = snapshot?.state.customZones?.find((z) => z.role === "hypersleep");
      if (existingPodsZone) {
        zoneEditorState.active = true;
        zoneEditorState.editingZoneId = existingPodsZone.id;
        zoneEditorState.startTile = null;
        zoneEditorState.draftName = existingPodsZone.name;
        zoneEditorState.draftIcon = existingPodsZone.icon;
        zoneEditorState.draftColor = existingPodsZone.color;
        zoneEditorState.draftRole = "hypersleep";
        syncZoneFormInputs();
        camera.glideToTile(
          existingPodsZone.x + existingPodsZone.width / 2,
          existingPodsZone.y + existingPodsZone.height / 2,
          canvas.width,
          canvas.height,
        );
        hud.showToast(`🧊 คลิก 2 มุมบนพื้นเพื่อย้าย/ปรับขนาดโซน "${existingPodsZone.name}"`);
        refreshHud();
        return;
      }
      zoneEditorState.active = true;
      zoneEditorState.editingZoneId = null;
      zoneEditorState.startTile = null;
      zoneEditorState.draftName = "HYPERSLEEP BAY";
      zoneEditorState.draftIcon = "🧊";
      zoneEditorState.draftColor = "#14b8a6";
      zoneEditorState.draftRole = "hypersleep";
      syncZoneFormInputs();
      hud.showToast("🧊 คลิก 2 มุมบนพื้นเพื่อกำหนดตำแหน่งโซน Pods ใหม่ (จะจัด Pods เข้าให้อัตโนมัติ)");
      refreshHud();
    },
    onRelocatePodsToZone(zoneId: string) {
      void architectFetch<{ moved: number; total: number; remaining: number }>(
        `/api/architect/zones/${encodeURIComponent(zoneId)}/relocate-pods`,
        { method: "POST" },
      )
        .then((res) => {
          if (res.remaining > 0) {
            hud.showToast(
              `🧊 ย้าย Pods เข้าโซนได้ ${res.moved}/${res.total} แคปซูล (เหลือ ${res.remaining} — ขยายโซนเพิ่มเพื่อให้พอใส่ทั้งหมด)`,
            );
          } else {
            hud.showToast(`🧊 จัด Pods เข้าโซนครบทั้ง ${res.moved}/${res.total} แคปซูลแล้ว!`);
          }
          refreshHud();
        })
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
    onDeleteCustomZone(zoneId: string) {
      if (zoneEditorState.editingZoneId === zoneId) {
        zoneEditorState.editingZoneId = null;
        zoneEditorState.startTile = null;
      }
      void architectFetch(`/api/architect/zones/${encodeURIComponent(zoneId)}`, { method: "DELETE" })
        .then(() => hud.showToast("🗑️ ลบโซนแล้ว"))
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
    onResizeFloor(delta) {
      void architectFetch<{ widthTiles: number; depthTiles: number }>("/api/architect/floor/resize", {
        method: "POST",
        body: JSON.stringify(delta),
      })
        .then((res) => hud.showToast(`📐 ขนาดพื้นตอนนี้: ${res.widthTiles}×${res.depthTiles} tiles`))
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
    onToggleZonePanel(open?: boolean) {
      const next = open !== undefined ? open : !zoneEditorState.active;
      zoneEditorState.active = next;
      zoneEditorState.startTile = null;
      if (next) {
        decorate.setActive(false);
        layerState.mode = "off";
      }
      refreshHud();
    },
    onFocusEmployee(employeeId) {
      selectedEmployeeId = employeeId;
      refreshHud();
      const vis = latestVisuals.find((v) => v.id === employeeId);
      if (vis) {
        camera.glideToTile(vis.x, vis.y, canvas.width, canvas.height);
        return;
      }
      const emp = snapshot?.state.employees.find((e) => e.id === employeeId);
      if (!emp || !snapshot) return;
      const targetZone =
        emp.visualState === "reporting"
          ? snapshot.campus.zones.find((z) => z.kind === "boss")
          : emp.isEphemeral
            ? snapshot.campus.zones.find((z) => z.kind === "cowork")
            : snapshot.campus.zones.find((z) => z.bayId === emp.bayId);
      if (targetZone) {
        camera.glideToTile(targetZone.originX + 3, targetZone.originY + 3, canvas.width, canvas.height);
      }
    },
    onToggleArchive(bayId, archived) {
      void architectFetch(`/api/architect/bays/${encodeURIComponent(bayId)}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }).catch((e) => hud.showToast(e.message, true));
    },
    onSetTheme(theme: ThemeMode) {
      void architectFetch("/api/architect/theme", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      }).catch((e) => hud.showToast(e.message, true));
    },
    onToggleDemo() {
      void architectFetch("/api/architect/demo/toggle", { method: "POST", body: "{}" }).catch((e) =>
        hud.showToast(e.message, true),
      );
    },
    onSetZoom(zoom) {
      camera.setZoom(zoom, canvas.width / 2, canvas.height / 2);
      refreshHud();
    },
    onSelectEmployee(id) {
      selectedEmployeeId = id;
      refreshHud();
    },
    onMinimapClick(tx, ty) {
      camera.glideToTile(tx, ty, canvas.width, canvas.height);
    },
    onDecorateChanged() {
      refreshHud();
    },
    onLayerOverlayChange(mode: LayerOverlayMode) {
      layerState.mode = mode;
      if (mode !== "layers") layerState.selectedFurnitureId = null;
      refreshHud();
    },
    onLayerBrushChange(brush: LayerBrush) {
      layerState.brush = brush;
      refreshHud();
    },
    onResetTilePermissions() {
      void architectFetch("/api/architect/tile-permissions", {
        method: "PATCH",
        body: JSON.stringify({ resetAll: true }),
      })
        .then(() => hud.showToast("↺ Tile permission overrides cleared"))
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
    onSetFurnitureLayer(instanceId: string, renderLayer: RenderLayer) {
      void architectFetch(`/api/architect/furniture/${encodeURIComponent(instanceId)}`, {
        method: "PATCH",
        body: JSON.stringify({ renderLayer }),
      })
        .then(() => hud.showToast(`🗺️ Set renderLayer → L${renderLayer}`))
        .catch((e) => hud.showToast(e instanceof Error ? e.message : String(e), true));
    },
  });

  const loadCatalog = async () => {
    const res = await fetch("/api/catalog");
    if (res.ok) {
      const data = (await res.json()) as { catalog: CatalogEntry[] };
      catalog = data.catalog;
      catalogById = new Map(catalog.map((c) => [c.id, c]));
    }
  };

  await Promise.all([atlas.loadAll(), loadCatalog()]);

  const applySnapshot = (next: OfficeSnapshotPayload) => {
    snapshot = next;
    sim.syncFromServer(next.state, next.campus);
    camera.setFloorSize(next.campus.widthTiles, next.campus.depthTiles, canvas.width, canvas.height);
    if (!cameraInitialized) {
      cameraInitialized = true;
      camera.snapToTile((next.campus.widthTiles - 1) / 2, (next.campus.depthTiles - 1) / 2, canvas.width, canvas.height);
    }
    refreshHud();
  };

  // Initial fetch
  const initRes = await fetch("/api/state");
  if (initRes.ok) {
    applySnapshot((await initRes.json()) as OfficeSnapshotPayload);
  }

  // WebSocket live connection with auto-reconnect
  const connectWs = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as WsServerMessage;
      if (msg.type === "state:snapshot") {
        applySnapshot(msg.payload);
      } else if (msg.type === "bay:expanded") {
        sim.triggerBayPop(msg.payload.bayId);
        hud.showToast(`✨ New Project Bay: ${msg.payload.displayName}`);
      } else if (msg.type === "atlas:updated") {
        void Promise.all([atlas.reloadCustom(), loadCatalog()]).then(() => {
          hud.showToast(`🎨 Gemini crafted asset: ${msg.payload.customAssetId ?? "updated"}`);
          refreshHud();
        });
      }
    };
    ws.onclose = () => {
      setTimeout(connectWs, 1500);
    };
  };
  connectWs();

  // Mouse pan, tile picking, click selection & decorate placement
  let dragging = false;
  let furniturePointer: [number, number] | null = null;

  const furnitureAt = (sx: number, sy: number, boxes: typeof renderer.lastHitBoxes, useSprite: boolean) => {
    if (!snapshot) return;
    const furniture = snapshot.campus.worldFurniture;
    if (useSprite) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        if (box.kind !== "furniture" || sx < box.x || sx > box.x + box.w || sy < box.y || sy > box.y + box.h) continue;
        const hit = furniture.find((item) => item.id === box.id);
        if (hit && isEditableFurniture(hit)) return hit;
      }
    }
    const [x, y] = camera.screenToTile(sx, sy);
    const matches = furniture.filter((item) =>
      isEditableFurniture(item) && !isEdgeDividerAsset(item.assetId) &&
      x >= item.tx && x < item.tx + item.footprintTiles[0] &&
      y >= item.ty && y < item.ty + item.footprintTiles[1],
    );
    return matches.find((item) => isTabletopAsset(item.assetId, item.layer, catalogById.get(item.assetId))) ?? matches[0];
  };

  canvas.addEventListener("mouseleave", () => { furniturePointer = null; });
  window.addEventListener("blur", () => { furniturePointer = null; });

  let movedPx = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return;
    dragging = true;
    movedPx = 0;
    lastX = ev.clientX;
    lastY = ev.clientY;
  });

  window.addEventListener("mousemove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    furniturePointer = ev.target === canvas ? [sx, sy] : null;
    if (furniturePointer) decorate.resumePointerMove();
    const [tx, ty] = camera.screenToTile(sx, sy);
    hoverTile = [Math.floor(tx), Math.floor(ty)];

    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    movedPx += Math.hypot(dx, dy);
    lastX = ev.clientX;
    lastY = ev.clientY;
    if (movedPx > 4) {
      camera.panBy(dx, dy);
    }
  });

  window.addEventListener("mouseup", (ev) => {
    if (!dragging) return;
    dragging = false;
    if (movedPx > 5 || !snapshot) return;

    const rect = canvas.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;

    const [tileX, tileY] = camera.screenToTile(sx, sy);
    hoverTile = [Math.floor(tileX), Math.floor(tileY)];

    if (zoneEditorState.active) {
      const [tx, ty] = hoverTile;
      if (tx < 0 || ty < 0 || tx >= snapshot.campus.widthTiles || ty >= snapshot.campus.depthTiles) return;
      if (!zoneEditorState.startTile) {
        zoneEditorState.startTile = [tx, ty];
        hud.showToast(
          zoneEditorState.editingZoneId
            ? `📍 มุมแรก (${tx},${ty}) — คลิกมุมตรงข้ามเพื่อย้าย/ปรับขนาดโซน`
            : `📍 มุมแรก (${tx},${ty}) — คลิกมุมตรงข้ามเพื่อสร้างโซน`,
        );
        refreshHud();
        return;
      }
      const [sx0, sy0] = zoneEditorState.startTile;
      const x = Math.min(sx0, tx);
      const y = Math.min(sy0, ty);
      const width = Math.abs(tx - sx0) + 1;
      const height = Math.abs(ty - sy0) + 1;
      const editingId = zoneEditorState.editingZoneId;
      const name =
        zoneEditorState.draftName.trim() ||
        (editingId
          ? snapshot.state.customZones?.find((z) => z.id === editingId)?.name ?? "Zone"
          : `Zone ${(snapshot.state.customZones?.length ?? 0) + 1}`);
      zoneEditorState.startTile = null;

      if (editingId) {
        void architectFetch<{ zone: CustomZoneRecord }>(`/api/architect/zones/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            icon: zoneEditorState.draftIcon,
            color: zoneEditorState.draftColor,
            role: zoneEditorState.draftRole,
            x,
            y,
            width,
            height,
          }),
        })
          .then(async (res) => {
            zoneEditorState.editingZoneId = null;
            if (res.zone.role === "hypersleep") {
              try {
                const moved = await architectFetch<{ moved: number; total: number; remaining: number }>(
                  `/api/architect/zones/${encodeURIComponent(res.zone.id)}/relocate-pods`,
                  { method: "POST" },
                );
                hud.showToast(
                  `✅ ย้ายโซน "${res.zone.icon} ${res.zone.name}" (${width}×${height}) และจัด Pods ${moved.moved}/${moved.total} แคปซูลแล้ว`,
                );
              } catch {
                hud.showToast(`✅ อัปเดตโซน "${res.zone.icon} ${res.zone.name}" (${width}×${height}) แล้ว`);
              }
            } else {
              hud.showToast(`✅ อัปเดตโซน "${res.zone.icon} ${res.zone.name}" (${width}×${height}) แล้ว`);
            }
            refreshHud();
          })
          .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
        return;
      }

      void architectFetch<{ zone: CustomZoneRecord }>("/api/architect/zones", {
        method: "POST",
        body: JSON.stringify({
          name,
          icon: zoneEditorState.draftIcon,
          color: zoneEditorState.draftColor,
          role: zoneEditorState.draftRole,
          x,
          y,
          width,
          height,
        }),
      })
        .then(async (res) => {
          if (res.zone.role === "hypersleep") {
            try {
              const moved = await architectFetch<{ moved: number; total: number; remaining: number }>(
                `/api/architect/zones/${encodeURIComponent(res.zone.id)}/relocate-pods`,
                { method: "POST" },
              );
              hud.showToast(
                `🧊 สร้างโซน Pods "${res.zone.name}" (${width}×${height}) และย้าย Pods เข้า ${moved.moved}/${moved.total} แคปซูลแล้ว`,
              );
            } catch {
              hud.showToast(`✅ สร้างโซน "${res.zone.icon} ${res.zone.name}" (${width}×${height}) แล้ว`);
            }
          } else {
            hud.showToast(`✅ สร้างโซน "${res.zone.icon} ${res.zone.name}" (${width}×${height}) แล้ว`);
          }
          refreshHud();
        })
        .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
      return;
    }

    if (decorate.active && hoverTile) {
      const [tx, ty] = hoverTile;
      if (decorate.isFloorPainting()) {
        void decorate
          .paintFloorAt(
            tx,
            ty,
            snapshot.campus.widthTiles,
            snapshot.campus.depthTiles,
            snapshot.state.floorTileOverrides,
          )
          .then(() => refreshHud())
          .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
        return;
      }
      const isPicking = decorate.tool === "erase" || (decorate.tool === "move" && !decorate.movingItem);
      const existing = furnitureAt(sx, sy, renderer.lastHitBoxes, isPicking);
      if (decorate.tool === "erase" && !existing && snapshot.state.floorTileOverrides?.[`${tx},${ty}`]) {
        void decorate
          .paintFloorAt(
            tx,
            ty,
            snapshot.campus.widthTiles,
            snapshot.campus.depthTiles,
            snapshot.state.floorTileOverrides,
            null,
          )
          .then(() => refreshHud())
          .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
        return;
      }
      const wasHolding = Boolean(decorate.movingItem);
      const [targetX, targetY] = wasHolding ? decorate.getPointerMoveTarget(tileX, tileY) : [tx, ty];
      void decorate
        .handleTileClick(targetX, targetY, existing)
        .then(() => {
          if (!wasHolding && decorate.movingItem) {
            const assetId = decorate.movingItem.item.assetId;
            const step = supportsHalfTilePlacement(assetId) ? "½ tile" : "1 tile";
            hud.showToast(`✋ Picked up ${assetId} — move by ${step} · click to place`);
          }
          refreshHud();
        })
        .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
      return;
    }

    if (layerState.mode === "permissions" && layerState.brush !== "inspect" && hoverTile) {
      const [tx, ty] = hoverTile;
      if (tx >= 0 && ty >= 0 && tx < snapshot.campus.widthTiles && ty < snapshot.campus.depthTiles) {
        const permission = layerState.brush === "auto" ? null : layerState.brush;
        void architectFetch("/api/architect/tile-permissions", {
          method: "PATCH",
          body: JSON.stringify({ tx, ty, permission }),
        }).catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
      }
      return;
    }

    if (layerState.mode === "layers" && hoverTile) {
      const [tx, ty] = hoverTile;
      const tileMatches = snapshot.campus.worldFurniture.filter(
        (f) =>
          isEditableFurniture(f) &&
          tx >= f.tx &&
          tx < f.tx + f.footprintTiles[0] &&
          ty >= f.ty &&
          ty < f.ty + f.footprintTiles[1],
      );
      let picked =
        tileMatches.find((f) => isTabletopAsset(f.assetId, f.layer, catalogById.get(f.assetId))) ??
        tileMatches[0];
      if (!picked) {
        for (let i = renderer.lastHitBoxes.length - 1; i >= 0; i--) {
          const box = renderer.lastHitBoxes[i];
          if (box.kind !== "furniture") continue;
          if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
            const hit = snapshot.campus.worldFurniture.find((f) => f.id === box.id && isEditableFurniture(f));
            if (hit) {
              picked = hit;
              break;
            }
          }
        }
      }
      layerState.selectedFurnitureId = picked?.id ?? null;
      refreshHud();
      return;
    }

    // Hit-test employees top-down
    let hitEmp: string | null = null;
    for (let i = renderer.lastHitBoxes.length - 1; i >= 0; i--) {
      const box = renderer.lastHitBoxes[i];
      if (box.kind !== "employee") continue;
      if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
        hitEmp = box.id;
        break;
      }
    }
    selectedEmployeeId = hitEmp;
    refreshHud();
  });

  let lastWheelZoomTs = 0;
  canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      if (ev.deltaY === 0) return;
      const now = performance.now();
      if (now - lastWheelZoomTs < 110) return;
      lastWheelZoomTs = now;
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      if (ev.deltaY < 0) camera.setZoom(camera.zoom + 1, sx, sy);
      else if (ev.deltaY > 0) camera.setZoom(camera.zoom - 1, sx, sy);
      refreshHud();
    },
    { passive: false },
  );

  // Keyboard shortcuts
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.closest("input, textarea, select, [contenteditable]")) return;
    if ((ev.key === "[" || ev.key === "]") && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey) {
      if (!ev.repeat) rotateView(ev.key === "[" ? -1 : 1);
      return;
    }
    const picked = decorate.active ? decorate.movingItem : null;
    if (picked && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey) {
      const steps: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const step = steps[ev.key];
      if (step) {
        ev.preventDefault();
        const [x, y] = camera.view.toOffice(...step);
        const [originX, originY] = camera.view.toOffice(0, 0);
        const visualOrigin = snapshot && picked.item.assetId === "chair-office-swivel" && !picked.item.manualPosition
          ? getCenteredChairTile(snapshot.campus, picked.originTx, picked.originTy, picked.item.direction, picked.item.id)
          : undefined;
        decorate.nudgeMove(x - originX, y - originY, visualOrigin);
        return;
      }
      if (ev.key === "Enter" && picked.keyboardTarget) {
        ev.preventDefault();
        if (!ev.repeat) {
          void decorate.handleTileClick(...picked.keyboardTarget)
            .then(refreshHud)
            .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
        }
        return;
      }
    }
    if (ev.key === "r" || ev.key === "R") {
      if (decorate.active) {
        decorate.rotateCw();
        refreshHud();
      }
    } else if (ev.key === "l" || ev.key === "L") {
      if (decorate.active) decorate.setActive(false);
      zoneEditorState.active = false;
      zoneEditorState.startTile = null;
      layerState.mode =
        layerState.mode === "off"
          ? "permissions"
          : layerState.mode === "permissions"
            ? "layers"
            : "off";
      refreshHud();
    } else if ((ev.key === "z" || ev.key === "Z") && !ev.metaKey && !ev.ctrlKey) {
      zoneEditorState.active = !zoneEditorState.active;
      zoneEditorState.startTile = null;
      if (zoneEditorState.active) {
        decorate.setActive(false);
        layerState.mode = "off";
      }
      refreshHud();
    } else if (ev.key === "Escape") {
      if (zoneEditorState.active) {
        if (zoneEditorState.startTile) {
          zoneEditorState.startTile = null;
        } else if (zoneEditorState.editingZoneId) {
          zoneEditorState.editingZoneId = null;
        } else {
          zoneEditorState.active = false;
        }
        refreshHud();
      } else if (decorate.active) {
        if (!decorate.cancelMove()) {
          decorate.setActive(false);
        }
        refreshHud();
      } else if (layerState.mode !== "off") {
        layerState.mode = "off";
        refreshHud();
      } else if (selectedEmployeeId) {
        selectedEmployeeId = null;
        refreshHud();
      }
    } else if (["1", "2", "3", "4"].includes(ev.key)) {
      camera.setZoom(Number(ev.key), canvas.width / 2, canvas.height / 2);
      refreshHud();
    } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
      if (decorate.active) {
        ev.preventDefault();
        if (ev.shiftKey) void decorate.redo().then(refreshHud);
        else void decorate.undo().then(refreshHud);
      }
    }
  });

  // Adaptive FPS render loop (pauses completely when tab is hidden)
  let lastFrameTs = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (document.hidden || !snapshot) return;

    const dt = now - lastFrameTs;
    const camMoving = camera.update(dt);
    const simStep = sim.step(dt);
    lastFrameTs = now;

    const targetFps =
      camMoving || dragging || decorate.active || zoneEditorState.active || layerState.mode !== "off"
        ? 30
        : simStep.targetFps;
    const minInterval = 1000 / targetFps;
    if (now - lastDrawTs < minInterval) return;
    lastDrawTs = now;

    let ghost = null;
    if (decorate.active && decorate.isFloorPainting() && hoverTile) {
      const [tx, ty] = hoverTile;
      const inCampus =
        tx >= 0 && ty >= 0 && tx < snapshot.campus.widthTiles && ty < snapshot.campus.depthTiles;
      ghost = {
        tx,
        ty,
        assetId: decorate.selectedAssetId ?? "floor-office-carpet",
        direction: "se" as const,
        valid: inCampus,
        brushSize: decorate.floorBrushSize,
        floorReset: decorate.floorResetMode,
      };
    } else {
      const ghostAssetId =
        decorate.tool === "place"
          ? decorate.selectedAssetId
          : decorate.tool === "move"
            ? decorate.movingItem?.item.assetId ?? null
            : null;
      const pointerTarget = decorate.movingItem && furniturePointer
        ? decorate.getPointerMoveTarget(...camera.screenToTile(...furniturePointer))
        : null;
      const placementTile = decorate.movingItem
        ? decorate.movingItem.keyboardTarget ?? pointerTarget
        : hoverTile;
      if (decorate.active && ghostAssetId && placementTile) {
        const [tx, ty] = placementTile;
        const zone =
          snapshot.campus.zones.find(
            (z) =>
              z.kind === "floor" &&
              tx >= z.originX &&
              tx < z.originX + z.width &&
              ty >= z.originY &&
              ty < z.originY + z.height,
          ) ??
          snapshot.campus.zones.find(
            (z) =>
              z.kind !== "hypersleep" &&
              tx >= z.originX &&
              tx < z.originX + z.width &&
              ty >= z.originY &&
              ty < z.originY + z.height,
          );
        const cat = catalogById.get(ghostAssetId);
        const baseFp = cat?.footprintTiles ?? [1, 1];
        const [fw, fd] =
          decorate.direction === "sw" || decorate.direction === "ne" ? [baseFp[1], baseFp[0]] : [baseFp[0], baseFp[1]];
        let valid = false;
        let surfaceOffsetY = 0;
        const ghostIsTabletop = isTabletopAsset(ghostAssetId, cat?.layer, cat);
        if (zone) {
          const lx = tx - zone.originX;
          const ly = ty - zone.originY;
          const inBounds = lx >= 0 && ly >= 0 && lx + fw <= zone.width && ly + fd <= zone.height;
          const ignoreId = decorate.movingItem?.item.id;
          const isOpenSandboxZone =
            zone.kind === "floor" || zone.kind === "boss" || zone.kind === "cowork" || zone.kind === "hypersleep";
          const zoneFurn = snapshot.campus.worldFurniture.filter(
            (f) => f.id !== ignoreId && (isOpenSandboxZone || f.zoneId === zone.zoneId) && !f.id.startsWith("sys-div-"),
          );

          if (isEdgeDividerAsset(ghostAssetId)) {
            const candSegs = expandEdgeDividerSegments(ghostAssetId, tx, ty, decorate.direction);
            const existingEdges = new Set<string>();
            for (const f of zoneFurn) {
              if (!isEdgeDividerAsset(f.assetId)) continue;
              for (const seg of expandEdgeDividerSegments(f.assetId, f.tx, f.ty, f.direction)) {
                existingEdges.add(seg.edgeKey);
              }
            }
            const campusW = snapshot.campus.widthTiles;
            const campusD = snapshot.campus.depthTiles;
            const segsInBounds = candSegs.every(
              (seg) =>
                seg.rx >= -0.5 &&
                seg.ry >= -0.5 &&
                seg.rx < campusW + 0.5 &&
                seg.ry < campusD + 0.5,
            );
            valid = segsInBounds && candSegs.every((seg) => !existingEdges.has(seg.edgeKey));
          } else if (ghostIsTabletop) {
            const surfaceHeightByTile = new Map<string, number>();
            const topOcc = new Set<string>();
            for (const f of zoneFurn) {
              const fCat = catalogById.get(f.assetId);
              const fIsTop = isTabletopAsset(f.assetId, f.layer, fCat);
              if (fIsTop) {
                for (let dy = 0; dy < f.footprintTiles[1]; dy += 0.5) {
                  for (let dx = 0; dx < f.footprintTiles[0]; dx += 0.5) {
                    topOcc.add(`${f.tx + dx},${f.ty + dy}`);
                  }
                }
              } else {
                const h = getSurfaceHostHeightVoxels(f.assetId, fCat);
                if (h) {
                  for (let dy = 0; dy < f.footprintTiles[1]; dy += 0.5) {
                    for (let dx = 0; dx < f.footprintTiles[0]; dx += 0.5) {
                      surfaceHeightByTile.set(`${f.tx + dx},${f.ty + dy}`, h);
                    }
                  }
                }
              }
            }
            let allOnSurface = inBounds;
            let noTopOverlap = true;
            let hostVoxels = 0;
            for (let dy = 0; dy < fd; dy += 0.5) {
              for (let dx = 0; dx < fw; dx += 0.5) {
                const key = `${tx + dx},${ty + dy}`;
                const h = surfaceHeightByTile.get(key);
                if (!h) allOnSurface = false;
                else hostVoxels = Math.max(hostVoxels, h);
                if (topOcc.has(key)) noTopOverlap = false;
              }
            }
            valid = allOnSurface && noTopOverlap;
            if (hostVoxels > 0) surfaceOffsetY = surfaceVoxelsToWorldOffsetY(hostVoxels);
          } else {
            const floorFurn = zoneFurn.filter(
              (f) => !isEdgeDividerAsset(f.assetId) && !isTabletopAsset(f.assetId, f.layer, catalogById.get(f.assetId)),
            );
            const candidateFootprint = { assetId: ghostAssetId, direction: decorate.direction, tx, ty, footprintTiles: [fw, fd] as [number, number] };
            const collides = crossesWallSegment(snapshot.campus.wallSegments, tx, ty, fw, fd) ||
              floorFurn.some((item) => furnitureFootprintsCollide(candidateFootprint, item));
            if (isOpenSandboxZone) {
              valid = inBounds && !collides;
            } else {
              const occ = new Set<string>();
              const walkBlocked = new Set<string>();
              for (const f of floorFurn) {
                const fCfg = resolveAssetLayerConfig(f.assetId, f.layer, catalogById.get(f.assetId));
                const blocksWalk = !isWalkablePermission(fCfg.tilePermission);
                for (let y = Math.floor(f.ty - zone.originY); y < f.ty - zone.originY + f.footprintTiles[1]; y++) {
                  for (let x = Math.floor(f.tx - zone.originX); x < f.tx - zone.originX + f.footprintTiles[0]; x++) {
                    const k = `${x},${y}`;
                    occ.add(k);
                    if (blocksWalk) walkBlocked.add(k);
                  }
                }
              }
              const candCfg = resolveAssetLayerConfig(ghostAssetId, cat?.layer, cat);
              const candBlocksWalk = !isWalkablePermission(candCfg.tilePermission);
              const blockedWithCand = new Set(walkBlocked);
              for (let y = Math.floor(ly); y < ly + fd; y++) {
                for (let x = Math.floor(lx); x < lx + fw; x++) {
                  const k = `${x},${y}`;
                  occ.add(k);
                  if (candBlocksWalk) blockedWithCand.add(k);
                }
              }
              const openEntrances: Array<[number, number]> = [];
              if (!occ.has("2,5")) openEntrances.push([2, 5]);
              if (!occ.has("3,5")) openEntrances.push([3, 5]);
              let sealsOff = false;
              if (openEntrances.length > 0 && inBounds && !collides && candBlocksWalk) {
                const reach = (blocked: Set<string>): Set<string> => {
                  const vis = new Set<string>();
                  const q: Array<[number, number]> = [];
                  for (const [ex, ey] of openEntrances) {
                    const k = `${ex},${ey}`;
                    if (!blocked.has(k)) {
                      vis.add(k);
                      q.push([ex, ey]);
                    }
                  }
                  while (q.length > 0) {
                    const [cx, cy] = q.shift()!;
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                      const nx = cx + dx;
                      const ny = cy + dy;
                      if (nx < 0 || nx >= zone.width || ny < 0 || ny >= zone.height) continue;
                      const nk = `${nx},${ny}`;
                      if (vis.has(nk) || blocked.has(nk)) continue;
                      vis.add(nk);
                      q.push([nx, ny]);
                    }
                  }
                  return vis;
                };
                const before = reach(walkBlocked);
                const after = reach(blockedWithCand);
                for (const tile of before) {
                  if (!blockedWithCand.has(tile) && !after.has(tile)) {
                    sealsOff = true;
                    break;
                  }
                }
              }
              valid = inBounds && !collides && openEntrances.length > 0 && !sealsOff;
            }
          }
        }
        ghost = {
          tx,
          ty,
          assetId: ghostAssetId,
          manualPosition: Boolean(decorate.movingItem),
          direction: decorate.direction,
          valid,
          ...(surfaceOffsetY > 0 ? { surfaceOffsetY } : {}),
        };
      }
    }

    latestVisuals = simStep.visuals;

    const pointer = furniturePointer;
    const highlightTool = decorate.active && !zoneEditorState.active && !dragging && !decorate.isFloorPainting()
      ? decorate.tool === "erase" ? "erase" : decorate.tool === "move" && !decorate.movingItem ? "move" : null
      : null;

    renderer.render(ctx, {
      state: snapshot.state,
      campus: snapshot.campus,
      camera,
      atlas,
      catalogById,
      employees: simStep.visuals,
      syncPackets: simStep.syncPackets,
      selectedEmployeeId,
      furnitureHover: highlightTool && pointer ? {
        tool: highlightTool,
        pick: (boxes) => furnitureAt(...pointer, boxes, true)?.id,
      } : undefined,
      movingFurnitureId: decorate.movingItem?.item.id ?? null,
      selectedLayerFurnitureId: layerState.mode === "layers" ? layerState.selectedFurnitureId : null,
      bayPopAnimations: sim.getBayPopAnimations(),
      ghost,
      zoneEditor: zoneEditorState.active
        ? {
            active: true,
            startTile: zoneEditorState.startTile,
            hoverTile,
            draftColor: zoneEditorState.draftColor,
            draftLabel: `${zoneEditorState.draftIcon} ${zoneEditorState.draftName.trim() || "New Zone"}`,
            editingZoneId: zoneEditorState.editingZoneId,
          }
        : null,
      layerOverlayMode: layerState.mode,
      hoverTile,
      timeMs: now,
    });

    hud.renderMinimap(snapshot.campus, simStep.visuals);
  };

  requestAnimationFrame(loop);
}

void bootstrap();
