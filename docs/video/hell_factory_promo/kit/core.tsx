// The kit (Plus One's, on this film's colours): the clock, the colours, the curves and the plain parts. Everything is a function of the frame number,
// called from the one component that reads the frame. The curves keep the skill's rule for moves (SKILL.md, "Moves a
// viewer can watch"): an arrival decelerates into place over 12 frames or more, a camera eases in and out, and only a
// hit is instant.
import { staticFile } from "raea";
import { GEIST, GEIST_MONO } from "./fonts.gen";
import { ADV } from "./metrics.gen";
import { TADV, THAI_M, THAI_R } from "./thai.gen";
import { CLOCK } from "./times.gen";

// the clock is sound.py's (kit/times.gen.ts): 60 frames a second, 32 frames a beat (112.5 beats a minute), a bar four beats.
// W and H are the world the kit draws in (svg below); the film's frame size is score.json's (film.tsx): change both together
export const W = 1920, H = 1080, FPS = CLOCK.FPS;
export const FB = CLOCK.FB;
export const BASE = 0.855;                 // Geist's baseline below the top of a line box one em tall
export const C = { bg: "#090B12", cream: "#F3F0E8", dim: "#98A0B3", faint: "#5B6274", ink: "#0F1422", blue: "#38BDF8", green: "#22C55E", amber: "#F59E0B", rose: "#F43F5E", teal: "#14B8A6", claude: "#D97757", navy: "rgba(13, 18, 32, 0.92)" };
/** the faces: Geist for words and Geist Mono for labels and counts, both embedded. Geist has no Thai, so a line with Thai in it
 * also names Kanit's Thai block (thai.gen.ts): Medium beside Geist 600 and up, Regular beside the lighter weights. */
export const FONTS = `@font-face { font-family: "Geist"; src: url(${GEIST}); font-weight: 100 900; } @font-face { font-family: "Geist Mono"; src: url(${GEIST_MONO}); font-weight: 100 900; } @font-face { font-family: "HF Thai"; src: url(${THAI_R}); font-weight: 100 900; } @font-face { font-family: "HF Thai M"; src: url(${THAI_M}); font-weight: 100 900; } `;
export const thai = (s: string) => /[\u0E00-\u0E7F]/.test(s);

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const inCubic = (x: number) => x * x * x;
export const inOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** past the mark a little, then back onto it: for a thing that lands with some spring */
export const outBack = (x: number, s = 1.4) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
/** an arrival you can watch: 0 to 1 from beat b, decelerating into place over n frames */
export const arr = (f: number, b: number, n = 14) => outCubic(clamp01((f - b * FB + 1) / n));
/** a move with weight: eases in and out over n frames from beat b */
export const glide = (f: number, b: number, n = 20) => inOutCubic(clamp01((f - b * FB + 1) / n));
/** a landing with spring from beat b over n frames */
export const pop = (f: number, b: number, n = 16) => { const k = clamp01((f - b * FB + 1) / n); return k <= 0 ? 0 : outBack(k); };
/** a fall that lands on beat b: 0 to 1 over the n frames before it, gathering speed, as a thing dropped does */
export const land = (f: number, b: number, n = 10) => { const k = clamp01((f - (b * FB - n)) / n); return k * k; };
/** the give after a landing: 1 on the beat, gone 9 frames later */
export const give = (f: number, b: number) => { const a = f - b * FB; return a < 0 || a > 9 ? 0 : Math.sin((a / 9) * Math.PI) * (1 - a / 9); };
/** 0 to 1, straight, from beat b over n frames: for fades */
export const ramp = (f: number, b: number, n = 8) => clamp01((f - b * FB + 1) / n);
export const on = (f: number, b: number) => f >= b * FB;
export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
/** a line's width in Geist. A line with Thai in it is set without tracking (T below), and a Thai mark has no width of its own */
export const tw = (s: string, px: number, face = "geist500", ls = -0.02) => { const ta = TADV[face === "geist600" ? "m" : "r"]; let w = 0; for (const ch of s) w += ta[ch] ?? ADV[face][ch] ?? 0.6; return (w + (thai(s) ? 0 : ls * s.length)) * px; };
/** a line's width in Geist Mono, with `ls` ems of tracking */
export const mw = (s: string, px: number, ls = 0) => { if (!thai(s)) return (0.6 + ls) * px * s.length; let w = 0; for (const ch of s) w += TADV.r[ch] ?? 0.6; return w * px; };

type St = Record<string, any>;
/** a line of Geist with its baseline at `base` */
export const T = (key: string, x: number, base: number, size: number, text: any, st: St = {}) => {
  const th = typeof text === "string" && thai(text) ? { fontFamily: `'${st.fontFamily ?? "Geist"}', '${(st.fontWeight ?? 500) >= 600 ? "HF Thai M" : "HF Thai"}'`, letterSpacing: "0em" } : {};
  return <div key={key} style={{ position: "absolute", left: x, top: base - BASE * size, fontFamily: "Geist", fontWeight: 500, fontSize: size, lineHeight: `${size}px`, letterSpacing: "-0.02em", color: C.cream, whiteSpace: "nowrap", ...st, ...th }}>{text}</div>;
};
export const M = (key: string, x: number, base: number, size: number, text: any, st: St = {}) => T(key, x, base, size, text, { fontFamily: "Geist Mono", fontWeight: 400, letterSpacing: "0em", ...st });
/** a line in any face, set in a box so it can be centred or ranged right without measuring it */
export const L = (key: string, x: number, y: number, w: number, size: number, text: any, st: St = {}) => (
  <div key={key} style={{ position: "absolute", left: x, top: y, width: w, fontSize: size, lineHeight: `${Math.round(size * 1.06)}px`, color: C.ink, whiteSpace: "nowrap", textAlign: "center", ...st }}>{text}</div>
);
export const D = (key: string, cx: number, cy: number, r: number, color: string, st: St = {}) => (
  <div key={key} style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: color, ...st }} />
);
export const R = (key: string, x: number, y: number, w: number, h: number, st: St = {}) => (
  <div key={key} style={{ position: "absolute", left: x, top: y, width: w, height: h, ...st }} />
);
/** an svg the size of the world that does not clip what the camera sees beyond it */
export const svg = (key: string, children: any, st: St = {}) => (
  <svg key={key} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", ...st }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>{children}</svg>
);
export const circ = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
/** a picture from media/, covering its box */
export const pic = (key: string, file: string, x: number, y: number, w: number, h: number, st: St = {}) => (
  <img key={key} src={staticFile(file)} style={{ position: "absolute", left: x, top: y, width: w, height: h, objectFit: "cover", ...st }} />
);
