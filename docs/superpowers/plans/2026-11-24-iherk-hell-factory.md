# แผนการพัฒนา `iherk-hell-factory` (Implementation Plan)

> **สำหรับผู้ลงมือพัฒนา (Agentic Workers):** ใช้สกิล `superpowers:subagent-driven-development` (แนะนำ) หรือ `superpowers:executing-plans` เพื่อทำตามแผนนี้ทีละ Task โดยติ๊กช่องเช็กบ็อกซ์ (`- [ ]`) เมื่อทำแต่ละขั้นตอนเสร็จ

**เป้าหมาย (Goal):** สร้าง **iherk-hell-factory** แอปเว็บจำลอง **AI Agent Office มุมมอง 2:1 Isometric Pixel Art** แบบ **Live Office Monitor** ที่เริ่มจากพนักงาน 1 คนและขยายล็อกการทำงานสะสมถาวรตามโฟลเดอร์โปรเจคแบบไม่จำกัด รองรับทั้ง **Claude** และ **Gemini** พร้อม 5 อนิเมชั่นที่มีชีวิตชีวา, โหมดแต่งเฟอร์นิเจอร์ในหน้าเกม และ MCP Server แต่งห้อง/ปั้นเฟอร์ใหม่ผ่าน `iherk-pixcel` เฉพาะฝั่ง **Gemini เท่านั้น**

**สถาปัตยกรรม (Architecture):** เซิร์ฟเวอร์ Node.js + TypeScript ตัวเดียว (`127.0.0.1:7140`) ทำหน้าที่รับ telemetry ผ่าน `POST /api/events` (พร้อมตัวอ่าน transcript ของ Antigravity), จัดการสถานะออฟฟิศแบบ zone-local และเซฟลง JSON แบบ atomic, แปลง `.pixcel.json` ผ่าน `iherk-pixcel` เป็น runtime atlas ทั้งธีม Night/Day และ Custom Atlas แบบ hot-reload ฝั่งหน้าเกมใช้ Plain HTML5 Canvas 2D (`imageSmoothingEnabled = false`) พร้อม viewport culling, topological depth-sorting, A* pathfinding และ adaptive FPS

**ชุดเทคโนโลยี (Tech Stack):** Node.js >= 22 (ESM), TypeScript 5.8+, Zod, `ws`, `@modelcontextprotocol/sdk`, `esbuild` (bundle ฝั่ง client), `vitest`, และไลบรารี `iherk-pixcel` ที่มีอยู่แล้วใน `/Users/dev3/Documents/IHERK/iherk-pixcel/dist/`

**เอกสารออกแบบอ้างอิง (Spec):** [2026-11-24-iherk-hell-factory-design.md](file:///Users/dev3/Documents/IHERK/iherk-hell-factory/docs/superpowers/specs/2026-11-24-iherk-hell-factory-design.md)

---

## ข้อกำหนดร่วมทั้งโปรเจค (Global Constraints)

- **สภาพแวดล้อม:** macOS Apple Silicon, Node.js `>=22` (เครื่องนี้ใช้ `v26.5.0`), TypeScript ESM, ห้ามใช้ native C++ addons (pure JS/TS ทั้งหมด)
- **ห้ามแก้โค้ดฝั่ง `iherk-pixcel` ให้เสียหาย:** เรียกใช้ `/Users/dev3/Documents/IHERK/iherk-pixcel/dist/` และ starter assets โดยตรง (ธีม Day ใช้การ remap สีใน memory ฝั่ง `iherk-hell-factory`)
- **เครือข่ายเฉพาะเครื่อง:** ผูกเซิร์ฟเวอร์กับ `127.0.0.1` เท่านั้น พอร์ตเริ่มต้น `7140` (ปรับได้ผ่าน `HELL_FACTORY_PORT`)
- **Hook ต้อง Fail-Silent เสมอ:** สคริปต์ hook ทุกตัวต้องจบภายใน `< 1 วินาที` และ `exit 0` เสมอโดยไม่มีข้อความ error แม้เซิร์ฟเวอร์ไม่ได้เปิดอยู่
- **ขอบเขตความปลอดภัยแต่งห้อง (Gemini-Only AI):** `/api/events` ห้ามแก้เฟอร์นิเจอร์/asset เด็ดขาด; `/api/architect/*` ต้องตรวจ `X-Architect-Token` (จาก `data/architect.token` สิทธิ์ `0600`) หรือ session cookie + `X-UI-Session` + localhost `Host`/`Origin`; `install-mcp` ห้ามแตะ config ของ Claude Code
- **พิกัดและภาพคมกริบ:** `64×32` isometric (`stepX = 32, stepY = 16, tileOverlapY = 0`), Canvas ใช้ `imageSmoothingEnabled = false` และ integer zoom (`1×–4×`), ไม่มีผนังสูงกั้นกลางระหว่างล็อก
- **นโยบาย Git:** ทุกคำสั่ง `git` ใช้ `-c include.path=/Users/dev3/.gitconfig-iherk` (ตัวตน `pakornpong <iherk.dev@gmail.com>`) และตั้ง repo-local `include.path` หลัง `git init`

---

## จุดเน้นตรวจสอบกรณีขอบ (Review Focus)

1. **ไฟล์เซฟ `data/office-state.json` เสียหายกลางคัน:** `OfficeStore.load()` ต้องกู้คืนจาก `data/office-state.json.bak` อัตโนมัติ ไม่ล่มและไม่ล้างออฟฟิศเดิม (ทดสอบใน **Task 1**)
2. **Gemini ปั้นไฟล์ `.pixcel.json` ผิดรูปแบบ (วัสดุไม่มีชื่อ หรือ voxel เกินขอบเขต):** `PixcelBridge.craftCustomAsset()` ต้องคืน error ที่อ่านเข้าใจง่ายโดยไม่ลบหรือทำให้ `custom-atlas` เดิมพัง (ทดสอบใน **Task 2**)
3. **Hook ยิงมารัวๆ หรือสลับลำดับ (`subagent_stop` ของ ID ที่ไม่มีอยู่, หรือ `tool_start` แทรกเข้ามาระหว่าง countdown ไปพักผ่อน):** `OfficeEngine` ต้องทำงานแบบ idempotent ยกเลิก timer พักผ่อนได้สะอาด และไม่ค้างพนักงานติดสถานะ `working` ตลอดกาล (ทดสอบใน **Task 4**)
4. **เว็บอื่น (CSRF) หรือสคริปต์ Claude hook พยายามเรียก `/api/architect/*`:** เซิร์ฟเวอร์ต้องปฏิเสธด้วย `401` หรือ `403` และสถานะเฟอร์นิเจอร์ต้องไม่เปลี่ยน (ทดสอบใน **Task 5**)
5. **เฟอร์นิเจอร์ถูกวางล้อมเป้าหมายหรือปิดทางเดิน:** ตัวตรวจวางเฟอร์ต้องกันการปิดทางเดิน/ล็อก และ A* pathfinder ฝั่ง client ต้องหาช่องที่เข้าใกล้เป้าหมายที่สุดแทนการค้างหรือเดินทะลุเฟอร์ (ทดสอบใน **Task 3** และ **Task 8**)

---

## โครงสร้างไฟล์ทั้งโปรเจค (File Structure)

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` — โครงโปรเจคและสคริปต์ build/test
- `src/shared/types.ts` — Zod schemas และ TypeScript types ใช้ร่วมกันทั้ง server, MCP และ client
- `src/server/store.ts` — ระบบเซฟ/โหลด `data/office-state.json` แบบ atomic + `.bak` recovery และจัดการ `data/architect.token` (`0600`)
- `src/server/pixcel-bridge.ts` — สะพานเชื่อม `iherk-pixcel` สร้าง `atlas-night`, `atlas-day` (remap สีใน memory) และ `custom-atlas` + 4-dir contact sheet
- `src/server/layout-engine.ts` — คำนวณผังแคมปัสไม่จำกัดล็อก, แปลงพิกัด `zone-local ↔ world`, ผนังขอบหลัง, compact ตอน archive และตรวจการวางเฟอร์
- `src/server/office-engine.ts` — ลอจิกหลักของออฟฟิศ (จอง Starter Bay 0, ขยายล็อกตามโปรเจค, ทีม Claude/Gemini + subagent, FSM 5 สถานะ, คำสั่ง Architect)
- `src/server/antigravity-watcher.ts` — ตัวอ่าน `transcript.jsonl` ของ Antigravity แบบ tail-read เปิดเป็นค่าเริ่มต้น + dedup กับ hook
- `src/server/demo-simulator.ts` — โหมดจำลองการทำงาน (Demo Mode) ที่ไม่ปนเปื้อนข้อมูลจริง
- `src/server/index.ts` — HTTP + WebSocket server (`127.0.0.1:7140`), auth middleware ของ Architect, telemetry endpoint
- `src/mcp/architect-server.ts` — Stdio MCP Server สำหรับ Gemini เท่านั้น (7 เครื่องมือแต่งห้องและปั้นเฟอร์)
- `src/cli/install-hooks.ts`, `src/cli/index.ts` — CLI (`start`, `mcp`, `build-assets`, `install-hooks`, `install-mcp`, `demo`)
- `assets/pixcel/props/*.pixcel.json`, `assets/pixcel/characters/*.pixcel.json` — เฟอร์นิเจอร์เสริม 6 ชิ้น + ตัวละคร 4 ทิศ 7 ท่าทาง (`agent-starter`, `agent-claude`, `agent-gemini`)
- `src/client/{atlas-loader,camera,iso-renderer,pathfinding,sim,decorate,hud,main}.ts` + `public/{index.html,style.css}` + `scripts/build-client.ts` — ตัวเกม Canvas 2D และ HUD
- `hooks/{claude-hook,gemini-cli-hook,antigravity-hook}.sh` — สคริปต์ hook แบบ fail-silent

---

### Task 1: โครงสร้างโปรเจค, Shared Schemas และระบบเซฟแบบ Atomic (`OfficeStore`)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/shared/types.ts`
- Create: `src/server/store.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: ไม่มี (Task เริ่มต้น)
- Produces:
  - จาก `src/shared/types.ts`: `Provider`, `VisualState`, `ToolCategory`, `Direction`, `ThemeMode`, `ZoneId`, `AgentTelemetryEvent`, `AgentTelemetryEventSchema`, `FurnitureInstance`, `FurnitureInstanceSchema`, `EmployeeRecord`, `ProjectBayRecord`, `CommonWingRecord`, `ActivityLogEntry`, `OfficeState`, `OfficeStateSchema`, `CatalogEntry`, `WsServerMessage`
  - จาก `src/server/store.ts`: `class OfficeStore { constructor(dataDir: string); load(): Promise<OfficeState | null>; save(state: OfficeState): Promise<void>; ensureArchitectToken(): Promise<string>; getArchitectTokenPath(): string }`

- [ ] **Step 1: ตั้งค่า Git และสร้างไฟล์ตั้งค่าโปรเจค**

รัน `git -c include.path=/Users/dev3/.gitconfig-iherk init` และตั้ง repo-local `git config --local include.path /Users/dev3/.gitconfig-iherk` จากนั้นสร้าง:
- `package.json` (`type: "module"`, `engines.node: ">=22.0.0"`, bin `hell-factory: "./dist/cli/index.js"`, deps: `zod`, `ws`, `@modelcontextprotocol/sdk`, `pngjs`; devDeps: `typescript`, `tsx`, `vitest`, `esbuild`, `@types/node`, `@types/ws`, `@types/pngjs`)
- `tsconfig.json` (`target: "ES2023"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `strict: true`, `outDir: "dist"`, `rootDir: "src"`, exclude `src/client` หรือแยก `tsconfig.client.json` สำหรับ DOM types)
- `vitest.config.ts` (include `tests/**/*.test.ts`)
- `.gitignore` (ละเว้น `node_modules/`, `dist/`, `data/`, `runtime-assets/`, `public/app.js`, `assets/pixcel/custom/`)
- รัน `export PATH="/opt/homebrew/bin:$PATH" && npm install`

- [ ] **Step 2: เขียน failing test สำหรับ Schema และ `OfficeStore` ใน `tests/store.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AgentTelemetryEventSchema, OfficeStateSchema } from "../src/shared/types.js";
import { OfficeStore } from "../src/server/store.js";

