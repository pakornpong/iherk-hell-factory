import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyRealisticFinishes } from './finishes.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const engine = process.env.IHERK_PIXCEL_ROOT ?? path.resolve(root, '../iherk-pixcel');
const loadCore = (file) => import(pathToFileURL(path.join(engine, 'dist/core', file)));
const [{ PixcelAssetSchema }, { compileAsset }, { renderAssetFrame }, { createRGBAImage, encodePNG }] =
  await Promise.all(['schema.js', 'dsl-compiler.js', 'postprocess.js', 'exporters/png.js'].map(loadCore));

const directions = ['se', 'sw', 'nw', 'ne'];
const palette = { name: 'office-night', colors: {} };
const digits = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const cell = [288, 244];
const spriteScale = 2;
const background = [46, 53, 63, 255];

function fill(image, x, y, width, height, color) {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      image.data.set(color, (row * image.width + col) * 4);
    }
  }
}

function drawSprite(sheet, sprite, index) {
  const [width, height] = cell;
  const x = index % 5 * width;
  const y = Math.floor(index / 5) * height;
  fill(sheet, x + 2, y + 2, width - 4, height - 4, background);
  const scale = spriteScale;
  if (sprite.width * scale > width - 4 || sprite.height * scale > height - 24) {
    throw new Error('Sprite exceeds contact sheet cell');
  }
  const left = x + Math.floor((width - sprite.width * scale) / 2);
  const top = y + 22 + Math.floor((height - 26 - sprite.height * scale) / 2);
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      const offset = (row * sprite.width + col) * 4;
      const alpha = sprite.data[offset + 3] / 255;
      if (!alpha) continue;
      const rgb = background.slice(0, 3).map((channel, i) =>
        Math.round(sprite.data[offset + i] * alpha + channel * (1 - alpha)));
      fill(sheet, left + col * scale, top + row * scale, scale, scale, [...rgb, 255]);
    }
  }
  for (const [position, digit] of [...String(index + 1).padStart(2, '0')].entries()) {
    for (const [bit, value] of [...digits[Number(digit)]].entries()) {
      if (value === '1') fill(sheet, x + 9 + position * 8 + bit % 3 * 2,
        y + 8 + Math.floor(bit / 3) * 2, 2, 2, [213, 232, 243, 255]);
    }
  }
}

function renderDesign(design, views = directions) {
  const asset = PixcelAssetSchema.parse(design);
  const { baseGrid } = compileAsset(asset);
  const sprites = views.map(direction => renderAssetFrame(asset, baseGrid, palette,
    { direction, emissiveMode: 'baked' }).main);
  if (sprites.some(sprite => !sprite.data.some((value, i) => i % 4 === 3 && value))) {
    throw new Error(`Blank sprite: ${asset.id}`);
  }
  return sprites[0];
}

async function writeSheet(designs, file, views) {
  const sheet = createRGBAImage(cell[0] * 5, cell[1] * Math.ceil(designs.length / 5));
  fill(sheet, 0, 0, sheet.width, sheet.height, [28, 32, 39, 255]);
  for (const [index, design] of designs.entries()) drawSprite(sheet, renderDesign(design, views), index);
  await fs.writeFile(file, encodePNG(sheet));
}

export async function refreshApprovedSheet(designs, dir) {
  await writeSheet(designs, path.join(dir, 'review-sheet.png'), directions);
}

export async function refreshFamilyPreviews(family) {
  const base = path.join(root, 'assets/pixcel/library', family);
  const records = JSON.parse(await fs.readFile(path.join(base, 'index.json'), 'utf8'));
  const pages = Map.groupBy(records, record => record.preview);
  for (const [preview, rows] of pages) {
    const designs = await Promise.all(rows.sort((a, b) => a.cell - b.cell).map(async record =>
      JSON.parse(await fs.readFile(path.join(base, record.file), 'utf8'))));
    await writeSheet(designs, path.join(base, preview), ['se']);
  }
}

export async function writeFamily(name, designs) {
  const base = path.join(root, 'assets/pixcel/library', name);
  const records = [];
  const ids = new Set();
  for (let offset = 0; offset < designs.length; offset += 20) {
    const batch = designs.slice(offset, offset + 20);
    const sheet = createRGBAImage(cell[0] * 5, cell[1] * Math.ceil(batch.length / 5));
    fill(sheet, 0, 0, sheet.width, sheet.height, [28, 32, 39, 255]);
    const page = String(Math.floor(offset / 20) + 1).padStart(3, '0');
    const dir = path.join(base, page);
    const files = [];
    for (const [index, source] of batch.entries()) {
      const design = applyRealisticFinishes(source);
      if (ids.has(design.id)) throw new Error(`Duplicate ID: ${design.id}`);
      ids.add(design.id);
      drawSprite(sheet, renderDesign(design), index);
      const file = `${design.id}.pixcel.json`;
      files.push([file, JSON.stringify(design, null, 2) + '\n']);
      records.push({ id: design.id, category: design.category, file: `${page}/${file}`, preview: `${page}/preview.png`, cell: index + 1 });
    }
    await fs.mkdir(dir, { recursive: true });
    await Promise.all(files.map(([file, data]) => fs.writeFile(path.join(dir, file), data)));
    await fs.writeFile(path.join(dir, 'preview.png'), encodePNG(sheet));
  }
  await fs.writeFile(path.join(base, 'index.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(`${name}: ${records.length} assets checked in ${directions.length} directions`);
}
