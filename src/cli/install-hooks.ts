import fs from "node:fs/promises";
import path from "node:path";

export interface InstallOptions {
  homeDir: string;
  projectRoot: string;
  dryRun?: boolean;
}

export interface InstallReport {
  changes: Array<{ filePath: string; action: "created" | "updated" | "unchanged"; backupPath?: string }>;
}

async function readJsonOrEmpty(filePath: string): Promise<{ exists: boolean; raw: string; data: Record<string, any> }> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return { exists: true, raw, data: {} };
    return { exists: true, raw, data: JSON.parse(trimmed) };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { exists: false, raw: "", data: {} };
    throw new Error(`Cannot parse JSON at ${filePath}: ${err.message}`);
  }
}

async function writeJsonSafely(
  filePath: string,
  nextData: Record<string, any>,
  prev: { exists: boolean; raw: string },
  dryRun: boolean,
): Promise<{ action: "created" | "updated" | "unchanged"; backupPath?: string }> {
  const nextRaw = `${JSON.stringify(nextData, null, 2)}\n`;
  if (prev.exists && prev.raw.trim() === nextRaw.trim()) {
    return { action: "unchanged" };
  }
  if (dryRun) {
    return { action: prev.exists ? "updated" : "created" };
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let backupPath: string | undefined;
  if (prev.exists && prev.raw.length > 0) {
    backupPath = `${filePath}.bak.${Date.now()}`;
    await fs.writeFile(backupPath, prev.raw, "utf8");
  }
  await fs.writeFile(filePath, nextRaw, "utf8");
  return { action: prev.exists ? "updated" : "created", backupPath };
}

function hasCommandHook(entries: any[], command: string): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    if (entry?.command === command) return true;
    if (Array.isArray(entry?.hooks)) {
      return entry.hooks.some((h: any) => h?.command === command);
    }
    return false;
  });
}

export async function installCodexHooks(opts: InstallOptions): Promise<InstallReport> {
  const filePath = path.join(opts.homeDir, ".codex", "hooks.json");
  const command = `/bin/bash '${path.join(opts.projectRoot, "hooks", "codex-hook.sh").replaceAll("'", "'\\''")}'`;
  const prev = await readJsonOrEmpty(filePath);
  const next = structuredClone(prev.data);
  next.hooks ??= {};
  // Append an independent group so existing matchers and trust indices remain stable.
  for (const event of [
    "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest",
    "SubagentStart", "SubagentStop", "Stop", "Interrupt", "SessionEnd",
  ]) {
    const groups = next.hooks[event] ?? [];
    if (!Array.isArray(groups)) throw new Error(`Invalid Codex hook groups for ${event} in ${filePath}`);
    if (!groups.some((group: any) =>
      !group?.matcher && group?.hooks?.some((entry: any) => entry?.command === command)
    )) {
      groups.push({ hooks: [{ type: "command", command, timeout: 3 }] });
    }
    next.hooks[event] = groups;
  }
  const result = await writeJsonSafely(filePath, next, prev, opts.dryRun ?? false);
  return { changes: [{ filePath, ...result }] };
}

