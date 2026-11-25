#!/usr/bin/env node
// Local asset forge: asks a local LLM (any OpenAI-compatible endpoint: Ollama, LiteLLM, llama-server)
// to write .pixcel.json props, validates + renders them with iherk-pixcel, retries with the errors,
// and keeps only assets that pass in assets/pixcel/drafts/ (never touches the live props folder).
//
// Usage:
//   node scripts/local-forge/forge.mjs [--limit 10] [--queue scripts/local-forge/queue.txt]
// Env:
//   FORGE_BASE_URL  default http://192.168.5.150:11434/v1 (LOH-PC Ollama; Mac: http://127.0.0.1:11434/v1)
//   FORGE_MODEL     default qwen3-coder:30b
//   FORGE_API_KEY   optional (LiteLLM key)
//   FORGE_OUT       output dir (default assets/pixcel/drafts) — use one per model to compare
//   FORGE_PLAN       set 0 to skip the planning pass (plan parts first, then build)
//   FORGE_SIMILAR    set 0 to use the fixed 4 examples instead of the most similar props
//   FORGE_OCCLUSION  set 0 to skip auto-clamp + auto-repair of buried/overwritten detail parts
//   FORGE_JSON_MODE  set 0 to skip response_format (gpt-oss crashes Ollama with it)
//   FORGE_MAX_TOKENS default 6000 (raise for reasoning models like gpt-oss)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PIXCEL_CLI = path.resolve(ROOT, "../iherk-pixcel/dist/cli/index.js");
const PROPS_DIR = path.join(ROOT, "assets/pixcel/props");
const DRAFTS_DIR = path.resolve(ROOT, process.env.FORGE_OUT ?? "assets/pixcel/drafts");
const PREVIEW_DIR = path.join(DRAFTS_DIR, "_preview");
const LOG_FILE = path.join(DRAFTS_DIR, "_forge-log.jsonl");

const BASE_URL = process.env.FORGE_BASE_URL ?? "http://192.168.5.150:11434/v1"; // LOH-PC Ollama (RTX 4070 Ti)
const MODEL = process.env.FORGE_MODEL ?? "qwen3-coder:30b"; // best of 14b / gpt-oss-20b / 30b trial
const API_KEY = process.env.FORGE_API_KEY ?? "local";
const MAX_ATTEMPTS = 3;
const MAX_Z = 96;

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const LIMIT = Number(argVal("--limit", "1000"));
const QUEUE = path.resolve(ROOT, argVal("--queue", path.join(HERE, "queue.txt")));
const EXAMPLES = ["music-guitar-amp", "server-blade-tower", "home-kitchen-fridge", "gym-treadmill"];

const STYLE_RULES = `You are a voxel prop designer for an isometric pixel-art office game.
You output ONE JSON object: a ".pixcel.json" voxel asset. No prose, no markdown.

COORDINATES (all integers, INCLUSIVE ranges, never negative):
- x = width  : 0 .. footprintW*32-1
- y = depth  : 0 .. footprintD*32-1   (y=0 is the BACK, high y is the FRONT the viewer sees)
- z = height : 0 .. ${MAX_Z} (z=0 is the floor). Desks ~24 high, cabinets/machines 40-70, never taller than ${MAX_Z}.
- Leave 2-5 voxels of margin from the footprint edges so props do not touch neighbours.

OPS you may use (each op MUST have "material" naming a key in "materials", and a short "part" name):
- {"op":"box","from":[x,y,z],"to":[x,y,z],"material":"m","part":"p"}         solid block
- {"op":"hollowBox","from":[..],"to":[..],"thickness":1,"material":"m","part":"p"}
- {"op":"cylinder","center":[x,y],"zFrom":z0,"zTo":z1,"radius":r,"material":"m","part":"p"}
- {"op":"line","from":[..],"to":[..],"material":"m","part":"p"}
- {"op":"voxel","at":[x,y,z],"material":"m","part":"p"}                       single pixel detail (LEDs, knobs)
Later ops overwrite earlier ones, so build big body first, then details (screens, trims, buttons) on the FRONT face (high y) and TOP.

MATERIALS: kind is one of matte | wood | metal | glass | emissive.
- emissive is for screens, LEDs, neon; add "glowRadius" 1-2 and "glowIntensity" 0.15-0.6.

ART STYLE (match the examples exactly):
- Dark slate / navy / charcoal bodies (#1f242d, #334155, #14171f), warm brown wood (#6b442a, #4b3121),
  light steel (#cbd5e1), and small bright neon accents: cyan #22d3ee, magenta #ec4899, amber #f59e0b, green #4ade80, red #dc2626.
- Chunky readable silhouettes, 15-35 ops, small emissive details that make the object recognizable.
- 4-9 materials.

FIXED FIELDS: "schemaVersion":1, "layer":"object", "outlineMode":"silhouette", "tilePreset":"64x32",
"voxelsPerTile":32, "palette":"office-day", plus "id", "category", "footprintTiles", "materials", "ops".`;

