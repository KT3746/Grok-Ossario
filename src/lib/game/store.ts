import { create } from "zustand";
import {
  sfxChest,
  sfxDeath,
  sfxDeny,
  sfxHeal,
  sfxHit,
  sfxStep,
  sfxSwing,
  sfxUi,
  sfxWin,
  setMuted,
  unlockAudio,
} from "./audio";
import { ENEMIES, ITEMS, SKILLS, scaleEnemy, xpToNext } from "./content";
import {
  chestAt,
  enemyAt,
  generateDungeon,
  getTile,
  isSolid,
  reveal,
  setTile,
} from "./dungeon";
import { addFlash, addTrauma, hitstop, playImpact, spawnFloater } from "./juice";
import { mulberry32 } from "./rng";
import {
  clearSave,
  dungeonFromPersist,
  loadSave,
  loadSettings,
  makePersist,
  writeSave,
  writeSettings,
} from "./save";
import {
  DIR_VEC,
  TILE_DOOR,
  TILE_EMPTY,
  TILE_LOCKED,
  TILE_WALL,
  type CombatState,
  type Dir,
  type Dungeon,
  type LootOffer,
  type Player,
  type Screen,
} from "./types";

export interface GameStore {
  screen: Screen;
  seed: number;
  floor: number;
  player: Player;
  dungeon: Dungeon | null;
  combat: CombatState | null;
  loot: LootOffer | null;
  animating: boolean;
  muted: boolean;
  shake: boolean;
  seenHelp: boolean;
  toast: string;
  hasSave: boolean;
  hydrated: boolean;
  hydrate: () => void;
  newGame: () => void;
  continueGame: () => void;
  setScreen: (s: Screen) => void;
  tryMove: (step: 1 | -1) => boolean;
  tryTurn: (delta: -1 | 1) => boolean;
  interact: () => void;
  afterAnimate: () => void;
  combatAction: (kind: "attack" | "defend" | "skill" | "potion" | "flask") => void;
  enemyAct: () => void;
  collectLoot: () => void;
  cancelLoot: () => void;
  descend: () => void;
  toggleMute: () => void;
  toggleShake: () => void;
  dismissToast: () => void;
  ackHelp: () => void;
}

let enemyTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let animTimer: ReturnType<typeof setTimeout> | null = null;

function queueAnimate(get: () => GameStore) {
  if (animTimer) clearTimeout(animTimer);
  animTimer = setTimeout(() => get().afterAnimate(), 230);
}

function rngFor(seed: number, floor: number) {
  return mulberry32((seed ^ Math.imul(floor + 1, 0x9e3779b9)) >>> 0);
}

function basePlayer(x: number, y: number): Player {
  const rusty = ITEMS.rusty!;
  const rags = ITEMS.rags!;
  const maxHp = 32 + rusty.hp + rags.hp;
  return {
    x,
    y,
    dir: 0,
    hp: maxHp,
    maxHp,
    atk: 5 + rusty.atk,
    def: 1 + rags.def,
    spd: 5,
    level: 1,
    xp: 0,
    gold: 0,
    potions: 1,
    flasks: 0,
    keys: 0,
    weapon: "rusty",
    armor: "rags",
    relic: null,
    skillCd: {},
    kills: 0,
  };
}

function recomputeStats(p: Player): Player {
  const w = ITEMS[p.weapon];
  const a = ITEMS[p.armor];
  const r = p.relic ? ITEMS[p.relic] : null;
  const maxHp = 26 + p.level * 6 + (w?.hp ?? 0) + (a?.hp ?? 0) + (r?.hp ?? 0);
  const atk = 4 + p.level + (w?.atk ?? 0) + (r?.atk ?? 0);
  const def = (a?.def ?? 0) + (r?.def ?? 0) + Math.floor(p.level / 2);
  return { ...p, maxHp, atk, def, hp: Math.min(p.hp, maxHp) };
}

function persistNow(s: {
  seed: number;
  floor: number;
  player: Player;
  dungeon: Dungeon | null;
  seenHelp: boolean;
}) {
  if (!s.dungeon) return;
  writeSave(makePersist(s.seed, s.floor, s.player, s.dungeon, s.seenHelp));
}

function scheduleSave(get: () => GameStore) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistNow(get()), 400);
}

