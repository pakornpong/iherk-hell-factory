import os from "node:os";
import type { AgentTelemetryEvent, TelemetryEventType } from "../shared/types.js";

/**
 * Translates Hermes Agent outbound-webhook payloads (`hooks.outbound` in ~/.hermes/config.yaml)
 * into Hell Factory telemetry so every Hermes session, bot and subagent shows up in the office.
 *
 * Identity model (one bay per Hermes process cwd):
 * - The first busy top-level session becomes the bay's persistent "Hermes Lead".
 * - Any other top-level session that works at the same time (another desktop chat, a Telegram bot,
 *   a cron job, a kanban worker) appears as its own ephemeral agent `s:<session>` labelled with its
 *   platform, and leaves the floor when its turn ends.
 * - delegate_task children appear as ephemeral subagents under whichever agent spawned them; their
 *   own tool events (which carry the child session id) are routed back to that subagent.
 */

export interface HermesWebhookPayload {
  hook_event_name?: unknown;
  profile?: unknown;
  tool_name?: unknown;
  session_id?: unknown;
  cwd?: unknown;
  extra?: unknown;
  delivery_id?: unknown;
}

interface SessionInfo {
  platform?: string;
  lastSeen: number;
}

interface ChildInfo {
  /** HF session the subagent lives under (its top-level ancestor). */
  rootSession: string;
  agentId: string;
  lastSeen: number;
}

interface LeadInfo {
  session: string;
  busy: boolean;
  lastSeen: number;
}

const LEAD_STALE_MS = 5 * 60_000;
const MAX_TRACKED = 2_000;
const DELIVERY_MEMORY = 1_000;

const str = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const clip = (value: string | undefined, max: number) => (value ? value.replace(/\s+/g, " ").trim().slice(0, max) : undefined);

const INTERACTIVE_PLATFORMS = new Set(["", "local", "cli", "tui", "desktop", "dashboard", "acp"]);

export class HermesEventTranslator {
  private readonly sessions = new Map<string, SessionInfo>();
  private readonly children = new Map<string, ChildInfo>();
  private readonly leads = new Map<string, LeadInfo>();
  /** Ephemeral top-level sessions currently shown as their own agent (session -> busy). */
  private readonly sideSessions = new Map<string, boolean>();
  /** Finished delegate_task child sessions: late events from them are dropped, not shown as new agents. */
  private readonly finishedChildren = new Set<string>();
  private readonly deliveries: string[] = [];
  private readonly seenDeliveries = new Set<string>();

  constructor(private readonly homeDir = os.homedir()) {}

  translate(raw: HermesWebhookPayload, now = Date.now()): AgentTelemetryEvent[] {
    const delivery = str(raw.delivery_id);
    if (delivery) {
      // Hermes retries a failed delivery once with the same id
      if (this.seenDeliveries.has(delivery)) return [];
      this.seenDeliveries.add(delivery);
      this.deliveries.push(delivery);
      if (this.deliveries.length > DELIVERY_MEMORY) this.seenDeliveries.delete(this.deliveries.shift()!);
    }

    const event = str(raw.hook_event_name);
    if (!event) return [];
    const extra = record(raw.extra);
    const cwd = str(raw.cwd) ?? this.homeDir;
    const profile = str(raw.profile) ?? "default";
    const session = str(raw.session_id) ?? this.fromSessionKey(str(extra.session_key)) ?? str(extra.task_id);
    if (!session) return [];
    this.prune(now);

    if (event === "on_session_start") {
      this.sessions.set(session, { platform: str(extra.platform), lastSeen: now });
    } else {
      const info = this.sessions.get(session);
      if (info) {
        info.lastSeen = now;
        info.platform ??= str(extra.platform);
      } else this.sessions.set(session, { platform: str(extra.platform), lastSeen: now });
    }

    if (event === "subagent_start") return this.subagentStart(session, extra, cwd, profile, now);
    if (event === "subagent_stop") {
      const childSession = str(extra.child_session_id);
      const child = childSession ? this.children.get(childSession) : undefined;
      if (!child) {
        // Started before we were listening, so it was shown as a side session: end that one
        if (childSession && this.sideSessions.has(childSession)) {
          this.sideSessions.delete(childSession);
          this.finishedChildren.add(childSession);
          return [this.base(cwd, profile, childSession, "subagent_stop", { agentId: `s:${childSession.slice(0, 48)}` })];
        }
        return [];
      }
      this.children.delete(childSession!);
      this.finishedChildren.add(childSession!);
      if (this.finishedChildren.size > MAX_TRACKED) this.finishedChildren.delete(this.finishedChildren.values().next().value!);
      return [this.base(cwd, profile, child.rootSession, "subagent_stop", { agentId: child.agentId })];
    }

    const type = this.mapEvent(event, extra);
    if (!type) return [];
    const toolName = str(raw.tool_name);

    if (this.finishedChildren.has(session)) return [];
    // A delegate_task child's own events belong to its subagent
    const child = this.children.get(session);
    if (child) {
      child.lastSeen = now;
      if (type === "session_start") return [];
      // The child's own turn end is not the parent's: keep the subagent until subagent_stop
      if (type === "turn_stop" || type === "session_end") return [];
      return [this.base(cwd, profile, child.rootSession, type, { agentId: child.agentId, toolName })];
    }

    const out: AgentTelemetryEvent[] = [];
    const lead = this.leads.get(cwd);
    const isOrphanChild = this.sessions.get(session)?.platform === "subagent";
    const ends = type === "turn_stop" || type === "session_end";
    const leadUsable = !lead || lead.session === session || !lead.busy || now - lead.lastSeen > LEAD_STALE_MS;

    if (leadUsable && !isOrphanChild && !this.sideSessions.has(session)) {
      if (!ends || lead?.session === session) {
        this.leads.set(cwd, { session, busy: !ends, lastSeen: now });
      }
      if (ends && lead && lead.session !== session) return [];
      out.push(this.base(cwd, profile, session, type, { toolName }));
      return out;
    }

    // Another session is busy as the Lead: show this one as its own agent
    const agentId = `s:${session.slice(0, 48)}`;
    const agentRole = this.sessionLabel(session, profile);
    if (ends) {
      if (!this.sideSessions.has(session)) return [];
      this.sideSessions.delete(session);
      return [this.base(cwd, profile, session, type, { agentId, agentRole })];
    }
    if (!this.sideSessions.get(session)) {
      // subagent_start bypasses the tombstone of a side session that finished a turn moments ago
      out.push(this.base(cwd, profile, session, "subagent_start", { agentId, agentRole }));
      this.sideSessions.set(session, true);
    }
    if (type !== "session_start") out.push(this.base(cwd, profile, session, type, { agentId, agentRole, toolName }));
    return out;
  }