const STOP = new Set(["a", "an", "the", "and", "with", "on", "of", "in", "at", "to", "small", "tall", "dark", "top"]);
const tokens = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );

let propLibrary = null;
function loadPropLibrary() {
  if (propLibrary) return propLibrary;
  propLibrary = fs
    .readdirSync(PROPS_DIR)
    .filter((f) => f.endsWith(".pixcel.json") && !/^(room|wall|floor|divider)-/.test(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(PROPS_DIR, f), "utf8");
      const doc = JSON.parse(raw);
      const words = tokens(`${doc.id} ${(doc.ops ?? []).map((o) => o.part ?? "").join(" ")} ${Object.keys(doc.materials ?? {}).join(" ")}`);
      return { doc, raw, words };
    })
    .filter((p) => p.doc.layer === "object" && (p.doc.ops?.length ?? 0) >= 12);
  return propLibrary;
}

/** Pick the 3 library props most similar to the job (shared words, category, footprint) + 1 fixed anchor for style. */
function pickExamples(job) {
  const want = tokens(`${job.id} ${job.category} ${job.description}`);
  const scored = loadPropLibrary().map((p) => {
    let score = 0;
    for (const w of want) if (p.words.has(w)) score += 2;
    if (p.doc.category === job.category) score += 3;
    if (JSON.stringify(p.doc.footprintTiles) === JSON.stringify(job.footprint)) score += 1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 3).map((s) => s.p);
  const anchor = loadPropLibrary().find((p) => p.doc.id === "music-guitar-amp");
  if (anchor && !picked.includes(anchor)) picked.push(anchor);
  return picked.map((p) => p.raw);
}

function loadExamples() {
  return EXAMPLES.map((id) => fs.readFileSync(path.join(PROPS_DIR, `${id}.pixcel.json`), "utf8"));
}

const PLAN_RULES = `You are a prop concept artist for a chunky isometric voxel game. Before anything is built, you write a PLAN.
Reply with ONE JSON object only:
{
  "keyFeatures": ["3-5 visual features a stranger needs to recognize this object at 60px"],
  "parts": [
    {"name":"short_name","shape":"box|hollowBox|cylinder|line|voxel","x":[x0,x1],"y":[y0,y1],"z":[z0,z1],"material":"mat_name","why":"which key feature this shows"}
  ],
  "materials": {"mat_name":{"color":"#hex","kind":"matte|wood|metal|glass|emissive"}}
}
RULES:
- Coordinates are INCLUSIVE integers. x: 0..W*32-1, y: 0..D*32-1 (y=0 BACK, high y = FRONT facing the viewer), z: 0..${MAX_Z} up.
- 12-30 parts. Order = draw order: main body first, then details. Later parts overwrite earlier ones.
- The object should use most of its footprint (leave 2-5 voxels margin), unless it is naturally thin (pole, lamp, rack).
- The main body should END 2-4 voxels before the front edge so front details can sit in front of it.
- Every key feature must be visible from the FRONT (high y face) or the TOP. Never put details at low y (that is the hidden back side) or inside the body volume. Put screens, keys, buttons, labels, faces on the front face: a 1-voxel-thick part at y = (front face y) + 1, or on top at z = (top z) + 1.
- Use strongly contrasting colors for key features against the body (light on dark or neon on dark). Never make the whole object one flat color.
- See-through things (tanks, glass doors, display cases): do NOT draw a solid box. Draw a thin frame (lines/thin boxes on the edges) and draw the CONTENTS (water, fish, items) as colored boxes inside, with light emissive color.
- Thin real-world things (rods, legs, poles, cables, strings) are 1-2 voxels thick lines or boxes, not slabs.
- Proportions: chair seat ~12 high, desk/table top ~22-26, counter ~28, person-height cabinet/machine ~56-70.`;

function parseQueue() {
  return fs
    .readFileSync(QUEUE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [id, fp, category, ...desc] = l.split("|").map((s) => s.trim());
      const [w, d] = fp.split("x").map(Number);
      return { id, footprint: [w, d], category, description: desc.join("|") };
    });
}

