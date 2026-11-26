import { writeFamily } from './render.mjs';

const box = (x, y, z, X, Y, Z, material) => ({ op: 'box', from: [x, y, z], to: [X, Y, Z], material });
const cylinder = (x, y, zFrom, zTo, radius, material) => ({ op: 'cylinder', center: [x, y], zFrom, zTo, radius, material });
const materials = {
  oak: { kind: 'wood', color: '#b07c52' },
  walnut: { kind: 'wood', color: '#744e3f' },
  teal: { kind: 'matte', color: '#628e8c' },
  dark: { kind: 'matte', color: '#3b4e5c' },
  steel: { kind: 'metal', color: '#8097a3' },
  brass: { kind: 'metal', color: '#d4a953' },
  glass: { kind: 'glass', color: '#8bbac5' },
  red: { kind: 'matte', color: '#b76656' },
  cream: { kind: 'matte', color: '#ddd3ba' },
};

const structures = {
  raised: { bottom: 8, build: (w) => [4, w - 6].flatMap(x =>
    [6, 22].map(y => box(x, y, 0, x + 2, y + 2, 8, 'walnut'))) },
  plinth: { bottom: 4, build: (w) => [box(4, 6, 0, w - 5, 24, 3, 'walnut')] },
  caster: { bottom: 6, build: (w) => [5, w - 7].flatMap(x =>
    [6, 22].flatMap(y => [box(x, y, 0, x + 2, y + 2, 3, 'dark'), box(x, y, 4, x + 2, y + 2, 6, 'steel')])) },
  floating: { bottom: 11, build: (w) => [box(3, 4, 0, w - 4, 6, 11, 'walnut'),
    box(4, 6, 8, w - 5, 12, 11, 'dark')] },
  'steel-frame': { bottom: 5, build: (w, h) => [3, w - 5].flatMap(x =>
    [5, 24].map(y => box(x, y, 0, x + 1, y + 1, h + 2, 'steel'))) },
};

const profiles = {
  'low-console': { w: 56, h: 25, lid: (w, h) => [box(2, 3, h, w - 3, 27, h + 2, 'oak')] },
  'tall-wardrobe': { w: 51, h: 47, lid: (w, h) => [box(1, 2, h, w - 2, 27, h + 2, 'walnut'),
    box(2, 3, h + 3, w - 3, 26, h + 4, 'oak')] },
  'counter-height': { w: 62, h: 31, lid: (w, h) => [box(1, 2, h, w - 2, 29, h + 3, 'cream'),
    box(3, 3, h + 4, w - 4, 5, h + 7, 'cream')] },
  'compact-cube': { w: 29, h: 29, lid: (w, h) => [box(2, 4, h, w - 3, 26, h + 2, 'oak')] },
};

function fronts(type, w, h, z) {
  const left = 5, right = w - 6, middle = Math.floor((left + right) / 2);
  const split = Math.floor((z + h) / 2);
  const front = (a, low, stop, high, material='teal') => box(a, 24, low, stop, 25, high, material);
  const handle = (x, low) => box(x, 26, low, x + 2, 27, low + 1, 'brass');
  switch (type) {
    case 'apothecary-drawers': {
      const cols = w > 32 ? 4 : 2;
      const rows = h > 32 ? 4 : 2;
      const span = Math.floor((right - left + 1) / cols);
      const rise = Math.floor((h - z - 1) / rows);
      return Array.from({ length: cols * rows }, (_, i) => {
        const x = left + (i % cols) * span;
        const y = z + Math.floor(i / cols) * rise;
        return [front(x, y, x + span - 2, y + rise - 2, 'oak'), handle(x + Math.floor(span / 2) - 1, y + 2)];
      }).flat();
    }
    case 'glass-display':
      return [front(left, z, middle - 1, h - 2, 'glass'), front(middle + 1, z, right, h - 2, 'glass'),
        front(middle, z, middle, h - 2, 'walnut'), front(left, split, right, split, 'oak'),
        front(left, h - 3, right, h - 2, 'walnut'), handle(middle - 4, split - 3), handle(middle + 1, split - 3)];
    case 'locker-doors':
      return [front(left, z, middle - 1, h - 2, 'steel'), front(middle + 1, z, right, h - 2, 'steel'),
        ...[left + 1, middle + 2].flatMap(x => [h - 6, h - 9, h - 12].map(y => box(x, 26, y, x + 5, 26, y, 'dark'))),
        handle(middle - 5, split), handle(middle + 2, split)];
    case 'open-bins':
      return [box(left, 6, split, right, 25, split + 1, 'oak'), box(middle, 6, z, middle + 1, 25, h - 1, 'oak'),
        front(left + 1, z, middle - 1, z + 4, 'red'), front(middle + 2, z, right - 1, z + 4, 'teal'),
        front(left + 1, split + 1, middle - 1, split + 5, 'cream'),
        box(middle + 2, 13, split + 2, right - 1, 21, Math.min(split + 8, h - 2), 'steel')];
    case 'tambour-rolltop':
      return [front(left, z, right, split - 1, 'oak'), handle(middle - 1, z + 3),
        ...Array.from({ length: Math.floor((h - split) / 2) }, (_, i) =>
          front(left + 1, split + 2 * i, right - 1, split + 2 * i, 'walnut')),
        box(left, 24, split, left + 1, 26, h - 2, 'oak'),
        box(right - 1, 24, split, right, 26, h - 2, 'oak'),
        cylinder(middle, 25, split, split + 1, 2, 'brass')];
  }
  throw new Error(type);
}

const designs = [];
for (const [profile, { w, h, lid }] of Object.entries(profiles)) {
  for (const [stand, { bottom, build }] of Object.entries(structures)) {
    for (const type of ['apothecary-drawers', 'glass-display', 'locker-doors', 'open-bins', 'tambour-rolltop']) {
      const ops = [...build(w, h),
        box(3, 5, bottom, w - 4, 23, bottom + 1, 'oak'),
        box(3, 5, bottom + 2, 4, 24, h - 1, 'oak'),
        box(w - 5, 5, bottom + 2, w - 4, 24, h - 1, 'oak'),
        box(5, 5, bottom + 2, w - 6, 6, h - 1, 'walnut'),
        ...lid(w, h), ...fronts(type, w, h, bottom + 2)];
      designs.push({
        schemaVersion: 1, id: `storage-${profile}-${type}-${stand}`, category: 'furniture',
        layer: 'object', outlineMode: 'silhouette', tilePreset: '64x32', voxelsPerTile: 32,
        footprintTiles: [Math.ceil(w / 32), 1], palette: 'office-night', materials, ops,
      });
    }
  }
}
await writeFamily('storage', designs);
