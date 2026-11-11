#!/usr/bin/env python3
"""Compose official icon (1:1 512) and cover (3:4 1080x1440) from game atlas."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path("/workspace/mlmg")
OUT = ROOT / "store_art"
ATLAS_PATH = ROOT / "assets" / "atlas_full.png"
META_PATH = ROOT / "dist" / "js" / "atlas_meta.js"

TITLE = "我的关，我的影子"
SLOGAN = "造关留影，等人翻车"
TITLE_COLOR = (90, 61, 34, 255)
ORANGE = (255, 179, 71, 255)
SKY_TOP = (194, 234, 255, 255)
SKY_MID = (214, 240, 255, 255)
SKY_BOT = (255, 250, 240, 255)

FONT_TITLE = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
FONT_SANS = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_SANS_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
SC = 2


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=SC)


def load_atlas():
    text = META_PATH.read_text(encoding="utf-8")
    meta = json.loads(text[text.index("{") : text.rindex("}") + 1])
    atlas = Image.open(ATLAS_PATH).convert("RGBA")
    rects = meta["r"]

    def spr(name: str) -> Image.Image:
        x, y, w, h = rects[name]
        return atlas.crop((x, y, x + w, y + h)).convert("RGBA")

    return spr


def trim(im: Image.Image, pad: int = 0) -> Image.Image:
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    )


def scale(im: Image.Image, factor: float) -> Image.Image:
    w = max(1, int(round(im.width * factor)))
    h = max(1, int(round(im.height * factor)))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def scale_to(im: Image.Image, w: int, h: int) -> Image.Image:
    return im.resize((w, h), Image.Resampling.LANCZOS)


def make_ghost(im: Image.Image, alpha: float = 0.78) -> Image.Image:
    im = im.convert("RGBA")
    out = []
    for r, g, b, a in im.getdata():
        if a == 0:
            out.append((0, 0, 0, 0))
        else:
            nr = int(r * 0.28 + 142 * 0.72)
            ng = int(g * 0.28 + 162 * 0.72)
            nb = int(b * 0.28 + 196 * 0.72)
            out.append((nr, ng, nb, int(a * alpha)))
    im.putdata(out)
    return im


def drop_shadow(im: Image.Image, offset=(8, 10), blur=8, opacity=80) -> Image.Image:
    a = im.split()[-1]
    solid = Image.new("RGBA", im.size, (40, 28, 16, 0))
    solid.putalpha(a.point(lambda p: int(p * opacity / 255)))
    solid = solid.filter(ImageFilter.GaussianBlur(blur))
    canvas = Image.new(
        "RGBA",
        (im.width + abs(offset[0]) + blur * 2, im.height + abs(offset[1]) + blur * 2),
        (0, 0, 0, 0),
    )
    ox = blur + max(0, offset[0])
    oy = blur + max(0, offset[1])
    # shadow is placed relative to the sprite origin on this padded canvas
    canvas.alpha_composite(solid, (ox - max(0, offset[0]) + offset[0], oy - max(0, offset[1]) + offset[1]))
    canvas.alpha_composite(im, (ox, oy))
    return canvas


def paste(base: Image.Image, spr: Image.Image, cx: int, cy: int, anchor="mm"):
    w, h = spr.size
    ax, ay = {
        "mm": (w / 2, h / 2),
        "mb": (w / 2, h),
        "mt": (w / 2, 0),
        "lt": (0, 0),
        "lb": (0, h),
        "rb": (w, h),
        "lm": (0, h / 2),
        "rm": (w, h / 2),
    }[anchor]
    x = int(round(cx - ax))
    y = int(round(cy - ay))
    if x >= base.width or y >= base.height or x + w <= 0 or y + h <= 0:
        return
    sx = 0 if x >= 0 else -x
    sy = 0 if y >= 0 else -y
    dx = max(x, 0)
    dy = max(y, 0)
    cw = min(w - sx, base.width - dx)
    ch = min(h - sy, base.height - dy)
    base.alpha_composite(spr.crop((sx, sy, sx + cw, sy + ch)), (dx, dy))


def sky_bg(size, top=SKY_TOP, bot=SKY_BOT) -> Image.Image:
    w, h = size
    im = Image.new("RGBA", size, top)
    draw = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(h - 1, 1)
        # hold the blue longer, cream only near the bottom
        if t < 0.72:
            u = t / 0.72
            r = int(top[0] * (1 - u) + SKY_MID[0] * u)
            g = int(top[1] * (1 - u) + SKY_MID[1] * u)
            b = int(top[2] * (1 - u) + SKY_MID[2] * u)
        else:
            u = (t - 0.72) / 0.28
            r = int(SKY_MID[0] * (1 - u) + bot[0] * u)
            g = int(SKY_MID[1] * (1 - u) + bot[1] * u)
            b = int(SKY_MID[2] * (1 - u) + bot[2] * u)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
    return im


def stroke_text(draw, xy, text, fnt, fill, stroke, sw, anchor="mm"):
    draw.text(xy, text, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)


def tile_at(spr, name, size):
    return scale_to(spr(name), size, size)


def draw_platform(base, spr, x0, x1, ground_y, fill_to, tile=128):
    """Grass top from x0 to x1, dirt stacked down to fill_to. ground_y is the top of the grass tile."""
    span = x1 - x0
    n = max(1, int(round(span / tile)))
    # recompute exact tile width so it fills the span without gaps
    tw = tile
    # Use caps plus middles; draw by clipping a stitched strip.
    left = tile_at(spr, "gtL", tw)
    mid = tile_at(spr, "gtM", tw)
    right = tile_at(spr, "gtR", tw)
    dirt = tile_at(spr, "dirt", tw)
    bdirt = tile_at(spr, "bdirt", tw)

    strip_w = n * tw
    grass = Image.new("RGBA", (strip_w, tw), (0, 0, 0, 0))
    for i in range(n):
        if n == 1:
            t = mid
        elif i == 0:
            t = left
        elif i == n - 1:
            t = right
        else:
            t = mid
        grass.alpha_composite(t, (i * tw, 0))
    # if span != strip_w, scale width only
    if strip_w != span:
        grass = grass.resize((span, tw), Image.Resampling.LANCZOS)
        dirt = dirt.resize((tw, tw), Image.Resampling.LANCZOS) if False else dirt

    paste(base, grass, x0, ground_y, anchor="lt")
    # These grass tiles already include a dirt underside. Only stack more dirt
    # when the caller really wants a tall cliff.
    if fill_to <= ground_y + tw:
        return

    # dirt below the grass (overlap a few px to hide the grass tile's bottom edge)
    y = ground_y + tw - 18
    row = 0
    while y < fill_to:
        x = x0
        i = 0
        while x < x1:
            piece = dirt if row == 0 else bdirt
            pw = min(tw, x1 - x)
            ph = tw
            if pw < tw:
                piece = piece.crop((0, 0, pw, ph))
            paste(base, piece, x, y, anchor="lt")
            x += tw
            i += 1
        y += tw - 2
        row += 1


def speech_bubble(text: str, fnt, padding=20) -> Image.Image:
    dummy = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    l, t, r, b = dummy.textbbox((0, 0), text, font=fnt)
    tw, th = r - l, b - t
    w, h = tw + padding * 2, th + padding * 2
    im = Image.new("RGBA", (w + 4, h + 26), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    box = (2, 2, w, h)
    draw.rounded_rectangle(box, radius=24, fill=(255, 255, 255, 255), outline=TITLE_COLOR, width=5)
    cx = w // 2 + 1
    draw.polygon([(cx - 16, h - 4), (cx + 16, h - 4), (cx, h + 20)], fill=(255, 255, 255, 255))
    draw.line([(cx - 16, h - 4), (cx, h + 20)], fill=TITLE_COLOR, width=5)
    draw.line([(cx + 16, h - 4), (cx, h + 20)], fill=TITLE_COLOR, width=5)
    draw.polygon([(cx - 11, h - 8), (cx + 11, h - 8), (cx, h + 8)], fill=(255, 255, 255, 255))
    draw.text(((w - tw) / 2 - l + 2, (h - th) / 2 - t + 1), text, font=fnt, fill=TITLE_COLOR)
    return im


def troll_block(spr, size=170) -> Image.Image:
    body = scale_to(spr("dirt"), size, size)
    # a little grass cap so it reads as a falling floor tile
    cap = scale_to(spr("gtM"), size, size).crop((0, 0, size, int(size * 0.38)))
    face = scale(trim(spr("face_f")), size / 55 * 0.72)
    im = Image.new("RGBA", (size + 8, size + 8), (0, 0, 0, 0))
    im.alpha_composite(body, (4, 4))
    im.alpha_composite(cap, (4, 4))
    fx = (im.width - face.width) // 2
    fy = 4 + int(size * 0.38)
    im.alpha_composite(face, (fx, fy))
    return drop_shadow(im, (10, 14), 10, 80)


def build_icon(spr) -> Image.Image:
    s = 512
    im = sky_bg((s, s), SKY_TOP, SKY_MID)

    sun = drop_shadow(scale(trim(spr("sun")), 1.45), (4, 6), 6, 40)
    paste(im, sun, 88, 88)

    cloud = scale(trim(spr("cloud")), 1.05)
    paste(im, cloud, 400, 118)

    ground_y = 348
    tile = 120
    draw_platform(im, spr, 10, s - 10, ground_y, ground_y + tile, tile=tile)

    spikes = drop_shadow(scale(trim(spr("spikes")), 1.45), (3, 4), 4, 50)
    paste(im, spikes, 410, ground_y + 16, anchor="mb")

    portal = scale(trim(spr("portal")), 1.2)
    paste(im, portal, 430, ground_y - 70)

    ghost = make_ghost(trim(spr("run2")))
    ghost = drop_shadow(scale(ghost, 2.2), (6, 8), 7, 40)
    paste(im, ghost, 155, ground_y + 8, anchor="mb")

    hero = drop_shadow(scale(trim(spr("up2")), 2.85), (8, 10), 8, 75)
    paste(im, hero, 295, ground_y + 10, anchor="mb")

    return im.convert("RGB")


def build_cover(spr) -> Image.Image:
    W, H = 1080, 1440
    im = sky_bg((W, H), SKY_TOP, (236, 247, 255, 255))

    # decorative distant clouds / sun in the sky band
    sun = drop_shadow(scale(trim(spr("sun")), 2.05), (6, 8), 8, 45)
    paste(im, sun, 930, 268)
    cloud = scale(trim(spr("cloud")), 1.9)
    paste(im, cloud, 210, 300)
    cloud2 = scale(trim(spr("cloud")), 1.25)
    paste(im, cloud2, 620, 250)

    ground_y = 860
    tile = 168
    panel_top = 1168
    left_end = 430
    right_start = 650
    # floating platforms only; grass tiles already include the dirt underside
    draw_platform(im, spr, 0, left_end, ground_y, ground_y + tile, tile=tile)
    draw_platform(im, spr, right_start, W, ground_y, ground_y + tile, tile=tile)

    spikes = drop_shadow(scale(trim(spr("spikes")), 2.05), (4, 6), 6, 60)
    paste(im, spikes, 540, ground_y + tile - 8, anchor="mb")

    # falling troll block hovering over the pit / jump path
    block = troll_block(spr, 188)
    paste(im, block, 560, 560)

    laugh = scale(trim(spr("emo_laugh")), 2.2)
    paste(im, laugh, 680, 500)

    # ghost already safe on the right, heading into the ring
    ghost = make_ghost(trim(spr("run3")))
    ghost = drop_shadow(scale(ghost, 3.05), (8, 10), 8, 45)
    paste(im, ghost, 820, ground_y + 6, anchor="mb")

    portal = scale(trim(spr("portal")), 1.75)
    paste(im, portal, 960, ground_y - 86)

    # hero leaping off the left cliff, about to get trolled
    hero = drop_shadow(scale(trim(spr("up2")), 3.45), (10, 12), 10, 80)
    paste(im, hero, 390, 680)

    bubble = speech_bubble("看到了还撞？", font(FONT_SANS, 46))
    paste(im, bubble, 390, 455)

    # title
    draw = ImageDraw.Draw(im)
    stroke_text(
        draw,
        (W // 2, 118),
        TITLE,
        font(FONT_TITLE, 88),
        TITLE_COLOR,
        (255, 255, 255, 255),
        8,
        anchor="mm",
    )

    # bottom cream panel
    d = ImageDraw.Draw(im)
    d.rectangle((0, panel_top, W, H), fill=(255, 248, 236, 255))
    d.line([(0, panel_top), (W, panel_top)], fill=(90, 61, 34, 50), width=4)

    slogan_f = font(FONT_SANS, 62)
    bbox = d.textbbox((0, 0), SLOGAN, font=slogan_f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 52, 20
    pill_w, pill_h = tw + pad_x * 2, th + pad_y * 2
    px = (W - pill_w) // 2
    py = panel_top + 48
    d.rounded_rectangle(
        (px, py, px + pill_w, py + pill_h),
        radius=pill_h // 2,
        fill=ORANGE,
        outline=TITLE_COLOR,
        width=6,
    )
    stroke_text(
        draw,
        (W // 2, py + pill_h // 2),
        SLOGAN,
        slogan_f,
        TITLE_COLOR,
        (255, 255, 255, 255),
        4,
        anchor="mm",
    )
    stroke_text(
        draw,
        (W // 2, py + pill_h + 58),
        "自己出坑关，把影子留给下一个人追",
        font(FONT_SANS_REG, 32),
        (110, 84, 58, 255),
        (255, 255, 255, 255),
        2,
        anchor="mm",
    )
    return im.convert("RGB")


def save_checked(im: Image.Image, path: Path, kind: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    if kind == "icon":
        assert im.size[0] == im.size[1] == 512, im.size
    if kind == "cover":
        w, h = im.size
        assert w * 4 == h * 3, im.size
    im.save(path, format="PNG", optimize=True)
    jpg = path.with_suffix(".jpg")
    im.save(jpg, format="JPEG", quality=95, optimize=True, subsampling=0)
    for p in (path, jpg):
        info = Image.open(p)
        print(f"{p.name}: {p.stat().st_size} bytes, {info.size}, {info.format}")


def main():
    spr = load_atlas()
    save_checked(build_icon(spr), OUT / "icon.png", "icon")
    save_checked(build_cover(spr), OUT / "cover.png", "cover")


if __name__ == "__main__":
    main()
