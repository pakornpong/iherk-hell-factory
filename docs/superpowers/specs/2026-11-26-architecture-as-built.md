# Architecture As Built (Current Reference)

**Date:** 2026-11-26
**Status:** Reference — describes the code on `main` (`57d8dee`) plus seat owners, doze-at-desk resting, no pod spawning and the Boss-corner rule
**Supersedes:** any statement in the older specs that disagrees with this file. Older specs stay as the design history.

| Spec | Still accurate for |
|---|---|
| [`2026-11-24-iherk-hell-factory-design.md`](./2026-11-24-iherk-hell-factory-design.md) | Intent, goals, anti-goals, telemetry model, security boundary, asset pipeline idea |
| [`2026-11-24-flush-rooms-edge-walls.md`](./2026-11-24-flush-rooms-edge-walls.md) | Boundary-line walls, edge-blocking A*, zero-thickness depth planes (the 6×6 room grid itself is gone) |
| [`2026-11-24-layer-permissions-and-decorate.md`](./2026-11-24-layer-permissions-and-decorate.md) | `TILE_PERM`, `RENDER_LAYER`, layered depth sort, tabletop props |
| [`2026-11-25-open-floor-hypersleep-zones.md`](./2026-11-25-open-floor-hypersleep-zones.md) | Open floor, pods, edge dividers, floor painting, custom zones |
| This file | Everything added after 2026-11-25 and the current module/API map |

---

## 1. Runtime

| Item | Value |
|---|---|
| Server | `node dist/cli/index.js start` (prod) or `npm run dev` (`tsx`), binds `127.0.0.1:7140` (`HELL_FACTORY_PORT`, registered in the port registry) |
| Client | `public/app.js`, bundled by `npm run build:client` (esbuild); served by the same server — there is no separate dev server |
| State | `data/office-state.json` (+ `.bak`, atomic tmp→rename), `data/architect.token` (0600) |
| Atlases | `runtime-assets/atlas-{office,night,day}.{json,png,_emissive.png}`, `custom-atlas.*`, `runtime-assets/library/<id>-<theme>-<hash>.*` (lazy, cached) |
| Engine dependency | `../iherk-pixcel/dist/core` (or `IHERK_PIXCEL_ROOT`). Rebuild pixcel (`npm run build` there) after changing its source |
| Env | `HELL_FACTORY_PORT`, `HELL_FACTORY_ROOT`, `HELL_FACTORY_WATCH_AGY=0`, `HELL_FACTORY_URL` (hooks) |

## 2. Module Map

| Module | Responsibility |
|---|---|
| `src/shared/types.ts` | Zod schemas: telemetry event, `OfficeState`, `FurnitureInstance`, `CustomZoneRecord`, `OfficeLayoutFile`, `CatalogEntry`, WS messages |
| `src/shared/layers.ts` | `TILE_PERM`, `RENDER_LAYER`, asset layer resolution, edge dividers, chair-under-desk collision allowance, `isOwnableChair`, `buildTilePermissionMap` |
| `src/shared/room-layouts.ts` | Designed 6×6 layouts (boss, cowork, common, bays, amenity). Only `cowork` is still placed on the floor; the rest are legacy data |
| `src/server/layout-engine.ts` | `computeCampusLayout`: `boss:0` (default 0,0 · 6×6; drawable anywhere, W 4–12 / D 4–24), `cowork:0` (6×6; right of the Boss corner until pinned by `hubX/hubY`), `hypersleep:0` (origin 13,1; holds saved pods only, nothing is spawned), `floor:0` (whole floor, 12..96 per side); floors, rear walls, wall segments, permissions; `validateFurniturePlacement` |
| `src/server/office-engine.ts` | Event → employee FSM, bay/employee roster, pods, furniture CRUD, zones, floor resize/paint, tile permissions, layout import/export, demo mode. All mutations run through one serialized queue |
| `src/server/layout-transfer.ts` | Export/import validation for `iherk-office-layout` v1 files |
| `src/server/pixcel-bridge.ts` | Catalog, core atlas build, theme remaps, character specs, translucent pod glass, lying sleep pose, library registry, custom asset crafting |
| `src/server/index.ts` | HTTP + WS, auth, static files |
| `src/server/antigravity-watcher.ts` | Default-on transcript tail for Antigravity |
| `src/server/demo-simulator.ts` | Looping 4-project scripted demo (AI-org roles) |
| `src/mcp/architect-server.ts` | Gemini-only stdio MCP (falls back to editing state offline) |
| `src/cli/index.ts`, `install-hooks.ts` | `start`, `demo`, `mcp`, `build-assets`, `install-hooks [--with-mcp]`, `install-codex-hooks`, `install-hermes-hooks` (`install-hermes.ts`), `install-mcp` |
| `src/client/main.ts` | Bootstrap, input, WS, ghost validation, export/import, seat-owner panel, render loop |
| `src/client/sim.ts` | Goal selection per state, chair assignment, A* routing, clips & bubbles, adaptive FPS |
| `src/client/iso-renderer.ts` | Layered topological sort, cached backdrop, foreground split sprites, emissive pass, overlays |
| `src/client/camera.ts`, `view-scene.ts` | Pan/zoom 1–4×, 90° view rotation (client-only projection) |
| `src/client/decorate.ts`, `hud.ts`, `catalog-search.ts`, `atlas-loader.ts`, `chair-alignment.ts`, `pathfinding.ts` | Decorate controller & history, HUD/panels, Thai catalog search & tags, atlas + lazy library packs, centred chair positions, A* |

