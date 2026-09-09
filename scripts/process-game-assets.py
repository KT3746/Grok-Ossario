#!/usr/bin/env python3
"""Chroma-key, trim, slice, and seamless-fix game art into public/game/."""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ART = Path("/workspace/artifacts/imagine_images")
OUT = Path("/workspace/public/game")
OUT.mkdir(parents=True, exist_ok=True)

WALL = ART / "92bca52a-0a2c-4ba8-8813-c5872e6e68a2.jpg"
FLOOR = ART / "4b6bf4e4-2ae9-443b-9680-fe2c1b9cd1ef.jpg"
DOOR = ART / "c9e5c4e8-21e4-453b-abbe-fad6174eab12.jpg"
TITLE = ART / "a163ca25-05f5-4fc5-898b-78acb0d536ba.jpg"
HERO = ART / "2be2b2d9-6a16-479e-8100-f71a8220392a.jpg"
SKELETON = ART / "11f5d46d-c4e8-49ed-9ddc-7038a5c10f31.jpg"
WRAITH = ART / "54ede3aa-6646-428a-b820-b83a6bf3de65.jpg"
CULTIST = ART / "943fa99f-3e8a-4e53-aa35-bc37972fb74e.jpg"
CRAWLER = ART / "e1506c9d-ba69-4fbd-96ce-eff9a624e197.jpg"
BONE_KING = ART / "92519cb7-2c3f-488e-9d30-2e96b6075707.jpg"
DEAD_KING = ART / "82d50c4b-9acb-464a-a05d-c5b3f86af596.jpg"
CHEST = ART / "8f85b032-ef3b-43f9-a97d-d708b0e97d49.jpg"
CHEST_OPEN = ART / "1daf7ead-820d-438d-bf82-fd6174c4cea8.jpg"
STAIRS = ART / "d57bde7c-c675-407f-a21c-01834ed20267.jpg"
FX = ART / "18908f58-a842-41f8-86bb-b4d4b796e647.jpg"
ITEMS = ART / "65b2f506-d95f-4731-ad87-8c85606437a8.jpg"


