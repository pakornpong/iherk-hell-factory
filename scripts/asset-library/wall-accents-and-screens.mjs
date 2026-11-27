import { writeFamily } from './render.mjs';

const box = (from, to, material) => ({ op: 'box', from, to, material });
const line = (from, to, material) => ({ op: 'line', from, to, material });

function design(id, category, footprintTiles, materials, ops, decals = []) {
  return {
    schemaVersion: 1, id, category, layer: 'object', outlineMode: 'silhouette',
    tilePreset: '64x32', voxelsPerTile: 32, footprintTiles, palette: 'office-night',
    materials, ops, decals,
  };
}

const oakSlat = design('divider-open-oak-slat-screen', 'room-divider', [2, 1], {
  oak: { kind: 'wood', color: '#bc8750' },
  endGrain: { kind: 'wood', color: '#735136' },
  iron: { kind: 'matte', color: '#373e43' },
  brass: { kind: 'metal', color: '#c4a668' },
}, [
  ...[10, 49].flatMap(x => [
    box([x, 6, 0], [x + 4, 25, 1], 'iron'),
    box([x + 1, 13, 2], [x + 3, 18, 7], 'iron'),
    box([x + 1, 22, 2], [x + 3, 23, 2], 'brass'),
  ]),
  box([4, 13, 7], [59, 18, 10], 'endGrain'),
  ...Array.from({ length: 9 }, (_, i) => {
    const x = 7 + i * 6;
    const top = 39 - Math.floor(Math.abs(i - 6) / 2) * 3;
    return box([x, 15, 10], [x + 1, 16, top], 'oak');
  }),
  box([6, 13, 29], [57, 14, 30], 'endGrain'),
]);

const felt = design('divider-moss-felt-privacy-panel', 'room-divider', [1, 1], {
  bronze: { kind: 'metal', color: '#957d62' },
  black: { kind: 'matte', color: '#3f423b' },
  moss: { kind: 'matte', color: '#65774b' },
  sage: { kind: 'matte', color: '#8c9b62' },
  olive: { kind: 'matte', color: '#505c3c' },
}, [
  ...[4, 25].flatMap(x => [
    box([x, 7, 0], [x + 2, 24, 2], 'black'),
    box([x, 13, 2], [x + 2, 18, 33], 'bronze'),
  ]),
  box([5, 13, 6], [26, 18, 31], 'olive'),
  box([7, 12, 8], [24, 19, 32], 'moss'),
  box([9, 12, 32], [22, 19, 35], 'moss'),
  ...[8, 12, 16, 20, 24].flatMap((x, i) => [
    box([x, 11, 9], [x, 12, i === 0 || i === 4 ? 30 : 33], 'sage'),
    box([x, 19, 9], [x, 20, i === 0 || i === 4 ? 30 : 33], 'sage'),
  ]),
  box([5, 12, 6], [26, 19, 7], 'bronze'),
]);

const caneLeaves = [
  [[5, 8], [22, 21], 32],
  [[22, 21], [42, 10], 38],
  [[42, 10], [58, 20], 34],
];
const cane = design('divider-folding-cane-screen', 'room-divider', [2, 1], {
  walnut: { kind: 'wood', color: '#694b3c' },
  cane: { kind: 'wood', color: '#ba925b' },
  reed: { kind: 'matte', color: '#dbb87b' },
  hinge: { kind: 'metal', color: '#d3aa64' },
}, [
  ...caneLeaves.flatMap(([start, end, height]) => {
    const [x, y] = start;
    const [endX, endY] = end;
    const leafWidth = endX - x;
    const alongLeaf = (n) => [x + n, y + Math.round((endY - y) * n / leafWidth)];
    return [
      ...Array.from({ length: leafWidth - 2 }, (_, i) => {
        const [u, v] = alongLeaf(i + 2);
        return box([u, v, 7], [u, v + 1, height - 2], i % 3 === 0 ? 'reed' : 'cane');
      }),
      ...[7, 13, 19, 25].flatMap(z => [
        line([x + 1, y, z], [endX - 1, endY, z], 'reed'),
        line([x + 1, y + 2, z], [endX - 1, endY + 2, z], 'reed'),
      ]),
      ...[5, 6, height - 1, height].flatMap(z => [
        line([x, y, z], [endX, endY, z], 'walnut'),
        line([x, y + 1, z], [endX, endY + 1, z], 'walnut'),
      ]),
      ...[start, end].map(([u, v]) => box([u - 1, v, 0], [u + 1, v + 2, height], 'walnut')),
    ];
  }),
  ...[[22, 21], [42, 10]].flatMap(([x, y]) => [10, 27].map(z =>
    box([x - 1, y - 1, z], [x + 1, y + 3, z + 1], 'hinge'))),
]);

const dusk = design('wall-art-copper-dusk-floor-frame', 'wall-decor', [1, 1], {
  walnut: { kind: 'wood', color: '#70503b' },
  brass: { kind: 'metal', color: '#c69e5a' },
  mat: { kind: 'matte', color: '#ddd1ac' },
  sky: { kind: 'matte', color: '#ac6b50' },
  sun: { kind: 'matte', color: '#ffcc76' },
  ridge: { kind: 'matte', color: '#92534c' },
  river: { kind: 'matte', color: '#597a7a' },
  shore: { kind: 'matte', color: '#394f51' },
}, [
  box([4, 3, 0], [27, 13, 2], 'walnut'),
  box([7, 4, 2], [24, 11, 4], 'brass'),
  box([8, 5, 4], [9, 8, 14], 'walnut'),
  box([22, 5, 4], [23, 8, 14], 'walnut'),
  box([4, 4, 12], [27, 8, 36], 'walnut'),
  box([5, 9, 13], [26, 9, 35], 'brass'),
  box([6, 10, 14], [25, 10, 34], 'mat'),
], [{
  face: '+Y', origin: [8, 11, 32],
  legend: { '.': 'sky', o: 'sun', r: 'ridge', '~': 'river', '#': 'shore' },
  rows: [
    '................',
    '........oo......',
    '.......oooo.....',
    '.......oooo.....',
    '......oooooo....',
    '......oooooo....',
    '.......oooo.....',
    '....r..oooo.....',
    '...rrr..oo....rr',
    '..rrrrr......rrr',
    'rrrrrrrr....rrrr',
    '~~~~~rrr...rrrrr',
    '##~~~~~~..rrrrrr',
    '####~~~~~~~~~###',
    '####~~~~~~~~####',
    '###~~~~~~~######',
    '##~~~~~~~~######',
  ],
}]);

await writeFamily('wall-accents-and-screens', [dusk, oakSlat, felt, cane]);
