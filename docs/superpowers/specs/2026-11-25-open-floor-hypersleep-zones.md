# Open Floor Sandbox, Space Haven Hypersleep Pods, Flush Edge Dividers, Floor Painting & Custom Zones

**Date:** 2026-11-25  
**Status:** Implemented  
**Supersedes:** auto-generated boxed project-room grid, fixed lounge resting, and §6.1 / §6.3 routing in `2026-11-24-iherk-hell-factory-design.md` and `2026-11-24-flush-rooms-edge-walls.md` §2.7  
**Builds on:** `2026-11-24-flush-rooms-edge-walls.md`, `2026-11-24-layer-permissions-and-decorate.md`

> **2026-11-26 note:** still the main description of the open floor, with two routing changes:
> - §4.1 `resting` → pod is **replaced**: permanent agents doze at their desk chair (`sit_type_0` + `💤`); resting subagents release their desk and stand idle.
> - Pods are **no longer spawned** (one-per-employee generation and auto-spawn for new agents removed). Saved pods stay as decor; Pods-zone relocation still works.
> - The Boss corner is for briefing/reporting only: no working, meeting or dozing there, and its chairs cannot be owned.
> - §4.1 `working` seating: chairs are handed out by `assignDeskChairs`; an agent's own chair (`ownerEmployeeId`) wins, owned chairs are skipped by everyone else and by meetings, and subagents are seated after permanent agents.
>
> Verification numbers in §10 are from 2026-11-25. Current status: [`2026-11-26-architecture-as-built.md`](./2026-11-26-architecture-as-built.md).

---

## 1. Motivation

The previous campus auto-generated fixed `6×6` boxed rooms for every project folder and filled remaining cells with themed amenity rooms. As the number of projects grew, the user wanted direct creative ownership over the office floor rather than rigid pre-built cubicles:

- Start with a clean, **resizable open sandbox floor** (`floor:0`) instead of auto-partitioned project boxes.
- Keep idle/resting agents compact and thematic inside **Space Haven–style horizontal hypersleep capsules** (1 pod per employee, auto-scaling as new agents join).
- Allow users to design their own rooms with **flush, zero-gap modular glass partitions** (straight, doorway, L-corner, T-junction, +-cross), **custom floor tile painting**, and **named rectangular Custom Zones** (including functional `work` zones).
- Keep active agent monitoring effortless via a dedicated **top-right Active Agents Panel** and a **dynamic Boss avatar** that moves with the Boss chair.

---

## 2. Open Customizable Blank Floor & Resize (`floor:0`)

### 2.1 Default Floor & Seeded Zones
- The campus now opens onto a single continuous open floor (`zoneId: "floor:0"`, default **`24×24` tiles**, configurable between **`12×12` and `96×96`** via `OfficeState.floorWidthTiles` and `OfficeState.floorDepthTiles`).
- Only three lightweight seeded zones are provisioned by default:
  1. **Boss Corner (`boss:0`)** — minimal executive desk + `boss:0-boss-chair`.
  2. **Central Work Hub (`cowork:0`)** — shared workstations where active agents work when no custom work zone is claimed.
  3. **Hypersleep Bay (`hypersleep:0`)** — rows of `1×2` hypersleep pods matching the employee roster.
- `resolveWorldToZone` resolves all in-bounds open-floor coordinates directly to `floor:0` instead of trapping tiles inside legacy `6×6` zone boxes, allowing `2×1`/`1×2` furniture to be placed anywhere across the floor without invisible boundary rejections.

### 2.2 Floor Expand & Shrink
- **Endpoints:**
  - `POST /api/architect/floor/expand` — expands floor dimensions incrementally.
  - `POST /api/architect/floor/resize` — sets or adjusts `widthTiles` / `depthTiles` (`12..96`, both expand and shrink).
- **UI Controls:**
  - Topbar quick buttons **`📐 −Floor`** and **`📐 +Floor`**.
  - Per-axis **`W −2 / +2`** and **`D −2 / +2`** controls inside `#zone-panel`.
- **Safety Validation:** Shrinking is rejected with an explicit error if any placed furniture instance or `CustomZoneRecord` would fall outside the new `(widthTiles, depthTiles)` bounds.

---

## 3. Space Haven–Style Hypersleep Capsules (`hypersleep:0`)

