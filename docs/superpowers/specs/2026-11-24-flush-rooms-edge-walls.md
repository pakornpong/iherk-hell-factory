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

## 3. Approaches tried and rejected

| Attempt | Why it failed |
|---|---|
| Widen the wall art to fill its tile (6 → 28 voxels deep) | Reads as a low concrete slab lying on the floor, not a wall |
| Shift the wall art to one edge of its tile | Only helps the room on that side; the other side's gap grows to 26 voxels |
| Keep the wall on its own tile and paint that tile with the room's floor | Removes the grey strip but the tile is still blocked, so furniture still cannot touch the wall |

Each of these moves the empty space around rather than removing it. Only taking the wall's tile away
removes it, which is what §2.2 does.

## 4. Verification

- `npm run typecheck` clean for both the server and client configs
- `npm test` — full suite
- Scripted checks on the computed campus: no tile left with 2+ wall arms but no wall of its own, zero
  `floor-corridor-tile` inside the plan, and an A* path from every room to the Boss Office

## 5. Consequences

- A room is still 6×6 and `validateFurniturePlacement` is unchanged, so Decorate Mode and the Gemini
  Architect MCP keep working on zone-local 0..5 coordinates.
- Walking between rooms now goes through doorways into neighbouring rooms; there is no central corridor.
- `ZONE_GAP` stays a constant: setting it back to 1 restores a wall tile between rooms without touching
  the rest of this work.
