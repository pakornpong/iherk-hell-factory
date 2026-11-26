# Flush Rooms & Boundary-Line Walls

**Date:** 2026-11-24
**Status:** Implemented, then partly superseded
**Supersedes:** the campus geometry decided in `2026-11-24-iherk-hell-factory-design.md` §6.1

> **2026-11-26 note:** the packed 6×6 room grid, amenity-room fill and per-room doorways described here were replaced by the open floor in [`2026-11-25-open-floor-hypersleep-zones.md`](./2026-11-25-open-floor-hypersleep-zones.md). What still applies: walls/dividers as zero-thickness boundary-line segments (`wallSegments`), edge-blocking pathfinding (`blockedW` / `blockedN`), zero-thickness depth-sort planes, and the 56-voxel partition height. Today every segment comes from user-placed edge dividers (`ef:<furnitureId>:<n>`); no room walls are generated. See [`2026-11-26-architecture-as-built.md`](./2026-11-26-architecture-as-built.md).

---

## 1. Why

The office read as a sparse grid of islands rather than a building. Between any two rooms sat three
tiles of dead space — a wall tile, a walkway tile, and another wall tile — and the wall art itself only
filled 6 of its tile's 32 voxels, so even the wall's own tile was mostly bare floor. Nothing could be
placed against a wall, and the square-padded campus added further unused ground.

The goal: rooms packed flush against each other, furniture able to sit right against a wall, and no
leftover floor that serves no purpose.

## 2. What changed

### 2.1 Zones sit flush (`ZONE_GAP = 3 → 0`, `IN_LOT_GAP = 1 → 0`)

Room pitch is now exactly `ZONE_SIZE` (6 tiles) on both axes. Every tile inside the campus footprint is
room floor, so `floor-corridor-tile` no longer appears anywhere inside the plan (walkway tiles remain
possible only around an open-plan zone that touches no enclosed room).

### 2.2 Walls stand on the boundary line, not on a tile

A wall used to be a `WorldFurnitureInstance` occupying a whole tile. It is now a separate
`ComputedCampus.wallSegments` entry:

```ts
{ id, axis: "x" | "y" | "point", rx, ry, assetId, direction, blocks: { x, y, side: "w" | "n" } | null }
```

- `rx`/`ry` are **fractional render coordinates**, half a tile back from the tile the wall fronts, so the
  wall's centre band lands exactly on the line between two tiles.
- `blocks` names the single step the wall closes for walking: `"w"` closes `(x-1,y) → (x,y)`,
  `"n"` closes `(x,y-1) → (x,y)`. Doorways and intra-lot dividers set `blocks: null`.
- Segments are generated per boundary line, one pass for vertical lines and one for horizontal. Each room
  side keeps a **1-tile doorway at offset 2**, rendered with `room-wall-door` (open walk-through below
  `z = 43`, matching slim jambs, glass transom `z = 46..53`, and continuous top cap `z = 54..56`,
  `blocks: null`) so wall top rails run continuously from corner to corner without floating breaks.
- No segment is emitted on the campus outer boundary: the diorama's own rear walls already stand there
  and the front edges are the open cutaway. Emitting them produced a second partition hugging the rear
  wall.

### 2.3 Junctions are slim corner mullion posts

Because flush straight wall segments (`0..31` voxels) already meet cleanly at every corner `(bx, by)`,
the three junction pieces (`room-junction-cross`, `room-junction-t`, `room-junction-corner`) are slim
full-height corner mullion posts (`12..19 × 12..19`, height `0..56`, matching baseboard, lower wall,
sill, steel frame post, and top cap) with **no protruding 16-voxel glass arms**. This eliminates
double-drawn semi-transparent glass blocks at corners and prevents fake 4th glass arms from sticking
into T-junctions.

### 2.4 Renderer: walls ride the unified depth sort as zero-thickness planes

`iso-renderer.ts` pushes each segment into the same layered topological sort as furniture and characters,
using **exact zero-thickness boundary planes** (plus a small `±0.1` sweep-line culling margin only):

