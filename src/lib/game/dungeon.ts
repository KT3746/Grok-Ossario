import { ENEMIES, floorBoss, floorMobs, scaleEnemy } from "./content";
import { irange, pick } from "./rng";
import {
  TILE_DOOR,
  TILE_EMPTY,
  TILE_LOCKED,
  TILE_WALL,
  type ChestInst,
  type Dungeon,
  type EnemyInst,
} from "./types";

export const MAP_W = 15;
export const MAP_H = 15;

type Room = { x: number; y: number; w: number; h: number };

function idx(x: number, y: number, w = MAP_W) {
  return y * w + x;
}

export function inBounds(x: number, y: number, w = MAP_W, h = MAP_H) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function getTile(d: Dungeon, x: number, y: number): number {
  if (!inBounds(x, y, d.w, d.h)) return TILE_WALL;
  return d.tiles[idx(x, y, d.w)]!;
}

export function setTile(d: Dungeon, x: number, y: number, t: number) {
  if (!inBounds(x, y, d.w, d.h)) return;
  d.tiles[idx(x, y, d.w)] = t;
}

export function isSolid(d: Dungeon, x: number, y: number): boolean {
  const t = getTile(d, x, y);
  return t === TILE_WALL || t === TILE_DOOR || t === TILE_LOCKED;
}

export function isBlocking(d: Dungeon, x: number, y: number): boolean {
  if (isSolid(d, x, y)) return true;
  if (d.chests.some((c) => !c.open && c.x === x && c.y === y)) return true;
  if (d.enemies.some((e) => e.alive && e.x === x && e.y === y)) return true;
  return false;
}

function overlaps(a: Room, b: Room, pad = 1) {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

function center(r: Room) {
  return {
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  };
}

function carveRoom(tiles: Uint8Array, w: number, r: Room) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[idx(x, y, w)] = TILE_EMPTY;
    }
  }
}

function carveH(tiles: Uint8Array, w: number, x0: number, x1: number, y: number) {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) tiles[idx(x, y, w)] = TILE_EMPTY;
}

function carveV(tiles: Uint8Array, w: number, y0: number, y1: number, x: number) {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) tiles[idx(x, y, w)] = TILE_EMPTY;
}

function occupied(d: Dungeon, x: number, y: number, extra: { x: number; y: number }[] = []) {
  if (getTile(d, x, y) !== TILE_EMPTY) return true;
  if (d.enemies.some((e) => e.x === x && e.y === y)) return true;
  if (d.chests.some((c) => c.x === x && c.y === y)) return true;
  if (x === d.stairsX && y === d.stairsY) return true;
  return extra.some((p) => p.x === x && p.y === y);
}

