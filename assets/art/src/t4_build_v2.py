"""Adopted T4 preview builder; pads sheet tiles before the existing crop routine.

python -B assets/art/src/t4_build_v2.py
Exclusive-create outputs: requires src/t4_preview_v2 not to exist.
"""
import math

from PIL import ImageOps

import t4_build as build

original_square_sprite = build.square_sprite


def padded_square_sprite(image, center, extent, size=384, margin=0.06):
    side = extent / (1 - 2 * margin)
    left, top = center[0] - side / 2, center[1] - side / 2
    right, bottom = center[0] + side / 2, center[1] + side / 2
    padding = math.ceil(max(0, -left, -top, right - image.width, bottom - image.height))
    if padding:
        image = ImageOps.expand(image, border=padding, fill=(0, 0, 0, 0))
        center = (center[0] + padding, center[1] + padding)
    return original_square_sprite(image, center, extent, size=size, margin=margin)


build.OUT = build.SRC / 't4_preview_v2'
build.square_sprite = padded_square_sprite

if __name__ == '__main__':
    build.main()
