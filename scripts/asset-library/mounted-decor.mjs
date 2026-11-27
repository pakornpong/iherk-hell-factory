import { writeFamily } from './render.mjs';

const finishes = {
  ink: ['matte', '#292e3c'], charcoal: ['matte', '#49525f'], slate: ['matte', '#606f80'],
  pearl: ['matte', '#f6ebd3'], paper: ['matte', '#ded6b4'], snow: ['matte', '#e1f2ef'],
  brass: ['metal', '#caa05c'], copper: ['metal', '#be7957'], chrome: ['metal', '#bbd4d8'],
  walnut: ['wood', '#765044'], oak: ['wood', '#bd8a5a'], ash: ['wood', '#d6b98a'],
  blush: ['matte', '#db9a99'], coral: ['matte', '#c16458'], plum: ['matte', '#794760'],
  violet: ['matte', '#7d70a2'], lapis: ['matte', '#4066a7'], denim: ['matte', '#4b637d'],
  wave: ['matte', '#4f8fa0'], lagoon: ['matte', '#2b6a70'], mint: ['matte', '#92c8b2'],
  moss: ['matte', '#64764c'], olive: ['matte', '#9da674'], lime: ['matte', '#cae58e'],
  sand: ['matte', '#d4ab72'], amber: ['matte', '#f3bf65'], clay: ['matte', '#af6650'],
};
const materials = Object.fromEntries(Object.entries(finishes).map(([name, [kind, color]]) =>
  [name, { kind, color }]));
materials.litNumeral = { kind: 'emissive', color: '#d9f8ee', glowRadius: 1, glowIntensity: 0.15 };
const box = (x, z, endX, endZ, back, front, material) =>
  ({ op: 'box', from: [x, back, z], to: [endX, front, endZ], material });
const line = (x, z, endX, endZ, y, material) =>
  ({ op: 'line', from: [x, y, z], to: [endX, y, endZ], material });
const span = (x, z, width, height, back, front, material) =>
  box(x, z, x + width - 1, z + height - 1, back, front, material);
const [artCategory, signCategory, officeCategory] = ['wall-decor', 'signage', 'office'];

function oval(cx, cz, rx, rz, back, front, material) {
  return Array.from({ length: rz * 2 + 1 }, (_, i) => {
    const dz = i - rz;
    const dx = Math.floor(rx * Math.sqrt(1 - dz ** 2 / rz ** 2));
    return box(cx - dx, cz + dz, cx + dx, cz + dz, back, front, material);
  });
}

function polygon(points, back, front, material) {
  const rows = [];
  const zValues = points.map(point => point[1]);
  for (let z = Math.min(...zValues); z <= Math.max(...zValues); z++) {
    const edges = points.flatMap(([x, y], i) => {
      const [nextX, nextY] = points[(i + 1) % points.length];
      if (y === z && nextY === z) return [x, nextX];
      if (y === nextY || z < Math.min(y, nextY) || z > Math.max(y, nextY)) return [];
      return [x + (nextX - x) * (z - y) / (nextY - y)];
    });
    if (edges.length) rows.push(box(Math.floor(Math.min(...edges)), z,
      Math.ceil(Math.max(...edges)), z, back, front, material));
  }
  return rows;
}

function pixels(rows, x, top, y, legend, scale = 1, back = y) {
  return rows.flatMap((row, r) =>
    Array.from(row.matchAll(/(.)\1*/g), match => {
      const color = legend[match[1]];
      return color && span(x + match.index * scale, top - (r + 1) * scale + 1,
        match[0].length * scale, scale, back, y, color);
    }).filter(Boolean));
}

function design(id, category, ops) {
  const minimum = Math.min(...ops.flatMap(({ from, to }) => [from[2], to[2]]));
  const used = new Set(ops.map(({ material }) => material));
  return {
    schemaVersion: 1, id: `mounted-${id}`, category, layer: 'wall-decor',
    outlineMode: 'silhouette', tilePreset: '64x32', voxelsPerTile: 32,
    footprintTiles: [1, 1], palette: 'office-night',
    materials: Object.fromEntries([...used].map(name => [name, materials[name]])),
    ops: ops.map(({ from, to, ...op }) => ({
      ...op, from: [from[0], from[1], from[2] - minimum], to: [to[0], to[1], to[2] - minimum],
    })),
  };
}

function framed(id, [left, right, bottom, top], frame, ground, subject, extra = []) {
  return design(`art-${id}`, artCategory, [
    box(left, bottom, right, top, 0, 2, frame),
    box(left + 1, bottom + 1, right - 1, top - 1, 3, 3, ground),
    ...subject,
    ...extra,
  ]);
}

