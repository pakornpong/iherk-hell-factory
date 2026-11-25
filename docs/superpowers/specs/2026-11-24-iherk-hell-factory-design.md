# iherk-hell-factory — Design Document

**Date:** 2026-11-24  
**Status:** Implemented & Evolved *(see follow-up specs below for current campus layout, layer system, agent routing, and custom zones)*  
**Target Workspace:** `/Users/dev3/Documents/IHERK/iherk-hell-factory`  
**Asset Engine Dependency:** `/Users/dev3/Documents/IHERK/iherk-pixcel`

> **Design Evolution (Current Architecture):**
> - [`2026-11-24-flush-rooms-edge-walls.md`](./2026-11-24-flush-rooms-edge-walls.md) — Boundary-line zero-thickness walls, slim corner posts, edge-blocking pathfinding.
> - [`2026-11-24-layer-permissions-and-decorate.md`](./2026-11-24-layer-permissions-and-decorate.md) — GBA-style tile permissions (`0–3`), elevation layers (`L1–L7`), tabletop props, and full-campus Decorate Mode.
> - [`2026-11-25-open-floor-hypersleep-zones.md`](./2026-11-25-open-floor-hypersleep-zones.md) — **Latest:** Open resizable sandbox floor (`floor:0`), Space Haven hypersleep pods + editable Pods Zone, flush edge-mounted glass dividers, floor painting, Custom Zones (`work` / `meeting` / `hypersleep` / `lounge`), and Boss-briefing / desk-thinking / meeting-table agent routing.

---

## 1. Intent & Why

Build **iherk-hell-factory**, a gamified **2:1 Isometric Pixel-Art AI Agent Office Live Monitor** inspired by Pixel Salvaje's *Isometric Interiors* aesthetic and powered by the sibling voxel-to-isometric engine **iherk-pixcel**.

Instead of staring at static terminal logs or a fixed single-agent dashboard, the user opens a lightweight local web office that runs quietly all day alongside their real work:
- **Persistent Company Growth:** The office starts small with **1 employee** in a cozy starter bay. Every time the user works in a new project folder with **Claude** or **Gemini**, the office permanently expands by adding a new **work bay (ล็อกการทำงาน)** for that project — with **no maximum cap**.
- **Teams by Project Folder:** All sessions and subagents active in the same project folder form a **team inside that project's bay**, visually distinguishing **Claude** vs. **Gemini** employees.
- **Lively Game-Like Office:** Real tool calls, prompts, subagent spawns, waiting states, and idle periods drive smooth isometric pathfinding and 5 core animations: **Assigning Tasks (สั่งงาน)**, **Working (ทำงาน)**, **Teamwork (ทำงานเป็นทีม)**, **Meeting (ประชุม)**, and **Resting (พักผ่อน)**.
- **Controlled Furniture Customization:** The office can be decorated with new or moved furniture — both manually by the user in an in-game **Decorate Mode** and programmatically by AI, with **Gemini as the sole AI authorized** to craft new assets and modify office furniture (Claude agents remain strictly read-only telemetry emitters so agents never fight over decor).

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Live Multi-Provider Telemetry Hub:** Receive real-time activity events from **Claude Code** (lifecycle hooks), **Gemini CLI** (lifecycle hooks), and **Antigravity** (lifecycle hooks + optional fallback transcript watcher), normalizing them into a unified project/team/employee state stream.
2. **Infinite Expandable Persistent Office:** Start with 1 starter employee; automatically expand a new modular work bay whenever a new project folder is seen; persist all bays, employees, and furniture across restarts; support archiving/unarchiving old project bays.
3. **Rich Isometric Pixel Art via `iherk-pixcel`:** Reuse the 12 starter office assets from `iherk-pixcel`, add a lounge/bay expansion furniture pack, and author animated 4-direction **Claude** and **Gemini** voxel characters using `iherk-pixcel`'s multi-frame DSL (`parts` + `partTransforms`), guaranteeing 100% consistent 2:1 pixel scale and zero mixels.
4. **Lively Autonomous Simulation:** A* isometric tile pathfinding, 5 distinct animated activity states (`assigning`, `working`, `teamwork`, `meeting`, `resting`), pixel speech/tool bubbles, emissive monitor/LED feedback, and cozy autonomous idle behaviors in lounge zones.
5. **Dual Customization with Gemini-Only AI Authority:**
   - Human **Decorate Mode** in the web UI (browse catalog, rotate `R`, place, move, remove, day/night theme switch, undo/redo).
   - **Gemini-Only Office Architect MCP Server** (`hell-factory mcp`) capable of inspecting the office, placing/moving/removing furniture, and crafting new `.pixcel.json` furniture via `iherk-pixcel` with live browser atlas hot-reload.
