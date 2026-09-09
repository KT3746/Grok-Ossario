export type Screen =
  | "title"
  | "playing"
  | "combat"
  | "inventory"
  | "loot"
  | "dead"
  | "help";

export type Dir = 0 | 1 | 2 | 3;

export type ItemSlot = "weapon" | "armor" | "relic";

export interface ItemDef {
  id: string;
  slot: ItemSlot;
  name: string;
  desc: string;
  atk: number;
  def: number;
  hp: number;
  crit: number;
  lifesteal: number;
  icon: string;
  minFloor: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  xp: number;
  gold: number;
  scale: number;
  isBoss?: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cd: number;
  unlock: number;
}

export interface Player {
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  level: number;
  xp: number;
  gold: number;
  potions: number;
  flasks: number;
  keys: number;
  weapon: string;
  armor: string;
  relic: string | null;
  skillCd: Record<string, number>;
  kills: number;
}

export interface EnemyInst {
  id: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isBoss: boolean;
}

export interface ChestInst {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

export interface Dungeon {
  w: number;
  h: number;
  tiles: Uint8Array;
  explored: Uint8Array;
  enemies: EnemyInst[];
  chests: ChestInst[];
  stairsX: number;
  stairsY: number;
}

export interface CombatState {
  enemyId: string;
  log: string;
  phase: "player" | "enemy" | "win";
  defending: boolean;
  turn: number;
}

export interface LootOffer {
  gold: number;
  potions: number;
  flasks: number;
  keys: number;
  itemId: string | null;
  replaced: string | null;
  source: "chest" | "kill" | "boss" | "stairs";
}

export interface Persist {
  version: number;
  seed: number;
  floor: number;
  player: Player;
  dungeon: {
    w: number;
    h: number;
    tiles: number[];
    explored: number[];
    enemies: EnemyInst[];
    chests: ChestInst[];
    stairsX: number;
    stairsY: number;
  };
  seenHelp: boolean;
}

export const TILE_EMPTY = 0;
export const TILE_WALL = 1;
export const TILE_DOOR = 2;
export const TILE_LOCKED = 3;

export const DIR_VEC: readonly { x: number; y: number }[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;
