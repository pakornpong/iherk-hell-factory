// The film's words, in each language it is cut in. The language is sound.py's (`python sound.py th`), read from the
// clock it writes, so the question typed on screen and the keys heard typing it are always the same one.
// In a line, a space parts words; "|" parts the pieces of a phrase written without spaces (Thai), which arrive one at
// a time as English words do. Names the product itself shows (tools, zones, directions, the mark) stay as they are.
import { LANG } from "./times.gen";

const EN = {
  w1: ["Start with", "one tile."], w2: ["Paint", "the floor."], w2b: ["Raise", "the walls."], w3: ["Draw", "your zones."],
  w4: ["Then", "build."], w5: ["Any layout", "you want."], w6: ["A server room."], w7: ["Nap pods."], w8: ["A snack corner."],
  w10: ["Night shift."], w11: ["Then they", "clock in."], w12: ["Every session", "is an employee."], w12b: ["The Boss is in."],
  w12c: ["Watch them", "work, live."], w13: ["Where do your", "AI agents work?"], w14: ["In the office", "you built."],
  b1: ["Every piece", "is a voxel model."], b2: ["One model.", "Four directions."], b3: ["7,500+", "in the library."],
  engine: "THE SPRITE ENGINE", tile: "TILE", tiles: "TILES", pieces: "OF # PIECES", agents: "AGENTS AT WORK",
  tagline: "Hell is what you make it.",
};
const TH: typeof EN = {
  w1: ["เริ่มจาก", "กระเบื้อง|แผ่นเดียว"], w2: ["ปูพื้น", "แบบที่|ชอบ"], w2b: ["ตั้งผนัง", "ขึ้นมา"], w3: ["ลากโซน", "ของคุณ|เอง"],
  w4: ["แล้วก็", "ลงมือสร้าง"], w5: ["ออกแบบได้", "อย่างอิสระ"], w6: ["ห้อง server"], w7: ["แคปซูลงีบหลับ"], w8: ["มุมขนม"],
  w10: ["กะดึก"], w11: ["ถึงเวลา", "เข้างาน"], w12: ["ทุก session", "คือพนักงานหนึ่งคน"], w12b: ["บอสมาแล้ว"],
  w12c: ["ดูทุกคน|ทำงาน", "แบบสดๆ"], w13: ["AI agent ของคุณ", "ทำงานที่ไหน?"], w14: ["ในออฟฟิศ", "ที่คุณ|สร้างเอง"],
  b1: ["ทุกชิ้น", "คือโมเดล voxel"], b2: ["โมเดลเดียว", "หมุนได้สี่ทิศ"], b3: ["7,500+ ชิ้น", "ในคลัง"],
  engine: "เอนจินวาด SPRITE", tile: "แผ่น", tiles: "แผ่น", pieces: "จาก # ชิ้น", agents: "AGENT กำลังทำงาน",
  tagline: "นรก|จะเป็น|แบบไหน คุณ|ออกแบบ|เอง",
};
export const S = (LANG as string) === "th" ? TH : EN;

/** a line as the pieces that arrive one at a time: [the piece, whether a space follows it] */
export function pieces(line: string): [string, boolean][] {
  const out: [string, boolean][] = []; let cur = "";
  for (const ch of line) { if (ch === " " || ch === "|") { if (cur) out.push([cur, ch === " "]); cur = ""; } else cur += ch; }
  if (cur) out.push([cur, false]);
  return out;
}
/** what one keystroke puts on screen: a letter with the marks set above and below it */
export const units = (s: string): string[] => s.match(/.[ัำ-ฺ็-๎]*/gu) ?? [];
