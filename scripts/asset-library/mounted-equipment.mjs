import { writeFamily } from './render.mjs';

const box = (x, y, z, endX, endY, endZ, material) => ({
  op: 'box', from: [x, y, z], to: [endX, endY, endZ], material,
});
const line = (x, y, z, endX, endY, endZ, material) => ({
  op: 'line', from: [x, y, z], to: [endX, endY, endZ], material,
});
const wedge = (x, y, z, endX, endY, endZ, axis, material) => ({
  op: 'slope', from: [x, y, z], to: [endX, endY, endZ], axis, material,
});
const face = (x, z, endX, endZ, y, material) => box(x, y, z, endX, y, endZ, material);
const mount = (x, z, endX, endZ, material = 'steel') => box(x, 0, z, endX, 1, endZ, material);
const board = (x, endX, z, depth, material = 'oak') => box(x, 1, z, endX, depth, z + 1, material);

const materials = {
  ink: { kind: 'matte', color: '#222a32' },
  gray: { kind: 'matte', color: '#68727a' },
  ivory: { kind: 'matte', color: '#ded8c9' },
  white: { kind: 'matte', color: '#ece9dc' },
  steel: { kind: 'metal', color: '#a6aeb1' },
  brass: { kind: 'metal', color: '#c6a16b' },
  red: { kind: 'matte', color: '#b64641' },
  orange: { kind: 'matte', color: '#d9914b' },
  green: { kind: 'matte', color: '#648765' },
  teal: { kind: 'matte', color: '#487d80' },
  blue: { kind: 'matte', color: '#506b8c' },
  cyan: { kind: 'emissive', color: '#7ed5cf' },
  glass: { kind: 'glass', color: '#a6c5cd' },
  oak: { kind: 'wood', color: '#b88758' },
  pine: { kind: 'wood', color: '#cda978' },
  walnut: { kind: 'wood', color: '#77503a' },
};

function disk(x, z, back, front, radius, material) {
  return Array.from({ length: 2 * radius + 1 }, (_, row) => {
    const offset = row - radius;
    const halfWidth = Math.floor(Math.sqrt(radius * radius - offset * offset));
    return box(x - halfWidth, back, z + offset, x + halfWidth, front, z + offset, material);
  });
}

function ring(x, z, back, front, radius, material) {
  return [
    ...disk(x, z, back, front, radius, material),
    ...disk(x, z, back, front, radius - 2, null),
  ];
}

