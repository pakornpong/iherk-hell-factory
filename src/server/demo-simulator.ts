import type { AgentTelemetryEvent } from "../shared/types.js";
import type { OfficeEngine } from "./office-engine.js";

const DEMO_SCRIPT: Array<{ delayMs: number; event: AgentTelemetryEvent }> = [
  {
    delayMs: 400,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c1",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "prompt_submit",
      detail: "Build isometric office",
    },
  },
  {
    delayMs: 1800,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c1",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Edit",
      detail: "Editing iso-renderer.ts",
    },
  },
  {
    delayMs: 2200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g1",
      projectPath: "/demo/iherk-pixcel",
      eventType: "prompt_submit",
      detail: "Craft lounge furniture",
    },
  },
  {
    delayMs: 2000,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g1",
      projectPath: "/demo/iherk-pixcel",
      eventType: "tool_start",
      toolName: "edit_file",
      detail: "Tuning voxel shaders",
    },
  },
  {
    delayMs: 2500,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c1",
      agentId: "sub-review",
      parentAgentId: "demo-c1",
      agentRole: "Reviewer",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_start",
      detail: "Reviewing depth-sorter",
    },
  },
  {
    delayMs: 1800,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c1",
      agentId: "sub-review",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Checking tests",
    },
  },
  {
    delayMs: 2800,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g2",
      projectPath: "/demo/iherk-api-gateway",
      eventType: "tool_start",
      toolName: "run_command",
      detail: "Running vitest suite",
    },
  },
  {
    delayMs: 2400,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c2",
      projectPath: "/demo/iherk-notify",
      eventType: "tool_start",
      toolName: "Edit",
      detail: "Adding webhook alert",
    },
  },
  {
    delayMs: 2800,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g1",
      projectPath: "/demo/iherk-pixcel",
      eventType: "waiting_user",
      detail: "Boss: approve sofa color?",
    },
  },
  {
    delayMs: 3200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g2",
      projectPath: "/demo/iherk-api-gateway",
      eventType: "tool_error",
      toolName: "Bash",
      detail: "Port 8080 busy",
    },
  },
  {
    delayMs: 3200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-c1",
      agentId: "sub-review",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_stop",
    },
  },
  {
    delayMs: 2600,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-g2",
      projectPath: "/demo/iherk-api-gateway",
      eventType: "turn_stop",
      detail: "Report: gateway fixed!",
    },
  },
];

export class DemoSimulator {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private stepIdx = 0;

  constructor(private readonly engine: OfficeEngine) {}

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stepIdx = 0;
    await this.engine.enterDemoMode();
    this.scheduleNext();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.engine.exitDemoMode();
  }

  private scheduleNext(): void {
    if (!this.running) return;
    const item = DEMO_SCRIPT[this.stepIdx % DEMO_SCRIPT.length];
    this.timer = setTimeout(async () => {
      if (!this.running) return;
      try {
        await this.engine.ingestEvent({ ...item.event, timestamp: Date.now() });
      } catch {
        // ignore transient errors if stopped mid-event
      }
      this.stepIdx++;
      this.scheduleNext();
    }, item.delayMs);
    this.timer.unref?.();
  }
}