### 3.1 Voxel Assets & Split-Sprite Canopy
- Authored two `1×2` horizontal voxel assets in `assets/pixcel/props/`:
  - `hypersleep-capsule.pixcel.json` — open horizontal pod frame with ochre segmented mattress, side instrumentation, and retracted translucent head cowl (`RENDER_LAYER.LOW = 2`, `TILE_PERM.SEAT = 2`).
  - `hypersleep-capsule-front.pixcel.json` — closed curved translucent glass canopy rendered on `RENDER_LAYER.FOREGROUND = 6` (`foregroundAssetId`) whenever a resting agent lies inside the pod.
- Added horizontal lying-down `rest_sleep_0` and `rest_sleep_1` animation frames for all Phase 2 characters (`agent-claude`, `agent-gemini`, `agent-starter`, and variants) so sleeping agents lie cleanly inside the open mattress beneath the translucent canopy.

### 3.2 Auto-Scaling, Editable Pods Zone & Full Decorate Support
- `ensureHypersleepPodForNewEmployee()` in `src/server/office-engine.ts` automatically spawns 1 additional pod whenever a new persistent employee joins, maintaining a 1:1 pod-to-agent ratio (preferring user-defined custom `role: "hypersleep"` zones first).
- `hypersleep:0` supports full Move, Rotate, and Erase in Decorate Mode and the Architect API via lazy materialization into `OfficeState.zoneOverrides["hypersleep:0"]`.
- Users can define, move, or resize the **Pods Zone** directly from **`🏷️ Zones` (`Z`)** via **`🧊 กำหนด / ย้ายโซน Pods`** (or edit any `role: "hypersleep"` custom zone). Creating or moving a custom `hypersleep` zone automatically transfers the cryo-deck floor and live `🧊 <Name> · sleeping/total` nameplate to that zone, and `POST /api/architect/zones/:id/relocate-pods` neatly packs all existing pods inside the zone.

---

## 4. Dynamic Boss Avatar, Briefing, Thinking & Meeting Routing

- The Boss character sprite and **`👑 BOSS`** nameplate dynamically track the live world position and facing direction of `boss:0-boss-chair` — moving or rotating the Boss chair anywhere on the campus moves and rotates the Boss seamlessly.
- Boss animates attentively (`300ms` clip cadence) whenever any employee is in `reporting` or `assigning` state in front of the Boss desk.

### 4.1 Agent State → Location & Animation Matrix (`src/client/sim.ts`)

| Visual State | Trigger | Target Destination (Priority Order) | Animation & Bubble |
|---|---|---|---|
| **`assigning` (รับบรีฟ)** | `prompt_submit`, `session_start`, `subagent_start`, `Agent`/`invoke_subagent` | Directly in front of `boss:0-boss-desk` / `boss:0-boss-chair` (`pickBossReportGoal`), facing opposite Boss | `assign_0..1` + `📋` / `🎯` |
| **`reporting` (รายงาน/ถาม Boss)** | `turn_stop`, `waiting_user`, `ask_question` | Directly in front of `boss:0-boss-desk` / `boss:0-boss-chair` (`pickBossReportGoal`), facing opposite Boss | `talk_0..1` (`❓`) or `assign_0..1` (`✅`) |
| **`working` — Thinking (กำลังคิด)** | After `assignDurationMs` expires or `tool_end` (`!toolName && detail === "Thinking..."`) | Seated on `chair-office-swivel` (`pickWorkGoal`): **Work Zone** → **Central Hub (`cowork:0`)** → any open-floor work chair *(excludes Boss & Meeting Zone chairs)* | `sit_type_0..1` + `💭 Thinking...` |
| **`working` / `teamwork` (ทำงาน)** | `tool_start`, `tool_error`, 2+ active bay teammates | Seated on `chair-office-swivel` (`pickWorkGoal`, same priority) | `sit_type_0..1` + `💻` / `⚡` / `🔎` / `⚠️` / `🤝` |
| **`meeting` (ประชุม)** | `swarm`, planning/brainstorming tools | **1.** `chair-office-swivel` in **Meeting Zone (`role: "meeting"`)** → **2.** chairs adjacent to `table-conference` → **3.** walkable tiles in Meeting Zone / around `table-conference` → **4.** fallback stand-up | Seated on chair: `sit_type_0..1` + `💬`; Standing: `talk_0..1` + `💬` |
| **`resting` (พักผ่อน)** | Post-report cooldown (`15s`) or stale timeout | `hypersleep-capsule` (`pickHypersleepGoal`), prioritizing pods inside custom `role: "hypersleep"` zones | Lying `rest_sleep_0..1` under translucent L6 glass canopy + `💤` |

