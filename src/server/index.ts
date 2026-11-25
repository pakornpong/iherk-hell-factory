import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import {
  AgentTelemetryEventSchema,
  CustomZoneRoleSchema,
  DepartmentIdSchema,
  DirectionSchema,
  RenderLayerSchema,
  ThemeModeSchema,
  TilePermissionSchema,
  type WsServerMessage,
} from "../shared/types.js";
import { AntigravityWatcher } from "./antigravity-watcher.js";
import type { OfficeEngine } from "./office-engine.js";
import type { PixcelBridge } from "./pixcel-bridge.js";
import type { OfficeStore } from "./store.js";

export interface DemoControllerLike {
  isRunning(): boolean;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}

export interface HellFactoryServer {
  port: number;
  url: string;
  close(): Promise<void>;
  broadcastAtlasUpdated(customAssetId?: string): void;
  setDemoController(demo: DemoControllerLike): void;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const PlaceFurnitureBodySchema = z.object({
  zoneId: z.string().optional(),
  lx: z.number().int().optional(),
  ly: z.number().int().optional(),
  tx: z.number().int().optional(),
  ty: z.number().int().optional(),
  assetId: z.string().min(1),
  direction: DirectionSchema.default("se"),
  placedBy: z.enum(["user", "gemini"]).optional(),
});

const MoveFurnitureBodySchema = z.object({
  zoneId: z.string().optional(),
  lx: z.number().int().optional(),
  ly: z.number().int().optional(),
  tx: z.number().int().optional(),
  ty: z.number().int().optional(),
  direction: DirectionSchema.optional(),
  renderLayer: RenderLayerSchema.optional(),
});

const TilePermissionBodySchema = z.union([
  z.object({
    resetAll: z.literal(true),
  }),
  z.object({
    tx: z.number().int(),
    ty: z.number().int(),
    permission: TilePermissionSchema.nullable(),
  }),
]);

const ManageBayBodySchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  department: DepartmentIdSchema.optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  archived: z.boolean().optional(),
});

const ThemeBodySchema = z.object({
  theme: ThemeModeSchema,
});

const ExpandFloorBodySchema = z.object({
  addWidth: z.number().int().min(0).max(24).optional(),
  addDepth: z.number().int().min(0).max(24).optional(),
});

const ResizeFloorBodySchema = z.object({
  deltaWidth: z.number().int().min(-24).max(24).optional(),
  deltaDepth: z.number().int().min(-24).max(24).optional(),
  widthTiles: z.number().int().min(12).max(96).optional(),
  depthTiles: z.number().int().min(12).max(96).optional(),
});

const FloorTileOpSchema = z.object({
  tx: z.number().int(),
  ty: z.number().int(),
  assetId: z.string().min(1).max(128).nullable(),
});

const FloorTilesBodySchema = z.union([
  z.object({ resetAll: z.literal(true) }),
  FloorTileOpSchema,
  z.object({ tiles: z.array(FloorTileOpSchema).min(1).max(256) }),
]);

const CreateCustomZoneBodySchema = z.object({
  name: z.string().min(1).max(64),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: CustomZoneRoleSchema.optional(),
  x: z.number().int().min(0).max(127),
  y: z.number().int().min(0).max(127),
  width: z.number().int().min(1).max(96),
  height: z.number().int().min(1).max(96),
});

const UpdateCustomZoneBodySchema = CreateCustomZoneBodySchema.partial();

function timingSafeMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) throw new Error("Request body too large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function serveStaticFile(res: http.ServerResponse, baseDir: string, relPath: string): Promise<boolean> {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.join(baseDir, normalized);
  if (!fullPath.startsWith(path.resolve(baseDir))) return false;
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return false;
    const ext = path.extname(fullPath).toLowerCase();
    const data = await fs.readFile(fullPath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export async function createHellFactoryServer(opts: {
  host?: string;
  port?: number;
  engine: OfficeEngine;
  store: OfficeStore;
  pixcelBridge: PixcelBridge;
  publicDir: string;
  runtimeAssetsDir: string;
  watchAntigravity?: boolean;
  brainDir?: string;
  demoController?: DemoControllerLike;
}): Promise<HellFactoryServer> {
  const host = opts.host ?? "127.0.0.1";
  const requestedPort = opts.port ?? 7140;
  const architectToken = await opts.store.ensureArchitectToken();
  const uiSessionToken = crypto.randomBytes(24).toString("hex");
  let demoController: DemoControllerLike | undefined = opts.demoController;

  let actualPort = requestedPort;

  const isAllowedLocalOrigin = (origin: string): boolean => {
    return (
      origin === `http://127.0.0.1:${actualPort}` ||
      origin === `http://localhost:${actualPort}`
    );
  };

  const authorizeArchitect = (
    req: http.IncomingMessage,
  ): { ok: true; actor: "gemini" | "user" } | { ok: false; status: 401 | 403; error: string } => {
    const rawArch = req.headers["x-architect-token"];
    const archHeader = Array.isArray(rawArch) ? rawArch[0] : rawArch;
    if (archHeader && timingSafeMatch(archHeader, architectToken)) {
      return { ok: true, actor: "gemini" };
    }

    const rawOrigin = req.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (origin && !isAllowedLocalOrigin(origin)) {
      return { ok: false, status: 403, error: "Forbidden cross-origin Architect request" };
    }

    const rawHost = req.headers.host ?? "";
    const hostVal = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    if (
      hostVal &&
      hostVal !== `127.0.0.1:${actualPort}` &&
      hostVal !== `localhost:${actualPort}`
    ) {
      return { ok: false, status: 403, error: "Forbidden Host header" };
    }

    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies.hf_ui_session ?? "";
    const rawUi = req.headers["x-ui-session"];
    const uiHeader = Array.isArray(rawUi) ? rawUi[0] : rawUi ?? "";
    if (
      cookieToken &&
      uiHeader &&
      timingSafeMatch(cookieToken, uiSessionToken) &&
      timingSafeMatch(uiHeader, uiSessionToken)
    ) {
      return { ok: true, actor: "user" };
    }

    return { ok: false, status: 401, error: "Unauthorized: valid Architect token or local UI session required" };
  };

  const clients = new Set<WebSocket>();
  const broadcast = (msg: WsServerMessage): void => {
    const serialized = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  };

  const onSnapshot = (payload: ReturnType<OfficeEngine["getSnapshot"]>) => {
    broadcast({ type: "state:snapshot", payload });
  };
  const onActivity = (payload: any) => {
    broadcast({ type: "event:activity", payload });
  };
  const onBayExpanded = (payload: any) => {
    broadcast({ type: "bay:expanded", payload });
  };

  opts.engine.on("snapshot", onSnapshot);
  opts.engine.on("activity", onActivity);
  opts.engine.on("bay_expanded", onBayExpanded);

  let agyWatcher: AntigravityWatcher | null = null;
  const shouldWatchAgy = opts.watchAntigravity ?? process.env.HELL_FACTORY_WATCH_AGY !== "0";
  if (shouldWatchAgy) {
    const brainDir = opts.brainDir ?? path.join(os.homedir(), ".gemini", "antigravity", "brain");
    agyWatcher = new AntigravityWatcher({
      brainDir,
      onEvent: async (ev) => {
        await opts.engine.ingestEvent(ev);
      },
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url ?? "/", `http://${host}:${actualPort}`);
      const pathname = reqUrl.pathname;
      const method = req.method ?? "GET";

      // 1. Root page with injected local UI session capability
      if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        const htmlPath = path.join(opts.publicDir, "index.html");
        const rawHtml = await fs.readFile(htmlPath, "utf8");
        const injected = rawHtml.replace(
          "<!--UI_SESSION-->",
          `<script>window.__UI_SESSION__=${JSON.stringify(uiSessionToken)};</script>`,
        );
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": `hf_ui_session=${uiSessionToken}; HttpOnly; SameSite=Strict; Path=/`,
        });
        res.end(injected);
        return;
      }

      // 2. Read-only state & catalog endpoints
      if (method === "GET" && pathname === "/api/state") {
        sendJson(res, 200, opts.engine.getSnapshot());
        return;
      }
      if (method === "GET" && pathname === "/api/catalog") {
        sendJson(res, 200, { catalog: opts.engine.getCatalog() });
        return;
      }
      if (method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true, demoMode: opts.engine.isDemoMode() });
        return;
      }

      // 3. Read-only telemetry ingest (CANNOT mutate furniture or assets)
      if (method === "POST" && pathname === "/api/events") {
        const body = await readJsonBody(req);
        const ev = AgentTelemetryEventSchema.parse(body);
        if (ev.source === "antigravity" && agyWatcher) {
          agyWatcher.markHookSeen(ev.sessionId);
        }
        await opts.engine.ingestEvent(ev);
        sendJson(res, 200, { ok: true });
        return;
      }

      // 4. Token/session-gated Architect mutation API (/api/architect/*)
      if (pathname.startsWith("/api/architect/")) {
        const auth = authorizeArchitect(req);
        if (!auth.ok) {
          sendJson(res, auth.status, { error: auth.error });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/furniture") {
          const body = PlaceFurnitureBodySchema.parse(await readJsonBody(req));
          const created = await opts.engine.placeFurniture({
            ...body,
            placedBy: auth.actor === "gemini" ? "gemini" : (body.placedBy ?? "user"),
          });
          sendJson(res, 200, { ok: true, furniture: created });
          return;
        }

        const furnMatch = pathname.match(/^\/api\/architect\/furniture\/([^/]+)$/);
        if (furnMatch) {
          const instanceId = decodeURIComponent(furnMatch[1]);
          if (method === "PATCH") {
            const body = MoveFurnitureBodySchema.parse(await readJsonBody(req));
            const moved = await opts.engine.moveFurniture(instanceId, body);
            sendJson(res, 200, { ok: true, furniture: moved });
            return;
          }
          if (method === "DELETE") {
            await opts.engine.removeFurniture(instanceId);
            sendJson(res, 200, { ok: true });
            return;
          }
        }

        const bayMatch = pathname.match(/^\/api\/architect\/bays\/([^/]+)$/);
        if (bayMatch && method === "PATCH") {
          const bayId = decodeURIComponent(bayMatch[1]);
          const body = ManageBayBodySchema.parse(await readJsonBody(req));
          const bay = await opts.engine.manageBay(bayId, body);
          sendJson(res, 200, { ok: true, bay });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/floor/expand") {
          const body = ExpandFloorBodySchema.parse(await readJsonBody(req));
          const size = await opts.engine.expandFloor(body);
          sendJson(res, 200, { ok: true, ...size });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/floor/resize") {
          const body = ResizeFloorBodySchema.parse(await readJsonBody(req));
          const size = await opts.engine.resizeFloor(body);
          sendJson(res, 200, { ok: true, ...size });
          return;
        }

        if (method === "PATCH" && pathname === "/api/architect/floor-tiles") {
          const body = FloorTilesBodySchema.parse(await readJsonBody(req));
          if ("resetAll" in body) {
            await opts.engine.clearFloorTileOverrides();
            sendJson(res, 200, { ok: true, floorTileOverrides: {} });
            return;
          }
          const tiles = "tiles" in body ? body.tiles : [body];
          const floorTileOverrides = await opts.engine.setFloorTiles(tiles);
          sendJson(res, 200, { ok: true, floorTileOverrides });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/zones") {
          const body = CreateCustomZoneBodySchema.parse(await readJsonBody(req));
          const zone = await opts.engine.createCustomZone(body);
          sendJson(res, 200, { ok: true, zone });
          return;
        }

        const relocatePodsMatch = pathname.match(/^\/api\/architect\/zones\/([^/]+)\/relocate-pods$/);
        if (relocatePodsMatch && method === "POST") {
          const id = decodeURIComponent(relocatePodsMatch[1]);
          const result = await opts.engine.relocateHypersleepPodsToZone(id);
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        const customZoneMatch = pathname.match(/^\/api\/architect\/zones\/([^/]+)$/);
        if (customZoneMatch && method === "PATCH") {
          const id = decodeURIComponent(customZoneMatch[1]);
          const body = UpdateCustomZoneBodySchema.parse(await readJsonBody(req));
          const zone = await opts.engine.updateCustomZone(id, body);
          sendJson(res, 200, { ok: true, zone });
          return;
        }
        if (customZoneMatch && method === "DELETE") {
          const id = decodeURIComponent(customZoneMatch[1]);
          await opts.engine.deleteCustomZone(id);
          sendJson(res, 200, { ok: true });
          return;
        }

        if (method === "PATCH" && pathname === "/api/architect/theme") {
          const body = ThemeBodySchema.parse(await readJsonBody(req));
          await opts.engine.setTheme(body.theme);
          sendJson(res, 200, { ok: true, theme: body.theme });
          return;
        }

        if (method === "PATCH" && pathname === "/api/architect/tile-permissions") {
          const body = TilePermissionBodySchema.parse(await readJsonBody(req));
          if ("resetAll" in body) {
            await opts.engine.clearTilePermissionOverrides();
            sendJson(res, 200, { ok: true, overrides: {} });
            return;
          }
          const overrides = await opts.engine.setTilePermissionOverride(body.tx, body.ty, body.permission);
          sendJson(res, 200, { ok: true, overrides });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/assets") {
          const body = await readJsonBody(req, 4 * 1024 * 1024);
          const crafted = await opts.pixcelBridge.craftCustomAsset(body);
          const catalog = await opts.pixcelBridge.listCatalog();
          opts.engine.updateCatalog(catalog);
          broadcast({
            type: "atlas:updated",
            payload: { timestamp: Date.now(), customAssetId: crafted.assetId },
          });
          sendJson(res, 200, {
            ok: true,
            assetId: crafted.assetId,
            catalogEntry: crafted.catalogEntry,
            contactSheetBase64: crafted.contactSheetPng.toString("base64"),
          });
          return;
        }

        if (method === "POST" && pathname === "/api/architect/demo/toggle") {
          if (!demoController) {
            sendJson(res, 501, { error: "Demo controller not attached" });
            return;
          }
          if (demoController.isRunning()) {
            await demoController.stop();
          } else {
            await demoController.start();
          }
          sendJson(res, 200, { ok: true, demoMode: demoController.isRunning() });
          return;
        }

        sendJson(res, 404, { error: `Unknown Architect endpoint ${method} ${pathname}` });
        return;
      }

      // 5. Runtime atlases & static client assets
      if (method === "GET" && pathname.startsWith("/runtime-assets/")) {
        const rel = pathname.slice("/runtime-assets/".length);
        if (await serveStaticFile(res, opts.runtimeAssetsDir, rel)) return;
      }
      if (method === "GET") {
        const rel = pathname.replace(/^\/+/, "");
        if (rel && (await serveStaticFile(res, opts.publicDir, rel))) return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 400, { error: message });
    }
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "state:snapshot", payload: opts.engine.getSnapshot() }));
    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        actualPort = addr.port;
      }
      resolve();
    });
  });

  const tickTimer = setInterval(() => {
    void opts.engine.tick();
  }, 1000);
  tickTimer.unref?.();

  agyWatcher?.start();

  return {
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    broadcastAtlasUpdated(customAssetId?: string) {
      broadcast({ type: "atlas:updated", payload: { timestamp: Date.now(), customAssetId } });
    },
    setDemoController(demo: DemoControllerLike) {
      demoController = demo;
    },
    async close() {
      clearInterval(tickTimer);
      agyWatcher?.stop();
      opts.engine.off("snapshot", onSnapshot);
      opts.engine.off("activity", onActivity);
      opts.engine.off("bay_expanded", onBayExpanded);
      for (const ws of clients) ws.close();
      clients.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
