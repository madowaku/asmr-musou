"""Rebuild adopted sprites, contact sheets and verification from preserved sources.

Run from any directory: python assets/art/tools/build_art.py
Only writes within assets/art. Requires Pillow and numpy, no network calls.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from key_bg import clean_source, square_sprite

ROOT = Path(__file__).resolve().parents[1]
STEMS = ['wax_0', 'wax_1', 'wax_2', 'bubble_0', 'jelly_0',
         'ice_0', 'ice_1', 'boss_0', 'boss_1', 'boss_2']
GROUPS = [('wax_0', 'wax_1', 'wax_2'), ('bubble_0',), ('jelly_0',),
          ('ice_0', 'ice_1'), ('boss_0', 'boss_1', 'boss_2')]
NAVY = '#2a2647'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int):
    # Pillow's bundled default avoids a dependency on licensed system fonts.
    return ImageFont.load_default(size=size)


def sheets(sprites: dict[str, Image.Image]) -> None:
    # Every large image is exactly 384x384 in the saved sheet, every small one 80x80.
    cell_w, cell_h, header = 416, 556, 78
    sheet = Image.new('RGB', (cell_w * 5, header + cell_h * 2), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((22, 16), 'ASMR MUSOU / ENEMY ART / 384 px + 80 px', fill='#fff3ed', font=font(27))
    draw.text((22, 48), '2026-11-22   |   background #2a2647   |   exact pixel sizes in original PNG', fill='#c8c4dd', font=font(17))
    small_sheet = Image.new('RGB', (1000, 154), NAVY)
    sd = ImageDraw.Draw(small_sheet)
    sd.text((12, 8), '80 px / gameplay scale', fill='#fff3ed', font=font(16))
    for i, stem in enumerate(STEMS):
        x, y = (i % 5) * cell_w, header + (i // 5) * cell_h
        draw.text((x + 18, y + 5), stem, fill='#fff3ed', font=font(22))
        sprite = sprites[stem]
        sheet.paste(sprite, (x + 16, y + 38), sprite)
        tiny = sprite.convert('RGBa').resize((80, 80), Image.Resampling.LANCZOS).convert('RGBA')
        sheet.paste(tiny, (x + 168, y + 443), tiny)
        draw.text((x + 180, y + 528), '80 px', fill='#c8c4dd', font=font(14))
        small_sheet.paste(tiny, (i * 100 + 10, 39), tiny)
        sd.text((i * 100 + 8, 128), stem, fill='#fff3ed', font=font(14))
    sheet.save(ROOT / 'contact_sheet.png', optimize=True)
    small_sheet.save(ROOT / 'contact_sheet_80.png', optimize=True)


def main() -> None:
    manifest = json.loads((ROOT / 'generation_manifest.json').read_text(encoding='utf-8'))
    entries = {}
    for entry in manifest:
        if entry['status'] != 'rejected':
            entries[entry['stem']] = entry
    assert set(entries) == set(STEMS), 'The manifest must include all ten sprites.'
    cleaned, reports, sprites = {}, {}, {}
    for stem in STEMS:
        entry = entries[stem]
        source = ROOT / entry['source']
        cleaned[stem], reports[stem] = clean_source(source, inset=entry.get('edge_inset', 2))
        reports[stem]['source_sha256'] = sha(source)
    for group in GROUPS:
        reference_box = cleaned[group[0]].getbbox()
        l, t, r, b = reference_box
        center = ((l + r) / 2, (t + b) / 2)
        # A shared square includes all damage silhouettes without changing scale.
        extent = max(2 * abs(v - center[axis]) for stem in group
                     for axis, v in enumerate(cleaned[stem].getbbox()[:2]))
        for stem in group:
            gl, gt, gr, gb = cleaned[stem].getbbox()
            extent = max(extent, 2 * abs(gr - center[0]), 2 * abs(gb - center[1]))
        for stem in group:
            sprites[stem] = square_sprite(cleaned[stem], center, extent)
            path = ROOT / f'{stem}.png'
            sprites[stem].save(path, optimize=True)
            reports[stem]['framing'] = {'reference': group[0], 'center_source_px': center,
                                         'shared_extent_source_px': extent, 'margin_fraction': 0.06}
            reports[stem]['output_sha256'] = sha(path)
    sheets(sprites)
    for stem in STEMS:
        path = ROOT / f'{stem}.png'
        im = Image.open(path)
        a = np.array(im.getchannel('A'))
        corners = a[[0, 0, -1, -1], [0, -1, 0, -1]].tolist()
        bbox = im.getbbox()
        assert im.mode == 'RGBA' and im.size == (384, 384) and im.format == 'PNG', stem
        assert corners == [0, 0, 0, 0], stem
        assert not a[0].any() and not a[-1].any() and not a[:, 0].any() and not a[:, -1].any(), stem
        assert min(bbox[0], bbox[1], 384 - bbox[2], 384 - bbox[3]) >= 20, stem
        reports[stem]['verification'] = {'mode': im.mode, 'size': list(im.size),
            'format': im.format, 'corner_alpha': corners, 'outer_border_transparent': True,
            'bbox': list(bbox), 'bytes': path.stat().st_size, 'pass': True}
        print(f'PASS {stem:8} PNG RGBA 384x384 corners={corners} bbox={bbox} bytes={path.stat().st_size}')
    (ROOT / 'verification.json').write_text(json.dumps(reports, indent=2) + '\n', encoding='utf-8')
    print('PASS 10/10 sprites; contact_sheet.png has exact 384px and 80px renderings on #2a2647.')


if __name__ == '__main__':
    main()
