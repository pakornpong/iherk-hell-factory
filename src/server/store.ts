import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { OfficeStateSchema, type OfficeState } from "../shared/types.js";

export class OfficeStore {
  private readonly statePath: string;
  private readonly backupPath: string;
  private readonly tmpPath: string;
  private readonly tokenPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.statePath = path.join(dataDir, "office-state.json");
    this.backupPath = path.join(dataDir, "office-state.json.bak");
    this.tmpPath = path.join(dataDir, "office-state.json.tmp");
    this.tokenPath = path.join(dataDir, "architect.token");
  }

  getStatePath(): string {
    return this.statePath;
  }

  getArchitectTokenPath(): string {
    return this.tokenPath;
  }

  async ensureArchitectToken(): Promise<string> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const existing = (await fs.readFile(this.tokenPath, "utf8")).trim();
      if (existing.length >= 32) {
        await fs.chmod(this.tokenPath, 0o600);
        return existing;
      }
    } catch {
      // Token does not exist yet
    }
    const token = crypto.randomBytes(32).toString("hex");
    await fs.writeFile(this.tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(this.tokenPath, 0o600);
    return token;
  }

  private async readValidated(filePath: string): Promise<OfficeState | null> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return OfficeStateSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  async load(): Promise<OfficeState | null> {
    const primary = await this.readValidated(this.statePath);
    if (primary) return primary;
    const backup = await this.readValidated(this.backupPath);
    if (backup) return backup;
    return null;
  }

  async save(state: OfficeState): Promise<void> {
    const validated = OfficeStateSchema.parse(state);
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;

    const runWrite = async (): Promise<void> => {
      await fs.mkdir(this.dataDir, { recursive: true });
      // Back up previous valid primary before replacing
      const existingPrimary = await this.readValidated(this.statePath);
      if (existingPrimary) {
        await fs.copyFile(this.statePath, this.backupPath);
      }
      await fs.writeFile(this.tmpPath, serialized, "utf8");
      await fs.rename(this.tmpPath, this.statePath);
    };

    this.writeChain = this.writeChain.then(runWrite, runWrite);
    await this.writeChain;
  }
}
