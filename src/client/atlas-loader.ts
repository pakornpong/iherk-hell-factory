import type { AssetLayer, Direction, ThemeMode } from "../shared/types.js";

export interface RawAtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  isometric: {
    assetId: string;
    direction: Direction;
    frameName: string;
    durationMs: number;
    layer: AssetLayer;
    footprintTiles: [number, number];
    anchor: { x: number; y: number };
  };
}

export interface RawAtlasJson {
  frames: Record<string, RawAtlasFrame>;
  meta: {
    image: string;
    emissiveImage?: string;
    stepX: number;
    stepY: number;
  };
}

interface LoadedAtlasPack {
  meta: RawAtlasJson;
  image: HTMLImageElement;
  emissiveImage?: HTMLImageElement;
}

export interface ResolvedSpriteFrame {
  image: HTMLImageElement;
  emissiveImage?: HTMLImageElement;
  frame: RawAtlasFrame["frame"];
  anchor: { x: number; y: number };
  footprintTiles: [number, number];
  durationMs: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image ${url}: ${String(err)}`));
    img.src = url;
  });
}

async function fetchAtlasPack(jsonUrl: string, cacheBust?: number): Promise<LoadedAtlasPack> {
  const qs = cacheBust ? `?t=${cacheBust}` : "";
  const res = await fetch(`${jsonUrl}${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch atlas ${jsonUrl} (${res.status})`);
  const meta = (await res.json()) as RawAtlasJson;
  const baseDir = jsonUrl.slice(0, jsonUrl.lastIndexOf("/") + 1);
  const image = await loadImage(`${baseDir}${meta.meta.image}${qs}`);
  let emissiveImage: HTMLImageElement | undefined;
  if (meta.meta.emissiveImage) {
    try {
      emissiveImage = await loadImage(`${baseDir}${meta.meta.emissiveImage}${qs}`);
    } catch {
      emissiveImage = undefined;
    }
  }
  return { meta, image, emissiveImage };
}

export class AtlasManager {
  private officePack: LoadedAtlasPack | null = null;
  private nightPack: LoadedAtlasPack | null = null;
  private dayPack: LoadedAtlasPack | null = null;
  private customPack: LoadedAtlasPack | null = null;

  async loadAll(): Promise<void> {
    const [office, night, day, custom] = await Promise.all([
      fetchAtlasPack("/runtime-assets/atlas-office.json").catch(() => null),
      fetchAtlasPack("/runtime-assets/atlas-night.json"),
      fetchAtlasPack("/runtime-assets/atlas-day.json"),
      fetchAtlasPack("/runtime-assets/custom-atlas.json").catch(() => null),
    ]);
    this.officePack = office;
    this.nightPack = night;
    this.dayPack = day;
    this.customPack = custom;
  }

  async reloadCustom(): Promise<void> {
    try {
      this.customPack = await fetchAtlasPack("/runtime-assets/custom-atlas.json", Date.now());
    } catch {
      // keep previous pack if reload fails
    }
  }

  private lookupInPack(pack: LoadedAtlasPack | null, key: string): ResolvedSpriteFrame | null {
    if (!pack) return null;
    const entry = pack.meta.frames[key];
    if (!entry) return null;
    return {
      image: pack.image,
      emissiveImage: pack.emissiveImage,
      frame: entry.frame,
      anchor: entry.isometric.anchor,
      footprintTiles: entry.isometric.footprintTiles,
      durationMs: entry.isometric.durationMs,
    };
  }

  private findAnyFrameInPack(pack: LoadedAtlasPack | null, prefix: string): ResolvedSpriteFrame | null {
    if (!pack) return null;
    for (const key of Object.keys(pack.meta.frames)) {
      if (key.startsWith(prefix)) {
        return this.lookupInPack(pack, key);
      }
    }
    return null;
  }

  getFrame(theme: ThemeMode, assetId: string, direction: Direction, frameName = "default"): ResolvedSpriteFrame | null {
    const pack =
      theme === "office"
        ? (this.officePack ?? this.dayPack ?? this.nightPack)
        : theme === "day"
          ? this.dayPack
          : this.nightPack;
    const keys = [
      `${assetId}/${direction}/${frameName}`,
      `${assetId}/${direction}/default`,
      `${assetId}/${direction}/idle_0`,
      `${assetId}/se/${frameName}`,
      `${assetId}/se/default`,
      `${assetId}/se/idle_0`,
    ];
    for (const k of keys) {
      const hit = this.lookupInPack(pack, k) ?? this.lookupInPack(this.customPack, k);
      if (hit) return hit;
    }
    // Fallback for assets whose animated frames have custom names (e.g. blink_0, alert_0, spin_0)
    return (
      this.findAnyFrameInPack(pack, `${assetId}/${direction}/`) ??
      this.findAnyFrameInPack(this.customPack, `${assetId}/${direction}/`) ??
      this.findAnyFrameInPack(pack, `${assetId}/`) ??
      this.findAnyFrameInPack(this.customPack, `${assetId}/`)
    );
  }
}