export function generateDungeon(rng: () => number, floor: number): Dungeon {
  const w = MAP_W;
  const h = MAP_H;
  const tiles = new Uint8Array(w * h).fill(TILE_WALL);
  const rooms: Room[] = [];

  for (let i = 0; i < 40 && rooms.length < 6; i++) {
    const rw = irange(rng, 3, 5);
    const rh = irange(rng, 3, 5);
    const rx = irange(rng, 1, w - rw - 2);
    const ry = irange(rng, 1, h - rh - 2);
    const room = { x: rx, y: ry, w: rw, h: rh };
    if (rooms.some((r) => overlaps(room, r, 1))) continue;
    rooms.push(room);
    carveRoom(tiles, w, room);
  }

  if (rooms.length < 4) {
    const fallback: Room[] = [
      { x: 1, y: 1, w: 4, h: 4 },
      { x: 10, y: 1, w: 4, h: 4 },
      { x: 1, y: 10, w: 4, h: 4 },
      { x: 9, y: 9, w: 5, h: 5 },
    ];
    for (const r of fallback) {
      if (!rooms.some((o) => overlaps(r, o, 0))) {
        rooms.push(r);
        carveRoom(tiles, w, r);
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const a = center(rooms[i - 1]!);
    const b = center(rooms[i]!);
    if (rng() < 0.5) {
      carveH(tiles, w, a.x, b.x, a.y);
      carveV(tiles, w, a.y, b.y, b.x);
    } else {
      carveV(tiles, w, a.y, b.y, a.x);
      carveH(tiles, w, a.x, b.x, b.y);
    }
  }

  const start = center(rooms[0]!);
  const last = rooms[rooms.length - 1]!;
  const stairs = center(last);

  // One door on the rim of the last room (entrance)
  const doors: { x: number; y: number }[] = [];
  for (let y = last.y; y < last.y + last.h; y++) {
    for (let x of [last.x - 1, last.x + last.w]) {
      if (inBounds(x, y, w, h) && tiles[idx(x, y, w)] === TILE_EMPTY) {
        doors.push({ x, y });
      }
    }
  }
  for (let x = last.x; x < last.x + last.w; x++) {
    for (let y of [last.y - 1, last.y + last.h]) {
      if (inBounds(x, y, w, h) && tiles[idx(x, y, w)] === TILE_EMPTY) {
        doors.push({ x, y });
      }
    }
  }
  if (doors.length) {
    const d0 = doors[0]!;
    tiles[idx(d0.x, d0.y, w)] = floor >= 2 ? TILE_LOCKED : TILE_DOOR;
  }

  const dungeon: Dungeon = {
    w,
    h,
    tiles,
    explored: new Uint8Array(w * h),
    enemies: [],
    chests: [],
    stairsX: stairs.x,
    stairsY: stairs.y,
  };

  const extra = [start];

  // Chests in earlier rooms
  const chestCount = 3 + (floor > 3 ? 1 : 0);
  for (let i = 0; i < rooms.length - 1 && dungeon.chests.length < chestCount; i++) {
    const r = rooms[i]!;
    for (let t = 0; t < 8; t++) {
      const x = irange(rng, r.x, r.x + r.w - 1);
      const y = irange(rng, r.y, r.y + r.h - 1);
      if (x === start.x && y === start.y) continue;
      if (occupied(dungeon, x, y, extra)) continue;
      dungeon.chests.push({
        id: `c${floor}-${dungeon.chests.length}`,
        x,
        y,
        open: false,
      });
      break;
    }
  }

  // Boss near stairs
  const bossKind = floorBoss(floor);
  const bossDef = ENEMIES[bossKind]!;
  const scaled = scaleEnemy(bossDef, floor);
  let bx = stairs.x;
  let by = stairs.y;
  const around = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of around) {
    const x = stairs.x + dx;
    const y = stairs.y + dy;
    if (getTile(dungeon, x, y) === TILE_EMPTY && !(x === start.x && y === start.y)) {
      bx = x;
      by = y;
      if (dx !== 0 || dy !== 0) break;
    }
  }
  dungeon.enemies.push({
    id: `boss-${floor}`,
    kind: bossKind,
    x: bx,
    y: by,
    hp: scaled.hp,
    maxHp: scaled.hp,
    alive: true,
    isBoss: true,
  });

  const pool = floorMobs(floor);
  const mobCount = 5 + Math.min(4, floor);
  let guard = 0;
  while (dungeon.enemies.length < mobCount + 1 && guard++ < 80) {
    const x = irange(rng, 1, w - 2);
    const y = irange(rng, 1, h - 2);
    if (Math.abs(x - start.x) + Math.abs(y - start.y) < 4) continue;
    if (occupied(dungeon, x, y, extra)) continue;
    const kind = pick(rng, pool);
    const def = ENEMIES[kind]!;
    const sc = scaleEnemy(def, floor);
    dungeon.enemies.push({
      id: `e${floor}-${dungeon.enemies.length}`,
      kind,
      x,
      y,
      hp: sc.hp,
      maxHp: sc.hp,
      alive: true,
      isBoss: false,
    });
  }

  reveal(dungeon, start.x, start.y);
  return dungeon;
}

export function reveal(d: Dungeon, x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny, d.w, d.h)) d.explored[idx(nx, ny, d.w)] = 1;
    }
  }
}

export function enemyAt(d: Dungeon, x: number, y: number): EnemyInst | undefined {
  return d.enemies.find((e) => e.alive && e.x === x && e.y === y);
}

export function chestAt(d: Dungeon, x: number, y: number): ChestInst | undefined {
  return d.chests.find((c) => c.x === x && c.y === y);
}

export function walkableAfterOpen(d: Dungeon, x: number, y: number): boolean {
  if (isSolid(d, x, y)) return false;
  if (d.enemies.some((e) => e.alive && e.x === x && e.y === y)) return false;
  return true;
}