const communications = {
  'swivel-monitor': [
    mount(12, 3, 19, 13, 'gray'), box(14, 1, 7, 17, 6, 9, 'steel'),
    box(3, 6, 0, 28, 8, 16, 'ink'), face(5, 2, 26, 15, 9, 'blue'),
    face(7, 11, 18, 12, 10, 'cyan'), face(7, 8, 14, 9, 10, 'glass'),
    face(24, 0, 26, 0, 9, 'green'),
  ],
  'articulated-security-camera': [
    mount(11, 5, 20, 16, 'ivory'), box(14, 1, 8, 17, 5, 11, 'steel'),
    line(16, 4, 9, 11, 9, 14, 'steel'), box(9, 5, 12, 21, 9, 19, 'ivory'),
    box(8, 5, 20, 22, 10, 21, 'white'), ...disk(15, 15, 10, 10, 3, 'ink'),
    ...disk(15, 15, 11, 11, 1, 'glass'), box(14, 1, 0, 17, 2, 5, 'gray'),
  ],
  'dome-security-camera': [
    mount(7, 16, 24, 22, 'ivory'), board(7, 24, 15, 10, 'white'),
    box(10, 3, 11, 21, 9, 15, 'gray'), box(12, 4, 6, 19, 10, 12, 'glass'),
    box(13, 5, 2, 18, 9, 7, 'gray'), box(15, 6, 0, 17, 8, 3, 'ink'),
    ...disk(16, 8, 10, 11, 2, 'ink'), face(16, 8, 16, 8, 11, 'cyan'),
  ],
  'two-way-intercom': [
    mount(7, 1, 24, 22, 'gray'), box(8, 1, 0, 23, 5, 21, 'ivory'),
    box(9, 5, 1, 13, 8, 18, 'ink'), box(8, 7, 1, 14, 9, 5, 'gray'),
    box(8, 7, 15, 14, 9, 19, 'gray'), face(16, 14, 21, 18, 6, 'glass'),
    ...[5, 8, 11].flatMap(z => [16, 19, 22].map(x => face(x, z, x + 1, z + 1, 6, 'steel'))),
  ],
  'apartment-video-doorbell': [
    mount(11, 0, 20, 24, 'steel'), box(12, 1, 1, 19, 4, 23, 'ink'),
    box(10, 2, 23, 21, 7, 25, 'gray'), ...disk(15, 18, 5, 6, 3, 'gray'),
    ...disk(15, 18, 7, 7, 1, 'glass'), ...disk(15, 6, 5, 5, 3, 'teal'),
    ...disk(15, 6, 6, 6, 1, 'cyan'),
  ],
  'access-card-reader': [
    mount(8, 3, 23, 16, 'steel'), box(7, 1, 6, 24, 5, 13, 'gray'),
    box(9, 2, 0, 22, 7, 7, 'ink'), box(12, 5, 4, 19, 8, 5, 'blue'),
    face(11, 10, 20, 12, 6, 'teal'), face(13, 12, 18, 13, 7, 'cyan'),
    face(10, 15, 12, 16, 2, 'brass'), face(19, 15, 21, 16, 2, 'brass'),
  ],
  'fingerprint-time-clock': [
    mount(8, 4, 23, 22, 'gray'), box(7, 1, 8, 24, 5, 24, 'ink'),
    box(10, 2, 0, 21, 8, 9, 'gray'), box(13, 6, 2, 18, 10, 6, 'teal'),
    face(10, 15, 21, 22, 6, 'blue'), face(12, 19, 18, 20, 7, 'cyan'),
    ...[10, 15, 20].map(x => face(x, 10, x + 1, 11, 6, 'steel')),
  ],
  'dual-antenna-wifi-router': [
    mount(8, 2, 23, 12, 'gray'), box(5, 2, 0, 26, 9, 9, 'ivory'),
    box(6, 4, 1, 25, 11, 4, 'ink'), box(5, 2, 8, 7, 3, 22, 'gray'),
    box(24, 2, 8, 26, 3, 25, 'gray'),
    ...[8, 12, 16, 20, 24].map(x => face(x, 2, x, 2, 11, 'cyan')),
  ],
  'round-wifi-access-point': [
    ...disk(15, 11, 0, 2, 11, 'steel'), ...disk(15, 11, 3, 5, 10, 'ivory'),
    ...disk(15, 11, 6, 7, 7, 'white'), face(13, 13, 17, 13, 8, 'cyan'),
  ],
  'fiber-optic-splice-box': [
    mount(11, 0, 21, 24, 'steel'), box(7, 2, 4, 25, 6, 25, 'ivory'),
    box(6, 6, 6, 20, 8, 23, 'white'), box(20, 7, 10, 25, 10, 19, 'gray'),
    ...[9, 13, 17, 21].map(x => box(x, 3, 0, x + 1, 4, 4, 'ink')),
    face(10, 17, 16, 20, 9, 'orange'), face(12, 18, 14, 20, 10, 'ivory'),
  ],
  'network-patch-panel': [
    mount(3, 0, 28, 5, 'steel'), box(6, 1, 1, 25, 5, 8, 'gray'),
    box(3, 5, 0, 28, 7, 5, 'ink'),
    ...[6, 10, 14, 18, 22].flatMap((x, i) => [
      box(x, 7, 2, x + 2, 8, 4, 'steel'),
      face(x + 1, 3, x + 1, 3, 9, i < 3 ? 'orange' : 'glass'),
    ]),
  ],
  'compact-pa-horn-speaker': [
    mount(11, 5, 20, 17, 'gray'), box(13, 1, 8, 18, 4, 12, 'steel'),
    ...disk(15, 9, 3, 5, 4, 'gray'), ...disk(15, 9, 6, 7, 6, 'ivory'),
    ...disk(15, 9, 8, 9, 8, 'ivory'), ...ring(15, 9, 10, 11, 9, 'steel'),
    ...disk(15, 9, 9, 9, 5, 'ink'), ...disk(15, 9, 10, 10, 2, 'gray'),
  ],
  'column-speaker': [
    mount(11, 4, 20, 24, 'steel'), box(10, 2, 0, 21, 7, 27, 'ink'),
    box(11, 8, 2, 20, 9, 25, 'gray'), box(12, 5, 26, 19, 8, 27, 'steel'),
    ...[6, 13, 20].flatMap(z => disk(15, z, 10, 10, 3, 'ink')),
    face(15, 2, 16, 2, 10, 'cyan'),
  ],
  'under-screen-soundbar': [
    mount(7, 1, 24, 4, 'gray'), box(2, 2, 1, 29, 6, 6, 'ink'),
    box(4, 6, 0, 27, 8, 6, 'gray'), face(6, 2, 25, 5, 9, 'ink'),
    ...[8, 12, 18, 22].map(x => face(x, 2, x + 1, 5, 9, 'gray')),
    face(15, 4, 17, 4, 10, 'cyan'),
  ],
  'studio-headphone-jack-panel': [
    mount(8, 2, 23, 12, 'walnut'), box(9, 1, 0, 22, 5, 11, 'oak'),
    box(10, 5, 2, 21, 7, 9, 'ink'), ...[12, 19].flatMap(x => [
      ...disk(x, 6, 8, 9, 2, 'brass'), face(x, 6, x, 6, 10, 'ink'),
    ]), box(14, 6, 0, 17, 11, 1, 'steel'),
  ],
  'wireless-microphone-charging-dock': [
    mount(9, 0, 22, 11, 'gray'), box(7, 1, 0, 24, 9, 7, 'ink'),
    box(8, 7, 5, 23, 11, 7, 'blue'),
    ...[12, 20].flatMap((x, i) => [
      box(x - 1, 4, 6, x + 1, 6, 16 + 3 * i, 'gray'),
      box(x - 2, 3, 16 + 3 * i, x + 2, 7, 22 + 3 * i, 'steel'),
      face(x - 1, 2, x + 1, 3, 10, 'cyan'),
    ]),
  ],
  'landline-telephone': [
    mount(7, 3, 23, 23, 'walnut'), box(8, 1, 4, 22, 4, 22, 'ivory'),
    box(7, 4, 4, 11, 7, 22, 'gray'), box(6, 6, 3, 12, 8, 7, 'ink'),
    box(6, 6, 19, 12, 8, 23, 'ink'), face(14, 18, 20, 20, 5, 'glass'),
    ...[8, 11, 14].flatMap(z => [14, 17, 20].map(x => face(x, z, x + 1, z + 1, 5, 'steel'))),
    line(8, 5, 4, 10, 5, 0, 'ink'), line(10, 5, 0, 17, 4, 4, 'ink'),
  ],
  'corded-radio-handset': [
    mount(6, 4, 25, 19, 'steel'), box(7, 2, 5, 18, 7, 17, 'green'),
    box(9, 3, 17, 10, 4, 27, 'ink'), face(9, 13, 16, 15, 8, 'glass'),
    face(10, 7, 15, 11, 8, 'ink'), box(20, 2, 6, 24, 7, 19, 'gray'),
    line(22, 5, 8, 20, 5, 0, 'ink'), line(20, 5, 0, 15, 5, 5, 'ink'),
  ],
  'occupancy-motion-sensor': [
    mount(8, 3, 23, 19, 'steel'), box(9, 1, 3, 22, 4, 19, 'ivory'),
    box(10, 2, 0, 21, 6, 10, 'white'), box(12, 5, 3, 19, 8, 9, 'glass'),
    ...[4, 7].map(z => face(13, z, 18, z, 9, 'white')),
    face(14, 14, 17, 14, 5, 'green'),
  ],
  'ceiling-projector-wall-arm': [
    mount(10, 4, 21, 12, 'gray'), box(14, 1, 9, 17, 9, 11, 'steel'),
    box(6, 4, 0, 25, 9, 8, 'ivory'), box(8, 9, 1, 23, 10, 7, 'gray'),
    ...disk(11, 4, 11, 11, 3, 'ink'), ...disk(11, 4, 11, 11, 1, 'cyan'),
    ...[2, 4, 6].map(z => face(17, z, 22, z, 11, 'ink')),
  ],
};

