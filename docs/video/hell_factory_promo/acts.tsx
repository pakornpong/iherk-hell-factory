// What sits on the screen rather than in the office: the sessions and their question, the large words, the counts,
// pixcel's bench, the pointer (in the world), the brand in the corner and the mark at the end. All functions of the frame.
import { staticFile } from "raea";
import { PX } from "./px.gen";
import { LINE, TIMES as TM } from "./kit/times.gen";
import { BASE, C, D, FB, M, T, arr, clamp01, glide, inOutCubic, lerp, mw, pop, ramp, thai, tw } from "./kit/core";
import { S, pieces, units } from "./kit/lang";
import { BUILD_END, DOOR, DOOR_IMG, PIECES, STAFF_N, T0, ZONES, brushAt, buildHand, piecesDown, staffIn, tileC, tilesDown, vert } from "./office";

const W = 1920, H = 1080;
type St = Record<string, any>;

// ---- the sessions: six agents at work with nowhere to be, and the question
const LOGS: [string, string, string, string][] = [
  ["claude-code", "Bash", "npm run build", C.claude], ["gemini-cli", "write_file", "src/api/routes.ts", C.blue], ["codex", "apply_patch", "fix: retry on 429", "#94A3B8"],
  ["claude-code", "Grep", "\"useEffect(\"", C.claude], ["antigravity", "run_command", "flutter test", "#A78BFA"], ["claude-code", "Edit", "README.md", C.claude],
];
const QS = 98, QLS = thai(LINE) ? 0 : -0.03, KEYS = units(LINE), QX = (W - tw(LINE, QS, "geist600", QLS)) / 2, QB = 800;    // a line with Thai in it is not tracked, from its first letter
export function sessions(f: number) {
  if (f > (TM.TILE + 0.5) * FB) return [];
  const out: any[] = [], fall = (i: number) => glide(f, TM.COLLAPSE + i * 0.085, 18);
  const to = (x: number, y: number, k: number): St => ({ transformOrigin: "0 0", transform: `translate(${((960 - x) * k).toFixed(2)}px, ${((540 - y) * k).toFixed(2)}px) scale(${(1 - k).toFixed(4)})`, opacity: 1 - k * k });
  LOGS.forEach(([who, tool, arg, color], i) => {
    const b = TM.LOGS[i], a = ramp(f, b, 6), k = arr(f, b, 14), c = fall(i);
    if (a <= 0 || c >= 1) return;
    const x = 356, y = 168 + i * 72, busy = Math.floor((f + i * 9) / 10) % 4;
    out.push(<div key={`lg${i}`} style={{ position: "absolute", left: x, top: y + (1 - k) * 18, width: 1300, height: 60, opacity: a, ...(c > 0 ? to(x, y, c) : {}) }}>
      <div style={{ position: "absolute", left: 0, top: 20, width: 18, height: 18, borderRadius: 4, background: color }} />
      {M("w", 46, 44, 38, who, { color: C.dim })}
      {M("t", 356, 44, 38, tool, { color: C.cream, fontWeight: 600 })}
      {M("a", 676, 44, 38, arg, { color: "#737B8F" })}
      {M("b", 676 + mw(arg, 38) + 18, 44, 38, "▪".repeat(busy + 1), { color: color, opacity: 0.85 })}
    </div>);
  });
  // the question, typed where the camera already is
  const n = Math.max(0, Math.min(KEYS.length, Math.floor((f - TM.ASK0 * FB) / TM.ASK_PER))), c = fall(7);
  if (f >= TM.ASK0 * FB - 8 && c < 1) {
    const shown = KEYS.slice(0, n).join(""), cx = QX + tw(shown, QS, "geist600", QLS), blink = n < KEYS.length || Math.floor(f / 16) % 2 === 0;
    out.push(<div key="q" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...(c > 0 ? to(0, 0, c) : {}) }}>
      {T("qt", QX, QB, QS, shown, { fontWeight: 600, letterSpacing: `${QLS}em` })}
      {blink ? <div style={{ position: "absolute", left: cx + 8, top: QB - QS * 0.78, width: 6, height: QS * 0.92, background: C.blue, opacity: ramp(f, TM.ASK0 - 0.25, 6) }} /> : null}
    </div>);
  }
  // the point they fall to: where the first tile lands
  const dot = ramp(f, TM.COLLAPSE + 0.5, 8) * (1 - ramp(f, TM.TILE - 0.1, 3));
  const push = 1 + 0.07 * clamp01(f / (TM.COLLAPSE * FB));              // the view closes on them slowly until they fall
  const all = [<div key="sess" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "960px 560px", transform: `scale(${push.toFixed(5)})` }}>{out}</div>];
  if (dot > 0) all.push(D("pt", 960, 540, 7 + 2 * Math.sin(f / 5), C.blue, { opacity: dot, boxShadow: "0 0 24px 6px rgba(56, 189, 248, 0.5)" }));
  return all;
}

