# Layer & Movement Permission System + Full-Campus Decorate Mode

**Date:** 2026-11-24
**Status:** Implemented (Phase 1: Layers, Permissions, Complete Partitions & Move/Decorate Fixes; Phase 2: Tabletop Props & Surface Placement)
**Builds on:** `2026-11-24-iherk-hell-factory-design.md`, `2026-11-24-flush-rooms-edge-walls.md`

---

## 1. Motivation

Inspired by Pokémon GBA map editors (Advance Map / Porymap), map walkability and vertical occlusion
should be **explicit, inspectable, and editable** rather than scattered across hardcoded special cases:

- Previously `pathfinding.ts` hardcoded `PASSABLE_INTERACTION_ASSETS = new Set(["chair-office-swivel"])`,
  and `iso-renderer.ts` hardcoded a separate draw pass for `chair-office-swivel-back`.
- There was no visual overlay to inspect which tiles were walkable, blocked, seats, or doorways, nor
  any way to override tile walkability or inspect entity render layers on screen.
- Decorate Mode could not edit `cowork:0` or `amenity:*` rooms, showed invisible ghosts for animated
  furniture (desks, printers, coffee bars, server racks), and suffered from silent coordinate shifts
  when placing wide furniture against back walls.

---

## 2. Layer & Movement Permission Architecture (`src/shared/layers.ts`)

### 2.1 Tile Movement Permissions (`TILE_PERM`)

Every tile `(tx, ty)` on the campus resolves to a numeric permission code (`ComputedCampus.tilePermissions`):

| Code | Name | Meaning | Color (Overlay) |
|---|---|---|---|
| `0` | `BLOCKED` | Impassable (solid furniture, obstacles, blocked overrides) | `#ef4444` Red |
| `1` | `WALKABLE` | Normal open floor / flat mats (e.g. `gym-yoga-mat-corner`) | `#22c55e` Green |
| `2` | `SEAT` | Interactable seat tile (e.g. `chair-office-swivel`) | `#38bdf8` Cyan |
| `3` | `DOOR` | Open doorway step between distinct rooms/lots (auto-detected) | `#f59e0b` Amber |

Boundary-line walls continue to block tile-to-tile edges via `blockedW` and `blockedN` (visualized as bold
red edge bars in the overlay).

Manual overrides persist in `OfficeState.tilePermissionOverrides` (keyed by `"tx,ty"`) and mutate through
`PATCH /api/architect/tile-permissions` (`{ tx, ty, permission: 0 | 1 | 2 | 3 | null }` or `{ resetAll: true }`).

### 2.2 Render Elevation Layers (`RENDER_LAYER`, Character = `4`)

| Layer | Name | Role in Layered Isometric Depth Sort |
|---|---|---|
| `1` | `FLOOR` | Flat floors, rugs, flat mats — **always** draws beneath layers `>= 2` |
| `2` | `LOW` | Low bases / seat cushions (`chair-office-swivel`) — draws beneath overlapping characters (`4`) |
| `3` | `BACK` | Rear-plane items behind overlapping objects/characters |
| `4` | `CHARACTER` | **Characters, standard furniture, and boundary walls** — spatially depth-sorted on `(x, y)` |
| `5` | `TABLETOP` | Tabletop props — draws after overlapping host surface (`4`) with vertical lift `surfaceOffsetY`, while still respecting spatial occlusion behind walls/objects in front |
| `6` | `FOREGROUND` | Local split-sprite overlays (e.g. `chair-office-swivel-back` when seated facing `nw`/`sw`) — draws after overlapping character (`4`) while still staying behind walls/objects in front |
| `7` | `OVERLAY` | Global top overlay — **always** draws after layers `<= 6` |

### 2.3 Layered Isometric Topological Sort (`sortUnifiedIsoEntities`)

`src/client/iso-renderer.ts` combines elevation layers with isometric `(x, y)` plane checks:

1. Global floor (`1`) always precedes `> 1`; global overlay (`7`) always follows `< 7`.
2. Spatially separated pairs (`aBehindB !== bBehindA`) obey isometric X/Y occlusion — ensuring a
   tabletop prop (`L5`) or chair backrest (`L6`) in a back room never pokes through a glass wall (`L4`)
   into the front room.
3. Overlapping footprints (`!aBehindB && !bBehindA`) order strictly by `renderLayer` ascending
   (`L2 seat → L4 character → L6 backrest`, or `L4 desk → L5 tabletop prop`), falling back to
   containment (`aInsideB` / `bInsideA`) only when layers are equal.
4. Boundary-line walls & corner posts use **exact zero-thickness planes** (`footprintY = 0` along `x`,
   `footprintX = 0` along `y`, `0×0` for corner posts) with a `±0.1` sweep-line culling margin only.

### 2.4 Map Layers UI Overlay & Editor

- Topbar toggle **`🗺️ Layers`** (hotkey `L` cycles `Off → Permissions (0–3) → Elevation (L1–L6) → Off`,
  `Esc` closes).