const appliancesAndControls = {
  'split-air-conditioner': [
    mount(3, 3, 28, 11, 'gray'), box(2, 1, 3, 29, 7, 11, 'white'),
    box(4, 5, 0, 27, 9, 5, 'ivory'), face(5, 2, 26, 3, 10, 'ink'),
    ...[8, 12, 16, 20, 24].map(x => face(x, 0, x + 1, 2, 10, 'steel')),
    face(23, 8, 26, 8, 8, 'cyan'),
  ],
  'oscillating-cage-fan': [
    mount(12, 2, 19, 17, 'gray'), box(14, 2, 0, 17, 8, 12, 'steel'),
    ...ring(15, 16, 7, 9, 11, 'steel'),
    ...[0, 1, 2].map(i => line(6 + i * 9, 8, 12, 13 + i * 2, 8, 25, 'gray')),
    line(6, 8, 17, 24, 8, 15, 'gray'), line(8, 8, 10, 23, 8, 22, 'gray'),
    ...disk(15, 16, 9, 11, 3, 'white'), box(16, 8, 19, 19, 9, 23, 'teal'),
    box(9, 8, 12, 12, 9, 15, 'teal'), box(17, 8, 11, 22, 9, 15, 'teal'),
  ],
  'square-exhaust-fan': [
    mount(5, 0, 26, 21, 'steel'), box(5, 2, 0, 26, 4, 21, 'ivory'),
    ...disk(15, 10, 4, 4, 8, 'ink'), ...ring(15, 10, 5, 7, 9, 'gray'),
    box(13, 6, 4, 17, 7, 16, 'steel'), box(9, 6, 8, 21, 7, 12, 'steel'),
    ...disk(15, 10, 8, 9, 3, 'ink'),
  ],
  'slatted-air-vent': [
    mount(2, 0, 29, 11, 'steel'), box(4, 1, 1, 27, 3, 10, 'ink'),
    ...[2, 6, 10].map(z => board(4, 27, z, 8, 'gray')),
    ...[2, 28].map(x => box(x, 2, 0, x + 1, 8, 11, 'steel')),
  ],
  'wall-air-purifier': [
    mount(7, 0, 24, 24, 'steel'), box(8, 1, 1, 23, 6, 25, 'ivory'),
    box(10, 5, 3, 21, 9, 22, 'white'), face(12, 19, 19, 20, 10, 'teal'),
    ...[5, 8, 11, 14].map(z => face(12, z, 19, z, 10, 'gray')),
    box(13, 4, 25, 18, 7, 27, 'gray'),
  ],
  'infrared-bar-heater': [
    mount(7, 5, 24, 9, 'gray'), box(4, 1, 4, 27, 4, 10, 'ink'),
    box(2, 3, 1, 29, 6, 3, 'gray'), box(2, 3, 10, 29, 8, 12, 'steel'),
    ...[2, 27].map(x => box(x, 4, 0, x + 2, 10, 11, 'steel')),
    ...[4, 8].map(z => face(5, z, 26, z, 7, 'orange')),
    ...[8, 13, 18, 23].map(x => face(x, 3, x, 9, 9, 'ink')),
  ],
  'wall-hand-dryer': [
    mount(8, 4, 23, 19, 'steel'), wedge(7, 1, 5, 24, 8, 19, '-Y', 'ivory'),
    box(8, 3, 4, 23, 9, 9, 'white'), box(12, 4, 0, 19, 7, 4, 'gray'),
    box(13, 5, 0, 18, 8, 1, 'ink'), face(14, 8, 17, 8, 10, 'cyan'),
  ],
  'hotel-hair-dryer-dock': [
    mount(10, 3, 21, 22, 'white'), box(11, 2, 5, 20, 6, 22, 'teal'),
    box(12, 5, 10, 16, 8, 19, 'ivory'), box(9, 6, 19, 23, 10, 24, 'white'),
    box(21, 7, 20, 25, 9, 23, 'gray'), line(14, 8, 10, 12, 8, 0, 'ink'),
    line(12, 8, 0, 18, 6, 5, 'ink'),
  ],
  'electric-kettle-dispenser': [
    mount(8, 3, 23, 25, 'gray'), box(9, 2, 7, 22, 8, 25, 'ivory'),
    box(10, 1, 1, 21, 2, 8, 'gray'),
    box(12, 6, 20, 19, 9, 26, 'steel'), box(11, 7, 7, 20, 9, 12, 'gray'),
    box(14, 8, 6, 17, 11, 8, 'steel'), board(9, 22, 0, 11, 'gray'),
    face(13, 16, 18, 20, 9, 'glass'), face(14, 17, 17, 18, 10, 'cyan'),
  ],
  'electric-vehicle-charger': [
    mount(9, 6, 22, 24, 'steel'), box(9, 2, 7, 22, 6, 26, 'ink'),
    box(11, 5, 9, 20, 8, 24, 'green'), face(13, 19, 18, 22, 9, 'cyan'),
    box(20, 6, 8, 25, 10, 13, 'gray'), line(23, 8, 8, 23, 8, 1, 'ink'),
    line(23, 8, 1, 10, 8, 0, 'ink'), line(10, 8, 0, 7, 7, 4, 'ink'),
    line(7, 7, 4, 9, 5, 8, 'ink'),
  ],
  'thermostat-dial': [
    ...disk(15, 8, 0, 2, 8, 'steel'), ...disk(15, 8, 3, 4, 7, 'ivory'),
    ...disk(15, 8, 5, 7, 5, 'gray'), ...disk(15, 8, 8, 9, 3, 'white'),
    line(15, 10, 9, 17, 10, 12, 'orange'),
  ],
  'split-temperature-controller': [
    mount(5, 0, 26, 15, 'steel'), box(5, 2, 4, 26, 6, 16, 'ink'),
    box(8, 4, 0, 23, 5, 4, 'gray'), face(7, 8, 15, 14, 7, 'blue'),
    face(17, 8, 24, 14, 7, 'teal'), face(9, 11, 13, 12, 8, 'cyan'),
    face(19, 11, 22, 12, 8, 'orange'), ...[8, 13, 18, 23].map(x => face(x, 5, x + 1, 6, 7, 'steel')),
  ],
  'lever-circuit-breaker-panel': [
    mount(4, 0, 27, 19, 'steel'), box(5, 1, 2, 26, 7, 21, 'gray'),
    face(7, 5, 24, 18, 8, 'ink'),
    ...[8, 13, 18].flatMap(x => [box(x, 7, 8, x + 3, 9, 16, 'ivory'), box(x, 9, 9, x + 3, 11, 12, 'ink')]),
    box(23, 6, 6, 25, 10, 16, 'steel'), face(8, 18, 18, 18, 9, 'orange'),
  ],
  'utility-electricity-meter': [
    mount(7, 0, 24, 23, 'gray'), box(8, 1, 1, 23, 5, 25, 'ivory'),
    ...disk(15, 15, 5, 8, 8, 'steel'), ...disk(15, 15, 9, 9, 6, 'glass'),
    face(11, 15, 19, 17, 10, 'ink'), face(12, 16, 18, 16, 11, 'cyan'),
    box(12, 5, 0, 19, 7, 7, 'gray'),
  ],
  'industrial-emergency-stop': [
    mount(8, 0, 23, 17, 'steel'), box(7, 1, 2, 24, 5, 19, 'orange'),
    ...disk(15, 11, 6, 8, 5, 'ink'), ...disk(15, 11, 9, 10, 6, 'red'),
    face(12, 2, 19, 4, 6, 'ink'), box(14, 1, 0, 17, 4, 2, 'steel'),
  ],
  'triple-indicator-stack-light': [
    mount(10, 1, 21, 10, 'gray'), board(10, 21, 0, 10, 'steel'),
    box(13, 4, 2, 18, 8, 26, 'ink'),
    box(11, 3, 5, 20, 10, 9, 'green'), box(11, 3, 12, 20, 10, 16, 'orange'),
    box(11, 3, 19, 20, 10, 23, 'red'), box(13, 3, 25, 18, 9, 27, 'steel'),
  ],
  'industrial-alarm-bell': [
    mount(12, 0, 19, 24, 'gray'), ...disk(15, 14, 2, 4, 10, 'red'),
    ...disk(15, 14, 5, 6, 8, 'red'), ...disk(15, 14, 7, 8, 5, 'red'),
    ...disk(15, 14, 9, 9, 2, 'steel'), box(14, 5, 1, 17, 7, 5, 'gray'),
  ],
  'twin-head-emergency-light': [
    mount(9, 0, 22, 12, 'steel'), box(8, 2, 1, 23, 6, 13, 'ivory'),
    box(6, 2, 13, 10, 5, 18, 'steel'), box(21, 2, 13, 25, 5, 18, 'steel'),
    ...[7, 24].flatMap(x => [
      ...disk(x, 20, 3, 8, 5, 'gray'), ...disk(x, 20, 9, 10, 3, 'white'),
    ]), face(14, 4, 17, 4, 7, 'green'),
  ],
  'smart-socket-usb-plate': [
    mount(5, 0, 26, 13, 'ivory'), box(6, 1, 1, 25, 4, 12, 'white'),
    box(8, 4, 2, 17, 6, 11, 'gray'), face(9, 4, 10, 7, 7, 'ink'),
    face(14, 4, 15, 7, 7, 'ink'), face(12, 8, 13, 9, 7, 'ink'),
    ...[4, 8].map(z => box(19, 5, z, 23, 8, z + 1, 'ink')),
    face(21, 11, 22, 11, 5, 'cyan'),
  ],
  'rubber-covered-workshop-outlet': [
    mount(10, 0, 21, 21, 'steel'), box(9, 2, 3, 22, 7, 18, 'gray'),
    ...disk(15, 13, 7, 9, 6, 'ink'), box(10, 5, 17, 21, 8, 21, 'orange'),
    box(13, 5, 0, 18, 9, 4, 'ink'), face(12, 10, 18, 10, 10, 'steel'),
  ],
};

