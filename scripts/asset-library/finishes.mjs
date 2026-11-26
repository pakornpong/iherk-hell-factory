import { createHash } from 'node:crypto';

const upholstery = [
  ['#aaa093','#c3b8a9','#776e63'],
  ['#685b50','#897767','#493e36'],
  ['#52545a','#777982','#34363c'],
  ['#535f70','#778699','#384353'],
  ['#865d44','#a87c5c','#5b3d2e'],
  ['#774f4b','#a36a63','#523632'],
  ['#617157','#839075','#424f3b'],
  ['#b09984','#c9b29b','#7c6959'],
];

const cabinetPaint = ['#b3aa98','#575a5a','#b6b8b4','#777563','#857b71','#626e7a','#aa8d75','#767f6e'];
const enamel = ['#d0c4b2','#b6bdbe','#8d8d87','#63717d','#c2b7a4','#c4cccf','#737d6e','#a59a8d'];

function finishColors(asset, key) {
  const [mid, light, shade] = upholstery[key];
  const gray = enamel[key];
  if (asset.id.startsWith('chair-')) return { cloth: mid, edge: light };
  if (asset.id.startsWith('sofa-')) return { jade: mid, marine: mid, cream: light, shade, pink: key % 2 ? '#b7a086' : '#ab745b' };
  if (asset.id.startsWith('bed-')) return { blue: mid, trim: light, green: shade };
  if (asset.id.startsWith('storage-')) return { teal: cabinetPaint[key], dark: '#494a48' };
  if (asset.id.startsWith('washbasin-')) return { tile: gray, shadow: '#b6b9b6', dark: '#515354' };
  if (asset.id.startsWith('worktable-')) {
    if (asset.id.includes('-potting-')) return { teal: '#63825b' };
    return { teal: cabinetPaint[key] };
  }
  if (asset.id.startsWith('headset-')) return { mesh: key === 6 ? '#7b8070' : '#929498', red: key === 5 ? '#a56857' : shade };
  if (asset.id.startsWith('terminal-')) return { blue: gray, display: '#a3b9cc', ink: '#465763' };
  if (asset.id.startsWith('kitchen-')) return { teal: gray, steel: '#adb1b1', brushed: '#7a8081' };
  if (asset.id.startsWith('instrument-')) return { blue: '#788491', cream: '#dbd8cf', display: '#a4bac9' };
  if (asset.id.startsWith('garage-')) return { blue: key % 3 ? '#53667a' : '#70746b' };
  if (asset.id.startsWith('classroom-')) {
    return asset.id.includes('-blackboard-') ? { teal: '#455c4b' } : { teal: '#646c78' };
  }
  return {};
}

export function applyRealisticFinishes(asset) {
  const key = createHash('sha256').update(asset.id).digest()[0] % upholstery.length;
  const overrides = finishColors(asset, key);
  const materials = Object.fromEntries(Object.entries(asset.materials).map(([name, material]) => [
    name, overrides[name] ? { ...material, color: overrides[name] } : material,
  ]));
  return { ...asset, materials };
}