6. **Lightweight All-Day Web Runtime:** Plain HTML5 Canvas 2D (`imageSmoothingEnabled = false`) with viewport culling (handles dozens/hundreds of bays smoothly) and adaptive frame pacing so leaving it open all day uses minimal CPU/RAM.
7. **Built-In Demo / Simulator Mode & Hook Installer:** One-click simulated activity mode to preview expansion and all 5 animations without active sessions, plus a safe CLI installer (`hell-factory install-hooks`) that prints changes and backs up configs before registering hooks.

### Non-Goals
- Spawning, prompting, or controlling Claude/Gemini processes from inside the office UI (strictly a **Live Office Monitor**, not a command dispatcher).
- Allowing Claude agents (or arbitrary telemetry clients) to modify office layout or furniture.
- Native desktop packaging (Electron/Tauri) — runs as a lightweight local web server (optionally opened in browser App Mode or managed via PM2).
- Multi-floor 3D elevator/staircase stacking in v1 (expansion is horizontal along an unbounded 2D isometric campus floor).
- Cloud sync or multi-user networking (strictly local `127.0.0.1`).

### Anti-Goals (Failure Conditions)
- **Mixels or blurry sprites:** Non-integer scaling, anti-aliased canvas draws, or characters whose pixel density/outline clashes with `iherk-pixcel` furniture.
- **Occluded bays or depth-sort clipping:** Tall interior walls hiding desks/characters behind them, or walking/seated characters clipping over desks/chairs.
- **Agent decor chaos:** Any path where a Claude hook or unauthenticated telemetry call can alter furniture or layout.
- **Hook interference:** Telemetry hooks blocking, slowing down, or throwing errors in Claude Code / Gemini CLI / Antigravity when the office server is stopped.
- **CPU burn at idle:** Running an unbounded 60fps full-world loop over 50 bays when nothing is moving.

---

## 3. Constraints

- **Environment:** macOS Apple Silicon, Node.js `>=22` (verified `v26.5.0`), TypeScript ESM, zero native C++ addons (pure JS/TS persistence and image pipeline).
- **Zero breakage to `iherk-pixcel`:** Consumes `/Users/dev3/Documents/IHERK/iherk-pixcel` (via its compiled CLI/library and starter assets). Any optional enhancement to `iherk-pixcel` must be backwards-compatible and pass `iherk-pixcel`'s existing `vitest` suite.
- **Local-only binding:** HTTP/WebSocket server binds to `127.0.0.1` on default port `7140` (configurable via `HELL_FACTORY_PORT`, avoiding `7131` Star Office, `4300` Spider Process, `4173` Pixcel Preview).
- **Fail-silent hooks:** All hook scripts must finish within `< 1s` (async/backgrounded or `--max-time 1`) and always exit `0` even if `iherk-hell-factory` is not running.
- **Git & GitHub policy:** Repository lives under `/Users/dev3/Documents/IHERK/iherk-hell-factory`, using the `pakornpong` Git/GitHub identity per workspace policy.

---

## 4. Approaches Considered

| Approach | Summary | Tradeoffs |
|---|---|---|
| **1. Plain HTML5 Canvas 2D Web App + Node/TS Live Hub + `iherk-pixcel` Character/Furniture Pipeline** *(Selected)* | Single Node/TS server (HTTP + WebSocket + atomic JSON persistence + Gemini-only MCP), zero-framework Canvas 2D renderer with viewport culling & adaptive FPS, animated 4-dir voxel characters compiled by `iherk-pixcel`. | **Pros:** Lowest idle CPU/RAM for all-day use, exact pixel-art crispness matching `iherk-pixcel`'s target runtime, scales to unlimited bays via viewport culling, easy PM2/dev workflow.<br>**Cons:** 2D emissive effects use baked/additive Canvas layers rather than custom WebGL bloom shaders. |
| **2. PixiJS (WebGL) Web App + Node/TS Live Hub** | Same backend, hooks, and Gemini MCP, but frontend uses PixiJS WebGL sprite batching over `iherk-pixcel` `.atlas.json`. | **Pros:** Effortless 60fps zoomed-out rendering and WebGL bloom shaders.<br>**Cons:** Higher GPU/RAM footprint when left open all day; adds WebGL dependency overhead. |
| **3. Electron / Tauri macOS Desktop App** | Standalone desktop window/menu-bar app wrapping the isometric canvas. | **Pros:** Always-on-top native app feel without browser chrome.<br>**Cons:** Electron adds ~150MB+ RAM & packaging overhead; Tauri requires Rust/Cargo (not installed). |

**Decision:** User selected **Approach 1** (including both in-game Decorate Mode for the user and Gemini-only MCP for AI customization).

---

## 5. System Architecture