  private subagentStart(
    parentSession: string,
    extra: Record<string, unknown>,
    cwd: string,
    profile: string,
    now: number,
  ): AgentTelemetryEvent[] {
    const childSession = str(extra.child_session_id);
    const childId = str(extra.child_subagent_id) ?? childSession;
    if (!childId) return [];
    const parentChild = this.children.get(parentSession);
    const rootSession = parentChild?.rootSession ?? parentSession;
    const agentId = `d:${childId.slice(0, 48)}`;
    const parentAgentId = parentChild?.agentId ?? (this.sideSessions.has(parentSession) ? `s:${parentSession.slice(0, 48)}` : undefined);
    if (childSession) this.children.set(childSession, { rootSession, agentId, lastSeen: now });
    const role = str(extra.child_role);
    return [this.base(cwd, profile, rootSession, "subagent_start", {
      agentId,
      parentAgentId,
      agentRole: role && role !== "leaf" ? role.slice(0, 64) : undefined,
      detail: clip(str(extra.child_goal), 80),
    })];
  }

  private mapEvent(event: string, extra: Record<string, unknown>): TelemetryEventType | undefined {
    switch (event) {
      case "on_session_start": return "session_start";
      case "pre_llm_call": return "prompt_submit";
      case "pre_tool_call": return "tool_start";
      case "post_tool_call": return "tool_end";
      // Only prompts a person must answer (clarify, approval, sudo). pre_approval_request also fires
      // for approvals.mode=smart decisions nobody is asked about, so it is not used.
      case "on_human_input_request": return "waiting_user";
      // The Boss answered: walk back with new instructions
      case "on_human_input_resolved": return "prompt_submit";
      case "on_session_end":
      case "agent_loop_stopped": return "turn_stop";
      case "on_session_finalize": return "session_end";
      default: return undefined;
    }
  }

  /** Gateway routing keys look like "agent:main:local:dm:<chat>"; map them back to a known session id. */
  private fromSessionKey(key: string | undefined): string | undefined {
    if (!key) return undefined;
    const tail = key.split(":").pop() ?? key;
    if (this.sessions.has(tail) || this.children.has(tail)) return tail;
    for (const id of this.sessions.keys()) if (key.endsWith(id)) return id;
    return tail;
  }

  private sessionLabel(session: string, profile: string): string {
    const platform = this.sessions.get(session)?.platform;
    const surface = platform === "subagent" ? "sub" : platform && !INTERACTIVE_PLATFORMS.has(platform) ? platform : "chat";
    // The engine prefixes "Hermes · "
    return `${profile === "default" ? "" : `${profile}/`}${surface}`.slice(0, 64);
  }

  private base(
    cwd: string,
    profile: string,
    sessionId: string,
    eventType: TelemetryEventType,
    more: Partial<AgentTelemetryEvent>,
  ): AgentTelemetryEvent {
    const home = this.homeDir.replace(/\/+$/, "");
    const dir = cwd.replace(/\/+$/, "");
    // The desktop app/gateway runs from ~ or from its install dir under ~/.hermes
    const isHome = dir === home || dir === `${home}/.hermes` || dir.startsWith(`${home}/.hermes/`);
    const event: AgentTelemetryEvent = {
      provider: "hermes",
      source: "hermes",
      sessionId: sessionId.slice(0, 256),
      projectPath: cwd,
      eventType,
      ...(isHome ? { projectName: profile === "default" ? "Hermes" : `Hermes ${profile}`.slice(0, 128) } : {}),
    };
    for (const [key, value] of Object.entries(more)) {
      if (value !== undefined) (event as unknown as Record<string, unknown>)[key] = value;
    }
    if (event.toolName) event.toolName = event.toolName.slice(0, 128);
    return event;
  }

  private prune(now: number): void {
    const total = this.sessions.size + this.children.size;
    if (total < MAX_TRACKED) return;
    const cutoff = now - 60 * 60_000;
    for (const [key, info] of this.sessions) if (info.lastSeen < cutoff) this.sessions.delete(key);
    for (const [key, info] of this.children) if (info.lastSeen < cutoff) this.children.delete(key);
    for (const key of this.sideSessions.keys()) if (!this.sessions.has(key)) this.sideSessions.delete(key);
  }
}