function facingOpen(d: Dungeon, x: number, y: number): Dir {
  let best: Dir = 0;
  let bestLen = -1;
  for (let dir = 0; dir < 4; dir++) {
    const v = DIR_VEC[dir]!;
    let len = 0;
    let cx = x + v.x;
    let cy = y + v.y;
    while (getTile(d, cx, cy) === TILE_EMPTY && len < 14) {
      len += 1;
      cx += v.x;
      cy += v.y;
    }
    if (len > bestLen) {
      bestLen = len;
      best = dir as Dir;
    }
  }
  return best;
}

function ahead(p: Player, step = 1) {
  const v = DIR_VEC[p.dir]!;
  return { x: p.x + v.x * step, y: p.y + v.y * step };
}

function itemScore(id: string) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.atk * 3 + it.def * 3 + it.hp + it.crit * 20 + it.lifesteal * 20;
}

function rollDmg(
  atk: number,
  def: number,
  rng: () => number,
  opts: { mult?: number; pierce?: number; crit?: number } = {},
) {
  const mult = opts.mult ?? 1;
  const pierce = opts.pierce ?? 0;
  const critP = opts.crit ?? 0;
  const crit = rng() < critP;
  const raw = atk * mult * (0.86 + rng() * 0.28) * (crit ? 1.6 : 1);
  const dmg = Math.max(1, Math.round(raw - def * (0.5 * (1 - pierce))));
  return { dmg, crit };
}

function levelUp(p: Player): { player: Player; msg: string } {
  let player = { ...p };
  let gained = 0;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level += 1;
    gained += 1;
  }
  if (!gained) return { player, msg: "" };
  player = recomputeStats(player);
  player.hp = Math.min(player.maxHp, player.hp + 8 * gained);
  return { player, msg: `Nível ${player.level}.` };
}

function enemyAhead(d: Dungeon, p: Player, maxDist = 3) {
  const v = DIR_VEC[p.dir]!;
  for (let i = 1; i <= maxDist; i++) {
    const x = p.x + v.x * i;
    const y = p.y + v.y * i;
    if (isSolid(d, x, y)) return undefined;
    const e = enemyAt(d, x, y);
    if (e) return e;
  }
  return undefined;
}

function lookPrompt(d: Dungeon, p: Player): string {
  const a = ahead(p);
  const e = enemyAhead(d, p, 10);
  if (e) {
    const def = ENEMIES[e.kind];
    return e.isBoss ? `${def?.name ?? "Chefe"} bloqueia o caminho.` : `${def?.name ?? "Inimigo"} à frente.`;
  }
  const t = getTile(d, a.x, a.y);
  if (t === TILE_LOCKED) return p.keys ? "Porta trancada. Usar chave?" : "Porta trancada.";
  if (t === TILE_DOOR) return "Uma porta pesada.";
  const c = chestAt(d, a.x, a.y);
  if (c && !c.open) return "Um baú de ferro.";
  if (p.x === d.stairsX && p.y === d.stairsY) return "Escadas para o próximo andar.";
  if (a.x === d.stairsX && a.y === d.stairsY) return "Escadas à frente.";
  return "";
}

function chestLoot(rng: () => number, floor: number, p: Player): LootOffer {
  const gold = 6 + Math.floor(rng() * (8 + floor * 4));
  const potions = rng() < 0.55 ? 1 : 0;
  const flasks = rng() < 0.12 + floor * 0.03 ? 1 : 0;
  const keys = rng() < 0.45 ? 1 : 0;
  const pool = Object.values(ITEMS).filter((it) => it.minFloor <= floor && it.id !== "rusty" && it.id !== "rags");
  let itemId: string | null = null;
  let replaced: string | null = null;
  if (pool.length && rng() < 0.72) {
    const it = pool[Math.floor(rng() * pool.length)]!;
    itemId = it.id;
    const current =
      it.slot === "weapon" ? p.weapon : it.slot === "armor" ? p.armor : p.relic;
    if (current && itemScore(it.id) <= itemScore(current) && rng() < 0.5) {
      // still offer, player may want it
    }
    if (current && current !== it.id) replaced = current;
  }
  return { gold, potions, flasks, keys, itemId, replaced, source: "chest" };
}