// ---- the large words: top left, a word at a time on the beat
type Say = { key: string; lines: string[]; b0: number; step: number; out: number; size?: number; x?: number; y?: number; plate?: boolean; dim?: boolean };
/** a line's width as say() sets it: a piece at a time */
const lineW = (line: string, size: number, face = "geist600", ls = -0.03) => pieces(line).reduce((w, [p, sp]) => w + tw(p, size, face, ls) + (sp ? tw(" ", size, face, ls) : 0), 0);
function say(f: number, s: Say, ink: string) {
  const size = s.size ?? 92, lh = Math.round(size * (thai(s.lines.join("")) ? 1.2 : 1.08)),      // Thai stacks marks above and below its letters: its lines stand further apart
  x = s.x ?? 96, y = s.y ?? 84, away = ramp(f, s.out, 10);
  if (f < s.b0 * FB - 1 || away >= 1) return [];
  const out: any[] = []; let n = 0;
  if (s.plate) {
    const wd = Math.max(...s.lines.map((l) => lineW(l, size))), a = ramp(f, s.b0, 8) * (1 - away);
    out.push(<div key={`${s.key}pl`} style={{ position: "absolute", left: x - 34, top: y - 22, width: wd + 68, height: s.lines.length * lh + 40, borderRadius: 22, background: "rgba(9, 11, 18, 0.84)", opacity: a }} />);
  }
  s.lines.forEach((line, li) => {
    let cx = x;
    for (const [word, sp] of pieces(line)) {
      const b = s.b0 + n * s.step, k = arr(f, b, 14), a = ramp(f, b, 4) * (1 - away);
      if (a > 0.01) out.push(T(`${s.key}${n}`, cx, y + li * lh + BASE * size, size, word, { fontWeight: 600, letterSpacing: "-0.03em", color: s.plate ? C.cream : ink, opacity: a * (s.dim ? 0.62 : 1), transform: `translateY(${((1 - k) * 28 - away * 12).toFixed(2)}px)` }));
      cx += tw(word, size, "geist600", -0.03) + (sp ? tw(" ", size, "geist600", -0.03) : 0); n++;
    }
  });
  return out;
}
const SAYS: Say[] = [
  { key: "w1", lines: S.w1, b0: TM.TILE + 0.25, step: 0.4, out: TM.SPREAD + 1.3 },
  { key: "w2", lines: S.w2, b0: TM.PAINT[0], step: 0.35, out: TM.WALLS - 0.7 },
  { key: "w2b", lines: S.w2b, b0: TM.WALLS - 0.35, step: 0.3, out: TM.ZONES[0] - 0.3 },
  { key: "w3", lines: S.w3, b0: TM.ZONES[0], step: 0.5, out: TM.DOOR - 0.5 },
  { key: "w4", lines: S.w4, b0: TM.BUILD0 + 0.25, step: 0.5, out: TM.BUILD0 + 3 },
  { key: "w5", lines: S.w5, b0: TM.BUILD0 + 3.5, step: 0.5, out: TM.ROOMS[0] - 0.5 },
  { key: "w6", lines: S.w6, b0: TM.ROOMS[0], step: 0, out: TM.ROOMS[1] - 0.25, size: 72, y: 904, plate: true },
  { key: "w7", lines: S.w7, b0: TM.ROOMS[1], step: 0, out: TM.ROOMS[2] - 0.25, size: 72, y: 904, plate: true },
  { key: "w8", lines: S.w8, b0: TM.ROOMS[2], step: 0, out: TM.SHIFT[1] - 0.7, size: 72, y: 904, plate: true },
  { key: "w10", lines: S.w10, b0: TM.SHIFT[1], step: 0.5, out: TM.SHIFT[1] + 2.3 },
  { key: "w11", lines: S.w11, b0: TM.CLOCKIN + 0.2, step: 0.2, out: TM.SCENES[0] - 0.25, plate: true },
  { key: "w12", lines: S.w12, b0: TM.SCENES[0] + 0.05, step: 0, out: TM.SCENES[1] - 0.25, plate: true },
  { key: "w12b", lines: S.w12b, b0: TM.SCENES[1] + 0.05, step: 0, out: TM.SCENES[2] - 0.25, plate: true },
  { key: "w12c", lines: S.w12c, b0: TM.SCENES[2] + 0.6, step: 0.3, out: TM.ASK - 0.5 },
  { key: "w13", lines: S.w13, b0: TM.ASK, step: 0.2, out: TM.END, size: 54, dim: true },
  { key: "w14", lines: S.w14, b0: TM.ANSWER, step: 0.5, out: TM.END, size: 84, y: 222 },
];
export const words = (f: number, dk: number) => SAYS.flatMap((s) => say(f, s, dk > 0.5 ? C.cream : C.ink));

