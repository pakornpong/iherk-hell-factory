import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createArchitectMcpServer } from "../src/mcp/architect-server.js";
import { createHellFactoryServer } from "../src/server/index.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { PixcelBridge } from "../src/server/pixcel-bridge.js";
import { OfficeStore } from "../src/server/store.js";

describe("Gemini-Only Office Architect MCP Server", () => {
  it("crafts custom asset with base64 PNG preview, broadcasts atlas:updated, and places/moves/removes furniture", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hf-mcp-"));
    const dataDir = path.join(tmp, "data");
    const pubDir = path.join(tmp, "public");
    const runDir = path.join(tmp, "runtime");
    await fs.mkdir(pubDir, { recursive: true });
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(pubDir, "index.html"), "<html><!--UI_SESSION--></html>");

    const store = new OfficeStore(dataDir);
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: tmp,
      runtimeOutDir: runDir,
    });
    const catalog = await bridge.listCatalog();
    const engine = new OfficeEngine({
      store,
      catalogById: new Map(catalog.map((c) => [c.id, c])),
    });
    await engine.init();

    const srv = await createHellFactoryServer({
      port: 0,
      engine,
      store,
      pixcelBridge: bridge,
      publicDir: pubDir,
      runtimeAssetsDir: runDir,
      watchAntigravity: false,
    });

    const wsMessages: Array<{ type: string; payload?: any }> = [];
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    await new Promise<void>((resolve) => ws.once("open", () => resolve()));
    ws.on("message", (buf) => {
      wsMessages.push(JSON.parse(buf.toString("utf8")));
    });

    const mcpServer = createArchitectMcpServer({
      serverUrl: srv.url,
      dataDir,
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: tmp,
      runtimeOutDir: runDir,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);
    const client = new Client({ name: "gemini-architect-test", version: "1.0.0" });
    await client.connect(clientTransport);

    try {
      // 1. Craft a brand-new furniture asset
      const craftRes = await client.callTool({
        name: "craft_furniture_asset",
        arguments: {
          asset: {
            schemaVersion: 1,
            id: "gemini-arcade",
            category: "decor",
            layer: "object",
            outlineMode: "silhouette",
            tilePreset: "64x32",
            voxelsPerTile: 32,
            footprintTiles: [1, 1],
            palette: "office-night",
            materials: {
              body: { color: "#312e81", kind: "matte" },
              screen: { color: "#22d3ee", kind: "emissive", glowRadius: 2, glowIntensity: 0.6 },
            },
            ops: [
              { op: "box", from: [8, 8, 0], to: [23, 23, 28], material: "body" },
              { op: "box", from: [23, 11, 16], to: [23, 20, 24], material: "screen" },
            ],
            decals: [],
          },
        },
      });
      expect(craftRes.isError).toBeFalsy();
      const contents = craftRes.content as Array<{ type: string; mimeType?: string; data?: string; text?: string }>;
      expect(contents.some((c) => c.type === "image" && c.mimeType === "image/png" && (c.data?.length ?? 0) > 50)).toBe(true);

      await new Promise((r) => setTimeout(r, 80));
      expect(wsMessages.some((m) => m.type === "atlas:updated" && m.payload?.customAssetId === "gemini-arcade")).toBe(true);

      // 2. Place crafted asset in common:0 at free spot (0, 0)
      const placeRes = await client.callTool({
        name: "place_furniture",
        arguments: { zoneId: "common:0", lx: 0, ly: 0, assetId: "gemini-arcade", direction: "se" },
      });
      expect(placeRes.isError).toBeFalsy();
      const placed = JSON.parse(((placeRes.content as Array<{ text: string }>)[0]).text);
      expect(placed.furniture.placedBy).toBe("gemini");

      // 3. Collision at same tile fails cleanly
      const dupRes = await client.callTool({
        name: "place_furniture",
        arguments: { zoneId: "common:0", lx: 0, ly: 0, assetId: "gemini-arcade", direction: "se" },
      });
      expect(dupRes.isError).toBe(true);

      // 4. Move and remove furniture
      const moveRes = await client.callTool({
        name: "move_furniture",
        arguments: { instanceId: placed.furniture.id, zoneId: "common:0", lx: 0, ly: 1, direction: "sw" },
      });
      expect(moveRes.isError).toBeFalsy();

      const rmRes = await client.callTool({
        name: "remove_furniture",
        arguments: { instanceId: placed.furniture.id },
      });
      expect(rmRes.isError).toBeFalsy();

      // 5. Rename Starter Bay
      const bayRes = await client.callTool({
        name: "manage_bay",
        arguments: { bayId: "bay-0", displayName: "Gemini HQ", accentColor: "#a78bfa" },
      });
      expect(bayRes.isError).toBeFalsy();
      expect(engine.getSnapshot().state.bays[0].displayName).toBe("Gemini HQ");
    } finally {
      ws.close();
      await client.close();
      await mcpServer.close();
      await srv.close();
    }
  });
});