const art = [
  framed('alpine-sunrise', [4, 27, 0, 16], 'walnut', 'clay', [
    ...oval(21, 11, 3, 3, 4, 4, 'amber'),
    ...polygon([[6, 3], [6, 5], [12, 12], [21, 3]], 4, 4, 'denim'),
    ...polygon([[12, 12], [15, 9], [12, 10], [9, 8]], 5, 5, 'snow'),
    ...polygon([[15, 3], [23, 9], [26, 6], [26, 3]], 4, 4, 'lagoon'),
    box(6, 2, 25, 2, 4, 4, 'wave'),
  ]),
  framed('moon-over-marsh', [8, 24, 0, 25], 'ink', 'denim', [
    ...oval(19, 19, 3, 4, 4, 4, 'snow'),
    ...polygon([[9, 2], [9, 12], [17, 10], [23, 12], [23, 2]], 4, 4, 'lagoon'),
    ...[10, 12, 21, 23].map((x, i) => line(x, 2, x + (i % 2), 8 + i, 5, 'olive')),
    box(16, 9, 21, 9, 5, 5, 'mint'), box(14, 6, 20, 6, 5, 5, 'wave'),
    box(16, 3, 22, 3, 5, 5, 'wave'),
  ]),
  framed('desert-arch', [5, 26, 0, 19], 'oak', 'sand', [
    ...oval(11, 14, 2, 2, 4, 4, 'pearl'),
    ...polygon([[8, 2], [10, 9], [14, 13], [21, 14], [25, 10], [25, 2]], 4, 4, 'clay'),
    ...oval(18, 6, 4, 4, 5, 5, 'denim'),
    box(14, 3, 22, 6, 5, 5, 'denim'), box(7, 2, 24, 2, 5, 5, 'copper'),
  ]),
  framed('rain-window', [9, 23, 0, 27], 'ash', 'slate', [
    ...[11, 14, 17, 20].flatMap((x, i) => [
      line(x, 21 - i % 2 * 3, x + 1, 25 - i % 2 * 3, 4, 'snow'),
      line(x, 13 + i % 2, x + 1, 17 + i % 2, 4, 'wave'),
    ]),
    box(11, 4, 14, 8, 4, 4, 'ink'), box(18, 3, 21, 10, 4, 4, 'ink'),
    box(12, 6, 13, 6, 5, 5, 'amber'), box(19, 8, 20, 8, 5, 5, 'amber'),
  ], [box(16, 1, 16, 26, 4, 4, 'ash'), box(10, 12, 22, 12, 4, 4, 'ash')]),
  framed('woodblock-crane', [5, 25, 0, 24], 'walnut', 'paper', [
    ...oval(20, 18, 3, 3, 4, 4, 'coral'),
    ...polygon([[8, 11], [15, 16], [20, 12], [24, 13], [20, 8], [13, 8]], 4, 4, 'snow'),
    line(17, 11, 20, 16, 5, 'snow'), line(20, 16, 22, 18, 5, 'ink'),
    line(14, 9, 10, 4, 4, 'ink'), line(16, 9, 14, 4, 4, 'ink'),
  ]),
  framed('koi-pond', [5, 26, 0, 20], 'lagoon', 'wave', [
    ...oval(11, 14, 4, 2, 4, 4, 'mint'), ...oval(21, 7, 3, 2, 4, 4, 'olive'),
    ...polygon([[10, 6], [15, 5], [20, 8], [22, 13], [18, 12], [18, 10], [13, 9]], 4, 4, 'pearl'),
    box(14, 7, 16, 8, 5, 5, 'coral'), box(18, 9, 19, 10, 5, 5, 'coral'),
    box(11, 7, 11, 7, 5, 5, 'ink'),
  ]),
  framed('harbor-sailboat', [3, 28, 0, 14], 'charcoal', 'snow', [
    box(4, 2, 27, 6, 4, 4, 'wave'),
    ...polygon([[10, 5], [24, 5], [21, 3], [12, 3]], 5, 5, 'plum'),
    ...polygon([[16, 7], [16, 13], [11, 7]], 4, 4, 'pearl'),
    ...polygon([[17, 7], [17, 12], [22, 7]], 4, 4, 'coral'),
    line(16, 5, 16, 13, 5, 'ink'), box(5, 4, 8, 4, 5, 5, 'mint'),
  ]),
  framed('forest-mist', [7, 25, 0, 18], 'olive', 'slate', [
    box(8, 2, 24, 5, 4, 4, 'lagoon'),
    ...[[10, 13], [15, 16], [20, 12], [23, 15]].flatMap(([x, z], i) =>
      polygon([[x - 2, 5], [x, z], [x + 2, 5]], 4, 4 + i % 2, i % 2 ? 'moss' : 'ink')),
    box(8, 7, 18, 7, 6, 6, 'mint'), box(15, 9, 24, 9, 6, 6, 'snow'),
  ]),
  framed('city-dusk', [3, 28, 0, 19], 'ink', 'plum', [
    ...[4, 9, 14, 19, 24].flatMap((x, i) => {
      const roof = [11, 7, 15, 10, 13][i];
      return [
        box(x, 1, x + 3, roof, 4, 4, 'ink'),
        ...Array.from({ length: Math.floor((roof - 2) / 3) }, (_, j) =>
          box(x + 1, 3 + j * 3, x + 2, 3 + j * 3, 5, 5, j % 2 ? 'amber' : 'blush')),
      ];
    }),
    ...oval(22, 15, 2, 2, 4, 4, 'amber'),
  ]),
  framed('wildflower-study', [10, 22, 0, 23], 'walnut', 'paper', [
    ...[[12, 15, 'coral'], [16, 19, 'amber'], [20, 13, 'violet']].flatMap(([x, z, color]) => [
      line(16, 3, x, z, 4, 'moss'),
      ...oval(x, z, 2, 2, 5, 5, color),
      box(x, z, x, z, 6, 6, 'ink'),
    ]),
    ...polygon([[15, 7], [11, 11], [14, 11], [16, 8]], 5, 5, 'olive'),
    ...polygon([[17, 6], [21, 9], [20, 6]], 5, 5, 'olive'),
  ]),
  framed('fern-cyanotype', [7, 24, 0, 25], 'ash', 'lapis', [
    line(12, 3, 18, 23, 4, 'snow'),
    ...Array.from({ length: 7 }, (_, i) => {
      const z = 5 + i * 2;
      const x = 13 + Math.floor(i / 2);
      return [
        line(x - 4 + Math.floor(i / 3), z + 4, x, z, 4, 'snow'),
        line(x, z, x + 5 - Math.floor(i / 3), z + 4, 4, 'mint'),
      ];
    }).flat(),
  ], [box(9, 24, 22, 24, 4, 4, 'brass')]),
  framed('orbital-map', [5, 26, 0, 22], 'chrome', 'ink', [
    ...oval(15, 11, 8, 6, 4, 4, 'lapis'), ...oval(15, 11, 7, 5, 5, 5, 'ink'),
    ...oval(15, 11, 3, 3, 6, 6, 'amber'), ...oval(22, 15, 2, 2, 6, 6, 'mint'),
    ...[[8, 18], [22, 5], [11, 7], [19, 19]].map(([x, z]) => box(x, z, x, z, 5, 5, 'snow')),
  ]),
  framed('coral-cross-section', [5, 27, 0, 23], 'walnut', 'lagoon', [
    ...[[8, 9, 11, 16], [13, 5, 14, 19], [18, 4, 21, 20], [22, 7, 25, 14]].flatMap(([x, z, tx, tz], i) => [
      line(16, 2, x, z, 4 + i % 2, 'coral'),
      line(x, z, tx, tz, 5, 'blush'),
      line(x, z, tx - 2, tz - 3, 5, 'coral'),
      ...oval(tx, tz, 1, 2, 6, 6, 'blush'),
    ]),
  ]),
  framed('paperwave-triptych', [3, 28, 0, 15], 'ash', 'paper', [
    ...[5, 13, 21].flatMap((x, i) => [
      box(x, 2 + i, x + 5, 13 - i, 4, 4, 'mint'),
      ...polygon([[x, 3 + i], [x, 6], [x + 3, 10 - i], [x + 5, 7], [x + 5, 3]], 5, 5, 'wave'),
      box(x + 1, 4, x + 4, 4, 6, 6, 'snow'),
    ]),
  ], [box(11, 1, 12, 14, 4, 4, 'ash'), box(19, 1, 20, 14, 4, 4, 'ash')]),
  framed('botanical-pressed-ivy', [5, 24, 0, 21], 'moss', 'paper', [
    line(9, 2, 20, 20, 4, 'walnut'),
    ...[[10, 6, -1], [12, 9, 1], [14, 12, -1], [16, 15, 1], [18, 17, -1]].flatMap(([x, z, side]) =>
      polygon([[x, z], [x + side * 4, z + 1], [x + side * 2, z + 5], [x - side, z + 3]], 5, 5, 'moss')),
  ]),
  framed('lunar-phases', [2, 29, 0, 10], 'ink', 'denim', [
    ...[6, 11, 16, 21, 26].flatMap((x, i) => [
      ...oval(x, 5, 2, 3, 4, 4, 'pearl'),
      ...(i === 2 ? [] : oval(x + (i < 2 ? 1 : -1), 6, i === 0 || i === 4 ? 2 : 1, 2, 5, 5, 'denim')),
    ]),
  ]),
  framed('topographic-ridge', [5, 26, 0, 17], 'lagoon', 'olive', [
    ...[0, 2, 4].flatMap((inset, i) =>
      polygon([[7 + inset, 3 + inset], [9 + inset, 10], [16, 15 - inset], [24 - inset, 11],
        [23 - inset, 4 + inset], [17, 2 + inset]], 4 + i, 4 + i, ['moss', 'lagoon', 'wave'][i])),
    line(13, 8, 19, 11, 7, 'snow'),
  ]),
  framed('ink-cat-portrait', [9, 23, 0, 22], 'clay', 'blush', [
    ...oval(16, 8, 4, 5, 4, 4, 'ink'),
    ...polygon([[11, 12], [11, 19], [15, 16], [18, 16], [21, 20], [21, 12], [16, 10]], 4, 4, 'ink'),
    box(13, 14, 14, 14, 5, 5, 'lime'), box(18, 14, 19, 14, 5, 5, 'lime'),
    line(19, 4, 21, 6, 4, 'ink'), box(21, 6, 21, 8, 4, 4, 'ink'),
  ]),
  framed('harvest-still-life', [4, 26, 0, 20], 'walnut', 'plum', [
    box(5, 2, 25, 5, 4, 4, 'clay'),
    ...oval(11, 7, 4, 2, 5, 5, 'coral'), ...oval(19, 7, 3, 2, 5, 5, 'amber'),
    ...polygon([[14, 6], [14, 12], [16, 14], [16, 17], [20, 17], [20, 14], [22, 12], [22, 6]], 4, 4, 'mint'),
    line(15, 7, 15, 12, 5, 'snow'), box(16, 16, 20, 16, 5, 5, 'lagoon'),
  ]),
  framed('art-deco-night-train', [2, 29, 0, 13], 'brass', 'ink', [
    ...polygon([[5, 4], [9, 9], [20, 11], [26, 8], [26, 4]], 4, 4, 'denim'),
    box(14, 7, 24, 8, 5, 5, 'amber'), box(8, 5, 11, 6, 5, 5, 'chrome'),
    line(5, 2, 26, 2, 5, 'brass'), ...[10, 14, 20, 24].flatMap(x => oval(x, 4, 1, 1, 5, 5, 'ink')),
  ]),
];

