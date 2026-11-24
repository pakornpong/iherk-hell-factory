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

export const ThemeModeSchema = z.enum(["night", "day"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

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
  theme: ThemeModeSchema.default("night"),
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
