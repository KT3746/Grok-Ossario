import type { Dungeon, Persist, Player } from "./types";

export const SAVE_KEY = "ossario.save.v1";
export const SETTINGS_KEY = "ossario.settings.v1";
export const SAVE_VERSION = 1;

export interface Settings {
  muted: boolean;
  shake: boolean;
}

const DEFAULT_SETTINGS: Settings = { muted: false, shake: true };

export function dungeonToPersist(d: Dungeon): Persist["dungeon"] {
  return {
    w: d.w,
    h: d.h,
    tiles: Array.from(d.tiles),
    explored: Array.from(d.explored),
    enemies: d.enemies,
    chests: d.chests,
    stairsX: d.stairsX,
    stairsY: d.stairsY,
  };
}

export function dungeonFromPersist(p: Persist["dungeon"]): Dungeon {
  return {
    w: p.w,
    h: p.h,
    tiles: Uint8Array.from(p.tiles),
    explored: Uint8Array.from(p.explored),
    enemies: p.enemies,
    chests: p.chests,
    stairsX: p.stairsX,
    stairsY: p.stairsY,
  };
}

export function loadSave(): Persist | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persist;
    if (!data || data.version !== SAVE_VERSION || !data.player || !data.dungeon) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeSave(p: Persist) {
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(SAVE_KEY + ".bak", prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function makePersist(
  seed: number,
  floor: number,
  player: Player,
  dungeon: Dungeon,
  seenHelp: boolean,
): Persist {
  return {
    version: SAVE_VERSION,
    seed,
    floor,
    player,
    dungeon: dungeonToPersist(dungeon),
    seenHelp,
  };
}