const shelves = {
  'floating-oak-shelf': [
    mount(4, 0, 27, 5, 'walnut'), box(2, 1, 1, 29, 11, 5, 'oak'),
    face(3, 4, 28, 4, 11, 'pine'),
  ],
  'industrial-pipe-shelf': [
    ...[7, 24].flatMap(x => [
      ...disk(x, 3, 0, 1, 3, 'gray'), box(x - 1, 1, 2, x + 1, 9, 4, 'ink'),
      box(x - 2, 7, 1, x + 2, 10, 6, 'gray'),
    ]), board(3, 28, 6, 11, 'walnut'), face(3, 7, 28, 7, 11, 'oak'),
  ],
  'glass-shelf-with-brass-clamps': [
    ...[7, 24].flatMap(x => [
      mount(x - 1, 0, x + 1, 6, 'brass'), box(x - 2, 1, 2, x + 2, 8, 4, 'brass'),
      box(x - 2, 7, 3, x + 2, 9, 6, 'brass'),
    ]), board(3, 28, 5, 11, 'glass'),
  ],
  'triple-tier-ladder-shelf': [
    ...[6, 24].map(x => mount(x, 0, x + 1, 27, 'walnut')),
    board(4, 27, 4, 11, 'oak'), board(6, 25, 13, 8, 'oak'),
    board(7, 24, 22, 6, 'pine'),
  ],
  'staggered-step-shelf': [
    board(3, 14, 0, 11), box(13, 0, 0, 15, 10, 9, 'oak'),
    board(14, 22, 8, 11), box(21, 0, 8, 23, 10, 17, 'oak'),
    board(22, 28, 16, 11), mount(3, 1, 7, 3, 'walnut'), mount(25, 16, 28, 20, 'walnut'),
  ],
  'arched-niche-shelf': [
    board(6, 25, 0, 11, 'white'), ...ring(15, 15, 1, 8, 11, 'ivory'),
    box(5, 1, 1, 7, 8, 17, 'ivory'), box(23, 1, 1, 25, 8, 17, 'ivory'),
    mount(6, 0, 24, 2, 'steel'), board(8, 22, 11, 7, 'pine'),
  ],
  'hexagon-cell-shelf': [
    board(9, 22, 0, 10), board(9, 22, 22, 10),
    ...Array.from({ length: 10 }, (_, row) => {
      const step = Math.floor(row / 2);
      return [box(8 - step, 0, row + 1, 9 - step, 10, row + 1, 'walnut'),
        box(22 + step, 0, row + 1, 23 + step, 10, row + 1, 'walnut'),
        box(8 - step, 0, 21 - row, 9 - step, 10, 21 - row, 'oak'),
        box(22 + step, 0, 21 - row, 23 + step, 10, 21 - row, 'oak')];
    }).flat(),
    ...[4, 26].map(x => box(x, 0, 10, x + 1, 10, 12, 'oak')),
  ],
  'round-inset-shelf': [
    ...ring(15, 13, 1, 9, 13, 'ink'), board(5, 25, 7, 10, 'pine'),
    board(4, 26, 16, 9, 'pine'), mount(14, 0, 16, 3, 'steel'),
    mount(14, 24, 16, 26, 'steel'),
  ],
  'asymmetric-cubby-shelf': [
    board(3, 28, 0, 10), board(3, 28, 9, 10), board(3, 28, 23, 10),
    ...[3, 14, 27].map(x => box(x, 0, 0, x + 1, 10, x === 14 ? 23 : 24, 'walnut')),
    board(15, 27, 18, 8, 'pine'),
  ],
  'front-lip-book-ledge-shelf': [
    mount(3, 5, 28, 9, 'walnut'), board(3, 28, 0, 11),
    box(3, 10, 1, 28, 11, 5, 'oak'), face(4, 5, 27, 5, 11, 'pine'),
    ...[5, 24].map(x => box(x, 1, 0, x + 2, 2, 7, 'walnut')),
  ],
  'picture-rail-shelf': [
    mount(2, 2, 29, 5, 'walnut'), board(2, 29, 0, 7, 'oak'),
    ...[4, 12, 21, 27].map(x => box(x, 5, 2, x + 1, 6, 8, 'brass')),
    box(3, 6, 6, 28, 8, 7, 'brass'),
  ],
  'slotted-mail-sorting-shelf': [
    board(3, 28, 0, 10, 'walnut'), mount(4, 1, 27, 11, 'oak'),
    ...[3, 9, 15, 22, 27].map(x => {
      return wedge(x, 1, 1, x + 1, 10, 18, '-Y', 'pine');
    }),
    box(3, 9, 1, 28, 10, 4, 'walnut'),
  ],
  'wire-basket-shelf': [
    ...[6, 24].map(x => mount(x, 0, x + 1, 14, 'gray')),
    ...[4, 8, 12, 16, 20, 24, 27].flatMap(x => [
      line(x, 1, 0, x, 10, 0, 'steel'),
      line(x, 9, 0, x, 11, 10, 'steel'),
    ]), box(4, 10, 4, 27, 10, 4, 'gray'),
    box(4, 11, 10, 27, 11, 11, 'steel'),
    ...[4, 27].map(x => line(x, 1, 11, x, 11, 11, 'steel')),
  ],
  'perforated-utility-shelf': [
    mount(4, 0, 27, 5, 'steel'), board(3, 28, 3, 11, 'gray'),
    ...[7, 12, 17, 22].flatMap(x => [4, 7].map(y => box(x, y, 3, x + 1, y + 1, 4, null))),
    ...[3, 27].map(x => box(x, 2, 0, x + 1, 11, 7, 'steel')),
  ],
  'slatted-bamboo-shower-shelf': [
    ...[5, 11, 17, 23].map(x => board(x, x + 2, 2, 11, 'pine')),
    ...[6, 24].map(x => mount(x, 0, x + 1, 6, 'ink')),
    box(4, 2, 2, 27, 3, 3, 'walnut'), box(4, 10, 2, 27, 11, 3, 'walnut'),
    box(4, 10, 7, 27, 11, 8, 'ink'),
    ...[5, 26].map(x => box(x, 10, 3, x, 10, 7, 'ink')),
  ],
  'potting-shelf-with-drip-tray': [
    mount(4, 4, 27, 12, 'gray'), board(3, 28, 1, 11, 'walnut'),
    ...[3, 27].map(x => box(x, 2, 0, x + 1, 11, 5, 'teal')),
    box(3, 10, 2, 28, 11, 5, 'teal'), board(5, 26, 10, 8, 'gray'),
    ...[8, 16, 23].map(x => box(x - 1, 4, 10, x + 1, 6, 11, null)),
  ],
  'rolled-plan-shelf': [
    mount(5, 0, 26, 4, 'steel'), board(4, 27, 2, 10, 'walnut'),
    ...[9, 22].flatMap(x => [
      ...ring(x, 10, 2, 10, 6, 'steel'), ...ring(x, 10, 10, 11, 6, 'brass'),
    ]), face(13, 0, 18, 2, 10, 'oak'),
  ],
  'fold-down-laptop-shelf': [
    mount(4, 7, 27, 24, 'walnut'), box(5, 1, 7, 26, 3, 24, 'oak'),
    board(4, 27, 4, 11, 'pine'),
    box(4, 1, 4, 27, 3, 7, 'brass'),
    ...[5, 26].map(x => line(x, 10, 4, x, 2, 0, 'steel')),
    face(12, 20, 19, 21, 4, 'brass'),
  ],
  'rope-suspended-shelf': [
    board(5, 26, 0, 11, 'oak'), board(5, 26, 13, 10, 'oak'),
    mount(13, 21, 18, 27, 'brass'),
    ...[7, 24].flatMap(x => [
      line(x, 3, 0, x, 3, 14, 'pine'), line(x, 10, 0, x, 10, 14, 'pine'),
      line(x, 3, 14, 15, 1, 24, 'pine'), line(x, 10, 14, 15, 1, 24, 'pine'),
    ]),
  ],
  'steel-triangle-bracket-shelf': [
    ...[5, 23].flatMap(x => [
      mount(x, 0, x + 3, 16, 'ink'),
      line(x + 1, 2, 0, x + 1, 11, 14, 'steel'),
      line(x + 2, 2, 0, x + 2, 11, 14, 'steel'),
    ]), board(2, 29, 14, 11, 'walnut'),
  ],
};

