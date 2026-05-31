#!/usr/bin/env python3
"""
Twilit Site — Plugin Registry Builder
Scans _plugins/*/meta.json and regenerates _data/plugins.json
Run before every git push (or in CI).
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLUGINS_DIR = ROOT / '_plugins'
OUTPUT = ROOT / '_data' / 'plugins.json'

def build():
    plugins = []
    if not PLUGINS_DIR.exists():
        print(f'[WARN] _plugins/ not found at {PLUGINS_DIR}')
        return

    for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir():
            continue
        meta_file = plugin_dir / 'meta.json'
        if not meta_file.exists():
            print(f'[SKIP] {plugin_dir.name}: no meta.json')
            continue

        with open(meta_file, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        # Ensure required fields
        meta.setdefault('id', plugin_dir.name)
        if 'url' not in meta:
            meta['url'] = f'_plugins/{plugin_dir.name}/index.html'

        plugins.append(meta)
        print(f'[OK] {plugin_dir.name} → {meta.get("title", "?")}')

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(plugins, f, ensure_ascii=False, indent=2)

    print(f'\n[DONE] {len(plugins)} plugins written to {OUTPUT}')

if __name__ == '__main__':
    build()