function applyLootToPlayer(p: Player, loot: LootOffer): Player {
  let n = { ...p, gold: p.gold + loot.gold, potions: p.potions + loot.potions, flasks: p.flasks + loot.flasks, keys: p.keys + loot.keys };
  if (loot.itemId) {
    const it = ITEMS[loot.itemId];
    if (it) {
      if (it.slot === "weapon") n.weapon = it.id;
      else if (it.slot === "armor") n.armor = it.id;
      else n.relic = it.id;
      n = recomputeStats(n);
    }
  }
  return n;
}

function makeFloor(seed: number, floor: number, prev: Player | null): { player: Player; dungeon: Dungeon } {
  const rng = rngFor(seed, floor);
  const dungeon = generateDungeon(rng, floor);
  let sx = 1;
  let sy = 1;
  for (let y = 1; y < dungeon.h - 1; y++) {
    for (let x = 1; x < dungeon.w - 1; x++) {
      if (getTile(dungeon, x, y) === TILE_EMPTY) {
        const far = Math.abs(x - dungeon.stairsX) + Math.abs(y - dungeon.stairsY);
        if (far > 6) {
          sx = x;
          sy = y;
        }
      }
    }
  }
  // pick the empty cell farthest from stairs
  let best = 0;
  for (let y = 1; y < dungeon.h - 1; y++) {
    for (let x = 1; x < dungeon.w - 1; x++) {
      if (getTile(dungeon, x, y) !== TILE_EMPTY) continue;
      if (dungeon.enemies.some((e) => e.x === x && e.y === y)) continue;
      if (dungeon.chests.some((c) => c.x === x && c.y === y)) continue;
      const far = Math.abs(x - dungeon.stairsX) + Math.abs(y - dungeon.stairsY);
      if (far > best) {
        best = far;
        sx = x;
        sy = y;
      }
    }
  }
  const player = prev
    ? recomputeStats({
        ...prev,
        x: sx,
        y: sy,
        dir: 0,
        hp: Math.min(prev.maxHp, prev.hp + Math.round(prev.maxHp * 0.25)),
      })
    : basePlayer(sx, sy);
  player.x = sx;
  player.y = sy;
  player.dir = facingOpen(dungeon, sx, sy);
  reveal(dungeon, sx, sy);
  return { player, dungeon };
}

function moveEnemies(d: Dungeon, p: Player, rng: () => number): { dungeon: Dungeon; aggro: string | null } {
  const enemies = d.enemies.map((e) => ({ ...e }));
  let aggro: string | null = null;
  for (const e of enemies) {
    if (!e.alive || e.isBoss) continue;
    const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (dist > 7) continue;
    if (dist === 1) {
      aggro = e.id;
      break;
    }
    const opts = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].sort((a, b) => {
      const da = Math.abs(e.x + a.x - p.x) + Math.abs(e.y + a.y - p.y);
      const db = Math.abs(e.x + b.x - p.x) + Math.abs(e.y + b.y - p.y);
      return da - db || rng() - 0.5;
    });
    for (const o of opts) {
      const nx = e.x + o.x;
      const ny = e.y + o.y;
      if (isSolid(d, nx, ny)) continue;
      if (nx === p.x && ny === p.y) {
        aggro = e.id;
        break;
      }
      if (enemies.some((o2) => o2.alive && o2.id !== e.id && o2.x === nx && o2.y === ny)) continue;
      if (d.chests.some((c) => !c.open && c.x === nx && c.y === ny)) continue;
      e.x = nx;
      e.y = ny;
      break;
    }
    if (aggro) break;
  }
  return { dungeon: { ...d, enemies }, aggro };
}

