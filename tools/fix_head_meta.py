#!/usr/bin/env python3
"""
twilit 站点机械性修复脚本（幂等，可重复跑）

做三件事：
1. 修 viewport：去掉 maximum-scale=1.0, user-scalable=no（禁止缩放属于无障碍硬伤）
2. 给每个页面的 <head> 注入 description / canonical / theme-color / favicon / OG / Twitter 卡片
   —— admin.html 单独标记 noindex
3. 汇报每个文件改了什么

用法：python tools/fix_head_meta.py [仓库根目录]
"""
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://twilit.site"

DESC = {
    "index.html": "虚室生白——一段安静的独白、几首旧诗，与实时合成的暮色环境音。",
    "about.html": "关于 twilit：一个关于深夜、文字与暮色的个人站点。",
    "gallery.html": "《重返未来：1999》高清壁纸廊，CRT 画廊展示。",
    "radio.html": "暮光短波电台：短波收音机模拟器，收听来自世界的神秘信号。",
    "plugins.html": "twilit 的小玩具合集：电台、电子宠物、信号终端、诗社与壁纸廊。",
    "poetry.html": "废话诗社：荒诞中见诗意的废话诗歌生成器。",
    "pet.html": "电子宠物：像素风 CRT 电子宠物，喂食、玩耍、成长。",
    "signal.html": "1999 异常信号终端：解码来自另一个时间线的神秘信息。",
    "y2k.html": "Y2K 晶体管诊断仪：复古系统诊断工具，检查晶体管健康状态。",
    "astro.html": "twilit 星象页。",
}
DEFAULT_DESC = "twilit — 虚室生白。twilight falls on all things equally."

VIEWPORT_BAD = re.compile(
    r'(<meta\s+name="viewport"\s+content="[^"]*?)'
    r'(?:,\s*maximum-scale=[^,"]*)?(?:,\s*user-scalable=no)?(")'
)


def page_url(rel):
    rel = rel.replace("\\", "/")
    if rel == "index.html":
        return SITE + "/"
    if rel == "_plugins/latenight-lottery/index.html":
        return SITE + "/_plugins/latenight-lottery/"
    return f"{SITE}/{rel}"


def meta_block(rel, title, desc, noindex=False):
    u = page_url(rel)
    esc = lambda s: (s.replace("&", "&amp;").replace('"', "&quot;")
                     .replace("<", "&lt;").replace(">", "&gt;"))
    t, d = esc(title), esc(desc)
    lines = [
        f'<meta name="description" content="{d}">',
        f'<link rel="canonical" href="{u}">',
        '<meta name="theme-color" content="#080b10">',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="twilit">',
        f'<meta property="og:title" content="{t}">',
        f'<meta property="og:description" content="{d}">',
        f'<meta property="og:url" content="{u}">',
        '<meta property="og:image" content="' + SITE + '/og.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{t}">',
        f'<meta name="twitter:description" content="{d}">',
        '<meta name="twitter:image" content="' + SITE + '/og.png">',
    ]
    if noindex:
        lines.append('<meta name="robots" content="noindex, nofollow">')
    return "\n".join(lines)


def main():
    changed = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "assets", "tools")]
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, ROOT).replace("\\", "/")
            src = open(path, encoding="utf-8").read()
            orig = src
            notes = []

            # 1) viewport
            new, n = VIEWPORT_BAD.subn(r'\1\2', src)
            if n:
                src = new
                notes.append("viewport 去掉禁缩放")

            # 2) head meta
            if "og:title" not in src:
                m = re.search(r"<title>(.*?)</title>", src, re.S)
                title = m.group(1).strip() if m else "twilit"
                desc = DESC.get(rel, DEFAULT_DESC)
                block = meta_block(rel, title, desc, noindex=(fn == "admin.html"))
                m2 = re.search(r"(<title>.*?</title>)", src, re.S)
                if m2:
                    src = src[:m2.end()] + "\n" + block + src[m2.end():]
                else:  # 没有 <title>，塞到 <head> 后
                    m3 = re.search(r"<head[^>]*>", src, re.I)
                    src = (src[:m3.end()] if m3 else src) + "\n" + block + (src[m3.end():] if m3 else "")
                notes.append("注入 description/canonical/OG/favicon" + (" + noindex" if fn == "admin.html" else ""))

            if src != orig:
                open(path, "w", encoding="utf-8", newline="").write(src)
                changed.append((rel, notes))

    print(f"仓库根目录: {ROOT}")
    for rel, notes in changed:
        print(f"  ✓ {rel:<42} {'；'.join(notes)}")
    print(f"共修改 {len(changed)} 个文件")


if __name__ == "__main__":
    main()
