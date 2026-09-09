export interface Floater {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  born: number;
  life: number;
}

export interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
}

let nid = 1;

export const juice = {
  trauma: 0,
  flash: 0,
  hitstopUntil: 0,
  shakeX: 0,
  shakeY: 0,
  floaters: [] as Floater[],
  embers: [] as Ember[],
  fxFrame: -1,
  fxUntil: 0,
  fxX: 0.5,
  reduced: false,
};

export function addTrauma(n: number) {
  if (juice.reduced) return;
  juice.trauma = Math.min(1, juice.trauma + n);
}

export function addFlash(n: number) {
  juice.flash = Math.min(1, juice.flash + n);
}

export function hitstop(ms: number) {
  if (juice.reduced) return;
  juice.hitstopUntil = Math.max(juice.hitstopUntil, performance.now() + ms);
}

export function spawnFloater(text: string, color: string, x = 0.5, y = 0.38) {
  juice.floaters.push({
    id: nid++,
    text,
    color,
    x,
    y,
    born: performance.now(),
    life: 780,
  });
}

export function playImpact(x = 0.5) {
  juice.fxFrame = 0;
  juice.fxUntil = performance.now() + 280;
  juice.fxX = x;
}

export function burstEmbers(n: number, w: number, h: number) {
  for (let i = 0; i < n; i++) {
    juice.embers.push({
      x: Math.random() * w,
      y: h * (0.55 + Math.random() * 0.4),
      vx: (Math.random() - 0.5) * 18,
      vy: -20 - Math.random() * 40,
      life: 1,
      max: 1.2 + Math.random() * 1.4,
      r: 1 + Math.random() * 1.8,
    });
  }
}

export function tickJuice(dt: number, t: number, allowShake: boolean) {
  juice.trauma = Math.max(0, juice.trauma - dt * 1.8);
  juice.flash = Math.max(0, juice.flash - dt * 2.6);
  const shake = allowShake && !juice.reduced ? juice.trauma * juice.trauma : 0;
  juice.shakeX = shake * (Math.sin(t * 53) * 10 + Math.sin(t * 21) * 4);
  juice.shakeY = shake * (Math.cos(t * 47) * 8 + Math.sin(t * 17) * 3);

  const now = performance.now();
  juice.floaters = juice.floaters.filter((f) => now - f.born < f.life);

  if (juice.fxFrame >= 0) {
    const p = 1 - (juice.fxUntil - now) / 280;
    juice.fxFrame = p >= 1 ? -1 : Math.min(3, Math.floor(p * 4));
  }

  for (const e of juice.embers) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vy += 18 * dt;
    e.life -= dt / e.max;
  }
  juice.embers = juice.embers.filter((e) => e.life > 0);
}

export function isHitstop(): boolean {
  return performance.now() < juice.hitstopUntil;
}
