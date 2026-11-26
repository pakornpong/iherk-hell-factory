import fs from 'node:fs/promises';
import path from 'node:path';
import { refreshApprovedSheet } from './render.mjs';

const dir = path.resolve(import.meta.dirname, '../../assets/pixcel/review-batch-01');
const ids = [
  'headphones-monitor-fold', 'headphones-mesh-arc', 'computer-sff-service-console', 'computer-rugged-field-terminal',
  'lab-balance-draft-shield', 'lab-bench-centrifuge', 'media-cinema-rig-tripod', 'media-location-sound-cart',
  'school-teacher-lectern', 'retail-checkout-scanner-lane', 'driver-fleet-dispatch-locker', 'garage-hydraulic-floor-jack',
  'kitchen-combi-oven-stand', 'kitchen-island-butcher-block', 'bathroom-vanity-pedestal', 'living-modular-chaise-sofa',
  'living-bentwood-rocker', 'utility-fluted-sliding-cabinet', 'bedroom-platform-storage-bed', 'rec-air-hockey-table',
];
const finishes = {
  'headphones-mesh-arc': { pink: '#928d85' },
  'computer-rugged-field-terminal': { green: '#696b62' },
  'bathroom-vanity-pedestal': { teal: '#657a8c' },
  'living-modular-chaise-sofa': { teal: '#aa9b89', fabric: '#75695e' },
  'utility-fluted-sliding-cabinet': { teal: '#8c7b6c', blue: '#6a5d50' },
  'bedroom-platform-storage-bed': { teal: '#80909d' },
};
const designs = await Promise.all(ids.map(async id => {
  const file = path.join(dir, id + '.pixcel.json');
  const design = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const [material, color] of Object.entries(finishes[id] ?? {})) {
    design.materials[material].color = color;
  }
  return design;
}));
await refreshApprovedSheet(designs, dir);
await Promise.all(designs.filter(design => finishes[design.id]).map(design =>
  fs.writeFile(path.join(dir, design.id + '.pixcel.json'), JSON.stringify(design, null, 2) + '\n')));
console.log(`Refreshed approved preview and ${Object.keys(finishes).length} material palettes`);