```text
  [Claude Code]       [Gemini CLI]        [Antigravity]           [Gemini Architect]
   (hooks.sh)          (hooks.sh)       (hooks.json/watch)       (Antigravity/Gemini CLI)
       │                   │                    │                          │
       │  read-only telemetry (POST /api/events)                           │ stdio MCP
       └───────────────────┴────────────────────┘                          │ (architect token)
                           ▼                                               ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                 iherk-hell-factory Server (Node.js + TS, :7140)                  │
  │                                                                                  │
  │  ┌────────────────────┐   ┌──────────────────────────┐   ┌────────────────────┐  │
  │  │ Telemetry Ingest & │──▶│ Office World State Engine│──▶│ Atomic JSON Store  │  │
  │  │ Activity Classifier│   │ (Bays, Teams, Roster,    │   │ data/office-state  │  │
  │  └────────────────────┘   │  Furniture, Expansion)   │   └────────────────────┘  │
  │                           └─────────────┬────────────┘                           │
  │                                         │                                        │
  │  ┌────────────────────┐                 │                 ┌────────────────────┐ │
  │  │ Architect Mutation │◀────────────────┼────────────────▶│ Asset Compiler &   │ │
  │  │ API (Token-Gated)  │                 │                 │ iherk-pixcel Bridge│ │
  │  └────────────────────┘                 │                 └─────────┬──────────┘ │
  │                                         │ WS broadcast              │ hot-reload │
  └─────────────────────────────────────────┼───────────────────────────┼────────────┘
                                            ▼                           ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │            Browser Client (Plain HTML5 Canvas 2D + Lightweight HUD)              │
  │  • Viewport-Culled Isometric Renderer (64×32, topological depth-sort)            │
  │  • Autonomous Employee Simulation (A* pathfinding, 5 animation states, bubbles)  │
  │  • Camera (Pan, Integer/Smooth Zoom, Minimap, Bay Quick-Jump)                    │
  │  • In-Game Decorate Mode + Employee Inspector + Day/Night Toggle + Demo Mode     │
  └──────────────────────────────────────────────────────────────────────────────────┘
```

