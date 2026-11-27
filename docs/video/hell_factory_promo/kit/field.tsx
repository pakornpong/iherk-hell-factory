// The ground: soft colour moving in the dark. Its job is to say which room this is (BOARD.md, the world). Only gradients, no filters. The same mechanism as the air
// in stet's and onoma's kit/field.tsx, with one palette a look.
import { FPS } from "./core";

export type Mood = { base: string; c: [string, string, string, string]; a: number };
export const MOODS: Record<string, Mood> = {
  none: { base: "#07090F", c: ["#0E1420", "#0B1018", "#10131F", "#0A0E16"], a: 0.8 },        // before there is an office: almost nothing
  slate: { base: "#14161D", c: ["#12414C", "#1B2A4A", "#263042", "#0F3540"], a: 0.75 },      // under the office: the app's own dark, with the floor's teal in it
  bench: { base: "#14122A", c: ["#33278A", "#1C3F7A", "#4A2A7C", "#1A2460"], a: 0.75 },      // pixcel's bench: indigo, another room
  day: { base: "#CBD5E1", c: ["#E8EEF5", "#B9D4E6", "#F1E9D8", "#C4CEDD"], a: 0.8 },         // the app's day theme
  night: { base: "#090D18", c: ["#0E3A48", "#172554", "#25215A", "#0C2F3C"], a: 0.8 },       // the app's night theme
};
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (ws: [Mood, number][], pick: (m: Mood) => string) => {
  const o = [0, 0, 0]; let t = 0;
  for (const [m, w] of ws) { const c = rgb(pick(m)); o[0] += c[0] * w; o[1] += c[1] * w; o[2] += c[2] * w; t += w; }
  return o.map((v) => Math.round(v / (t || 1)));
};
/** how dark the room is, 0 (paper) to 1 (night): type that sits on the room reads it to choose its own colour */
export const dark = (ws: [Mood, number][]) => { const b = mix(ws, (m) => m.base); return 1 - Math.min(1, (0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2]) / 215); };
const BLOBS: [number, number, number, number, number, number, number, number, number, number, number][] = [
  [0.20, 0.28, 0.10, 0.08, 1700, 1100, 0.21, 0.17, 0.0, 18, 0],
  [0.82, 0.22, 0.08, 0.10, 1500, 1000, 0.17, 0.23, 1.3, -12, 1],
  [0.72, 0.86, 0.12, 0.07, 1700, 1050, 0.19, 0.15, 2.1, 10, 2],
  [0.18, 0.88, 0.09, 0.09, 1400, 1000, 0.23, 0.20, 3.4, -20, 3],
  [0.50, 0.50, 0.18, 0.12, 1200, 820, 0.13, 0.11, 4.2, 0, 1],
];
/** the room at frame f. `ws`: how much of each mood is in it; (dx, dy): how far it lags behind the camera */
export function field(f: number, ws: [Mood, number][], w: number, h: number, dx = 0, dy = 0) {
  const t = f / FPS, out: any[] = [];
  const base = mix(ws, (m) => m.base), tot = ws.reduce((a, [, k]) => a + k, 0) || 1, alpha = ws.reduce((a, [m, k]) => a + m.a * k, 0) / tot;
  out.push(<div key="fbase" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: `rgb(${base.join(",")})` }} />);
  BLOBS.forEach(([x0, y0, ax, ay, bw, bh, wx, wy, ph, rot, ci], i) => {
    const c = mix(ws, (m) => m.c[ci]).join(","), a = alpha * (i === 4 ? 0.5 : 1);
    const cx = (x0 + ax * Math.sin(wx * t * 2 + ph)) * w + dx, cy = (y0 + ay * Math.cos(wy * t * 2 + ph * 1.7)) * h + dy;
    out.push(<div key={`fb${i}`} style={{ position: "absolute", left: cx - bw / 2, top: cy - bh / 2, width: bw, height: bh, transform: `rotate(${(rot + 8 * Math.sin(0.11 * t * 2 + ph)).toFixed(2)}deg)`,
      background: `radial-gradient(closest-side, rgba(${c},${a.toFixed(3)}) 0%, rgba(${c},${(a * 0.86).toFixed(3)}) 22%, rgba(${c},${(a * 0.5).toFixed(3)}) 50%, rgba(${c},${(a * 0.15).toFixed(3)}) 78%, rgba(${c},0) 100%)` }} />);
  });
  return out;
}
/** grain over everything, new every frame */
export function grain(f: number, w: number, h: number, opacity = 0.2) {
  return (
    <svg key="grain" style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "overlay", opacity }} width={w} height={h}>
      <filter id="grainF"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={String((f % 97) + 1)} /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width={w} height={h} filter="url(#grainF)" />
    </svg>
  );
}
