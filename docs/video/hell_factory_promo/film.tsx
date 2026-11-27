// Hell Factory: a launch film for iherk-hell-factory and iherk-pixcel (BOARD.md). One component reads the frame;
// everything else is a plain function of it. `offset` (frames) lets `vd render --from A --to B` draw only a stretch.
import { AbsoluteFill, useCurrentFrame } from "raea";
import score from "./score.json" with { type: "json" };
import { CLOCK, TIMES as TM } from "./kit/times.gen";
import { C, FB, FONTS, clamp01, glide, inOutCubic, lerp, ramp } from "./kit/core";
import { MOODS, type Mood, dark, field, grain } from "./kit/field";
import { DOOR, SCENE, T0, bubbles, build, firstTile, floor, shell, staff, tileC, whole, zones } from "./office";
import { DOOR_AT, bench, benchAlpha, brand, counts, lockup, pointer, sessions, words, worldGone } from "./acts";

const S = score as unknown as { width: number; height: number };
export const FPS = CLOCK.FPS, W = S.width, H = S.height, FRAMES = CLOCK.BEATS * CLOCK.FB;    // the clock sound.py wrote

const C0 = tileC(...T0), CD = tileC(...DOOR), WIDE = [1232, 836, 0.62];
const IN = [CD.x - (DOOR_AT.x - 960) / DOOR_AT.z, CD.y - (DOOR_AT.y - 540) / DOOR_AT.z, DOOR_AT.z];      // the door tile exactly where the bench's grid is
/** the framings: [beat, the world point the frame is centred on, how close, frames the move takes (20 if not given)] */
const CAM: number[][] = [
  [0, C0.x, C0.y, 4.2],                                                                                   // one tile, large
  [TM.SPREAD - 0.4, WIDE[0], WIDE[1], WIDE[2], 80],                                                       // back for the whole floor
  [TM.PAINT[0] - 0.1, 1250, 790, 0.72, 60], [TM.PAINT[1] - 0.1, 1080, 800, 0.82, 44],                      // in with each stroke of the brush
  [TM.WALLS - 0.75, WIDE[0], WIDE[1], WIDE[2], 34], [TM.ZONES[0] - 1.2, WIDE[0] - 50, WIDE[1] + 20, 0.66, 270],   // back as the walls come down; in a little for the zones
  [TM.DOOR - 0.2, IN[0], IN[1], IN[2], 30],                                                                // in on one tile, which becomes the bench
  [TM.OUT - 0.1, IN[0], IN[1], IN[2], 1], [TM.OUT + 0.15, WIDE[0], WIDE[1] - 10, 0.6, 34],                 // and out of it again
  [TM.BUILD0 + 0.4, WIDE[0] + 30, WIDE[1] + 20, 0.68, 240],                                                // pushing in as the office goes up
  [TM.ROOMS[0], 1090, 570, 1.85, 1], [TM.ROOMS[0] + 0.04, 1098, 574, 2.0, 60],                              // three rooms, cut to on the beat, each at its own scale: the server room,
  [TM.ROOMS[1], 700, 728, 2.75, 1], [TM.ROOMS[1] + 0.04, 706, 732, 2.95, 60],                               // the pods, closer,
  [TM.ROOMS[2], 372, 950, 2.5, 1], [TM.ROOMS[2] + 0.04, 378, 948, 2.66, 60],                               // the vending machines
  [TM.SHIFT[1] - 0.55, WIDE[0], WIDE[1], WIDE[2], 28], [TM.SHIFT[1] + 2, SCENE.hub.x - 260, SCENE.hub.y + 40, 0.92, 62],   // back as night falls, then closing on the shared desks
  [TM.CLOCKIN - 0.9, SCENE.hub.x - 70, SCENE.hub.y - 70, 1.9, 36], [TM.CLOCKIN + 0.4, SCENE.hub.x - 70, SCENE.hub.y - 70, 2.04, 80],   // on the shared desks as the first four sit down
  [TM.SCENES[0], SCENE.block.x - 110, SCENE.block.y - 80, 2.2, 1], [TM.SCENES[0] + 0.04, SCENE.block.x - 110, SCENE.block.y - 80, 2.36, 60],   // cut to a block of cubicles,
  [TM.SCENES[1], SCENE.boss.x - 20, SCENE.boss.y - 20, 2.6, 1], [TM.SCENES[1] + 0.04, SCENE.boss.x - 20, SCENE.boss.y - 20, 2.82, 58],   // to the Boss,
  [TM.SCENES[2] - 0.1, WIDE[0] + 30, WIDE[1] + 10, 0.66, 40],                                              // and out as everyone else arrives
  [TM.ASK - 0.6, 1040, 860, 0.56, 86], [TM.ANSWER + 0.6, 1040, 850, 0.6, 220],                             // room for the answer, and slowly in on it
  [TM.END, C0.x, C0.y, 0.03, 66],                                                                          // everything draws back to one tile
];
const CREEP = 0.006;
function camera(f: number) {
  let c = [CAM[0][1], CAM[0][2], CAM[0][3]], since = CAM[0][0] * FB;
  for (let i = 1; i < CAM.length; i++) {
    const start = CAM[i][0] * FB;
    if (f < start - 1) break;
    c[2] *= 1 + (CREEP * (start - since)) / 60;                              // the creep it gathered is where the next move starts from
    const k = inOutCubic(clamp01((f - start + 1) / (CAM[i][4] ?? 20)));     // a camera has weight: it eases in and out
    // a move between very different scales is made in the scale's logarithm, so the middle of it is not all at the far end
    c = [lerp(c[0], CAM[i][1], k), lerp(c[1], CAM[i][2], k), Math.exp(lerp(Math.log(c[2]), Math.log(CAM[i][3]), k))];
    since = start;
  }
  return [c[0], c[1], c[2] * (1 + (CREEP * Math.max(0, f - since)) / 60)];
}

