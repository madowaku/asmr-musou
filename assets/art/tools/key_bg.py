"""Clean generated RGBA/chroma-key art; never draw or replace the character.

Single image: python assets/art/tools/key_bg.py input.png output.png
Chroma fallback: add --key 00FF00 (or FF00FF). Requires Pillow and numpy.
The batch builder imports clean_source and square_sprite from this module.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def key_color(value: str) -> np.ndarray:
    value = value.lstrip('#')
    if len(value) != 6:
        raise ValueError('Key must be a six-digit RGB hex color.')
    return np.array([int(value[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def soft_chroma(rgb: np.ndarray, key: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Chroma excess matte plus inverse-compositing despill for green/magenta.

    Foreground must not contain the key hue. This is a fallback, not a way to
    recover physically accurate transmission through a photographed object.
    """
    r, g, b = np.moveaxis(rgb, -1, 0)
    if np.allclose(key, [0, 255, 0], atol=12):
        excess = g - np.maximum(r, b)
    elif np.allclose(key, [255, 0, 255], atol=12):
        excess = np.minimum(r, b) - g
    else:
        raise ValueError('Use pure green 00FF00 or magenta FF00FF for keying.')
    a = np.clip(1.0 - (excess - 6.0) / 243.0, 0.0, 1.0)
    near_key = np.max(np.abs(rgb - key), axis=2) <= 10
    a[near_key] = 0
    # Remove key-colored background contribution from partially covered pixels.
    fg = (rgb - (1.0 - a[..., None]) * key) / np.maximum(a[..., None], 0.015)
    fg = np.clip(fg, 0, 255)
    fg[a == 0] = 0
    return fg, a * 255


def clean_source(path: Path, key: str = 'auto', inset: int = 2) -> tuple[Image.Image, dict]:
    original = Image.open(path)
    rgba = np.array(original.convert('RGBA'), dtype=np.uint8)
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3].astype(np.float32)
    corners = alpha[[0, 0, -1, -1], [0, -1, 0, -1]]
    native = original.mode == 'RGBA' and np.max(corners) == 0
    method = 'native alpha retained; no chroma key'
    if key != 'auto' or not native:
        if key == 'auto':
            corner_rgb = rgb[[0, 0, -1, -1], [0, -1, 0, -1]]
            color = np.median(corner_rgb, axis=0)
            if np.max(np.abs(corner_rgb - color)) > 12:
                raise ValueError(f'{path}: background is not uniform; regenerate on a flat key.')
        else:
            color = key_color(key)
        rgb, keyed_alpha = soft_chroma(rgb, color)
        alpha = np.minimum(alpha, keyed_alpha)
        method = 'soft chroma matte and inverse-compositing despill'

    # Retain only the connected character containing the center-nearest pixel.
    # Isolated low-alpha speckles from generated cutouts must not affect framing.
    support = Image.fromarray(np.uint8(alpha >= 16) * 255).copy()
    coords = np.argwhere(np.asarray(support) > 0)
    if not len(coords):
        raise ValueError(f'{path}: no foreground remains')
    h, w = alpha.shape
    cy, cx = coords[np.argmin((coords[:, 0] - h / 2) ** 2 + (coords[:, 1] - w / 2) ** 2)]
    ImageDraw.floodfill(support, (int(cx), int(cy)), 128)
    connected = np.asarray(support) == 128
    removed = int(np.count_nonzero((alpha > 0) & ~connected))
    matte = Image.fromarray(np.uint8(connected) * 255)
    # A tiny source-resolution inset removes contaminated edge RGB; soft coverage
    # and premultiplied resizing below preserve antialiasing without a light halo.
    if inset:
        matte = matte.filter(ImageFilter.MinFilter(inset * 2 + 1))
    matte = matte.filter(ImageFilter.GaussianBlur(0.35))
    alpha = np.minimum(alpha, np.asarray(matte, dtype=np.float32))
    alpha[alpha < 2] = 0
    out = np.dstack((np.rint(rgb), np.rint(alpha))).clip(0, 255).astype(np.uint8)
    out[out[..., 3] == 0, :3] = 0
    cleaned = Image.fromarray(out)
    return cleaned, {
        'source': str(path.name), 'source_mode': original.mode,
        'source_size': list(original.size), 'matting': method,
        'removed_disconnected_or_low_alpha_pixels': removed,
        'edge_inset_source_px': inset, 'edge_softening_source_px': 0.35,
        'clean_bbox': list(cleaned.getbbox()),
    }


def square_sprite(image: Image.Image, center: tuple[float, float], extent: float,
                  size: int = 384, margin: float = 0.06) -> Image.Image:
    """Isotropic resize with fixed group framing; retain body/face registration."""
    side = extent / (1 - 2 * margin)
    box = (center[0] - side / 2, center[1] - side / 2,
           center[0] + side / 2, center[1] + side / 2)
    # Premultiplication prevents RGB stored under alpha zero bleeding on resize.
    out = image.convert('RGBa').resize((size, size), Image.Resampling.LANCZOS, box=box).convert('RGBA')
    pixels = np.array(out)
    pixels[pixels[..., 3] < 2] = 0
    return Image.fromarray(pixels)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--key', default='auto')
    parser.add_argument('--size', type=int, default=384)
    parser.add_argument('--margin', type=float, default=0.06)
    parser.add_argument('--inset', type=int, default=2)
    args = parser.parse_args()
    image, report = clean_source(args.source, args.key, args.inset)
    l, t, r, b = image.getbbox()
    out = square_sprite(image, ((l + r) / 2, (t + b) / 2), max(r - l, b - t), args.size, args.margin)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.output, optimize=True)
    print(report)


if __name__ == '__main__':
    main()
