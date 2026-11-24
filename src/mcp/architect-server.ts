import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OfficeEngine } from "../server/office-engine.js";
import { PixcelBridge } from "../server/pixcel-bridge.js";
import { OfficeStore } from "../server/store.js";
import { DirectionSchema } from "../shared/types.js";

export interface ArchitectMcpOptions {
  serverUrl: string;
  dataDir: string;
  pixcelRoot: string;
  projectRoot: string;
  runtimeOutDir: string;
}

export function createArchitectMcpServer(opts: ArchitectMcpOptions): McpServer {
  const store = new OfficeStore(opts.dataDir);
  const bridge = new PixcelBridge({
    pixcelRoot: opts.pixcelRoot,
    projectRoot: opts.projectRoot,
    runtimeOutDir: opts.runtimeOutDir,
  });

  const callServer = async <T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<{ reached: true; data: T } | { reached: false }> => {
    const token = await store.ensureArchitectToken();
    try {
      const res = await fetch(`${opts.serverUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Architect-Token": token,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Server returned ${res.status}`);
      }
      return { reached: true, data: json as T };
    } catch (err) {
      // Distinguish connection refused (offline fallback) vs server validation error (rethrow)
      if (err instanceof TypeError || (err instanceof Error && /ECONNREFUSED|fetch failed/i.test(err.message))) {
        return { reached: false };
      }
      throw err;
    }
  };

  const withOfflineEngine = async <T>(fn: (engine: OfficeEngine) => Promise<T>): Promise<T> => {
    const catalog = await bridge.listCatalog();
    const engine = new OfficeEngine({
      store,
      catalogById: new Map(catalog.map((c) => [c.id, c])),
    });
    await engine.init();
    return fn(engine);
  };

  const server = new McpServer({
    name: "iherk-hell-factory-architect",
    version: "0.1.0",
  });

  server.tool(
    "get_office_state",
    "Inspect all office bays (active & archived), common wings, employees, and placed furniture (zone-local and world coordinates).",
    {},
    async () => {
      const remote = await callServer<unknown>("GET", "/api/state");
      const data = remote.reached ? remote.data : await withOfflineEngine(async (e) => e.getSnapshot());
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "list_furniture_catalog",
    "List all built-in and Gemini-crafted furniture/prop assets with footprint sizes and layers.",
    {},
    async () => {
      const remote = await callServer<{ catalog: unknown[] }>("GET", "/api/catalog");
      const catalog = remote.reached ? remote.data.catalog : await bridge.listCatalog();
      return { content: [{ type: "text", text: JSON.stringify({ catalog }, null, 2) }] };
    },
  );

  server.tool(
    "place_furniture",
    "Place a furniture item inside a bay or common wing using (zoneId, lx, ly) or world (tx, ty). Validates collisions and keeps walkways open.",
    {
      zoneId: z.string().optional().describe("Zone ID like 'bay:bay-0' or 'common:0'"),
      lx: z.number().int().min(0).max(5).optional(),
      ly: z.number().int().min(0).max(5).optional(),
      tx: z.number().int().optional(),
      ty: z.number().int().optional(),
      assetId: z.string().min(1),
      direction: DirectionSchema.default("se"),
    },
    async (args) => {
      try {
        const remote = await callServer<unknown>("POST", "/api/architect/furniture", {
          ...args,
          placedBy: "gemini",
        });
        const data = remote.reached
          ? remote.data
          : {
              ok: true,
              furniture: await withOfflineEngine((e) =>
                e.placeFurniture({ ...args, placedBy: "gemini" }),
              ),
            };
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    },
  );

  server.tool(
    "move_furniture",
    "Move or rotate an existing placed furniture instance by its instanceId.",
    {
      instanceId: z.string().min(1),
      zoneId: z.string().optional(),
      lx: z.number().int().min(0).max(5).optional(),
      ly: z.number().int().min(0).max(5).optional(),
      tx: z.number().int().optional(),
      ty: z.number().int().optional(),
      direction: DirectionSchema.optional(),
    },
    async ({ instanceId, ...patch }) => {
      try {
        const remote = await callServer<unknown>(
          "PATCH",
          `/api/architect/furniture/${encodeURIComponent(instanceId)}`,
          patch,
        );
        const data = remote.reached
          ? remote.data
          : { ok: true, furniture: await withOfflineEngine((e) => e.moveFurniture(instanceId, patch)) };
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    },
  );

  server.tool(
    "remove_furniture",
    "Remove a placed furniture instance by its instanceId.",
    {
      instanceId: z.string().min(1),
    },
    async ({ instanceId }) => {
      try {
        const remote = await callServer<unknown>(
          "DELETE",
          `/api/architect/furniture/${encodeURIComponent(instanceId)}`,
        );
        if (!remote.reached) {
          await withOfflineEngine((e) => e.removeFurniture(instanceId));
        }
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, removed: instanceId }) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    },
  );

  server.tool(
    "craft_furniture_asset",
    "Author or update a custom .pixcel.json furniture asset via iherk-pixcel, repack the runtime custom atlas, hot-reload connected browsers, and return a 4-direction PNG contact sheet for visual inspection.",
    {
      asset: z.record(z.string(), z.unknown()).describe("Valid iherk-pixcel .pixcel.json asset object"),
    },
    async ({ asset }) => {
      try {
        const remote = await callServer<{
          ok: boolean;
          assetId: string;
          catalogEntry: unknown;
          contactSheetBase64: string;
        }>("POST", "/api/architect/assets", asset);

        if (remote.reached) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { ok: true, assetId: remote.data.assetId, catalogEntry: remote.data.catalogEntry },
                  null,
                  2,
                ),
              },
              {
                type: "image",
                mimeType: "image/png",
                data: remote.data.contactSheetBase64,
              },
            ],
          };
        }

        const crafted = await bridge.craftCustomAsset(asset);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ok: true, assetId: crafted.assetId, catalogEntry: crafted.catalogEntry },
                null,
                2,
              ),
            },
            {
              type: "image",
              mimeType: "image/png",
              data: crafted.contactSheetPng.toString("base64"),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    },
  );

  server.tool(
    "manage_bay",
    "Rename a project bay, change its accent color, or archive/unarchive it.",
    {
      bayId: z.string().min(1),
      displayName: z.string().min(1).max(128).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      archived: z.boolean().optional(),
    },
    async ({ bayId, ...patch }) => {
      try {
        const remote = await callServer<unknown>(
          "PATCH",
          `/api/architect/bays/${encodeURIComponent(bayId)}`,
          patch,
        );
        const data = remote.reached
          ? remote.data
          : { ok: true, bay: await withOfflineEngine((e) => e.manageBay(bayId, patch)) };
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    },
  );

  return server;
}

export async function startArchitectMcpServer(opts: ArchitectMcpOptions): Promise<void> {
  const server = createArchitectMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
