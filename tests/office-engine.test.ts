import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OfficeEngine } from "../src/server/office-engine.js";
import { OfficeStore } from "../src/server/store.js";
import type { CatalogEntry } from "../src/shared/types.js";

const catalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["desk-security-ops", { id: "desk-security-ops", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
  ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["server-rack", { id: "server-rack", category: "tech", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bay-sign-post", { id: "bay-sign-post", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
  ["water-cooler", { id: "water-cooler", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
]);

describe("OfficeEngine lifecycle & 5-state FSM", () => {
  it("starts with 1 starter employee, claims Bay 0 on first project, expands on second, and persists across restart", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-eng-"));
    const clock = 1000;
    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({
      store,
      catalogById: catalog,
      now: () => clock,
      restCooldownMs: 15_000,
      assignDurationMs: 2_500,
    });
    await engine.init();

    let snap = engine.getSnapshot();
    expect(snap.state.bays).toHaveLength(1);
    expect(snap.state.bays[0].projectPath).toBeNull();
    expect(snap.state.employees).toHaveLength(1);
    expect(snap.state.employees[0].spriteId).toBe("agent-starter");

    // Project 1 claims Starter Bay 0
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha/",
      eventType: "prompt_submit",
      detail: "Build API",
    });
    snap = engine.getSnapshot();
    expect(snap.state.bays).toHaveLength(1);
    expect(snap.state.bays[0].projectPath).toBe("/work/alpha");
    expect(snap.state.employees[0].spriteId).toBe("agent-claude");
    expect(snap.state.employees[0].visualState).toBe("assigning");

    // Project 2 expands a brand-new bay
    await engine.ingestEvent({
      provider: "gemini",
      source: "antigravity",
      sessionId: "g1",
      projectPath: "/work/beta",
      eventType: "tool_start",
      toolName: "edit_file",
    });
    expect(engine.getSnapshot().state.bays).toHaveLength(2);

    // Persists across restart
    const engine2 = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => clock });
    await engine2.init();
    expect(engine2.getSnapshot().state.bays.map((b) => b.projectPath)).toEqual(["/work/alpha", "/work/beta"]);
  });

  it("drives all 5 animations, upgrades 2+ active bay members to teamwork, cleans ephemeral subagents, and handles out-of-order events", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-fsm-"));
    let clock = 10_000;
    const engine = new OfficeEngine({
      store: new OfficeStore(dir),
      catalogById: catalog,
      now: () => clock,
      restCooldownMs: 15_000,
      assignDurationMs: 2_500,
    });
    await engine.init();

    // working + code tint
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "tool_start",
      toolName: "Edit",
    });
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("working");
    expect(engine.getSnapshot().state.employees[0].toolCategory).toBe("code");

    // subagent joins same bay -> both upgrade to teamwork
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      agentId: "sub-1",
      parentAgentId: "s1",
      agentRole: "Research",
      projectPath: "/work/alpha",
      eventType: "subagent_start",
    });
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      agentId: "sub-1",
      projectPath: "/work/alpha",
      eventType: "tool_start",
      toolName: "Read",
    });
    const bayId = engine.getSnapshot().state.bays[0].id;
    const team = engine.getSnapshot().state.employees.filter((e) => e.bayId === bayId);
    expect(team).toHaveLength(2);
    expect(team.every((e) => e.visualState === "teamwork")).toBe(true);

    // waiting_user -> meeting
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "waiting_user",
      detail: "Approve plan?",
    });
    expect(engine.getSnapshot().state.employees.find((e) => !e.isEphemeral)?.visualState).toBe("meeting");

    // subagent_stop cleans ephemeral worker + unknown subagent_stop is idempotent
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      agentId: "sub-1",
      projectPath: "/work/alpha",
      eventType: "subagent_stop",
    });
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      agentId: "unknown-sub",
      projectPath: "/work/alpha",
      eventType: "subagent_stop",
    });
    expect(engine.getSnapshot().state.employees).toHaveLength(1);

    // turn_stop + interrupted before cooldown cancels resting
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "turn_stop",
    });
    clock += 5_000;
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "tool_start",
      toolName: "Bash",
    });
    await engine.tick();
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("working");
    expect(engine.getSnapshot().state.employees[0].toolCategory).toBe("shell");

    // Full cooldown -> resting
    await engine.ingestEvent({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/work/alpha",
      eventType: "turn_stop",
    });
    clock += 16_000;
    await engine.tick();
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("resting");
  });

  it("auto-unarchives an archived bay when a new event arrives for that project", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-arch-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog });
    await engine.init();
    await engine.ingestEvent({
      provider: "gemini",
      source: "gemini-cli",
      sessionId: "g1",
      projectPath: "/work/old",
      eventType: "tool_start",
      toolName: "Read",
    });
    const bayId = engine.getSnapshot().state.bays[0].id;
    await engine.manageBay(bayId, { archived: true });
    expect(engine.getSnapshot().state.bays[0].archived).toBe(true);

    await engine.ingestEvent({
      provider: "gemini",
      source: "gemini-cli",
      sessionId: "g2",
      projectPath: "/work/old",
      eventType: "prompt_submit",
    });
    expect(engine.getSnapshot().state.bays[0].archived).toBe(false);
  });
});