---

## 5. Modular Edge-Mounted Glass Partitions (Zero-Gap Flush Walls)

### 5.1 Asset Kit
- Added 4 modular partition props in `assets/pixcel/props/` alongside `divider-low-glass` and `divider-cubicle-amber`:
  - `divider-low-glass-door.pixcel.json` (walkable glass doorway with transom, `TILE_PERM.DOOR = 3`)
  - `divider-low-glass-corner.pixcel.json` (`L` corner)
  - `divider-low-glass-tee.pixcel.json` (`T` junction)
  - `divider-low-glass-cross.pixcel.json` (`+` 4-way intersection)

### 5.2 Boundary-Line Segment Expansion (`expandEdgeDividerSegments`)
- Rather than occupying a full `1×1` floor tile (which previously forced a 20-voxel half-tile gap between glass walls and lockers/desks and caused floor color bleed), all 6 assets in `EDGE_DIVIDER_PROP_IDS` (`src/shared/layers.ts`) expand into zero-thickness boundary-line `EdgeDividerSegment` entries:
  - Straight panels & doors (`divider-low-glass`, `divider-low-glass-door`, `divider-cubicle-amber`): 1 boundary segment on the selected tile edge (`se` = North, `sw` = West, `nw` = South, `ne` = East).
  - `divider-low-glass-corner`: 2 perpendicular boundary segments (`┌`, `┐`, `┘`, `└`).
  - `divider-low-glass-tee`: 3 boundary segments meeting at vertex `(tx, ty)` (`┬`, `┤`, `┴`, `├`).
  - `divider-low-glass-cross`: 4 boundary segments meeting at vertex `(tx, ty)` (`+`).
- Each segment carries a canonical `edgeKey` (`"x:tx,ty-0.5"` or `"y:tx-0.5,ty"`), fractional render coordinates `(rx, ry)`, and `blocks: { x, y, side: "w" | "n" } | null` (`null` for `divider-low-glass-door`).
- Wired across `layout-engine.ts`, `iso-renderer.ts`, and `main.ts` (ghost preview + edge deduplication):
  - Furniture on **both sides** and **inside corners** sits 100% flush against the glass.
  - Floor tile colors split cleanly along the exact glass boundary line.
  - Depth sorting uses zero-thickness planes (`footprintY = 0` or `footprintX = 0`), eliminating clipping on both sides.

---

## 6. Floor Painting (`🎨 Floor` Tab)

- Added 4 new `1×1` floor tile assets in `assets/pixcel/props/` (9 paintable floor tiles total):
  - `floor-scifi-deck.pixcel.json`
  - `floor-marble-checker.pixcel.json`
  - `floor-grass-turf.pixcel.json`
  - `floor-dark-slate.pixcel.json`
  - Plus existing `floor-wood-plank`, `floor-office-carpet`, `floor-lounge-rug`, `floor-corridor-tile`, `floor-boss-parquet`.
- Decorate Mode adds a **`🎨 Floor`** tab with **`1×1` / `2×2` / `3×3`** brush sizes, **`↺ Default`** reset, live tile diamond ghost preview, and Undo/Redo stack integration.
- Persisted in `OfficeState.floorTileOverrides` (keyed by `"tx,ty"`) and mutated via `PATCH /api/architect/floor-tiles` (supports single tile, batch `{ tiles }`, or `{ resetAll: true }`).

---

## 7. Custom Zones (`🏷️ Zones`, Hotkey `Z`)

- Users can define arbitrary named rectangular zones anywhere on the open floor using a 2-click rectangle tool in **`🏷️ Zones`** mode (hotkey `Z`).
- **Schema (`CustomZoneRecord` in `src/shared/types.ts`):**
  ```ts
  {
    id: string;
    name: string;
    icon: string; // default "🏷️"
    color: string; // hex accent color
    role: "label" | "work" | "meeting" | "hypersleep" | "lounge";
    x: number;
    y: number;
    width: number;
    height: number;
  }
  ```
- **Zone Roles & Functional Behavior:**