const relief = (id, ops) => design(`relief-${id}`, artCategory, ops);
const reliefs = [
  relief('brass-sunburst-mirror', [
    ...Array.from({ length: 12 }, (_, i) => {
      const angle = i * Math.PI / 6;
      return line(16, 13, 16 + Math.round(12 * Math.cos(angle)),
        13 + Math.round((i % 2 ? 10 : 13) * Math.sin(angle)), 2, 'brass');
    }),
    ...oval(16, 13, 7, 7, 0, 4, 'brass'),
    ...oval(16, 13, 5, 5, 5, 5, 'chrome'), line(13, 11, 18, 16, 6, 'snow'),
  ]),
  relief('arched-vanity-mirror', [
    ...oval(16, 16, 8, 10, 0, 3, 'walnut'), box(8, 0, 24, 16, 0, 3, 'walnut'),
    ...oval(16, 16, 6, 8, 4, 4, 'chrome'), box(10, 2, 22, 16, 4, 4, 'chrome'),
    line(12, 6, 19, 13, 5, 'snow'), box(9, 0, 23, 1, 4, 7, 'brass'),
  ]),
  relief('beveled-diamond-mirror', [
    ...polygon([[16, 0], [28, 13], [16, 26], [4, 13]], 0, 2, 'slate'),
    ...polygon([[16, 3], [25, 13], [16, 23], [7, 13]], 3, 4, 'chrome'),
    line(11, 11, 19, 19, 5, 'snow'), ...[[16, 1], [5, 13], [16, 25], [27, 13]].map(([x, z]) =>
      box(x, z, x, z, 3, 5, 'brass')),
  ]),
  relief('pebble-mirror-trio', [
    line(8, 5, 25, 20, 0, 'ash'),
    ...[[8, 6, 4, 6], [17, 12, 5, 7], [24, 21, 5, 4]].flatMap(([x, z, rx, rz], i) => [
      ...oval(x, z, rx, rz, 0, 2 + i, 'oak'),
      ...oval(x, z, rx - 1, rz - 1, 3 + i, 3 + i, 'chrome'),
      line(x - 2, z - 1, x + 1, z + 2, 4 + i, 'snow'),
    ]),
  ]),
  relief('folded-copper-ginkgo', [
    ...polygon([[15, 5], [7, 11], [3, 19], [6, 23], [14, 25], [17, 22], [20, 25], [26, 23],
      [28, 17], [25, 12]], 0, 2, 'copper'),
    ...[5, 10, 16, 22, 26].map((x, i) => line(16, 6, x, 20 + (i % 2) * 3, 3, 'brass')),
    ...polygon([[14, 7], [14, 0], [16, 0], [18, 8]], 0, 2, 'brass'),
  ]),
  relief('ceramic-fan-shell', [
    ...polygon([[12, 0], [20, 0], [27, 12], [27, 19], [21, 23], [10, 23], [4, 17], [5, 10]], 0, 3, 'wave'),
    ...[7, 11, 16, 21, 25].map((x, i) => line(15 + i % 2, 2, x, i === 0 || i === 4 ? 17 : 21, 4, 'mint')),
    box(12, 0, 20, 2, 4, 6, 'lagoon'),
  ]),
  relief('geometric-owl-mask', [
    ...polygon([[16, 0], [7, 6], [5, 20], [6, 25], [12, 22], [21, 22], [26, 25], [27, 20], [25, 6]], 0, 3, 'walnut'),
    ...[10, 22].flatMap(x => [...oval(x, 15, 5, 5, 4, 4, 'ash'), ...oval(x, 15, 2, 2, 5, 5, 'ink')]),
    ...polygon([[16, 13], [13, 8], [16, 4], [19, 8]], 4, 7, 'brass'),
  ]),
  relief('porcelain-sparrow-flight', [
    ...polygon([[5, 9], [11, 11], [18, 10], [26, 16], [29, 15], [25, 11], [20, 5], [11, 3]], 0, 2, 'snow'),
    ...polygon([[10, 8], [8, 14], [5, 24], [11, 21], [17, 14], [20, 9]], 3, 5, 'wave'),
    ...polygon([[19, 9], [20, 14], [23, 21], [26, 20], [23, 12]], 2, 3, 'mint'),
    box(26, 14, 26, 14, 3, 3, 'ink'),
  ]),
  relief('beech-whale-tail', [
    ...polygon([[14, 0], [18, 0], [19, 8], [23, 11], [29, 20], [25, 20], [16, 15],
      [7, 20], [3, 21], [7, 13], [13, 9]], 0, 3, 'oak'),
    line(16, 2, 16, 14, 4, 'ash'), line(16, 12, 24, 18, 4, 'ash'),
    line(15, 12, 7, 18, 4, 'ash'),
  ]),
  relief('glazed-mountain-peaks', [
    ...polygon([[3, 0], [3, 4], [11, 20], [17, 11], [23, 24], [28, 10], [28, 0]], 0, 3, 'lapis'),
    ...polygon([[7, 12], [11, 20], [16, 12], [12, 15]], 4, 4, 'snow'),
    ...polygon([[19, 16], [23, 24], [26, 16], [23, 18]], 4, 4, 'snow'),
    ...polygon([[4, 1], [13, 8], [17, 3], [23, 9], [28, 2]], 4, 5, 'lagoon'),
  ]),
  relief('interlocking-brass-rings', [
    line(7, 8, 25, 16, 0, 'brass'),
    ...[[10, 8, 6, 8, 2, 'copper'], [20, 15, 8, 9, 4, 'brass']].flatMap(([x, z, rx, rz, y, color]) =>
      Array.from({ length: 40 }, (_, i) => {
        const a = i * Math.PI / 20;
        const u = x + Math.round(rx * Math.cos(a));
        const v = z + Math.round(rz * Math.sin(a));
        return box(u, v, u + 1, v + 1, y - 1, y + 1, color);
      })),
  ]),
  relief('three-layer-ocean-ripple', [
    ...polygon([[3, 2], [10, 7], [19, 4], [28, 10], [28, 3], [21, 0], [10, 2]], 0, 2, 'lagoon'),
    ...polygon([[4, 10], [11, 14], [20, 10], [27, 15], [29, 13], [21, 7], [12, 11], [4, 7]], 1, 4, 'wave'),
    ...polygon([[4, 17], [12, 21], [21, 17], [27, 22], [29, 21], [21, 14], [13, 18], [4, 14]], 0, 5, 'mint'),
    box(11, 3, 13, 17, 0, 1, 'lagoon'), box(20, 4, 22, 17, 0, 1, 'lagoon'),
  ]),
  relief('forged-quadrant-rosette', [
    ...oval(16, 13, 10, 11, 0, 2, 'ink'),
    ...[[12, 17], [20, 17], [12, 9], [20, 9]].flatMap(([x, z]) => [
      ...oval(x, z, 4, 5, 3, 4, 'copper'), ...oval(x, z, 2, 3, 5, 5, 'brass'),
    ]),
    ...oval(16, 13, 3, 3, 5, 7, 'walnut'),
  ]),
  relief('concrete-brutalist-blocks', [
    box(6, 2, 26, 24, 0, 1, 'slate'), box(5, 0, 10, 17, 2, 5, 'chrome'),
    box(11, 8, 16, 25, 2, 9, 'charcoal'), box(17, 0, 21, 14, 2, 6, 'ash'),
    box(22, 10, 27, 21, 2, 7, 'chrome'),
    box(5, 10, 10, 11, 6, 6, 'slate'), box(22, 17, 27, 17, 8, 8, 'slate'),
  ]),
  relief('lacquered-origami-fox', [
    ...polygon([[4, 24], [12, 20], [20, 20], [28, 24], [25, 9], [16, 0], [7, 9]], 0, 2, 'coral'),
    ...polygon([[5, 22], [11, 18], [8, 13]], 3, 4, 'blush'),
    ...polygon([[27, 22], [21, 18], [24, 13]], 3, 4, 'blush'),
    ...polygon([[8, 10], [16, 6], [24, 10], [16, 0]], 3, 6, 'pearl'),
    box(14, 3, 17, 4, 7, 8, 'ink'), box(10, 11, 12, 12, 4, 4, 'ink'), box(20, 11, 22, 12, 4, 4, 'ink'),
  ]),
  relief('copper-lotus-bloom', [
    ...[[10, 10, 4, 6], [22, 10, 4, 6], [12, 15, 4, 6], [20, 15, 4, 6], [16, 18, 4, 7]]
      .flatMap(([x, z, rx, rz], i) => oval(x, z, rx, rz, 0, 2 + i % 2, i % 2 ? 'copper' : 'clay')),
    ...oval(16, 11, 4, 5, 4, 6, 'brass'),
    ...polygon([[5, 5], [16, 7], [27, 5], [18, 0], [13, 0]], 0, 4, 'moss'),
  ]),
  relief('trail-antler-silhouette', [
    ...polygon([[12, 2], [11, 12], [16, 16], [21, 12], [20, 2], [16, 0]], 0, 4, 'oak'),
    ...[1, -1].flatMap(side => [
      line(16 + 4 * side, 10, 16 + 9 * side, 21, 1, 'walnut'),
      line(16 + 9 * side, 21, 16 + 12 * side, 25, 1, 'walnut'),
      line(16 + 8 * side, 18, 16 + 6 * side, 24, 1, 'ash'),
      line(16 + 6 * side, 14, 16 + 12 * side, 17, 2, 'ash'),
    ]),
    box(15, 2, 17, 5, 5, 5, 'walnut'),
  ]),
  relief('ceramic-constellation-dots', [
    ...[[4, 6, 2], [9, 10, 2], [15, 8, 3], [19, 15, 2], [24, 20, 3], [28, 17, 1]]
      .flatMap(([x, z, r], i, points) => [
        ...(i ? [line(points[i - 1][0], points[i - 1][1], x, z, 0, 'denim')] : []),
        ...oval(x, z, r, r, 0, 2 + i % 3, i % 2 ? 'snow' : 'lapis'),
      ]),
  ]),
  relief('round-tulip-ceramic-medallion', [
    ...oval(16, 13, 12, 13, 0, 3, 'denim'), ...oval(16, 13, 10, 11, 4, 4, 'pearl'),
    ...polygon([[16, 7], [10, 10], [10, 6], [16, 4], [22, 6], [22, 10]], 5, 5, 'moss'),
    line(16, 4, 16, 16, 5, 'moss'), ...polygon([[11, 18], [14, 16], [16, 20],
      [18, 16], [21, 18], [20, 13], [16, 12], [12, 13]], 5, 6, 'coral'),
  ]),
  relief('cast-metal-fan-impeller', [
    ...oval(16, 12, 12, 12, 0, 2, 'charcoal'),
    ...[[[15, 12], [7, 13], [5, 17], [10, 20], [15, 18]],
      [[16, 13], [17, 22], [21, 23], [25, 20], [24, 15]],
      [[17, 12], [25, 11], [27, 7], [24, 4], [18, 5]],
      [[15, 11], [13, 3], [8, 2], [5, 5], [8, 10]]].flatMap(points =>
      polygon(points, 3, 5, 'chrome')),
    ...oval(16, 12, 3, 3, 5, 7, 'brass'),
  ]),
];

