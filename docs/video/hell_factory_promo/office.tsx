// The office, in the world the camera looks at: the real Hell Factory office as it was photographed in stages
// (tools/capture.mjs, tools/layers.py). World units are that photograph's pixels (2720 x 1880, the app at 2x).
// Everything is a function of the frame.
import { staticFile } from "raea";
import { OFFICE as O } from "./office.gen";
import { TIMES as TM } from "./kit/times.gen";
import { C, FB, clamp01, give, glide, land, lerp, pop, ramp } from "./kit/core";

type Pic = { f: string; x: number; y: number; w: number; h: number };
const TL = O.tiles;
/** a floor tile's sprite corner, its centre, and the grid corner at its top */
export const tileXY = (tx: number, ty: number) => ({ x: TL.ox + (tx - ty) * 64, y: TL.oy + (tx + ty) * 32 });
export const tileC = (tx: number, ty: number) => ({ x: TL.ox + 63 + (tx - ty) * 64, y: TL.oy + 32 + (tx + ty) * 32 });
export const vert = (tx: number, ty: number) => ({ x: TL.ox + 63 + (tx - ty) * 64, y: TL.oy + (tx + ty) * 32 });
export const T0: [number, number] = [10, 10];                        // the first tile, and the last
export const DOOR: [number, number] = [12, 9];                        // the tile the camera goes into for pixcel's bench

const P = (key: string, p: Pic, st: Record<string, any> = {}) => (
  <img key={key} src={staticFile(p.f)} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, imageRendering: "pixelated", ...st }} />
);

// ---- the floor, a tile at a time: it runs out from the first tile, then two strokes of the brush change what it is made of
const DMAX = Math.max(...TL.list.map(([tx, ty]) => Math.hypot(tx - T0[0], ty - T0[1])));
const SWEEP = [1, 2].map((kind) => {
  const xs = TL.list.filter((t) => t[3] === kind).map(([tx, ty]) => tx - ty);
  return { min: Math.min(...xs), span: Math.max(...xs) - Math.min(...xs) + 1 };
});
const tileBeat = (tx: number, ty: number) => (tx === T0[0] && ty === T0[1] ? TM.TILE : TM.SPREAD + (Math.hypot(tx - T0[0], ty - T0[1]) / DMAX) * TM.SPREAD_LEN);
const paintBeat = (tx: number, ty: number, kind: number) => TM.PAINT[kind - 1] + clamp01((tx - ty - SWEEP[kind - 1].min) / SWEEP[kind - 1].span) * TM.PAINT_LEN;
/** where the brush is during stroke s (0 or 1), k from 0 to 1: the middle of the tiles it is changing */
const STROKE = [1, 2].map((kind) => {
  const bins: { x: number; y: number; n: number }[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, n: 0 }));
  for (const [tx, ty, , kd] of TL.list) if (kd === kind) { const u = (tx - ty - SWEEP[kind - 1].min) / SWEEP[kind - 1].span, b = bins[Math.min(7, Math.floor(u * 8))], c = tileC(tx, ty); b.x += c.x; b.y += c.y; b.n++; }
  const pts = bins.map((b) => (b.n ? { x: b.x / b.n, y: b.y / b.n } : null));
  return pts.map((p, i) => p ?? pts.slice(i).find(Boolean) ?? pts.slice(0, i).reverse().find(Boolean)!) as { x: number; y: number }[];
});
export function brushAt(s: number, k: number) {
  const u = clamp01(k) * 7, i = Math.min(6, Math.floor(u)), a = STROKE[s][i], b = STROKE[s][i + 1];
  return { x: lerp(a.x, b.x, u - i), y: lerp(a.y, b.y, u - i) + 26 * Math.sin(k * 21) };
}
const FLOOR_ONE = TM.WALLS * FB - 14;                                // from here the floor is one picture
export function floor(f: number) {
  if (f < TM.TILE * FB - 12) return [];
  if (f >= FLOOR_ONE) return [P("floor", O.floor)];
  const out: any[] = [], top: any[] = [];
  for (const [tx, ty, im, kind] of TL.list) {
    const tb = tileBeat(tx, ty), first = tx === T0[0] && ty === T0[1], { x, y } = tileXY(tx, ty);
    const k = first ? land(f, tb, 12) : pop(f, tb, 12);
    if (k <= 0) continue;
    // a tile the brush changes, or one whose edge the brush draws, is plain until the stroke reaches it
    const stroke = kind || (im !== TL.base[0] ? 1 : 0), pb = stroke ? paintBeat(tx, ty, stroke) : 0;
    const kp = stroke ? pop(f, pb, 10) : 0, box = { f: "", x, y, w: TL.w, h: TL.h };
    const tr = first ? `scale(${(k * (1 + 0.1 * give(f, tb))).toFixed(4)})` : `scale(${k.toFixed(4)})`;
    if (kp < 1) out.push(P(`t${tx}_${ty}`, { ...box, f: `office/t_${stroke ? TL.base[0] : im}.png` }, { transform: tr, opacity: first ? 1 : ramp(f, tb, 5) }));
    if (kp > 0) top.push(P(`p${tx}_${ty}`, { ...box, f: `office/t_${im}.png` }, { transform: `scale(${kp.toFixed(4)})`, opacity: ramp(f, pb, 4) }));
  }
  return [...out, ...top];
}
export const tilesDown = (f: number) => TL.list.filter(([tx, ty]) => f >= tileBeat(tx, ty) * FB).length;

