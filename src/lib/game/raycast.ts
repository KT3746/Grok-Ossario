import type { GameAssets } from "./assets";
import { ENEMIES, ITEMS } from "./content";
import { getTile } from "./dungeon";
import { juice } from "./juice";
import { TILE_DOOR, TILE_LOCKED, TILE_WALL, type Dungeon, type Player } from "./types";

export interface Cam {
  x: number;
  y: number;
  ang: number;
}

const TINTS: [number, number, number][] = [
  [1, 0.96, 0.88],
  [0.86, 0.9, 1],
  [0.86, 0.98, 0.88],
  [1, 0.9, 0.8],
  [1, 0.78, 0.74],
];

let zBuf: Float32Array | null = null;
let floorCanvas: HTMLCanvasElement | null = null;
let floorCtx: CanvasRenderingContext2D | null = null;
let floorData: ImageData | null = null;
let texCache = new WeakMap<HTMLImageElement, ImageData>();

function texPixels(img: HTMLImageElement): ImageData {
  let d = texCache.get(img);
  if (d) return d;
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  d = g.getImageData(0, 0, img.width, img.height);
  texCache.set(img, d);
  return d;
}

function sample(d: ImageData, u: number, v: number): [number, number, number] {
  const x = ((u % 1) + 1) % 1;
  const y = ((v % 1) + 1) % 1;
  const ix = (x * (d.width - 1)) | 0;
  const iy = (y * (d.height - 1)) | 0;
  const i = (iy * d.width + ix) << 2;
  return [d.data[i]!, d.data[i + 1]!, d.data[i + 2]!];
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  dungeon: Dungeon,
  player: Player,
  assets: GameAssets,
  t: number,
  floor: number,
  combatId: string | null,
) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  juice.reduced = reduced;

  if (!zBuf || zBuf.length !== w) zBuf = new Float32Array(w);

  ctx.save();
  ctx.translate(juice.shakeX, juice.shakeY);

  const dirX = Math.cos(cam.ang);
  const dirY = Math.sin(cam.ang);
  const fov = 0.66;
  const planeX = -dirY * fov;
  const planeY = dirX * fov;
  const posX = cam.x;
  const posY = cam.y;
  const tint = TINTS[(floor - 1) % TINTS.length]!;
  const flicker = reduced ? 1 : 0.9 + 0.08 * Math.sin(t * 7.2) + 0.04 * Math.sin(t * 13.1);

  // ceiling
  const sky = ctx.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, "#070605");
  sky.addColorStop(1, "#1a1512");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h / 2);

  // floor gradient fallback then texture
  const ground = ctx.createLinearGradient(0, h / 2, 0, h);
  ground.addColorStop(0, "#1a1512");
  ground.addColorStop(1, "#0c0a08");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h / 2, w, h / 2);

  const fw = Math.max(120, w >> 1);
  const fh = Math.max(70, h >> 2);
  if (!floorCanvas || floorCanvas.width !== fw || floorCanvas.height !== fh) {
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = fw;
    floorCanvas.height = fh;
    floorCtx = floorCanvas.getContext("2d");
    floorData = floorCtx ? floorCtx.createImageData(fw, fh) : null;
  }
  const fpx = texPixels(assets.floor);
  if (floorData && floorCtx) {
    const data = floorData.data;
    const posZ = 0.5 * (h / (h / 2));
    for (let y = 0; y < fh; y++) {
      const sy = h / 2 + ((y + 0.5) / fh) * (h / 2);
      const rowDist = posZ / Math.max(0.08, (sy - h / 2) / (h / 2));
      const stepX = (rowDist * (dirX + planeX - (dirX - planeX))) / fw;
      const stepY = (rowDist * (dirY + planeY - (dirY - planeY))) / fw;
      let floorX = posX + rowDist * (dirX - planeX);
      let floorY = posY + rowDist * (dirY - planeY);
      const fog = Math.min(1, rowDist / 12);
      const light = flicker * (1 - fog) * 0.85;
      for (let x = 0; x < fw; x++) {
        const [r, g, b] = sample(fpx, floorX, floorY);
        const i = (y * fw + x) << 2;
        data[i] = r * tint[0] * light;
        data[i + 1] = g * tint[1] * light;
        data[i + 2] = b * tint[2] * light;
        data[i + 3] = 255;
        floorX += stepX;
        floorY += stepY;
      }
    }
    floorCtx.putImageData(floorData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(floorCanvas, 0, h / 2, w, h / 2);
  }

  const wallPx = texPixels(assets.wall);
  const doorPx = texPixels(assets.door);

  for (let x = 0; x < w; x++) {
    const cameraX = (2 * x) / w - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;
    let mapX = posX | 0;
    let mapY = posY | 0;
    const deltaDistX = Math.abs(1 / (rayDirX || 1e-8));
    const deltaDistY = Math.abs(1 / (rayDirY || 1e-8));
    let stepX: number, stepY: number, sideDistX: number, sideDistY: number;
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (posX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - posX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (posY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - posY) * deltaDistY;
    }
    let hit = 0;
    let side = 0;
    let tile = TILE_WALL;
    for (let i = 0; i < 28; i++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      tile = getTile(dungeon, mapX, mapY);
      if (tile === TILE_WALL || tile === TILE_DOOR || tile === TILE_LOCKED) {
        hit = 1;
        break;
      }
    }
    if (!hit) {
      zBuf[x] = 100;
      continue;
    }
    const perp =
      side === 0 ? (mapX - posX + (1 - stepX) / 2) / rayDirX : (mapY - posY + (1 - stepY) / 2) / rayDirY;
    const dist = Math.max(0.12, Math.abs(perp));
    zBuf[x] = dist;
    const lineH = (h / dist) | 0;
    let drawStart = ((h - lineH) / 2) | 0;
    let drawEnd = ((h + lineH) / 2) | 0;
    if (drawStart < 0) drawStart = 0;
    if (drawEnd >= h) drawEnd = h - 1;
    let wallX = side === 0 ? posY + perp * rayDirY : posX + perp * rayDirX;
    wallX -= Math.floor(wallX);
    const src = tile === TILE_WALL ? wallPx : doorPx;
    const texX = (wallX * src.width) | 0;
    const fog = Math.min(1, dist / 13);
    const shade = (side === 1 ? 0.72 : 0.96) * flicker * (1 - fog * 0.78);
    const colH = drawEnd - drawStart;
    // sample a vertical strip into a 1px canvas via drawImage of the jpg
    const img = tile === TILE_WALL ? assets.wall : assets.door;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(img, texX, 0, 1, img.height, x, drawStart, 1, colH);
    ctx.fillStyle = `rgba(${(10 * tint[0]) | 0},${(9 * tint[1]) | 0},${(8 * tint[2]) | 0},${1 - shade})`;
    ctx.fillRect(x, drawStart, 1, colH);
    ctx.restore();
  }

  type Bill = { x: number; y: number; img: HTMLImageElement; scale: number; dist: number };
  const bills: Bill[] = [];
  const stairsImg = assets.sprites["stairs"];
  if (stairsImg) {
    const dx = dungeon.stairsX + 0.5 - posX;
    const dy = dungeon.stairsY + 0.5 - posY;
    bills.push({
      x: dungeon.stairsX + 0.5,
      y: dungeon.stairsY + 0.5,
      img: stairsImg,
      scale: 0.85,
      dist: dx * dx + dy * dy,
    });
  }
  for (const c of dungeon.chests) {
    const img = assets.sprites[c.open ? "chest-open" : "chest"];
    if (!img) continue;
    const dx = c.x + 0.5 - posX;
    const dy = c.y + 0.5 - posY;
    bills.push({ x: c.x + 0.5, y: c.y + 0.5, img, scale: 0.55, dist: dx * dx + dy * dy });
  }
  for (const e of dungeon.enemies) {
    if (!e.alive) continue;
    const def = ENEMIES[e.kind];
    const img = assets.sprites[def?.sprite ?? e.kind];
    if (!img) continue;
    const dx = e.x + 0.5 - posX;
    const dy = e.y + 0.5 - posY;
    const boost = combatId === e.id ? 1.12 : 1;
    bills.push({
      x: e.x + 0.5,
      y: e.y + 0.5,
      img,
      scale: (def?.scale ?? 1) * boost,
      dist: dx * dx + dy * dy,
    });
  }
  bills.sort((a, b) => b.dist - a.dist);

    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const wallHAt = (dist: number) => Math.abs(h / dist);
    for (const s of bills) {
      const spriteX = s.x - posX;
      const spriteY = s.y - posY;
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      if (transformY <= 0.12) continue;
      const spriteScreenX = (w / 2) * (1 + transformX / transformY);
      const wallH = wallHAt(transformY);
      let spriteH = wallH * s.scale * 0.62;
      if (spriteH > h * 0.86) spriteH = h * 0.86;
      const spriteW = spriteH * (s.img.width / Math.max(1, s.img.height));
      const floorY = (h / 2 + wallH / 2) | 0;
      const drawStartY = floorY - spriteH;
      const drawStartX = (spriteScreenX - spriteW / 2) | 0;
      const drawEndX = (spriteScreenX + spriteW / 2) | 0;
      const fog = Math.min(1, transformY / 13);
      ctx.save();
      ctx.globalAlpha = 1 - fog * 0.75;
      for (let stripe = Math.max(0, drawStartX); stripe < Math.min(w, drawEndX); stripe++) {
        if (transformY >= (zBuf[stripe] ?? 99)) continue;
        const texX = (((stripe - drawStartX) / Math.max(1, spriteW)) * s.img.width) | 0;
        ctx.drawImage(s.img, texX, 0, 1, s.img.height, stripe, drawStartY, 1, spriteH);
      }
      ctx.restore();
    }

  // embers
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const e of juice.embers) {
    ctx.fillStyle = `rgba(210,140,80,${0.35 * e.life})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // weapon bob
  if (!combatId) {
    const weap = ITEMS[player.weapon];
    const wimg = assets.sprites[weap?.icon ?? "item-sword"];
    if (wimg) {
      const bob = reduced ? 0 : Math.sin(t * 6) * 6;
      const ww = Math.min(96, w * 0.2);
      const wh = ww * (wimg.height / wimg.width);
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.translate(w - ww * 0.72, h - wh * 0.55 + bob);
      ctx.rotate(-0.16);
      ctx.drawImage(wimg, 0, 0, ww, wh);
      ctx.restore();
    }
  }

  // impact fx
  if (juice.fxFrame >= 0) {
    const fx = assets.sprites[`fx-${juice.fxFrame}`];
    if (fx) {
      const size = Math.min(w, h) * 0.42;
      ctx.drawImage(fx, w * juice.fxX - size / 2, h * 0.32 - size / 2, size, size);
    }
  }

  // floaters
  const now = performance.now();
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `600 ${Math.max(14, (h * 0.045) | 0)}px Outfit, sans-serif`;
  for (const f of juice.floaters) {
    const p = (now - f.born) / f.life;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, w * f.x, h * (f.y - p * 0.16));
  }
  ctx.restore();

  // vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.15, w / 2, h * 0.5, h * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(6,5,4,0.72)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  if (juice.flash > 0.02) {
    ctx.fillStyle = `rgba(236,232,225,${juice.flash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}
