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

export const CampusZoneGroupSchema = z.enum(["hq", "workspace", "amenity", "hypersleep", "floor"]);
export type CampusZoneGroup = z.infer<typeof CampusZoneGroupSchema>;

export interface CampusZoneGroupMeta {
  id: CampusZoneGroup;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

export const CAMPUS_ZONE_GROUP_META: Record<CampusZoneGroup, CampusZoneGroupMeta> = {
  hq: { id: "hq", label: "BOSS", shortLabel: "BOSS", icon: "👑", color: "#f59e0b" },
  workspace: { id: "workspace", label: "CENTRAL WORK HUB", shortLabel: "CENTRAL", icon: "💻", color: "#38bdf8" },
  amenity: { id: "amenity", label: "AMENITY", shortLabel: "AMENITY", icon: "🕹️", color: "#a855f7" },
  hypersleep: { id: "hypersleep", label: "HYPERSLEEP BAY", shortLabel: "CAPSULES", icon: "🧊", color: "#22d3ee" },
  floor: { id: "floor", label: "OPEN FLOOR", shortLabel: "FLOOR", icon: "📐", color: "#94a3b8" },
};

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

export const AssetLayerSchema = z.enum(["floor", "wall", "wall-decor", "object", "tabletop", "foreground"]);
export type AssetLayer = z.infer<typeof AssetLayerSchema>;

export const TilePermissionSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type TilePermissionValue = z.infer<typeof TilePermissionSchema>;

export const RenderLayerSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
export type RenderLayerValue = z.infer<typeof RenderLayerSchema>;

export const ZoneIdSchema = z
  .string()
  .regex(
    /^(boss:0|cowork:0|floor:0|hypersleep:0|bay:[a-z0-9-_]+|common:\d+|amenity:\d+)$/i,
    "zoneId must be 'boss:0', 'cowork:0', 'floor:0', 'hypersleep:0', 'bay:<id>', 'common:<row>', or 'amenity:<idx>'",
  );
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
  lx: z.number().int().min(0).max(127),
  ly: z.number().int().min(0).max(127),
  assetId: z.string().min(1).max(128),
  direction: DirectionSchema.default("se"),
  layer: AssetLayerSchema.default("object"),
  /** Optional explicit render elevation layer override (1=floor .. 4=character/object .. 5=tabletop .. 6=foreground). */
  renderLayer: RenderLayerSchema.optional(),
  /** For tabletop props: optional host furniture id this prop sits on. */
  surfaceHostId: z.string().min(1).max(128).optional(),
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

export const CustomZoneRoleSchema = z.enum(["label", "work", "meeting", "hypersleep", "lounge"]);
export type CustomZoneRole = z.infer<typeof CustomZoneRoleSchema>;

export const CustomZoneRecordSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  icon: z.string().min(1).max(8).default("🏷️"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#38bdf8"),
  role: CustomZoneRoleSchema.default("label"),
  x: z.number().int().min(0).max(127),
  y: z.number().int().min(0).max(127),
  width: z.number().int().min(1).max(96),
  height: z.number().int().min(1).max(96),
});
export type CustomZoneRecord = z.infer<typeof CustomZoneRecordSchema>;

export const OfficeStateSchema = z.object({
  version: z.literal(1).default(1),
  theme: ThemeModeSchema.default("office"),
  bossOffice: BossOfficeRecordSchema.optional(),
  bays: z.array(ProjectBayRecordSchema).default([]),
  commonWings: z.array(CommonWingRecordSchema).default([]),
  employees: z.array(EmployeeRecordSchema).default([]),
  activityLog: z.array(ActivityLogEntrySchema).max(100).default([]),
  /** Optional Pokémon GBA-style per-tile movement permission overrides keyed by "tx,ty" (0=blocked, 1=walkable, 2=seat, 3=door). */
  tilePermissionOverrides: z.record(z.string(), TilePermissionSchema).optional(),
  /** Optional persisted furniture overrides for non-bay zones (e.g. "floor:0", "cowork:0", "hypersleep:0", "amenity:0") once edited by user/architect. */
  zoneOverrides: z.record(z.string(), z.array(FurnitureInstanceSchema)).optional(),
  /** Optional per-tile custom floor material overrides keyed by "tx,ty" (e.g. "floor-wood-plank", "floor-scifi-deck"). */
  floorTileOverrides: z.record(z.string(), z.string().min(1).max(128)).optional(),
  /** User-defined custom rectangular zones with centered nameplates & optional functional roles. */
  customZones: z.array(CustomZoneRecordSchema).optional(),
  /** Expandable/shrinkable open floor dimensions (in tiles). */
  floorWidthTiles: z.number().int().min(12).max(96).optional(),
  floorDepthTiles: z.number().int().min(12).max(96).optional(),
});
export type OfficeState = z.infer<typeof OfficeStateSchema>;

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  layer: AssetLayerSchema,
  footprintTiles: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  source: z.enum(["starter", "prop", "character", "custom"]),
  frames: z.array(z.string()).optional(),
  renderLayer: RenderLayerSchema.optional(),
  tilePermission: TilePermissionSchema.optional(),
  surfaceHeightVoxels: z.number().int().min(0).max(64).optional(),
  foregroundAssetId: z.string().min(1).max(128).optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export type AmenityThemeId = "game" | "music" | "stream" | "gym" | "lab" | "maker" | "home" | "server";

