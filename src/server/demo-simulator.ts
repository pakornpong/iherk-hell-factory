import type { AgentTelemetryEvent } from "../shared/types.js";
import type { OfficeEngine } from "./office-engine.js";

export const DEMO_SCRIPT: Array<{ delayMs: number; event: AgentTelemetryEvent }> = [
  // 1. IHERK Dept: Orchestrator -> org-researcher -> org-worker -> org-qa
  {
    delayMs: 350,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentRole: "Orchestrator",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "prompt_submit",
      detail: "Plan office theme & Phase 2 chars",
    },
  },
  {
    delayMs: 1400,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-res",
      parentAgentId: "demo-iherk",
      agentRole: "org-researcher",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_start",
      detail: "Scanning iherk-pixcel exports",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-res",
      agentRole: "org-researcher",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Inspecting character-builder.js",
    },
  },

  // 2. DEV Dept (MSV): Gemini Orchestrator + org-worker
  {
    delayMs: 1600,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentRole: "Orchestrator",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "prompt_submit",
      detail: "Dispatch MSV dashboard update",
    },
  },
  {
    delayMs: 1400,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentId: "dev-wrk",
      parentAgentId: "demo-dev",
      agentRole: "org-worker",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "subagent_start",
      detail: "Implementing MSV widget",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentId: "dev-wrk",
      agentRole: "org-worker",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "tool_start",
      toolName: "edit_file",
      detail: "Editing MSV OrderTable.tsx",
    },
  },

  // 3. ERP Dept: Claude Orchestrator + org-researcher (read-only audit)
  {
    delayMs: 1600,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-erp",
      agentRole: "Orchestrator",
      department: "erp",
      projectPath: "/demo/erp-loh-pc",
      eventType: "prompt_submit",
      detail: "Audit GRDN stock flow",
    },
  },
  {
    delayMs: 1400,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-erp",
      agentId: "erp-res",
      parentAgentId: "demo-erp",
      agentRole: "org-researcher",
      department: "erp",
      projectPath: "/demo/erp-loh-pc",
      eventType: "subagent_start",
      detail: "Reading ERP stock ledgers",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-erp",
      agentId: "erp-res",
      agentRole: "org-researcher",
      department: "erp",
      projectPath: "/demo/erp-loh-pc",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Querying LOH-PC read-only",
    },
  },

  // 4. ACCOUNTING Dept: Gemini Orchestrator + org-researcher + org-qa
  {
    delayMs: 1600,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-acc",
      agentRole: "Orchestrator",
      department: "accounting",
      projectPath: "/demo/accounting-vat",
      eventType: "prompt_submit",
      detail: "Prepare monthly VAT summary",
    },
  },
  {
    delayMs: 1400,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-acc",
      agentId: "acc-qa",
      parentAgentId: "demo-acc",
      agentRole: "org-qa",
      department: "accounting",
      projectPath: "/demo/accounting-vat",
      eventType: "subagent_start",
      detail: "Cross-checking VAT totals",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-acc",
      agentId: "acc-qa",
      agentRole: "org-qa",
      department: "accounting",
      projectPath: "/demo/accounting-vat",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Verifying GRDN tax invoices",
    },
  },

  // 5. IHERK handoff: org-researcher -> org-worker -> org-qa
  {
    delayMs: 1800,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-res",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_stop",
    },
  },
  {
    delayMs: 1000,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-wrk",
      parentAgentId: "demo-iherk",
      agentRole: "org-worker",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_start",
      detail: "Building atlas-office sprites",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-wrk",
      agentRole: "org-worker",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Edit",
      detail: "Updating pixcel-bridge.ts",
    },
  },
  {
    delayMs: 1600,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-qa",
      parentAgentId: "demo-iherk",
      agentRole: "org-qa",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "subagent_start",
      detail: "Running vitest verification",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentId: "iherk-qa",
      agentRole: "org-qa",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "tool_start",
      toolName: "Bash",
      detail: "npm test — 100% pass",
    },
  },

  // 6. HITL gate (❓) -> ERP & Accounting walk up to Boss Office
  {
    delayMs: 2200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-erp",
      agentRole: "Orchestrator",
      department: "erp",
      projectPath: "/demo/erp-loh-pc",
      eventType: "waiting_user",
      detail: "HITL: Approve ERP DB script?",
    },
  },
  {
    delayMs: 2200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-acc",
      agentRole: "Orchestrator",
      department: "accounting",
      projectPath: "/demo/accounting-vat",
      eventType: "waiting_user",
      detail: "HITL: Approve VAT filing?",
    },
  },

  // 7. DEV org-qa check & IHERK Report (✅) -> walks up to Boss Office
  {
    delayMs: 2000,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentId: "dev-qa",
      parentAgentId: "demo-dev",
      agentRole: "org-qa",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "subagent_start",
      detail: "QA checking MSV build",
    },
  },
  {
    delayMs: 1200,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentId: "dev-qa",
      agentRole: "org-qa",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "tool_start",
      toolName: "Read",
      detail: "Reviewing diff & tests",
    },
  },
  {
    delayMs: 2200,
    event: {
      provider: "claude",
      source: "simulator",
      sessionId: "demo-iherk",
      agentRole: "Orchestrator",
      department: "iherk",
      projectPath: "/demo/iherk-hell-factory",
      eventType: "turn_stop",
      detail: "Report: Office theme ready!",
    },
  },
  {
    delayMs: 2400,
    event: {
      provider: "gemini",
      source: "simulator",
      sessionId: "demo-dev",
      agentRole: "Orchestrator",
      department: "dev",
      projectPath: "/demo/msv-frontend",
      eventType: "turn_stop",
      detail: "Report: MSV QA passed!",
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
