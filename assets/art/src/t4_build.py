"""T4 art-only builder. Creates new preview files; never overwrites a PNG.

python -B assets/art/src/t4_build.py
Reuses existing key_bg.py alpha cleanup and premultiplied Lanczos framing.
Final publication is an exclusive-create copy after visual review.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ART = Path(__file__).resolve().parents[1]
SRC = ART / 'src'
OUT = SRC / 't4_preview'
sys.path.insert(0, str(ART / 'tools'))
from key_bg import clean_source, square_sprite

NAVY = '#2a2647'
FAMILIES = [
    ('wax_chips_attempt2', ['chip_wax_a', 'chip_wax_b', 'chip_wax_c']),
    ('boss_chunks_attempt1', ['chunk_boss_a', 'chunk_boss_b', 'chunk_boss_c']),
    ('ice_shards_attempt1', ['shard_ice_a', 'shard_ice_b', 'shard_ice_c']),
    ('goo_drops_attempt1', ['drop_jelly', 'drop_mint', 'drop_peach']),
]


def save_new(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as f:
        im.save(f, format='PNG', optimize=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tiny(im, size):
    return im.convert('RGBa').resize((size, size), Image.Resampling.LANCZOS).convert('RGBA')


def font(size):
    return ImageFont.load_default(size=size)


def inspect_sprite(name, path, size):
    im = Image.open(path)
    p = np.array(im)
    a = p[..., 3]
    corners = a[[0, 0, -1, -1], [0, -1, 0, -1]].tolist()
    border_clear = not any((a[0].any(), a[-1].any(), a[:, 0].any(), a[:, -1].any()))
    bbox = im.getbbox()
    margin = min(bbox[0], bbox[1], size - bbox[2], size - bbox[3])
    assert im.mode == 'RGBA' and im.size == (size, size) and im.format == 'PNG', name
    assert corners == [0, 0, 0, 0] and border_clear, name
    assert margin >= (8 if size == 128 else 20), (name, bbox)
    assert not p[a == 0, :3].any(), name
    record = {'format': im.format, 'mode': im.mode, 'size': list(im.size),
              'corner_alpha': corners, 'outer_border_transparent': border_clear,
              'bbox': list(bbox), 'minimum_margin_px': margin,
              'alpha_percentiles_inside_support': np.percentile(a[a >= 16], [0, 25, 50, 75, 100]).tolist(),
              'sha256': sha(path), 'bytes': path.stat().st_size, 'pass': True}
    print(f'PASS {name:14} RGBA {size}x{size} corners={corners} border=0 bbox={bbox} margin={margin}px')
    return record


def prepare_crop(image, name, crop_box, source_name):
    crop = image.crop(crop_box)
    pixels = np.array(crop.convert('RGBA'))
    original_corners = pixels[[0, 0, -1, -1], [0, -1, 0, -1], 3].tolist()
    # Same alpha support threshold as key_bg; eliminate invisible sheet noise
    # before native-alpha detection on each independently sliced tile.
    pixels[pixels[..., 3] < 16] = 0
    crop_path = OUT / 'slices' / f'{name}.png'
    save_new(Image.fromarray(pixels), crop_path)
    cleaned, report = clean_source(crop_path, inset=2)
    l, t, r, b = cleaned.getbbox()
    center = ((l + r) / 2, (t + b) / 2)
    extent = max(r - l, b - t)
    sprite = square_sprite(cleaned, center, extent, size=128, margin=0.08)
    report.update({'sheet': source_name, 'sheet_crop_box': list(crop_box),
                   'tile_corner_alpha_before_low_alpha_cleanup': original_corners,
                   'framing': {'center_tile_px': center, 'extent_tile_px': extent, 'margin_fraction': 0.08}})
    path = OUT / 'fx' / f'{name}.png'
    save_new(sprite, path)
    report['verification'] = inspect_sprite(name, path, 128)
    return sprite, report


def face_metrics(im):
    p = np.array(im)
    mask = (p[..., 0] < 155) & (p[..., 1] < 80) & (p[..., 2] < 130) & (p[..., 3] > 200)
    region = np.zeros(mask.shape, dtype=bool)
    region[128:256, 96:288] = True
    ys, xs = np.where(mask & region)
    return {'dark_face_pixel_count': len(xs), 'centroid': [float(xs.mean()), float(ys.mean())],
            'bbox': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]}


def contact_sheets(sprites, wax):
    # All indicated pixel sizes are native within the saved sheet.
    sheet = Image.new('RGB', (896, 1070), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), 'ASMR MUSOU / T4 FX / 128 px + 16 / 24 / 40 px', fill='#fff3ed', font=font(23))
    draw.text((20, 46), 'UPPER-LEFT LIGHT  |  #2a2647  |  sizes exact in original PNG', fill='#c8c4dd', font=font(15))
    for i, (name, im) in enumerate(sprites.items()):
        x, y = i % 4 * 224, 80 + i // 4 * 244
        draw.text((x + 16, y), name, fill='#fff3ed', font=font(17))
        sheet.paste(im, (x + 48, y + 25), im)
        for size, sx in [(16, 37), (24, 96), (40, 160)]:
            sm = tiny(im, size)
            sheet.paste(sm, (x + sx, y + 170 + (40 - size) // 2), sm)
            draw.text((x + sx, y + 216), str(size), fill='#c8c4dd', font=font(13))
    save_new(sheet, OUT / 'fx' / 'fx_sheet.png')

    strip = Image.new('RGB', (896, 200), NAVY)
    d = ImageDraw.Draw(strip)
    d.text((10, 8), 'T4 / 16 px, 24 px, 40 px / navy #2a2647', fill='#fff3ed', font=font(17))
    for i, (name, im) in enumerate(sprites.items()):
        for size, y in [(16, 40), (24, 76), (40, 120)]:
            sm = tiny(im, size)
            strip.paste(sm, (i * 68 + (68 - size) // 2, y), sm)
        d.text((i * 68 + 25, 175), str(i + 1), fill='#c8c4dd', font=font(13))
    save_new(strip, OUT / 'fx_gameplay_scale.png')

    sheet = Image.new('RGB', (1664, 634), NAVY)
    d = ImageDraw.Draw(sheet)
    d.text((22, 16), 'ASMR MUSOU / WAX DAMAGE COMPARISON / 384 px + 80 px', fill='#fff3ed', font=font(27))
    d.text((22, 49), 'Same wax_0 group crop and scale  |  #2a2647  |  candidate only, existing sprites preserved', fill='#c8c4dd', font=font(17))
    small = Image.new('RGB', (640, 146), NAVY)
    ds = ImageDraw.Draw(small)
    for i, (name, im) in enumerate(wax.items()):
        x = i * 416
        d.text((x + 18, 84), name, fill='#fff3ed', font=font(22))
        sheet.paste(im, (x + 16, 116), im)
        sm = tiny(im, 80)
        sheet.paste(sm, (x + 168, 521), sm)
        d.text((x + 180, 606), '80 px', fill='#c8c4dd', font=font(14))
        small.paste(sm, (i * 160 + 40, 30), sm)
        ds.text((i * 160 + 20, 118), name, fill='#fff3ed', font=font(15))
    save_new(sheet, OUT / 'alt' / 'wax_compare.png')
    save_new(small, OUT / 'wax_compare_80.png')


def main():
    assert not OUT.exists(), 'Preview folder already exists; never overwrite existing files.'
    OUT.mkdir()
    sprites, report = {}, {}
    for source, names in FAMILIES:
        path = SRC / f't4_{source}.png'
        image = Image.open(path).convert('RGBA')
        w, h = image.size
        boxes = [(0, 0, w // 2, h // 2), (w // 2, 0, w, h // 2), (0, h // 2, w // 2, h)]
        for name, box in zip(names, boxes):
            sprites[name], report[name] = prepare_crop(image, name, box, path.name)
            report[name]['source_sha256'] = sha(path)
    path = SRC / 't4_sparkle_attempt1.png'
    im = Image.open(path).convert('RGBA')
    sprites['sparkle'], report['sparkle'] = prepare_crop(im, 'sparkle', (0, 0, *im.size), path.name)
    report['sparkle']['source_sha256'] = sha(path)

    framing = json.loads((ART / 'verification.json').read_text(encoding='utf-8'))['wax_0']['framing']
    source = SRC / 't4_wax_alt_attempt1.png'
    alt, alt_report = clean_source(source, inset=2)
    assert alt.size == Image.open(SRC / 'wax_0_attempt1.png').size, 'Source canvas sizes must match.'
    alt = square_sprite(alt, tuple(framing['center_source_px']), framing['shared_extent_source_px'], size=384, margin=framing['margin_fraction'])
    path = OUT / 'alt' / 'wax_2_alt.png'
    save_new(alt, path)
    alt_report.update({'source_sha256': sha(source), 'framing': framing, 'verification': inspect_sprite('wax_2_alt', path, 384)})
    wax = {name: Image.open(ART / f'{name}.png').convert('RGBA') for name in ['wax_0', 'wax_1', 'wax_2']}
    wax['wax_2_alt'] = alt
    metrics = {name: face_metrics(im) for name, im in wax.items()}
    ref = np.array(metrics['wax_0']['centroid'])
    for name, metric in metrics.items():
        metric['centroid_delta_vs_wax_0_at_384_px'] = float(np.linalg.norm(np.array(metric['centroid']) - ref))
    alt_report['face_registration'] = metrics
    report['wax_2_alt'] = alt_report
    contact_sheets(sprites, wax)
    with (OUT / 't4_verification.json').open('x', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print('Face registration:', json.dumps(metrics))
    print('PASS 14/14 sprites; preview sheets created without replacing existing PNGs.')


if __name__ == '__main__':
    main()