const storageAndRacks = {
  'locker-cabinet-with-key-door': [
    mount(5, 1, 26, 26, 'steel'), box(4, 2, 0, 27, 8, 27, 'teal'),
    box(5, 8, 1, 26, 9, 25, 'gray'), face(7, 3, 18, 23, 10, 'teal'),
    face(20, 3, 24, 23, 10, 'teal'), ...[18, 20, 22].map(z => face(9, z, 15, z, 11, 'ink')),
    face(17, 10, 18, 12, 11, 'steel'), face(22, 10, 23, 12, 11, 'steel'),
  ],
  'open-key-cabinet': [
    mount(7, 1, 24, 22, 'steel'), box(7, 1, 1, 24, 5, 24, 'walnut'),
    face(9, 3, 22, 22, 6, 'pine'), box(4, 5, 0, 7, 11, 24, 'oak'),
    ...[10, 15, 20].flatMap(x => [
      box(x, 6, 13, x + 1, 7, 17, 'brass'), box(x, 7, 9, x, 8, 14, 'steel'),
    ]),
  ],
  'pegboard-tool-rack': [
    mount(3, 0, 28, 23, 'oak'), board(4, 27, 0, 7, 'walnut'),
    ...[4, 8, 12, 16, 20].flatMap(z => [6, 11, 16, 21, 25].map(x => face(x, z, x, z, 2, 'walnut'))),
    box(7, 3, 8, 9, 6, 18, 'teal'), box(6, 4, 18, 14, 7, 21, 'steel'),
    box(17, 3, 4, 18, 6, 14, 'steel'), box(16, 4, 12, 21, 6, 17, 'steel'),
    face(18, 15, 19, 17, 7, 'ink'), box(23, 2, 10, 24, 5, 19, 'red'),
  ],
  'magnetic-knife-rack': [
    mount(3, 9, 28, 15, 'walnut'), box(4, 2, 10, 27, 4, 14, 'steel'),
    ...[7, 14, 21].flatMap((x, i) => [
      box(x, 4, 3 * i, x + 2, 6, 10 + i, 'walnut'),
      wedge(x, 4, 10 + i, x + 4, 5, 22 + i, '+X', 'steel'),
    ]),
  ],
  'pot-and-pan-rack': [
    mount(3, 15, 28, 21, 'gray'), box(4, 2, 17, 27, 7, 19, 'steel'),
    ...[9, 21].flatMap(x => [
      box(x, 5, 11, x + 1, 8, 18, 'walnut'), ...disk(x, 6, 7, 8, 6, 'gray'),
      ...disk(x, 6, 9, 10, 4, 'ink'),
    ]),
  ],
  'looped-mug-rack': [
    mount(4, 16, 27, 20, 'walnut'), box(4, 2, 17, 27, 6, 19, 'oak'),
    ...[8, 16, 24].flatMap((x, i) => [
      box(x, 5, 9, x, 8, 17, 'brass'), box(x - 2, 5, 0, x + 2, 9, 9, ['teal', 'white', 'red'][i]),
      ...ring(x + 2, 7, 7, 8, 3, ['teal', 'white', 'red'][i]),
    ]),
  ],
  'wine-bottle-cradle-rack': [
    ...[5, 24].map(x => mount(x, 0, x + 2, 20, 'walnut')), board(4, 27, 0, 9, 'oak'),
    ...[6, 17].flatMap(z => [
      board(4, 27, z, 8, 'walnut'), ...[10, 20].flatMap(x => [
        ...disk(x, z + 3, 3, 8, 3, 'green'), ...disk(x, z + 3, 9, 11, 1, 'brass'),
      ]),
    ]),
  ],
  'overhead-stemware-rack': [
    mount(4, 16, 27, 21, 'walnut'), board(3, 28, 18, 11, 'oak'),
    ...[7, 15, 23].flatMap(x => [
      box(x - 2, 3, 15, x + 2, 9, 17, 'walnut'),
      box(x, 5, 8, x, 7, 15, 'glass'), box(x - 2, 4, 3, x + 2, 8, 8, 'glass'),
      box(x - 3, 3, 0, x + 3, 9, 3, 'glass'),
    ]),
  ],
  'jacket-hook-rail': [
    mount(3, 14, 28, 20, 'oak'),
    ...[7, 15, 23].flatMap(x => [
      box(x - 1, 1, 13, x + 1, 4, 18, 'steel'),
      line(x, 4, 13, x, 9, 10, 'brass'), box(x, 8, 10, x + 1, 10, 14, 'brass'),
    ]),
    box(6, 4, 0, 10, 9, 11, 'blue'), box(5, 5, 5, 12, 9, 8, 'blue'),
  ],
  'double-towel-rail': [
    ...[5, 25].flatMap(x => [1, 15].map(z => mount(x, z, x + 1, z + 5, 'steel'))),
    box(5, 1, 2, 6, 9, 4, 'steel'), box(25, 1, 2, 26, 9, 4, 'steel'),
    box(5, 1, 16, 6, 11, 18, 'steel'), box(25, 1, 16, 26, 11, 18, 'steel'),
    box(5, 8, 2, 26, 9, 4, 'steel'), box(5, 10, 16, 26, 11, 18, 'steel'),
    box(9, 10, 0, 16, 11, 18, 'teal'), face(10, 2, 15, 3, 11, 'glass'),
  ],
  'broom-handle-clamp-rack': [
    mount(3, 16, 28, 22, 'steel'), box(4, 2, 17, 27, 5, 21, 'gray'),
    ...[8, 16, 24].map(x => box(x - 2, 4, 17, x + 2, 9, 19, 'ink')),
    box(8, 7, 7, 9, 8, 25, 'pine'), box(5, 6, 0, 12, 9, 7, 'walnut'),
    box(23, 7, 3, 24, 8, 27, 'teal'), box(19, 6, 0, 27, 9, 4, 'gray'),
  ],
  'folding-bike-hanger-rack': [
    mount(10, 0, 21, 21, 'gray'), box(12, 2, 1, 19, 4, 20, 'ink'),
    ...[10, 21].flatMap(x => [
      box(x - 1, 3, 16, x + 1, 10, 18, 'steel'),
      box(x - 2, 8, 15, x + 2, 11, 20, 'red'),
    ]), box(9, 3, 14, 22, 5, 18, 'gray'), face(13, 2, 18, 4, 5, 'brass'),
  ],
  'vertical-skateboard-rack': [
    mount(7, 4, 24, 22, 'oak'),
    ...[7, 23].map(x => box(x, 1, 9, x + 1, 10, 14, 'ink')),
    box(7, 4, 11, 24, 5, 12, 'gray'),
    box(12, 6, 2, 19, 7, 25, 'pine'),
    ...[5, 22].flatMap(z => [box(10, 8, z, 21, 9, z + 1, 'steel'),
      ...[10, 20].map(x => box(x, 9, z - 1, x + 1, 11, z + 2, 'gray'))]),
    box(13, 6, 0, 18, 7, 27, 'teal'),
  ],
  'guitar-neck-hook-rack': [
    mount(8, 16, 23, 24, 'walnut'), box(12, 1, 16, 19, 4, 23, 'oak'),
    ...[11, 19].map(x => box(x, 3, 18, x + 1, 11, 20, 'ink')),
    box(11, 4, 18, 20, 6, 20, 'ink'),
    ...disk(15, 5, 6, 7, 5, 'oak'),
    box(14, 6, 6, 16, 7, 22, 'walnut'), box(13, 6, 22, 18, 8, 26, 'pine'),
    face(15, 4, 16, 13, 8, 'steel'),
  ],
  'vertical-ski-strap-rack': [
    mount(4, 11, 27, 19, 'gray'), box(5, 1, 12, 26, 5, 17, 'steel'),
    ...[9, 18].flatMap((x, i) => [
      box(x, 6, 0, x + 3, 7, 25 + i, i ? 'blue' : 'red'),
      box(x + 1, 6, 25 + i, x + 2, 7, 26 + i, 'white'),
      box(x - 1, 5, 13, x + 4, 8, 15, 'ink'),
      box(x, 7, 5, x + 3, 10, 8, 'gray'),
    ]),
  ],
  'staggered-helmet-hook-rack': [
    mount(4, 5, 27, 22, 'walnut'),
    ...[[9, 5, 'orange'], [22, 14, 'blue']].flatMap(([x, z, color]) => [
      box(x - 1, 1, z, x + 1, 7, z + 2, 'ink'),
      ...disk(x, z + 4, 4, 9, 5, color),
      box(x - 4, 6, z, x + 4, 11, z + 1, color),
      face(x - 2, z + 2, x + 2, z + 2, 10, 'ink'),
    ]), box(8, 2, 0, 10, 3, 6, 'gray'),
  ],
  'round-hose-reel-rack': [
    mount(7, 4, 24, 23, 'steel'), ...disk(15, 12, 2, 4, 11, 'gray'),
    ...ring(15, 12, 5, 8, 10, 'green'), ...ring(15, 12, 7, 9, 7, 'teal'),
    ...disk(15, 12, 9, 10, 4, 'gray'), line(23, 8, 9, 25, 8, 0, 'green'),
    box(24, 8, 0, 27, 10, 2, 'brass'),
  ],
  'cable-hooks-and-reel-rack': [
    mount(4, 2, 27, 17, 'steel'),
    ...[8, 22].flatMap(x => [
      box(x - 1, 1, 8, x + 1, 8, 10, 'ink'),
      box(x - 2, 7, 7, x + 2, 10, 11, 'gray'),
    ]),
    ...ring(15, 7, 6, 7, 7, 'orange'), line(9, 8, 9, 9, 6, 3, 'orange'),
    ...ring(15, 8, 8, 9, 6, 'orange'), line(21, 8, 8, 21, 6, 5, 'orange'),
    face(14, 0, 16, 2, 10, 'ink'),
  ],
  'wall-parts-bin-rack': [
    mount(3, 0, 28, 21, 'gray'),
    ...[1, 12].flatMap(z => [4, 12, 20].flatMap((x, i) => [
      box(x, 1, z, x + 7, 10, z + 1, 'gray'),
      box(x, 2, z + 2, x, 10, z + 8, 'teal'),
      box(x + 7, 2, z + 2, x + 7, 10, z + 8, 'teal'),
      box(x, 9, z + 2, x + 7, 10, z + 4, i === 2 ? 'orange' : 'teal'),
    ])),
  ],
  'mesh-file-pocket-rack': [
    mount(4, 14, 27, 26, 'gray'), board(4, 27, 0, 9, 'steel'),
    ...[4, 8, 12, 16, 20, 24, 27].map(x => line(x, 8, 0, x, 11, 20, 'steel')),
    box(4, 11, 19, 27, 11, 21, 'gray'), box(6, 2, 1, 24, 5, 22, 'oak'),
    box(9, 5, 5, 21, 6, 24, 'white'), box(12, 6, 6, 23, 7, 19, 'ivory'),
  ],
};

