import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HERMES_HOOK_EVENTS, installHermesHooks } from "../src/cli/install-hermes.js";
import { HermesEventTranslator } from "../src/server/hermes-bridge.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry } from "../src/shared/types.js";

const HOME = "/Users/tester";
let delivery = 0;
const hook = (event: string, session: string, extra: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => ({
  hook_event_name: event, profile: "default", session_id: session, cwd: HOME, extra, delivery_id: `d${++delivery}`, ...more,
});

describe("Hermes outbound webhook translator", () => {
  it("maps the Hermes lifecycle onto Hell Factory events for the Lead", () => {
    const t = new HermesEventTranslator(HOME);
    const types = [
      hook("on_session_start", "A", { platform: "cli" }),
      hook("pre_llm_call", "A"),
      hook("pre_tool_call", "A", {}, { tool_name: "terminal" }),
      hook("post_tool_call", "A", {}, { tool_name: "terminal" }),
      hook("on_human_input_request", "", { session_key: "agent:main:local:dm:A", kind: "approval" }),
      hook("on_human_input_resolved", "", { session_key: "agent:main:local:dm:A" }),
      hook("pre_approval_request", "", { session_key: "agent:main:local:dm:A" }),
      hook("pre_tool_call", "A", {}, { tool_name: "clarify" }),
      hook("on_human_input_resolved", "A"),
      hook("on_session_end", "A", { completed: true }),
      hook("on_session_finalize", "A"),
    ].flatMap((payload) => t.translate(payload, 1_000));
    expect(types.map((e) => [e.eventType, e.toolName, e.agentId])).toEqual([
      ["session_start", undefined, undefined],
      ["prompt_submit", undefined, undefined],
      ["tool_start", "terminal", undefined],
      ["tool_end", "terminal", undefined],
      ["waiting_user", undefined, undefined],
      ["prompt_submit", undefined, undefined],
      ["tool_start", "clarify", undefined],
      ["prompt_submit", undefined, undefined],
      ["turn_stop", undefined, undefined],
      ["session_end", undefined, undefined],
    ]);
    expect(types.every((e) => e.provider === "hermes" && e.source === "hermes" && e.sessionId === "A")).toBe(true);
    // Sessions running from the home directory (or the Hermes install dir) get a readable bay name
    expect(types[0]).toMatchObject({ projectPath: HOME, projectName: "Hermes" });
    expect(t.translate({ ...hook("pre_tool_call", "Z"), cwd: `${HOME}/.hermes/hermes-agent` })[0].projectName).toBe("Hermes");
  });

  it("drops duplicate deliveries (Hermes retries once with the same id)", () => {
    const t = new HermesEventTranslator(HOME);
    const payload = hook("pre_tool_call", "A", {}, { tool_name: "read_file" });
    expect(t.translate(payload)).toHaveLength(1);
    expect(t.translate(payload)).toHaveLength(0);
  });

  it("shows a concurrent session (e.g. a Telegram bot) as its own agent while the Lead is busy", () => {
    const t = new HermesEventTranslator(HOME);
    t.translate(hook("pre_llm_call", "A"), 1_000);
    // The bot's session appears as soon as it starts, then follows its own events
    expect(t.translate(hook("on_session_start", "B", { platform: "telegram" }), 1_100).map((e) => [e.eventType, e.agentId, e.agentRole]))
      .toEqual([["subagent_start", "s:B", "telegram"]]);
    expect(t.translate(hook("pre_llm_call", "B"), 1_200).map((e) => [e.eventType, e.agentId]))
      .toEqual([["prompt_submit", "s:B"]]);
    expect(t.translate(hook("pre_tool_call", "B", {}, { tool_name: "web_search" }), 1_300)[0]).toMatchObject({ agentId: "s:B", toolName: "web_search" });
    expect(t.translate(hook("on_session_end", "B"), 1_400).map((e) => [e.eventType, e.agentId])).toEqual([["turn_stop", "s:B"]]);
    // Lead events stay on the Lead
    expect(t.translate(hook("pre_tool_call", "A", {}, { tool_name: "patch" }), 1_500)[0].agentId).toBeUndefined();
    // Once the Lead is idle, the next session to start a turn takes the Lead seat
    t.translate(hook("on_session_end", "A"), 1_600);
    expect(t.translate(hook("pre_llm_call", "B"), 1_700)[0].agentId).toBeUndefined();
  });

  it("routes delegate_task children (and nested children) to subagents", () => {
    const t = new HermesEventTranslator(HOME);
    t.translate(hook("pre_llm_call", "A"));
    const start = t.translate(hook("subagent_start", "", {
      parent_session_id: "A", child_session_id: "C1", child_subagent_id: "sa-1", child_role: "leaf", child_goal: "Research   the API",
    }, { session_id: "A" }));
    expect(start).toEqual([expect.objectContaining({ eventType: "subagent_start", sessionId: "A", agentId: "d:sa-1", detail: "Research the API" })]);
    expect(t.translate(hook("pre_tool_call", "C1", {}, { tool_name: "web_extract" }))[0]).toMatchObject({ sessionId: "A", agentId: "d:sa-1", eventType: "tool_start" });
    // A child's own turn end does not end anything; subagent_stop does
    expect(t.translate(hook("on_session_end", "C1"))).toEqual([]);
    const nested = t.translate(hook("subagent_start", "C1", {
      parent_session_id: "C1", child_session_id: "C2", child_subagent_id: "sa-2", child_role: "orchestrator",
    }));
    expect(nested[0]).toMatchObject({ sessionId: "A", agentId: "d:sa-2", parentAgentId: "d:sa-1", agentRole: "orchestrator" });
    expect(t.translate(hook("subagent_stop", "C1", { child_session_id: "C2" }))[0]).toMatchObject({ eventType: "subagent_stop", agentId: "d:sa-2", sessionId: "A" });
    expect(t.translate(hook("subagent_stop", "A", { child_session_id: "C1" }))[0]).toMatchObject({ eventType: "subagent_stop", agentId: "d:sa-1" });
    // Late events from a finished child never resurrect it as a new agent
    expect(t.translate(hook("pre_tool_call", "C1", {}, { tool_name: "x" }))).toEqual([]);
  });

  it("puts every Hermes agent, bot and subagent on the office floor", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-hermes-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: new Map<string, CatalogEntry>(), now: () => 5_000 });
    await engine.init();
    const t = new HermesEventTranslator(HOME);
    const feed = async (payload: ReturnType<typeof hook>) => { for (const ev of t.translate(payload, 5_000)) await engine.ingestEvent(ev); };

    await feed(hook("pre_tool_call", "A", {}, { tool_name: "terminal" }));
    await feed(hook("on_session_start", "B", { platform: "discord" }));
    await feed(hook("pre_tool_call", "B", {}, { tool_name: "web_search" }));
    await feed(hook("subagent_start", "", { parent_session_id: "A", child_session_id: "C1", child_subagent_id: "sa-1" }, { session_id: "A" }));
    await feed(hook("pre_tool_call", "C1", {}, { tool_name: "read_file" }));

    const hermes = engine.getSnapshot().state.employees.filter((e) => e.provider === "hermes");
    expect(hermes.map((e) => [e.displayName.split(" @ ")[0], e.isEphemeral]).sort()).toEqual([
      ["Hermes Lead", false],
      ["Hermes Sub", true],
      ["Hermes · discord", true],
    ]);
    expect(hermes.every((e) => e.visualState === "working" || e.visualState === "teamwork")).toBe(true);
    const bay = engine.getSnapshot().state.bays.find((b) => b.projectPath === HOME);
    expect(bay?.displayName).toBe("Hermes");

    await feed(hook("subagent_stop", "A", { child_session_id: "C1" }));
    await feed(hook("on_session_end", "B"));
    expect(engine.getSnapshot().state.employees.filter((e) => e.provider === "hermes").map((e) => e.displayName)).toEqual(["Hermes Lead"]);
  });

  it("installs a hooks.outbound target via `hermes config set`, keeping other targets", async () => {
    const calls: string[][] = [];
    let stored: unknown = [{ name: "ci", url: "https://ci.example/h", events: ["on_session_end"] }];
    const run = async (args: string[]) => {
      calls.push(args);
      if (args.includes("get")) return { stdout: JSON.stringify(stored) };
      stored = JSON.parse(args[args.length - 1]);
      return { stdout: "" };
    };
    const first = await installHermesHooks({ serverUrl: "http://127.0.0.1:7140", profile: "coder", run });
    expect(first.action).toBe("added");
    expect(calls[1].slice(0, 5)).toEqual(["-p", "coder", "config", "set", "hooks.outbound"]);
    expect(stored).toEqual([
      { name: "ci", url: "https://ci.example/h", events: ["on_session_end"] },
      { name: "hell-factory", url: "http://127.0.0.1:7140/api/events/hermes", events: [...HERMES_HOOK_EVENTS], timeout: 2 },
    ]);
    expect((await installHermesHooks({ serverUrl: "http://127.0.0.1:7140", profile: "coder", run })).action).toBe("unchanged");
    expect(calls).toHaveLength(3);

    // "Config key not set" is a fresh install, not an error
    const fresh: string[][] = [];
    const notSet = async (args: string[]) => {
      fresh.push(args);
      if (args.includes("get")) throw Object.assign(new Error("exit 1"), { stdout: "Config key not set: hooks.outbound\n" });
      return { stdout: "" };
    };
    expect((await installHermesHooks({ serverUrl: "http://127.0.0.1:7140", dryRun: true, run: notSet })).action).toBe("added");
    expect(fresh).toHaveLength(1);
  });

  it("handles delegate children that started before Hermes was connected", () => {
    const t = new HermesEventTranslator(HOME);
    // A child (platform "subagent") we never saw start never takes the Lead seat
    expect(t.translate(hook("pre_llm_call", "K", { platform: "subagent" }))[0]).toMatchObject({ eventType: "subagent_start", agentId: "s:K", agentRole: "sub" });
    expect(t.translate(hook("pre_tool_call", "A", {}, { tool_name: "terminal" }))[0].agentId).toBeUndefined();
    // Its parent's subagent_stop ends it
    expect(t.translate(hook("subagent_stop", "A", { child_session_id: "K" }))[0]).toMatchObject({ eventType: "subagent_stop", agentId: "s:K" });
    expect(t.translate(hook("pre_tool_call", "K", {}, { tool_name: "x" }))).toEqual([]);
  });
});