export const useGame = create<GameStore>((set, get) => ({
  screen: "title",
  seed: 1,
  floor: 1,
  player: basePlayer(1, 1),
  dungeon: null,
  combat: null,
  loot: null,
  animating: false,
  muted: false,
  shake: true,
  seenHelp: false,
  toast: "",
  hasSave: false,
  hydrated: false,

  hydrate: () => {
    const settings = loadSettings();
    setMuted(settings.muted);
    const save = loadSave();
    set({
      muted: settings.muted,
      shake: settings.shake,
      hasSave: !!save,
      hydrated: true,
      seenHelp: save?.seenHelp ?? false,
    });
  },

  newGame: () => {
    unlockAudio();
    sfxUi();
    const seed = (Math.floor(Math.random() * 0xffffffff) || Date.now()) >>> 0;
    const { player, dungeon } = makeFloor(seed, 1, null);
    const seenHelp = get().seenHelp;
    set({
      screen: seenHelp ? "playing" : "help",
      seed,
      floor: 1,
      player,
      dungeon,
      combat: null,
      loot: null,
      animating: false,
      toast: "",
      hasSave: true,
    });
    persistNow(get());
  },

  continueGame: () => {
    unlockAudio();
    const save = loadSave();
    if (!save) {
      get().newGame();
      return;
    }
    const dungeon = dungeonFromPersist(save.dungeon);
    set({
      screen: "playing",
      seed: save.seed,
      floor: save.floor,
      player: save.player,
      dungeon,
      combat: null,
      loot: null,
      animating: false,
      seenHelp: save.seenHelp,
      toast: lookPrompt(dungeon, save.player),
      hasSave: true,
    });
  },

  setScreen: (s) => {
    sfxUi();
    set({ screen: s });
  },

  tryMove: (step) => {
    const s = get();
    if (s.animating || !s.dungeon) return false;
    if (s.screen !== "playing") return false;
    const a = ahead(s.player, step);
    const d = s.dungeon;
    const t = getTile(d, a.x, a.y);
    if (t === TILE_WALL) {
      sfxDeny();
      addTrauma(0.18);
      set({ toast: "Pedra." });
      return false;
    }
    if (t === TILE_LOCKED) {
      if (s.player.keys > 0) {
        const nd = { ...d, tiles: new Uint8Array(d.tiles) };
        setTile(nd, a.x, a.y, TILE_EMPTY);
        sfxChest();
        set({
          dungeon: nd,
          player: { ...s.player, keys: s.player.keys - 1 },
          toast: "A fechadura cede.",
          animating: true,
        });
        queueAnimate(get);
        scheduleSave(get);
        return true;
      }
      sfxDeny();
      set({ toast: "Trancada. Precisa de uma chave." });
      return false;
    }
    if (t === TILE_DOOR) {
      const nd = { ...d, tiles: new Uint8Array(d.tiles) };
      setTile(nd, a.x, a.y, TILE_EMPTY);
      sfxChest();
      set({ dungeon: nd, toast: "A porta abre.", animating: true });
      queueAnimate(get);
      scheduleSave(get);
      return true;
    }
    const e = enemyAt(d, a.x, a.y);
    if (e) {
      startCombat(set, get, e.id);
      return false;
    }
    const c = chestAt(d, a.x, a.y);
    if (c && !c.open) {
      openChest(set, get, c.id);
      return false;
    }
    const p = { ...s.player, x: a.x, y: a.y };
    const nd = { ...d, explored: new Uint8Array(d.explored) };
    reveal(nd, p.x, p.y);
    sfxStep();
    set({ player: p, dungeon: nd, animating: true, toast: lookPrompt(nd, p) });
    queueAnimate(get);
    return true;
  },

  tryTurn: (delta) => {
    const s = get();
    if (s.animating || !s.dungeon) return false;
    if (s.screen !== "playing") return false;
    const dir = (((s.player.dir + delta + 4) % 4) | 0) as Dir;
    const p = { ...s.player, dir };
    sfxStep();
    set({ player: p, animating: true, toast: lookPrompt(s.dungeon, p) });
    queueAnimate(get);
    return true;
  },

  interact: () => {
    const s = get();
    if (!s.dungeon) return;
    if (s.screen === "inventory") {
      set({ screen: "playing" });
      return;
    }
    if (s.screen !== "playing") return;
    const a = ahead(s.player);
    const onStairs = s.player.x === s.dungeon.stairsX && s.player.y === s.dungeon.stairsY;
    const aheadStairs = a.x === s.dungeon.stairsX && a.y === s.dungeon.stairsY;
    if (onStairs || aheadStairs) {
      if (enemyAt(s.dungeon, s.dungeon.stairsX, s.dungeon.stairsY)) {
        set({ toast: "O chefe ainda guarda as escadas." });
        sfxDeny();
        return;
      }
      const bossAlive = s.dungeon.enemies.some((e) => e.isBoss && e.alive);
      if (bossAlive) {
        set({ toast: "O senhor deste andar ainda vive." });
        sfxDeny();
        return;
      }
      sfxUi();
      set({
        screen: "loot",
        loot: {
          gold: 0,
          potions: 0,
          flasks: 0,
          keys: 0,
          itemId: null,
          replaced: null,
          source: "stairs",
        },
      });
      return;
    }
    const e = enemyAt(s.dungeon, a.x, a.y);
    if (e) {
      startCombat(set, get, e.id);
      return;
    }
    const t = getTile(s.dungeon, a.x, a.y);
    if (t === TILE_LOCKED || t === TILE_DOOR) {
      get().tryMove(1);
      return;
    }
    const c = chestAt(s.dungeon, a.x, a.y);
    if (c && !c.open) {
      openChest(set, get, c.id);
      return;
    }
    set({ toast: lookPrompt(s.dungeon, s.player) || "Nada." });
  },

  afterAnimate: () => {
    const s = get();
    if (!s.dungeon) {
      set({ animating: false });
      return;
    }
    if (s.screen !== "playing") {
      set({ animating: false });
      return;
    }
    const rng = rngFor(s.seed, s.floor + 99);
    const { dungeon, aggro } = moveEnemies(s.dungeon, s.player, rng);
    set({ dungeon, animating: false });
    if (aggro) {
      startCombat(set, get, aggro);
      return;
    }
    scheduleSave(get);
  },

  combatAction: (kind) => {
    const s = get();
    if (!s.combat || s.combat.phase !== "player" || !s.dungeon) return;
    const enemy = s.dungeon.enemies.find((e) => e.id === s.combat!.enemyId);
    if (!enemy || !enemy.alive) return;
    const def = ENEMIES[enemy.kind]!;
    const scaled = scaleEnemy(def, s.floor);
    const rng = rngFor(s.seed + s.combat.turn * 17, s.floor);
    let player = { ...s.player, skillCd: { ...s.player.skillCd } };
    const relic = player.relic ? ITEMS[player.relic] : null;
    let log = "";
    let heavy = false;

    if (kind === "potion") {
      if (player.potions <= 0) {
        sfxDeny();
        return;
      }
      player.potions -= 1;
      const heal = 18;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      sfxHeal();
      spawnFloater(`+${heal}`, "#c8d5c0", 0.28, 0.62);
      log = `Poção: +${heal} vida.`;
    } else if (kind === "flask") {
      if (player.flasks <= 0) {
        sfxDeny();
        return;
      }
      player.flasks -= 1;
      const heal = Math.round(player.maxHp * 0.55);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      sfxHeal();
      spawnFloater(`+${heal}`, "#c8d5c0", 0.28, 0.62);
      log = `Frasco: +${heal} vida.`;
    } else if (kind === "defend") {
      sfxUi();
      log = "Você levanta a guarda.";
      player.hp = Math.min(player.maxHp, player.hp + 2);
    } else if (kind === "skill") {
      const ready = SKILLS.filter((sk) => player.level >= sk.unlock && (player.skillCd[sk.id] ?? 0) <= 0);
      const sk = ready[ready.length - 1];
      if (!sk) {
        sfxDeny();
        set({ toast: "Nenhuma habilidade pronta." });
        return;
      }
      player.skillCd[sk.id] = sk.cd;
      if (sk.id === "rite") {
        const heal = Math.round(player.maxHp * 0.35);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        sfxHeal();
        spawnFloater(`+${heal}`, "#c8d5c0", 0.28, 0.62);
        log = `${sk.name}: +${heal} vida.`;
      } else {
        sfxSwing();
        const { dmg, crit } = rollDmg(player.atk, scaled.def, rng, {
          mult: sk.id === "heavy" ? 1.8 : 1,
          pierce: sk.id === "pierce" ? 0.5 : 0,
          crit: relic?.crit ?? 0,
        });
        enemy.hp -= dmg;
        heavy = sk.id === "heavy";
        sfxHit(heavy);
        addTrauma(heavy ? 0.55 : 0.4);
        hitstop(heavy ? 70 : 45);
        playImpact(0.52);
        spawnFloater(`${crit ? "CRÍTICO " : ""}${dmg}`, crit ? "#ece8e1" : "#d4c4b0", 0.55, 0.34);
        if (relic?.lifesteal) {
          const ls = Math.max(1, Math.round(dmg * relic.lifesteal));
          player.hp = Math.min(player.maxHp, player.hp + ls);
        }
        log = `${sk.name}: ${dmg} de dano.`;
      }
    } else {
      sfxSwing();
      const { dmg, crit } = rollDmg(player.atk, scaled.def, rng, { crit: relic?.crit ?? 0 });
      enemy.hp -= dmg;
      sfxHit(false);
      addTrauma(0.35);
      hitstop(40);
      playImpact(0.52);
      spawnFloater(`${crit ? "CRÍTICO " : ""}${dmg}`, crit ? "#ece8e1" : "#d4c4b0", 0.55, 0.34);
      if (relic?.lifesteal) {
        const ls = Math.max(1, Math.round(dmg * relic.lifesteal));
        player.hp = Math.min(player.maxHp, player.hp + ls);
      }
      log = `Você golpeia: ${dmg}.`;
    }

    for (const k of Object.keys(player.skillCd)) {
      if (kind === "skill" && player.skillCd[k] === SKILLS.find((x) => x.id === k)?.cd) continue;
      player.skillCd[k] = Math.max(0, (player.skillCd[k] ?? 0) - 1);
    }

    const enemies = s.dungeon.enemies.map((e) => (e.id === enemy.id ? { ...enemy } : e));
    const dungeon = { ...s.dungeon, enemies };

    if (enemy.hp <= 0) {
      winCombat(set, get, { ...s, player, dungeon, combat: { ...s.combat, log, defending: kind === "defend" } });
      return;
    }

    set({
      player,
      dungeon,
      combat: {
        ...s.combat,
        log,
        phase: "enemy",
        defending: kind === "defend",
        turn: s.combat.turn + 1,
      },
    });
    if (enemyTimer) clearTimeout(enemyTimer);
    enemyTimer = setTimeout(() => get().enemyAct(), 620);
  },

  enemyAct: () => {
    const s = get();
    if (!s.combat || s.combat.phase !== "enemy" || !s.dungeon) return;
    const enemy = s.dungeon.enemies.find((e) => e.id === s.combat!.enemyId);
    if (!enemy) return;
    const def = ENEMIES[enemy.kind]!;
    const scaled = scaleEnemy(def, s.floor);
    const rng = rngFor(s.seed + s.combat.turn * 31, s.floor);
    const slam = enemy.isBoss && s.combat.turn % 3 === 0;
    const { dmg: raw } = rollDmg(scaled.atk, s.player.def, rng, { mult: slam ? 1.7 : 1 });
    const dmg = s.combat.defending ? Math.max(1, Math.floor(raw * 0.4)) : raw;
    let player = { ...s.player, hp: s.player.hp - dmg };
    addTrauma(0.45);
    addFlash(0.4);
    hitstop(50);
    sfxHit(slam);
    spawnFloater(`-${dmg}`, "#c45c4c", 0.3, 0.58);
    const log = slam ? `${def.name} desfere um golpe brutal: ${dmg}.` : `${def.name} ataca: ${dmg}.`;
    if (player.hp <= 0) {
      player.hp = 0;
      sfxDeath();
      set({ player, screen: "dead", combat: null, toast: "A cripta fecha os olhos." });
      clearSave();
      set({ hasSave: false });
      return;
    }
    set({
      player,
      combat: { ...s.combat, log, phase: "player", defending: false },
    });
  },

  collectLoot: () => {
    const s = get();
    if (!s.loot) {
      set({ screen: "playing" });
      return;
    }
    if (s.loot.source === "stairs") {
      set({ loot: null });
      get().descend();
      return;
    }
    sfxChest();
    set({ loot: null, screen: "playing", toast: "Tomado." });
    scheduleSave(get);
  },

  cancelLoot: () => {
    const s = get();
    if (s.loot?.source === "stairs") {
      set({ loot: null, screen: "playing" });
      return;
    }
    if (s.loot) {
      get().collectLoot();
      return;
    }
    set({ loot: null, screen: "playing" });
  },

  descend: () => {
    const s = get();
    if (!s.dungeon) return;
    sfxWin();
    const next = s.floor + 1;
    const { player, dungeon } = makeFloor(s.seed, next, s.player);
    set({
      floor: next,
      player,
      dungeon,
      screen: "playing",
      combat: null,
      loot: null,
      toast: next === 6 ? "O abismo não tem fundo." : `Andar ${next}.`,
      animating: false,
    });
    persistNow(get());
  },

  toggleMute: () => {
    const muted = !get().muted;
    setMuted(muted);
    writeSettings({ muted, shake: get().shake });
    set({ muted });
  },

  toggleShake: () => {
    const shake = !get().shake;
    writeSettings({ muted: get().muted, shake });
    set({ shake });
  },

  dismissToast: () => set({ toast: "" }),
  ackHelp: () => {
    set({ screen: "playing", seenHelp: true });
    persistNow(get());
  },
}));