const utilityFixtures = {
  'soap-dispenser-with-push-lever': [
    mount(10, 3, 21, 23, 'ivory'), box(10, 1, 6, 21, 7, 24, 'white'),
    face(12, 13, 19, 20, 8, 'glass'), box(12, 6, 2, 19, 10, 8, 'gray'),
    box(14, 4, 0, 17, 8, 3, 'steel'),
  ],
  'foot-pedal-sanitizer-dispenser': [
    mount(10, 14, 21, 25, 'steel'), box(11, 2, 15, 20, 8, 25, 'teal'),
    box(13, 3, 24, 18, 7, 27, 'white'), face(13, 19, 18, 23, 9, 'glass'),
    box(15, 4, 1, 16, 5, 17, 'steel'), board(11, 21, 0, 11, 'gray'),
  ],
  'touchless-paper-towel-dispenser': [
    mount(5, 6, 26, 24, 'steel'), box(4, 1, 7, 27, 8, 25, 'ivory'),
    wedge(5, 5, 5, 26, 10, 14, '-Y', 'white'),
    box(9, 8, 11, 22, 10, 13, 'gray'), box(10, 6, 0, 21, 8, 7, 'white'),
    face(14, 7, 17, 8, 9, 'cyan'),
  ],
  'double-toilet-paper-dispenser': [
    mount(5, 5, 26, 17, 'steel'), box(4, 2, 3, 27, 7, 17, 'gray'),
    ...[10, 21].flatMap(x => [
      ...disk(x, 9, 6, 10, 5, 'white'), ...disk(x, 9, 11, 11, 2, 'gray'),
    ]), box(16, 2, 3, 16, 11, 17, 'steel'), face(19, 0, 24, 5, 8, 'ivory'),
  ],
  'brass-toilet-flush-valve': [
    mount(13, 9, 18, 23, 'steel'), box(14, 2, 1, 17, 5, 23, 'brass'),
    box(11, 3, 15, 20, 8, 20, 'steel'), box(13, 6, 14, 18, 11, 22, 'brass'),
    box(7, 4, 15, 12, 6, 18, 'brass'), box(11, 1, 0, 20, 7, 2, 'steel'),
  ],
  'wall-eye-wash-station': [
    mount(8, 9, 23, 20, 'steel'), box(10, 1, 8, 21, 6, 18, 'green'),
    box(7, 4, 2, 24, 11, 5, 'steel'), box(9, 5, 0, 22, 10, 2, 'green'),
    ...[11, 20].flatMap(x => [box(x, 5, 4, x + 1, 7, 10, 'steel'), box(x - 1, 5, 9, x + 2, 7, 11, 'orange')]),
    box(14, 4, 4, 17, 10, 5, 'gray'),
  ],
  'dual-plumbing-gauge-manifold': [
    mount(7, 0, 24, 9, 'gray'), box(4, 3, 3, 27, 6, 6, 'brass'),
    box(13, 1, 3, 18, 3, 6, 'steel'),
    ...[9, 22].flatMap(x => [
      box(x - 1, 4, 6, x + 1, 7, 12, 'brass'),
      ...disk(x, 16, 5, 7, 5, 'steel'), ...disk(x, 16, 8, 8, 4, 'ivory'),
      line(x, 9, 15, x + 2, 9, 18, 'ink'),
    ]), box(13, 3, 0, 18, 7, 8, 'gray'),
  ],
  'gooseneck-wall-faucet': [
    ...disk(15, 17, 0, 2, 6, 'steel'), box(14, 2, 10, 17, 10, 12, 'brass'),
    box(14, 4, 12, 17, 6, 22, 'brass'), box(14, 6, 21, 17, 10, 22, 'brass'),
    box(14, 9, 16, 17, 11, 22, 'brass'), box(13, 9, 15, 18, 11, 16, 'steel'),
    box(14, 1, 0, 17, 4, 11, 'steel'), box(12, 1, 0, 19, 6, 2, 'brass'),
  ],
  'dual-handle-shower-mixer': [
    ...[8, 23].flatMap(x => [
      ...disk(x, 6, 0, 2, 5, 'steel'),
      box(x - 1, 2, 4, x + 1, 8, 7, 'brass'), face(x - 3, 6, x + 3, 8, 8, 'steel'),
      face(x - 1, 3, x + 1, 10, 8, 'steel'),
    ]), box(8, 4, 4, 23, 5, 7, 'brass'), box(14, 4, 0, 17, 11, 5, 'steel'),
  ],
  'wall-shower-rail-and-handset': [
    mount(13, 0, 18, 27, 'gray'), box(14, 1, 0, 17, 6, 27, 'steel'),
    box(10, 4, 13, 18, 8, 15, 'gray'), box(9, 6, 12, 12, 8, 25, 'steel'),
    box(8, 7, 20, 13, 10, 27, 'ivory'), face(9, 22, 12, 25, 11, 'gray'),
    line(10, 7, 13, 11, 7, 2, 'ink'), line(11, 7, 2, 15, 6, 0, 'ink'),
  ],
  'fold-up-shower-seat': [
    ...[6, 24].map(x => mount(x, 4, x + 1, 23, 'steel')),
    board(5, 26, 2, 11, 'pine'), board(5, 26, 15, 3, 'oak'),
    ...[7, 23].flatMap(x => [
      line(x, 2, 0, x, 10, 3, 'gray'), line(x, 2, 15, x, 9, 4, 'steel'),
    ]), ...[4, 7].map(y => box(6, y, 2, 25, y, 3, null)),
  ],
  'angled-accessibility-grab-bar': [
    ...disk(6, 3, 0, 1, 3, 'steel'), ...disk(25, 22, 0, 1, 3, 'steel'),
    box(5, 2, 2, 7, 8, 4, 'gray'), box(24, 2, 21, 26, 8, 23, 'gray'),
    ...[-1, 0, 1].map(offset => line(6, 8, 3 + offset, 25, 8, 22 + offset, 'steel')),
    line(8, 9, 5, 23, 9, 20, 'ivory'),
  ],
  'flip-up-wall-ironing-board': [
    mount(8, 0, 23, 18, 'gray'), box(10, 2, 0, 21, 5, 22, 'steel'),
    box(7, 5, 2, 24, 9, 10, 'blue'), box(9, 5, 11, 22, 9, 17, 'blue'),
    box(11, 5, 17, 20, 9, 22, 'blue'), box(13, 5, 22, 18, 9, 27, 'blue'),
    ...[8, 12, 16, 20].map(x => line(x, 10, 3, 15, 10, 26, 'glass')),
  ],
  'mop-wringer': [
    mount(8, 6, 23, 19, 'gray'), box(7, 3, 0, 24, 9, 4, 'teal'),
    box(8, 1, 6, 23, 3, 17, 'gray'),
    ...[7, 23].map(x => box(x, 3, 4, x + 1, 10, 17, 'teal')),
    box(8, 9, 4, 23, 10, 11, 'teal'), box(9, 4, 12, 22, 10, 14, 'steel'),
    line(23, 9, 12, 26, 9, 26, 'steel'), box(24, 7, 24, 27, 11, 27, 'ink'),
  ],
  'fold-down-utility-hatch': [
    mount(4, 5, 27, 24, 'steel'), box(5, 1, 5, 26, 4, 24, 'gray'),
    face(7, 9, 24, 22, 5, 'ink'), wedge(5, 4, 0, 26, 11, 8, '-Y', 'steel'),
    box(4, 10, 0, 27, 11, 2, 'gray'), face(11, 14, 20, 17, 6, 'brass'),
  ],
  'wall-push-slot-mailbox': [
    mount(7, 2, 24, 21, 'steel'), box(6, 2, 0, 25, 8, 19, 'blue'),
    wedge(5, 1, 19, 26, 10, 25, '-Y', 'steel'), face(8, 15, 23, 16, 9, 'ink'),
    face(11, 6, 20, 9, 9, 'white'), face(14, 3, 17, 3, 9, 'brass'),
  ],
  'dog-waste-bag-dispenser': [
    mount(8, 6, 23, 20, 'steel'), box(7, 2, 4, 24, 8, 17, 'green'),
    wedge(6, 1, 17, 25, 9, 24, '-Y', 'green'),
    ...disk(15, 10, 9, 10, 5, 'ivory'), ...disk(15, 10, 11, 11, 3, 'ink'),
    box(12, 8, 0, 18, 10, 6, 'blue'), box(14, 10, 4, 16, 11, 9, 'blue'),
  ],
  'counterweighted-service-bell': [
    mount(10, 13, 21, 24, 'walnut'), box(12, 2, 16, 19, 10, 18, 'steel'),
    ...disk(15, 16, 6, 9, 4, 'brass'), box(10, 6, 10, 21, 10, 16, 'brass'),
    box(8, 5, 9, 23, 11, 10, 'brass'), box(14, 6, 5, 17, 8, 10, 'steel'),
    line(15, 7, 6, 15, 7, 0, 'ink'), box(14, 6, 0, 16, 8, 2, 'walnut'),
  ],
  'push-handle-wall-drinking-fountain': [
    mount(5, 8, 26, 23, 'steel'), box(7, 2, 7, 24, 5, 22, 'ivory'),
    box(5, 4, 4, 26, 11, 7, 'steel'), box(8, 5, 0, 23, 10, 4, 'gray'),
    box(7, 4, 7, 9, 8, 12, 'steel'), box(8, 7, 11, 12, 8, 12, 'brass'),
    face(13, 4, 18, 6, 11, 'teal'),
  ],
  'wall-first-aid-cabinet': [
    mount(5, 1, 26, 20, 'steel'), box(5, 2, 2, 26, 8, 21, 'white'),
    box(6, 5, 0, 25, 9, 3, 'gray'), face(7, 4, 24, 19, 9, 'ivory'),
    face(10, 10, 18, 13, 10, 'green'), face(13, 7, 15, 16, 10, 'green'),
    box(22, 8, 8, 24, 11, 11, 'steel'),
  ],
};

const groups = [communications, appliancesAndControls, shelves, storageAndRacks, utilityFixtures];
const designs = groups.flatMap(group => Object.entries(group).map(([name, ops]) => {
  const usedMaterials = new Set(ops.map(op => op.material).filter(Boolean));
  return {
    schemaVersion: 1,
    id: `wall-mounted-${name}`,
    category: 'wall-decor',
    layer: 'wall-decor',
    outlineMode: 'silhouette',
    tilePreset: '64x32',
    voxelsPerTile: 32,
    footprintTiles: [1, 1],
    palette: 'office-night',
    materials: Object.fromEntries(Object.entries(materials).filter(([material]) => usedMaterials.has(material))),
    ops,
  };
}));

await writeFamily('mounted-equipment', designs);