/** the slab the floor stands on, and the walls */
export function shell(f: number) {
  const out: any[] = [];
  const a = ramp(f, TM.SPREAD + TM.SPREAD_LEN - 0.4, 14);
  if (a > 0 && f < ROWS_END) out.push(P("slab", O.slab, { opacity: a }));
  const k = land(f, TM.WALLS, 12);
  if (k > 0 && f < ROWS_END) out.push(P("walls", O.walls, { transform: `translateY(${(-(1 - k) * 44).toFixed(2)}px)`, opacity: clamp01((f - (TM.WALLS * FB - 12)) / 8) }));
  return out;
}

// ---- the build: 36 diagonals, back to front, each cut into the pieces that stand apart. A piece falls and lands on its beat.
const ROWS_END = Math.round((TM.ROWS0 + (O.rows.length - 1) * TM.ROW_STEP) * FB) + 40;       // from here the office is one picture
const pieceFrame = (i: number, j: number) => (TM.ROWS0 + i * TM.ROW_STEP) * FB + j * 0.9;
export function build(f: number) {
  if (f < TM.BUILD0 * FB - 12 || f >= ROWS_END) return [];
  const out: any[] = [];
  O.rows.forEach((row, i) => row.pieces.forEach((p, j) => {
    const at = pieceFrame(i, j), k0 = clamp01((f - (at - 10)) / 10);
    if (k0 <= 0) return;
    const k = k0 * k0, g = give(f, at / FB);
    out.push(P(`r${i}_${j}`, p, { transformOrigin: "50% 100%", transform: `translateY(${(-(1 - k) * 54).toFixed(2)}px) scaleY(${(1 - 0.06 * g).toFixed(4)})`, opacity: clamp01((f - (at - 10)) / 4) }));
  }));
  return out;
}
/** where the hand is as row u (it may be between two rows) goes down: over the row, crossing it */
const ROWMID = O.rows.map((r) => { const x0 = Math.min(...r.pieces.map((p) => p.x)), x1 = Math.max(...r.pieces.map((p) => p.x + p.w)), y1 = Math.max(...r.pieces.map((p) => p.y + p.h)); return { x: (x0 + x1) / 2, y: y1 - 40, w: x1 - x0 }; });
export function buildHand(f: number) {
  const u = Math.max(0, Math.min(ROWMID.length - 1, (f / FB - TM.ROWS0) / TM.ROW_STEP)), i = Math.min(ROWMID.length - 2, Math.floor(u)), a = ROWMID[i], b = ROWMID[i + 1], k = u - i;
  return { x: lerp(a.x, b.x, k) + lerp(a.w, b.w, k) * 0.32 * Math.sin(u * 1.9), y: lerp(a.y, b.y, k) };
}
export const BUILD_END = TM.ROWS0 + (O.rows.length - 1) * TM.ROW_STEP;
export const piecesDown = (f: number) => { let n = 0; O.rows.forEach((row, i) => row.pieces.forEach((_, j) => { if (f >= pieceFrame(i, j)) n++; })); return n; };
export const PIECES = O.rows.reduce((a, r) => a + r.pieces.length, 0);

