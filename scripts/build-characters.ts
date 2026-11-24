/**
 * Generate Phase 2 character assets (`animations` clips) with iherk-pixcel's buildCharacterAsset().
 * Reproducible: `npm run build:characters` rewrites assets/pixcel/characters/*.pixcel.json from PHASE2_CHARACTER_SPECS.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PHASE2_CHARACTER_SPECS } from "../src/server/pixcel-bridge.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const pixcelRoot = process.env.PIXCEL_ROOT ?? "/Users/dev3/Documents/IHERK/iherk-pixcel";
const outDir = path.join(projectRoot, "assets", "pixcel", "characters");

const builder = await import(pathToFileURL(path.join(pixcelRoot, "dist", "core", "character-builder.js")).href);
await fs.mkdir(outDir, { recursive: true });
for (const spec of PHASE2_CHARACTER_SPECS) {
  const asset = builder.buildCharacterAsset(spec);
  await fs.writeFile(path.join(outDir, `${spec.id}.pixcel.json`), `${JSON.stringify(asset, null, 2)}\n`, "utf8");
  console.log(`wrote ${spec.id}.pixcel.json (${Object.keys(asset.animations ?? {}).length} clips)`);
}