const glyphs = {
  A: '010/101/111/101/101', B: '110/101/110/101/110', C: '011/100/100/100/011',
  D: '110/101/101/101/110', E: '111/100/110/100/111', F: '111/100/110/100/100',
  G: '011/100/101/101/011', H: '101/101/111/101/101', I: '111/010/010/010/111',
  J: '001/001/001/101/010', K: '101/101/110/101/101', L: '100/100/100/100/111',
  M: '101/111/111/101/101', N: '101/111/111/111/101', O: '010/101/101/101/010',
  P: '110/101/110/100/100', Q: '010/101/101/111/011', R: '110/101/110/101/101',
  S: '011/100/010/001/110', T: '111/010/010/010/010', U: '101/101/101/101/111',
  V: '101/101/101/101/010', W: '101/101/111/111/101', X: '101/101/010/101/101',
  Y: '101/101/010/010/010', Z: '111/001/010/100/111',
  1: '010/110/010/010/111', 2: '110/001/010/100/111', 3: '110/001/010/001/110',
};
function text(word, center, top, y, color) {
  const left = center - word.length * 2 + 1;
  return [...word].flatMap((letter, i) =>
    pixels(glyphs[letter].split('/'), left + 4 * i, top, y, { 1: color }));
}

const icon = (pattern, x, top, color, y = 4) => pixels(pattern.split('/'), x, top, y, { '#': color });
const wayfinding = (id, body, face) => design(`sign-${id}`, signCategory, [...body, ...face]);