/** the whole office as one picture, in the theme of the moment: office, then night */
export function whole(f: number) {
  if (f < ROWS_END) return [];
  const n = ramp(f, TM.SHIFT[1], 8), out: any[] = [];
  if (n < 1) out.push(P("full", O.full));
  if (n > 0) out.push(P("night", O.night, { opacity: n }));
  return out;
}

// ---- the staff: each seated agent is what they added to the photograph, in two poses of typing. The first six sit down
// where the camera is; the rest follow outwards.
// They arrive in four scenes: the four at the shared desks, six in one block of cubicles, the Boss, then everyone else
// outwards from the middle. (The numbers are places in office.gen.ts's list, which runs from the back of the room forward.)
const HUB = [1, 2, 3, 6], BLOCK = [4, 5, 7, 12, 14, 17], BOSS = 0, FIRST = [...HUB, ...BLOCK, BOSS];
const mid = (p: Pic) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
const REST = O.staffNight.map((p, i) => ({ i, d: Math.hypot(mid(p).x - 1500, (mid(p).y - 900) * 1.6) })).filter((o) => !FIRST.includes(o.i)).sort((a, b) => a.d - b.d).map((o) => o.i);
const ORDER = [...FIRST, ...REST].map((i) => O.staffNight[i]);
const centre = (ix: number[]) => ({ x: ix.reduce((a, i) => a + mid(O.staffNight[i]).x, 0) / ix.length, y: ix.reduce((a, i) => a + mid(O.staffNight[i]).y, 0) / ix.length });
export const SCENE = { hub: centre(HUB), block: centre(BLOCK), boss: mid(O.staffNight[BOSS]) };
export const DOOR_IMG = `office/t_${TL.list.find(([tx, ty]) => tx === DOOR[0] && ty === DOOR[1])![2]}.png`;
export const STAFF_N = ORDER.length;
export const staffAt = (i: number) => ({ x: ORDER[i].x + ORDER[i].w / 2, y: ORDER[i].y });      // the top of agent i, in the order they arrive
export const staffIn = (f: number) => TM.STAFF.filter((b) => f >= b * FB).length;
export function staff(f: number) {
  if (f < TM.CLOCKIN * FB) return [];
  const out: any[] = [];
  ORDER.forEach((p, i) => {
    const b = TM.STAFF[i], k = pop(f, b, 14);
    if (k <= 0) return;
    const second = Math.floor((f + i * 7) / 9) % 2 === 1, st = { transformOrigin: "50% 100%", transform: `scale(${k.toFixed(4)})` };
    out.push(P(`s${i}a`, p, { ...st, opacity: second ? 0 : 1 }));
    out.push(P(`s${i}b`, { ...p, f: p.g }, { ...st, opacity: second ? 1 : 0 }));
    // green is a live agent: a small light over each one
    const g = pop(f, b + 0.15, 12), pulse = 0.75 + 0.25 * Math.sin((f + i * 13) / 14);
    const age = f - b * FB;                                          // and a ring goes out from where they sat down
    if (age >= 0 && age < 26) { const r = 20 + 74 * (1 - Math.pow(1 - age / 26, 2)); out.push(<div key={`s${i}r`} style={{ position: "absolute", left: p.x + p.w / 2 - r, top: p.y + p.h * 0.62 - r / 2, width: 2 * r, height: r, borderRadius: "50%", border: `4px solid ${C.green}`, boxSizing: "border-box", opacity: 0.9 * (1 - age / 26) }} />); }
    if (g > 0) out.push(<div key={`s${i}g`} style={{ position: "absolute", left: p.x + p.w / 2 - 7, top: p.y - 22, width: 14, height: 14, borderRadius: 4, background: C.green, opacity: pulse, transform: `scale(${g.toFixed(3)})`, boxShadow: `0 0 18px 4px rgba(34, 197, 94, 0.55)` }} />);
  });
  return out;
}