describe("OfficeStore & schemas", () => {
  it("validates telemetry events and strips oversized detail", () => {
    const parsed = AgentTelemetryEventSchema.parse({
      provider: "claude",
      source: "claude-code",
      sessionId: "s1",
      projectPath: "/tmp/proj-a",
      eventType: "tool_start",
      toolName: "Edit",
      detail: "x".repeat(120),
    });
    expect(parsed.detail?.length).toBeLessThanOrEqual(80);
  });

  it("saves atomically, recovers from corrupt primary using .bak, and creates 0600 architect token", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-store-"));
    const store = new OfficeStore(dir);
    const token = await store.ensureArchitectToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    const stat = await fs.stat(store.getArchitectTokenPath());
    expect(stat.mode & 0o777).toBe(0o600);

    const state1 = OfficeStateSchema.parse({ version: 1, theme: "night", bays: [], commonWings: [], employees: [], activityLog: [] });
    await store.save(state1);
    const state2 = { ...state1, theme: "day" as const };
    await store.save(state2);

    // จำลองไฟล์หลักพังระหว่างเขียน -> ต้องกู้คืนจาก .bak ได้
    await fs.writeFile(path.join(dir, "office-state.json"), "{corrupt json", "utf8");
    const recovered = await store.load();
    expect(recovered?.theme).toBe("night");
  });
});
```

- [ ] **Step 3: รัน test เพื่อยืนยันว่ายัง fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/store.test.ts`
Expected: FAIL เพราะยังไม่มี `src/shared/types.ts` และ `src/server/store.ts`

- [ ] **Step 4: สร้าง `src/shared/types.ts` และ `src/server/store.ts`**

- ใน `src/shared/types.ts`: นิยาม Zod schemas ตาม Spec Section 6.1–6.5 ได้แก่ `Direction` (`se|sw|nw|ne`), `Provider` (`claude|gemini`), `VisualState` (`assigning|working|teamwork|meeting|resting`), `ToolCategory` (`code|shell|search|error|idle`), `ZoneId` (string pattern `bay:<id>` หรือ `common:<row>`), `AgentTelemetryEventSchema` (ตัด `detail` ไม่เกิน 80 ตัวอักษร), `FurnitureInstanceSchema` (`id`, `zoneId`, `lx`, `ly`, `assetId`, `direction`, `layer`, `placedBy: "system"|"user"|"gemini"`), `EmployeeRecordSchema`, `ProjectBayRecordSchema` (`id`, `projectPath: string | null`, `displayName`, `accentColor`, `archived`, `deskSlots`, `furniture: FurnitureInstance[]`, `createdAt`, `lastActiveAt`), `CommonWingRecordSchema` (`row`, `zoneId`, `furniture: FurnitureInstance[]`), `OfficeStateSchema` (มี `version: 1`, `theme: "night"|"day"`, `bays`, `commonWings`, `employees`, `activityLog` cap 100 รายการ) และ `WsServerMessage`.
- ใน `src/server/store.ts`:
  - `save(state)`: copy ไฟล์เดิม (ถ้ามีและ valid) ไป `office-state.json.bak` แล้วเขียน `office-state.json.tmp` → `fs.rename` ทับ `office-state.json`
  - `load()`: อ่าน `office-state.json` และ parse ด้วย `OfficeStateSchema`; ถ้า JSON พังหรือ schema ผิด ให้ fallback อ่าน `office-state.json.bak`; ถ้าไม่มีทั้งคู่คืน `null`
  - `ensureArchitectToken()`: ถ้ายังไม่มี `data/architect.token` ให้สุ่ม `crypto.randomBytes(32).toString("hex")` และเขียนด้วย `mode: 0o600`

- [ ] **Step 5: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/store.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore docs/ src/shared/types.ts src/server/store.ts tests/store.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: scaffold project, shared schemas, and atomic office store"
```

---

### Task 2: สร้าง Voxel Assets เสริม + ตัวละคร 4 ทิศ 7 ท่าทาง และ `PixcelBridge`

**Files:**
- Create: `assets/pixcel/props/floor-lounge-rug.pixcel.json`
- Create: `assets/pixcel/props/divider-low-glass.pixcel.json`
- Create: `assets/pixcel/props/coffee-machine-bar.pixcel.json`
- Create: `assets/pixcel/props/sofa-lounge.pixcel.json`
- Create: `assets/pixcel/props/water-cooler.pixcel.json`
- Create: `assets/pixcel/props/bay-sign-post.pixcel.json`
- Create: `assets/pixcel/characters/agent-starter.pixcel.json`
- Create: `assets/pixcel/characters/agent-claude.pixcel.json`
- Create: `assets/pixcel/characters/agent-gemini.pixcel.json`
- Create: `src/server/pixcel-bridge.ts`
- Test: `tests/pixcel-bridge.test.ts`

**Interfaces:**
- Consumes: `CatalogEntry` จาก `src/shared/types.ts`, และ `compileAsset`, `renderAssetFrame`, `packSpriteAtlas`, `encodePNG`, `PixcelAssetSchema` จาก `/Users/dev3/Documents/IHERK/iherk-pixcel/dist/core/`
- Produces:
  - จาก `src/server/pixcel-bridge.ts`:
    - `export const CHARACTER_CLIPS = ["idle_0","idle_1","walk_0","walk_1","walk_2","walk_3","sit_type_0","sit_type_1","talk_0","talk_1","assign_0","assign_1","rest_coffee_0","rest_coffee_1","rest_sleep_0","rest_sleep_1"] as const`
    - `export function remapAssetToDayTheme(asset: PixcelAsset): PixcelAsset`
    - `export class PixcelBridge { constructor(opts: { pixcelRoot: string; projectRoot: string; runtimeOutDir: string }); buildCoreAtlases(): Promise<{ nightAtlasPath: string; dayAtlasPath: string; catalog: CatalogEntry[] }>; rebuildCustomAtlas(): Promise<{ atlasPath: string; catalog: CatalogEntry[] }>; craftCustomAsset(rawAsset: unknown): Promise<{ assetId: string; catalogEntry: CatalogEntry; contactSheetPng: Buffer; customAtlasPath: string }>; listCatalog(): Promise<CatalogEntry[]> }`

- [ ] **Step 1: เขียน failing test ใน `tests/pixcel-bridge.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CHARACTER_CLIPS, PixcelBridge } from "../src/server/pixcel-bridge.js";

