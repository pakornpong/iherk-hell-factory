import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OfficeStore } from "../src/server/store.js";
import { AgentTelemetryEventSchema, OfficeStateSchema } from "../src/shared/types.js";

describe("OfficeStore & schemas", () => {
  it("validates telemetry events and truncates oversized detail to 80 chars", () => {
    const parsed = AgentTelemetryEventSchema.parse({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/tmp/proj-a",
      eventType: "tool_start",
      toolName: "Edit",
      detail: "x".repeat(120),
    });
    expect(parsed.detail?.length).toBeLessThanOrEqual(80);
  });

  it("saves atomically, recovers from corrupt primary using .bak, and creates 0600 architect token", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-store-"));
    const store = new OfficeStore(dir);
    const token = await store.ensureArchitectToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    const stat = await fs.stat(store.getArchitectTokenPath());
    expect(stat.mode & 0o777).toBe(0o600);

    // Calling ensureArchitectToken again returns the exact same token
    expect(await store.ensureArchitectToken()).toBe(token);

    const state1 = OfficeStateSchema.parse({
      version: 1,
      theme: "night",
      bays: [],
      commonWings: [],
      employees: [],
      activityLog: [],
    });
    await store.save(state1);
    const state2 = { ...state1, theme: "day" as const };
    await store.save(state2);

    // Corrupt primary file -> should recover seamlessly from .bak (state1)
    await fs.writeFile(path.join(dir, "office-state.json"), "{corrupt json", "utf8");
    const recovered = await store.load();
    expect(recovered?.theme).toBe("night");
  });
});