const signs = [
  wayfinding('exit-right-arrow', polygon([[3, 3], [21, 3], [21, 0], [29, 7], [21, 14],
    [21, 11], [3, 11]], 0, 3, 'lagoon'), [
    ...text('EXIT', 13, 9, 4, 'snow'), line(22, 5, 26, 7, 4, 'mint'), line(22, 9, 26, 7, 4, 'mint'),
  ]),
  wayfinding('lobby-left-arrow', polygon([[3, 6], [10, 0], [10, 2], [28, 2], [28, 10],
    [10, 10], [10, 12]], 0, 2, 'lapis'), [
    ...text('LOBBY', 18, 8, 3, 'snow'), line(5, 6, 8, 8, 3, 'mint'), line(5, 6, 8, 4, 3, 'mint'),
  ]),
  wayfinding('stairs-octagonal', polygon([[6, 4], [6, 14], [11, 19], [21, 19], [26, 14],
    [26, 4], [21, 0], [11, 0]], 0, 3, 'brass'), [
    ...polygon([[8, 5], [8, 13], [12, 17], [20, 17], [24, 13], [24, 5], [20, 2], [12, 2]], 4, 4, 'ink'),
    ...icon('......##/......#./....###./....#.../..###.../..#...../###.....', 12, 13, 'snow', 5),
  ]),
  wayfinding('lift-vertical-service', [
    box(9, 0, 22, 20, 0, 3, 'chrome'), box(10, 1, 21, 19, 4, 4, 'denim'),
  ], [
    ...text('LIFT', 15, 8, 5, 'snow'),
    ...polygon([[11, 12], [15, 17], [19, 12]], 5, 5, 'mint'),
    box(15, 9, 15, 13, 5, 5, 'mint'),
  ]),
  wayfinding('meeting-room-double-door', [
    box(3, 2, 28, 12, 0, 2, 'walnut'), box(8, 0, 23, 14, 2, 3, 'brass'),
    box(7, 3, 24, 11, 4, 4, 'lagoon'),
  ], [...text('MEET', 16, 9, 5, 'snow'), box(4, 6, 5, 8, 4, 5, 'brass'), box(26, 6, 27, 8, 4, 5, 'brass')]),
  wayfinding('quiet-library-scroll', [
    box(5, 2, 26, 13, 0, 2, 'paper'), box(5, 0, 8, 14, 2, 4, 'oak'),
    box(23, 1, 26, 15, 2, 4, 'oak'),
  ], [...text('QUIET', 16, 10, 3, 'ink')]),
  wayfinding('washroom-pair', [
    ...oval(10, 11, 7, 10, 0, 2, 'lagoon'), ...oval(22, 11, 7, 10, 0, 3, 'plum'),
    box(12, 9, 20, 11, 0, 1, 'chrome'),
  ], [
    ...icon('.###./.###./..#../#####/..#../.###./.#.#./.#.#.', 8, 16, 'snow', 4),
    ...icon('.###./.###./..#../#####/.###./#####/.#.#./.#.#.', 20, 16, 'pearl', 4),
  ]),
  wayfinding('accessibility-blue-circle', oval(16, 11, 11, 11, 0, 3, 'lapis'), [
    ...oval(16, 11, 9, 9, 4, 4, 'denim'),
    ...icon('...##..../...##..../....#..../.##.####./##..#..#./#...###../#.....#../##...##../.#####...', 12, 15, 'snow', 5),
  ]),
  wayfinding('recycle-clipped-bin-plaque', polygon([[6, 4], [9, 19], [23, 19], [26, 4], [23, 0],
    [9, 0]], 0, 3, 'moss'), [
    ...icon('....###..../...##.##.../..#....#.#./.......###./........##./.###......./.##.....#../###....##../.##...##.../..#####....', 11, 15, 'lime'),
  ]),
  wayfinding('breakroom-coffee-cup', [
    box(7, 1, 24, 14, 0, 3, 'clay'), ...oval(22, 7, 5, 5, 0, 3, 'clay'),
    ...oval(22, 7, 3, 3, 4, 4, 'walnut'),
    box(7, 2, 21, 12, 4, 4, 'pearl'), box(6, 0, 25, 1, 2, 4, 'walnut'),
  ], [...icon('..#.#../...#.../#######/#######/.#####./..###..', 11, 11, 'walnut', 5)]),
  wayfinding('front-desk-info', [
    ...polygon([[7, 5], [7, 17], [12, 22], [24, 20], [26, 7], [20, 3], [12, 3], [9, 0]], 0, 3, 'wave'),
    ...oval(17, 13, 5, 6, 4, 4, 'denim'),
  ], [...text('I', 17, 15, 5, 'snow')]),
  wayfinding('push-brass-door-bar', [
    box(3, 2, 28, 8, 0, 2, 'brass'), box(5, 0, 26, 10, 1, 3, 'brass'),
    box(6, 1, 25, 9, 4, 4, 'charcoal'),
  ], [...text('PUSH', 16, 7, 5, 'pearl'), box(4, 4, 5, 6, 3, 4, 'chrome'), box(26, 4, 27, 6, 3, 4, 'chrome')]),
  wayfinding('pull-brushed-door-tab', [
    box(10, 0, 22, 24, 0, 2, 'chrome'), box(12, 2, 20, 22, 3, 3, 'slate'),
  ], [
    ...text('P', 16, 22, 4, 'snow'), ...text('U', 16, 16, 4, 'snow'),
    ...text('L', 16, 10, 4, 'snow'), ...text('L', 16, 4, 4, 'snow'),
    box(10, 22, 11, 23, 3, 4, 'brass'), box(21, 1, 22, 2, 3, 4, 'brass'),
  ]),
  wayfinding('lab-safety-shield', polygon([[5, 5], [5, 19], [16, 24], [26, 19], [26, 5], [16, 0]], 0, 3, 'amber'), [
    ...polygon([[7, 7], [7, 18], [16, 22], [24, 18], [24, 7], [16, 3]], 4, 4, 'charcoal'),
    ...icon('..###../...#.../...#.../..###../..#.#../.#...#./#######', 13, 17, 'lime', 5),
  ]),
  wayfinding('first-aid-cross-plaque', [
    box(10, 0, 21, 23, 0, 3, 'coral'), box(4, 7, 27, 16, 0, 3, 'coral'),
    box(14, 4, 17, 19, 4, 4, 'snow'), box(8, 10, 23, 13, 4, 4, 'snow'),
  ], [box(11, 1, 12, 2, 4, 5, 'brass'), box(19, 21, 20, 22, 4, 5, 'brass')]),
  wayfinding('loading-dock-chevron', [
    ...polygon([[3, 4], [5, 15], [23, 15], [29, 9], [24, 1], [6, 1]], 0, 3, 'charcoal'),
    box(5, 8, 26, 13, 4, 4, 'amber'),
  ], [
    ...text('DOCK', 15, 12, 5, 'ink'),
    ...[8, 13, 18, 23].map(x => line(x, 2, x + 3, 5, 4, 'amber')),
  ]),
  wayfinding('floor-two-illuminated-numeral', [
    ...oval(16, 11, 8, 11, 0, 3, 'denim'), ...oval(16, 11, 6, 9, 4, 4, 'slate'),
  ], [
    ...pixels(glyphs['2'].split('/'), 13, 16, 6, { 1: 'litNumeral' }, 2, 5),
    box(15, 3, 17, 3, 5, 5, 'brass'),
  ]),
  wayfinding('room-number-bay-13', [
    box(3, 4, 28, 12, 0, 2, 'ink'), box(17, 1, 27, 15, 1, 3, 'brass'),
    box(18, 2, 26, 14, 4, 4, 'walnut'),
  ], [
    ...text('BAY', 10, 10, 4, 'snow'), ...text('13', 22, 10, 5, 'pearl'),
    box(4, 5, 5, 5, 3, 4, 'chrome'),
  ]),
  wayfinding('studio-recording-status', [
    box(4, 2, 27, 10, 0, 3, 'ink'), ...oval(23, 6, 6, 6, 1, 4, 'charcoal'),
  ], [
    ...text('REC', 11, 8, 4, 'snow'), ...oval(23, 6, 3, 3, 5, 6, 'coral'),
    box(22, 7, 23, 7, 7, 7, 'blush'),
  ]),
  wayfinding('rest-zone-pennant', polygon([[6, 4], [6, 15], [25, 15], [25, 4], [22, 0],
    [16, 4], [10, 0]], 0, 2, 'violet'), [
    ...text('REST', 16, 10, 3, 'snow'),
    box(5, 14, 26, 16, 2, 4, 'ash'), box(7, 2, 8, 12, 3, 3, 'blush'),
  ]),
];

