# Layer & Movement Permission System + Full-Campus Decorate Mode

**Date:** 2026-11-24
**Status:** Implemented (Phase 1: Layers, Permissions, Complete Partitions & Move/Decorate Fixes; Phase 2: Tabletop Props planned)
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

## 4. Verification

- `npm run typecheck` — clean (server + client)
- `npm run build:server`, `npm run build:client`, `npm run build:assets` — clean (`catalogCount: 114`)
- Live campus depth-sort audit — `0` wall-vs-furniture violations across all rooms
- `npm test` — **17/17 test files (92/92 tests)** passing, including `tests/layer-system.test.ts` and
  expanded `tests/decorate.test.ts`

---

## 5. Next Phase — Tabletop Props & Surface Placement

With `RENDER_LAYER.TABLETOP` (`5`), `surfaceHeightVoxels`, and `surfaceOffsetY` already in place:

1. Extend `validateFurniturePlacement` and Decorate Mode to allow `layer: "tabletop"` props to sit on
   host surfaces (`isSurfaceHostAsset`: `desk-*`, `table-*`, `lab-bench-*`, `coffee-machine-bar`), lifting
   ghosts to `surfaceOffsetY`, prioritizing tabletop items on Move/Erase click, and keeping hosted items
   consistent when their host desk moves or is removed.
2. Author initial tabletop prop pack in `assets/pixcel/props/`:
   - `prop-desk-lamp` (warm emissive glow)
   - `prop-laptop` (emissive screen)
   - `prop-book-stack`
   - `prop-coffee-mug`
   - `prop-mini-plant`