async function chat(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.5,
      ...(process.env.FORGE_JSON_MODE === "0" ? {} : { response_format: { type: "json_object" } }),
      max_tokens: Number(process.env.FORGE_MAX_TOKENS ?? 6000),
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { text: json.choices?.[0]?.message?.content ?? "", usage: json.usage };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

/** Our own checks on top of pixcel validate: footprint bounds, height, op count. */
function lint(asset, job) {
  const errs = [];
  const [w, d] = job.footprint;
  const maxX = w * 32 - 1;
  const maxY = d * 32 - 1;
  if (!asset.materials || typeof asset.materials !== "object") errs.push("missing materials object");
  if (!Array.isArray(asset.ops) || asset.ops.length < 8) errs.push(`need at least 8 ops, got ${asset.ops?.length ?? 0}`);
  const pts = [];
  for (const [i, op] of (asset.ops ?? []).entries()) {
    if (op.material && asset.materials && !(op.material in asset.materials)) {
      errs.push(`op #${i} uses unknown material "${op.material}"`);
    }
    if (op.from) pts.push([i, op.from]);
    if (op.to) pts.push([i, op.to]);
    if (op.at) pts.push([i, op.at]);
    if (op.center) {
      const r = Math.ceil(op.radius ?? 0);
      pts.push([i, [op.center[0] - r, op.center[1] - r, op.zFrom]], [i, [op.center[0] + r, op.center[1] + r, op.zTo]]);
    }
  }
  for (const [i, [x, y, z]] of pts) {
    if (x < 0 || x > maxX || y < 0 || y > maxY || z < 0 || z > MAX_Z) {
      errs.push(`op #${i} point [${x},${y},${z}] outside x 0..${maxX}, y 0..${maxY}, z 0..${MAX_Z}`);
    }
  }
  return [...new Set(errs)].slice(0, 12);
}

/** Voxelize ops roughly like pixcel; returns per-op owned voxel count and voxels with a face toward +x/+y/+z (SE camera). */
function voxelStats(ops, W, D, H) {
  const grid = new Int16Array(W * D * H).fill(-1);
  const idx = (x, y, z) => x + W * (y + D * z);
  const put = (x, y, z, i) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= D || z >= H) return;
    grid[idx(x, y, z)] = i;
  };
  const range = (a, b) => [Math.min(a, b), Math.max(a, b)];
  ops.forEach((op, i) => {
    const v = op.material === null ? -1 : i;
    if (op.op === "box" || op.op === "slope" || op.op === "hollowBox") {
      const [x0, x1] = range(op.from[0], op.to[0]);
      const [y0, y1] = range(op.from[1], op.to[1]);
      const [z0, z1] = range(op.from[2], op.to[2]);
      const t = op.op === "hollowBox" ? op.thickness ?? 1 : Infinity;
      for (let z = z0; z <= z1; z++)
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++)
            if (x - x0 < t || x1 - x < t || y - y0 < t || y1 - y < t || z - z0 < t || z1 - z < t) put(x, y, z, v);
    } else if (op.op === "cylinder") {
      const [cx, cy] = op.center;
      const r = op.radius;
      const [z0, z1] = range(op.zFrom, op.zTo);
      for (let z = z0; z <= z1; z++)
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, z, v);
    } else if (op.op === "line") {
      const steps = Math.max(...op.from.map((a, k) => Math.abs(op.to[k] - a)), 1);
      for (let s = 0; s <= steps; s++) {
        const p = op.from.map((a, k) => Math.round(a + ((op.to[k] - a) * s) / steps));
        put(p[0], p[1], p[2], v);
      }
    } else if (op.op === "voxel") {
      put(op.at[0], op.at[1], op.at[2], v);
    }
  });
  const owned = new Array(ops.length).fill(0);
  const visible = new Array(ops.length).fill(0);
  const empty = (x, y, z) => x >= W || y >= D || z >= H || grid[idx(x, y, z)] < 0;
  for (let z = 0; z < H; z++)
    for (let y = 0; y < D; y++)
      for (let x = 0; x < W; x++) {
        const o = grid[idx(x, y, z)];
        if (o < 0) continue;
        owned[o]++;
        if (empty(x + 1, y, z) || empty(x, y + 1, z) || empty(x, y, z + 1)) visible[o]++;
      }
  return { owned, visible };
}

