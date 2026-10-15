#!/usr/bin/env python3
"""
twilit 品牌图生成：og.png（社交分享卡片）、apple-touch-icon.png、favicon.svg（纯手写，见同目录 favicon.svg）

用法：python tools/make_brand_assets.py
输出：og.png / apple-touch-icon.png（仓库根目录，随站点一起发布）
"""
import os
from PIL import Image, ImageDraw, ImageFont

BG = (8, 11, 16)
AMBER = (201, 169, 110)
PALE = (232, 213, 176)
DIM = (139, 133, 120)
DEEP = (122, 101, 67)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = r"C:\Windows\Fonts"


def font(name, size):
    for f in name if isinstance(name, (list, tuple)) else [name]:
        p = os.path.join(FONTS, f)
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def tracked(draw, cx, y, text, fnt, fill, tracking=0):
    """带字距的居中绘制（PIL 没有 letter-spacing）"""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking


def glow(img, cx, cy, r, color, peak=42):
    """用同心椭圆叠出一圈柔和辉光（不依赖 numpy）"""
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    steps = 60
    for i in range(steps, 0, -1):
        t = i / steps
        a = int(peak * (1 - t) ** 2)
        if a <= 0:
            continue
        rr = r * t
        d.ellipse([cx - rr, cy - rr * 0.62, cx + rr, cy + rr * 0.62],
                  fill=color + (a,))
    return Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")


def scanlines(img, alpha=7, step=4):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y in range(0, img.height, step):
        d.line([(0, y), (img.width, y)], fill=AMBER + (alpha,), width=1)
    return Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")


def vignette(img, strength=200, blur=150):
    """平滑暗角：中心留亮，四周压暗（用模糊遮罩，避免出现硬边）"""
    from PIL import ImageFilter
    mask = Image.new("L", img.size, 255)
    d = ImageDraw.Draw(mask)
    ix, iy = img.width * 0.20, img.height * 0.26
    d.rectangle([ix, iy, img.width - ix, img.height - iy], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    mask = mask.point(lambda v: int(v * strength / 255))
    black = Image.new("RGB", img.size, BG)
    return Image.composite(black, img, mask)


def make_og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    img = glow(img, W / 2, 470, 620, AMBER, peak=34)          # 地平线上的暮光
    img = scanlines(img, alpha=6, step=4)
    img = vignette(img, 210)
    d = ImageDraw.Draw(img)

    # 地平线
    for i in range(120):
        a = int(70 * (1 - i / 120))
        d.line([(0, 470 + i * 0.35), (W, 470 + i * 0.35)], fill=tuple(
            BG[c] + (AMBER[c] - BG[c]) * a // 255 for c in range(3)))

    f_display = font(["georgia.ttf", "times.ttf"], 118)
    f_cjk = font(["msyh.ttc", "simhei.ttf"], 50)
    f_tag = font(["georgia.ttf", "times.ttf"], 28)
    f_mono = font(["consola.ttf", "constan.ttf", "georgia.ttf"], 22)

    tracked(d, W / 2, 150, "twilit", f_display, AMBER, tracking=14)
    tracked(d, W / 2, 320, "虚室生白", f_cjk, PALE, tracking=16)
    d.text((W / 2, 430), "twilight falls on all things equally",
           font=f_tag, fill=DIM, anchor="mm")
    tracked(d, W / 2, 560, "twilit.site", f_mono, DEEP, tracking=6)

    out = os.path.join(ROOT, "og.png")
    img.save(out, "PNG", optimize=True)
    print(f"og.png  {W}x{H}  {os.path.getsize(out) // 1024} KB")
    return img


def make_touch_icon():
    S = 180
    img = Image.new("RGBA", (S, S), BG + (255,))
    ov = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    # 落日：上半亮下半沉入地平线
    cx, cy, r = S / 2, S * 0.62, S * 0.30
    for i in range(int(r), 0, -1):
        t = i / r
        col = tuple(int(PALE[c] + (AMBER[c] - PALE[c]) * t) for c in range(3))
        d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=col + (255,))
    img = Image.alpha_composite(img, ov)
    d = ImageDraw.Draw(img)
    d.rectangle([0, cy, S, S], fill=BG + (255,))          # 地平线以下
    for i, y in enumerate([cy + 12, cy + 26, cy + 40]):
        half = S * (0.36 - i * 0.06)
        d.line([(cx - half, y), (cx + half, y)], fill=AMBER + (90,), width=2)
    out = os.path.join(ROOT, "apple-touch-icon.png")
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"apple-touch-icon.png  {S}x{S}  {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    make_og()
    make_touch_icon()