function startCombat(
  set: (p: Partial<GameStore>) => void,
  get: () => GameStore,
  enemyId: string,
) {
  const s = get();
  if (!s.dungeon) return;
  const e = s.dungeon.enemies.find((x) => x.id === enemyId);
  if (!e) return;
  const def = ENEMIES[e.kind];
  unlockAudio();
  sfxDeny();
  addTrauma(0.25);
  set({
    screen: "combat",
    animating: false,
    combat: {
      enemyId,
      log: `${def?.name ?? "Inimigo"} avança.`,
      phase: "player",
      defending: false,
      turn: 0,
    },
  });
}

function openChest(
  set: (p: Partial<GameStore>) => void,
  get: () => GameStore,
  id: string,
) {
  const s = get();
  if (!s.dungeon) return;
  const rng = rngFor(s.seed + id.length * 13, s.floor);
  const loot = chestLoot(rng, s.floor, s.player);
  const dungeon = {
    ...s.dungeon,
    chests: s.dungeon.chests.map((c) => (c.id === id ? { ...c, open: true } : c)),
  };
  const player = applyLootToPlayer(s.player, loot);
  sfxChest();
  set({ dungeon, player, loot, screen: "loot", toast: "" });
  scheduleSave(get);
}

function winCombat(
  set: (p: Partial<GameStore>) => void,
  get: () => GameStore,
  s: { player: Player; dungeon: Dungeon; combat: CombatState },
) {
  const enemy = s.dungeon.enemies.find((e) => e.id === s.combat.enemyId)!;
  const def = ENEMIES[enemy.kind]!;
  const scaled = scaleEnemy(def, get().floor);
  const enemies = s.dungeon.enemies.map((e) =>
    e.id === enemy.id ? { ...e, alive: false, hp: 0 } : e,
  );
  const dungeon = { ...s.dungeon, enemies };
  let player = { ...s.player, xp: s.player.xp + scaled.xp, kills: s.player.kills + 1 };
  const up = levelUp(player);
  player = up.player;
  sfxWin();
  addFlash(0.3);
  spawnFloater(`+${scaled.xp} XP`, "#ece8e1", 0.5, 0.3);
  const loot: LootOffer = {
    gold: scaled.gold,
    potions: enemy.isBoss || Math.random() < 0.2 ? 1 : 0,
    flasks: enemy.isBoss && get().floor >= 4 ? 1 : 0,
    keys: 0,
    itemId: enemy.isBoss ? bossDrop(get().floor) : null,
    replaced: null,
    source: enemy.isBoss ? "boss" : "kill",
  };
  if (loot.itemId) {
    const it = ITEMS[loot.itemId]!;
    const cur = it.slot === "weapon" ? player.weapon : it.slot === "armor" ? player.armor : player.relic;
    loot.replaced = cur && cur !== it.id ? cur : null;
  }
  player = applyLootToPlayer(player, loot);
  const msg = `${def.name} cai. ${up.msg}`.trim();
  set({
    player,
    dungeon,
    combat: null,
    loot,
    screen: "loot",
    toast: msg,
  });
  persistNow({ ...get(), player, dungeon });
}

function bossDrop(floor: number): string {
  if (floor >= 5) return "kingmail";
  if (floor >= 4) return "grave";
  if (floor >= 3) return "plate";
  if (floor >= 2) return "bone";
  return "short";
}

if (typeof window !== "undefined") {
  const flush = () => {
    const s = useGame.getState();
    if (s.dungeon && s.screen !== "title" && s.screen !== "dead") persistNow(s);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