### Module Layout *(Our call — builder may refine internal filenames)*
- `src/shared/types.ts` — Shared Zod schemas and TypeScript interfaces for events, bays, employees, furniture instances, world snapshots, WebSocket messages, and atlas manifests.
- `src/server/index.ts` — HTTP + WebSocket server (`127.0.0.1:7140`), static client & built atlas serving, token/session-gated Architect mutation endpoints (`/api/architect/*`), and `POST /api/events` (single unified telemetry ingest endpoint; no legacy `/set_state` alias).
- `src/server/store.ts` — Atomic persistent state storage (`data/office-state.json` + `.bak` rollback safety) and local Architect token provisioning (`data/architect.token`, `0600` permissions).
- `src/server/office-engine.ts` — Core domain rules: project-folder normalization, bay auto-expansion geometry, zone-local furniture ownership, team/employee roster management, event-to-state classification, idle/resting timers, and furniture collision/walkability validation.
- `src/server/pixcel-bridge.ts` — Invokes `iherk-pixcel` (`renderAssetFrame`, `compileAsset`, `packSpriteAtlas`) without modifying `iherk-pixcel` to compile starter + hell-factory expansion + custom `.pixcel.json` assets into packed runtime atlases (`runtime-assets/atlas-night.{png,json}` & `atlas-day.{png,json}` + `_emissive.png` + `custom-atlas.{png,json}`) and triggers WebSocket `atlas:updated` hot-reload.
- `src/server/antigravity-watcher.ts` — Lightweight watcher for `~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl` **enabled by default** (toggleable via `HELL_FACTORY_WATCH_AGY=0`) and deduplicated by `conversationId` with Antigravity hooks so Antigravity shows up live out of the box.
- `src/mcp/architect-server.ts` — Gemini-only Stdio MCP server (`hell-factory mcp`) authenticating to the running server (or directly editing validated state + triggering atlas rebuild) with furniture/asset tools.
- `src/cli/index.ts` — CLI commands: `start`, `mcp`, `build-assets`, `install-hooks` (`--with-mcp` optional), `install-mcp`, `demo`.
- `src/client/` — Plain TypeScript Canvas 2D game client bundled into `public/` via `esbuild`:
  - `iso-renderer.ts` — Exact 2:1 isometric projection (`stepX = 32, stepY = 16`), viewport culling, topological depth-sorter (extended from `iherk-pixcel`'s Kahn algorithm to support fractional sub-tile moving characters), emissive additive pass, pixel speech/tool bubbles.
  - `sim.ts` — Client-side smooth A* pathfinding, 5-state employee animation controller, teamwork sync particles, bay construction pop-in FX, autonomous resting routines, and adaptive FPS scheduler.
  - `camera.ts` — Pan/drag, zoom (`1×–4×` integer crisp presets), smooth glide-to-bay, screen↔tile picking.
  - `decorate.ts` — In-game Decorate Mode (catalog picker, ghost preview with collision highlight, `R` rotate, place/move/delete, undo/redo).
  - `hud.ts` — Minimal pixel-styled HUD: Bay Quick-Jump sidebar, Minimap, Employee Inspector drawer, Day/Night toggle, Demo Mode toggle, Archive manager.
- `assets/pixcel/` — New `.pixcel.json` assets authored for `iherk-hell-factory` (characters + lounge/bay props) plus `assets/pixcel/custom/` for Gemini-crafted furniture.
- `hooks/` — Ready-to-use fail-silent hook scripts for Claude Code, Gemini CLI, and Antigravity.

---

## 6. Key Technical Decisions

### 6.1 Unbounded Modular Campus & Bay Expansion Geometry *(Our call)*
- **Tile System:** Uses `iherk-pixcel`'s default `64×32` isometric preset (`stepX = 32, stepY = 16`, `tileOverlapY = 0`). Coordinates `(tx, ty) ∈ ℤ²` have **no upper bound**.
- **Bay Module Dimensions:**
  - Each **Project Work Bay** occupies a `6×6` tile interior footprint laid out on a `7×7` module pitch (the 1-tile perimeter forms clean walking aisles and low divider boundaries).
  - **Shared Common Wings (Meeting + Lounge Hub):** Each `6×6` Common Wing contains a `table-conference` (meeting area), `whiteboard-arch` (on back wall when adjacent, or freestanding easel), `coffee-machine-bar`, `sofa-lounge`, and `plant-potted` (resting area).
- **Starter Office (Day 1 — 1 Employee) & First Project Claim:**
  - Starts as a cozy `2×1` module campus (`13×6` tiles):
    - **Module `(0, 0)`:** Common Wing 0 (`zoneId: "common:0"` — Meeting Table + Coffee Bar + Lounge Sofa + Night Windows on NE wall).
    - **Module `(1, 0)`:** Starter Project Bay 0 (`projectPath: null`, unclaimed — 2 dual-monitor desks, 2 swivel chairs, server rack, bookshelf, bay nameplate) containing **1 starter employee** wearing a neutral starter look (`agent-starter` — dark-slate hoodie) idling/waiting for the first project.
  - **Claim Rule (`N = 1`):** When the very first real project folder (`P1`) emits an event, `P1` **claims Starter Project Bay 0** (`projectPath = P1`) and binds the starter employee to that session's provider skin (`agent-claude` or `agent-gemini`), yielding **1 active project bay** (`N` distinct active projects = `N` active project bays). Every subsequent new project folder (`P2..PN`) expands a brand-new bay slot.
- **Expansion Algorithm (Unlimited Maximum):**
  - Campus expands in **rows of 4 modules** along `+X` (`col = 0..3`), then starts a new row along `+Y` separated by a **2-tile Main Walkway Corridor** (`row = 0, 1, 2, ...`):
    - In every row, `col = 0` is automatically provisioned as a **Common Wing (Meeting + Lounge Hub, `zoneId: "common:<row>"`)** when that row opens, and `col = 1..3` are **Project Work Bays** assigned in active-bay index order (`slotIndex = 0, 1, 2, ...`).
    - Result: Every project bay is at most 3 bays away from a Conference Table & Coffee Lounge, regardless of whether the user has 1 project or 120 projects!
  - **Wall & Partition Rule (Prevents Isometric Occlusion):**
    - Full-height cutaway walls (`wall-slate-plain`, `wall-night-window`, `wall-corner-pillar`) are generated **only along the outer rear edges** (`ty = 0` NW edge and `tx = 0` NE edge) and extend automatically whenever the campus grows along `+X` or `+Y`.
    - Internal boundaries between bays use **low waist-height dividers** (`divider-low-glass`), corner potted plants, and subtle floor accent borders so **no desk or employee is ever hidden behind an interior wall**.
- **Team Growth Within a Project Bay:**
  - Each bay starts with 2 desk workstations (can auto-expand to 4 desks inside the `6×6` bay if 3–4 teammates are active simultaneously).
  - If a project has `> 4` simultaneous active agents (e.g., a large swarm), overflow teammates automatically use nearby seats at the row's Common Wing conference table (visualized as a war-room sprint) or expand into an adjacent annex bay (`<Project> · Annex 2`) if sustained.
- **Zone-Local Furniture Ownership, Persistence & Archiving *(Our call)*:**
  - Every furniture item is stored in **zone-local coordinates**: `{ id, zoneId: "bay:<bayId>" | "common:<row>", lx, ly, assetId, direction, layer, placedBy }`, where `(lx, ly) ∈ [0..5] × [0..5]` inside its owning `6×6` zone (Decorate Mode and MCP also accept world `(tx, ty)`, automatically resolving to the containing zone and rejecting placements that straddle zone boundaries or block the 2-tile walkway corridor).
  - Every project bay and its primary brand employees (at most 1 persistent lead per provider used in that project — `claude` and/or `gemini`) persist permanently in `data/office-state.json`.
  - Ephemeral subagents spawn into the bay during active delegation and gracefully wave/depart shortly after `SubagentStop` / completion so the roster never bloats over months of use.
  - **Archive / Unarchive with Clean Compaction:** Archiving a project bay marks `archived: true` while keeping its zone-local furniture array intact inside the bay record; active bays **compact/reflow cleanly** into consecutive `(row, col = 1..3)` slots so the floor never develops empty holes, while Common Wings (`common:<row>`) remain anchored at `col = 0` of each active row and keep their furniture untouched. Active paths/characters re-project cleanly to their updated world coordinates. Any future hook event (or manual unarchive) for that project restores the bay with all its custom furniture intact at the next open active slot.

### 6.2 Unified Telemetry Event Model & Provider Adapters *(Our call)*
All live sources normalize into `POST /api/events` with schema:
```ts
interface AgentTelemetryEvent {
  provider: "claude" | "gemini";
  source: "claude-code" | "gemini-cli" | "antigravity" | "simulator";
  sessionId: string;
  agentId?: string;          // distinct ID for subagents / swarm workers
  parentAgentId?: string;    // links subagent to lead for Assigning animation
  agentRole?: string;        // e.g. "Lead", "Research", "Builder", "Browser"
  projectPath: string;       // canonical absolute folder path (key for Bay/Team)
  projectName?: string;      // fallback basename(projectPath)
  eventType:
    | "session_start"
    | "prompt_submit"
    | "tool_start"
    | "tool_end"
    | "tool_error"
    | "subagent_start"
    | "subagent_stop"
    | "waiting_user"
    | "turn_stop"
    | "session_end";
  toolName?: string;         // e.g. "Edit", "Bash", "Read", "invoke_subagent", "swarm"
  detail?: string;           // short human-readable status (truncated <= 80 chars)
  timestamp?: number;
}
```
- **Provider Adapters:**
  1. **Claude Code (`hooks/claude-hook.sh`):** Registered in `~/.claude/settings.json` (`async: true`, `timeout: 2`) on `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`, `SessionEnd`. Extracts `session_id`, `cwd`, `tool_name`, `agent_id`, `agent_type` via `jq` and POSTs with `curl --max-time 1` (exits `0` silently on failure).
  2. **Gemini CLI (`hooks/gemini-cli-hook.sh`):** Registered in `~/.gemini/settings.json` hooks on equivalent lifecycle events (`SessionStart`, `BeforeAgent`/`UserPromptSubmit`, `BeforeTool`, `AfterTool`, `Notification`, `AfterAgent`/`SessionEnd`) with `provider: "gemini"`, `source: "gemini-cli"`.
  3. **Antigravity (`hooks/antigravity-hook.sh` + default-on fallback watcher):**
     - Primary: Registered in global Antigravity hooks file `~/.gemini/config/hooks.json` (`SessionStart`, `PreInvocation`, `PreToolUse`, `PostToolUse`, `Stop`), reading camelCase `conversationId`, `workspacePaths[0]`, and tool name (`edit_file`, `run_command`, `invoke_subagent`, `swarm`, `ask_question`, etc.).
     - Default-on Fallback: `antigravity-watcher.ts` runs by default (disable via `HELL_FACTORY_WATCH_AGY=0`), polling `~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl` mtimes every 2s and tail-reading only appended bytes. Events are deduplicated against live hook events by `(conversationId, step_index / recentTimestamp)` so Antigravity works out of the box even before hooks are installed.
- **CLI Installer Scope *(Our call)*:**
  - `hell-factory install-hooks` backs up and safely merges telemetry hooks into `~/.claude/settings.json`, `~/.gemini/settings.json`, and `~/.gemini/config/hooks.json` (prints a dry-run diff with `--dry-run`).
  - `hell-factory install-mcp` (also invocable via `install-hooks --with-mcp`) registers `hell-factory mcp` **exclusively** in Gemini MCP configs (`~/.gemini/config/mcp_config.json` for Antigravity and `~/.gemini/settings.json` for Gemini CLI) and never touches Claude MCP settings.
- **Security Separation:** `POST /api/events` is the sole telemetry endpoint (no legacy `/set_state` alias); it can **only** update agent telemetry and trigger automatic project bay creation — it **cannot** place, move, delete, or craft furniture.

### 6.3 Mapping Live Events to the 5 Lively Animations *(Our call)*
Each employee runs a finite state machine with hysteresis timers so rapid tool calls don't cause jittery teleporting:

| Visual State | Trigger Condition | Movement & Animation Behavior |
|---|---|---|
| **`assigning` (สั่งงาน)** | `prompt_submit` (new task arrives) OR `subagent_start` / `toolName ∈ {Agent, invoke_subagent, swarm}` | Lead stands briefly (2.5s) facing the bay entrance or walks to the spawned teammate's desk, plays `assign_0..1` clipboard/wave animation with a `📋` task bubble, then returns to work while the teammate walks to an open desk. |
| **`working` (ทำงาน)** | `tool_start` / active turn (`Edit`, `Write`, `Bash`, `Read`, `Grep`, `run_command`, `edit_file`, etc.) | Walks to assigned desk, sits facing monitor, plays `sit_type_0..1`. Desk monitor switches emissive color by tool category (`cyan` = code/edit, `amber` = shell/command, `green` = search/read, `red` = `tool_error` with `⚠️` sweat bubble for 4s). |
| **`teamwork` (ทำงานเป็นทีม)** | `>= 2` employees in the **same project bay** are simultaneously `working` | Employees remain at their desks (or nearby workstations) and periodically play a `talk_0..1` glance toward a teammate while animated glowing pixel sync packets (`⇄` / miniature code icons) travel between their desks; bay header lights up with a `TEAM` indicator. |
| **`meeting` (ประชุม)** | `waiting_user` (`Notification`, `ask_question`), planning/brainstorming/review/swarm phases, or `>= 2` teammates finishing a subagent handoff | Participating employees stand up, A* walk to available seats/spots around the row's **Conference Table** or bay **Whiteboard**, face inward, and alternate `talk_0..1` + `idle_0..1` with pixel speech/chart/question bubbles (`💬`, `📊`, `❓`). |
| **`resting` (พักผ่อน)** | `turn_stop` / `session_end` followed by a **15-second grace cooldown** (so multi-turn work stays seated smoothly) | Employee stands up, A* walks to an available **Lounge / Break Spot** (coffee bar, sofa, bookshelf, plant, or casual stroll), cycling autonomous cozy routines every 10–25s: sipping coffee (`rest_coffee_0..1` with steam particles), sitting/napping on sofa (`rest_sleep_0..1` + floating `Zzz`), chatting with another resting coworker (`talk_0..1`), or admiring a plant. |

- **Cozy Micro-Details:** Subtle dust puffs on bay expansion, blinking server-rack LEDs, animated monitor decals, gentle floating pixel bubbles, and click-to-inspect status cards showing exact project path, provider (`Claude` / `Gemini`), active tool, and recent log.

### 6.4 Asset Pipeline (`iherk-pixcel`) & Character Authoring *(Our call)*
- **Zero-Mixel Guarantee:** Every floor tile, wall, furniture piece, and animated employee sprite is compiled through `iherk-pixcel` at `tilePreset: "64x32"`, `voxelsPerTile: 32`, ensuring identical 2:1 isometric projection, directional shading, voxel AO, 1px tinted outlines, and anchor math.
- **Asset Catalog (Initial Shipped Set):**
  - **12 Starter Office Assets** (imported from `iherk-pixcel/assets/office-starter/`): `floor-wood-plank`, `wall-slate-plain`, `wall-night-window`, `wall-corner-pillar`, `desk-dev-dual`, `desk-security-ops`, `chair-office-swivel`, `server-rack`, `whiteboard-arch`, `table-conference`, `plant-potted`, `bookshelf-wood`.
  - **6 Hell Factory Expansion Props** (authored in `assets/pixcel/props/`):
    1. `floor-lounge-rug` (`1×1`, `layer: "floor"`, `outlineMode: "none"`)
    2. `divider-low-glass` (`1×1`, low waist-height cubicle divider with translucent-style cyan glass + dark metal rail)
    3. `coffee-machine-bar` (`2×1`, wooden counter + espresso machine with glowing amber/red LEDs + ceramic mugs — 2-frame steam animation)
    4. `sofa-lounge` (`2×1`, cozy dark-navy/teal office sofa for resting/napping)
    5. `water-cooler` (`1×1`, office water dispenser with stylized glass jug)
    6. `bay-sign-post` (`1×1`, sleek desk-side/corridor metallic project sign post with emissive accent strip)
  - **Animated Isometric Employee Sprites** (authored in `assets/pixcel/characters/`):
    - `agent-starter.pixcel.json` (neutral dark-slate hoodie for the initial Day-1 employee before Project 1 claims Bay 0), `agent-claude.pixcel.json` (warm terracotta/amber hoodie + dark pants + subtle warm badge), and `agent-gemini.pixcel.json` (electric indigo/cyan jacket + dark pants + bright cyan badge), plus 2–3 lightweight teammate hair/accent variants per provider (generated via material color overrides at build time so teammates in the same bay look like distinct individuals!).
    - Structured with `parts` (`head`, `torso`, `arm_l`, `arm_r`, `leg_l`, `leg_r`, `prop`) using `iherk-pixcel`'s existing `partTransforms.translate` + per-frame `ops` for all required clips: `idle_0..1`, `walk_0..3`, `sit_type_0..1`, `talk_0..1`, `assign_0..1`, `rest_coffee_0..1`, `rest_sleep_0..1`, rendered across all 4 directions (`se`, `sw`, `nw`, `ne`).
- **Day & Night Theme Atlas Generation *(Our call — zero upstream `iherk-pixcel` edits)*:**
  - Note: `iherk-pixcel`'s `renderAssetFrame` renders material hex colors directly from each asset's `materials` map (ignoring `_palette`). Therefore `pixcel-bridge.ts` leaves `iherk-pixcel` completely untouched:
    - `atlas-night.{png,json}` renders all starter + expansion assets using their native dark-office material hex colors.
    - `atlas-day.{png,json}` clones each core starter/expansion `PixcelAsset` in memory and applies a deterministic semantic **Dark-to-Day material color remap table** (dark slate walls `#1e2538`–`#2a334d` → warm daylight plaster `#d8d2c5`–`#ebe6dc`, dark oak floor → warm sunlit honey oak, night window panes `#13294b`/`#28548a` → bright sky-blue daylight glass `#7dd3fc`/`#bae6fd`) before passing the cloned asset to `iherk-pixcel`'s `renderAssetFrame`.
    - Gemini-crafted custom assets (`assets/pixcel/custom/`) render **as authored** in both Day and Night themes so Gemini always gets the exact colors it designed.
- **Custom Asset Hot-Reload:** Custom furniture authored by Gemini lives in `assets/pixcel/custom/<id>.pixcel.json`. When created/updated, `pixcel-bridge.ts` validates via `PixcelAssetSchema`, compiles & repacks a separate `custom-atlas.{png,json}` (keeping core atlas build cached so hot-reload completes in `< 300ms`!), and broadcasts `atlas:updated` over WebSocket.

### 6.5 Furniture Customization & Gemini-Only AI Authority *(User Decision + Our Call)*
- **Dual Authority Model & Auth Boundary *(Our call)*:**
  1. **User (In-Game Decorate Mode — Zero-Friction Local Browser Session):** When `GET /` is served on `127.0.0.1`, the server issues an ephemeral in-memory UI session token set both as an `HttpOnly; SameSite=Strict` cookie and injected into the HTML page as `X-UI-Session`. Calls to `/api/architect/*` from the browser must present a matching cookie + `X-UI-Session` header AND pass strict `Host`/`Origin` validation (`127.0.0.1:<port>` or `localhost:<port>`). This keeps browser Decorate Mode zero-friction (no manual token copy-paste) while still blocking external scripts, CSRF, and Claude hooks (`401/403`).
  2. **Gemini Only (Exclusive MCP Server — `hell-factory mcp`):**
     - Configured **only** in Gemini MCP configs (Antigravity `~/.gemini/config/mcp_config.json` and Gemini CLI `~/.gemini/settings.json`), never in Claude Code.
     - Authenticates to `/api/architect/*` using the persistent local `data/architect.token` (`0600`) via `X-Architect-Token` header. Claude hooks never receive this token and only talk to `POST /api/events`.
     - **MCP Tool Surface (`hell-factory mcp`):**
       - `get_office_state` — list all bays (active & archived), employees, zones, and placed furniture coordinates (both zone-local and current world coords).
       - `list_furniture_catalog` — list all built-in and custom furniture assets with footprint sizes and categories.
       - `place_furniture` — place an asset by `(zoneId, lx, ly, direction)` or world `(tx, ty, direction)` (auto-resolved to owning zone; rejects cross-zone straddling, collisions, or corridor blocking).
       - `move_furniture` — relocate/rotate an existing furniture item by `instanceId`.
       - `remove_furniture` — remove a furniture item by `instanceId` (protects core structural perimeter walls unless explicitly overridden).
       - `craft_furniture_asset` — author or update a `.pixcel.json` asset in `assets/pixcel/custom/`, compile it through `iherk-pixcel` (returning a base64 PNG 4-direction contact sheet for Gemini's visual self-check!), repack `custom-atlas`, and hot-reload all connected browsers.
       - `manage_bay` — rename a bay's display label, set bay accent color, or archive/unarchive a bay.

### 6.6 Lightweight Canvas 2D Rendering & Depth-Sorting *(Our call)*
- **Nearest-Neighbor Pixel Crispness:** `ctx.imageSmoothingEnabled = false` at integer camera zoom levels (`1×`, `2×`, `3×`, `4×`, default `2×` on HiDPI displays).
- **Unified Isometric Depth-Sorting:**
  - Layer 1: Visible `floors` sorted by `(tx + ty)`.
  - Layer 2: Visible rear `walls` + `wall-decor` sorted by depth band.
  - Layer 3: Visible `objects` (furniture) **merged with** visible `employees` (using their continuous `(x, y)` tile coordinates with a `0.6×0.6` inner footprint box) sorted via Kahn's topological isometric depth-sorter — ensuring characters walk smoothly behind tall server racks, in front of desks, and sit naturally on swivel chairs.
  - Layer 4: Emissive additive overlay (`globalCompositeOperation = "lighter"`, subtle alpha in night mode) + floating pixel speech/tool/status bubbles + bay nameplates.
- **Viewport Culling & Adaptive FPS:**
  - Only tiles/objects/agents inside the camera's world-space AABB (plus 128px vertical sprite margin) enter the depth-sorter and draw list.
  - Render loop dynamically paces at `30 FPS` when any visible character is walking, a bay animation is playing, or the user is panning/decorating, and drops to `8 FPS` when everyone is seated/idle (still animating blinking LEDs, typing hands, and `Zzz`), or pauses completely when `document.hidden` is true.

---

## 7. Verification & Success Criteria

1. **Asset & Character Compilation Tests (`vitest`):**
   - All 6 new Hell Factory props and all animated character models (`agent-starter`, `agent-claude`, `agent-gemini`) validate against `iherk-pixcel`'s `PixcelAssetSchema`, compile cleanly across all 4 directions (`se`, `sw`, `nw`, `ne`) and all animation frames (`idle`, `walk`, `sit_type`, `talk`, `assign`, `rest_coffee`, `rest_sleep`), and pack into valid TexturePacker `.atlas.json` + `_emissive.png` for both `night` and `day` themes.
2. **Office Growth & Persistence Tests (`vitest`):**
   - Fresh office starts with 1 unclaimed Starter Bay 0 and 1 starter employee (`agent-starter`).
   - Project 1 claims Starter Bay 0 (binding its provider skin); sending events for `N` distinct project folders (`N = 1, 2, 10, 25`) deterministically yields exactly `N` non-overlapping active project bays + periodic Common Wings with continuous perimeter walls and valid walkable paths from every desk to the nearest conference table and lounge.
   - Restarting the server reloads all bays, employees, and zone-local custom furniture identically from `data/office-state.json`.
   - Archiving a bay compacts subsequent active bays cleanly without leaving holes or disturbing Common Wing furniture; a subsequent telemetry event for that project folder automatically unarchives it with its custom furniture restored intact.
3. **Event-to-Animation State Machine Tests (`vitest`):**
   - Verify transitions across all 5 states: `prompt_submit` / `subagent_start` → `assigning`; `tool_start` → `working` (with tool-category screen tint); 2+ concurrent workers in the same project → `teamwork`; `waiting_user` / planning → `meeting`; `turn_stop` + cooldown → `resting`.
   - Verify ephemeral subagents join the right project bay and clean up gracefully after `subagent_stop`.
4. **Gemini-Only Security Boundary Tests (`vitest`):**
   - Direct calls to `/api/architect/*` without either a valid `X-Architect-Token` or a matching browser UI session cookie + `X-UI-Session` header + localhost `Origin` return `401/403`.
   - Calls to `POST /api/events` cannot mutate furniture or assets.
   - `hell-factory mcp` end-to-end test: invoke `craft_furniture_asset` → `place_furniture` → `move_furniture` → `remove_furniture`, verifying zone-boundary/collision checks, `custom-atlas` generation, and WebSocket `atlas:updated` emission.
5. **Hook Script Safety Tests:**
   - Execute `claude-hook.sh`, `gemini-cli-hook.sh`, and `antigravity-hook.sh` with sample stdin payloads both when server is running (verifying state updates) and when server is stopped (verifying exit code `0` in `< 1s` with zero stderr noise).
6. **Visual & Interactive Smoke Test (Browser):**
   - Launch `iherk-hell-factory` in Demo Mode with multiple simulated Claude & Gemini projects; visually inspect in browser to confirm crisp pixel art (zero blur/mixels), accurate depth sorting around desks/chairs/characters, smooth walking/working/teamwork/meeting/resting animations, working Decorate Mode, and clean Day/Night switching.

---

## 8. What's Left to the Builder

- Exact voxel coordinates and pixel art details of the 6 expansion props and the Claude/Gemini character models (guided by `iherk-pixcel`'s dark-office / *Isometric Interiors* style and proportional desk/chair heights).
- Choice of minimal client bundler (`esbuild` recommended) and WebSocket library (`ws` recommended).
- Exact HUD CSS styling, minimap pixel layout, and keyboard shortcut bindings (beyond `R` for rotate, `Esc` to exit Decorate Mode, and `1–4` zoom presets).
- Internal A* grid caching and path-smoothing interpolation details.
- Exact PM2 `ecosystem.config.cjs` convenience file if desired alongside `npm run dev` / `npm start`.
