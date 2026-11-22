"""Objective analysis of rendered SFX WAVs (numpy + Pillow only).

Usage: python -I tools/analyze_sfx.py [wav_dir] [out_png]
Prints per-file metrics and writes a spectrogram contact sheet so a reviewer
can *see* transient shape / band energy. This is NOT a substitute for listening.
"""
import sys, wave, glob, os
import numpy as np
from PIL import Image, ImageDraw

wav_dir = sys.argv[1] if len(sys.argv) > 1 else "assets_audio_preview"
out_png = sys.argv[2] if len(sys.argv) > 2 else os.path.join(wav_dir, "_spectrograms.png")


def load(path):
    with wave.open(path, "rb") as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return sr, x


def db(v):
    return 20 * np.log10(max(v, 1e-9))


def spectrogram(x, sr, n_fft=512, hop=64):
    if len(x) < n_fft:
        x = np.pad(x, (0, n_fft - len(x)))
    win = np.hanning(n_fft)
    frames = [x[i:i + n_fft] * win for i in range(0, len(x) - n_fft + 1, hop)]
    S = np.abs(np.fft.rfft(np.array(frames), axis=1)).T  # freq x time
    return 20 * np.log10(S + 1e-7)


rows = []
files = sorted(glob.glob(os.path.join(wav_dir, "*.wav")))
print(f"{'file':34s} {'dur_ms':>7s} {'peak':>6s} {'rms':>6s} {'crest':>6s} {'atk_ms':>6s} {'cent_Hz':>8s} {'>9k%':>5s}")
for f in files:
    sr, x = load(f)
    peak = float(np.max(np.abs(x))) if len(x) else 0
    rms = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0
    env = np.abs(x)
    atk = int(np.argmax(env >= 0.9 * peak)) / sr * 1000 if peak > 0 else 0
    spec = np.abs(np.fft.rfft(x)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    cent = float((spec * freqs).sum() / max(spec.sum(), 1e-12))
    hi = float(spec[freqs > 9000].sum() / max(spec.sum(), 1e-12) * 100)
    print(f"{os.path.basename(f):34s} {len(x)/sr*1000:7.0f} {db(peak):6.1f} {db(rms):6.1f} {db(peak)-db(rms):6.1f} {atk:6.1f} {cent:8.0f} {hi:5.1f}")
    rows.append((os.path.basename(f), sr, x))

# contact sheet: each row = name + waveform + spectrogram (0-16 kHz, 0-1.6 s)
W, ROWH, LABEL = 1100, 70, 230
img = Image.new("RGB", (W, max(1, len(rows)) * ROWH), (18, 18, 30))
d = ImageDraw.Draw(img)
max_t = 1.6
for i, (name, sr, x) in enumerate(rows):
    y0 = i * ROWH
    d.text((6, y0 + 6), name, fill=(230, 230, 240))
    S = spectrogram(x, sr)
    fmax_bin = int(16000 / (sr / 2) * (S.shape[0] - 1))
    S = S[:fmax_bin][::-1]
    S = np.clip((S + 40) / 70, 0, 1)  # -40..+30 dB window
    cols = int((len(x) / sr) / max_t * (W - LABEL))
    cols = max(2, min(cols, W - LABEL))
    rgb = (np.stack([S ** 0.8, S ** 1.6, 0.35 + 0.65 * S], -1) * 255).astype(np.uint8)
    im = Image.fromarray(rgb).resize((cols, ROWH - 22))
    img.paste(im, (LABEL, y0 + 20))
    # waveform strip
    if len(x):
        step = max(1, len(x) // cols)
        env = np.abs(x[: step * cols]).reshape(cols, -1).max(axis=1) if len(x) >= cols else np.abs(x)
        for c, v in enumerate(env):
            h = int(v * 9)
            d.line([(LABEL + c, y0 + 10 - h), (LABEL + c, y0 + 10 + h)], fill=(120, 230, 210))
    d.line([(0, y0 + ROWH - 1), (W, y0 + ROWH - 1)], fill=(50, 50, 70))
d.text((LABEL, 2), "0s ... 1.6s  |  spectrogram 0-16kHz", fill=(150, 150, 170))
img.save(out_png)
print("sheet:", out_png)
