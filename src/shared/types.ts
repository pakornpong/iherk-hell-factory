import { z } from "zod";

export const DirectionSchema = z.enum(["se", "sw", "nw", "ne"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const ProviderSchema = z.enum(["claude", "gemini"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const TelemetrySourceSchema = z.enum([
  "claude-code",
  "gemini-cli",
  "antigravity",
  "simulator",
]);
export type TelemetrySource = z.infer<typeof TelemetrySourceSchema>;

export const VisualStateSchema = z.enum([
  "assigning",
  "working",
  "teamwork",
  "meeting",
  "reporting",
  "resting",
]);
export type VisualState = z.infer<typeof VisualStateSchema>;

export const ToolCategorySchema = z.enum(["code", "shell", "search", "error", "idle"]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ThemeModeSchema = z.enum(["office", "night", "day"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const DepartmentIdSchema = z.enum(["iherk", "dev", "erp", "accounting", "general"]);
export type DepartmentId = z.infer<typeof DepartmentIdSchema>;

export const DEPARTMENT_ORDER: readonly DepartmentId[] = [
  "iherk",
  "dev",
  "erp",
  "accounting",
  "general",
] as const;

export interface DepartmentMeta {
  id: DepartmentId;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

export const DEPARTMENT_META: Record<DepartmentId, DepartmentMeta> = {
  iherk: { id: "iherk", label: "IHERK", shortLabel: "IHERK", icon: "⚡", color: "#38bdf8" },
  dev: { id: "dev", label: "DEV", shortLabel: "DEV", icon: "💻", color: "#6366f1" },
  erp: { id: "erp", label: "ERP", shortLabel: "ERP", icon: "🏭", color: "#10b981" },
  accounting: { id: "accounting", label: "ACCOUNTING", shortLabel: "ACC", icon: "💰", color: "#f59e0b" },
  general: { id: "general", label: "GENERAL", shortLabel: "GEN", icon: "🏢", color: "#94a3b8" },
};

export interface OrgRoleMeta {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

export const ORG_ROLE_META: Record<string, OrgRoleMeta> = {
  orchestrator: { id: "Orchestrator", label: "Orchestrator", shortLabel: "ORCH", icon: "🎯", color: "#a78bfa" },
  "org-researcher": { id: "org-researcher", label: "Researcher", shortLabel: "RES", icon: "🔍", color: "#38bdf8" },
  "org-worker": { id: "org-worker", label: "Worker", shortLabel: "WRK", icon: "🛠️", color: "#f59e0b" },
  "org-qa": { id: "org-qa", label: "QA", shortLabel: "QA", icon: "🧪", color: "#10b981" },
};

export function getOrgRoleMeta(role?: string): OrgRoleMeta | null {
  if (!role) return null;
  const key = role.trim().toLowerCase();
  return ORG_ROLE_META[key] ?? null;
}

export function classifyDepartmentFromPath(
  projectPath: string | null | undefined,
  explicitDepartment?: DepartmentId,
): DepartmentId {
  if (explicitDepartment) return explicitDepartment;
  if (!projectPath) return "general";
  const p = projectPath.replace(/\\/g, "/").toLowerCase();

  // 1. IHERK: ~/Documents/IHERK/*, ~/Documents/iherk-*, /demo/iherk-*
  if (
    p.includes("/documents/iherk/") ||
    p.endsWith("/documents/iherk") ||
    p.includes("/documents/iherk-") ||
    p.includes("/demo/iherk-") ||
    /(^|\/)iherk-[a-z0-9._-]+(\/|$)/.test(p)
  ) {
    return "iherk";
  }

  // 2. ACCOUNTING: account / vat / tax / finance
  if (/(^|[^a-z0-9])(account(?:ing)?|vat|tax(?:es)?|finance|financial)([^a-z0-9]|$)/.test(p)) {
    return "accounting";
  }

  // 3. ERP: erp / loh-pc / db
  if (/(^|[^a-z0-9])(erp|loh-?pc|db)([^a-z0-9]|$)/.test(p)) {
    return "erp";
  }

  // 4. DEV: ~/Documents/Github/* or /demo/msv-*
  if (
    p.includes("/documents/github/") ||
    p.endsWith("/documents/github") ||
    p.includes("/demo/msv-") ||
    /(^|\/)msv-[a-z0-9._-]+(\/|$)/.test(p)
  ) {
    return "dev";
  }

  return "general";
}

export const AssetLayerSchema = z.enum(["floor", "wall", "wall-decor", "object"]);
export type AssetLayer = z.infer<typeof AssetLayerSchema>;

export const ZoneIdSchema = z
  .string()
  .regex(/^(boss:0|bay:[a-z0-9-_]+|common:\d+)$/i, "zoneId must be 'boss:0', 'bay:<id>', or 'common:<row>'");
export type ZoneId = z.infer<typeof ZoneIdSchema>;

export const TelemetryEventTypeSchema = z.enum([
  "session_start",
  "prompt_submit",
  "tool_start",
  "tool_end",
  "tool_error",
  "subagent_start",
  "subagent_stop",
  "waiting_user",
  "turn_stop",
  "session_end",
]);
export type TelemetryEventType = z.infer<typeof TelemetryEventTypeSchema>;

export const AgentTelemetryEventSchema = z.object({
  provider: ProviderSchema,
  source: TelemetrySourceSchema,
  sessionId: z.string().min(1).max(256),
  agentId: z.string().min(1).max(256).optional(),
  parentAgentId: z.string().min(1).max(256).optional(),
  agentRole: z.string().min(1).max(64).optional(),
  projectPath: z.string().min(1).max(1024),
  projectName: z.string().min(1).max(128).optional(),
  department: DepartmentIdSchema.optional(),
  eventType: TelemetryEventTypeSchema,
  toolName: z.string().min(1).max(128).optional(),
  detail: z
    .string()
    .transform((s) => (s.length > 80 ? `${s.slice(0, 77)}...` : s))
    .optional(),
  timestamp: z.number().int().nonnegative().optional(),
});
export type AgentTelemetryEvent = z.infer<typeof AgentTelemetryEventSchema>;

export const FurnitureInstanceSchema = z.object({
  id: z.string().min(1).max(128),
  zoneId: ZoneIdSchema,
  lx: z.number().int().min(0).max(5),
  ly: z.number().int().min(0).max(5),
  assetId: z.string().min(1).max(128),
  direction: DirectionSchema.default("se"),
  layer: AssetLayerSchema.default("object"),
  placedBy: z.enum(["system", "user", "gemini"]).default("system"),
});
export type FurnitureInstance = z.infer<typeof FurnitureInstanceSchema>;

export const EmployeeRecordSchema = z.object({
  id: z.string().min(1).max(256),
  bayId: z.string().min(1).max(128),
  provider: ProviderSchema.optional(),
  spriteId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128),
  role: z.string().min(1).max(64).default("Lead"),
  sessionId: z.string().max(256).optional(),
  agentId: z.string().max(256).optional(),
  parentAgentId: z.string().max(256).optional(),
  isEphemeral: z.boolean().default(false),
  deskIndex: z.number().int().min(0).default(0),
  visualState: VisualStateSchema.default("resting"),
  reportReason: z.enum(["question", "result"]).optional(),
  toolCategory: ToolCategorySchema.default("idle"),
  toolName: z.string().max(128).optional(),
  detail: z.string().max(80).optional(),
  assignUntil: z.number().int().nonnegative().optional(),
  restAt: z.number().int().nonnegative().optional(),
  errorUntil: z.number().int().nonnegative().optional(),
  lastUpdatedAt: z.number().int().nonnegative(),
});
export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;

export const ProjectBayRecordSchema = z.object({
  id: z.string().min(1).max(128),
  projectPath: z.string().min(1).max(1024).nullable(),
  displayName: z.string().min(1).max(128),
  department: DepartmentIdSchema.optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#38bdf8"),
  archived: z.boolean().default(false),
  deskSlots: z.number().int().min(1).max(4).default(2),
  furniture: z.array(FurnitureInstanceSchema).default([]),
  createdAt: z.number().int().nonnegative(),
  lastActiveAt: z.number().int().nonnegative(),
});
export type ProjectBayRecord = z.infer<typeof ProjectBayRecordSchema>;

export const CommonWingRecordSchema = z.object({
  row: z.number().int().min(0),
  zoneId: ZoneIdSchema,
  furniture: z.array(FurnitureInstanceSchema).default([]),
});
export type CommonWingRecord = z.infer<typeof CommonWingRecordSchema>;

export const BossOfficeRecordSchema = z.object({
  zoneId: z.literal("boss:0").default("boss:0"),
  displayName: z.string().min(1).max(128).default("BOSS OFFICE"),
  furniture: z.array(FurnitureInstanceSchema).default([]),
});
export type BossOfficeRecord = z.infer<typeof BossOfficeRecordSchema>;

export const ActivityLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  bayId: z.string().min(1),
  employeeId: z.string().min(1),
  provider: ProviderSchema.optional(),
  eventType: TelemetryEventTypeSchema,
  toolName: z.string().optional(),
  detail: z.string().max(80).optional(),
});
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;

export const OfficeStateSchema = z.object({
  version: z.literal(1).default(1),
  theme: ThemeModeSchema.default("office"),
  bossOffice: BossOfficeRecordSchema.optional(),
  bays: z.array(ProjectBayRecordSchema).default([]),
  commonWings: z.array(CommonWingRecordSchema).default([]),
  employees: z.array(EmployeeRecordSchema).default([]),
  activityLog: z.array(ActivityLogEntrySchema).max(100).default([]),
});
export type OfficeState = z.infer<typeof OfficeStateSchema>;

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  layer: AssetLayerSchema,
  footprintTiles: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  source: z.enum(["starter", "prop", "character", "custom"]),
  frames: z.array(z.string()).optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export interface ZoneBounds {
  zoneId: ZoneId;
  kind: "boss" | "common" | "bay";
  bayId?: string;
  department?: DepartmentId;
  row: number;
  col: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface WorldFurnitureInstance extends FurnitureInstance {
  tx: number;
  ty: number;
  footprintTiles: [number, number];
}

export interface ComputedCampus {
  widthTiles: number;
  depthTiles: number;
  zones: ZoneBounds[];
  floors: Array<{ tx: number; ty: number; assetId: string; direction: Direction }>;
  walls: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" | "corner" }>;
  wallDecor: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" }>;
  worldFurniture: WorldFurnitureInstance[];
}

export interface OfficeSnapshotPayload {
  state: OfficeState;
  campus: ComputedCampus;
  demoMode: boolean;
}

export type WsServerMessage =
  | { type: "state:snapshot"; payload: OfficeSnapshotPayload }
  | { type: "event:activity"; payload: ActivityLogEntry }
  | { type: "bay:expanded"; payload: { bayId: string; displayName: string } }
  | { type: "atlas:updated"; payload: { timestamp: number; customAssetId?: string } };