/** Clamp every coordinate into the footprint/height box (models often overshoot by 1-4 voxels). */
function clampOps(asset, job) {
  const lim = [job.footprint[0] * 32 - 1, job.footprint[1] * 32 - 1, MAX_Z];
  const c = (v, k) => Math.max(0, Math.min(lim[k], Math.round(v)));
  for (const op of asset.ops) {
    for (const key of ["from", "to", "at"]) if (Array.isArray(op[key])) op[key] = op[key].map(c);
    if (Array.isArray(op.center)) op.center = op.center.map(c);
    if (typeof op.zFrom === "number") op.zFrom = c(op.zFrom, 2);
    if (typeof op.zTo === "number") op.zTo = c(op.zTo, 2);
  }
}

function shiftOp(op, axis, d, lim) {
  const out = structuredClone(op);
  const mv = (p) => {
    const q = [...p];
    q[axis] = Math.max(0, Math.min(lim[axis], q[axis] + d));
    return q;
  };
  for (const key of ["from", "to", "at"]) if (Array.isArray(out[key])) out[key] = mv(out[key]);
  if (axis < 2 && Array.isArray(out.center)) out.center = mv([...out.center, 0]).slice(0, 2);
  if (axis === 2 && typeof out.zFrom === "number") {
    out.zFrom = Math.max(0, Math.min(lim[2], out.zFrom + d));
    out.zTo = Math.max(0, Math.min(lim[2], out.zTo + d));
  }
  return out;
}

/**
 * Deterministic repair for detail parts the camera can't see: first draw them last, then nudge them
 * toward the front (+y), side (+x) or top (+z) until some voxels show. Returns names still hidden.
 */
function autoRepairOcclusion(asset, job) {
  const W = job.footprint[0] * 32;
  const D = job.footprint[1] * 32;
  const H = MAX_Z + 1;
  const lim = [W - 1, D - 1, MAX_Z];
  const isHidden = (ops, i) => {
    const st = voxelStats(ops, W, D, H);
    return st.owned[i] === 0 || st.visible[i] === 0;
  };
  const fixed = [];
  for (let pass = 0; pass < asset.ops.length; pass++) {
    const st = voxelStats(asset.ops, W, D, H);
    const i = asset.ops.findIndex((op, k) => k > 0 && op.material !== null && (st.owned[k] === 0 || st.visible[k] === 0));
    if (i < 0) break;
    const op = asset.ops[i];
    const rest = asset.ops.filter((_, k) => k !== i);
    let done = false;
    const candidates = [op];
    for (const [axis, max] of [[1, 8], [2, 6], [0, 6]]) for (let d = 1; d <= max; d++) candidates.push(shiftOp(op, axis, d, lim));
    for (const cand of candidates) {
      const ops = [...rest, cand];
      if (!isHidden(ops, ops.length - 1)) {
        asset.ops = ops;
        fixed.push(op.part ?? op.material);
        done = true;
        break;
      }
    }
    if (!done) {
      op.__unfixable = true;
      asset.ops = [...rest, op]; // move to end so the loop advances; marked so we stop retrying it
      if (asset.ops.every((o, k) => k === 0 || o.material === null || o.__unfixable || !isHidden(asset.ops, k))) break;
    }
  }
  const st = voxelStats(asset.ops, W, D, H);
  const stillHidden = asset.ops
    .filter((op, k) => k > 0 && op.material !== null && (st.owned[k] === 0 || st.visible[k] === 0))
    .map((op) => op.part ?? op.material);
  for (const op of asset.ops) delete op.__unfixable;
  return { fixed, stillHidden };
}

function normalize(asset, job) {
  return {
    schemaVersion: 1,
    id: job.id,
    category: job.category,
    layer: "object",
    outlineMode: "silhouette",
    tilePreset: "64x32",
    voxelsPerTile: 32,
    footprintTiles: job.footprint,
    palette: "office-day",
    materials: asset.materials,
    ops: asset.ops,
  };
}