describe("PixcelBridge & Hell Factory voxel assets", () => {
  it("compiles all 12 starter assets, 6 props, and 3 animated characters into night and day atlases", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-atlas-"));
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: process.cwd(),
      runtimeOutDir: outDir,
    });
    const res = await bridge.buildCoreAtlases();
    const nightAtlas = JSON.parse(await fs.readFile(res.nightAtlasPath, "utf8"));
    const dayAtlas = JSON.parse(await fs.readFile(res.dayAtlasPath, "utf8"));

    for (const propId of ["floor-lounge-rug", "divider-low-glass", "coffee-machine-bar", "sofa-lounge", "water-cooler", "bay-sign-post"]) {
      expect(nightAtlas.frames[`${propId}/se/default`] ?? nightAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
      expect(dayAtlas.frames[`${propId}/se/default`] ?? dayAtlas.frames[`${propId}/se/idle_0`]).toBeDefined();
    }
    for (const charId of ["agent-starter", "agent-claude", "agent-gemini"]) {
      for (const dir of ["se", "sw", "nw", "ne"]) {
        for (const clip of CHARACTER_CLIPS) {
          expect(nightAtlas.frames[`${charId}/${dir}/${clip}`]).toBeDefined();
        }
      }
    }
    expect(nightAtlas.meta.emissiveImage).toBe("atlas-night_emissive.png");
  });

  it("crafts custom asset with 4-dir contact sheet and preserves existing custom atlas on invalid input", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hf-custom-"));
    await fs.mkdir(path.join(tmpRoot, "assets/pixcel/custom"), { recursive: true });
    const outDir = path.join(tmpRoot, "runtime-assets");
    const bridge = new PixcelBridge({
      pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel",
      projectRoot: tmpRoot,
      runtimeOutDir: outDir,
    });
    const valid = await bridge.craftCustomAsset({
      schemaVersion: 1, id: "custom-lamp", category: "decor", layer: "object",
      outlineMode: "silhouette", tilePreset: "64x32", voxelsPerTile: 32, footprintTiles: [1, 1],
      palette: "office-night",
      materials: { base: { color: "#334155", kind: "metal" }, bulb: { color: "#facc15", kind: "emissive", glowRadius: 2, glowIntensity: 0.6 } },
      ops: [{ op: "box", from: [12, 12, 0], to: [19, 19, 14], material: "base" }, { op: "box", from: [13, 13, 15], to: [18, 18, 19], material: "bulb" }],
      decals: [],
    });
    expect(valid.contactSheetPng.subarray(0, 4).toString("hex")).toBe("89504e47");
    const beforeAtlas = await fs.readFile(valid.customAtlasPath, "utf8");

    await expect(bridge.craftCustomAsset({ id: "bad-lamp", ops: [{ op: "box", from: [0, 0, 0], to: [5, 5, 5], material: "missing_mat" }], materials: {} })).rejects.toThrow();
    expect(await fs.readFile(valid.customAtlasPath, "utf8")).toBe(beforeAtlas);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/pixcel-bridge.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้างไฟล์ `.pixcel.json` ทั้ง 6 เฟอร์นิเจอร์เสริม และ 3 ตัวละครอนิเมชั่น**

- **6 Props (`assets/pixcel/props/`):** ใช้ `tilePreset: "64x32"`, `voxelsPerTile: 32` ทุกชิ้น:
  - `floor-lounge-rug` (`1×1`, `layer: "floor"`, `outlineMode: "none"`, พรมโทนอุ่นมีขอบลวดลาย)
  - `divider-low-glass` (`1×1`, สูง `18` voxels — ครึ่งเอว ไม่บังโต๊ะ/ตัวละคร, กระจก `glass` ขอบโลหะ)
  - `coffee-machine-bar` (`2×1`, เคาน์เตอร์ไม้ + เครื่องชงเอสเพรสโซมีไฟ LED emissive + 2 เฟรมควันกาแฟ `idle_0..1`)
  - `sofa-lounge` (`2×1`, โซฟาเบาะนุ่มสำหรับนั่งพัก/งีบ)
  - `water-cooler` (`1×1`, ตู้กดน้ำ + ถังน้ำ `glass`)
  - `bay-sign-post` (`1×1`, เสาป้ายชื่อทีมมีแถบไฟ emissive)
- **3 Animated Characters (`assets/pixcel/characters/`):** `1×1`, `voxelsPerTile: 32`, สูงประมาณ `26` voxels สัดส่วนเข้ากับ `chair-office-swivel` และ `desk-dev-dual` (แบ่ง `parts`: `head`, `torso`, `arm_l`, `arm_r`, `leg_l`, `leg_r`, `prop`) พร้อมครบ 16 เฟรมตาม `CHARACTER_CLIPS` ด้วย `partTransforms.translate` + `frame.ops` (เช่น แก้วกาแฟใน `rest_coffee_*`, คลิปบอร์ดใน `assign_*`, ท่านั่งพิมพ์ใน `sit_type_*`):
  - `agent-starter` (ฮู้ดสีเทา-สเลตกลางๆ)
  - `agent-claude` (เสื้อฮู้ดสีส้มดินเผา/คอรัล `#d97757` + ป้ายไฟอุ่น)
  - `agent-gemini` (แจ็กเก็ตสีน้ำเงิน-คราม `#4f46e5` + ป้ายไฟฟ้าสว่าง `#38bdf8`)

- [ ] **Step 4: สร้าง `src/server/pixcel-bridge.ts`**

- โหลด core functions จาก `/Users/dev3/Documents/IHERK/iherk-pixcel/dist/core/` (`schema.js`, `dsl-compiler.js`, `postprocess.js`, `exporters/atlas.js`, `exporters/png.js`, `palette.js`)
- `remapAssetToDayTheme(asset)`: clone asset ใน memory แล้ว remap hex โทนมืดของ starter/props เป็นโทนกลางวันสว่างสดใสสไตล์ *Isometric Interiors* (ผนังสเลต → ปูนครีมอบอุ่น `#dcd6c8`, พื้นไม้เข้ม → ไม้โอ๊คสว่าง `#a67c52`, กระจกหน้าต่างกลางคืน → ฟ้าสว่าง `#7dd3fc`) โดยไม่แก้ไฟล์ใน `iherk-pixcel`
- สร้าง teammate variants (`agent-claude-v1..v3`, `agent-gemini-v1..v3`) ใน memory ตอน pack ด้วยการสลับสีผม/หมวก/แถบเสื้อเล็กน้อยเพื่อให้เพื่อนร่วมทีมในล็อกเดียวกันดูต่างกัน
- `craftCustomAsset(rawAsset)`: validate ด้วย `PixcelAssetSchema.parse`, ทดลอง `compileAsset` + `renderAssetFrame` ครบ 4 ทิศ (สร้าง 4-direction contact sheet PNG buffer) ให้ผ่านก่อน แล้วค่อยเขียนลง `assets/pixcel/custom/<id>.pixcel.json` และเรียก `rebuildCustomAtlas()` แบบ atomic (ไม่กระทบของเดิมถ้า validate/compile พัง)

- [ ] **Step 5: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/pixcel-bridge.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add assets/pixcel/ src/server/pixcel-bridge.ts tests/pixcel-bridge.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add expansion props, animated voxel characters, and pixcel atlas bridge"
```

---

### Task 3: ผังแคมปัสไม่จำกัดล็อก, ระบบพิกัด Zone-Local และตัวตรวจการวางเฟอร์ (`layout-engine.ts`)

**Files:**
- Create: `src/server/layout-engine.ts`
- Test: `tests/layout-engine.test.ts`

**Interfaces:**
- Consumes: `ProjectBayRecord`, `CommonWingRecord`, `FurnitureInstance`, `CatalogEntry`, `Direction` จาก `src/shared/types.ts`
- Produces:
  - จาก `src/server/layout-engine.ts`:
    - `export const ZONE_SIZE = 6; export const MODULE_PITCH_X = 7; export const MODULE_PITCH_Y = 8;` (`6×6` พื้นที่ในโซน + ทางเดิน 1 ช่องแนวนอนและ 2 ช่องระหว่างแถว)
    - `export interface ZoneBounds { zoneId: string; kind: "common" | "bay"; bayId?: string; row: number; col: number; originX: number; originY: number; width: number; height: number }`
    - `export interface ComputedCampus { widthTiles: number; depthTiles: number; zones: ZoneBounds[]; floors: Array<{ tx: number; ty: number; assetId: string; direction: Direction }>; walls: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" | "corner" }>; wallDecor: Array<{ tx: number; ty: number; assetId: string; edge: "nw" | "ne" }>; worldFurniture: Array<FurnitureInstance & { tx: number; ty: number; footprintTiles: [number, number] }> }`
    - `export function createDefaultCommonWing(row: number): CommonWingRecord`
    - `export function createDefaultBayFurniture(bayId: string): FurnitureInstance[]`
    - `export function computeCampusLayout(bays: ProjectBayRecord[], commonWings: CommonWingRecord[], catalogById: Map<string, CatalogEntry>): ComputedCampus`
    - `export function resolveWorldToZone(campus: ComputedCampus, tx: number, ty: number): { zoneId: string; lx: number; ly: number } | null`
    - `export function validateFurniturePlacement(campus: ComputedCampus, existingInZone: FurnitureInstance[], candidate: { zoneId: string; lx: number; ly: number; assetId: string; direction: Direction; ignoreInstanceId?: string }, catalogById: Map<string, CatalogEntry>): { ok: true } | { ok: false; reason: string }`

- [ ] **Step 1: เขียน failing test ใน `tests/layout-engine.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { computeCampusLayout, createDefaultBayFurniture, createDefaultCommonWing, resolveWorldToZone, validateFurniturePlacement } from "../src/server/layout-engine.js";
import type { CatalogEntry, ProjectBayRecord } from "../src/shared/types.js";

const mockCatalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
  ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["server-rack", { id: "server-rack", category: "tech", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bookshelf-wood", { id: "bookshelf-wood", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["bay-sign-post", { id: "bay-sign-post", category: "decor", layer: "object", footprintTiles: [1, 1], source: "prop" }],
]);

function makeBay(i: number, archived = false): ProjectBayRecord {
  return {
    id: `bay-${i}`, projectPath: `/p/${i}`, displayName: `proj-${i}`, accentColor: "#38bdf8",
    archived, deskSlots: 2, furniture: createDefaultBayFurniture(`bay-${i}`), createdAt: i, lastActiveAt: i,
  };
}

describe("layout-engine", () => {
  it("lays out 25 active bays with periodic common wings, zero zone overlap, and continuous perimeter walls", () => {
    const bays = Array.from({ length: 25 }, (_, i) => makeBay(i));
    const rows = Math.ceil(25 / 3);
    const wings = Array.from({ length: rows }, (_, r) => createDefaultCommonWing(r));
    const campus = computeCampusLayout(bays, wings, mockCatalog);

    expect(campus.zones.filter((z) => z.kind === "bay")).toHaveLength(25);
    expect(campus.zones.filter((z) => z.kind === "common")).toHaveLength(rows);
    expect(campus.walls.some((w) => w.edge === "corner" && w.tx === 0 && w.ty === 0)).toBe(true);
    // ตรวจว่าทุก zone ไม่ซ้อนทับกัน
    for (let i = 0; i < campus.zones.length; i++) {
      for (let j = i + 1; j < campus.zones.length; j++) {
        const a = campus.zones[i], b = campus.zones[j];
        const overlap = a.originX < b.originX + b.width && a.originX + a.width > b.originX && a.originY < b.originY + b.height && a.originY + a.height > b.originY;
        expect(overlap).toBe(false);
      }
    }
  });

  it("compacts active bays on archive without moving common wing furniture", () => {
    const bays = [makeBay(0), makeBay(1, true), makeBay(2)];
    const wings = [createDefaultCommonWing(0)];
    const campus = computeCampusLayout(bays, wings, mockCatalog);
    const activeBays = campus.zones.filter((z) => z.kind === "bay");
    expect(activeBays.map((z) => z.bayId)).toEqual(["bay-0", "bay-2"]);
    expect(activeBays[1].col).toBe(2);
    expect(campus.zones.find((z) => z.zoneId === "common:0")?.originX).toBe(0);
  });

  it("rejects furniture straddling zone borders, colliding with existing items, or blocking zone entrance", () => {
    const bays = [makeBay(0)];
    const wings = [createDefaultCommonWing(0)];
    const campus = computeCampusLayout(bays, wings, mockCatalog);
    // พื้นที่ทางเดินระหว่างโซนต้อง resolve เป็น null
    expect(resolveWorldToZone(campus, 6, 0)).toBeNull();
    // วางโต๊ะ 2x1 ล้นขอบขวาของโซน (lx=5, width=2) ต้อง fail
    const straddle = validateFurniturePlacement(campus, bays[0].furniture, { zoneId: "bay:bay-0", lx: 5, ly: 3, assetId: "desk-dev-dual", direction: "se" }, mockCatalog);
    expect(straddle.ok).toBe(false);
    // วางทับโต๊ะเดิมต้อง fail
    const first = bays[0].furniture[0];
    const overlap = validateFurniturePlacement(campus, bays[0].furniture, { zoneId: "bay:bay-0", lx: first.lx, ly: first.ly, assetId: "plant-potted", direction: "se" }, mockCatalog);
    expect(overlap.ok).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/layout-engine.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/server/layout-engine.ts`**

- จัดวางโซนเป็นแถวละ 4 โมดูล: `col = 0` คือ `common:<row>` (`originX = 0`), `col = 1..3` คือล็อกโปรเจคที่ยังไม่ archived (`originX = col * 7`), `originY = row * 8` (เว้นทางเดิน 1 ช่องคั่นคอลัมน์และ 2 ช่องคั่นแถว)
- ปู `floor-wood-plank` เต็มพื้นแคมปัส (`0..widthTiles-1`, `0..depthTiles-1`) โดยใช้ `floor-lounge-rug` ใต้โซนพักผ่อนใน Common Wing
- สร้างผนังสูงเฉพาะขอบหลัง `ty === 0` (edge `"nw"`, สลับ `wall-slate-plain` / `wall-night-window`) และ `tx === 0` (edge `"ne"`), มุม `(0, 0)` ใช้ `wall-corner-pillar`; ระหว่างล็อกใช้ `divider-low-glass` เฉพาะจุดที่ไม่ขวางทางเดินเข้าออก
- `validateFurniturePlacement`: คำนวณ rotated footprint ตาม `direction` (`se`/`nw` → `[w, d]`, `sw`/`ne` → `[d, w]`), ตรวจขอบเขต `0 <= lx`, `lx + fw <= 6`, `0 <= ly`, `ly + fd <= 6`, ห้ามทับเฟอร์อื่นในโซน, และห้ามปิดช่องทางเดินเข้าล็อก (`lx === 2 || lx === 3` ที่ `ly === 5` ต้องเปิดไว้อย่างน้อย 1 ช่อง)

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/layout-engine.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/server/layout-engine.ts tests/layout-engine.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: implement unbounded campus layout and zone-local furniture validation"
```

---

### Task 4: ระบบจัดการโลกออฟฟิศ — จัดกลุ่มทีม, จองล็อกแรก และ FSM 5 สถานะ (`office-engine.ts`)

**Files:**
- Create: `src/server/office-engine.ts`
- Test: `tests/office-engine.test.ts`

**Interfaces:**
- Consumes: `OfficeStore` (Task 1), `computeCampusLayout`, `createDefaultBayFurniture`, `createDefaultCommonWing`, `resolveWorldToZone`, `validateFurniturePlacement` (Task 3), types จาก `src/shared/types.ts`
- Produces:
  - จาก `src/server/office-engine.ts`:
    - `export class OfficeEngine extends EventEmitter { constructor(opts: { store: OfficeStore; catalogById: Map<string, CatalogEntry>; now?: () => number; restCooldownMs?: number; assignDurationMs?: number }); init(): Promise<void>; getSnapshot(): { state: OfficeState; campus: ComputedCampus }; ingestEvent(ev: AgentTelemetryEvent): Promise<void>; tick(): Promise<void>; placeFurniture(input: { zoneId?: string; tx?: number; ty?: number; lx?: number; ly?: number; assetId: string; direction: Direction; placedBy: "user" | "gemini" }): Promise<FurnitureInstance>; moveFurniture(instanceId: string, input: { zoneId?: string; tx?: number; ty?: number; lx?: number; ly?: number; direction?: Direction }): Promise<FurnitureInstance>; removeFurniture(instanceId: string): Promise<void>; manageBay(bayId: string, patch: { displayName?: string; accentColor?: string; archived?: boolean }): Promise<ProjectBayRecord>; setTheme(theme: ThemeMode): Promise<void>; updateCatalog(catalog: CatalogEntry[]): void }`
    - Events emitted: `"snapshot"`, `"activity"`, `"bay_expanded"`

- [ ] **Step 1: เขียน failing test ใน `tests/office-engine.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { OfficeStore } from "../src/server/store.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import type { CatalogEntry } from "../src/shared/types.js";

const catalog = new Map<string, CatalogEntry>([
  ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
  ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
  ["plant-potted", { id: "plant-potted", category: "decor", layer: "object", footprintTiles: [1, 1], source: "starter" }],
]);

describe("OfficeEngine lifecycle & 5-state FSM", () => {
  it("starts with 1 starter employee, claims Bay 0 on first project, expands on second, and persists across restart", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-eng-"));
    let clock = 1000;
    const store = new OfficeStore(dir);
    const engine = new OfficeEngine({ store, catalogById: catalog, now: () => clock, restCooldownMs: 15_000, assignDurationMs: 2_500 });
    await engine.init();

    let snap = engine.getSnapshot();
    expect(snap.state.bays).toHaveLength(1);
    expect(snap.state.bays[0].projectPath).toBeNull();
    expect(snap.state.employees).toHaveLength(1);
    expect(snap.state.employees[0].spriteId).toBe("agent-starter");

    // โปรเจคแรก claim Bay 0
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "prompt_submit", detail: "Build API" });
    snap = engine.getSnapshot();
    expect(snap.state.bays).toHaveLength(1);
    expect(snap.state.bays[0].projectPath).toBe("/work/alpha");
    expect(snap.state.employees[0].spriteId).toBe("agent-claude");
    expect(snap.state.employees[0].visualState).toBe("assigning");

    // โปรเจคที่ 2 ขยายล็อกใหม่
    await engine.ingestEvent({ provider: "gemini", source: "antigravity", sessionId: "g1", projectPath: "/work/beta", eventType: "tool_start", toolName: "edit_file" });
    expect(engine.getSnapshot().state.bays).toHaveLength(2);

    // Restart ใหม่ต้องโหลดกลับมาครบ
    const engine2 = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => clock });
    await engine2.init();
    expect(engine2.getSnapshot().state.bays.map((b) => b.projectPath)).toEqual(["/work/alpha", "/work/beta"]);
  });

  it("drives all 5 animations, upgrades 2+ active bay members to teamwork, cleans ephemeral subagents, and handles out-of-order events", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-fsm-"));
    let clock = 10_000;
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog, now: () => clock, restCooldownMs: 15_000, assignDurationMs: 2_500 });
    await engine.init();

    // working + tool error tint
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "tool_start", toolName: "Edit" });
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("working");
    expect(engine.getSnapshot().state.employees[0].toolCategory).toBe("code");

    // subagent เข้าร่วมล็อกเดียวกัน -> ทั้งคู่ขึ้นเป็น teamwork
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-1", parentAgentId: "s1", agentRole: "Research", projectPath: "/work/alpha", eventType: "subagent_start" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-1", projectPath: "/work/alpha", eventType: "tool_start", toolName: "Read" });
    const team = engine.getSnapshot().state.employees.filter((e) => e.bayId === engine.getSnapshot().state.bays[0].id);
    expect(team).toHaveLength(2);
    expect(team.every((e) => e.visualState === "teamwork")).toBe(true);

    // waiting_user -> meeting
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "waiting_user", detail: "Approve plan?" });
    expect(engine.getSnapshot().state.employees.find((e) => !e.isEphemeral)?.visualState).toBe("meeting");

    // subagent_stop เคลียร์พนักงานชั่วคราว + idempotent สำหรับ ID ที่ไม่มี
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "sub-1", projectPath: "/work/alpha", eventType: "subagent_stop" });
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", agentId: "unknown-sub", projectPath: "/work/alpha", eventType: "subagent_stop" });
    expect(engine.getSnapshot().state.employees).toHaveLength(1);

    // turn_stop + 15s grace cooldown -> resting (แต่ถ้ามี tool_start แทรกก่อนครบ 15s ต้องยกเลิก cooldown)
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "turn_stop" });
    clock += 5_000;
    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "tool_start", toolName: "Bash" });
    await engine.tick();
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("working");

    await engine.ingestEvent({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/alpha", eventType: "turn_stop" });
    clock += 16_000;
    await engine.tick();
    expect(engine.getSnapshot().state.employees[0].visualState).toBe("resting");
  });

  it("auto-unarchives an archived bay when a new event arrives for that project", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-arch-"));
    const engine = new OfficeEngine({ store: new OfficeStore(dir), catalogById: catalog });
    await engine.init();
    await engine.ingestEvent({ provider: "gemini", source: "gemini-cli", sessionId: "g1", projectPath: "/work/old", eventType: "tool_start", toolName: "Read" });
    const bayId = engine.getSnapshot().state.bays[0].id;
    await engine.manageBay(bayId, { archived: true });
    expect(engine.getSnapshot().state.bays[0].archived).toBe(true);

    await engine.ingestEvent({ provider: "gemini", source: "gemini-cli", sessionId: "g2", projectPath: "/work/old", eventType: "prompt_submit" });
    expect(engine.getSnapshot().state.bays[0].archived).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/office-engine.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/server/office-engine.ts`**

- Normalize `projectPath` ด้วย `path.resolve` (ตัด trailing slash) เพื่อไม่ให้ `/a/b` กับ `/a/b/` แตกเป็นคนละล็อก
- `init()`: โหลดจาก `OfficeStore`; ถ้าว่างให้สร้าง `common:0` + Starter Bay 0 (`projectPath: null`) + พนักงานเริ่มต้น 1 คน (`spriteId: "agent-starter"`, `visualState: "resting"`)
- `ingestEvent(ev)`:
  - หา bay ตาม `projectPath` (ถ้าไม่มีและ Bay 0 ยัง `projectPath === null` ให้ claim Bay 0; ไม่งั้นสร้าง bay ใหม่ + สร้าง `common:<row>` ถ้าเปิดแถวใหม่ + auto-unarchive ถ้าถูก archive อยู่)
  - จัดการพนักงาน: หลัก 1 คนต่อ `(bayId, provider)` (ถาวร), ถ้าเป็น `agentId` ของ subagent หรือ session ขนานคนที่ 2+ ให้สร้าง ephemeral teammate พร้อมหมุน variant `v1..v3` และขยาย `deskSlots` สูงสุด 4 โต๊ะถ้าทีมเกิน 2 คน
  - Classification: `prompt_submit` / `subagent_start` → `assigning` (ตั้ง `assignUntil = now + assignDurationMs`); `tool_start` → `working` + จำแนก `toolCategory` (`Edit|Write|edit_file|write_file` → `code`, `Bash|run_command` → `shell`, `Read|Grep|Glob|read_file|search_web` → `search`, `tool_error` → `error`); `waiting_user` หรือ tool กลุ่ม `swarm|ask_question` → `meeting`; `turn_stop`/`session_end` → ตั้ง `restAt = now + restCooldownMs` (และถ้า inactivity เกิน 120 วินาทีโดยไม่มี `turn_stop` ให้ `tick()` ปรับเป็น `resting` อัตโนมัติกัน zombie!)
  - Teamwork pass: หลังอัปเดตสถานะ ตรวจทุก bay — ถ้ามีพนักงานที่อยู่ใน `working`/`teamwork` ≥ 2 คน ให้ยกระดับทุกคนที่กำลังทำงานใน bay นั้นเป็น `teamwork`
- Architect methods (`placeFurniture`, `moveFurniture`, `removeFurniture`, `manageBay`, `setTheme`): เรียก `validateFurniturePlacement` ก่อนเสมอ บันทึกผ่าน `store.save` และ emit `"snapshot"`

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/office-engine.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/server/office-engine.ts tests/office-engine.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: implement office world engine, team roster, and 5-state FSM"
```

---

### Task 5: HTTP + WebSocket Server, ขอบเขตสิทธิ์ Architect และ `AntigravityWatcher`

**Files:**
- Create: `src/server/antigravity-watcher.ts`
- Create: `src/server/index.ts`
- Test: `tests/server-security.test.ts`

**Interfaces:**
- Consumes: `OfficeEngine` (Task 4), `PixcelBridge` (Task 2), `OfficeStore` (Task 1), `DemoSimulator` (optional hook-in จาก Task 8)
- Produces:
  - จาก `src/server/antigravity-watcher.ts`: `export class AntigravityWatcher { constructor(opts: { brainDir: string; onEvent: (ev: AgentTelemetryEvent) => Promise<void> | void; pollMs?: number }); start(): void; stop(): void; pollOnce(): Promise<void>; markHookSeen(conversationId: string): void }`
  - จาก `src/server/index.ts`: `export interface HellFactoryServer { port: number; url: string; close(): Promise<void>; broadcastAtlasUpdated(): void }` และ `export async function createHellFactoryServer(opts: { host?: string; port?: number; engine: OfficeEngine; store: OfficeStore; pixcelBridge: PixcelBridge; publicDir: string; runtimeAssetsDir: string; watchAntigravity?: boolean; brainDir?: string }): Promise<HellFactoryServer>`

- [ ] **Step 1: เขียน failing test ใน `tests/server-security.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { OfficeStore } from "../src/server/store.js";
import { OfficeEngine } from "../src/server/office-engine.js";
import { PixcelBridge } from "../src/server/pixcel-bridge.js";
import { createHellFactoryServer } from "../src/server/index.js";
import { AntigravityWatcher } from "../src/server/antigravity-watcher.js";

describe("HTTP/WS server, Architect auth boundary & AntigravityWatcher", () => {
  it("accepts telemetry on /api/events and blocks unauthenticated or cross-origin /api/architect/* requests", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-srv-"));
    const pubDir = path.join(dir, "public");
    const runDir = path.join(dir, "runtime");
    await fs.mkdir(pubDir, { recursive: true });
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(pubDir, "index.html"), "<html><head><!--UI_SESSION--></head><body></body></html>");

    const store = new OfficeStore(dir);
    const token = await store.ensureArchitectToken();
    const bridge = new PixcelBridge({ pixcelRoot: "/Users/dev3/Documents/IHERK/iherk-pixcel", projectRoot: process.cwd(), runtimeOutDir: runDir });
    const catalog = new Map([["plant-potted", { id: "plant-potted", category: "decor", layer: "object" as const, footprintTiles: [1, 1] as [number, number], source: "starter" as const }]]);
    const engine = new OfficeEngine({ store, catalogById: catalog });
    await engine.init();

    const srv = await createHellFactoryServer({ port: 0, engine, store, pixcelBridge: bridge, publicDir: pubDir, runtimeAssetsDir: runDir, watchAntigravity: false });
    try {
      // Telemetry ผ่านได้
      const evRes = await fetch(`${srv.url}/api/events`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "claude", source: "claude-code", sessionId: "s1", projectPath: "/work/a", eventType: "tool_start", toolName: "Edit" }),
      });
      expect(evRes.status).toBe(200);

      // เรียก /api/architect/furniture โดยไม่มี token -> 401
      const noAuth = await fetch(`${srv.url}/api/architect/furniture`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: "common:0", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" }),
      });
      expect(noAuth.status).toBe(401);

      // Origin แปลกปลอม (CSRF) แม้มี cookie -> 403
      const pageRes = await fetch(`${srv.url}/`);
      const cookie = pageRes.headers.get("set-cookie")?.split(";")[0] ?? "";
      const html = await pageRes.text();
      const uiToken = html.match(/window\.__UI_SESSION__\s*=\s*"([^"]+)"/)?.[1] ?? "";
      expect(uiToken.length).toBeGreaterThan(10);

      const csrfRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie, "X-UI-Session": uiToken, Origin: "https://evil.example" },
        body: JSON.stringify({ theme: "day" }),
      });
      expect(csrfRes.status).toBe(403);

      // ผ่านได้ทั้งทาง X-Architect-Token (Gemini MCP) และ localhost browser session
      const mcpRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Architect-Token": token },
        body: JSON.stringify({ theme: "day" }),
      });
      expect(mcpRes.status).toBe(200);

      const uiRes = await fetch(`${srv.url}/api/architect/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie, "X-UI-Session": uiToken, Origin: srv.url },
        body: JSON.stringify({ theme: "night" }),
      });
      expect(uiRes.status).toBe(200);
    } finally {
      await srv.close();
    }
  });

  it("tails Antigravity transcript.jsonl incrementally and deduplicates hook-seen conversations", async () => {
    const brain = await fs.mkdtemp(path.join(os.tmpdir(), "hf-agy-"));
    const convLogDir = path.join(brain, "conv-1", ".system_generated", "logs");
    await fs.mkdir(convLogDir, { recursive: true });
    const logPath = path.join(convLogDir, "transcript.jsonl");

    const received: unknown[] = [];
    const watcher = new AntigravityWatcher({ brainDir: brain, onEvent: (e) => { received.push(e); } });
    await fs.writeFile(logPath, JSON.stringify({ step_index: 0, type: "USER_INPUT", content: "hi", created_at: new Date().toISOString() }) + "\n");
    await watcher.pollOnce();
    await fs.appendFile(logPath, JSON.stringify({ step_index: 1, type: "PLANNER_RESPONSE", tool_calls: [{ name: "edit_file", args: { Path: "/work/demo/a.ts" } }], created_at: new Date().toISOString() }) + "\n");
    await watcher.pollOnce();
    expect(received.length).toBeGreaterThanOrEqual(1);

    // ถ้า hook ส่ง conv-1 มาแล้ว watcher ต้องข้ามช่วง dedup
    const countBefore = received.length;
    watcher.markHookSeen("conv-1");
    await fs.appendFile(logPath, JSON.stringify({ step_index: 2, type: "PLANNER_RESPONSE", tool_calls: [{ name: "run_command" }], created_at: new Date().toISOString() }) + "\n");
    await watcher.pollOnce();
    expect(received.length).toBe(countBefore);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/server-security.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/server/antigravity-watcher.ts` และ `src/server/index.ts`**

- `antigravity-watcher.ts`: สแกน `<brainDir>/*/.system_generated/logs/transcript.jsonl` เฉพาะไฟล์ที่ mtime ใหม่กว่า 5 นาที เก็บ `byteOffset` ต่อไฟล์เพื่อ tail-read เฉพาะบรรทัดที่เพิ่มใหม่ (ไม่โหลดไฟล์เก่าซ้ำ), สกัด `projectPath` จาก path ใน tool args หรือ `workspacePaths` (fallback เป็น `process.cwd()` / `"antigravity-workspace"`), แปลง `USER_INPUT` → `prompt_submit`, `PLANNER_RESPONSE` ที่มี `tool_calls` → `tool_start` (หรือ `subagent_start` เมื่อเจอ `invoke_subagent`/`swarm`), และข้ามการยิงซ้ำภายใน 30 วินาทีถ้า `markHookSeen(conversationId)` ถูกเรียกจาก hook
- `src/server/index.ts`:
  - ผูก `http.createServer` กับ `host = "127.0.0.1"`, `port = opts.port ?? 7140` + `WebSocketServer({ server, path: "/ws" })`
  - `GET /`: สุ่ม/ใช้ ephemeral UI session token ใน memory ตั้ง header `Set-Cookie: hf_ui_session=<token>; HttpOnly; SameSite=Strict; Path=/` และแทนที่ `<!--UI_SESSION-->` ใน `index.html` ด้วย `<script>window.__UI_SESSION__="<token>";</script>`
  - Middleware `requireArchitectAuth`:
    1. ถ้ามี `X-Architect-Token` และ `timingSafeEqual` ตรงกับ `architectToken` → ผ่าน
    2. ไม่งั้นตรวจ `Origin` (ถ้าส่งมาต้องเป็น `http://127.0.0.1:<port>` หรือ `http://localhost:<port>`, ถ้าไม่ใช่คืน `403`) + ตรวจ `hf_ui_session` cookie ตรงกับ `X-UI-Session` header และตรงกับ session token ของเซิร์ฟเวอร์; ถ้าไม่ผ่านคืน `401`
  - Endpoint `/api/architect/*`: `POST /furniture`, `PATCH /furniture/:id`, `DELETE /furniture/:id`, `POST /assets` (เรียก `pixcelBridge.craftCustomAsset` + `engine.updateCatalog` + `broadcastAtlasUpdated()`), `PATCH /bays/:id`, `PATCH /theme`
  - Periodic tick ทุก `1000ms` เรียก `engine.tick()` และปิด interval อย่างสะอาดใน `close()`

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/server-security.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/server/antigravity-watcher.ts src/server/index.ts tests/server-security.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add HTTP/WS server, strict Architect auth boundary, and Antigravity watcher"
```

---

### Task 6: Gemini-Only Office Architect MCP Server (`architect-server.ts`)

**Files:**
- Create: `src/mcp/architect-server.ts`
- Test: `tests/mcp-architect.test.ts`

**Interfaces:**
- Consumes: HTTP API ของ `src/server/index.ts` (ผ่าน `X-Architect-Token`), `OfficeStore`, `OfficeEngine`, `PixcelBridge` (fallback เมื่อเซิร์ฟเวอร์ยังไม่เปิด)
- Produces:
  - จาก `src/mcp/architect-server.ts`: `export function createArchitectMcpServer(opts: { serverUrl: string; dataDir: string; pixcelRoot: string; projectRoot: string; runtimeOutDir: string }): McpServer` และ `export async function startArchitectMcpServer(opts): Promise<void>`
  - เครื่องมือ MCP 7 ตัว: `get_office_state`, `list_furniture_catalog`, `place_furniture`, `move_furniture`, `remove_furniture`, `craft_furniture_asset`, `manage_bay`

- [ ] **Step 1: เขียน failing test ใน `tests/mcp-architect.test.ts`**

ทดสอบแบบ end-to-end ผ่าน `InMemoryTransport` (หรือ stdio client/server ของ `@modelcontextprotocol/sdk`) เชื่อมกับ `HellFactoryServer` ที่รันบนพอร์ตสุ่ม + `WebSocket` client รอฟัง:
- เรียก `craft_furniture_asset` → ได้คืน `assetId` + image content block (`image/png` base64) และฝั่ง WebSocket ได้รับ message `type: "atlas:updated"`
- เรียก `place_furniture` วางของที่เพิ่งปั้นใน `common:0` → สำเร็จและได้ `instanceId`; ลองวางซ้อนทับจุดเดิม → ได้ `isError: true`
- เรียก `move_furniture` → ย้ายพิกัดสำเร็จ
- เรียก `remove_furniture` → ลบออกสำเร็จ
- เรียก `manage_bay` → เปลี่ยนชื่อ/สี/archive ล็อกสำเร็จ

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/mcp-architect.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/mcp/architect-server.ts`**

- อ่าน token จาก `OfficeStore(dataDir).ensureArchitectToken()` ส่งผ่าน header `X-Architect-Token` ไปยัง `serverUrl` (`/api/state`, `/api/catalog`, `/api/architect/*`); ถ้า `fetch` เชื่อมไม่ได้ (เซิร์ฟเวอร์ปิดอยู่) ให้ fallback ทำงานกับ `OfficeEngine` + `PixcelBridge` บนดิสก์โดยตรงเพื่อให้ Gemini ยังจัดออฟฟิศได้เสมอ
- `craft_furniture_asset`: คืน content ทั้ง JSON summary และ `{ type: "image", mimeType: "image/png", data: contactSheetBase64 }` เพื่อให้ Gemini มองเห็นภาพ 4 ทิศที่ตัวเองปั้นได้ทันที

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/mcp-architect.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/mcp/architect-server.ts tests/mcp-architect.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add Gemini-only Office Architect MCP server"
```

---

### Task 7: Isometric Canvas 2D Renderer, Camera และ Unified Depth-Sorter

**Files:**
- Create: `src/client/atlas-loader.ts`
- Create: `src/client/camera.ts`
- Create: `src/client/iso-renderer.ts`
- Test: `tests/iso-client.test.ts`

**Interfaces:**
- Consumes: `ComputedCampus`, `OfficeState` types จาก `src/shared/types.ts` และ TexturePacker `.atlas.json` schema จาก `iherk-pixcel`
- Produces:
  - จาก `src/client/camera.ts`: `export const STEP_X = 32; export const STEP_Y = 16; export function tileToWorld(tx: number, ty: number): [number, number]; export function worldToTile(wx: number, wy: number): [number, number]; export class IsoCamera { panX: number; panY: number; zoom: number; setZoom(z: number): void; glideToTile(tx: number, ty: number, viewportW: number, viewportH: number): void; screenToTile(sx: number, sy: number, viewportW: number, viewportH: number): [number, number]; getVisibleWorldBounds(viewportW: number, viewportH: number, marginPx?: number): { minX: number; minY: number; maxX: number; maxY: number }; update(dtMs: number): boolean }`
  - จาก `src/client/iso-renderer.ts`: `export interface DepthRenderItem { id: string; x: number; y: number; footprintX: number; footprintY: number }`, `export function sortUnifiedIsoEntities<T extends DepthRenderItem>(items: T[]): T[]`, `export function isInWorldBounds(wx: number, wy: number, bounds: { minX: number; minY: number; maxX: number; maxY: number }): boolean`, `export class IsoRenderer { render(ctx: CanvasRenderingContext2D, opts: RenderSceneInput): void }`
  - จาก `src/client/atlas-loader.ts`: `export class AtlasManager { loadAll(): Promise<void>; reloadCustom(): Promise<void>; getFrame(theme: ThemeMode, key: string): ResolvedSpriteFrame | null }`

- [ ] **Step 1: เขียน failing test ใน `tests/iso-client.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { IsoCamera, tileToWorld, worldToTile } from "../src/client/camera.js";
import { isInWorldBounds, sortUnifiedIsoEntities } from "../src/client/iso-renderer.js";

describe("IsoCamera & unified topological depth-sorter", () => {
  it("round-trips tile <-> world <-> screen picking across integer zooms 1..4", () => {
    const cam = new IsoCamera();
    for (const z of [1, 2, 3, 4]) {
      cam.setZoom(z);
      cam.glideToTile(12, 7, 1280, 720);
      for (let i = 0; i < 60; i++) cam.update(16);
      const [tx, ty] = cam.screenToTile(640, 360, 1280, 720);
      expect(Math.round(tx)).toBe(12);
      expect(Math.round(ty)).toBe(7);
    }
    const [wx, wy] = tileToWorld(5, 3);
    const [rtX, rtY] = worldToTile(wx, wy);
    expect(rtX).toBeCloseTo(5, 5);
    expect(rtY).toBeCloseTo(3, 5);
  });

  it("sorts fractional moving characters cleanly behind and in front of a 2x1 desk", () => {
    const desk = { id: "desk", x: 2, y: 2, footprintX: 2, footprintY: 1 };
    const behind = { id: "char-behind", x: 2.2, y: 1.2, footprintX: 0.6, footprintY: 0.6 };
    const inFront = { id: "char-front", x: 2.2, y: 3.1, footprintX: 0.6, footprintY: 0.6 };
    const sorted = sortUnifiedIsoEntities([inFront, desk, behind]);
    expect(sorted.map((s) => s.id)).toEqual(["char-behind", "desk", "char-front"]);
  });

  it("culls far-away bays outside camera viewport bounds", () => {
    const cam = new IsoCamera();
    cam.setZoom(2);
    cam.glideToTile(2, 2, 800, 600);
    for (let i = 0; i < 60; i++) cam.update(16);
    const bounds = cam.getVisibleWorldBounds(800, 600, 128);
    const [nearX, nearY] = tileToWorld(2, 2);
    const [farX, farY] = tileToWorld(80, 80);
    expect(isInWorldBounds(nearX, nearY, bounds)).toBe(true);
    expect(isInWorldBounds(farX, farY, bounds)).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/iso-client.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/client/atlas-loader.ts`, `src/client/camera.ts`, `src/client/iso-renderer.ts`**

- `camera.ts`: พิกัดตรงตาม `iherk-pixcel` (`wx = (tx - ty) * 32`, `wy = (tx + ty) * 16`) รองรับ integer zoom `1..4` (ค่าเริ่มต้น `2`) และ glide smoothing
- `iso-renderer.ts`:
  - `sortUnifiedIsoEntities`: ขยาย Kahn's topological sort จาก `iherk-pixcel` ให้รองรับพิกัดทศนิยม (`x, y`) และขนาด `0.6×0.6` ของตัวละครที่กำลังเดิน
  - `render()`: ตั้ง `ctx.imageSmoothingEnabled = false`, cull ด้วย `getVisibleWorldBounds(w, h, 140)`, วาด 4 เลเยอร์ (Floors → Rear Walls & Wall Decor → Unified Furniture + Characters → Emissive Additive Pass ในโหมด Night + Speech/Tool/Sync Bubbles + Bay Nameplates + Ghost Preview ตอน Decorate Mode)
- `atlas-loader.ts`: โหลด `atlas-night`, `atlas-day`, `custom-atlas` (+ `_emissive`), แคชรูปและรองรับ `reloadCustom()` ด้วย cache-bust query `?t=<ts>` เมื่อได้ WS `atlas:updated`

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/iso-client.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/client/atlas-loader.ts src/client/camera.ts src/client/iso-renderer.ts tests/iso-client.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add Canvas 2D isometric renderer, camera, and unified depth-sorter"
```

---

### Task 8: A* Pathfinding, 5-State Animation Simulation (`sim.ts`) และ Demo Simulator

**Files:**
- Create: `src/client/pathfinding.ts`
- Create: `src/client/sim.ts`
- Create: `src/server/demo-simulator.ts`
- Test: `tests/sim-pathfinding.test.ts`

**Interfaces:**
- Consumes: `ComputedCampus`, `EmployeeRecord`, `VisualState`, `Direction` จาก `src/shared/types.ts`, `CHARACTER_CLIPS` จาก Task 2, `OfficeEngine` จาก Task 4
- Produces:
  - จาก `src/client/pathfinding.ts`: `export function buildWalkableGrid(campus: ComputedCampus): { width: number; height: number; blocked: Uint8Array }`, `export function findTilePath(grid: { width: number; height: number; blocked: Uint8Array }, start: [number, number], goal: [number, number]): Array<[number, number]>`
  - จาก `src/client/sim.ts`: `export interface SimEmployeeVisual { id: string; x: number; y: number; direction: Direction; clipName: string; bubbleText?: string; bubbleIcon?: string; isMoving: boolean }`, `export class OfficeSimulation { syncFromServer(state: OfficeState, campus: ComputedCampus): void; step(dtMs: number): { visuals: SimEmployeeVisual[]; syncPackets: Array<{ fromX: number; fromY: number; toX: number; toY: number; progress: number }>; targetFps: 30 | 8 } }`
  - จาก `src/server/demo-simulator.ts`: `export class DemoSimulator { constructor(engine: OfficeEngine); isRunning(): boolean; start(): void; stop(): Promise<void> }`

- [ ] **Step 1: เขียน failing test ใน `tests/sim-pathfinding.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { findTilePath } from "../src/client/pathfinding.js";
import { OfficeSimulation } from "../src/client/sim.js";
import { computeCampusLayout, createDefaultBayFurniture, createDefaultCommonWing } from "../src/server/layout-engine.js";
import type { CatalogEntry, OfficeState, ProjectBayRecord } from "../src/shared/types.js";

describe("A* pathfinding & OfficeSimulation", () => {
  it("routes around furniture obstacles and falls back to nearest reachable tile when goal is boxed in", () => {
    const blocked = new Uint8Array(6 * 6);
    // กั้นกำแพงรอบ (4,4) ทุกด้าน
    for (const [bx, by] of [[3, 4], [5, 4], [4, 3], [4, 5], [4, 4]]) blocked[by * 6 + bx] = 1;
    const path = findTilePath({ width: 6, height: 6, blocked }, [0, 0], [4, 4]);
    expect(path.length).toBeGreaterThan(0);
    // จุดสุดท้ายต้องไม่ทับช่อง blocked และเข้าใกล้ (4,4) มากที่สุด
    const last = path[path.length - 1];
    expect(blocked[last[1] * 6 + last[0]]).toBe(0);
    expect(Math.abs(last[0] - 4) + Math.abs(last[1] - 4)).toBeLessThanOrEqual(2);
  });

  it("switches between 30 FPS while moving and 8 FPS when idle, and picks correct animation clips for all 5 states", () => {
    const catalog = new Map<string, CatalogEntry>([
      ["desk-dev-dual", { id: "desk-dev-dual", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "starter" }],
      ["chair-office-swivel", { id: "chair-office-swivel", category: "furniture", layer: "object", footprintTiles: [1, 1], source: "starter" }],
      ["table-conference", { id: "table-conference", category: "furniture", layer: "object", footprintTiles: [2, 2], source: "starter" }],
      ["coffee-machine-bar", { id: "coffee-machine-bar", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
      ["sofa-lounge", { id: "sofa-lounge", category: "furniture", layer: "object", footprintTiles: [2, 1], source: "prop" }],
    ]);
    const bay: ProjectBayRecord = { id: "b0", projectPath: "/p/a", displayName: "alpha", accentColor: "#38bdf8", archived: false, deskSlots: 2, furniture: createDefaultBayFurniture("b0"), createdAt: 1, lastActiveAt: 1 };
    const wing = createDefaultCommonWing(0);
    const campus = computeCampusLayout([bay], [wing], catalog);

    const sim = new OfficeSimulation();
    const state: OfficeState = {
      version: 1, theme: "night", bays: [bay], commonWings: [wing], activityLog: [],
      employees: [{ id: "e1", bayId: "b0", provider: "claude", spriteId: "agent-claude", displayName: "Claude", role: "Lead", isEphemeral: false, visualState: "working", toolCategory: "code", detail: "Editing", lastUpdatedAt: 1 }],
    };
    sim.syncFromServer(state, campus);
    let out = sim.step(16);
    // ระหว่างเดินไปโต๊ะ -> 30 FPS
    if (out.visuals[0].isMoving) expect(out.targetFps).toBe(30);
    // เดินจนถึงโต๊ะ -> นั่งพิมพ์ 8 FPS
    for (let i = 0; i < 400; i++) out = sim.step(50);
    expect(out.visuals[0].isMoving).toBe(false);
    expect(out.visuals[0].clipName).toMatch(/^sit_type_/);
    expect(out.targetFps).toBe(8);
  });
});
```

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/sim-pathfinding.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `src/client/pathfinding.ts`, `src/client/sim.ts` และ `src/server/demo-simulator.ts`**

- `pathfinding.ts`: 4-neighbor A* (Manhattan heuristic) บน `Uint8Array` grid; อนุญาตจุดเริ่ม/จุดหมายที่อยู่บนเก้าอี้/โซฟาได้ แต่ถ้าเป้าหมายถูกล้อมปิดหมดให้เลือก visited node ที่ Manhattan distance ใกล้เป้าหมายที่สุดแทนการค้างหรือคืนทางว่าง
- `sim.ts`:
  - จับคู่เป้าหมายแต่ละสถานะ: `working`/`teamwork` → เก้าอี้หน้าโต๊ะในล็อกตัวเอง; `assigning` → หน้าทางเข้าล็อกหรือโต๊ะเพื่อนร่วมทีม; `meeting` → เก้าอี้/จุดรอบ `table-conference` หรือ `whiteboard-arch` ใน Common Wing แถวเดียวกัน; `resting` → หมุนเวียนจุดพักผ่อน (`coffee-machine-bar`, `sofa-lounge`, `plant-potted`, `bookshelf-wood`) ทุก 12–22 วินาที
  - สร้าง `syncPackets` วิ่งระหว่างโต๊ะเมื่อมีพนักงาน `teamwork` ≥ 2 คนในล็อกเดียวกัน
  - คำนวณ `targetFps`: `30` เมื่อมีพนักงานเดินหรือมี bay construction FX, ลดเหลือ `8` เมื่อทุกคนอยู่กับที่
- `demo-simulator.ts`: เมื่อเปิด Demo Mode ให้ backup snapshot ปัจจุบันไว้ใน memory แล้วป้อน scripted events จำลอง 3 โปรเจค (Claude + Gemini + subagent teamwork + meeting + tool error + resting) วนเป็นรอบ เมื่อกดหยุด Demo ให้คืน state จริงกลับมาไม่ให้ไฟล์เซฟสกปรก

- [ ] **Step 4: รัน test ยืนยันว่าผ่าน และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/sim-pathfinding.test.ts`
Expected: PASS
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/client/pathfinding.ts src/client/sim.ts src/server/demo-simulator.ts tests/sim-pathfinding.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add A* pathfinding, 5-state employee simulation, and demo simulator"
```

---

### Task 9: โหมดแต่งห้อง (Decorate Mode), HUD, Minimap และ Client Bundle

**Files:**
- Create: `src/client/decorate.ts`
- Create: `src/client/hud.ts`
- Create: `src/client/main.ts`
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `scripts/build-client.ts`
- Modify: `src/server/index.ts` (เชื่อม `/api/architect/demo/toggle` กับ `DemoSimulator`)
- Test: `tests/decorate.test.ts`

**Interfaces:**
- Consumes: `AtlasManager`, `IsoCamera`, `IsoRenderer`, `OfficeSimulation`, HTTP `/api/architect/*` และ WS `/ws`
- Produces:
  - `public/app.js` (สร้างจาก `npm run build:client`)
  - จาก `src/client/decorate.ts`: `export class DecorateController { active: boolean; selectedAssetId: string | null; direction: Direction; toggle(): void; rotateCw(): void; canUndo(): boolean; canRedo(): boolean; undo(): Promise<void>; redo(): Promise<void>; handleTileClick(tx: number, ty: number): Promise<void> }`

- [ ] **Step 1: เขียน failing test ใน `tests/decorate.test.ts`**

ทดสอบ `DecorateController` ด้วย mock API client:
- `rotateCw()` หมุนครบ `se -> sw -> nw -> ne -> se`
- วางเฟอร์ → `canUndo() === true` → `undo()` เรียก `removeFurniture(id)` → `canRedo() === true` → `redo()` วางกลับคืนที่เดิม

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/decorate.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `decorate.ts`, `hud.ts`, `main.ts`, `public/index.html`, `public/style.css`, `scripts/build-client.ts`**

- `decorate.ts`: แค็ตตาล็อกเฟอร์นิเจอร์แยกหมวด (Built-in / Custom by Gemini), โหมดวาง/ย้าย/ลบ, กด `R` หมุน 90°, กด `Esc` ออก, `Cmd/Ctrl+Z` Undo / `Cmd/Ctrl+Shift+Z` Redo, ส่ง header `X-UI-Session: window.__UI_SESSION__` ทุกครั้งที่เรียก `/api/architect/*`
- `hud.ts`:
  - แถบด้านซ้าย: รายชื่อ **Project Bays** (ค้นหาได้, แสดง badge Claude/Gemini และจำนวน active, คลิกเพื่อ glide กล้องไปล็อกนั้น, ปุ่ม Archive / แท็บ Archived)
  - มุมขวาล่าง: **Minimap** แบบ canvas เล็ก แสดงจุดสีตามสถานะพนักงาน คลิกเพื่อวาร์ปกล้องได้
  - การ์ด **Employee Inspector**: คลิกที่ตัวละครเพื่อดูชื่อ, รุ่น (Claude/Gemini), โฟลเดอร์โปรเจค, สถานะ, เครื่องมือที่รันอยู่ และ activity log ล่าสุด
  - แถบเครื่องมือด้านบน: ปุ่ม **Decorate Mode**, สลับธีม **Night / Day**, ปุ่ม **Demo Mode**, ปุ่มซูม `1×` `2×` `3×` `4×`
- `main.ts`: ต่อ WebSocket auto-reconnect, หยุด render เมื่อ `document.hidden === true`, adaptive `requestAnimationFrame` throttle ตาม `targetFps` (`30` หรือ `8`)
- `scripts/build-client.ts`: ใช้ `esbuild` bundle `src/client/main.ts` → `public/app.js` (ESM, target `es2022`, sourcemap)

- [ ] **Step 4: รัน test + build client และ commit**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/decorate.test.ts && npm run build:client`
Expected: PASS และสร้าง `public/app.js` สำเร็จโดยไม่มี error
Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add src/client/decorate.ts src/client/hud.ts src/client/main.ts public/index.html public/style.css scripts/build-client.ts src/server/index.ts tests/decorate.test.ts
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add in-game Decorate Mode, HUD, minimap, and Canvas 2D client bundle"
```

---

### Task 10: Hook Scripts แบบ Fail-Silent, CLI Installer (`install-hooks` / `install-mcp`) และ Visual Verification

**Files:**
- Create: `hooks/claude-hook.sh`
- Create: `hooks/gemini-cli-hook.sh`
- Create: `hooks/antigravity-hook.sh`
- Create: `src/cli/install-hooks.ts`
- Create: `src/cli/index.ts`
- Test: `tests/hooks-installer.test.ts`

**Interfaces:**
- Consumes: `createHellFactoryServer` (Task 5), `startArchitectMcpServer` (Task 6), `PixcelBridge` (Task 2), `OfficeEngine` (Task 4), `DemoSimulator` (Task 8)
- Produces:
  - CLI `hell-factory` (`start [--port 7140] [--demo] [--no-watch-antigravity]`, `mcp`, `build-assets`, `install-hooks [--dry-run] [--with-mcp]`, `install-mcp [--dry-run]`, `demo`)
  - สคริปต์ `hooks/*.sh` (`chmod +x`)

- [ ] **Step 1: เขียน failing test ใน `tests/hooks-installer.test.ts`**

ทดสอบ 2 เรื่องหลัก:
1. **Hook Safety & Delivery:** รัน `claude-hook.sh`, `gemini-cli-hook.sh`, `antigravity-hook.sh` ด้วย sample stdin JSON:
   - ตอนเซิร์ฟเวอร์ปิดอยู่ (ชี้ `HELL_FACTORY_URL=http://127.0.0.1:1`) → ทุกตัวต้อง `exit 0` ภายใน `< 1000ms` และ `stderr === ""`
   - ตอนเซิร์ฟเวอร์เปิดอยู่ → ยิง `POST /api/events` เข้าเซิร์ฟเวอร์และอัปเดตสถานะพนักงานถูกโปรเจคและถูก provider (`claude` vs `gemini`)
2. **Safe Installer & Gemini-Only MCP Isolation:** รัน `installHooks({ homeDir: tmpHome, projectRoot })` และ `installMcp({ homeDir: tmpHome, projectRoot })`:
   - สร้างไฟล์ `.bak` ก่อนเขียนทับ config เดิม, รันซ้ำ 2 รอบได้ผล idempotent ไม่ซ้ำรายการ
   - `~/.claude/settings.json` ได้เฉพาะ telemetry hooks (ไม่มี `mcpServers["iherk-hell-factory"]` เด็ดขาด!)
   - `~/.gemini/config/mcp_config.json` และ `~/.gemini/settings.json` ได้ลงทะเบียน `iherk-hell-factory` MCP server เฉพาะฝั่ง Gemini เท่านั้น

- [ ] **Step 2: รัน test ยืนยันว่า fail**

รัน: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/hooks-installer.test.ts`
Expected: FAIL

- [ ] **Step 3: สร้าง `hooks/*.sh`, `src/cli/install-hooks.ts` และ `src/cli/index.ts`**

- `hooks/claude-hook.sh`, `hooks/gemini-cli-hook.sh`, `hooks/antigravity-hook.sh`: ใช้ `jq` แปลง stdin เป็น `AgentTelemetryEvent` JSON แล้วส่ง `curl -sS -o /dev/null --max-time 1 -X POST -H 'Content-Type: application/json' -d @- "${HELL_FACTORY_URL:-http://127.0.0.1:7140}/api/events" 2>/dev/null || true` และ `exit 0` เสมอ (และ `antigravity-hook.sh` พิมพ์ `{}` ออก stdout ตาม contract ของ Antigravity hooks!)
- `src/cli/install-hooks.ts`: merge JSON แบบรักษาค่าเดิมครบ, สร้าง backup `<file>.bak.<ts>`, รองรับ `--dry-run` แสดง diff ก่อนเขียนจริง
- `src/cli/index.ts`: เชื่อมคำสั่ง `start`, `mcp`, `build-assets`, `install-hooks`, `install-mcp`, `demo` + เพิ่ม `npm run build` (`tsc && npm run build:client && tsx src/cli/index.ts build-assets`)

- [ ] **Step 4: รัน Verification ครบทุกด่าน (Unit/Integration Tests + Typecheck + Visual Browser Smoke Test)**

1. รัน `export PATH="/opt/homebrew/bin:$PATH" && npm test` → ทุกไฟล์ใน `tests/` ผ่าน 100%
2. รัน `export PATH="/opt/homebrew/bin:$PATH" && npm run build` → `tsc`, `esbuild`, และ `build-assets` ผ่านหมดโดยไม่มี error
3. สตาร์ทเซิร์ฟเวอร์ในโหมด Demo (`node dist/cli/index.js start --port 7140 --demo`) แล้วเปิดตรวจสอบผ่าน Browser Subagent เพื่อยืนยัน:
   - ภาพ pixel art คมกริบ ไม่มีเบลอ/mixel
   - ล็อกขยายเพิ่มตามโปรเจค, ตัวละครเดิน/ทำงาน/ทำงานเป็นทีม/ประชุม/พักผ่อน และ depth-sort รอบโต๊ะ-เก้าอี้ถูกต้อง
   - โหมด Decorate Mode และปุ่มสลับ Night/Day ใช้งานได้จริง
4. Commit:
```bash
git -c include.path=/Users/dev3/.gitconfig-iherk add hooks/ src/cli/ tests/hooks-installer.test.ts package.json
git -c include.path=/Users/dev3/.gitconfig-iherk commit -m "feat: add fail-silent hooks, safe CLI installer, and full CLI entrypoint"
```

---

## สรุปการตรวจทานแผนด้วยตนเอง (Self-Review)

- **Spec Coverage:** ครอบคลุมครบทุกส่วนใน Design Doc (12 starter assets + 6 props + 3 animated characters 4 ทิศ 7 ท่าทาง, Night/Day remap โดยไม่แก้ `iherk-pixcel`, unbounded campus + zone-local furniture + archive compaction, 5 animations, Claude/Gemini CLI/Antigravity hooks + default-on Antigravity watcher, Gemini-only MCP + browser Decorate Mode auth boundary, Demo Mode)
- **Type & Signature Consistency:** ทุก Interface ที่ Task หลัง consume ตรงกับชื่อและ signature ใน `Produces` ของ Task ก่อนหน้าทั้งหมด
- **Review Focus:** กรณีขอบทั้ง 5 ข้อถูกผูก test ไว้ใน Task 1, 2, 3, 4, 5 และ 8 ครบถ้วน
