import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { installHooks, installMcp } from "../src/cli/install-hooks.js";
import { createHellFactoryServer } from "../src/server/index.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { PixcelBridge } from "../src/server/pixcel-bridge.js";
import { OfficeStore } from "../src/server/store.js";

const execFileAsync = promisify(execFile);

function runHookScript(
  scriptPath: string,
  stdinJson: unknown,
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string; elapsedMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = execFile(
      "/bin/bash",
      [scriptPath],
      { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}`, ...env }, timeout: 3000 },
      (err, stdout, stderr) => {
        const code = err && typeof (err as any).code === "number" ? (err as any).code : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr), elapsedMs: Date.now() - start });
      },
    );
    child.stdin?.end(JSON.stringify(stdinJson));
  });
}

describe("Hook scripts & safe CLI installer", () => {
  it("exits 0 silently in <1s when server is down, and delivers telemetry when server is live", async () => {
    const root = process.cwd();
    const claudeScript = path.join(root, "hooks", "claude-hook.sh");
    const geminiScript = path.join(root, "hooks", "gemini-cli-hook.sh");
    const agyScript = path.join(root, "hooks", "antigravity-hook.sh");

    // 1. Offline fail-silent check
    for (const [script, payload] of [
      [claudeScript, { hook_event_name: "PreToolUse", session_id: "c1", cwd: "/work/c", tool_name: "Edit" }],
      [geminiScript, { hook_event_name: "BeforeTool", session_id: "g1", cwd: "/work/g", tool_name: "edit_file" }],
      [agyScript, { hookEventName: "PreToolUse", conversationId: "a1", workspacePaths: ["/work/a"], toolName: "edit_file" }],
    ] as const) {
      const res = await runHookScript(script, payload, { HELL_FACTORY_URL: "http://127.0.0.1:1" });
      expect(res.code).toBe(0);
      expect(res.stderr.trim()).toBe("");
      expect(res.elapsedMs).toBeLessThan(1500);
    }

    // 2. Live delivery check
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hf-hook-live-"));
    const pubDir = path.join(tmp, "public");
    const runDir = path.join(tmp, "runtime");
    await fs.mkdir(pubDir, { recursive: true });
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(pubDir, "index.html"), "<html><!--UI_SESSION--></html>");

    const store = new OfficeStore(tmp);
    const bridge = new PixcelBridge({ pixcelRoot: process.env.IHERK_PIXCEL_ROOT ?? new URL("../../iherk-pixcel", import.meta.url).pathname, projectRoot: root, runtimeOutDir: runDir });
    const engine = new OfficeEngine({ store, catalogById: new Map() });
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
      await runHookScript(
        claudeScript,
        { hook_event_name: "PreToolUse", session_id: "c1", cwd: "/work/claude-proj", tool_name: "Edit" },
        { HELL_FACTORY_URL: srv.url },
      );
      const agyRes = await runHookScript(
        agyScript,
        { hookEventName: "PreToolUse", conversationId: "a1", workspacePaths: ["/work/agy-proj"], toolName: "run_command" },
        { HELL_FACTORY_URL: srv.url },
      );
      expect(agyRes.stdout.trim()).toBe("{}");

      const snap = engine.getSnapshot();
      expect(snap.state.bays.map((b) => b.projectPath)).toEqual(["/work/claude-proj", "/work/agy-proj"]);
      expect(snap.state.employees.some((e) => e.provider === "claude")).toBe(true);
      expect(snap.state.employees.some((e) => e.provider === "gemini")).toBe(true);
    } finally {
      await srv.close();
    }
  });

  it("installs hooks idempotently with backups and registers Architect MCP ONLY in Gemini configs (never Claude)", async () => {
    const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "hf-home-"));
    await fs.mkdir(path.join(fakeHome, ".claude"), { recursive: true });
    await fs.mkdir(path.join(fakeHome, ".gemini", "config"), { recursive: true });
    await fs.writeFile(path.join(fakeHome, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: {} }, null, 2));
    await fs.writeFile(path.join(fakeHome, ".gemini", "settings.json"), JSON.stringify({ security: { auth: { selectedType: "gemini-api-key" } } }, null, 2));
    await fs.writeFile(path.join(fakeHome, ".gemini", "config", "mcp_config.json"), "");

    const projectRoot = process.cwd();
    await installHooks({ homeDir: fakeHome, projectRoot, dryRun: false });
    // Run twice -> idempotent!
    await installHooks({ homeDir: fakeHome, projectRoot, dryRun: false });
    await installMcp({ homeDir: fakeHome, projectRoot, dryRun: false });

    const claudeCfg = JSON.parse(await fs.readFile(path.join(fakeHome, ".claude", "settings.json"), "utf8"));
    expect(claudeCfg.permissions.allow).toEqual(["Bash(ls)"]);
    expect(claudeCfg.hooks.PreToolUse).toHaveLength(1);
    expect(claudeCfg.mcpServers).toBeUndefined();

    const agyHooks = JSON.parse(await fs.readFile(path.join(fakeHome, ".gemini", "config", "hooks.json"), "utf8"));
    expect(agyHooks["iherk-hell-factory"]).toBeDefined();

    const agyMcp = JSON.parse(await fs.readFile(path.join(fakeHome, ".gemini", "config", "mcp_config.json"), "utf8"));
    expect(agyMcp.mcpServers["iherk-hell-factory"]).toBeDefined();

    const geminiSettings = JSON.parse(await fs.readFile(path.join(fakeHome, ".gemini", "settings.json"), "utf8"));
    expect(geminiSettings.mcpServers["iherk-hell-factory"]).toBeDefined();

    const claudeFiles = await fs.readdir(path.join(fakeHome, ".claude"));
    expect(claudeFiles.some((f) => f.startsWith("settings.json.bak."))).toBe(true);
  });
});
