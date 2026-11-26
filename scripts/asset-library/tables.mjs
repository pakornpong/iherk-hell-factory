import { writeFamily } from './render.mjs';

const box = (x, y, z, X, Y, Z, material) => ({ op: 'box', from: [x, y, z], to: [X, Y, Z], material });
const cylinder = (x, y, zFrom, zTo, radius, material) => ({ op: 'cylinder', center: [x, y], zFrom, zTo, radius, material });
const materials = {
  oak: { kind: 'wood', color: '#bb8250' },
  shaded: { kind: 'wood', color: '#87563e' },
  iron: { kind: 'metal', color: '#465462' },
  steel: { kind: 'metal', color: '#a6bac4' },
  teal: { kind: 'matte', color: '#568e8b' },
  red: { kind: 'matte', color: '#b95142' },
  rubber: { kind: 'matte', color: '#293343' },
  ceramic: { kind: 'matte', color: '#e3e3d7' },
  amber: { kind: 'matte', color: '#e5ac54' },
};

const decks = {
  rectangular: (z) => [box(3, 4, z, 60, 28, z + 2, 'oak')],
  oval: (z) => [box(15, 4, z, 48, 28, z + 2, 'oak'),
    cylinder(15, 16, z, z + 2, 12, 'oak'), cylinder(48, 16, z, z + 2, 12, 'oak')],
  chamfered: (z) => Array.from({ length: 25 }, (_, row) => {
    const inset = Math.max(0, 6 - Math.min(row, 24 - row));
    return box(3 + inset, 4 + row, z, 60 - inset, 4 + row, z + 2, 'oak');
  }),
  'corner-return': (z) => [box(3, 4, z, 60, 22, z + 2, 'oak'),
    box(3, 23, z, 25, 30, z + 2, 'oak')],
};

const bases = {
  trestle: (z) => [8, 54].flatMap(x => [
    box(x - 2, 7, 0, x + 2, 26, 2, 'shaded'),
    box(x - 1, 13, 2, x + 1, 19, z - 1, 'shaded'),
    box(x - 2, 8, z - 3, x + 2, 25, z - 1, 'shaded'),
  ]).concat(box(9, 15, 5, 53, 17, 7, 'shaded')),
  'sled-frame': (z) => [8, 54].flatMap(x => [
    box(x, 8, 0, x + 2, 23, 2, 'iron'),
    box(x, 8, 2, x + 2, 10, z - 1, 'iron'),
    box(x, 21, 2, x + 2, 23, z - 1, 'iron'),
  ]),
  pedestal: (z) => [cylinder(31, 15, 0, 2, 12, 'iron'),
    cylinder(31, 15, 3, z - 4, 4, 'steel'), box(15, 11, z - 3, 48, 19, z - 1, 'iron')],
  'mobile-cabinet': (z) => [box(7, 8, 4, 23, 23, z - 1, 'teal'),
    box(41, 8, 4, 57, 23, z - 1, 'teal'),
    ...[8, 20, 42, 54].flatMap(x => [9, 20].map(y => box(x, y, 0, x + 2, y + 2, 3, 'rubber'))),
    ...[7, 41].map(x => box(x + 4, 24, z - 5, x + 10, 25, z - 4, 'steel'))],
};

const purposes = {
  'drafting': { height: 20, objects: (z) => [
    box(11, 8, z + 3, 47, 20, z + 4, 'shaded'),
    { op: 'slope', from: [11, 8, z + 4], to: [47, 20, z + 13], axis: '-Y', material: 'ceramic' },
    box(11, 20, z + 4, 47, 20, z + 5, 'steel')] },
  'sewing': { height: 18, objects: (z) => [
    box(17, 8, z + 3, 38, 17, z + 4, 'steel'), box(31, 9, z + 5, 37, 15, z + 17, 'ceramic'),
    box(20, 9, z + 14, 31, 15, z + 17, 'ceramic'), box(20, 10, z + 11, 23, 14, z + 14, 'ceramic'),
    box(21, 12, z + 5, 21, 12, z + 11, 'iron'), cylinder(32, 11, z + 18, z + 21, 2, 'red')] },
  'jeweler': { height: 19, objects: (z) => [
    box(15, 8, z + 3, 48, 11, z + 12, 'shaded'), box(27, 21, z + 1, 35, 28, z + 3, 'shaded'),
    box(28, 26, z - 2, 34, 29, z + 1, 'oak'), cylinder(15, 12, z + 3, z + 4, 4, 'iron'),
    box(14, 11, z + 5, 16, 13, z + 18, 'steel'), box(15, 11, z + 17, 24, 13, z + 19, 'steel'),
    cylinder(24, 12, z + 15, z + 18, 4, 'amber')] },
  'service-bench': { height: 21, objects: (z) => [
    box(14, 7, z + 3, 50, 9, z + 16, 'teal'),
    ...[18, 24, 31, 39, 47].map((x, i) => box(x, 10, z + 6 + i % 2, x + 1, 10, z + 13, 'steel')),
    box(44, 17, z + 3, 51, 23, z + 5, 'iron'), box(44, 19, z + 6, 46, 22, z + 10, 'red'),
    box(49, 19, z + 6, 51, 22, z + 10, 'red')] },
  'potting': { height: 16, objects: (z) => [
    box(14, 7, z + 3, 49, 9, z + 11, 'shaded'), box(18, 9, z + 10, 46, 14, z + 11, 'oak'),
    ...[24, 32, 40].flatMap((x, i) => [cylinder(x, 16 + i % 2 * 4, z + 3, z + 8, 3, 'red'),
      cylinder(x, 16 + i % 2 * 4, z + 9, z + 11 + i, 2, 'teal')])] },
  'packing': { height: 19, objects: (z) => [
    box(13, 7, z + 3, 16, 10, z + 22, 'iron'), box(47, 7, z + 3, 50, 10, z + 22, 'iron'),
    box(16, 8, z + 18, 47, 9, z + 19, 'steel'), cylinder(33, 10, z + 16, z + 21, 5, 'amber'),
    box(17, 12, z + 21, 47, 17, z + 22, 'oak'), box(18, 13, z + 3, 29, 22, z + 10, 'oak'),
    box(22, 13, z + 10, 24, 22, z + 10, 'ceramic')] },
};

const designs = [];
for (const [purpose, spec] of Object.entries(purposes)) {
  for (const [deck, top] of Object.entries(decks)) {
    for (const [base, support] of Object.entries(bases)) {
      const z = spec.height;
      designs.push({
        schemaVersion: 1, id: `worktable-${purpose}-${deck}-${base}`, category: 'furniture',
        layer: 'object', outlineMode: 'silhouette', tilePreset: '64x32', voxelsPerTile: 32,
        footprintTiles: [2, 1], palette: 'office-night', materials,
        ops: [...support(z), ...top(z), ...spec.objects(z)],
      });
    }
  }
}
await writeFamily('worktables', designs);
