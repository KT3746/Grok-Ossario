import type { EnemyDef, ItemDef, SkillDef } from "./types";

export const APP_NAME = "OSSÁRIO";

export const FLOOR_NAMES = [
  "Cripta inferior",
  "Galeria dos ossos",
  "Nave dos cultos",
  "Câmara do trono",
  "Ossário real",
];

export function floorName(floor: number): string {
  if (floor <= 5) return FLOOR_NAMES[floor - 1] ?? `Andar ${floor}`;
  return `Abismo ${floor - 5}`;
}

export const SKILLS: SkillDef[] = [
  {
    id: "heavy",
    name: "Golpe pesado",
    desc: "Causa 180% de dano. Recarga 2 turnos.",
    cd: 2,
    unlock: 2,
  },
  {
    id: "pierce",
    name: "Fio de osso",
    desc: "Ignora metade da defesa. Recarga 2 turnos.",
    cd: 2,
    unlock: 4,
  },
  {
    id: "rite",
    name: "Rito das cinzas",
    desc: "Recupera 35% da vida. Recarga 3 turnos.",
    cd: 3,
    unlock: 6,
  },
];

export const ITEMS: Record<string, ItemDef> = {
  rusty: {
    id: "rusty",
    slot: "weapon",
    name: "Adaga enferrujada",
    desc: "Ainda corta, por pouco.",
    atk: 1,
    def: 0,
    hp: 0,
    crit: 0,
    lifesteal: 0,
    icon: "item-sword",
    minFloor: 1,
  },
  short: {
    id: "short",
    slot: "weapon",
    name: "Espada curta",
    desc: "Ferro honesto de cripta.",
    atk: 3,
    def: 0,
    hp: 0,
    crit: 0,
    lifesteal: 0,
    icon: "item-sword",
    minFloor: 1,
  },
  bone: {
    id: "bone",
    slot: "weapon",
    name: "Lâmina óssea",
    desc: "Afiada no fêmur de um rei.",
    atk: 5,
    def: 0,
    hp: 0,
    crit: 0,
    lifesteal: 0,
    icon: "item-bone",
    minFloor: 2,
  },
  grave: {
    id: "grave",
    slot: "weapon",
    name: "Gume do túmulo",
    desc: "O peso de um século de enterros.",
    atk: 8,
    def: 0,
    hp: 0,
    crit: 0.05,
    lifesteal: 0,
    icon: "item-bone",
    minFloor: 4,
  },
  rags: {
    id: "rags",
    slot: "armor",
    name: "Trapos de linho",
    desc: "Melhor que a pele nua.",
    atk: 0,
    def: 1,
    hp: 0,
    crit: 0,
    lifesteal: 0,
    icon: "item-helm",
    minFloor: 1,
  },
  mail: {
    id: "mail",
    slot: "armor",
    name: "Cota gasta",
    desc: "Elos faltando, ainda segura.",
    atk: 0,
    def: 3,
    hp: 0,
    crit: 0,
    lifesteal: 0,
    icon: "item-shield",
    minFloor: 1,
  },
  plate: {
    id: "plate",
    slot: "armor",
    name: "Placa de osso",
    desc: "Costelas de gigante, polidas.",
    atk: 0,
    def: 5,
    hp: 4,
    crit: 0,
    lifesteal: 0,
    icon: "item-helm",
    minFloor: 3,
  },
  kingmail: {
    id: "kingmail",
    slot: "armor",
    name: "Manto real",
    desc: "O último tecido do rei morto.",
    atk: 0,
    def: 8,
    hp: 8,
    crit: 0,
    lifesteal: 0,
    icon: "item-shield",
    minFloor: 5,
  },
  ring: {
    id: "ring",
    slot: "relic",
    name: "Sinete de cinzas",
    desc: "+8 de vida máxima.",
    atk: 0,
    def: 0,
    hp: 8,
    crit: 0,
    lifesteal: 0,
    icon: "item-ring",
    minFloor: 1,
  },
  raven: {
    id: "raven",
    slot: "relic",
    name: "Olho de corvo",
    desc: "20% de acerto crítico.",
    atk: 1,
    def: 0,
    hp: 0,
    crit: 0.2,
    lifesteal: 0,
    icon: "item-ring",
    minFloor: 2,
  },
  heart: {
    id: "heart",
    slot: "relic",
    name: "Coração pétreo",
    desc: "15% de roubo de vida.",
    atk: 0,
    def: 1,
    hp: 0,
    crit: 0,
    lifesteal: 0.15,
    icon: "item-ring",
    minFloor: 4,
  },
};

export const ENEMIES: Record<string, EnemyDef> = {
  crawler: {
    id: "crawler",
    name: "Rastejante",
    sprite: "crawler",
    hp: 10,
    atk: 6,
    def: 0,
    spd: 8,
    xp: 6,
    gold: 3,
    scale: 0.72,
  },
  skeleton: {
    id: "skeleton",
    name: "Ossudo",
    sprite: "skeleton",
    hp: 16,
    atk: 5,
    def: 2,
    spd: 4,
    xp: 9,
    gold: 5,
    scale: 1,
  },
  wraith: {
    id: "wraith",
    name: "Espectro",
    sprite: "wraith",
    hp: 18,
    atk: 7,
    def: 1,
    spd: 7,
    xp: 13,
    gold: 7,
    scale: 1.08,
  },
  cultist: {
    id: "cultist",
    name: "Cultista",
    sprite: "cultist",
    hp: 20,
    atk: 8,
    def: 2,
    spd: 5,
    xp: 16,
    gold: 9,
    scale: 1,
  },
  "bone-king": {
    id: "bone-king",
    name: "Rei de Ossos",
    sprite: "bone-king",
    hp: 52,
    atk: 10,
    def: 4,
    spd: 3,
    xp: 48,
    gold: 36,
    scale: 1.28,
    isBoss: true,
  },
  "dead-king": {
    id: "dead-king",
    name: "O Rei Morto",
    sprite: "dead-king",
    hp: 86,
    atk: 14,
    def: 6,
    spd: 4,
    xp: 90,
    gold: 80,
    scale: 1.36,
    isBoss: true,
  },
};

export function xpToNext(level: number): number {
  return 10 + level * 12;
}

export function floorMobs(floor: number): string[] {
  if (floor <= 1) return ["crawler", "crawler", "skeleton"];
  if (floor === 2) return ["skeleton", "crawler", "wraith"];
  if (floor === 3) return ["wraith", "cultist", "skeleton"];
  if (floor === 4) return ["cultist", "wraith", "skeleton"];
  return ["cultist", "wraith", "cultist"];
}

export function floorBoss(floor: number): string {
  if (floor <= 3) return "bone-king";
  return "dead-king";
}

export function scaleEnemy(def: EnemyDef, floor: number) {
  const t = 1 + 0.22 * (floor - 1);
  return {
    hp: Math.round(def.hp * t),
    atk: def.atk + Math.floor((floor - 1) * 0.8),
    def: def.def + Math.floor((floor - 1) * 0.35),
    xp: Math.round(def.xp * (1 + 0.15 * (floor - 1))),
    gold: Math.round(def.gold * (1 + 0.2 * (floor - 1))),
  };
}