export async function installHooks(opts: InstallOptions): Promise<InstallReport> {
  const dryRun = opts.dryRun ?? false;
  const changes: InstallReport["changes"] = [];

  // 1. Claude Code (~/.claude/settings.json) — TELEMETRY HOOKS ONLY (never MCP!)
  const claudeSettingsPath = path.join(opts.homeDir, ".claude", "settings.json");
  const claudeCmd = path.join(opts.projectRoot, "hooks", "claude-hook.sh");
  const claudePrev = await readJsonOrEmpty(claudeSettingsPath);
  const claudeNext = structuredClone(claudePrev.data);
  claudeNext.hooks = claudeNext.hooks && typeof claudeNext.hooks === "object" ? claudeNext.hooks : {};

  const claudeEvents = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUseFailure",
    "SubagentStart",
    "SubagentStop",
    "Notification",
    "Stop",
    "SessionEnd",
  ];
  for (const ev of claudeEvents) {
    const arr = Array.isArray(claudeNext.hooks[ev]) ? claudeNext.hooks[ev] : [];
    if (!hasCommandHook(arr, claudeCmd)) {
      arr.push({
        hooks: [{ type: "command", command: claudeCmd, async: true, timeout: 3 }],
      });
    }
    claudeNext.hooks[ev] = arr;
  }
  const claudeRes = await writeJsonSafely(claudeSettingsPath, claudeNext, claudePrev, dryRun);
  changes.push({ filePath: claudeSettingsPath, ...claudeRes });

  // 2. Gemini CLI (~/.gemini/settings.json) — Telemetry Hooks
  const geminiSettingsPath = path.join(opts.homeDir, ".gemini", "settings.json");
  const geminiCmd = path.join(opts.projectRoot, "hooks", "gemini-cli-hook.sh");
  const geminiPrev = await readJsonOrEmpty(geminiSettingsPath);
  const geminiNext = structuredClone(geminiPrev.data);
  geminiNext.hooks = geminiNext.hooks && typeof geminiNext.hooks === "object" ? geminiNext.hooks : {};
  for (const ev of ["SessionStart", "BeforeAgent", "BeforeTool", "AfterTool", "AfterAgent", "SessionEnd"]) {
    const arr = Array.isArray(geminiNext.hooks[ev]) ? geminiNext.hooks[ev] : [];
    if (!hasCommandHook(arr, geminiCmd)) {
      arr.push({
        hooks: [{ type: "command", command: geminiCmd, timeout: 3 }],
      });
    }
    geminiNext.hooks[ev] = arr;
  }
  const geminiRes = await writeJsonSafely(geminiSettingsPath, geminiNext, geminiPrev, dryRun);
  changes.push({ filePath: geminiSettingsPath, ...geminiRes });

  // 3. Antigravity (~/.gemini/config/hooks.json)
  const agyHooksPath = path.join(opts.homeDir, ".gemini", "config", "hooks.json");
  const agyCmd = path.join(opts.projectRoot, "hooks", "antigravity-hook.sh");
  const agyPrev = await readJsonOrEmpty(agyHooksPath);
  const agyNext = structuredClone(agyPrev.data);
  agyNext["iherk-hell-factory"] = {
    enabled: true,
    SessionStart: [{ type: "command", command: agyCmd, timeout: 3 }],
    PreInvocation: [{ type: "command", command: agyCmd, timeout: 3 }],
    PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: agyCmd, timeout: 3 }] }],
    PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: agyCmd, timeout: 3 }] }],
    Stop: [{ type: "command", command: agyCmd, timeout: 3 }],
  };
  const agyRes = await writeJsonSafely(agyHooksPath, agyNext, agyPrev, dryRun);
  changes.push({ filePath: agyHooksPath, ...agyRes });

  return { changes };
}

export async function installMcp(opts: InstallOptions): Promise<InstallReport> {
  const dryRun = opts.dryRun ?? false;
  const changes: InstallReport["changes"] = [];
  const cliEntry = path.join(opts.projectRoot, "dist", "cli", "index.js");

  const mcpEntry = {
    command: "/opt/homebrew/bin/node",
    args: [cliEntry, "mcp"],
    env: {
      HELL_FACTORY_ROOT: opts.projectRoot,
    },
  };

  // 1. Antigravity MCP (~/.gemini/config/mcp_config.json) — GEMINI ONLY
  const agyMcpPath = path.join(opts.homeDir, ".gemini", "config", "mcp_config.json");
  const agyPrev = await readJsonOrEmpty(agyMcpPath);
  const agyNext = structuredClone(agyPrev.data);
  agyNext.mcpServers = agyNext.mcpServers && typeof agyNext.mcpServers === "object" ? agyNext.mcpServers : {};
  agyNext.mcpServers["iherk-hell-factory"] = mcpEntry;
  const agyRes = await writeJsonSafely(agyMcpPath, agyNext, agyPrev, dryRun);
  changes.push({ filePath: agyMcpPath, ...agyRes });

  // 2. Gemini CLI MCP (~/.gemini/settings.json) — GEMINI ONLY (never touches Claude!)
  const geminiSettingsPath = path.join(opts.homeDir, ".gemini", "settings.json");
  const geminiPrev = await readJsonOrEmpty(geminiSettingsPath);
  const geminiNext = structuredClone(geminiPrev.data);
  geminiNext.mcpServers = geminiNext.mcpServers && typeof geminiNext.mcpServers === "object" ? geminiNext.mcpServers : {};
  geminiNext.mcpServers["iherk-hell-factory"] = mcpEntry;
  const geminiRes = await writeJsonSafely(geminiSettingsPath, geminiNext, geminiPrev, dryRun);
  changes.push({ filePath: geminiSettingsPath, ...geminiRes });

  return { changes };
}