// ---- the counts: bottom left, each the number of things on screen at that moment
function count(key: string, f: number, b0: number, b1: number, n: number, label: string, extra?: { text: string; from: number }, green = false) {
  const a = ramp(f, b0, 8) * (1 - ramp(f, b1, 10));
  if (a <= 0) return [];
  const num = String(n), nw = mw(num, 60), LP = thai(label) ? 42 : 32, lw = mw(label, LP, 0.1),      // Thai has no capitals: its label is set larger to read at the size the English one does
  x = 96, y = 968, k = arr(f, b0, 14);
  const ea = extra ? ramp(f, extra.from, 10) : 0, ew = extra ? mw(extra.text, 30) : 0, wd = Math.max(nw + 18 + lw + (green ? 40 : 0), ew * ea);
  return [<div key={key} style={{ position: "absolute", left: x - 30, top: y - 74 - (ea > 0 ? 54 * ea : 0), width: wd + 60, height: 104 + (ea > 0 ? 54 * ea : 0), opacity: a, transform: `translateY(${((1 - k) * 20).toFixed(2)}px)`, borderRadius: 20, background: "rgba(9, 11, 18, 0.84)" }}>
    {ea > 0 ? M("e", 30, 50, 30, extra!.text, { color: C.dim, opacity: ea }) : null}
    <div style={{ position: "absolute", left: 30, top: ea > 0 ? 54 * ea : 0, width: wd, height: 104 }}>
      {green ? <div style={{ position: "absolute", left: 0, top: 42, width: 22, height: 22, borderRadius: 6, background: C.green, boxShadow: "0 0 20px 4px rgba(34, 197, 94, 0.5)", opacity: 0.75 + 0.25 * Math.sin(f / 9) }} /> : null}
      {M("n", green ? 40 : 0, 74, 60, num, { fontWeight: 500, color: C.cream })}
      {M("l", (green ? 40 : 0) + nw + 18, 72, LP, label, { color: C.dim, letterSpacing: "0.1em" })}
    </div>
  </div>];
}
export function counts(f: number) {
  return [
    ...count("ct", f, TM.TILE + 0.5, TM.WALLS + 1.5, tilesDown(f), tilesDown(f) === 1 ? S.tile : S.tiles),
    ...count("cp", f, TM.BUILD0, TM.ROOMS[0] - 0.5, piecesDown(f), S.pieces.replace("#", String(PIECES))),
    ...count("cs", f, TM.CLOCKIN, TM.END, Math.min(staffIn(f), STAFF_N), S.agents, { text: "CLAUDE CODE · GEMINI CLI · CODEX · ANTIGRAVITY", from: TM.SCENES[2] + 1 }, true),
  ];
}