## 3. Data Model Notes

- **Hypersleep pods:** no longer spawned. Earlier versions created one pod per employee (`createHypersleepFurniture` / `ensureHypersleepPodForNewEmployee`, both removed). Pods already saved in `zoneOverrides` stay; new ones are placed by hand like any decor. The default cryo-deck floor tint is gone; Pods-role custom zones still tint their area and `relocate-pods` still packs placed pods.
- **Boss corner size:** `bossOffice.width` / `height` (optional, default 6). `getBossZoneSize` feeds the Boss zone, the rug, the minimum floor size (`bossW + 6`) and the co-working origin (`originX = bossW`, so the hub and its furniture move with the edge). `resizeBossZone` pushes the rest of the layout with the corner: `floor:0` furniture, custom zones and tile overrides east of the old right edge shift by ΔW, and those below the corner (within its columns) shift by ΔD; the floor grows by the positive delta (shrinking keeps the floor size). It rejects shrinking past Boss furniture, a floor beyond 96, or any new furniture overlap, and then restores everything. `hypersleep:0`/amenity zones keep fixed origins and are not shifted. Restarts keep the size; layout files carry `bossWidth` / `bossHeight`.
- **Drawing the Boss corner:** Zones panel → 👑 วาด / ย้ายโซน Boss, then 2 clicks (`PATCH /api/architect/boss-zone {x,y,width,height}` → `setBossZoneRect`). Boss furniture (zone-local) and `floor:0` furniture fully inside the old rect move by the offset; the hub is pinned at its current origin (`bossOffice.hubX/hubY`). Rejected when outside the floor, overlapping the hub, too small for Boss furniture, or creating a new overlap. `getBossZoneRect` / `getHubOrigin` are the only sources of these positions; layout files carry `bossX/bossY/hubX/hubY`.
- **Library footprints:** 1,270 library assets were authored 2 tiles wide while their voxels fill 1 (generators hard-coded `footprintTiles:[2,1]` for narrow variants). `npm run assets:fit-footprints` trims trailing empty tiles from asset JSON (cache digests change, so atlases re-render); `npm run assets:check-footprints` exits 1 if any remain. Run it after regenerating the library.
- **Boss corner rule:** `isInBossArea` (shared) covers `boss:0` items and anything inside the Boss zone bounds. Those chairs are never used for working, resting or meetings, meetings never gather there, and they cannot be owned (server, import and the UI owner tool all reject it). The corner is used only by `assigning` (brief) and `reporting`.
- **Furniture storage:** `bossOffice.furniture` (`boss:0`), `zoneOverrides["floor:0" | "cowork:0" | "hypersleep:0" | "amenity:N"]`, `bays[].furniture`, `commonWings[].furniture`. `cowork:0` and `hypersleep:0` are generated until first edit, then materialized into `zoneOverrides`.
- **Placement resolution:** world `(tx, ty)` always resolves to `floor:0`. Anything moved by world coordinates (also from `boss:0` / `cowork:0`) ends up in the `floor:0` list.
- **Half-tile coordinates:** `FurnitureCoordinateSchema` is a multiple of `0.5`. Capsules and edge dividers stay whole-tile (`supportsHalfTilePlacement`). A fractional placement may touch but not cross a divider (`crossesWallSegment`).
- **Chairs:** a 1×1 `chair-office-swivel` may overlap half a tile into a desk/table edge it faces (`isChairTuckedUnderDesk`). The client centres an un-moved chair on a 2-wide desk edge (`getCenteredChairTile`); `manualPosition: true` disables that.
- **Bays and common wings:** still created and persisted per project folder (they drive roster, names, colours, archive), but **are no longer rendered as rooms**. Their furniture arrays are legacy data. `ensureBayDesksForTeam` is effectively a no-op because no `bay:*` zone exists.
- **Providers:** `claude`, `gemini`, `codex`, `hermes`. Codex and Hermes use the `agent-starter` sprite (Hermes badge `H`, violet `#a78bfa`); `clarify` counts as a question tool like `ask_question`.
- **Seat owner:** `FurnitureInstance.ownerEmployeeId` — only on ownable chairs (not Boss chair / visitor chairs), only permanent employees, one chair per employee. Set via `PATCH /api/architect/furniture/:id { ownerEmployeeId }` or the `👤 เจ้าของเก้าอี้` Decorate tool. Import drops owners that are not permanent employees in the target office.

