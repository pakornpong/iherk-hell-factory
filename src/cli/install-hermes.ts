import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Every Hermes hook event Hell Factory turns into office activity (see src/server/hermes-bridge.ts). */
export const HERMES_HOOK_EVENTS = [
  "on_session_start",
  "pre_llm_call",
  "pre_tool_call",
  "post_tool_call",
  "on_human_input_request",
  "on_human_input_resolved",
  "subagent_start",
  "subagent_stop",
  "on_session_end",
  "agent_loop_stopped",
  "on_session_finalize",
] as const;

export interface HermesInstallOptions {
  serverUrl: string;
  profile?: string;
  dryRun?: boolean;
  /** Injected for tests. */
  run?: (args: string[]) => Promise<{ stdout: string }>;
}

export interface HermesInstallReport {
  profile: string;
  action: "added" | "updated" | "unchanged";
  url: string;
  events: string[];
  dryRun: boolean;
}

interface OutboundTarget {
  name?: string;
  url?: string;
  events?: string[];
  [key: string]: unknown;
}

/**
 * Adds (or refreshes) a `hooks.outbound` webhook target in the Hermes config so every Hermes
 * session, bot and subagent reports to Hell Factory. Goes through `hermes config set` (never
 * edits config.yaml by hand) and keeps any other outbound targets.
 */
export async function installHermesHooks(opts: HermesInstallOptions): Promise<HermesInstallReport> {
  const run = opts.run ?? (async (args: string[]) => execFileAsync("hermes", args, { timeout: 30_000 }));
  const prefix = opts.profile ? ["-p", opts.profile] : [];
  const url = `${opts.serverUrl.replace(/\/+$/, "")}/api/events/hermes`;

  let current: OutboundTarget[] = [];
  try {
    const { stdout } = await run([...prefix, "config", "get", "hooks.outbound", "--json"]);
    const parsed = JSON.parse(stdout.trim() || "[]");
    if (Array.isArray(parsed)) current = parsed;
  } catch (error) {
    // "Config key not set" exits 1; anything else is a real failure
    const message = String((error as { stdout?: string; stderr?: string }).stdout ?? "") + String((error as { stderr?: string }).stderr ?? "");
    if (!/not set/i.test(message)) throw error;
  }

  const wanted: OutboundTarget = { name: "hell-factory", url, events: [...HERMES_HOOK_EVENTS], timeout: 2 };
  const index = current.findIndex((target) => target?.name === "hell-factory" || target?.url === url);
  let action: HermesInstallReport["action"] = "added";
  const next = [...current];
  if (index >= 0) {
    const same = JSON.stringify(current[index]) === JSON.stringify(wanted);
    action = same ? "unchanged" : "updated";
    next[index] = wanted;
  } else {
    next.push(wanted);
  }

  if (action !== "unchanged" && !opts.dryRun) {
    await run([...prefix, "config", "set", "hooks.outbound", JSON.stringify(next)]);
  }
  return { profile: opts.profile ?? "default", action, url, events: [...HERMES_HOOK_EVENTS], dryRun: Boolean(opts.dryRun) };
}
