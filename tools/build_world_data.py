#!/usr/bin/env python3
"""
构建世界轮廓数据：TopoJSON(world-atlas 110m) → 站点用的精简 JSON

为什么要在构建期做：
  运行时不引入 d3-geo / topojson-client（本站是零依赖风格），
  只有一份 _data/world.json，页面用等距圆柱投影直接画折线。

用法：
  python tools/build_world_data.py <countries-110m.json> [_data/world.json]
输出：
  window.TWILIT_WORLD = {"rings": [[lon,lat,...], ...]}   经纬度各保留 1 位小数
"""
import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = sys.argv[1] if len(sys.argv) > 1 else None
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / '_data' / 'world.js'

EPSILON = 0.12      # 道格拉斯-普克简化阈值（度）
MIN_AREA = 0.06     # 小于该面积（平方度）的岛直接丢掉
MIN_POINTS = 4


def decode_arcs(topology):
    """TopoJSON 的 arcs 是增量编码，先还原成绝对经纬度"""
    tr = topology.get('transform')
    arcs = []
    for arc in topology['arcs']:
        pts, x, y = [], 0, 0
        for p in arc:
            if tr:
                x += p[0]
                y += p[1]
                pts.append((x * tr['scale'][0] + tr['translate'][0],
                            y * tr['scale'][1] + tr['translate'][1]))
            else:
                pts.append((p[0], p[1]))
        arcs.append(pts)
    return arcs


def assemble(arc_idx_list, arcs):
    """把若干 arc 拼成一个环（负索引表示反向）"""
    out = []
    for i in arc_idx_list:
        seg = arcs[i] if i >= 0 else list(reversed(arcs[~i]))
        if out and seg:
            seg = seg[1:]          # 去掉接缝处重复的点
        out.extend(seg)
    return out


def rings_of(geometry, arcs):
    t = geometry['type']
    if t == 'Polygon':
        return [assemble(r, arcs) for r in geometry['arcs']]
    if t == 'MultiPolygon':
        return [assemble(r, arcs) for poly in geometry['arcs'] for r in poly]
    return []


def rdp(points, eps):
    """道格拉斯-普克简化（迭代实现，避免深递归）"""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5
        best, best_i = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k]
            if norm == 0:
                d = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, best_i = d, k
        if best > eps:
            keep[best_i] = True
            stack.append((i, best_i))
            stack.append((best_i, j))
    return [p for p, k in zip(points, keep) if k]


def area(points):
    s = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def main():
    if not SRC:
        print(__doc__)
        sys.exit(1)
    topo = json.loads(Path(SRC).read_text(encoding='utf-8'))
    arcs = decode_arcs(topo)
    obj = topo['objects'].get('countries') or list(topo['objects'].values())[0]

    geoms = obj.get('geometries') or [obj]
    raw_rings = []
    for g in geoms:
        raw_rings.extend(rings_of(g, arcs))

    out, dropped = [], 0
    for ring in raw_rings:
        if len(ring) < MIN_POINTS or area(ring) < MIN_AREA:
            dropped += 1
            continue
        simple = rdp(ring, EPSILON)
        if len(simple) < MIN_POINTS:
            dropped += 1
            continue
        flat = []
        for lon, lat in simple:
            lon = round(max(-180.0, min(180.0, lon)), 1)
            lat = round(max(-90.0, min(90.0, lat)), 1)
            if flat and flat[-2] == lon and flat[-1] == lat:
                continue
            flat.extend([lon, lat])
        if len(flat) >= MIN_POINTS * 2:
            out.append(flat)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({'rings': out}, ensure_ascii=False, separators=(',', ':'))
    # 用 <script> 引入而不是 fetch：本地 file:// 打开时 fetch 会被 CORS 拦掉
    OUT.write_text('window.TWILIT_WORLD = ' + payload + ';\n', encoding='utf-8')
    pts = sum(len(r) // 2 for r in out)
    allx = [r[i] for r in out for i in range(0, len(r), 2)]
    ally = [r[i] for r in out for i in range(1, len(r), 2)]
    print(f'原始环 {len(raw_rings)} → 保留 {len(out)} 环（丢弃 {dropped} 个碎岛）')
    print(f'点数 {pts}，经度范围 {min(allx)}~{max(allx)}，纬度范围 {min(ally)}~{max(ally)}')
    print(f'输出 {OUT}  {OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