## 4. Agent Routing (client `sim.ts`)

| State | Destination |
|---|---|
| `assigning`, `reporting` | Stand spot in front of the Boss chair/desk (`pickBossReportGoal`). This is the only use of the Boss corner |
| `meeting` | Meeting-zone chair → chair near `table-conference` → open tile in meeting zone → around a table → cowork front row (owned chairs, Boss-area chairs/tables/tiles excluded) |
| `working`, `teamwork` | Chair from `assignDeskChairs`: permanent agents first, then subagents. A permanent agent takes the chair it owns; everyone else takes shared (unowned) chairs ordered Work zone → `cowork:0` → other floor chairs (every chair in the Boss area and meeting-zone chairs excluded). Subagents never get owned chairs |
| `resting` (permanent) | Keeps its desk chair and dozes there: `sit_type_0` with `dozing` squash and `💤`. Never dozes in the Boss corner or in pods |
| `resting` (subagent) | Releases its desk and stands idle on the cowork front row (`idle_*`, no bubble) |
| No chair left | Stands on an open tile of the cowork front row |

Server FSM timings: assign 2.5 s, rest cooldown 15 s after `turn_stop`/`session_end`, error tint 4 s, stale 120 s, subagent tombstone 60 s, `tick()` every 1 s.

## 5. HTTP API

Public (no auth): `GET /`, `/api/state`, `/api/catalog`, `/api/health`, `/api/library-assets/:id/:theme`, `/runtime-assets/*`, `POST /api/events`, `POST /api/events/hermes` (Hermes outbound webhooks, body limit 64 MB because `pre_llm_call`/`post_tool_call` carry history and results; `HELL_FACTORY_HERMES_LOG=<file>` writes a keys-only trace), WS `/ws`.