- Horizontal wall (`axis: "x"`, on `y = by`): `x: [tx, tx + 1]`, `y: [by, by]` (`footprintY = 0`)
- Vertical wall (`axis: "y"`, on `x = bx`): `x: [bx, bx]`, `y: [ty, ty + 1]` (`footprintX = 0`)
- Corner post (`axis: "point"`, at `(bx, by)`): `x: [bx, bx]`, `y: [by, by]` (`0 × 0`)

Every entity in the room behind ends at or before the plane (`<= bx` / `<= by`), and every entity in the
room in front starts at or after the plane (`>= bx` / `>= by`) — eliminating both overlap tiebreaks and
`aInsideB` inversions at room corners (0 wall-vs-furniture depth-sort violations across the entire campus).

### 2.5 Pathfinding: edges block, not tiles

`WalkableGrid` gained `blockedW` and `blockedN`. `findTilePath` checks the specific step being taken
instead of the destination tile, so a wall standing on a line stops movement across that line while both
tiles stay walkable.

### 2.6 All partitions & dividers raised to 56 voxels to clear the furniture

The room partition was 26 voxels tall while **69 of 95 props stand up to 45** (`cabinet-wood-tall` 45,
`lab-cryo-tank` 43, `game-claw-machine` 42, …). With the gap removed, furniture lining both sides buried
the wall completely — it rendered on screen every frame but was never visible. `room-wall-glass`,
`room-wall-door`, the three `room-junction-*` posts, and both intra-lot dividers (`divider-cubicle-amber`
and `divider-low-glass`, keeping their amber/cyan lower panels with matching upper glass) now all stand
56 voxels tall and read clearly above the tallest prop along every continuous boundary line.

### 2.7 Campus is no longer padded to a square

`widthTiles` and `depthTiles` are the real bounding box of the packed blocks. Themed amenity rooms now
fill **every** free cell (cycling the theme list) instead of only the first N, so the plan never leaves
an empty slot showing as bare ground.

## 3. Problems hit, and how each was solved

Every row below was a visible defect found by looking at the running office, not a guess. The cause
column is what measurement showed; the fix column is what shipped.

| # | What went wrong | Cause (measured) | Fix |
|---|---|---|---|
| 1 | Wide grey bands between every pair of rooms | `ZONE_GAP = 3`: wall tile + walkway tile + wall tile, 96 voxels from one room's floor to the next | `ZONE_GAP = 0`; rooms share a boundary line |
| 2 | A grey strip hugged each wall even inside its own tile | The wall occupies only 6 of its tile's 32 voxels, and the rest of the tile was painted `floor-corridor-tile` | First the wall tile carried the room's floor; then §2.1 removed the tile altogether |
| 3 | A bare 6×6 patch of ground inside the plan | Amenity rooms filled only the first N free cells (N = number of themes); any further free cell stayed empty | Fill **every** free cell, cycling the theme list |
| 4 | Ground padded out to a square even when the rooms were not | `widthTiles` and `depthTiles` were both set to one `sideTiles` value | Use the real bounding box of the packed blocks |
| 5 | Walls broke open where four rooms meet | At a crossing the code always placed `room-junction-corner`, a single quadrant: it covered one arm and left the other three missing | Count the arms meeting at the point; 3–4 arms get `room-junction-cross`, an L corner keeps the quadrant piece |
| 6 | A second glass partition stood against the diorama's outer wall | Wall segments were generated on the campus perimeter too, where `campus.walls` already draws the rear wall | Emit nothing on the outer boundary: the back is the rear wall, the front is the open cutaway |
| 7 | After packing rooms flush, **no walls were visible at all** | Not a rendering failure — 98 wall sprites were drawn on screen every frame. The partition is 26 voxels tall while **69 of 95 props stand up to 45**, so furniture lining both sides buried it | Raise `room-wall-glass` and the three `room-junction-*` pieces from 26 to 56 voxels |
| 8 | Rooms read as free-standing X partitions rather than rooms | A 2-tile doorway on all four sides of a 6-tile room leaves only 2-tile stubs at the corners, and four corners make an X | Narrow the doorway to 1 tile at offset 2 |
| 9 | Printers and monitors drawn straight through the glass; walls & corner junctions drawn ON TOP OF desks, ring lights, green screens, and treadmills (10 violations) | A `thin = 0.05` sort box protruded into the front room, so corner posts `[bx, bx+0.05]×[by, by+0.05]` sat *inside* `(bx, by)` furniture (`aInsideB` drew the wall/post on top of the furniture) | Use exact zero-thickness boundary planes (`footprintY = 0` along x, `footprintX = 0` along y, `0×0` for corner posts) with a `±0.1` sweep-line culling margin → 0 violations across the entire campus |
| 10 | Bright overlapping white glass blocks at every corner & fake 4th glass arm sticking into amber dividers | Junction pieces still had 32-voxel full arms (`0..31`) from the old `ZONE_GAP = 1` era, double-drawing semi-transparent glass over straight walls and projecting out of T-junctions | Trim `room-junction-{cross,t,corner}` to slim `12..19 × 12..19` corner mullion posts (height `0..56`) with zero protruding glass arms |
| 11 | Moving wide furniture to `lx = 0` or `ly = 0` silently teleported it to `(1, 1)` and desynced collision state | An earlier workaround in `placeFurniture` shifted wide pieces off back edges only in `worldFurniture` while persisted state kept `(0, 0)` | Removed the silent coordinate shift once zero-thickness wall planes + slim corner posts eliminated wall bleed-through cleanly |
| 12 | Four test files failed after the geometry change | They asserted the old model: pitch 7, `ZONE_GAP === 3`, walls as tile furniture, a corridor tile between zones | Rewrote those assertions against `wallSegments` and the new pitch; made the edge arrays on `WalkableGrid` optional so hand-built grids still work |
| 13 | Intra-lot amber cubicle divider appeared as a single floating tile & doorway gaps broke top rails | `divider-cubicle-amber` (24 voxels) and `divider-low-glass` (18 voxels) were buried behind desks on 4 of 5 tiles, and doorways emitted no top transom | Raised both dividers to 56 voxels (lower amber/cyan panel + upper glass) and added `room-wall-door` (`blocks: null`) doorway transoms so every partition line runs unbroken from corner to corner |

