# Flush Rooms & Boundary-Line Walls

**Date:** 2026-11-24
**Status:** Implemented
**Supersedes:** the campus geometry decided in `2026-11-24-iherk-hell-factory-design.md` §6.1

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
  `"n"` closes `(x,y-1) → (x,y)`. A low cubicle divider inside one department lot blocks nothing.
- Segments are generated per boundary line, one pass for vertical lines and one for horizontal. Each room
  side keeps a **1-tile doorway at offset 2**. A 2-tile opening on all four sides of a 6-tile room left
  only two-tile stubs at the corners, so rooms read as free-standing X partitions rather than rooms.
- No segment is emitted on the campus outer boundary: the diorama's own rear walls already stand there
  and the front edges are the open cutaway. Emitting them produced a second partition hugging the rear
  wall.

### 2.3 Junctions pick the piece that matches the crossing

Where two wall lines cross, the arms meeting at that point are counted:

- 3 or 4 arms → `room-junction-cross` (the full cross; the old quadrant piece covered one arm and left the
  wall visibly broken on the other three once rooms were packed tight)
- exactly 2 adjacent arms → `room-junction-corner`, rotated by the piece's own convention: its arms point
  `+x`/`+y` at direction `"se"`, and each further step rotates 90° clockwise (`sw`, `nw`, `ne`)
- 2 opposite arms → nothing; the two straight segments already meet

### 2.4 Renderer: walls ride the unified depth sort

`iso-renderer.ts` pushes each segment into the same topological sort as furniture and characters, which
already supports fractional positions. Its **sort box is a hair-thick plane starting exactly on the
boundary line**, and a hair longer than a tile along the run. Starting on the line makes anything in the
room behind end at or before the wall, so it sorts behind for certain — a two-tile desk would otherwise
win the distance tiebreak and be drawn straight through the glass. Overhanging the run makes a neighbour
in the room in front count as sitting inside the wall's box, so it draws after and occludes it.

### 2.5 Pathfinding: edges block, not tiles

`WalkableGrid` gained `blockedW` and `blockedN`. `findTilePath` checks the specific step being taken
instead of the destination tile, so a wall standing on a line stops movement across that line while both
tiles stay walkable.

### 2.6 Partition walls raised to clear the furniture

The room partition was 26 voxels tall while **69 of 95 props stand up to 45** (`cabinet-wood-tall` 45,
`lab-cryo-tank` 43, `game-claw-machine` 42, …). With the gap removed, furniture lining both sides buried
the wall completely — it rendered on screen every frame but was never visible. The glass section and
corner posts of `room-wall-glass` and the three `room-junction-*` pieces were extended so the wall now
stands 56 voxels tall and reads clearly above the tallest prop.

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
| 9 | Printers and monitors drawn straight through the glass | The wall's depth-sort box straddled the line, so furniture in the room behind failed the "is behind" test and fell through to the distance tiebreak, which a two-tile desk wins | Start the sort box exactly on the line, a hair thick, and a hair longer than a tile along the run |
| 10 | A solid white block sat at every wall crossing, covering the rooms around it | The junction pieces were solid `wall_main` for their whole body, so raising them to 56 voxels turned each crossing into a tall opaque column | Glaze them like the straight wall: solid only to the sill, glass above, and a slim frame post at the centre |
| 11 | Four test files failed after the geometry change | They asserted the old model: pitch 7, `ZONE_GAP === 3`, walls as tile furniture, a corridor tile between zones | Rewrote those assertions against `wallSegments` and the new pitch; made the edge arrays on `WalkableGrid` optional so hand-built grids still work |

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
- `npm test` — 85/85
- Scripted checks on the computed campus: no tile left with 2+ wall arms but no wall of its own, zero
  `floor-corridor-tile` inside the plan, and an A* path from every room to the Boss Office

## 5. Consequences

- A room is still 6×6 and `validateFurniturePlacement` is unchanged, so Decorate Mode and the Gemini
  Architect MCP keep working on zone-local 0..5 coordinates.
- Walking between rooms now goes through doorways into neighbouring rooms; there is no central corridor.
- `ZONE_GAP` stays a constant: setting it back to 1 restores a wall tile between rooms without touching
  the rest of this work.
- A wall is no longer furniture, so anything that scanned `worldFurniture` for `room-*` assets must read
  `wallSegments` instead.
