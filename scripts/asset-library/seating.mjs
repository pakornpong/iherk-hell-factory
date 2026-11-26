import { writeFamily } from './render.mjs';

const box = (x, y, z, X, Y, Z, material) => ({ op: 'box', from: [x, y, z], to: [X, Y, Z], material });
const cylinder = (x, y, zFrom, zTo, radius, material) => ({ op: 'cylinder', center: [x, y], zFrom, zTo, radius, material });
const line = (x, y, z, X, Y, Z, material) => ({ op: 'line', from: [x, y, z], to: [X, Y, Z], material });
const materials = {
  wood: { kind: 'wood', color: '#ad784c' },
  metal: { kind: 'metal', color: '#657985' },
  foot: { kind: 'matte', color: '#293240' },
  cloth: { kind: 'matte', color: '#467575' },
  edge: { kind: 'matte', color: '#659498' },
  brass: { kind: 'metal', color: '#d4a35d' },
};

const seats = {
  'square-drop': [box(6, 6, 13, 25, 25, 15, 'wood'), box(7, 7, 16, 24, 24, 19, 'cloth')],
  'round-saddle': [cylinder(15, 15, 13, 15, 10, 'wood'), cylinder(15, 15, 16, 18, 10, 'cloth'),
    cylinder(15, 15, 19, 19, 8, 'edge')],
  'slatted': [box(6, 7, 13, 8, 24, 16, 'wood'), box(23, 7, 13, 25, 24, 16, 'wood'),
    ...[7, 11, 15, 19, 23].map(y => box(7, y, 16, 24, y + 1, 17, 'wood'))],
  'waterfall': [box(6, 6, 13, 25, 23, 17, 'cloth'), box(7, 24, 12, 24, 25, 16, 'cloth'),
    box(8, 26, 11, 23, 26, 14, 'edge')],
  'bolstered': [box(6, 6, 13, 25, 24, 16, 'cloth'), box(6, 7, 16, 9, 23, 20, 'edge'),
    box(22, 7, 16, 25, 23, 20, 'edge'), box(10, 8, 16, 21, 23, 18, 'cloth')],
};

const feet = {
  'angled-legs': [7, 24].flatMap(x => [7, 24].flatMap(y => {
    const dx = x < 15 ? -3 : 3;
    const dy = y < 15 ? -3 : 3;
    return [line(x, y, 13, x + dx, y + dy, 0, 'wood'),
      line(x + 1, y, 13, x + dx + 1, y + dy, 0, 'wood')];
  })),
  'continuous-sled': [7, 24].flatMap(x => [
    box(x, 6, 0, x + 1, 25, 1, 'metal'), box(x, 6, 1, x + 1, 7, 13, 'metal'),
    box(x, 24, 1, x + 1, 25, 13, 'metal')]),
  'swivel-casters': [cylinder(15, 15, 3, 13, 3, 'metal'),
    ...[[5, 15], [10, 24], [23, 23], [25, 12], [15, 5]].flatMap(([x, y]) =>
      [line(15, 15, 4, x, y, 2, 'metal'), box(x - 1, y - 1, 0, x + 1, y + 1, 2, 'foot')])],
  'disc-pedestal': [cylinder(15, 15, 0, 1, 10, 'metal'), cylinder(15, 15, 2, 13, 2, 'metal'),
    cylinder(15, 15, 10, 12, 4, 'foot')],
  'spring-cantilever': [box(6, 9, 0, 25, 11, 1, 'metal'),
    ...[6, 24].flatMap(x => [box(x, 10, 0, x + 1, 27, 1, 'metal'),
      box(x, 26, 1, x + 1, 27, 13, 'metal'), box(x, 7, 12, x + 1, 26, 13, 'metal')])],
};

const backs = {
  'spindle-fan': [box(5, 6, 32, 25, 8, 34, 'wood'),
    ...[8, 12, 16, 20, 24].map(x => line(Math.round(15 + (x - 15) * .6), 7, 16, x, 7, 32, 'wood'))],
  'support-shell': [box(6, 5, 18, 25, 8, 30, 'cloth'), box(9, 5, 31, 22, 8, 34, 'edge'),
    box(6, 8, 19, 8, 13, 28, 'cloth'), box(23, 8, 19, 25, 13, 28, 'cloth')],
  'ladder-back': [box(6, 5, 15, 8, 7, 37, 'wood'), box(23, 5, 15, 25, 7, 37, 'wood'),
    ...[23, 29, 35].map(z => box(8, 5, z, 23, 7, z + 2, 'wood'))],
  'headrest-mesh': [box(7, 5, 15, 24, 7, 32, 'metal'), box(9, 7, 20, 22, 7, 30, 'foot'),
    ...[21, 24, 27, 30].map(z => box(9, 8, z, 22, 8, z, 'edge')),
    box(14, 5, 32, 17, 7, 37, 'metal'), box(10, 5, 36, 21, 8, 41, 'cloth')],
  'wraparound-rail': [box(7, 5, 16, 8, 7, 27, 'brass'), box(23, 5, 16, 24, 7, 27, 'brass'),
    box(5, 5, 26, 26, 8, 28, 'wood'), box(4, 8, 24, 6, 19, 26, 'wood'),
    box(25, 8, 24, 27, 19, 26, 'wood'), box(5, 18, 16, 6, 19, 24, 'brass'),
    box(25, 18, 16, 26, 19, 24, 'brass')],
};

const mounting = {
  'round-saddle': [box(7, 7, 12, 24, 8, 14, 'wood'), box(7, 23, 12, 24, 24, 14, 'wood'),
    box(12, 7, 12, 18, 23, 13, 'wood'), box(8, 6, 14, 23, 8, 16, 'wood')],
  slatted: [box(7, 6, 12, 24, 9, 14, 'wood'), box(7, 22, 12, 24, 24, 14, 'wood'),
    box(12, 8, 12, 18, 23, 14, 'wood')],
};

const designs = [];
for (const [back, upper] of Object.entries(backs)) {
  for (const [seat, cushion] of Object.entries(seats)) {
    for (const [base, stand] of Object.entries(feet)) {
      designs.push({
        schemaVersion: 1, id: `chair-${back}-${seat}-${base}`, category: 'furniture',
        layer: 'object', outlineMode: 'silhouette', tilePreset: '64x32', voxelsPerTile: 32,
        footprintTiles: [1, 1], palette: 'office-night', materials, ops: [...stand, ...(mounting[seat] ?? []), ...cushion, ...upper],
      });
    }
  }
}
await writeFamily('seating', designs);
