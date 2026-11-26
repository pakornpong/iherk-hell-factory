import type { CatalogEntry } from "../shared/types.js";

const categoryLabels = new Map<string, string>([
  ["accessibility", "การเข้าถึง"],
  ["architecture", "สถาปัตยกรรม"],
  ["audio", "ระบบเสียง"],
  ["audio-systems", "ระบบเสียง"],
  ["aviation", "งานสนามบิน"],
  ["bakery", "เบเกอรี"],
  ["bath-furniture", "เฟอร์นิเจอร์ห้องน้ำ"],
  ["bathroom", "ห้องน้ำ"],
  ["bathrooms", "ห้องน้ำ"],
  ["bedroom", "ห้องนอน"],
  ["beds", "เตียง"],
  ["bedside-furniture", "เฟอร์นิเจอร์ข้างเตียง"],
  ["cameras", "กล้อง"],
  ["classroom", "ห้องเรียน"],
  ["coffee-bars", "บาร์กาแฟ"],
  ["coffee-service", "อุปกรณ์ร้านกาแฟ"],
  ["computer", "คอมพิวเตอร์"],
  ["computers", "คอมพิวเตอร์"],
  ["decor", "ของตกแต่ง"],
  ["dining", "อุปกรณ์รับประทานอาหาร"],
  ["dining-sets", "ชุดโต๊ะอาหาร"],
  ["education", "การศึกษา"],
  ["electronics", "อิเล็กทรอนิกส์"],
  ["fitness", "ฟิตเนส"],
  ["floor", "พื้น"],
  ["furniture", "เฟอร์นิเจอร์"],
  ["gardening", "งานสวน"],
  ["gym", "ฟิตเนส"],
  ["headphones", "หูฟัง"],
  ["home", "ของใช้ในบ้าน"],
  ["it-infrastructure", "โครงสร้างไอที"],
  ["kitchen", "ครัว"],
  ["kitchen-machines", "เครื่องครัว"],
  ["lab", "ห้องแล็บ"],
  ["lab-instruments", "เครื่องมือห้องแล็บ"],
  ["library", "ห้องสมุด"],
  ["lighting", "ไฟและโคมไฟ"],
  ["lounge", "พื้นที่พักผ่อน"],
  ["lounge-seating", "ที่นั่งพักผ่อน"],
  ["medical", "อุปกรณ์การแพทย์"],
  ["music", "ดนตรี"],
  ["musical-instruments", "เครื่องดนตรี"],
  ["office", "สำนักงาน"],
  ["office-equipment", "อุปกรณ์สำนักงาน"],
  ["patio", "เฟอร์นิเจอร์กลางแจ้ง"],
  ["pharmacy", "ร้านขายยา"],
  ["room-divider", "ฉากกั้นห้อง"],
  ["room-dividers", "ฉากกั้นห้อง"],
  ["science", "วิทยาศาสตร์"],
  ["seating", "เก้าอี้และที่นั่ง"],
  ["server", "เซิร์ฟเวอร์"],
  ["sofas", "โซฟา"],
  ["storage", "ที่เก็บของ"],
  ["tabletop", "ของวางบนโต๊ะ"],
  ["tables", "โต๊ะ"],
  ["tech", "เทคโนโลยี"],
  ["wall-decor", "ของแต่งผนัง"],
  ["warehouse", "คลังสินค้า"],
  ["worktables", "โต๊ะทำงาน"],
]);

interface TagRule {
  label: string;
  terms: readonly string[];
  categories?: readonly string[];
}

const tagRules: readonly TagRule[] = [
  { label: "โต๊ะ", terms: ["table", "desk", "worktable", "workstation", "counter"], categories: ["tables", "worktables", "dining-sets"] },
  { label: "เก้าอี้", terms: ["chair", "stool", "armchair"], categories: ["seating"] },
  { label: "โซฟา", terms: ["sofa", "couch", "loveseat", "chaise"], categories: ["sofas"] },
  { label: "ม้านั่ง", terms: ["bench"] },
  { label: "เตียง", terms: ["bed", "bunk"], categories: ["beds"] },
  { label: "ตู้และชั้น", terms: ["cabinet", "locker", "shelf", "shelving", "drawer", "rack", "bookcase"], categories: ["storage"] },
  { label: "ฉากกั้น", terms: ["divider", "partition", "cubicle"], categories: ["room-divider", "room-dividers"] },
  { label: "ไฟ", terms: ["lamp", "light", "lantern", "lighting", "sconce", "chandelier"], categories: ["lighting"] },
  { label: "ห้องแล็บ", terms: ["lab", "laboratory"], categories: ["lab", "lab-instruments", "science"] },
  { label: "คอมพิวเตอร์", terms: ["computer", "monitor", "terminal", "pc"], categories: ["computer", "computers", "it-infrastructure"] },
  { label: "เครื่องเสียง", terms: ["audio", "speaker", "microphone", "mixer", "headphones"], categories: ["audio", "audio-systems", "headphones"] },
  { label: "ครัว", terms: ["kitchen", "oven", "fridge", "cookware"], categories: ["cookware", "kitchen", "kitchen-machines"] },
  { label: "ไม้", terms: ["wood", "wooden", "oak", "walnut", "pine", "bamboo", "teak"] },
  { label: "โลหะ", terms: ["metal", "steel", "iron", "aluminum", "aluminium"] },
  { label: "กระจก", terms: ["glass", "glazed"] },
  { label: "ผ้าและเบาะ", terms: ["fabric", "upholstered", "cushion", "cushioned", "padded", "linen", "velvet"] },
  { label: "ทึบ", terms: ["solid", "opaque"] },
  { label: "มีล้อ", terms: ["caster", "casters", "wheeled", "mobile", "trolley"] },
  { label: "หมุนได้", terms: ["swivel", "rotating"] },
  { label: "กะทัดรัด", terms: ["compact", "small", "mini", "narrow", "slim"] },
  { label: "กว้าง", terms: ["wide", "large"] },
  { label: "สูง", terms: ["tall", "high"] },
  { label: "เตี้ย", terms: ["low", "short"] },
  { label: "เข้ามุม", terms: ["corner"] },
  { label: "ทรงกลม", terms: ["round", "circular"] },
  { label: "ทรงรี", terms: ["oval"] },
  { label: "ทรงเหลี่ยม", terms: ["rectangular", "square"] },
];

export function getCatalogCategoryLabel(category: string): string {
  return categoryLabels.get(category) ?? category.replace(/[a-z0-9]+/gi, (word) =>
    word[0].toUpperCase() + word.slice(1),
  ).replace(/[-_]+/g, " ");
}

export function getCatalogTags(item: CatalogEntry): string[] {
  const tokens = new Set(item.id.toLowerCase().split(/[^a-z0-9]+/));
  const tags = tagRules
    .filter(({ terms, categories }) =>
      categories?.includes(item.category) || terms.some((term) => tokens.has(term)),
    )
    .map(({ label }) => label);
  return tags.length > 0 ? tags : [getCatalogCategoryLabel(item.category)];
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function matchesCatalogSearch(item: CatalogEntry, tags: string[], query: string): boolean {
  const terms = normalize(query).split(/\s+/).map((term) => term.replace(/^#/, "")).filter(Boolean);
  if (terms.length === 0) return true;

  const searchable = normalize([
    item.id,
    item.category,
    getCatalogCategoryLabel(item.category),
    ...tags,
  ].join(" "));
  return terms.every((term) => searchable.includes(term) || tagRules.some(({ label, terms: aliases }) =>
    tags.includes(label) && aliases.includes(term),
  ));
}
