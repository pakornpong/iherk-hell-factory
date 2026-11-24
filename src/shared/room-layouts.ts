/**
 * Furniture layouts for every room type (6x6 local tiles), designed as real office interiors.
 * Generated from the interior-design pass (validated: in-bounds, no overlaps, all 8 doorway tiles free,
 * every chair / doorway / stand spot reachable). Bays have 3 variants per department and lounges 2, and
 * any layout may be mirrored across the lx/ly diagonal, so neighbouring rooms rarely look alike.
 */
import type { DepartmentId, Direction, FurnitureInstance, ZoneId } from "./types.js";

export interface RoomLayoutItem {
  /** Id suffix; the full furniture id is `<zoneId>-<key>`. */
  key: string;
  lx: number;
  ly: number;
  assetId: string;
  direction: Direction;
  /** Bay only: extra workstation that appears when the team grows to 3-4 people. */
  extra?: boolean;
}

export interface RoomLayout {
  items: RoomLayoutItem[];
  /** Open tiles where people stand (boss visitors, stand-up meetings, bay briefings). */
  standSpots?: Array<[number, number]>;
}

export const ROOM_LAYOUTS: Record<string, RoomLayout> = {
  "boss": {
    items: [
      { key: "shelf-l", lx: 0, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "cabinet", lx: 1, ly: 0, assetId: "cabinet-wood-tall", direction: "se" },
      { key: "shelf-r", lx: 4, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "plant-r", lx: 5, ly: 0, assetId: "plant-potted", direction: "se" },
      { key: "file", lx: 0, ly: 1, assetId: "filing-cabinet", direction: "ne" },
      { key: "boss-chair", lx: 2, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "bin", lx: 3, ly: 1, assetId: "trash-bin-office", direction: "se" },
      { key: "ext", lx: 5, ly: 1, assetId: "fire-extinguisher", direction: "sw" },
      { key: "boss-desk", lx: 2, ly: 2, assetId: "desk-dev-dual", direction: "nw" },
      { key: "visitor-0", lx: 2, ly: 3, assetId: "chair-office-swivel", direction: "nw" },
      { key: "visitor-1", lx: 3, ly: 3, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sofa", lx: 0, ly: 4, assetId: "sofa-lounge", direction: "ne" },
      { key: "plant-l", lx: 1, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "sign", lx: 5, ly: 4, assetId: "bay-sign-post", direction: "sw" },
      { key: "plant-f", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
    standSpots: [[1, 3], [4, 3], [2, 4], [3, 4]],
  },
  "common-v0": {
    items: [
      { key: "coffee", lx: 0, ly: 0, assetId: "coffee-machine-bar", direction: "se" },
      { key: "fridge", lx: 0, ly: 1, assetId: "home-kitchen-fridge", direction: "ne" },
      { key: "screen", lx: 4, ly: 0, assetId: "projector-screen", direction: "se" },
      { key: "vending", lx: 5, ly: 0, assetId: "office-vending-machine", direction: "se" },
      { key: "ext", lx: 5, ly: 1, assetId: "fire-extinguisher", direction: "sw" },
      { key: "conf", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "c1", lx: 2, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "c2", lx: 3, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "c3", lx: 1, ly: 2, assetId: "chair-office-swivel", direction: "ne" },
      { key: "c4", lx: 1, ly: 3, assetId: "chair-office-swivel", direction: "ne" },
      { key: "sofa", lx: 0, ly: 4, assetId: "sofa-lounge", direction: "ne" },
      { key: "plant-l", lx: 1, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "bin", lx: 5, ly: 4, assetId: "trash-bin-office", direction: "sw" },
      { key: "plant-f", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
    standSpots: [[4, 2], [4, 3], [2, 4], [3, 4], [4, 4]],
  },
  "common-v1": {
    items: [
      { key: "sofa", lx: 0, ly: 0, assetId: "sofa-lounge", direction: "se" },
      { key: "plant-b", lx: 0, ly: 1, assetId: "plant-potted", direction: "ne" },
      { key: "coffee", lx: 4, ly: 0, assetId: "coffee-machine-bar", direction: "se" },
      { key: "cooler", lx: 5, ly: 1, assetId: "water-cooler", direction: "sw" },
      { key: "conf", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "c1", lx: 4, ly: 2, assetId: "chair-office-swivel", direction: "sw" },
      { key: "c2", lx: 4, ly: 3, assetId: "chair-office-swivel", direction: "sw" },
      { key: "c3", lx: 2, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "c4", lx: 3, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "vending", lx: 0, ly: 4, assetId: "office-vending-machine", direction: "ne" },
      { key: "fridge", lx: 0, ly: 5, assetId: "home-kitchen-fridge", direction: "ne" },
      { key: "bin", lx: 1, ly: 5, assetId: "trash-bin-office", direction: "se" },
      { key: "board", lx: 4, ly: 4, assetId: "projector-tripod", direction: "nw" },
      { key: "plant-f", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
    standSpots: [[2, 1], [3, 1], [1, 2], [1, 3], [1, 1]],
  },
  "cowork": {
    items: [
      { key: "desk-a", lx: 1, ly: 2, assetId: "desk-dev-dual", direction: "nw" },
      { key: "desk-b", lx: 3, ly: 2, assetId: "desk-dev-dual", direction: "nw" },
      { key: "desk-c", lx: 1, ly: 3, assetId: "desk-dev-dual", direction: "se" },
      { key: "desk-d", lx: 3, ly: 3, assetId: "desk-dev-dual", direction: "se" },
      { key: "seat-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "seat-1", lx: 2, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "seat-2", lx: 3, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "seat-3", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "se" },
      { key: "seat-4", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "seat-5", lx: 2, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "seat-6", lx: 3, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "seat-7", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "nw" },
      { key: "locker-a", lx: 0, ly: 0, assetId: "office-locker-bank", direction: "se" },
      { key: "locker-b", lx: 1, ly: 0, assetId: "office-locker-bank", direction: "se" },
      { key: "printer", lx: 4, ly: 0, assetId: "printer-copier", direction: "se" },
      { key: "cooler", lx: 5, ly: 0, assetId: "water-cooler", direction: "se" },
      { key: "plant-l", lx: 0, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "plant-r", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
  },
  "bay-iherk-v0": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 4, ly: 0, assetId: "desk-drafting", direction: "se" },
      { key: "chair-1", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 1, assetId: "bookshelf-wood", direction: "ne" },
      { key: "printer3d", lx: 5, ly: 1, assetId: "pc-3d-printer", direction: "sw" },
      { key: "shelf-2", lx: 0, ly: 4, assetId: "bookshelf-wood", direction: "ne" },
      { key: "storage", lx: 0, ly: 5, assetId: "shelf-metal-storage", direction: "ne" },
      { key: "plant", lx: 1, ly: 4, assetId: "plant-potted", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-iherk-v1": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-drafting", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-dev-dual", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 1, assetId: "bookshelf-wood", direction: "ne" },
      { key: "shelf-2", lx: 4, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "storage", lx: 5, ly: 0, assetId: "shelf-metal-storage", direction: "se" },
      { key: "printer3d", lx: 4, ly: 1, assetId: "pc-3d-printer", direction: "se" },
      { key: "plant", lx: 5, ly: 1, assetId: "plant-potted", direction: "sw" },
      { key: "desk-2", lx: 4, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-3", lx: 5, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-iherk-v2": {
    items: [
      { key: "desk-0", lx: 4, ly: 0, assetId: "desk-drafting", direction: "se" },
      { key: "chair-0", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-dev-dual", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "shelf-2", lx: 1, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "cabinet", lx: 0, ly: 1, assetId: "cabinet-wood-tall", direction: "ne" },
      { key: "printer3d", lx: 1, ly: 1, assetId: "pc-3d-printer", direction: "se" },
      { key: "plant", lx: 5, ly: 1, assetId: "plant-potted", direction: "sw" },
      { key: "table", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-dev-v0": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "pc-desk-triple", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-1", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "blade", lx: 0, ly: 1, assetId: "server-blade-tower", direction: "ne" },
      { key: "pc", lx: 5, ly: 1, assetId: "pc-tower-box", direction: "sw" },
      { key: "board", lx: 0, ly: 4, assetId: "office-whiteboard-mobile", direction: "ne" },
      { key: "rack", lx: 0, ly: 5, assetId: "server-rack", direction: "ne" },
      { key: "bin", lx: 1, ly: 4, assetId: "trash-bin-office", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-dev-v1": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "pc-desk-triple", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "board", lx: 0, ly: 1, assetId: "office-whiteboard-mobile", direction: "ne" },
      { key: "blade", lx: 4, ly: 0, assetId: "server-blade-tower", direction: "se" },
      { key: "rack", lx: 5, ly: 0, assetId: "server-rack", direction: "se" },
      { key: "pc", lx: 4, ly: 1, assetId: "pc-tower-box", direction: "se" },
      { key: "plant", lx: 5, ly: 1, assetId: "plant-potted", direction: "sw" },
      { key: "desk-2", lx: 4, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-3", lx: 5, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-dev-v2": {
    items: [
      { key: "desk-0", lx: 4, ly: 0, assetId: "pc-desk-triple", direction: "se" },
      { key: "chair-0", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-dev-dual", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "rack", lx: 0, ly: 0, assetId: "server-rack", direction: "se" },
      { key: "blade", lx: 1, ly: 0, assetId: "server-blade-tower", direction: "se" },
      { key: "board", lx: 0, ly: 1, assetId: "office-whiteboard-mobile", direction: "ne" },
      { key: "pc", lx: 1, ly: 1, assetId: "pc-tower-box", direction: "se" },
      { key: "bin", lx: 5, ly: 1, assetId: "trash-bin-office", direction: "sw" },
      { key: "table", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-retro-crt", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-erp-v0": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-security-ops", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-1", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "nas", lx: 0, ly: 1, assetId: "server-nas-vault", direction: "ne" },
      { key: "printer", lx: 5, ly: 1, assetId: "printer-copier", direction: "sw" },
      { key: "file", lx: 0, ly: 4, assetId: "filing-cabinet", direction: "ne" },
      { key: "file-2", lx: 0, ly: 5, assetId: "filing-cabinet", direction: "ne" },
      { key: "plant", lx: 1, ly: 4, assetId: "plant-potted", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-retro-crt", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-erp-v1": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-security-ops", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "file", lx: 0, ly: 1, assetId: "filing-cabinet", direction: "ne" },
      { key: "nas", lx: 4, ly: 0, assetId: "server-nas-vault", direction: "se" },
      { key: "ups", lx: 5, ly: 0, assetId: "server-ups-battery", direction: "se" },
      { key: "printer", lx: 4, ly: 1, assetId: "printer-copier", direction: "se" },
      { key: "ext", lx: 5, ly: 1, assetId: "fire-extinguisher", direction: "sw" },
      { key: "desk-2", lx: 4, ly: 5, assetId: "pc-retro-crt", direction: "nw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-3", lx: 5, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-erp-v2": {
    items: [
      { key: "desk-0", lx: 4, ly: 0, assetId: "desk-security-ops", direction: "se" },
      { key: "chair-0", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-dev-dual", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "nas", lx: 0, ly: 0, assetId: "server-nas-vault", direction: "se" },
      { key: "file", lx: 1, ly: 0, assetId: "filing-cabinet", direction: "se" },
      { key: "file-2", lx: 0, ly: 1, assetId: "filing-cabinet", direction: "ne" },
      { key: "printer", lx: 1, ly: 1, assetId: "printer-copier", direction: "se" },
      { key: "ext", lx: 5, ly: 1, assetId: "fire-extinguisher", direction: "sw" },
      { key: "table", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-retro-crt", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-retro-crt", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-accounting-v0": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-1", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "file", lx: 0, ly: 1, assetId: "filing-cabinet", direction: "ne" },
      { key: "printer", lx: 5, ly: 1, assetId: "printer-copier", direction: "sw" },
      { key: "locker", lx: 0, ly: 4, assetId: "office-locker-bank", direction: "ne" },
      { key: "file-2", lx: 0, ly: 5, assetId: "filing-cabinet", direction: "ne" },
      { key: "shredder", lx: 1, ly: 4, assetId: "shredder-mini", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-accounting-v1": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "office-standing-desk", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "locker", lx: 0, ly: 1, assetId: "office-locker-bank", direction: "ne" },
      { key: "file", lx: 4, ly: 0, assetId: "filing-cabinet", direction: "se" },
      { key: "file-2", lx: 5, ly: 0, assetId: "filing-cabinet", direction: "se" },
      { key: "printer", lx: 4, ly: 1, assetId: "printer-copier", direction: "se" },
      { key: "shredder", lx: 5, ly: 1, assetId: "shredder-mini", direction: "sw" },
      { key: "desk-2", lx: 4, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-3", lx: 5, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-accounting-v2": {
    items: [
      { key: "desk-0", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "desk-dev-dual", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "cabinet", lx: 0, ly: 0, assetId: "cabinet-wood-tall", direction: "se" },
      { key: "file", lx: 1, ly: 0, assetId: "filing-cabinet", direction: "se" },
      { key: "locker", lx: 0, ly: 1, assetId: "office-locker-bank", direction: "ne" },
      { key: "shredder", lx: 1, ly: 1, assetId: "shredder-mini", direction: "se" },
      { key: "printer", lx: 5, ly: 1, assetId: "printer-copier", direction: "sw" },
      { key: "table", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-general-v0": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-1", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 1, assetId: "bookshelf-wood", direction: "ne" },
      { key: "plant", lx: 5, ly: 1, assetId: "plant-potted", direction: "sw" },
      { key: "cooler", lx: 0, ly: 4, assetId: "water-cooler", direction: "ne" },
      { key: "cabinet", lx: 0, ly: 5, assetId: "cabinet-wood-tall", direction: "ne" },
      { key: "bin", lx: 1, ly: 4, assetId: "trash-bin-office", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-general-v1": {
    items: [
      { key: "desk-0", lx: 0, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "office-standing-desk", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 1, assetId: "bookshelf-wood", direction: "ne" },
      { key: "cabinet", lx: 4, ly: 0, assetId: "cabinet-wood-tall", direction: "se" },
      { key: "cooler", lx: 5, ly: 0, assetId: "water-cooler", direction: "se" },
      { key: "bin", lx: 4, ly: 1, assetId: "trash-bin-office", direction: "se" },
      { key: "plant", lx: 5, ly: 1, assetId: "plant-potted", direction: "sw" },
      { key: "desk-2", lx: 4, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "nw", extra: true },
      { key: "chair-3", lx: 5, ly: 4, assetId: "chair-office-swivel", direction: "se", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "bay-general-v2": {
    items: [
      { key: "desk-0", lx: 4, ly: 0, assetId: "desk-dev-dual", direction: "se" },
      { key: "chair-0", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "desk-1", lx: 0, ly: 4, assetId: "office-standing-desk", direction: "ne" },
      { key: "chair-1", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "sign", lx: 1, ly: 5, assetId: "bay-sign-post", direction: "se" },
      { key: "shelf", lx: 0, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "shelf-2", lx: 1, ly: 0, assetId: "bookshelf-wood", direction: "se" },
      { key: "cooler", lx: 0, ly: 1, assetId: "water-cooler", direction: "ne" },
      { key: "plant", lx: 1, ly: 1, assetId: "plant-potted", direction: "se" },
      { key: "bin", lx: 5, ly: 1, assetId: "trash-bin-office", direction: "sw" },
      { key: "table", lx: 2, ly: 2, assetId: "table-conference", direction: "se" },
      { key: "desk-2", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-2", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne", extra: true },
      { key: "desk-3", lx: 5, ly: 5, assetId: "pc-workstation-mac", direction: "sw", extra: true },
      { key: "chair-3", lx: 4, ly: 5, assetId: "chair-office-swivel", direction: "ne", extra: true },
    ],
    standSpots: [[2, 4], [3, 4]],
  },
  "amenity-game": {
    items: [
      { key: "game-0", lx: 0, ly: 0, assetId: "game-arcade-cabinet", direction: "se" },
      { key: "game-1", lx: 1, ly: 0, assetId: "game-arcade-cabinet", direction: "se" },
      { key: "game-2", lx: 0, ly: 1, assetId: "game-claw-machine", direction: "ne" },
      { key: "game-3", lx: 4, ly: 0, assetId: "game-console-tv", direction: "se" },
      { key: "game-4", lx: 4, ly: 1, assetId: "sofa-lounge", direction: "nw" },
      { key: "game-5", lx: 0, ly: 4, assetId: "game-racing-rig", direction: "ne" },
      { key: "game-6", lx: 1, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "game-7", lx: 5, ly: 4, assetId: "game-pinball-machine", direction: "sw" },
      { key: "game-8", lx: 4, ly: 4, assetId: "gadget-vr-station", direction: "se" },
      { key: "game-9", lx: 4, ly: 5, assetId: "trash-bin-office", direction: "se" },
    ],
  },
  "amenity-music": {
    items: [
      { key: "music-0", lx: 0, ly: 0, assetId: "music-drum-kit", direction: "se" },
      { key: "music-1", lx: 0, ly: 1, assetId: "music-vinyl-shelf", direction: "ne" },
      { key: "music-2", lx: 1, ly: 1, assetId: "music-guitar-amp", direction: "se" },
      { key: "music-3", lx: 4, ly: 0, assetId: "music-dj-turntable", direction: "se" },
      { key: "music-4", lx: 5, ly: 1, assetId: "music-guitar-amp", direction: "sw" },
      { key: "music-5", lx: 0, ly: 4, assetId: "music-synth-keyboard", direction: "ne" },
      { key: "music-6", lx: 1, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "music-7", lx: 4, ly: 5, assetId: "sofa-lounge", direction: "nw" },
      { key: "music-8", lx: 5, ly: 4, assetId: "plant-potted", direction: "sw" },
    ],
  },
  "amenity-stream": {
    items: [
      { key: "stream-0", lx: 0, ly: 0, assetId: "stream-desk-pro", direction: "se" },
      { key: "stream-1", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "stream-2", lx: 0, ly: 1, assetId: "stream-ring-light", direction: "ne" },
      { key: "stream-3", lx: 4, ly: 0, assetId: "stream-green-screen", direction: "se" },
      { key: "stream-4", lx: 5, ly: 1, assetId: "stream-softbox-light", direction: "sw" },
      { key: "stream-5", lx: 0, ly: 4, assetId: "stream-podcast-table", direction: "ne" },
      { key: "stream-6", lx: 1, ly: 4, assetId: "chair-office-swivel", direction: "sw" },
      { key: "stream-7", lx: 1, ly: 5, assetId: "chair-office-swivel", direction: "sw" },
      { key: "stream-8", lx: 5, ly: 4, assetId: "stream-ring-light", direction: "sw" },
      { key: "stream-9", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
      { key: "stream-10", lx: 4, ly: 5, assetId: "trash-bin-office", direction: "se" },
    ],
  },
  "amenity-gym": {
    items: [
      { key: "gym-0", lx: 0, ly: 0, assetId: "gym-treadmill", direction: "se" },
      { key: "gym-1", lx: 0, ly: 1, assetId: "gym-treadmill", direction: "se" },
      { key: "gym-2", lx: 4, ly: 0, assetId: "gym-punching-bag", direction: "se" },
      { key: "gym-3", lx: 5, ly: 0, assetId: "office-locker-bank", direction: "se" },
      { key: "gym-4", lx: 5, ly: 1, assetId: "water-cooler", direction: "sw" },
      { key: "gym-5", lx: 0, ly: 4, assetId: "gym-dumbbell-rack", direction: "ne" },
      { key: "gym-6", lx: 1, ly: 4, assetId: "gym-bench-press", direction: "ne" },
      { key: "gym-7", lx: 4, ly: 4, assetId: "gym-exercise-bike", direction: "nw" },
      { key: "gym-8", lx: 5, ly: 4, assetId: "gym-exercise-bike", direction: "nw" },
      { key: "gym-9", lx: 4, ly: 5, assetId: "gym-yoga-mat-corner", direction: "se" },
      { key: "gym-10", lx: 5, ly: 5, assetId: "gym-yoga-mat-corner", direction: "se" },
    ],
  },
  "amenity-lab": {
    items: [
      { key: "lab-0", lx: 0, ly: 0, assetId: "lab-bench-microscope", direction: "se" },
      { key: "lab-1", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "lab-2", lx: 0, ly: 1, assetId: "lab-fume-hood", direction: "ne" },
      { key: "lab-3", lx: 4, ly: 0, assetId: "lab-bioreactor", direction: "se" },
      { key: "lab-4", lx: 5, ly: 0, assetId: "lab-cryo-tank", direction: "se" },
      { key: "lab-5", lx: 4, ly: 1, assetId: "lab-centrifuge-table", direction: "se" },
      { key: "lab-6", lx: 5, ly: 1, assetId: "sci-chemistry-rack", direction: "sw" },
      { key: "lab-7", lx: 0, ly: 4, assetId: "sci-dna-holo", direction: "ne" },
      { key: "lab-8", lx: 0, ly: 5, assetId: "sci-tesla-coil", direction: "ne" },
      { key: "lab-9", lx: 1, ly: 5, assetId: "sci-globe-stand", direction: "se" },
      { key: "lab-10", lx: 4, ly: 5, assetId: "fire-extinguisher", direction: "se" },
      { key: "lab-11", lx: 5, ly: 5, assetId: "sci-telescope", direction: "sw" },
    ],
  },
  "amenity-maker": {
    items: [
      { key: "maker-0", lx: 0, ly: 0, assetId: "pc-soldering-bench", direction: "se" },
      { key: "maker-1", lx: 1, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "maker-2", lx: 0, ly: 1, assetId: "shelf-metal-storage", direction: "ne" },
      { key: "maker-3", lx: 4, ly: 0, assetId: "pc-desk-triple", direction: "se" },
      { key: "maker-4", lx: 4, ly: 1, assetId: "chair-office-swivel", direction: "nw" },
      { key: "maker-5", lx: 5, ly: 1, assetId: "pc-tower-box", direction: "sw" },
      { key: "maker-6", lx: 0, ly: 4, assetId: "pc-3d-printer", direction: "ne" },
      { key: "maker-7", lx: 0, ly: 5, assetId: "pc-3d-printer", direction: "ne" },
      { key: "maker-8", lx: 1, ly: 4, assetId: "gadget-robot-arm", direction: "ne" },
      { key: "maker-9", lx: 4, ly: 4, assetId: "gadget-drone-pad", direction: "se" },
      { key: "maker-10", lx: 5, ly: 4, assetId: "gadget-charging-hub", direction: "sw" },
      { key: "maker-11", lx: 4, ly: 5, assetId: "gadget-vr-station", direction: "nw" },
      { key: "plant-corner", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
  },
  "amenity-home": {
    items: [
      { key: "home-0", lx: 0, ly: 0, assetId: "home-tv-bookshelf", direction: "se" },
      { key: "home-1", lx: 0, ly: 1, assetId: "sofa-lounge", direction: "nw" },
      { key: "home-2", lx: 4, ly: 0, assetId: "home-kitchen-fridge", direction: "se" },
      { key: "home-3", lx: 5, ly: 0, assetId: "home-cat-tree", direction: "se" },
      { key: "home-4", lx: 4, ly: 1, assetId: "home-dining-set", direction: "se" },
      { key: "home-5", lx: 0, ly: 4, assetId: "home-bed-cozy", direction: "ne" },
      { key: "home-6", lx: 5, ly: 4, assetId: "music-vinyl-shelf", direction: "sw" },
      { key: "home-7", lx: 4, ly: 5, assetId: "robot-vacuum", direction: "se" },
      { key: "home-8", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
  },
  "amenity-server": {
    items: [
      { key: "server-0", lx: 0, ly: 0, assetId: "server-rack", direction: "se" },
      { key: "server-1", lx: 1, ly: 0, assetId: "server-blade-tower", direction: "se" },
      { key: "server-2", lx: 0, ly: 1, assetId: "server-blade-tower", direction: "ne" },
      { key: "server-3", lx: 4, ly: 0, assetId: "server-nas-vault", direction: "se" },
      { key: "server-4", lx: 5, ly: 0, assetId: "server-ups-battery", direction: "se" },
      { key: "server-5", lx: 5, ly: 1, assetId: "fire-extinguisher", direction: "sw" },
      { key: "server-6", lx: 0, ly: 4, assetId: "server-patch-panel", direction: "ne" },
      { key: "server-7", lx: 0, ly: 5, assetId: "server-cooling-unit", direction: "ne" },
      { key: "server-8", lx: 1, ly: 5, assetId: "pc-tower-box", direction: "se" },
      { key: "server-9", lx: 5, ly: 4, assetId: "pc-workstation-mac", direction: "sw" },
      { key: "server-10", lx: 4, ly: 4, assetId: "chair-office-swivel", direction: "ne" },
      { key: "server-11", lx: 4, ly: 5, assetId: "trash-bin-office", direction: "se" },
      { key: "plant-corner", lx: 5, ly: 5, assetId: "plant-potted", direction: "se" },
    ],
  },
};

export const BAY_LAYOUT_VARIANTS = 3;
export const COMMON_LAYOUT_VARIANTS = 2;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable per-project choice of layout variant and diagonal mirror, so each room keeps its own look. */
export function bayLayoutChoice(bayId: string): { variant: number; mirrored: boolean } {
  const h = hashString(bayId);
  return { variant: h % BAY_LAYOUT_VARIANTS, mirrored: ((h >>> 8) & 1) === 1 };
}

/** Lounges alternate variant and mirror so a second lounge never copies the first. */
export function commonLayoutChoice(row: number): { variant: number; mirrored: boolean } {
  return { variant: row % COMMON_LAYOUT_VARIANTS, mirrored: Math.floor(row / COMMON_LAYOUT_VARIANTS) % 2 === 1 };
}

const MIRROR_DIRECTION: Record<Direction, Direction> = { se: "ne", ne: "se", nw: "sw", sw: "nw" };

/** Mirror across the lx/ly diagonal: both back walls (lx=0, ly=0) stay back walls, doorways map to doorways. */
export function mirrorItem(it: RoomLayoutItem): RoomLayoutItem {
  return { ...it, lx: it.ly, ly: it.lx, direction: MIRROR_DIRECTION[it.direction] };
}

export function getRoomLayout(key: string, mirrored = false): RoomLayout {
  const layout = ROOM_LAYOUTS[key];
  if (!layout) throw new Error(`Unknown room layout "${key}"`);
  if (!mirrored) return layout;
  return {
    items: layout.items.map(mirrorItem),
    standSpots: layout.standSpots?.map(([x, y]) => [y, x] as [number, number]),
  };
}

export function bayLayoutKey(department: DepartmentId, bayId: string): { key: string; mirrored: boolean } {
  const { variant, mirrored } = bayLayoutChoice(bayId);
  return { key: `bay-${department}-v${variant}`, mirrored };
}

export function commonLayoutKey(row: number): { key: string; mirrored: boolean } {
  const { variant, mirrored } = commonLayoutChoice(row);
  return { key: `common-v${variant}`, mirrored };
}

export function toFurniture(zoneId: ZoneId, items: RoomLayoutItem[]): FurnitureInstance[] {
  return items.map((it) => ({
    id: `${zoneId}-${it.key}`,
    zoneId,
    lx: it.lx,
    ly: it.ly,
    assetId: it.assetId,
    direction: it.direction,
    layer: "object" as const,
    placedBy: "system" as const,
  }));
}

/** Direction a person standing on `from` should face to look at `to`. */
export function facingToward(from: [number, number], to: [number, number]): Direction {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "ne" : "sw";
  return dy > 0 ? "se" : "nw";
}

