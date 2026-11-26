#!/usr/bin/env node
// Shrinks library footprints to the tiles the voxels actually use.
// Generators authored some narrow variants as 2 tiles wide while the model fills only one,
// which made a one-tile object block two tiles. Only trailing empty tiles are trimmed.
// Usage: node scripts/asset-library/fit-footprints.mjs [--check]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryDir = path.join(root, 'assets/pixcel/library');
const core = path.resolve(root, '../iherk-pixcel/dist/core');
const { compileAsset } = await import(path.join(core, 'dsl-compiler.js'));
const { PixcelAssetSchema } = await import(path.join(core, 'schema.js'));

export function fittedFootprint(asset) {
  const bounds = compileAsset(asset).baseGrid.getBounds();
  if (!bounds) return asset.footprintTiles;
  const v = asset.voxelsPerTile;
  return [
    Math.min(asset.footprintTiles[0], Math.max(1, Math.ceil((bounds.maxX + 1) / v))),
    Math.min(asset.footprintTiles[1], Math.max(1, Math.ceil((bounds.maxY + 1) / v))),
  ];
}

const check = process.argv.includes('--check');
const changed = [];
for (const category of (await fs.readdir(libraryDir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
  const indexPath = path.join(libraryDir, category.name, 'index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8').catch(() => '[]'));
  for (const row of index) {
    const file = path.join(libraryDir, category.name, row.file);
    const source = await fs.readFile(file, 'utf8');
    const raw = JSON.parse(source);
    const fitted = fittedFootprint(PixcelAssetSchema.parse(raw));
    const current = raw.footprintTiles ?? [1, 1];
    if (fitted[0] === current[0] && fitted[1] === current[1]) continue;
    changed.push(`${raw.id}: ${current.join('x')} -> ${fitted.join('x')}`);
    if (!check) {
      raw.footprintTiles = fitted;
      await fs.writeFile(file, JSON.stringify(raw, null, 2) + '\n');
    }
  }
}
console.log(`${check ? 'oversized' : 'fitted'}: ${changed.length}`);
if (changed.length) console.log(changed.slice(0, 20).join('\n') + (changed.length > 20 ? `\n...` : ''));
if (check && changed.length) process.exit(1);