/** the ground's mood: which room this is */
function air(f: number): [Mood, number][] {
  const office = glide(f, TM.TILE, 40), b = worldGone(f), day = 0, night = glide(f, TM.SHIFT[1], 16);
  const base = (1 - b) * (1 - day) * (1 - night);
  return [[MOODS.none, base * (1 - office)], [MOODS.slate, base * office], [MOODS.bench, b * (1 - day) * (1 - night)], [MOODS.day, day], [MOODS.night, night]];
}

export function Film({ offset = 0, finish = true }: { offset?: number; finish?: boolean }) {
  const f = useCurrentFrame() + offset;
  const [cx, cy, z] = camera(f), ws = air(f), dk = dark(ws), ink = dk > 0.5 ? C.cream : C.ink;
  const world = (1 - worldGone(f)) * (1 - ramp(f, TM.END + 1.05, 16));
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONTS}</style>
      {field(f, ws, W, H, -(cx - 1361) * 0.1 * Math.min(z, 1.2), -(cy - 863) * 0.1 * Math.min(z, 1.2))}
      {world > 0.004 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 2720, height: 1880, opacity: world, transformOrigin: "0 0", transform: `translate(${(W / 2 - cx * z).toFixed(3)}px, ${(H / 2 - cy * z).toFixed(3)}px) scale(${z.toFixed(5)})` }}>
          {shell(f).slice(0, 1)}
          {floor(f)}
          {firstTile(f, z)}
          {zones(f, z)}
          {shell(f).slice(1)}
          {build(f)}
          {whole(f)}
          {staff(f)}
          {bubbles(f, z)}
          {pointer(f, z)}
        </div>
      ) : null}
      {bench(f, ink)}
      {sessions(f)}
      {words(f, dk)}
      {counts(f)}
      {brand(f, dk)}
      {lockup(f)}
      {finish ? grain(f, W, H, 0.2) : null}
    </AbsoluteFill>
  );
}
