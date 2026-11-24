#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { startArchitectMcpServer } from "../mcp/architect-server.js";
import { DemoSimulator } from "../server/demo-simulator.js";
import { createHellFactoryServer } from "../server/index.js";
import { OfficeEngine } from "../server/office-engine.js";
import { PixcelBridge } from "../server/pixcel-bridge.js";
import { OfficeStore } from "../server/store.js";
import { installHooks, installMcp } from "./install-hooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.HELL_FACTORY_ROOT ?? path.resolve(__dirname, "..", "..");
const PIXCEL_ROOT =
  process.env.IHERK_PIXCEL_ROOT ?? path.resolve(PROJECT_ROOT, "..", "iherk-pixcel");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const RUNTIME_ASSETS_DIR = path.join(PROJECT_ROOT, "runtime-assets");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

function printHelp(): void {
  console.log(`iherk-hell-factory — 2:1 Isometric AI Agent Office Live Monitor

Usage:
  hell-factory start [--port 7140] [--demo] [--no-watch-antigravity]
  hell-factory demo [--port 7140]
  hell-factory mcp [--port 7140]
  hell-factory build-assets
  hell-factory install-hooks [--dry-run] [--with-mcp]
  hell-factory install-mcp [--dry-run]
`);
}

async function ensureAtlasesExist(bridge: PixcelBridge): Promise<void> {
  try {
    await fs.access(path.join(RUNTIME_ASSETS_DIR, "atlas-night.json"));
    await fs.access(path.join(RUNTIME_ASSETS_DIR, "atlas-day.json"));
  } catch {
    console.log("Building runtime isometric atlases via iherk-pixcel...");
    await bridge.buildCoreAtlases();
  }
}

async function runStart(rest: string[], forceDemo: boolean): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      port: { type: "string", default: process.env.HELL_FACTORY_PORT ?? "7140" },
      demo: { type: "boolean", default: forceDemo },
      "no-watch-antigravity": { type: "boolean", default: false },
    },
  });

  const port = Number(values.port ?? "7140");
  const bridge = new PixcelBridge({
    pixcelRoot: PIXCEL_ROOT,
    projectRoot: PROJECT_ROOT,
    runtimeOutDir: RUNTIME_ASSETS_DIR,
  });
  await ensureAtlasesExist(bridge);

  const catalog = await bridge.listCatalog();
  const store = new OfficeStore(DATA_DIR);
  const engine = new OfficeEngine({
    store,
    catalogById: new Map(catalog.map((c) => [c.id, c])),
  });
  await engine.init();

  const demo = new DemoSimulator(engine);
  const server = await createHellFactoryServer({
    host: "127.0.0.1",
    port,
    engine,
    store,
    pixcelBridge: bridge,
    publicDir: PUBLIC_DIR,
    runtimeAssetsDir: RUNTIME_ASSETS_DIR,
    watchAntigravity: !values["no-watch-antigravity"] && process.env.HELL_FACTORY_WATCH_AGY !== "0",
    demoController: demo,
  });

  if (values.demo || forceDemo) {
    await demo.start();
  }

  console.log(`iherk-hell-factory running at ${server.url}${values.demo || forceDemo ? " (Demo Mode)" : ""}`);

  const shutdown = async () => {
    await demo.stop();
    await server.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  switch (cmd) {
    case "start":
      await runStart(rest, false);
      break;

    case "demo":
      await runStart(rest, true);
      break;

    case "build-assets": {
      const bridge = new PixcelBridge({
        pixcelRoot: PIXCEL_ROOT,
        projectRoot: PROJECT_ROOT,
        runtimeOutDir: RUNTIME_ASSETS_DIR,
      });
      const res = await bridge.buildCoreAtlases();
      console.log(
        JSON.stringify(
          {
            ok: true,
            nightAtlas: res.nightAtlasPath,
            dayAtlas: res.dayAtlasPath,
            catalogCount: res.catalog.length,
          },
          null,
          2,
        ),
      );
      break;
    }

    case "mcp": {
      const { values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          port: { type: "string", default: process.env.HELL_FACTORY_PORT ?? "7140" },
        },
      });
      const port = Number(values.port ?? "7140");
      await startArchitectMcpServer({
        serverUrl: `http://127.0.0.1:${port}`,
        dataDir: DATA_DIR,
        pixcelRoot: PIXCEL_ROOT,
        projectRoot: PROJECT_ROOT,
        runtimeOutDir: RUNTIME_ASSETS_DIR,
      });
      break;
    }

    case "install-hooks": {
      const { values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          "dry-run": { type: "boolean", default: false },
          "with-mcp": { type: "boolean", default: false },
        },
      });
      const hookReport = await installHooks({
        homeDir: os.homedir(),
        projectRoot: PROJECT_ROOT,
        dryRun: Boolean(values["dry-run"]),
      });
      const mcpReport = values["with-mcp"]
        ? await installMcp({
            homeDir: os.homedir(),
            projectRoot: PROJECT_ROOT,
            dryRun: Boolean(values["dry-run"]),
          })
        : null;
      console.log(JSON.stringify({ dryRun: Boolean(values["dry-run"]), hooks: hookReport, mcp: mcpReport }, null, 2));
      break;
    }

    case "install-mcp": {
      const { values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          "dry-run": { type: "boolean", default: false },
        },
      });
      const mcpReport = await installMcp({
        homeDir: os.homedir(),
        projectRoot: PROJECT_ROOT,
        dryRun: Boolean(values["dry-run"]),
      });
      console.log(JSON.stringify({ dryRun: Boolean(values["dry-run"]), mcp: mcpReport }, null, 2));
      break;
    }

    default:
      throw new Error(`Unknown command "${cmd}". Run with --help for usage.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