- **Permissions mode**: draws isometric tile diamonds with color-coded `0 / 1 / 2 / 3` labels, white
  borders on user-overridden tiles, red bars on `blockedW`/`blockedN` wall edges, and interactive brush
  painting (`👁️ Inspect`, `0 Blocked`, `1 Walkable`, `2 Seat`, `3 Door`, `↺ Auto`, `Reset Overrides`).
- **Elevation mode**: displays `L1`–`L6` / `👤4` badges on live entities so layer ordering is directly
  verifiable.

---

## 3. Complete Partitions & Full-Campus Decorate Mode

### 3.1 Complete Unbroken Partitions

- `room-junction-cross`, `room-junction-t`, and `room-junction-corner` are trimmed to slim full-height
  (`0..56`) corner mullion posts (`12..19 × 12..19`) with no overlapping 16-voxel glass arms.
- `divider-cubicle-amber` and `divider-low-glass` are raised to `56` voxels (preserving warm amber /
  cyan lower panels with upper glass) so intra-lot partitions remain clearly visible above desks.
- `room-wall-door` (`blocks: null`, open walk-through `z = 0..43`, glass transom `z = 46..53`, dark top
  cap `z = 54..56`) spans every doorway tile so wall top rails connect continuously from corner to corner.

### 3.2 Full-Campus Furniture Editing & Move Fixes

- `OfficeState.zoneOverrides` lazily materializes `cowork:0` and `amenity:*` room layouts on first edit,
  allowing users and the Architect API to place, move, rotate, and delete furniture in **every** room
  and persist changes across restarts.
- `placeFurniture` in `layout-engine.ts` no longer shifts wide furniture off `lx = 0` / `ly = 0`, keeping
  persisted state coordinates and rendered `worldFurniture` 1:1 identical.
- Animated furniture ghost previews now resolve active animation frames (`animFrameForAsset`) with exact
  rotated green/red tile footprint diamonds, dimmed source item (`alpha: 0.35`) while moving, visual
  sprite hitbox fallback when clicking tall props, accurate multi-tile Undo origins, and `Esc` cancel-move.

---

## 4. Phase 2 — Tabletop Props & Surface Placement (Implemented)

- **Catalog & Assets (`assets/pixcel/props/prop-*.pixcel.json`)**: Authored 5 dedicated 1×1 tabletop
  props (`category: "tabletop"`, upstream `layer: "object"`, mapped to `CatalogEntry.layer = "tabletop"`
  and `RENDER_LAYER.TABLETOP = 5` in `PixcelBridge`):
  - `prop-desk-lamp` (articulated swing-arm lamp with warm emissive bulb)
  - `prop-laptop` (open aluminum laptop with glowing cyan IDE screen)
  - `prop-book-stack` (3 stacked hardcover books + bookmark + pen)
  - `prop-coffee-mug` (ceramic mug on wood coaster with steam)
  - `prop-mini-plant` (terracotta pot succulent with blossom)
- **Measured Surface Heights (`src/shared/layers.ts`)**: `desk-dev-dual` / `desk-security-ops` /
  `table-conference` / `home-dining-set` (`17`), `coffee-machine-bar` / `stream-podcast-table` /
  `pc-workstation-mac` / `lab-bench-*` / `maker-solder-bench` (`18`), `stream-desk-pro` (`19`),
  `desk-drafting` (`20`).
- **Surface Validation & Host Lifecycle (`layout-engine.ts`, `office-engine.ts`)**:
  - `validateFurniturePlacement` requires tabletop props to sit on an existing surface host tile and
    forbids overlapping another tabletop prop on the same slot (while allowing 2 props on the 2 tiles
    of a 2×1 desk).
  - Moving a host desk carries all hosted tabletop props along (remapped cleanly inside the desk's
    rotated footprint and new zone); deleting a host desk cleans up its hosted props so nothing floats.
- **Decorate Mode UX (`hud.ts`, `main.ts`, `iso-renderer.ts`)**:
  - New `💡 Tabletop` category in the Decorate catalog (`💡 Top` badge); architecture wall pieces
    (`room-wall-*`, `room-junction-*`) filtered out of the furniture catalog.
  - Ghost preview lifts by `surfaceOffsetY` directly onto the desk surface, and floor-furniture ghosts
    now also mirror the server's reachability (`seals off part of zone`) check so green/red accuracy is
    100%.
  - Move and Erase prioritize tabletop props over the underlying desk on click.

---

## 5. Verification

- `npm run typecheck` — clean (server + client)
- `npm run build:server`, `npm run build:client`, `npm run build:assets` — clean (`catalogCount: 119`)
- Live campus depth-sort audit — `0` wall-vs-furniture violations across all rooms
- `npm test` — **18/18 test files (95/95 tests)** passing, including `tests/layer-system.test.ts`,
  `tests/tabletop-props.test.ts`, and expanded `tests/decorate.test.ts`
