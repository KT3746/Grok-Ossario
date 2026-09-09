export interface GameAssets {
  wall: HTMLImageElement;
  floor: HTMLImageElement;
  door: HTMLImageElement;
  title: HTMLImageElement;
  sprites: Record<string, HTMLImageElement>;
  ready: boolean;
}

const SPRITE_NAMES = [
  "hero",
  "hero-bust",
  "skeleton",
  "wraith",
  "cultist",
  "crawler",
  "bone-king",
  "dead-king",
  "chest",
  "chest-open",
  "stairs",
  "item-potion",
  "item-flask",
  "item-key",
  "item-sword",
  "item-bone",
  "item-shield",
  "item-helm",
  "item-ring",
  "item-chest",
  "fx-0",
  "fx-1",
  "fx-2",
  "fx-3",
] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`fail ${src}`));
    img.src = src;
  });
}

let cache: GameAssets | null = null;
let pending: Promise<GameAssets> | null = null;

export function loadAssets(): Promise<GameAssets> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    const [wall, floor, door, title, ...sprites] = await Promise.all([
      loadImage("/game/wall.jpg"),
      loadImage("/game/floor.jpg"),
      loadImage("/game/door.jpg"),
      loadImage("/game/title.jpg"),
      ...SPRITE_NAMES.map((n) => loadImage(`/game/${n}.png`)),
    ]);
    const map: Record<string, HTMLImageElement> = {};
    SPRITE_NAMES.forEach((n, i) => {
      map[n] = sprites[i]!;
    });
    cache = { wall, floor, door, title, sprites: map, ready: true };
    return cache;
  })();
  return pending;
}

export function getAssets(): GameAssets | null {
  return cache;
}
