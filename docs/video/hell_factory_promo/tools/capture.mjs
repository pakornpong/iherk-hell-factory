// Draws the real office (the running Hell Factory at 127.0.0.1:7140) in stages and saves each as a PNG, for the film's
// layers. Read-only: it only GETs /api/state; every other request the page makes is answered locally and the live
// socket is replaced, so nothing here can change the office. Needs the agent Chrome on 127.0.0.1:9222.
//   node tools/capture.mjs OUT_DIR [stageSet]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../package.json"));   // the checkout this film lives in, for its `ws`
const WebSocket = require("ws");
const OUT = process.argv[2];
const SET = process.argv[3] ?? "build";
const VW = 2720, VH = 1880, URL = "http://127.0.0.1:7140/";
fs.mkdirSync(OUT, { recursive: true });

const INJECT = `(() => {
  const realFetch = window.fetch.bind(window);
  window.__base = null;
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  window.__stage = (spec) => {
    const d = JSON.parse(JSON.stringify(window.__base));
    const c = d.campus, s = d.state;
    if (spec.theme) s.theme = spec.theme;
    if (!spec.floors) c.floors = [];
    if (!spec.walls) { c.walls = []; c.wallDecor = []; }
    const k = spec.depth ?? -1;
    c.worldFurniture = c.worldFurniture.filter((f) => f.tx + f.ty <= k);
    c.wallSegments = c.wallSegments.filter((w) => w.rx + w.ry <= k);
    if (!spec.employees) s.employees = [];
    else if (spec.employees !== "all") s.employees = s.employees.slice(0, spec.employees);
    if (spec.employees) for (const e of s.employees) { if (spec.visual) { e.visualState = spec.visual; e.toolName = spec.tool ?? e.toolName; e.toolCategory = spec.cat ?? e.toolCategory; e.lastUpdatedAt = Date.now(); } }
    d.demoMode = false;
    return d;
  };
  window.__first = { floors: false, walls: false, depth: -1, employees: 0 };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = ((init && init.method) || "GET").toUpperCase();
    if (method !== "GET") return json({});
    if (url.includes("/api/state")) {
      window.__base = await (await realFetch(input, init)).json();
      return json(window.__stage(window.__first));
    }
    if (localStorage.getItem("cap-noboss") === "1" && /atlas-[a-z]+\.json/.test(url)) {     // the build is photographed without the Boss, who arrives with the staff
      const a = await (await realFetch(input, init)).json();
      for (const k of Object.keys(a.frames)) if (k.startsWith("agent-boss/") || k.startsWith("agent-starter/")) delete a.frames[k];
      return json(a);
    }
    return realFetch(input, init);
  };
  // name bubbles are drawn by the film itself: when asked, the canvas draws nothing from the first measured label to the next restore
  const realMeasure = CanvasRenderingContext2D.prototype.measureText;
  CanvasRenderingContext2D.prototype.measureText = function (t) { if (window.__noBubble) this.globalAlpha = 0; return realMeasure.call(this, t); };
  class FakeWS { constructor() { window.__ws = this; this.readyState = 1; } send() {} close() {} addEventListener() {} }
  window.WebSocket = FakeWS;
  window.__push = (spec) => { window.__ws.onmessage({ data: JSON.stringify({ type: "state:snapshot", payload: window.__stage(spec) }) }); return true; };
  // nobody's mouse or keys reach the page while it is being photographed
  for (const t of ["wheel", "mousedown", "mouseup", "mousemove", "keydown", "keyup", "click", "dblclick", "contextmenu", "pointerdown", "pointermove", "pointerup", "touchstart"])
    window.addEventListener(t, (e) => { e.stopImmediatePropagation(); e.preventDefault(); }, { capture: true, passive: false });
  const realRaf = window.requestAnimationFrame.bind(window);
  window.__fake = null;
  let lastReal = null;
  window.requestAnimationFrame = (cb) => realRaf((now) => { if (window.__run && window.__fake != null && lastReal != null) window.__fake += now - lastReal; lastReal = now; window.__frames = (window.__frames || 0) + 1; cb(window.__fake ?? now); });
})();`;

const CSS = `.topbar,.sidebar,#active-agents-panel,#decorate-panel,.minimap,#minimap,canvas:not(#office-canvas),.toast,.hud-toast{display:none!important}`;

const t = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.once("open", r));
let id = 0; const pending = new Map();
ws.on("message", (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.error || r.result?.exceptionDetails) console.warn("eval error", expression.slice(0, 60), JSON.stringify(r.error ?? r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.result.data, "base64")); };

await send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Page.bringToFront");
await send("Page.addScriptToEvaluateOnNewDocument", { source: INJECT });

