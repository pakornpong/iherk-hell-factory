import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentTelemetryEvent } from "../shared/types.js";

const RECENT_MTIME_MS = 5 * 60 * 1000;
const HOOK_DEDUP_WINDOW_MS = 30_000;
const PROJECT_MARKERS = [".git", "package.json", "Cargo.toml", "pyproject.toml", "go.mod"];

interface TrackedTranscript {
  offset: number;
  projectPath: string;
  remainder: string;
}

function resolveProjectRoot(candidatePath: string): string {
  const home = os.homedir();
  let cur = path.resolve(candidatePath);
  try {
    const st = fsSync.statSync(cur);
    if (st.isFile()) cur = path.dirname(cur);
  } catch {
    // If path has a file extension, step up to its parent directory
    if (path.extname(cur)) cur = path.dirname(cur);
  }

  let probe = cur;
  while (probe && probe !== path.dirname(probe) && probe !== home) {
    for (const marker of PROJECT_MARKERS) {
      if (fsSync.existsSync(path.join(probe, marker))) {
        return probe;
      }
    }
    probe = path.dirname(probe);
  }
  return cur;
}

function inferProjectFromStep(step: Record<string, unknown>, currentProject: string): string {
  const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
  for (const tc of toolCalls) {
    if (!tc || typeof tc !== "object") continue;
    const args = (tc as Record<string, unknown>).args;
    if (args && typeof args === "object") {
      const p = (args as Record<string, unknown>).Path ?? (args as Record<string, unknown>).path;
      if (typeof p === "string" && p.startsWith("/") && !p.includes("/.gemini/")) {
        return resolveProjectRoot(p);
      }
    }
  }
  const content = typeof step.content === "string" ? step.content : "";
  const match = content.match(/\/(?:Users|var|tmp|home)\/[^\s"'<>|]+/);
  if (match && !match[0].includes("/.gemini/")) {
    return resolveProjectRoot(match[0]);
  }
  return currentProject;
}

export class AntigravityWatcher {
  private readonly tracked = new Map<string, TrackedTranscript>();
  private readonly hookSeenAt = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private readonly pollMs: number;

  constructor(
    private readonly opts: {
      brainDir: string;
      onEvent: (ev: AgentTelemetryEvent) => Promise<void> | void;
      pollMs?: number;
      defaultProjectPath?: string;
    },
  ) {
    this.pollMs = opts.pollMs ?? 2000;
  }

  markHookSeen(conversationId: string): void {
    this.hookSeenAt.set(conversationId, Date.now());
  }

  private isHookRecentlySeen(conversationId: string): boolean {
    const seen = this.hookSeenAt.get(conversationId);
    if (!seen) return false;
    return Date.now() - seen < HOOK_DEDUP_WINDOW_MS;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollMs);
    this.timer.unref?.();
    void this.pollOnce();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollOnce(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      let convDirs: string[];
      try {
        convDirs = await fs.readdir(this.opts.brainDir);
      } catch {
        return;
      }

      const now = Date.now();
      for (const convId of convDirs) {
        const logPath = path.join(this.opts.brainDir, convId, ".system_generated", "logs", "transcript.jsonl");
        let stat;
        try {
          stat = await fs.stat(logPath);
        } catch {
          continue;
        }
        if (now - stat.mtimeMs > RECENT_MTIME_MS) continue;

        let state = this.tracked.get(convId);
        if (!state) {
          // Initialize tracker: if file is tiny (< 16KB), read from 0 so freshly created sessions emit;
          // otherwise tail from end to avoid replaying hours-old history.
          const startOffset = stat.size <= 16_384 ? 0 : stat.size;
          state = {
            offset: startOffset,
            projectPath: this.opts.defaultProjectPath ?? process.cwd(),
            remainder: "",
          };
          this.tracked.set(convId, state);
          if (startOffset === stat.size) continue;
        }

        if (stat.size <= state.offset) continue;

        const length = stat.size - state.offset;
        const fh = await fs.open(logPath, "r");
        try {
          const buf = Buffer.alloc(length);
          const { bytesRead } = await fh.read(buf, 0, length, state.offset);
          state.offset += bytesRead;
          const chunk = state.remainder + buf.subarray(0, bytesRead).toString("utf8");
          const lines = chunk.split("\n");
          state.remainder = lines.pop() ?? "";

          if (this.isHookRecentlySeen(convId)) continue;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let step: Record<string, unknown>;
            try {
              step = JSON.parse(trimmed);
            } catch {
              continue;
            }
            state.projectPath = inferProjectFromStep(step, state.projectPath);
            const ev = this.stepToTelemetryEvent(convId, state.projectPath, step);
            if (ev) {
              await this.opts.onEvent(ev);
            }
          }
        } finally {
          await fh.close();
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private stepToTelemetryEvent(
    convId: string,
    projectPath: string,
    step: Record<string, unknown>,
  ): AgentTelemetryEvent | null {
    const type = typeof step.type === "string" ? step.type : "";
    if (type === "USER_INPUT") {
      return {
        provider: "gemini",
        source: "antigravity",
        sessionId: convId,
        projectPath,
        eventType: "prompt_submit",
        detail: "Antigravity received prompt",
      };
    }
    if (type === "PLANNER_RESPONSE") {
      const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
      if (toolCalls.length > 0) {
        const first = toolCalls[0] as Record<string, unknown>;
        const toolName = typeof first?.name === "string" ? first.name : "tool";
        if (toolName === "invoke_subagent") {
          return {
            provider: "gemini",
            source: "antigravity",
            sessionId: convId,
            agentId: `ag-sub-${step.step_index ?? Date.now()}`,
            parentAgentId: convId,
            agentRole: typeof (first.args as Record<string, unknown> | undefined)?.Role === "string"
              ? String((first.args as Record<string, unknown>).Role).slice(0, 32)
              : "Subagent",
            projectPath,
            eventType: "subagent_start",
            toolName,
            detail: `Spawned ${toolName}`,
          };
        }
        return {
          provider: "gemini",
          source: "antigravity",
          sessionId: convId,
          projectPath,
          eventType: "tool_start",
          toolName,
          detail: `Antigravity · ${toolName}`,
        };
      }
      return {
        provider: "gemini",
        source: "antigravity",
        sessionId: convId,
        projectPath,
        eventType: "turn_stop",
        detail: "Antigravity finished turn",
      };
    }
    return null;
  }
}