export interface AmenityThemeMeta {
  id: AmenityThemeId;
  label: string;
  icon: string;
  color: string;
}

/** Order in which themed amenity rooms fill the leftover slots of the outer ring. */
export const AMENITY_THEME_ORDER: readonly AmenityThemeId[] = [
  "game",
  "music",
  "stream",
  "gym",
  "lab",
  "maker",
  "home",
  "server",
] as const;

export const AMENITY_THEME_META: Record<AmenityThemeId, AmenityThemeMeta> = {
  game: { id: "game", label: "GAME ROOM", icon: "🕹️", color: "#ec4899" },
  music: { id: "music", label: "MUSIC STUDIO", icon: "🎛️", color: "#a855f7" },
  stream: { id: "stream", label: "STREAM STUDIO", icon: "🎥", color: "#22d3ee" },
  gym: { id: "gym", label: "GYM", icon: "🏋️", color: "#ef4444" },
  lab: { id: "lab", label: "SCIENCE LAB", icon: "🧪", color: "#4ade80" },
  maker: { id: "maker", label: "GADGET WORKSHOP", icon: "🛠️", color: "#f97316" },
  home: { id: "home", label: "REST HOME", icon: "🛋️", color: "#facc15" },
  server: { id: "server", label: "SERVER ROOM", icon: "🗄️", color: "#60a5fa" },
};

export interface ZoneBounds {
  zoneId: ZoneId;
  kind: "boss" | "common" | "bay" | "amenity" | "cowork" | "hypersleep" | "floor";
  /** Functional campus zone group (hq / workspace / amenity); distinct groups are separated by walkways. */
  zoneGroup?: CampusZoneGroup;
  amenityTheme?: AmenityThemeId;
  /** Open-plan lot this zone belongs to (e.g. "zone:workspace"); rooms of one lot share low dividers. */
  lotId?: string;
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
  /** Resolved render elevation layer (1=floor .. 4=character/object .. 5=tabletop .. 6=foreground). */
  renderLayer?: RenderLayerValue;
  /** Vertical world-pixel lift above floor (e.g. for tabletop props sitting on a desk). */
  surfaceOffsetY?: number;
}

export interface ComputedCampus {
  widthTiles: number;
  depthTiles: number;
  zones: ZoneBounds[];
  floors: Array<{ tx: number; ty: number; assetId: string; direction: Direction }>;
  walls: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" | "corner" }>;
  wallDecor: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" }>;
  /**
   * Room walls that stand ON the line between two tiles rather than inside a tile of their own.
   * `rx`/`ry` are fractional render coordinates (half a tile back from the tile they front), and
   * `blocks` is the tile edge they close for pathfinding: the step from (x-1,y) to (x,y) for "w",
   * or from (x,y-1) to (x,y) for "n".
   */
  wallSegments: Array<{
    id: string;
    /** Which way the piece runs: along y ("y"), along x ("x"), or a crossing that is just a point. */
    axis: "x" | "y" | "point";
    rx: number;
    ry: number;
    assetId: string;
    direction: Direction;
    blocks: { x: number; y: number; side: "w" | "n" } | null;
  }>;
  worldFurniture: WorldFurnitureInstance[];
  /**
   * Flat `widthTiles * depthTiles` array of resolved tile movement permissions
   * (0=blocked, 1=walkable, 2=seat, 3=door) including user overrides.
   */
  tilePermissions?: TilePermissionValue[];
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
