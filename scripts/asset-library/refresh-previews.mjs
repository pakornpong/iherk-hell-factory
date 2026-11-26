import fs from 'node:fs/promises';
import path from 'node:path';
import { refreshFamilyPreviews } from './render.mjs';

const library = path.resolve(import.meta.dirname, '../../assets/pixcel/library');
const entries = await fs.readdir(library, { withFileTypes: true });
for (const entry of entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  await refreshFamilyPreviews(entry.name);
  console.log(`Refreshed ${entry.name} at a consistent 2× preview scale`);
}
