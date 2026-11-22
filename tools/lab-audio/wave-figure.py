"""Shared axes, actual stereo PCM16: 5 rows each for wax/soap, waveform + STFT.
NumPy for scientific transforms; Pillow (already present) for the contact sheet.
No image generation, individual row normalization, or hidden time compression.
"""
from pathlib import Path
import json
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parents[2] / 'research/v03/audio'
rows = json.loads((folder / 'wave-metrics.json').read_text())['rows']
font_path = 'C:/Windows/Fonts/consola.ttf'
font = ImageFont.truetype(font_path, 17)
small = ImageFont.truetype(font_path, 14)
title_font = ImageFont.truetype(font_path, 26)
sheet = Image.new('RGB', (1840, 1560), '#0c1820')
draw = ImageDraw.Draw(sheet)
draw.text((40, 22), 'R2b / BREAKING WAVE  -  FRACTURE > TEXTURE > COLLAPSE', font=title_font, fill='#e5eeea')
draw.text((40, 66), 'Actual PCM16 / 48 kHz / master .65 | common time 0-2.4 s | waveform +/-0.30 | STFT -85 to -25 dBFS', font=font, fill='#a5b8b6')
draw.text((40, 93), 'Dashed: last fracture + accent section end. Onset ticks are signal detections, not kill timestamps.', font=small, fill='#a5b8b6')
palette = np.array([[12, 24, 32], [27, 54, 82], [42, 113, 127], [124, 183, 144], [234, 224, 166], [255, 247, 226]])
for column, material in enumerate(['wax', 'soap']):
    x0, width = 40 + column * 900, 850
    draw.text((x0, 130), material.upper() + (' / shell-chip rain' if material == 'wax' else ' / cube avalanche'), font=title_font, fill='#e5c1a5' if material == 'wax' else '#b8dfc5')
    for row, n in enumerate([1, 3, 10, 20, 40]):
        meta = next(r for r in rows if r['material'] == material and r['n'] == n)
        with wave.open(str(folder / f'wave_{material}_{n}.wav'), 'rb') as wav:
            sr = wav.getframerate()
            data = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').reshape(-1, wav.getnchannels()) / 32768
        # Retain stereo energy in the spectrogram; no phase cancellation downmix.
        y0 = 177 + row * 267
        draw.text((x0, y0), f"{n:2} / {meta['tier']:9}  {meta['duration40']:.3f}s  {meta['transientCount']} onsets  {meta['momentary400LUFS']:.1f} LUFS", font=font, fill='#e5eeea')
        top, mid, height = y0 + 31, y0 + 65, 68
        draw.rectangle((x0, top, x0 + width, top + height), fill='#13252b')
        draw.line((x0, mid, x0 + width, mid), fill='#33464b')
        for px in range(width):
            start, end = int(px / width * 2.4 * sr), int((px + 1) / width * 2.4 * sr)
            chunk = data[start:end]
            if chunk.size:
                lo, hi = chunk.min(), chunk.max()
                draw.line((x0 + px, mid - hi / .30 * 31, x0 + px, mid - lo / .30 * 31), fill='#e5c1a5' if material == 'wax' else '#b8dfc5')
        for at in meta['onsets']:
            px = x0 + at / 2.4 * width
            draw.line((px, top + height - 3, px, top + height), fill='#e5eeea')
        fft_size, hop = 512, 96
        padded = np.pad(data, ((fft_size // 2, fft_size), (0, 0)))
        frames = np.lib.stride_tricks.sliding_window_view(padded, fft_size, axis=0)[::hop]
        spectrum = np.fft.rfft(frames * np.hanning(fft_size), axis=-1)
        power = np.mean(np.abs(spectrum) ** 2, axis=1) / (np.hanning(fft_size).sum() ** 2) * 2
        db = 10 * np.log10(np.maximum(power, 1e-14))
        spec_h = 119
        pixels = np.zeros((spec_h, width, 3), dtype=np.uint8)
        for py in range(spec_h):
            bin_idx = round((1 - py / (spec_h - 1)) * 10000 / sr * fft_size)
            times = np.minimum((np.arange(width) / width * 2.4 * sr / hop).astype(int), len(db) - 1)
            value = np.clip((db[times, bin_idx] + 85) / 60, 0, 1) * (len(palette) - 1)
            ix = np.minimum(value.astype(int), len(palette) - 2)
            pixels[py] = palette[ix] * (1 - (value - ix)[:, None]) + palette[ix + 1] * (value - ix)[:, None]
        spec_top = top + height + 7
        sheet.paste(Image.fromarray(pixels), (x0, spec_top))
        for hz in [1000, 5000, 9000]:
            yy = spec_top + (1 - hz / 10000) * spec_h
            draw.text((x0 + 4, yy - 7), f'{hz//1000}k', font=small, fill='#a5b8b6')
        xx = x0 + meta['waveSectionEnd'] / 2.4 * width
        for yy in range(top, spec_top + spec_h, 8):
            draw.line((xx, yy, xx, yy + 4), fill='#d9e1d9')
        for t in [0, .4, .8, 1.2, 1.6, 2.0, 2.4]:
            draw.text((x0 + t / 2.4 * width - (24 if t == 2.4 else 0), spec_top + spec_h + 4), f'{t:.1f}', font=small, fill='#a5b8b6')
draw.text((40, 1530), 'Measured/visual evidence only. Material identity, flood/avalanche feel, fatigue and phone playback still need human ears.', font=small, fill='#a5b8b6')
sheet.save(folder / 'wave_ladder.png')
print(folder / 'wave_ladder.png')
