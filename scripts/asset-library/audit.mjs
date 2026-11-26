import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const pixcel = process.env.IHERK_PIXCEL_ROOT ?? path.resolve(root, '../iherk-pixcel');
const core = file => import(pathToFileURL(path.join(pixcel, 'dist/core', file)));
const [{ PixcelAssetSchema }, { compileAsset }] =
  await Promise.all([core('schema.js'), core('dsl-compiler.js')]);
const verifyRenders = process.argv.includes('--render-all');
const directions = ['se', 'sw', 'nw', 'ne'];
const palette = { name: 'office-night', colors: {} };
const renderAssetFrame = verifyRenders ? (await core('postprocess.js')).renderAssetFrame : undefined;
let rendered = 0;
const directories = ['review-batch-01', 'library'];
const ids = new Map();
const shapes = new Map();
const issues = [];
const counts = new Map();
const familyFiles = new Set();

function geometryKey(cells) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Preserve absolute height and ignore translation in the tile plane.
  // Each occupied cell is represented by one integer with ten bits per axis.
  const rotated = new Uint32Array(cells.length);
  const bytes = Buffer.from(rotated.buffer);
  let best;
  for (let turn = 0; turn < 4; turn++) {
    for (const [i, [x, y, z]] of cells.entries()) {
      let tx, ty;
      switch (turn) {
        case 0: tx = x - minX; ty = y - minY; break;
        case 1: tx = maxY - y; ty = x - minX; break;
        case 2: tx = maxX - x; ty = maxY - y; break;
        case 3: tx = y - minY; ty = maxX - x; break;
      }
      rotated[i] = (z * 1024 + ty) * 1024 + tx;
    }
    rotated.sort();
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (best === undefined || hash < best) best = hash;
  }
  return best;
}

for (const dir of directories) {
  const base = path.join(root, 'assets/pixcel', dir);
  const files = (await fs.readdir(base, { recursive: true }))
    .filter(file => file.endsWith('.pixcel.json')).sort();
  for (const file of files) {
    const asset = PixcelAssetSchema.parse(JSON.parse(await fs.readFile(path.join(base, file), 'utf8')));
    const { baseGrid } = compileAsset(asset);
    const cells = [...baseGrid.entries()];
    if (renderAssetFrame) {
      for (const direction of directions) {
        const { main } = renderAssetFrame(asset, baseGrid, palette, { direction, emissiveMode: 'baked' });
        if (main.data.some((value, index) => index % 4 === 3 && value)) rendered++;
        else issues.push(`Blank ${direction} render: ${asset.id}`);
      }
    }
    if (!cells.length || cells.some(([x, y]) => x < 0 || y < 0 ||
        x >= 32 * asset.footprintTiles[0] || y >= 32 * asset.footprintTiles[1])) {
      issues.push(`Empty or exceeds footprint: ${asset.id}`);
    }
    if (ids.has(asset.id)) issues.push(`Duplicate ID: ${asset.id}`);
    ids.set(asset.id, file);
    if (dir === 'library') {
      const family = file.split(path.sep)[0];
      counts.set(family, (counts.get(family) ?? 0) + 1);
      familyFiles.add(file);
    } else {
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
    const key = geometryKey(cells);
    if (shapes.has(key)) issues.push(`Identical geometry: ${asset.id}, ${shapes.get(key)}`);
    shapes.set(key, asset.id);
  }
  console.log(`${dir}: ${files.length}`);
}

const library = path.join(root, 'assets/pixcel/library');
const families = [];
for (const [family, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (family === 'review-batch-01') continue;
  const index = `${family}/index.json`;
  const records = JSON.parse(await fs.readFile(path.join(library, index), 'utf8'));
  const previews = new Set();
  for (const record of records) {
    if (!familyFiles.delete(path.join(family, record.file)) ||
        ids.get(record.id) !== path.join(family, record.file)) {
      issues.push(`Catalog entry does not match source: ${record.id}`);
    }
    previews.add(`${family}/${record.preview}`);
  }
  await Promise.all([...previews].map(preview => fs.access(path.join(library, preview))));
  if (count !== records.length) issues.push(`Incorrect catalog count: ${family}`);
  families.push({ family, count, index, preview: [...previews][0] });
}
if (familyFiles.size) issues.push(`Unindexed sources: ${familyFiles.size}`);

if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  const manifest = {
    target: 10000,
    validated: ids.size,
    approvedBatch: { count: counts.get('review-batch-01'), preview: '../review-batch-01/review-sheet.png' },
    families,
  };
  await fs.writeFile(path.join(library, 'catalog.json'), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(`${ids.size} IDs, ${shapes.size} unique voxel geometries, ${issues.length} issues`);
if (verifyRenders) console.log(`${rendered} non-blank directional renders`);
