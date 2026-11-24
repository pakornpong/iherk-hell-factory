import type {
  CatalogEntry,
  OfficeSnapshotPayload,
  ThemeMode,
  WsServerMessage,
} from "../shared/types.js";
import { AtlasManager } from "./atlas-loader.js";
import { IsoCamera } from "./camera.js";
import { DecorateController, isEditableFurniture } from "./decorate.js";
import { OfficeHud } from "./hud.js";
import { IsoRenderer } from "./iso-renderer.js";
import { OfficeSimulation } from "./sim.js";

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
  let hoverTile: [number, number] | null = null;
  let cameraInitialized = false;

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
  });

  const refreshHud = () => {
    if (!snapshot) return;
    hud.renderHud(snapshot, catalog, selectedEmployeeId, camera.zoom);
  };

  const hud = new OfficeHud(decorate, {
    onFocusBay(bayId) {
      const zone = snapshot?.campus.zones.find((z) => z.bayId === bayId);
      if (zone) {
        camera.glideToTile(zone.originX + 3, zone.originY + 3, canvas.width, canvas.height);
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
      camera.setZoom(zoom);
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
    if (!cameraInitialized) {
      cameraInitialized = true;
      camera.snapToTile(6, 3, canvas.width, canvas.height);
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

    if (decorate.active && hoverTile) {
      const [tx, ty] = hoverTile;
      const existing = snapshot.campus.worldFurniture.find(
        (f) =>
          isEditableFurniture(f) &&
          tx >= f.tx &&
          tx < f.tx + f.footprintTiles[0] &&
          ty >= f.ty &&
          ty < f.ty + f.footprintTiles[1],
      );
      void decorate
        .handleTileClick(tx, ty, existing)
        .then(() => refreshHud())
        .catch((err) => hud.showToast(err instanceof Error ? err.message : String(err), true));
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

  canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      if (ev.deltaY < 0) camera.setZoom(camera.zoom + 1);
      else if (ev.deltaY > 0) camera.setZoom(camera.zoom - 1);
      refreshHud();
    },
    { passive: false },
  );

  // Keyboard shortcuts
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.key === "r" || ev.key === "R") {
      if (decorate.active) {
        decorate.rotateCw();
        refreshHud();
      }
    } else if (ev.key === "Escape") {
      if (decorate.active) {
        decorate.setActive(false);
        refreshHud();
      } else if (selectedEmployeeId) {
        selectedEmployeeId = null;
        refreshHud();
      }
    } else if (["1", "2", "3", "4"].includes(ev.key)) {
      camera.setZoom(Number(ev.key));
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
  let lastDrawTs = 0;

  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (document.hidden || !snapshot) return;

    const dt = now - lastFrameTs;
    const camMoving = camera.update(dt);
    const simStep = sim.step(dt);
    lastFrameTs = now;

    const targetFps = camMoving || dragging || decorate.active ? 30 : simStep.targetFps;
    const minInterval = 1000 / targetFps;
    if (now - lastDrawTs < minInterval) return;
    lastDrawTs = now;

    let ghost = null;
    const ghostAssetId =
      decorate.tool === "place"
        ? decorate.selectedAssetId
        : decorate.tool === "move"
          ? decorate.movingItem?.item.assetId ?? null
          : null;
    if (decorate.active && ghostAssetId && hoverTile) {
      const [tx, ty] = hoverTile;
      const zone = snapshot.campus.zones.find(
        (z) => tx >= z.originX && tx < z.originX + z.width && ty >= z.originY && ty < z.originY + z.height,
      );
      const cat = catalogById.get(ghostAssetId);
      const baseFp = cat?.footprintTiles ?? [1, 1];
      const [fw, fd] =
        decorate.direction === "sw" || decorate.direction === "ne" ? [baseFp[1], baseFp[0]] : [baseFp[0], baseFp[1]];
      let valid = false;
      if (zone) {
        const lx = tx - zone.originX;
        const ly = ty - zone.originY;
        const inBounds = lx >= 0 && ly >= 0 && lx + fw <= zone.width && ly + fd <= zone.height;
        const ignoreId = decorate.movingItem?.item.id;
        const collides = snapshot.campus.worldFurniture.some((f) => {
          if (f.id === ignoreId || f.zoneId !== zone.zoneId || f.id.startsWith("sys-div-")) return false;
          return (
            tx < f.tx + f.footprintTiles[0] &&
            tx + fw > f.tx &&
            ty < f.ty + f.footprintTiles[1] &&
            ty + fd > f.ty
          );
        });
        valid = inBounds && !collides;
      }
      ghost = {
        tx,
        ty,
        assetId: ghostAssetId,
        direction: decorate.direction,
        valid,
      };
    }

    renderer.render(ctx, {
      state: snapshot.state,
      campus: snapshot.campus,
      camera,
      atlas,
      catalogById,
      employees: simStep.visuals,
      syncPackets: simStep.syncPackets,
      selectedEmployeeId,
      bayPopAnimations: sim.getBayPopAnimations(),
      ghost,
      timeMs: now,
    });

    hud.renderMinimap(snapshot.campus, simStep.visuals);
  };

  requestAnimationFrame(loop);
}

void bootstrap();