Architect (token **or** UI cookie + `X-UI-Session` + local Origin/Host):

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/architect/layout` | Export / import layout file (4 MB limit) |
| POST | `/api/architect/furniture` | Place (`zoneId,lx,ly` or `tx,ty`, `manualPosition`, `ownerEmployeeId`) |
| PATCH / DELETE | `/api/architect/furniture/:id` | Move, rotate, `renderLayer`, `manualPosition`, `ownerEmployeeId` / remove |
| PATCH | `/api/architect/bays/:id` | Rename, colour, department, archive |
| POST | `/api/architect/floor/expand`, `/floor/resize` | Floor size |
| PATCH | `/api/architect/boss-zone` | Boss corner: `{x,y,width,height}` draws/moves it; `width`/`height` or `deltaWidth`/`deltaDepth` alone resize it and push the layout |
| PATCH | `/api/architect/floor-tiles` | Paint tiles / `resetAll` |
| POST / PATCH / DELETE | `/api/architect/zones[/:id]` | Custom zones |
| POST | `/api/architect/zones/:id/relocate-pods` | Pack pods into a hypersleep zone |
| PATCH | `/api/architect/theme`, `/tile-permissions` | Theme, permission overrides |
| POST | `/api/architect/assets` | Craft custom asset (hot reload) |
| POST | `/api/architect/demo/toggle` | Demo mode |

## 6. Gemini Architect MCP Tools

`get_office_state`, `list_furniture_catalog`, `place_furniture`, `move_furniture`, `remove_furniture`, `craft_furniture_asset`, `manage_bay`, `set_tile_permission`, `expand_floor`.

Not exposed via MCP yet: Boss zone size, zones, floor painting, floor resize/shrink, layout export/import, seat owner, half-tile coordinates (MCP `lx/ly/tx/ty` are integers).

## 7. Asset Catalog

| Source | Count | Where |
|---|---|---|
| `starter` | 8 (12 shipped by pixcel, 4 overridden by local props) | `../iherk-pixcel/assets/office-starter` |
| `prop` | 112 | `assets/pixcel/props` |
| `character` | 10 | built from `PHASE2_CHARACTER_SPECS` in `pixcel-bridge.ts` |
| `library` | 7,390 in 84 categories | `assets/pixcel/library/<category>/index.json` + `NNN/<id>.pixcel.json`, generated by `scripts/asset-library/*.mjs`; atlas built on first request per theme |
| `custom` | 0+ | `assets/pixcel/custom` (Gemini, git-ignored) |

`scripts/local-forge/forge.mjs` drafts props with a local LLM into `assets/pixcel/drafts*`; drafts are never loaded by the server.

## 8. Telemetry Hooks

| Tool | Script | Installer | Events |
|---|---|---|---|
| Claude Code | `hooks/claude-hook.sh` | `install-hooks` → `~/.claude/settings.json` | SessionStart, UserPromptSubmit, PreToolUse, PostToolUseFailure, SubagentStart/Stop, Notification, Stop, SessionEnd (no `PostToolUse`, so Claude never sends `tool_end`) |
| Gemini CLI | `hooks/gemini-cli-hook.sh` | `install-hooks` → `~/.gemini/settings.json` | SessionStart, BeforeAgent, BeforeTool, AfterTool, AfterAgent, SessionEnd |
| Antigravity | `hooks/antigravity-hook.sh` + watcher | `install-hooks` → `~/.gemini/config/hooks.json` | SessionStart, PreInvocation, Pre/PostToolUse, Stop |
| Codex | `hooks/codex-hook.sh` | `install-codex-hooks` → `~/.codex/hooks.json` | SessionStart, UserPromptSubmit, Pre/PostToolUse, PermissionRequest, SubagentStart/Stop, Stop, Interrupt, SessionEnd |
| Hermes Agent | none: Hermes `hooks.outbound` webhook → `POST /api/events/hermes`, translated by `src/server/hermes-bridge.ts` | `install-hermes-hooks [--profile NAME]` → `hermes config set hooks.outbound` (keeps other targets; needs a Hermes gateway/desktop restart) | on_session_start, pre_llm_call, pre/post_tool_call, on_human_input_request/resolved, subagent_start/stop, on_session_end, agent_loop_stopped, on_session_finalize (approval events are not used: smart approvals fire them with no human involved) |

Hermes identity model (one bay per Hermes process cwd; the home dir and `~/.hermes/**` — where the desktop gateway runs — show as bay "Hermes"; gateway routing keys `agent:main:<platform>:dm:<chat>` are mapped back to the session id): the first busy top-level session is the persistent **Hermes Lead**; any other session busy at the same time (another chat, a Telegram/Discord bot, cron, kanban worker) is an ephemeral agent `s:<session>` named after its platform, started with `subagent_start` so the 60 s tombstone never hides its next turn; `delegate_task` children are ephemeral `d:<subagent id>` under their spawner (nested children get `parentAgentId`), their own tool events are routed by child session id, and late events from finished children are dropped. Deliveries are de-duplicated by `delivery_id`.

All hooks exit 0 and use `curl --max-time 1`.

## 9. Verification Snapshot (2026-11-26, working tree)

- `npm run typecheck`: pass.
- `npm test`: 25 files, **145/145 pass** (live: the desktop gateway's own sessions, background sessions and approvals arrived at `/api/events/hermes` after `hermes plugins enable` reloaded the gateway hooks) (`tests/hermes-bridge.test.ts`: lifecycle mapping, dedupe, concurrent bot sessions, nested delegate children, engine integration, installer) (`tests/boss-zone.test.ts`: sizing, hub shift, push-layout on resize, drawing/moving the corner with a pinned hub, persistence, export/import, shrink and overlap guards). `tests/seat-owner.test.ts` covers owner seating, doze at desk, subagent separation, the Boss-corner rule and server owner validation; layout/corridor tests now assert that no pods are spawned and place pods explicitly where they test pods.
- Live check on `:7140`: `PATCH /api/architect/furniture/:id { ownerEmployeeId }` sets and clears the owner; `boss:0-visitor-0` is rejected; `PATCH /api/architect/boss-zone` resizes depth, widening by 1 moved 360 of 445 items and narrowing back restored identical positions, zones and tile overrides.

## 10. Known Issues / Follow-ups

1. Decide what to do with bay/common-wing furniture data (drop generation or render it again).
2. Undo after Erase recreates the item with a new id, so older history entries referencing the old id fail; recreated items lose `ownerEmployeeId`.
3. Extend MCP to zones, floor tiles, layout transfer, seat owner and half-tile coordinates if Gemini should reach parity with the UI.
4. `installMcp` hard-codes `/opt/homebrew/bin/node`.
5. The lying-in-pod sleep pose (`applyLyingHypersleepPose`) and pod-centred agent drawing are now unused by the simulation.