// ---- pixcel's bench: the desk written a voxel operation at a time, turned through its four directions, and the library
const OPS = PX.ops.map((s) => JSON.parse(s) as any).map((o) => (o.op === "box" ? [o.op, o.from.join(","), o.to.join(","), o.material] : [o.op, (o.center ?? []).join(","), `r ${o.radius}`, o.material]));
const DX = 1340, DY = 610, SX = 192, SY = 96;                       // where the desk's footprint is centred, and a tile's half steps at the desk's scale
const benchIn = (f: number) => ramp(f, TM.DOOR + 0.55, 10), benchOut = (f: number) => ramp(f, TM.OUT + 0.1, 12);
/** how much of the office is gone: it fades as the camera closes on the tile, before the floor can fill the frame, and is back as the camera leaves */
export const worldGone = (f: number) => ramp(f, TM.DOOR + 0.3, 14) * (1 - ramp(f, TM.OUT + 0.45, 18));
export const DOOR_AT = { x: DX, y: DY, z: (6 * SX) / 126 };            // where the door tile sits on screen, and how large, when it is the bench
export const benchAlpha = (f: number) => benchIn(f) * (1 - benchOut(f));
const DIRS = ["SE", "SW", "NW", "NE"];
export function bench(f: number, ink: string) {
  const a = benchAlpha(f);
  if (a <= 0) return [];
  const out: any[] = [], lib = glide(f, TM.LIB, 26), go = benchOut(f);
  const ha = ramp(f, TM.DOOR + 1, 10);
  out.push(M("bl", 96, 80, 30, "IHERK-PIXCEL", { color: C.blue, letterSpacing: "0.14em", fontWeight: 600, opacity: ha }));
  out.push(M("bl2", 96 + mw("IHERK-PIXCEL", 30) + 12 * 30 * 0.14 + 24, 80, thai(S.engine) ? 38 : 30, S.engine, { color: C.dim, letterSpacing: "0.14em", opacity: ha }));
  // the tile the camera came in through: it is the bench, and turns into its grid
  const ta = ramp(f, TM.DOOR + 0.62, 8) * (1 - ramp(f, TM.DOOR + 1.05, 14)) + ramp(f, TM.OUT - 0.45, 10);
  if (ta > 0) out.push(<img key="door" src={staticFile(DOOR_IMG)} style={{ position: "absolute", left: DX - 63 * DOOR_AT.z, top: DY - 32 * DOOR_AT.z, width: 126 * DOOR_AT.z, height: 64 * DOOR_AT.z, imageRendering: "pixelated", opacity: clamp01(ta) }} />);
  out.push(...say(f, { key: "b1", lines: S.b1, b0: TM.OPS[0], step: 0.5, out: TM.TURNS[0] - 0.4, size: 80, y: 118 }, ink));
  out.push(...say(f, { key: "b2", lines: S.b2, b0: TM.TURNS[0], step: 0.25, out: TM.LIB - 0.2, size: 80, y: 118 }, ink));
  out.push(...say(f, { key: "b3", lines: S.b3, b0: TM.LIB + 0.1, step: 0.2, out: TM.OUT - 0.4, size: 80, y: 118 }, ink));
  // the rows of the library, behind the desk
  if (lib > 0) PX.wall.forEach((row, r) => {
    const s = 0.7, y = 392 + r * 228, dir = r % 2 ? 1 : -1, t = f - TM.LIB * FB, x0 = (dir < 0 ? -60 - t * 5 : W - row.w * s + 60 + t * 5) + dir * -(1 - glide(f, TM.LIB + r * 0.2, 26)) * 520;
    row.f.forEach((file, h) => out.push(<img key={`lw${r}${h}`} src={staticFile(file)} style={{ position: "absolute", left: x0 + (h ? row.half * s : 0), top: y, width: (h ? row.w - row.half : row.half) * s, height: row.h * s, imageRendering: "pixelated", opacity: glide(f, TM.LIB + r * 0.2, 20) * (1 - ramp(f, TM.OUT - 0.5, 10)) }} />));
  });
  // the model's own operations, a line each as it is drawn
  const step = TM.OPS.filter((b: number) => f >= b * FB).length, nOps = step ? PX.steps[step - 1].n : 0, ca = (1 - lib) * ramp(f, TM.OPS[0] - 0.5, 10);
  if (ca > 0) {
    const LH = 44, top = 478, rows = 8, first = Math.max(0, nOps - rows), since = step ? f - TM.OPS[step - 1] * FB : 99;
    out.push(M("cf", 96, top - 22, 30, `desk-dev-dual.pixcel.json`, { color: C.dim, opacity: ca }));
    out.push(M("cc", 96 + mw("desk-dev-dual.pixcel.json", 30) + 24, top - 22, 30, `${nOps} / ${PX.opCount} ops`, { color: C.blue, opacity: ca }));
    for (let i = first; i < nOps; i++) {
      const fresh = step && i >= (step > 1 ? PX.steps[step - 2].n : 0), y = top + 36 + (i - first) * LH, hot = fresh ? clamp01(1 - since / 22) : 0, o = OPS[i];
      const col = hot > 0 ? C.cream : "#B4BBCC";
      out.push(<div key={`op${i}`} style={{ position: "absolute", left: 96, top: y - 30, width: 760, height: LH, opacity: ca * (fresh ? ramp(f, TM.OPS[step - 1], 5) : 1) }}>
        {hot > 0 ? <div style={{ position: "absolute", left: -16, top: 3, width: 6, height: 34, background: C.blue, opacity: hot }} /> : null}
        {M("a", 0, 30, 30, o[0], { color: hot > 0 ? C.blue : C.dim })}
        {M("b", 170, 30, 30, o[1], { color: col })}
        {M("c", 350, 30, 30, o[2], { color: col })}
        {M("d", 530, 30, 30, o[3], { color: C.dim })}
      </div>);
    }
  }
  // the bench: three tiles by three of grid under the desk, which is one picture a step
  const ga = (1 - lib) * ramp(f, TM.DOOR + 1.05, 14), lines: any[] = [];
  const g = (u: number, v: number) => `${(DX + (u - v) * SX).toFixed(1)},${(DY + (u + v) * SY).toFixed(1)}`;
  if (ga > 0) {
    for (let i = 0; i <= 3; i++) lines.push(<path key={`g${i}`} d={`M${g(i - 1.5, -1.5)}L${g(i - 1.5, 1.5)}M${g(-1.5, i - 1.5)}L${g(1.5, i - 1.5)}`} stroke="rgba(160, 170, 255, 0.5)" strokeWidth={2} fill="none" />);
    out.push(<svg key="grid" style={{ position: "absolute", left: 0, top: 0, opacity: ga }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polygon points={`${g(-1.5, -1.5)} ${g(1.5, -1.5)} ${g(1.5, 1.5)} ${g(-1.5, 1.5)}`} fill="rgba(180, 190, 255, 0.13)" />{lines}</svg>);
  }
  const turn = TM.TURNS.filter((b: number) => f >= b * FB - 5).length, lit = f >= TM.SCREEN * FB;
  const file = turn ? PX.dirs[turn % 4].f : lit ? PX.dirs[0].f : step ? PX.steps[step - 1].f : null;
  if (file) {
    const last = turn ? TM.TURNS[turn - 1] : lit ? TM.SCREEN : TM.OPS[step - 1], age = f - last * FB;
    const sq = turn ? 1 - 0.5 * Math.max(0, 1 - Math.abs(age) / 5) : 1, hop = turn && age >= -5 && age < 12 ? -22 * Math.sin(((age + 5) / 17) * Math.PI) : 0, tick = !turn && age < 7 ? 1 + 0.035 * (1 - age / 7) : 1;
    const sc = lerp(1, 0.4, lib), cy = lerp(DY, 620, lib), cx = lerp(DX, 960, lib);
    out.push(<img key="desk" src={staticFile(file)} style={{ position: "absolute", left: cx - PX.cx, top: cy - PX.cy + hop, width: PX.w, height: PX.h, imageRendering: "pixelated", opacity: 1 - clamp01(lib * 1.6 - 0.4), transformOrigin: `${PX.cx}px ${PX.cy}px`, transform: `scale(${(sc * sq * tick).toFixed(4)}, ${(sc * tick).toFixed(4)})` }} />);
  }
  // its four directions, named
  const da = ramp(f, TM.SCREEN + 0.4, 10) * (1 - lib);
  if (da > 0) DIRS.forEach((d, i) => {
    const on = (turn % 4) === i, x = DX - 255 + i * 170;
    out.push(M(`dr${i}`, x - mw(d, 44) / 2, 992, 44, d, { color: on ? C.blue : C.faint, fontWeight: on ? 600 : 400, opacity: da }));
    if (on) out.push(<div key={`du${i}`} style={{ position: "absolute", left: x - 32, top: 1010, width: 64, height: 6, borderRadius: 3, background: C.blue, opacity: da }} />);
  });
  return [<div key="bench" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: benchIn(f) * (1 - go) }}>{out}</div>];
}