def make_seamless(im: Image.Image, band: int = 80) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    rolled = ImageChops.offset(im, w // 2, h // 2)
    blur = rolled.filter(ImageFilter.GaussianBlur(radius=7))
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rectangle((w // 2 - band, 0, w // 2 + band, h), fill=255)
    d.rectangle((0, h // 2 - band, w, h // 2 + band), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(band // 2))
    return Image.composite(blur, rolled, mask)


def chroma_magenta(im: Image.Image) -> Image.Image:
    rgba = np.array(im.convert("RGBA")).astype(np.float32)
    r, g, b = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
    dist = np.sqrt((r - 255.0) ** 2 + (g - 0.0) ** 2 + (b - 255.0) ** 2)
    cg = (r + b) * 0.5 - g  # magenta chroma
    # Fully key close-to-key and strong magenta chroma
    full = (dist < 165) | ((cg > 48) & (g < 175) & (r > 90) & (b > 90))
    # Soft fringe
    soft = np.clip((200 - dist) / 55.0, 0, 1) * 0.85
    magness = np.clip(cg / 70.0, 0, 1)
    key = np.where(full, 1.0, np.clip(np.maximum(soft, magness * 0.55), 0, 1))
    alpha = (1.0 - key) * 255.0
    excess = np.maximum(0.0, np.minimum(r, b) - g)
    rgba[:, :, 0] = np.clip(r - excess * 0.7, 0, 255)
    rgba[:, :, 2] = np.clip(b - excess * 0.7, 0, 255)
    rgba[:, :, 3] = alpha
    # Despeckle leftover magenta islands
    a = rgba[:, :, 3]
    leftover = (cg > 35) & (g < 160) & (a > 0)
    rgba[:, :, 3] = np.where(leftover, a * 0.05, a)
    # Kill isolated specks: if 8-neighbors are mostly transparent, drop
    a = rgba[:, :, 3]
    pad = np.pad(a, 1, mode="edge")
    neigh = (
        pad[0:-2, 0:-2] + pad[0:-2, 1:-1] + pad[0:-2, 2:]
        + pad[1:-1, 0:-2] + pad[1:-1, 2:]
        + pad[2:, 0:-2] + pad[2:, 1:-1] + pad[2:, 2:]
    ) / 8.0
    rgba[:, :, 3] = np.where((a < 90) & (neigh < 40), 0, a)
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def trim_alpha(im: Image.Image, pad: int = 10, max_h: int = 900) -> Image.Image:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return im
    l, r = int(xs.min()), int(xs.max())
    t, b = int(ys.min()), int(ys.max())
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width - 1, r + pad)
    b = min(im.height - 1, b + pad)
    crop = im.crop((l, t, r + 1, b + 1))
    if crop.height > max_h:
        ratio = max_h / crop.height
        crop = crop.resize((max(1, int(crop.width * ratio)), max_h), Image.Resampling.LANCZOS)
    return crop


def save_png(im: Image.Image, name: str) -> None:
    path = OUT / name
    im.save(path, "PNG", optimize=True)
    print(f"  {name} {im.size}")


def process_sprite(src: Path, name: str, max_h: int = 900) -> Image.Image:
    keyed = chroma_magenta(Image.open(src))
    trimmed = trim_alpha(keyed, pad=12, max_h=max_h)
    save_png(trimmed, name)
    return trimmed


def slice_grid(src: Path, rows: int, cols: int, names: list[str], max_h: int = 256) -> None:
    im = chroma_magenta(Image.open(src))
    w, h = im.size
    cw, ch = w / cols, h / rows
    for i, name in enumerate(names):
        row, col = divmod(i, cols)
        # wait names are row-major: i = row*cols + col
        row = i // cols
        col = i % cols
        box = (
            int(col * cw),
            int(row * ch),
            int((col + 1) * cw),
            int((row + 1) * ch),
        )
        cell = trim_alpha(im.crop(box), pad=8, max_h=max_h)
        save_png(cell, name)


def hero_bust(hero: Image.Image) -> None:
    w, h = hero.size
    bust = hero.crop((0, 0, w, int(h * 0.48)))
    bust = trim_alpha(bust, pad=6, max_h=420)
    save_png(bust, "hero-bust.png")


def main() -> None:
    print("textures")
    wall = make_seamless(Image.open(WALL).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS), 90)
    floor = make_seamless(Image.open(FLOOR).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS), 90)
    wall.save(OUT / "wall.jpg", "JPEG", quality=88)
    floor.save(OUT / "floor.jpg", "JPEG", quality=88)
    door = Image.open(DOOR).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    door.save(OUT / "door.jpg", "JPEG", quality=88)
    title = Image.open(TITLE).convert("RGB")
    title.save(OUT / "title.jpg", "JPEG", quality=90)
    print("  wall/floor/door/title")

    print("characters")
    hero = process_sprite(HERO, "hero.png", 920)
    hero_bust(hero)
    process_sprite(SKELETON, "skeleton.png", 880)
    process_sprite(WRAITH, "wraith.png", 880)
    process_sprite(CULTIST, "cultist.png", 880)
    process_sprite(CRAWLER, "crawler.png", 780)
    process_sprite(BONE_KING, "bone-king.png", 980)
    process_sprite(DEAD_KING, "dead-king.png", 980)

    print("props")
    process_sprite(CHEST, "chest.png", 420)
    process_sprite(CHEST_OPEN, "chest-open.png", 480)
    process_sprite(STAIRS, "stairs.png", 520)

    print("items")
    slice_grid(
        ITEMS,
        3,
        3,
        [
            "item-potion.png",
            "item-flask.png",
            "item-key.png",
            "item-sword.png",
            "item-bone.png",
            "item-shield.png",
            "item-helm.png",
            "item-ring.png",
            "item-chest.png",
        ],
        280,
    )

    print("fx")
    slice_grid(FX, 2, 2, ["fx-0.png", "fx-1.png", "fx-2.png", "fx-3.png"], 220)
    print("done")


if __name__ == "__main__":
    main()