const office = (id, ops) => design(`office-${id}`, officeCategory, ops);
const offices = [
  office('corkboard-pinned-notes', [
    box(3, 0, 28, 17, 0, 2, 'walnut'), box(4, 1, 27, 16, 3, 3, 'sand'),
    ...[[6, 8, 7, 6, 'pearl'], [16, 10, 8, 4, 'mint'], [17, 3, 7, 5, 'amber'], [9, 2, 4, 4, 'blush']]
      .flatMap(([x, z, w, h, color]) => [
        span(x, z, w, h, 4, 4, color),
        box(x + 1, z + 1, x + w - 2, z + 1, 5, 5, 'oak'),
        box(x + 2, z + h - 1, x + 2, z + h - 1, 5, 6, 'coral'),
      ]),
  ]),
  office('whiteboard-flow-chart', [
    box(3, 2, 28, 19, 0, 2, 'slate'), box(4, 3, 27, 18, 3, 3, 'snow'),
    box(4, 0, 27, 2, 1, 6, 'chrome'),
    ...[[6, 12, 10, 15, 'lapis'], [14, 10, 18, 13, 'coral'], [21, 6, 25, 9, 'moss']]
      .map(([x, z, u, v, color]) => box(x, z, u, v, 4, 4, color)),
    line(10, 13, 14, 12, 4, 'ink'), line(18, 11, 21, 8, 4, 'ink'),
    box(18, 2, 22, 2, 5, 5, 'ink'), box(22, 2, 23, 2, 5, 5, 'coral'),
  ]),
  office('felt-pinboard-photo-tickets', [
    ...oval(16, 11, 13, 11, 0, 2, 'denim'),
    ...oval(16, 11, 11, 9, 3, 3, 'slate'),
    ...[[7, 7, 7, 8, 'paper'], [15, 6, 9, 10, 'snow']].flatMap(([x, z, w, h, color]) => [
      span(x, z, w, h, 4, 4, color),
      box(x + 1, z + 2, x + w - 2, z + h - 3, 5, 5, 'wave'),
      box(x + 3, z + h - 1, x + 3, z + h - 1, 5, 6, 'brass'),
    ]),
  ]),
  office('sprint-kanban-rail-board', [
    box(2, 1, 29, 17, 0, 2, 'ink'), box(2, 0, 29, 2, 2, 4, 'chrome'),
    ...[4, 13, 22].flatMap((x, i) => [
      box(x, 3, x + 6, 15, 3, 3, 'slate'), box(x, 15, x + 6, 17, 4, 4, ['clay', 'lapis', 'moss'][i]),
      ...Array.from({ length: 3 - i }, (_, j) =>
        box(x + 1, 4 + j * 3, x + 5 - (j % 2), 5 + j * 3, 4, 5, ['blush', 'snow', 'mint'][i])),
    ]),
  ]),
  office('week-planner-grid', [
    box(3, 0, 28, 19, 0, 2, 'ash'), box(4, 1, 27, 18, 3, 3, 'paper'),
    box(4, 15, 27, 18, 4, 4, 'lagoon'),
    ...[8, 13, 18, 23].map(x => box(x, 2, x, 14, 4, 4, 'oak')),
    ...[5, 9, 13].map(z => box(4, z, 27, z, 4, 4, 'oak')),
    ...[[5, 11], [10, 7], [15, 12], [20, 3], [25, 10], [15, 4]].map(([x, z], i) =>
      box(x, z, x + 1, z + 1, 5, 5, i % 2 ? 'moss' : 'coral')),
  ]),
  office('magnetic-status-grid-board', [
    ...polygon([[7, 2], [7, 20], [25, 20], [25, 4], [21, 0], [10, 0]], 0, 2, 'ink'),
    box(8, 15, 24, 19, 3, 4, 'slate'),
    ...[10, 16, 22].flatMap((x, i) => [
      ...[6, 11].flatMap((z, j) => oval(x, z, 2, 2, 3, 4 + i % 2,
        j ? ['coral', 'amber', 'mint'][i] : ['mint', 'coral', 'amber'][i])),
      box(x - 1, 17, x + 1, 17, 5, 5, 'snow'),
    ]),
  ]),
  office('drop-down-project-checklist', [
    box(7, 3, 24, 25, 0, 2, 'walnut'), box(9, 1, 22, 21, 3, 3, 'pearl'),
    box(11, 20, 20, 24, 4, 5, 'chrome'),
    ...[6, 10, 14, 18].flatMap((z, i) => [
      box(11, z, 13, z + 2, 4, 4, 'olive'), box(12, z + 1, 12, z + 1, 5, 5, 'paper'),
      box(15, z + 1, 20 - i % 2, z + 1, 4, 4, 'slate'),
      ...(i > 1 ? [line(11, z, 14, z + 2, 6, 'moss')] : []),
    ]),
    box(10, 0, 21, 1, 4, 4, 'sand'),
  ]),
  office('three-card-swivel-clips', [
    box(4, 13, 27, 16, 0, 3, 'ink'),
    ...[[5, 2, 5, 'mint'], [13, 5, 6, 'paper'], [22, 0, 5, 'blush']].flatMap(([x, z, w, color]) => [
      box(x, z, x + w - 1, 13, 3, 4, color),
      box(x + 1, 12, x + 3, 15, 5, 7, 'chrome'),
      box(x + 1, z + 2, x + w - 2, z + 2, 5, 5, 'slate'),
      box(x + 1, z + 5, x + w - 2, z + 5, 5, 5, 'slate'),
    ]),
  ]),
  office('tear-off-desk-calendar', [
    box(8, 0, 23, 22, 0, 2, 'lapis'), box(9, 2, 22, 19, 3, 4, 'pearl'),
    box(9, 17, 22, 19, 5, 5, 'coral'), box(13, 1, 21, 2, 5, 5, 'paper'),
    ...[11, 20].map(x => box(x, 19, x + 1, 22, 3, 6, 'chrome')),
    ...text('12', 16, 13, 5, 'ink'), box(11, 5, 20, 5, 5, 5, 'oak'),
  ]),
  office('monthly-grid-calendar', [
    box(5, 1, 26, 22, 0, 2, 'coral'), box(6, 0, 25, 14, 3, 3, 'paper'),
    box(6, 15, 25, 21, 3, 3, 'clay'), ...text('NOV', 16, 20, 4, 'pearl'),
    ...[8, 12, 16, 20, 24].flatMap((x, i) =>
      [3, 5, 7, 9, 11, 13].map((z, j) => box(x, z, x + 1, z, 4, 4, i === 4 || j === 0 ? 'coral' : 'slate'))),
  ]),
  office('presentation-pointer-alignment-guide', [
    box(2, 13, 29, 15, 0, 2, 'walnut'), box(2, 12, 29, 13, 3, 4, 'brass'),
    ...[5, 10, 15, 20, 25].map((x, i) => box(x, 9 - (i % 2), x, 11, 3, 4, 'brass')),
    box(15, 3, 16, 15, 4, 7, 'chrome'), box(14, 0, 17, 4, 6, 8, 'charcoal'),
    ...polygon([[11, 13], [16, 19], [21, 13]], 4, 7, 'coral'),
  ]),
  office('room-booking-slider', [
    ...polygon([[4, 3], [4, 11], [8, 14], [24, 14], [28, 11], [28, 3], [22, 0], [9, 0]], 0, 3, 'chrome'),
    box(5, 4, 26, 11, 4, 4, 'slate'), box(6, 5, 15, 10, 5, 5, 'moss'),
    box(16, 5, 25, 10, 5, 5, 'coral'), box(13, 3, 19, 12, 6, 7, 'walnut'),
    box(14, 4, 18, 11, 8, 8, 'oak'), box(16, 6, 16, 9, 9, 9, 'brass'),
  ]),
  office('visitor-attention-bell', [
    ...oval(16, 9, 8, 8, 0, 3, 'walnut'), box(11, 0, 20, 2, 1, 4, 'walnut'),
    ...polygon([[8, 5], [11, 7], [12, 13], [14, 15], [18, 15], [20, 13], [21, 7], [24, 5]], 4, 7, 'brass'),
    box(9, 4, 23, 5, 5, 9, 'copper'), box(15, 1, 17, 4, 7, 9, 'brass'),
    box(15, 16, 17, 18, 1, 5, 'chrome'),
  ]),
  office('workshop-clip-ruler', [
    box(3, 4, 28, 10, 0, 3, 'oak'), box(4, 3, 27, 4, 2, 4, 'walnut'),
    ...Array.from({ length: 11 }, (_, i) =>
      box(5 + i * 2, 8 - i % 2, 5 + i * 2, 9, 4, 4, 'ink')),
    box(19, 1, 23, 12, 4, 5, 'chrome'), box(20, 0, 22, 5, 6, 8, 'copper'),
    box(4, 6, 5, 6, 4, 5, 'brass'), box(26, 6, 27, 6, 4, 5, 'brass'),
  ]),
  office('team-shift-wheel', [
    ...oval(16, 13, 12, 12, 0, 2, 'ink'),
    ...[[16, 22, 'coral'], [23, 17, 'amber'], [23, 9, 'moss'], [16, 4, 'lagoon'], [9, 9, 'lapis'], [9, 17, 'violet']]
      .flatMap(([x, z, material]) => oval(x, z, 3, 3, 3, 4, material)),
    ...polygon([[15, 12], [22, 18], [20, 12]], 5, 6, 'snow'),
    ...oval(16, 13, 2, 2, 3, 7, 'brass'),
  ]),
  office('presentation-paper-flip-pad', [
    box(5, 22, 26, 24, 0, 3, 'denim'), box(7, 0, 23, 23, 1, 2, 'paper'),
    ...polygon([[8, 3], [8, 22], [22, 22], [24, 3], [16, 1]], 3, 4, 'pearl'),
    ...[9, 14, 20].map(x => box(x, 21, x + 1, 24, 3, 5, 'chrome')),
    ...[[10, 4, 5], [13, 4, 8], [16, 4, 7], [19, 4, 11]].map(([x, z, h]) =>
      box(x, z, x + 1, z + h, 5, 5, 'wave')),
    box(10, 18, 20, 18, 5, 5, 'ink'),
  ]),
  office('magnet-idea-cluster', [
    ...polygon([[4, 8], [5, 18], [14, 23], [24, 21], [28, 11], [24, 4], [14, 0], [7, 3]], 0, 2, 'lagoon'),
    ...[[6, 10, 5, 7, 'amber'], [12, 14, 6, 6, 'mint'], [20, 12, 6, 6, 'blush'],
      [11, 3, 6, 7, 'paper'], [18, 6, 6, 4, 'snow']].flatMap(([x, z, w, h, material], i) => [
      span(x, z, w, h, 3, 3 + i % 2, material), box(x + 1, z + h - 1, x + 2, z + h, 4, 5, 'ink'),
    ]),
  ]),
  office('organization-tree-board', [
    box(3, 0, 28, 22, 0, 2, 'walnut'), box(4, 1, 27, 21, 3, 3, 'snow'),
    box(13, 15, 18, 19, 4, 5, 'plum'), line(15, 15, 15, 11, 4, 'ink'),
    line(7, 11, 24, 11, 4, 'ink'),
    ...[7, 15, 23].flatMap((x, i) => [
      line(x, 11, x, 8, 4, 'ink'),
      box(x - 2, 4, x + 2, 8, 4, 5, ['mint', 'wave', 'blush'][i]),
    ]),
  ]),
  office('clipboard-feedback-tab', [
    box(9, 1, 23, 26, 0, 2, 'ink'), box(11, 3, 21, 22, 3, 3, 'snow'),
    box(13, 20, 19, 24, 4, 6, 'brass'),
    ...[7, 11, 15, 18].map(z => box(13, z, 19, z, 4, 4, 'slate')),
    box(19, 0, 26, 6, 4, 5, 'coral'), box(20, 3, 25, 3, 6, 6, 'pearl'),
  ]),
  office('two-tone-tactile-abacus', [
    box(4, 1, 7, 20, 0, 4, 'walnut'), box(24, 1, 27, 20, 0, 4, 'walnut'),
    box(5, 1, 26, 4, 1, 3, 'oak'), box(5, 18, 26, 20, 1, 3, 'oak'),
    ...[7, 11, 15].flatMap((z, i) => [
      box(7, z, 24, z, 3, 3, 'chrome'),
      ...[0, 1, 2, 3, 4].map((n) => {
        const x = n < i + 1 ? 8 + n * 2 : 14 + n * 2;
        return box(x, z - 1, x + 1, z + 1, 4, 6, n % 2 ? 'olive' : 'clay');
      }),
    ]),
  ]),
];