// ---- the pointer: the designer's hand, in the world. Where it is on each beat, and when it is down.
const C0 = tileC(...T0), CD = tileC(...DOOR), zc = (i: number, far: boolean) => vert(ZONES[i].x + (far ? ZONES[i].w : 0), ZONES[i].y + (far ? ZONES[i].h : 0));
const PATH: [number, number, number][] = [
  [TM.TILE + 0.5, C0.x + 330, C0.y + 250], [TM.SPREAD - 0.2, C0.x + 14, C0.y + 4], [TM.SPREAD, C0.x + 14, C0.y + 4], [TM.SPREAD + TM.SPREAD_LEN, vert(20, 20).x + 30, vert(20, 20).y - 10],
  [TM.PAINT[0], brushAt(0, 0).x, brushAt(0, 0).y], [TM.PAINT[0] + TM.PAINT_LEN, brushAt(0, 1).x, brushAt(0, 1).y], [TM.PAINT[1], brushAt(1, 0).x, brushAt(1, 0).y], [TM.PAINT[1] + TM.PAINT_LEN, brushAt(1, 1).x, brushAt(1, 1).y],
  [TM.WALLS, 2120, 1380], [TM.ZONES[0] - 0.9, 2120, 1380],
  ...ZONES.flatMap((_, i) => [[TM.ZONES[i] - 0.1, zc(i, false).x, zc(i, false).y], [TM.ZONES[i] + TM.ZONE_LEN, zc(i, true).x, zc(i, true).y]] as [number, number, number][]),
  [TM.DOOR - 0.3, CD.x, CD.y], [TM.DOOR + 1, CD.x, CD.y],
];
const DOWN: [number, number][] = [[TM.SPREAD, TM.SPREAD + TM.SPREAD_LEN], [TM.PAINT[0], TM.PAINT[0] + TM.PAINT_LEN], [TM.PAINT[1], TM.PAINT[1] + TM.PAINT_LEN], ...ZONES.map((_, i) => [TM.ZONES[i], TM.ZONES[i] + TM.ZONE_LEN] as [number, number]), [TM.DOOR - 0.25, TM.DOOR]];
export function pointerAt(f: number) {
  const b = f / FB;
  for (let s = 0; s < 2; s++) if (b >= TM.PAINT[s] && b <= TM.PAINT[s] + TM.PAINT_LEN) return brushAt(s, (b - TM.PAINT[s]) / TM.PAINT_LEN);
  if (b >= TM.OUT) { const h = buildHand(f), k = inOutCubic(clamp01((b - BUILD_END) / 1.2)); return { x: lerp(h.x, 2150, k), y: lerp(h.y, 1400, k) }; }
  if (b <= PATH[0][0]) return { x: PATH[0][1], y: PATH[0][2] };
  for (let i = 1; i < PATH.length; i++) if (b < PATH[i][0]) { const k = inOutCubic((b - PATH[i - 1][0]) / (PATH[i][0] - PATH[i - 1][0])); return { x: lerp(PATH[i - 1][1], PATH[i][1], k), y: lerp(PATH[i - 1][2], PATH[i][2], k) }; }
  return { x: PATH[PATH.length - 1][1], y: PATH[PATH.length - 1][2] };
}
export function pointer(f: number, z: number) {
  const a = ramp(f, TM.TILE + 0.5, 10) * (1 - ramp(f, TM.DOOR + 0.2, 8)) + ramp(f, TM.BUILD0 - 0.3, 10) * (1 - ramp(f, TM.ROOMS[0] - 0.4, 8));
  if (a <= 0) return [];
  const b = f / FB, p = pointerAt(f), out: any[] = [], s = 1 / z;
  let down = 0;
  for (const [d0, d1] of DOWN) {
    if (b >= d0 && b < d1 + 0.2) down = 1;
    const age = f - d0 * FB;                                         // a ring leaves the place it pressed
    if (age >= 0 && age < 22) { const r = (18 + 44 * (1 - Math.pow(1 - age / 22, 2))) * s; out.push(D(`pr${d0}`, p.x, p.y, r, "rgba(0,0,0,0)", { border: `${3 * s}px solid ${C.blue}`, boxSizing: "border-box", opacity: (1 - age / 22) * a })); }
  }
  out.push(<svg key="ptr" style={{ position: "absolute", left: p.x - 4 * s, top: p.y - 3 * s, overflow: "visible", opacity: a, transformOrigin: "0 0", transform: `scale(${(1.3 * s * (1 - 0.12 * down)).toFixed(4)})` }} width={44} height={56} viewBox="0 0 44 56">
    <path d="M4 3 L4 43 L14 34 L21 51 L28 48 L21 31 L35 31 Z" fill={C.blue} stroke="#FFFFFF" strokeWidth={3.5} strokeLinejoin="round" />
  </svg>);
  return out;
}