### 3.1 Dead ends — approaches tried and dropped

| Attempt | Why it failed |
|---|---|
| Widen the wall art to fill its tile (6 → 28 voxels deep) | Reads as a low concrete slab lying on the floor, not a wall |
| Shift the wall art to one edge of its tile | Only helps the room on that side; the other side's gap grows to 26 voxels |
| Keep the wall on its own tile and paint that tile with the room's floor | Removes the grey strip, but the tile stays blocked so furniture still cannot touch the wall |
| Flip the vertical wall's rotation to `ne` to move the shifted band | The band landed on the far side instead; walls disappeared from view |

The first three all move the empty space around rather than removing it: as long as the wall owns a
tile, that tile is dead floor on both sides. Only taking the tile away removes it, which is what §2.2
does.

### 3.2 The diagnostic that settled it

Problem 7 resisted four rounds of guessing. What cracked it was a temporary `?wallsonly=1` switch that
rendered the wall segments and nothing else: the walls appeared immediately and in the right places,
which ruled out geometry, culling, atlas frames and the depth sort in one shot and pointed straight at
occlusion. Measuring `maxZ` across all 95 prop assets then gave the number. **Render one layer alone
before theorising about why it is missing.**

## 4. Verification

- `npm run typecheck` clean for both the server and client configs
- `npm test` — 92/92 (17 test files)
- Scripted checks on the computed campus: zero wall-vs-furniture depth-sort violations across all rooms,
  zero `floor-corridor-tile` inside the plan, continuous partition lines with doorway transoms, and an A*
  path from every room to the Boss Office

## 5. Consequences

- A room is still 6×6 and `validateFurniturePlacement` is unchanged, so Decorate Mode and the Gemini
  Architect MCP keep working on zone-local 0..5 coordinates.
- Walking between rooms now goes through doorways into neighbouring rooms; there is no central corridor.
- `ZONE_GAP` stays a constant: setting it back to 1 restores a wall tile between rooms without touching
  the rest of this work.
- A wall is no longer furniture, so anything that scanned `worldFurniture` for `room-*` assets must read
  `wallSegments` instead.
