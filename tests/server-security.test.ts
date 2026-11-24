import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AntigravityWatcher } from "../src/server/antigravity-watcher.js";
import { createHellFactoryServer } from "../src/server/index.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { PixcelBridge } from "../src/server/pixcel-bridge.js";
import { OfficeStore } from "../src/server/store.js";

describe("HTTP/WS server, Architect auth boundary & AntigravityWatcher", () => {
  it("accepts telemetry on /api/events and blocks unauthenticated or cross-origin /api/architect/* requests", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-srv-"));
    const pubDir = path.join(dir, "public");
    const runDir = path.join(dir, "runtime");
    await fs.mkdir(pubDir, { recursive: true });
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(
      path.join(pubDir, "index.html"),
      "<html><head><!--UI_SESSION--></head><body></body></html>",
    );

    const store = new OfficeStore(dir);
    const token = await store.ensureArchitectToken();
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: process.cwd(),
      runtimeOutDir: runDir,
    });
    const catalog = new Map([
      [
        "plant-potted",
        {
          id: "plant-potted",
          category: "decor",
          layer: "object" as const,
          footprintTiles: [1, 1] as [number, number],
          source: "starter" as const,
        },
      ],
    ]);
    const engine = new OfficeEngine({ store, catalogById: catalog });
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
    try {
      // Telemetry succeeds
      const evRes = await fetch(`${srv.url}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "claude",
          source: "claude-code",
          sessionId: "s1",
          projectPath: "/work/a",
          eventType: "tool_start",
          toolName: "Edit",
        }),
      });
      expect(evRes.status).toBe(200);

      // Unauthenticated Architect call -> 401
      const noAuth = await fetch(`${srv.url}/api/architect/furniture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: "common:0", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" }),
      });
      expect(noAuth.status).toBe(401);

      // Cross-origin CSRF with valid cookie -> 403
      const pageRes = await fetch(`${srv.url}/`);
      const cookie = pageRes.headers.get("set-cookie")?.split(";")[0] ?? "";
      const html = await pageRes.text();
      const uiToken = html.match(/window\.__UI_SESSION__\s*=\s*"([^"]+)"/)?.[1] ?? "";
      expect(uiToken.length).toBeGreaterThan(10);

      const csrfRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-UI-Session": uiToken,
          Origin: "https://evil.example",
        },
        body: JSON.stringify({ theme: "day" }),
      });
      expect(csrfRes.status).toBe(403);

      // Valid X-Architect-Token (Gemini MCP) -> 200
      const mcpRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Architect-Token": token },
        body: JSON.stringify({ theme: "day" }),
      });
      expect(mcpRes.status).toBe(200);

      // Valid localhost browser session -> 200
      const uiRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-UI-Session": uiToken,
          Origin: srv.url,
        },
        body: JSON.stringify({ theme: "night" }),
      });
      expect(uiRes.status).toBe(200);
    } finally {
      await srv.close();
    }
  });

  it("tails Antigravity transcript.jsonl incrementally and deduplicates hook-seen conversations", async () => {
    const brain = await fs.mkdtemp(path.join(os.tmpdir(), "hf-agy-"));
    const convLogDir = path.join(brain, "conv-1", ".system_generated", "logs");
    await fs.mkdir(convLogDir, { recursive: true });
    const logPath = path.join(convLogDir, "transcript.jsonl");

    const received: unknown[] = [];
    const watcher = new AntigravityWatcher({
      brainDir: brain,
      onEvent: (e) => {
        received.push(e);
      },
    });
    await fs.writeFile(
      logPath,
      `${JSON.stringify({ step_index: 0, type: "USER_INPUT", content: "hi", created_at: new Date().toISOString() })}\n`,
    );
    await watcher.pollOnce();
    await fs.appendFile(
      logPath,
      `${JSON.stringify({ step_index: 1, type: "PLANNER_RESPONSE", tool_calls: [{ name: "edit_file", args: { Path: "/work/demo/a.ts" } }], created_at: new Date().toISOString() })}\n`,
    );
    await watcher.pollOnce();
    expect(received.length).toBeGreaterThanOrEqual(1);

    // Hook already reported conv-1 -> watcher skips within dedup window
    const countBefore = received.length;
    watcher.markHookSeen("conv-1");
    await fs.appendFile(
      logPath,
      `${JSON.stringify({ step_index: 2, type: "PLANNER_RESPONSE", tool_calls: [{ name: "run_command" }], created_at: new Date().toISOString() })}\n`,
    );
    await watcher.pollOnce();
    expect(received.length).toBe(countBefore);
  });
});