const hanging = (id, ops) => design(`hanging-${id}`, artCategory, ops);
const hangings = [
  hanging('macrame-diamond-knots', [
    box(5, 22, 27, 24, 0, 3, 'oak'),
    ...[8, 12, 16, 20, 24].flatMap((x, i) => [
      line(x, 22, 15 + i % 3, 12, 3, 'paper'),
      line(x, 10, 15 + i % 3, 20, 4, 'pearl'),
      box(x, 4 - (i === 2 ? 4 : i % 2 * 2), x, 10, 2 + i % 2, 4, 'paper'),
      box(x - 1, 9, x + 1, 11, 5, 5, 'sand'),
    ]),
  ]),
  hanging('indigo-chevron-runner', [
    box(7, 23, 25, 25, 0, 3, 'walnut'),
    ...polygon([[9, 23], [23, 23], [23, 4], [16, 1], [9, 4]], 1, 3, 'lapis'),
    ...[6, 12, 18].flatMap(z => [
      line(9, z + 4, 16, z, 4, 'mint'), line(16, z, 23, z + 4, 4, 'snow'),
      line(9, z + 3, 16, z - 1, 4, 'denim'), line(16, z - 1, 23, z + 3, 4, 'denim'),
    ]),
    ...[10, 13, 16, 19, 22].map((x, i) => box(x, i % 2, x, 5 - (i === 2 ? 3 : 0), 2, 3, 'paper')),
  ]),
  hanging('patchwork-pocket-quilt', [
    box(4, 20, 27, 22, 0, 3, 'ash'), box(5, 0, 26, 20, 1, 2, 'paper'),
    ...[7, 14, 21].flatMap((x, i) => [2, 8, 14].flatMap((z, j) => [
      box(x, z, x + 4, z + 4, 3, 4 + (i + j) % 2, ['violet', 'clay', 'olive'][(i + j) % 3]),
      line(x, z, x + 4, z + 4, 5 + (i + j) % 2, 'pearl'),
    ])),
  ]),
  hanging('pennant-mountain-club', [
    box(5, 23, 26, 24, 0, 3, 'walnut'),
    ...polygon([[6, 22], [25, 22], [25, 10], [16, 0], [6, 10]], 1, 3, 'lagoon'),
    ...polygon([[8, 10], [13, 19], [17, 14], [20, 17], [23, 10]], 4, 4, 'mint'),
    ...polygon([[11, 15], [13, 19], [16, 15], [13, 16]], 5, 5, 'snow'),
    box(12, 6, 20, 7, 4, 4, 'brass'),
  ]),
  hanging('signal-flags-bunting', [
    line(3, 20, 9, 16, 0, 'oak'), line(9, 16, 17, 14, 0, 'oak'), line(17, 14, 28, 19, 0, 'oak'),
    ...[[3, 19, 'coral'], [9, 15, 'amber'], [15, 13, 'lapis'], [21, 15, 'mint']]
      .flatMap(([x, z, color], i) => [
        ...polygon([[x, z], [x + 5, z - (i < 2 ? 2 : -1)], [x + 3, z - 10]], 1, 3, color),
        line(x + 1, z - 4, x + 4, z - 4, 4, 'pearl'),
      ]),
    box(3, 18, 4, 21, 0, 2, 'brass'), box(27, 18, 28, 21, 0, 2, 'brass'),
  ]),
  hanging('paper-cranes-mobile', [
    box(5, 23, 27, 25, 0, 2, 'walnut'),
    ...[[8, 13, 'mint'], [16, 6, 'blush'], [24, 14, 'snow']].flatMap(([x, z, color], i) => [
      line(x, z, x, 23, 2, 'brass'),
      ...polygon([[x - 4, z + 1], [x - 2, z + 2], [x, z - 2], [x + 2, z + 2],
        [x + 4, z + 3], [x + 3, z], [x, z - 4]], 3 + i, 4 + i, color),
    ]),
  ]),
  hanging('pressed-leaves-on-string', [
    box(5, 25, 27, 26, 0, 2, 'walnut'),
    ...[[9, 10, 'moss'], [16, 4, 'olive'], [23, 13, 'clay']].flatMap(([x, z, color], i) => [
      line(x, z + 4, x, 25, 2, 'paper'),
      ...polygon([[x, z], [x - 3, z + 4], [x - 1, z + 9], [x + 1, z + 10], [x + 3, z + 6]], 3, 3 + i, color),
      line(x, z + 1, x, z + 8, 4 + i, 'sand'),
    ]),
  ]),
  hanging('crescent-and-stars-charm', [
    box(14, 22, 18, 25, 0, 2, 'walnut'), line(16, 16, 16, 24, 1, 'brass'),
    ...polygon([[22, 20], [17, 19], [13, 16], [12, 13], [14, 10], [18, 8], [22, 9],
      [19, 5], [12, 5], [7, 10], [7, 16], [11, 21], [17, 23]], 2, 4, 'brass'),
    ...[[11, 0], [25, 7]].flatMap(([x, z]) => [
      line(x, z + 2, x, 18, 1, 'copper'),
      box(x - 2, z + 2, x + 2, z + 2, 3, 4, 'pearl'),
      box(x, z, x, z + 4, 3, 4, 'pearl'),
    ]),
  ]),
  hanging('brass-tube-wind-chime', [
    box(7, 23, 24, 25, 0, 3, 'walnut'),
    ...[[8, 9, 18], [12, 6, 17], [17, 3, 16], [22, 8, 18]].flatMap(([x, bottom, top], i) => [
      line(x, top, x, 24, 2, 'paper'), box(x - 1, bottom, x + 1, top, 3 + i % 2, 5 + i % 2, 'brass'),
      box(x, bottom, x, bottom, 6 + i % 2, 6 + i % 2, 'walnut'),
    ]),
    line(16, 0, 16, 23, 1, 'oak'),
  ]),
  hanging('beaded-rainbow-arch', [
    box(12, 23, 20, 25, 0, 2, 'ash'),
    ...[8, 6, 4].flatMap((r, i) => [
      ...Array.from({ length: r * 2 + 5 }, (_, j) => {
        const a = j * Math.PI / (r * 2 + 4);
        const x = 16 + Math.round(r * Math.cos(a));
        const z = 10 + Math.round(r * Math.sin(a));
        return box(x - 1, z, x, z + 1, 2 + i, 4 + i, ['coral', 'amber', 'mint'][i]);
      }),
      ...[16 - r, 16 + r].map(x => box(x, i * 2, x, 10, 1 + i, 2 + i, 'paper')),
    ]),
    line(16, 18, 16, 23, 1, 'paper'),
  ]),
  hanging('willow-door-wreath', [
    ...Array.from({ length: 40 }, (_, i) => {
      const a = i * Math.PI / 20;
      const x = 16 + Math.round(10 * Math.cos(a));
      const z = 12 + Math.round(10 * Math.sin(a));
      return box(x - 1, z - 1, x + 1, z + 1, 0, 3 + i % 2, i % 3 ? 'moss' : 'olive');
    }),
    ...[[8, 6], [20, 20], [23, 18], [7, 14], [12, 3], [26, 11]].flatMap(([x, z]) => oval(x, z, 1, 1, 4, 5, 'coral')),
    box(14, 0, 18, 4, 4, 6, 'coral'),
  ]),
  hanging('dried-lavender-bouquet', [
    box(12, 2, 19, 6, 0, 4, 'oak'),
    ...[[8, 20], [13, 27], [17, 24], [21, 26], [25, 20]].flatMap(([x, z], i) => [
      line(16, 0, x, z - 3, 3, 'moss'),
      ...[0, 2, 4].map(n => box(x - 1, z - n, x + 1, z - n, 4 + i % 2, 5 + i % 2, n % 4 ? 'blush' : 'violet')),
    ]),
    box(12, 3, 20, 5, 6, 7, 'paper'),
  ]),
  hanging('woven-floor-plan-tapestry', [
    box(4, 23, 28, 24, 0, 3, 'oak'), box(6, 3, 26, 23, 1, 2, 'lagoon'),
    box(8, 5, 24, 21, 3, 3, 'denim'),
    ...[6, 12, 20].map(z => box(9, z, 23, z, 4, 4, 'paper')),
    ...[[9, 6, 20], [16, 12, 20], [21, 6, 11], [23, 6, 20]].map(([x, z, top]) => box(x, z, x, top, 4, 4, 'paper')),
    ...[7, 10, 12, 15, 17, 20, 23, 25].map((x, i) => box(x, i % 3, x, 4, 2, 3, 'mint')),
    box(11, 15, 13, 18, 4, 4, 'coral'), box(18, 8, 19, 10, 4, 4, 'amber'),
  ]),
  hanging('gilded-framed-certificate', [
    box(4, 0, 27, 18, 0, 3, 'walnut'), box(5, 1, 26, 17, 4, 4, 'brass'),
    box(6, 2, 25, 16, 5, 5, 'paper'),
    ...text('MERIT', 16, 14, 6, 'ink'), box(9, 5, 17, 5, 6, 6, 'oak'),
    ...oval(21, 6, 2, 2, 6, 7, 'coral'), line(21, 5, 23, 2, 6, 'coral'),
  ]),
  hanging('enamel-medal-on-ribbon', [
    box(10, 23, 22, 25, 0, 2, 'walnut'),
    ...polygon([[10, 23], [13, 23], [18, 11], [15, 9]], 1, 3, 'lapis'),
    ...polygon([[18, 23], [22, 23], [18, 10], [15, 9]], 2, 4, 'coral'),
    ...oval(16, 6, 6, 6, 4, 5, 'brass'),
    ...oval(16, 6, 4, 4, 6, 6, 'copper'), ...text('1', 16, 8, 7, 'pearl'),
  ]),
  hanging('regatta-rosette-and-ribbons', [
    ...oval(16, 18, 9, 8, 0, 3, 'denim'), ...oval(16, 18, 6, 5, 4, 4, 'lapis'),
    ...oval(16, 18, 4, 3, 5, 6, 'brass'),
    ...polygon([[11, 12], [15, 11], [11, 0], [10, 3], [7, 2]], 1, 3, 'mint'),
    ...polygon([[17, 11], [21, 12], [25, 4], [22, 5], [21, 2]], 1, 3, 'lapis'),
  ]),
  hanging('antique-geographic-compass', [
    box(14, 22, 18, 25, 0, 3, 'walnut'),
    ...oval(16, 11, 10, 11, 1, 5, 'brass'),
    ...oval(16, 11, 8, 9, 6, 6, 'pearl'),
    ...polygon([[14, 11], [16, 19], [18, 11], [16, 3]], 7, 7, 'denim'),
    ...polygon([[14, 11], [16, 19], [18, 11]], 8, 8, 'coral'),
    ...oval(16, 11, 1, 1, 8, 9, 'brass'),
  ]),
  hanging('painted-decorative-paddle', [
    ...polygon([[13, 0], [9, 4], [9, 13], [13, 17], [15, 18],
      [15, 26], [18, 26], [18, 18], [22, 15], [23, 9], [21, 3], [18, 0]], 0, 3, 'oak'),
    ...polygon([[10, 5], [10, 12], [22, 9], [21, 4], [17, 1]], 4, 4, 'lagoon'),
    line(10, 10, 21, 7, 5, 'mint'), line(11, 13, 22, 10, 4, 'coral'),
    box(15, 23, 18, 26, 4, 5, 'walnut'),
  ]),
  hanging('mounted-miniature-longboard', [
    ...polygon([[10, 4], [10, 22], [13, 27], [19, 27], [23, 22], [22, 4],
      [19, 0], [13, 0]], 0, 3, 'walnut'),
    ...polygon([[11, 4], [11, 22], [15, 26], [18, 26], [22, 21], [21, 5],
      [18, 1], [14, 1]], 4, 4, 'denim'),
    line(11, 9, 21, 18, 5, 'mint'), line(11, 12, 21, 21, 5, 'coral'),
    ...[6, 21].flatMap(z => [
      box(10, z, 22, z + 1, 5, 6, 'chrome'), box(9, z - 1, 11, z + 2, 7, 9, 'amber'),
      box(21, z - 1, 23, z + 2, 7, 9, 'amber'),
    ]),
  ]),
  hanging('three-vintage-record-sleeves', [
    box(3, 8, 15, 21, 0, 2, 'plum'), box(9, 1, 21, 13, 1, 4, 'lagoon'),
    box(17, 8, 28, 19, 0, 3, 'walnut'), ...oval(22, 14, 4, 4, 4, 5, 'ink'),
    ...oval(22, 14, 2, 2, 6, 6, 'amber'), ...oval(9, 15, 3, 4, 3, 3, 'blush'),
    ...polygon([[11, 3], [14, 10], [20, 4]], 5, 5, 'mint'),
    box(3, 7, 27, 8, 0, 1, 'chrome'),
  ]),
];

const mountedDecor = [...art, ...reliefs, ...signs, ...offices, ...hangings];
await writeFamily('mounted-decor', mountedDecor);