/** the first tile is one tile: the hand's colour is drawn round it until the floor runs out from it */
export function firstTile(f: number, z: number) {
  const a = ramp(f, TM.TILE + 0.1, 8) * (1 - ramp(f, TM.SPREAD + 0.3, 12));
  if (a <= 0) return [];
  const v = [vert(T0[0], T0[1]), vert(T0[0] + 1, T0[1]), vert(T0[0] + 1, T0[1] + 1), vert(T0[0], T0[1] + 1)], g = 1 + 0.05 * Math.sin(f / 7);
  const c = tileC(...T0), pts = v.map((p) => `${(c.x + (p.x - c.x) * 1.13 * g).toFixed(1)},${(c.y + (p.y - c.y) * 1.13 * g).toFixed(1)}`).join(" ");
  return [<svg key="first" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: a }} width={2720} height={1880} viewBox="0 0 2720 1880"><polygon points={pts} fill="none" stroke={C.blue} strokeWidth={3.5 / z} strokeLinejoin="round" /></svg>];
}

// ---- the zones: the office's own, dragged out from one grid corner to the opposite one
export const ZONES: { name: string; x: number; y: number; w: number; h: number; color: string }[] = [
  { name: "BOSS", x: 0, y: 0, w: 6, h: 5, color: C.amber },
  { name: "ZONE 2 · WORK", x: 7, y: 6, w: 12, h: 6, color: C.rose },
  { name: "ZONE 3 · WORK", x: 7, y: 13, w: 12, h: 5, color: C.rose },
  { name: "HYPERSLEEP BAY", x: 0, y: 12, w: 6, h: 6, color: C.teal },
];
const hexA = (h: string, a: number) => `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;
export const zoneDrag = (i: number, f: number) => glide(f, TM.ZONES[i], Math.round(TM.ZONE_LEN * FB));
export function zones(f: number, z: number) {
  if (f < TM.ZONES[0] * FB || f > (TM.BUILD0 + 5) * FB) return [];
  // they are there until the camera goes through the door, and again under the first pieces, which land inside them
  const away = 1 - ramp(f, TM.DOOR - 0.2, 12) + ramp(f, TM.OUT + 0.3, 12) * (1 - ramp(f, TM.BUILD0 + 2.8, 50)), out: any[] = [], shapes: any[] = [];
  ZONES.forEach((zn, i) => {
    const k = zoneDrag(i, f);
    if (f < TM.ZONES[i] * FB) return;
    const w = Math.max(0.15, zn.w * k), h = Math.max(0.15, zn.h * k);
    const pts = [vert(zn.x, zn.y), vert(zn.x + w, zn.y), vert(zn.x + w, zn.y + h), vert(zn.x, zn.y + h)].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    shapes.push(<polygon key={`z${i}`} points={pts} fill={hexA(zn.color, 0.2)} stroke={zn.color} strokeWidth={4 / Math.max(z, 0.5)} strokeDasharray={`${14 / z} ${9 / z}`} strokeLinejoin="round" />);
    const lk = pop(f, TM.ZONES[i] + TM.ZONE_LEN, 14);
    if (lk > 0) {
      const c = vert(zn.x + zn.w / 2, zn.y + zn.h / 2), fs = 33 / z, wd = zn.name.length * 0.6 * fs + 2.4 * fs;
      out.push(<div key={`zl${i}`} style={{ position: "absolute", left: c.x - wd / 2, top: c.y - fs, width: wd, height: 2 * fs, transform: `scale(${lk.toFixed(3)})`, background: C.navy, border: `${2.5 / z}px solid ${zn.color}`, borderRadius: 6 / z, boxSizing: "border-box",
        fontFamily: "Geist Mono", fontWeight: 600, fontSize: fs, lineHeight: `${2 * fs - 5 / z}px`, textAlign: "center", letterSpacing: "0.06em", color: C.cream, whiteSpace: "nowrap", opacity: 1 - ramp(f, TM.DOOR - 0.2, 12) }}>{zn.name}</div>);
    }
  });
  return [<svg key="zones" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: away }} width={2720} height={1880} viewBox="0 0 2720 1880">{shapes}</svg>, ...out];
}

// ---- what they are doing: the app's own name bubble, drawn at one size on screen whatever the camera does. Each is
// [who, in the order they arrive; the tool; the agent's colour; beats it stays (0: to the end)]
// The first four are the first four sessions of the opening, in its order and colours: the same work, now somewhere.
const TOOLS: [number, string, string, number][] = [
  [0, "Bash", C.claude, 6.4], [1, "write_file", C.blue, 5.65], [2, "apply_patch", "#94A3B8", 4.9], [3, "Grep", C.claude, 4.15], [5, "Edit", C.claude, 3.2], [8, "run_command", "#A78BFA", 2.4],
  [13, "Read", C.claude, 3.5], [17, "Bash", C.claude, 3.5], [22, "Edit", C.claude, 3.5], [27, "Grep", C.claude, 3.5], [31, "Bash", C.claude, 3.5], [35, "write_file", C.blue, 0], [20, "Edit", C.claude, 0], [29, "Bash", C.claude, 0],
];
function chip(key: string, f: number, z: number, who: number, text: string, color: string, b0: number, b1: number, dot: boolean, i: number) {
  const k = pop(f, b0, 14) * (b1 ? 1 - ramp(f, b1, 8) : 1) * (1 - ramp(f, TM.END - 0.1, 8));
  if (k <= 0.01) return null;
  const a = staffAt(who), fs = 32 / z, wd = (text.length * 0.6 + (dot ? 2.6 : 1.6)) * fs, bob = (2.5 * Math.sin((f + i * 20) / 16)) / z;
  return (<div key={key} style={{ position: "absolute", left: a.x - wd / 2, top: a.y - 26 - 4 / z - 1.9 * fs + bob, width: wd, height: 1.9 * fs, transformOrigin: "50% 100%", transform: `scale(${k.toFixed(3)})`, background: C.navy, border: `${2.5 / z}px solid ${color}`, borderRadius: 5 / z, boxSizing: "border-box" }}>
    {dot ? <div style={{ position: "absolute", left: 0.55 * fs, top: 0.62 * fs, width: 0.55 * fs, height: 0.55 * fs, background: C.green }} /> : null}
    <div style={{ position: "absolute", left: (dot ? 1.5 : 0.8) * fs, top: 0, height: 1.9 * fs, fontFamily: "Geist Mono", fontWeight: 600, fontSize: fs, lineHeight: `${1.9 * fs - 5 / z}px`, color: dot ? C.cream : color, letterSpacing: dot ? "0em" : "0.1em", whiteSpace: "nowrap" }}>{text}</div>
  </div>);
}
export function bubbles(f: number, z: number) {
  if (f < TM.CLOCKIN * FB) return [];
  const out = TOOLS.map(([who, tool, color, stay], i) => chip(`b${i}`, f, z, who, tool, color, TM.BUBBLES[i], stay ? TM.BUBBLES[i] + stay : 0, true, i));
  out.push(chip("bboss", f, z, FIRST.length - 1, "BOSS", C.amber, TM.STAFF[FIRST.length - 1] + 0.2, 0, false, 5));
  return out.filter(Boolean);
}