// ---- the mark: the app's own header, its light drawn as one floor tile. Grey until agents arrive, green after.
export function tileMark(key: string, cx: number, cy: number, w: number, live: number, st: St = {}) {
  const h = w / 2, t = w * 0.13, top = live > 0.5 ? C.green : "#6B7280", l = live > 0.5 ? "#15803D" : "#4B5563", r = live > 0.5 ? "#166534" : "#374151";
  return (<svg key={key} style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, overflow: "visible", ...st }} width={w} height={h + t} viewBox={`0 0 ${w} ${h + t}`}>
    {live > 0.5 ? <ellipse cx={w / 2} cy={h / 2 + t} rx={w * 0.62} ry={h * 0.62} fill="rgba(34, 197, 94, 0.22)" /> : null}
    <polygon points={`0,${h / 2} ${w / 2},${h} ${w / 2},${h + t} 0,${h / 2 + t}`} fill={l} />
    <polygon points={`${w},${h / 2} ${w / 2},${h} ${w / 2},${h + t} ${w},${h / 2 + t}`} fill={r} />
    <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} fill={top} />
  </svg>);
}
/** the brand, small in the corner from the first tile to the end */
export function brand(f: number, dk: number) {
  const a = ramp(f, TM.TILE + 0.3, 12) * (1 - ramp(f, TM.END, 12));
  if (a <= 0) return [];
  const live = f >= TM.CLOCKIN * FB ? 1 : 0, bump = live ? 1 + 0.5 * Math.max(0, 1 - (f - TM.CLOCKIN * FB) / 16) : 1, ink = dk > 0.5 ? C.cream : C.ink, x = W - 96 - mw("HELL FACTORY", 30) - 12 * 30 * 0.14;
  return [
    <div key="bp" style={{ position: "absolute", left: x - 80, top: 38, width: W - 96 - x + 100, height: 60, borderRadius: 14, background: dk > 0.5 ? "rgba(9, 11, 18, 0.7)" : "rgba(255, 255, 255, 0.6)", opacity: a }} />,
    tileMark("bt", x - 38, 66, 40, live, { opacity: a, transformOrigin: "50% 50%", transform: `scale(${bump.toFixed(3)})` }),
    M("bn", x, 79, 30, "HELL FACTORY", { color: ink, letterSpacing: "0.14em", fontWeight: 600, opacity: a * 0.92 }),
  ];
}
export function lockup(f: number) {
  if (f < (TM.END + 1.2) * FB) return [];
  const out: any[] = [], NS = 124, name = "HELL FACTORY", nw = mw(name, NS) + name.length * NS * 0.02, TW = 118, total = TW + 44 + nw, x0 = (W - total) / 2;
  const k = glide(f, TM.MARK - 0.6, 24), tx = lerp(960, x0 + TW / 2, k), ty = lerp(540, 492, k), ts = lerp(0.55, 1, k) * pop(f, TM.END + 1.2, 16);
  out.push(tileMark("lt", tx, ty, TW, 1, { transformOrigin: "50% 50%", transform: `scale(${ts.toFixed(4)})` }));
  ["HELL", "FACTORY"].forEach((wd, i) => {
    const b = TM.MARK + i * 0.5, kk = arr(f, b, 16), a = ramp(f, b, 6);
    if (a > 0) out.push(M(`ln${i}`, x0 + TW + 44 + (i ? mw("HELL ", NS) + 5 * NS * 0.02 : 0), 540, NS, wd, { fontWeight: 700, letterSpacing: "0.02em", color: C.cream, opacity: a, transform: `translateY(${((1 - kk) * 30).toFixed(2)}px)` }));
  });
  const LS = thai(S.tagline) ? 64 : 56; let cx = (W - lineW(S.tagline, LS, "geist500", -0.02)) / 2;
  pieces(S.tagline).forEach(([wd, sp], i) => {
    const b = TM.LINE + i * 0.25, kk = arr(f, b, 14), a = ramp(f, b, 6);
    if (a > 0) out.push(T(`ll${i}`, cx, 668, LS, wd, { color: C.cream, opacity: a * 0.92, transform: `translateY(${((1 - kk) * 20).toFixed(2)}px)` }));
    cx += tw(wd, LS, "geist500") + (sp ? tw(" ", LS, "geist500") : 0);
  });
  const cr = "iherk-hell-factory  +  iherk-pixcel", ca = ramp(f, TM.CREDIT, 14);
  if (ca > 0) out.push(M("lc", (W - mw(cr, 38)) / 2, 806, 38, cr, { color: "#AEB5C6", opacity: ca }));
  for (const b of [TM.MARK]) {
    const age = f - b * FB;
    if (age >= 0 && age < 50) { const r = 40 + 190 * (1 - Math.pow(1 - age / 50, 2)); out.push(<div key={`lr${b}`} style={{ position: "absolute", left: tx - r, top: ty - r / 2, width: 2 * r, height: r, borderRadius: "50%", border: "3px solid rgba(34, 197, 94, 0.8)", boxSizing: "border-box", opacity: 0.7 * (1 - age / 50) }} />); }
  }
  const fwd = 1 + 0.045 * clamp01((f - TM.MARK * FB) / ((76 - TM.MARK) * FB));
  return [<div key="lock" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "960px 560px", transform: `scale(${fwd.toFixed(5)})` }}>{out}</div>];
}