| Role | Nameplate Suffix | Behavior |
|---|---|---|
| `label` | *(none)* | Named visual room boundary & sidebar quick-jump chip |
| `work` | `· WORK` | Priority seating for thinking/working agents (`chair-office-swivel`) |
| `meeting` | `· MEETING` | Priority seating for `meeting` agents (`chair-office-swivel` + `table-conference`); chairs here are reserved for meetings and excluded from work seating |
| `hypersleep` | `· <sleeping>/<total>` | Overrides default Pods Bay location, cryo-deck floor, nameplate, `🧊 Pods` sidebar jump, auto-spawn target for new agents, and supports one-click pod relocation (`📦`) |
| `lounge` | *(none)* | Visual break/lounge zone & quick-jump chip |

- All custom zones support in-place **Edit (`✏️`)** in `#zone-panel` (update name/icon/color/role via `💾 บันทึกข้อมูลโซน` or 2-click on map to move/resize) plus **`🧊 กำหนด / ย้ายโซน Pods`** quick action.
- **API Endpoints:**
  - `POST /api/architect/zones` — create custom zone
  - `PATCH /api/architect/zones/:id` — rename, recolor, change role, or resize/move zone
  - `POST /api/architect/zones/:id/relocate-pods` — relocate & pack all existing `hypersleep-capsule` pods cleanly inside a `role: "hypersleep"` zone
  - `DELETE /api/architect/zones/:id` — remove custom zone

---

## 8. Top-Right Active Agents Panel (`#active-agents-panel`)

- Added a collapsible floating panel in the top-right corner of the viewport:
  - **`⚡ Active`** tab (currently working, assigning, teamwork, meeting, or reporting agents) and **`👥 All`** tab (full roster including resting/hypersleep agents).
  - Displays provider badge, current visual state, project/role summary, and supports **click-to-focus** smooth camera gliding directly to the selected agent.

---

## 9. Problems Hit & Fixes

| # | Defect | Root Cause | Fix |
|---|---|---|---|
| 1 | Moving `hypersleep-capsule` failed or snapped back | `getZoneFurnitureArray` / `findFurnitureById` in `office-engine.ts` did not materialize `hypersleep:0`, `layout-engine.ts` ignored `zoneOverrides["hypersleep:0"]`, and cross-zone `moveFurniture` omitted `ignoreInstanceId` | Added `hypersleep:0` materialization in `office-engine.ts`, honored `zoneOverrides["hypersleep:0"]` in `layout-engine.ts`, and forwarded `ignoreInstanceId` on cross-zone moves |
| 2 | Furniture could not sit flush against `divider-low-glass` (20-voxel half-tile gap + floor color bleed) | `divider-low-glass` was placed as a `1×1` tile-center furniture item (`y = 14..17`), blocking the entire tile | Converted all `EDGE_DIVIDER_PROP_IDS` into zero-thickness boundary-line segments via `expandEdgeDividerSegments()` in `src/shared/layers.ts` |
| 3 | Multi-tile furniture rejected near `x = 5` / `y = 5` on the open floor | `resolveWorldToZone` matched legacy `6×6` `boss:0`/`cowork:0` boxes before `floor:0`, flagging overflow across invisible internal lines | Updated `resolveWorldToZone` to resolve all in-bounds open-floor tiles directly to `floor:0` |
| 4 | Agents walked onto empty floor while thinking, briefing, or in meetings; Pods Zone stayed stuck at `(13, 1)` | `pickCoworkGoal` only looked up chairs for `working`/`teamwork` (sending `assigning`/`meeting` and custom `floor:0` chairs to fallback `[cowork.originX + spot, cowork.originY + 5]`); `hypersleep:0` cryo deck & nameplate were hardcoded to `HYPERSLEEP_ORIGIN` | Split routing into `pickBossReportGoal` (briefing/reporting at Boss desk), `pickWorkGoal` (thinking/working seated at Work Zone → Central Hub → open-floor chairs), and `pickMeetingGoal` (seated in Meeting Zone / around conference table); added editable `role: "hypersleep"` Pods Zone + `POST /api/architect/zones/:id/relocate-pods` |

---

## 10. Verification

- **Asset Pipeline:** All 10 new `.pixcel.json` props compiled cleanly into `runtime-assets/atlas-{office,night,day}.{png,json}` (`catalogCount: 129`).
- **Typecheck & Builds:** `npm run typecheck`, `npm run build:server`, and `npm run build:client` all pass with 0 errors.
- **Test Suite:** `npm test` — **18/18 test files, 99/99 tests passing**.
- **Visual Verification:** Verified via rendered preview sheets for Space Haven open/closed hypersleep capsules with lying Claude/Gemini sprites, modular L/T/+ divider seams, and flush locker placement on both sides and inside corners of edge-mounted glass walls.
