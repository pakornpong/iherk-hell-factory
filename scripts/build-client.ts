import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();

await build({
  entryPoints: [path.join(root, "src/client/main.ts")],
  outfile: path.join(root, "public/app.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
});

console.log("Built public/app.js");
