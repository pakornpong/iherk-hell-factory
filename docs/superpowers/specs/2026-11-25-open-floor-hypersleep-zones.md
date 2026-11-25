# Open Floor Sandbox, Space Haven Hypersleep Pods, Flush Edge Dividers, Floor Painting & Custom Zones

**Date:** 2026-11-25  
**Status:** Implemented (`main` commit `78c32ee`)  
**Supersedes:** auto-generated boxed project-room grid & amenity-ring layout in `2026-11-24-iherk-hell-factory-design.md` §6.1 and `2026-11-24-flush-rooms-edge-walls.md` §2.7  
**Builds on:** `2026-11-24-flush-rooms-edge-walls.md`, `2026-11-24-layer-permissions-and-decorate.md`

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

### 3.2 Auto-Scaling & Full Decorate Support
- `ensureHypersleepPodForNewEmployee()` in `src/server/office-engine.ts` automatically spawns 1 additional pod whenever a new persistent employee joins, maintaining a 1:1 pod-to-agent ratio.
- `hypersleep:0` supports full Move, Rotate, and Erase in Decorate Mode and the Architect API via lazy materialization into `OfficeState.zoneOverrides["hypersleep:0"]`.

---

## 4. Dynamic Boss Avatar & Reporting

- The Boss character sprite and **`👑 BOSS`** nameplate dynamically track the live world position and facing direction of `boss:0-boss-chair` — moving or rotating the Boss chair anywhere on the campus moves and rotates the Boss seamlessly.
- `pickBossReportGoal()` in `src/client/sim.ts` computes the walkable tile directly in front of the Boss chair's current facing vector and turns reporting/questioning employees to face opposite the Boss's direction.

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
    role: "label" | "work" | "hypersleep" | "lounge";
    x: number;
    y: number;
    width: number;
    height: number;
  }
  ```
- **Functional Behavior:**
  - Zones render subtle translucent isometric boundary highlights and centered floating pixel nameplates, plus quick-jump chips in the sidebar.
  - Zones with `role === "work"` are **functional workspaces** — active employees automatically discover and sit at available `chair-office-swivel` seats placed inside them.
- **API Endpoints:**
  - `POST /api/architect/zones` — create custom zone
  - `PATCH /api/architect/zones/:id` — rename, recolor, change role, or resize/move zone
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

---

## 10. Verification

- **Asset Pipeline:** All 10 new `.pixcel.json` props compiled cleanly into `runtime-assets/atlas-{office,night,day}.{png,json}` (`catalogCount: 129`).
- **Typecheck & Builds:** `npm run typecheck`, `npm run build:server`, and `npm run build:client` all pass with 0 errors.
- **Test Suite:** `npm test` — **18/18 test files, 97/97 tests passing**.
- **Visual Verification:** Verified via rendered preview sheets for Space Haven open/closed hypersleep capsules with lying Claude/Gemini sprites, modular L/T/+ divider seams, and flush locker placement on both sides and inside corners of edge-mounted glass walls.