function pixcel(...cliArgs) {
  try {
    return { ok: true, out: execFileSync("node", [PIXCEL_CLI, ...cliArgs], { encoding: "utf8", stdio: "pipe" }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().slice(0, 800) };
  }
}

async function planOne(job) {
  if (process.env.FORGE_PLAN === "0") return null;
  const [w, d] = job.footprint;
  try {
    const reply = await chat([
      { role: "system", content: PLAN_RULES },
      {
        role: "user",
        content: `Plan "${job.id}" (category ${job.category}). footprintTiles [${w},${d}] so x 0..${w * 32 - 1}, y 0..${d * 32 - 1}. ${job.description}`,
      },
    ]);
    const plan = extractJson(reply.text);
    if (!Array.isArray(plan.parts) || plan.parts.length < 6) return null;
    return plan;
  } catch {
    return null;
  }
}

async function forgeOne(job, examples) {
  const tmp = path.join(DRAFTS_DIR, `_tmp-${job.id}.pixcel.json`);
  const t0 = Date.now();
  const plan = await planOne(job);
  const planText = plan
    ? `\nFollow this approved PLAN closely (same parts, coordinates, materials and draw order; you may add small details). Key features that MUST be clearly visible: ${(plan.keyFeatures ?? []).join("; ")}.\nPLAN:\n${JSON.stringify(plan)}`
    : "";
  const messages = [
    { role: "system", content: STYLE_RULES },
    ...examples.flatMap((ex) => {
      const e = JSON.parse(ex);
      return [
        { role: "user", content: `Make "${e.id}" (category ${e.category}), footprintTiles ${JSON.stringify(e.footprintTiles)}.` },
        { role: "assistant", content: JSON.stringify(e) },
      ];
    }),
    {
      role: "user",
      content: `Make "${job.id}" (category ${job.category}), footprintTiles ${JSON.stringify(job.footprint)}. ${job.description}${planText}`,
    },
  ];
  let lastErrors = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let reply;
    try {
      reply = await chat(messages);
    } catch (e) {
      return { id: job.id, ok: false, attempt, errors: [String(e.message ?? e)], ms: Date.now() - t0 };
    }
    let errors = [];
    let asset;
    let repair = null;
    try {
      asset = normalize(extractJson(reply.text), job);
      if (Array.isArray(asset.ops)) clampOps(asset, job);
      errors = lint(asset, job);
      if (errors.length === 0 && process.env.FORGE_OCCLUSION !== "0") {
        repair = autoRepairOcclusion(asset, job);
      }
    } catch (e) {
      errors = [`invalid JSON: ${e.message}`];
    }
    if (errors.length === 0) {
      fs.writeFileSync(tmp, JSON.stringify(asset, null, 2));
      const v = pixcel("validate", tmp);
      if (!v.ok) errors = [v.out];
    }
    if (errors.length === 0) {
      const out = path.join(DRAFTS_DIR, `${job.id}.pixcel.json`);
      fs.renameSync(tmp, out);
      const r = pixcel("render", out, "--out", PREVIEW_DIR, "--directions", "se", "--format", "png");
      return { id: job.id, ok: r.ok, attempt, errors: r.ok ? [] : [r.out], ms: Date.now() - t0, ops: asset.ops.length, planned: Boolean(plan), keyFeatures: plan?.keyFeatures, repaired: repair?.fixed, stillHidden: repair?.stillHidden };
    }
    lastErrors = errors;
    messages.push(
      { role: "assistant", content: reply.text.slice(0, 12000) },
      { role: "user", content: `That asset is invalid. Fix ALL of these and reply with the full corrected JSON only:\n- ${errors.join("\n- ")}` },
    );
  }
  fs.rmSync(tmp, { force: true });
  return { id: job.id, ok: false, attempt: MAX_ATTEMPTS, errors: lastErrors, ms: Date.now() - t0 };
}

async function main() {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const examples = loadExamples();
  const jobs = parseQueue()
    .filter((j) => !fs.existsSync(path.join(DRAFTS_DIR, `${j.id}.pixcel.json`)))
    .filter((j) => !fs.existsSync(path.join(PROPS_DIR, `${j.id}.pixcel.json`)))
    .slice(0, LIMIT);
  console.log(`forge: ${jobs.length} job(s) on ${MODEL} @ ${BASE_URL}`);
  let ok = 0;
  for (const job of jobs) {
    const res = await forgeOne(job, process.env.FORGE_SIMILAR === "0" ? examples : pickExamples(job));
    if (res.ok) ok++;
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), model: MODEL, ...res }) + "\n");
    console.log(`${res.ok ? "OK  " : "FAIL"} ${job.id} (try ${res.attempt}, ${(res.ms / 1000).toFixed(0)}s)${res.ok ? "" : ` — ${res.errors[0]?.slice(0, 160)}`}`);
  }
  console.log(`forge: done ${ok}/${jobs.length} passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