async function load(showZones, noBoss = true) {
  await send("Page.navigate", { url: URL });
  await sleep(1200);
  await ev(`localStorage.setItem("hf-show-zones", "${showZones}"); localStorage.setItem("cap-noboss", "${noBoss ? 1 : 0}"); 1`);
  await send("Page.navigate", { url: URL });
  await sleep(6500);
  await ev(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(CSS)}; document.head.appendChild(s); return 1; })()`);
  await ev(`window.__fake = 39000 * 100; 1`);
  await sleep(400);
}
/** show a stage and wait until it is drawn: the clock moves by a whole number of every animation's cycle */
/** wait until the page has drawn n more frames; a hidden tab draws none, so it is brought forward again */
async function drawn(n = 3) {
  const from = await ev(`window.__frames || 0`);
  for (let i = 0; i < 80; i++) {
    await sleep(110);
    if ((await ev(`window.__frames || 0`)) >= from + n) return;
    if (i % 12 === 11) await send("Page.bringToFront");
  }
  console.warn("page is not drawing");
}
/** show a stage and wait until it is drawn: the clock moves by a whole number of every animation's cycle */
async function stage(spec, name, wait = 250) {
  await ev(`window.__push(${JSON.stringify(spec)}); window.__fake += 39000; 1`);
  await drawn(); await sleep(wait);
  await ev(`window.__fake += 39000; 1`);
  await drawn(); await sleep(120);
  if (name) await shot(name);
}

const info = {};
if (SET === "build") {
  await load(false);
  await ev(`window.__noBubble = true; 1`);
  const depths = await ev(`(() => { const c = window.__base.campus; const s = new Set(); for (const f of c.worldFurniture) s.add(f.tx + f.ty); for (const w of c.wallSegments) s.add(w.rx + w.ry); return [...s].sort((a, b) => a - b); })()`);
  info.depths = depths;
  info.campus = await ev(`(() => { const c = window.__base.campus; return { w: c.widthTiles, d: c.depthTiles, zones: c.zones, customZones: window.__base.state.customZones, floors: c.floors, counts: { furniture: c.worldFurniture.length, segments: c.wallSegments.length, walls: c.walls.length, employees: window.__base.state.employees.length, bays: window.__base.state.bays.filter((b) => !b.archived).length } }; })()`);
  await stage({ floors: false, walls: false }, "bg");
  await stage({ floors: true, walls: false }, "floor");
  await stage({ floors: true, walls: true }, "walls");
  for (const k of depths) await stage({ floors: true, walls: true, depth: k }, `d_${String(k).replace(".", "p")}`, 320);
  await stage({ floors: true, walls: true, depth: 999 }, "full");
  await stage({ floors: true, walls: true, depth: 999 }, "full_again");
  for (const theme of ["night", "day"]) {
    await stage({ floors: false, walls: false, theme }, `${theme}_bg`);
    await stage({ floors: true, walls: true, depth: 999, theme }, `${theme}_full`);
  }
  await ev(`localStorage.setItem("cap-noboss", "0"); 1`);
} else if (SET === "themes") {
  await load(false);
  await ev(`window.__noBubble = true; 1`);
  await stage({ floors: true, walls: true, depth: 999 }, "full_check");
  for (const theme of ["night", "day"]) {
    await stage({ floors: false, walls: false, theme }, `${theme}_bg`, 900);
    await stage({ floors: true, walls: true, depth: 999, theme }, `${theme}_full`, 900);
  }
  await ev(`localStorage.setItem("cap-noboss", "0"); 1`);
} else if (SET === "zones") {
  await load(true);
  await stage({ floors: true, walls: true }, "walls_zones");
  await stage({ floors: true, walls: true, depth: 999 }, "full_zones");
  await ev(`localStorage.setItem("hf-show-zones", "false"); localStorage.setItem("cap-noboss", "0"); 1`);
} else if (SET === "staff") {
  await load(false, false);
  await ev(`window.__noBubble = true; 1`);
  const snap = async (name, add) => { await ev(`window.__run = false; window.__fake = (Math.floor(window.__fake / 39000) + 2) * 39000 + ${add}; 1`); await sleep(350); await ev(`window.__fake += 39000; 1`); await sleep(300); await shot(name); };
  for (const theme of ["office", "night"]) {
    await ev(`window.__push(${JSON.stringify({ floors: true, walls: true, depth: 999, theme, employees: "all", visual: "working", tool: "Bash", cat: "shell" })}); window.__run = true; 1`);
    await sleep(Number(process.argv[4] ?? 20000));           // the clock runs: they walk to their desks and sit
    await snap(`${theme}_staff_a`, 0);
    await snap(`${theme}_staff_b`, 300);
    await snap(`${theme}_staff_c`, 0);
    info[theme] = await ev(`window.__stage({ floors: true, walls: true, depth: 999, employees: "all" }).state.employees.map((e) => ({ id: e.id, provider: e.provider, spriteId: e.spriteId, bayId: e.bayId, name: e.displayName, role: e.role, eph: e.isEphemeral }))`);
  }
  await ev(`localStorage.setItem("cap-noboss", "0"); 1`);
}
fs.writeFileSync(path.join(OUT, `info-${SET}.json`), JSON.stringify(info));
await fetch(`http://127.0.0.1:9222/json/close/${t.id}`);
ws.close();
console.log("done", SET, Object.keys(info));
