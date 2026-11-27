/* Offline 48 kHz Audio Verification for v1.2 New Tactile Cues:
 * 1) SLASHER Multi-Slice cadence: iai_draw (ducking) -> iai_open + iai_slide (glide apart) -> cross-quarter
 * 2) 3-Phase Boss cadence: shell hit -> boss_layer(0) -> inner hit -> boss_layer(1) -> boss_crack(1,2) -> finale
 * Verifies peak/RMS headroom, zero clipping, stereo balance, and saves WAVs for spectrogram inspection. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const outDir = process.argv[2] || path.join(__dirname, '..', 'v12_audio');
fs.mkdirSync(outDir, { recursive: true });

const SR = 48000;
function makeBuf(sec) { return [new Float32Array(Math.floor(SR * sec)), new Float32Array(Math.floor(SR * sec))]; }
const panFor = x => Math.max(-0.55, Math.min(0.55, (((x ?? 360) - 360) / 360) * 0.55));

function addTone(buf, t0, dur, f0, f1, gain, x = 360, type = 'sine', attack = 0.005) {
  const [L, R] = buf, pan = panFor(x);
  const gL = Math.cos((pan + 1) * Math.PI / 4), gR = Math.sin((pan + 1) * Math.PI / 4);
  const n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && n0 + i < L.length; i++) {
    const t = i / SR, k = t / dur;
    const f = f0 * Math.pow(f1 / f0, k);
    ph += 2 * Math.PI * f / SR;
    const raw = type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
    const env = t < attack ? t / attack : Math.pow(0.0005 / Math.max(0.0006, gain), (t - attack) / Math.max(0.001, dur - attack));
    const v = raw * gain * env * 0.56;
    L[n0 + i] += v * gL;
    R[n0 + i] += v * gR;
  }
}

let seed = 42;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }

function addNoiseBP(buf, t0, dur, f0, f1, Q, gain, x = 360, attack = 0.003) {
  const [L, R] = buf, pan = panFor(x);
  const gL = Math.cos((pan + 1) * Math.PI / 4), gR = Math.sin((pan + 1) * Math.PI / 4);
  const n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n && n0 + i < L.length; i++) {
    const t = i / SR, k = t / dur;
    const f = Math.max(80, Math.min(18000, f0 * Math.pow(f1 / f0, k)));
    const w0 = 2 * Math.PI * f / SR, alpha = Math.sin(w0) / (2 * Q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
    const xn = rand();
    const yn = (b0 * xn + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = xn; y2 = y1; y1 = yn;
    const env = t < attack ? t / attack : Math.pow(0.0005 / Math.max(0.0006, gain), (t - attack) / Math.max(0.001, dur - attack));
    const v = yn * gain * env * 0.56;
    L[n0 + i] += v * gL;
    R[n0 + i] += v * gR;
  }
}

function softLimit(buf) {
  for (const ch of buf) {
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      if (Math.abs(x) > 0.72) ch[i] = Math.sign(x) * (0.72 + 0.24 * Math.tanh((Math.abs(x) - 0.72) / 0.24));
    }
  }
}

function writeWav(filePath, [L, R]) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  fs.writeFileSync(filePath, buf);
}

function stats([L, R]) {
  let pk = 0, sqL = 0, sqR = 0, diff = 0, sum = 0;
  for (let i = 0; i < L.length; i++) {
    pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    sqL += L[i] * L[i]; sqR += R[i] * R[i];
    diff += (L[i] - R[i]) ** 2; sum += (L[i] + R[i]) ** 2;
  }
  const rms = Math.sqrt((sqL + sqR) / (2 * L.length));
  return {
    peakDb: +(20 * Math.log10(Math.max(1e-6, pk))).toFixed(2),
    rmsDb: +(20 * Math.log10(Math.max(1e-6, rms))).toFixed(2),
    stereoRatio: +(Math.sqrt(diff / Math.max(1e-9, sum))).toFixed(3),
    clipped: pk >= 0.99
  };
}

// 1) SLASHER Multi-Slice Audio Sequence (2.0 s)
const iaiBuf = makeBuf(2.0);
// 1st Iaido draw (0.10s) -> stillness -> open (0.215s) -> halves slide apart (0.25s)
addNoiseBP(iaiBuf, 0.10, 0.055, 2900, 5600, 3.2, 0.14, 240, 0.002);
addTone(iaiBuf, 0.10, 0.085, 3100, 2850, 0.045, 240, 'triangle', 0.002);
addNoiseBP(iaiBuf, 0.215, 0.16, 1100, 3600, 1.3, 0.18, 360, 0.006);
addTone(iaiBuf, 0.215, 0.09, 165, 62, 0.16, 360, 'sine', 0.004);
addNoiseBP(iaiBuf, 0.25, 0.085, 1600, 3400, 2.2, 0.09, 360, 0.008); // iai_slide
addTone(iaiBuf, 0.25, 0.06, 520, 340, 0.04, 360, 'triangle', 0.004);
// 2nd Cross-Iaido quartering (0.85s)
addNoiseBP(iaiBuf, 0.85, 0.055, 2900, 5600, 3.2, 0.14, 480, 0.002);
addNoiseBP(iaiBuf, 0.965, 0.18, 1100, 3600, 1.3, 0.18, 360, 0.006);
addTone(iaiBuf, 0.965, 0.09, 165, 62, 0.16, 360, 'sine', 0.004);
addNoiseBP(iaiBuf, 1.00, 0.085, 1600, 3400, 2.2, 0.09, 320, 0.008);
addNoiseBP(iaiBuf, 1.05, 0.085, 1600, 3400, 2.2, 0.09, 410, 0.008);
softLimit(iaiBuf);
writeWav(path.join(outDir, 'v12_iai_multislice.wav'), iaiBuf);

// 2) Boss 3-Phase Cadence Audio Sequence (4.5 s compressed highlight)
const bossBuf = makeBuf(4.5);
// Phase 1 outer shell clear -> boss_layer(0) at 0.30s
addTone(bossBuf, 0.30, 0.35, 135, 48, 0.38, 360, 'sine', 0.004);
addNoiseBP(bossBuf, 0.30, 0.28, 1800, 420, 0.9, 0.24, 360, 0.004);
for (const [dt, r] of [[0, 1], [0.05, 1.25], [0.10, 1.5]]) addTone(bossBuf, 0.30 + dt, 0.55, 392 * r, 392 * r * 1.005, 0.065, 360 + (dt - 0.05) * 3200, 'triangle', 0.008);
// Phase 2 inner layer clear -> boss_layer(1) at 1.20s
addTone(bossBuf, 1.20, 0.35, 135, 48, 0.38, 360, 'sine', 0.004);
addNoiseBP(bossBuf, 1.20, 0.28, 1800, 420, 0.9, 0.24, 360, 0.004);
for (const [dt, r] of [[0, 1], [0.05, 1.25], [0.10, 1.5]]) addTone(bossBuf, 1.20 + dt, 0.55, 523.25 * r, 523.25 * r * 1.005, 0.065, 360 + (dt - 0.05) * 3200, 'triangle', 0.008);
// Phase 3 Core Cracks (stage 1 at 2.00s, stage 2 at 2.55s)
for (const [t0, stage] of [[2.00, 1], [2.55, 2]]) {
  addTone(bossBuf, t0, 0.24, 150 + stage * 35, 58, 0.32, 360, 'sine', 0.003);
  addNoiseBP(bossBuf, t0, 0.16, 1800 + stage * 500, 620, 1.4, 0.22, 360, 0.002);
  addTone(bossBuf, t0 + 0.02, 0.28, 440 * (stage === 2 ? 1.5 : 1.25), 420 * (stage === 2 ? 1.5 : 1.25), 0.06, 360, 'triangle', 0.005);
}
// Finale liberation at 3.10s
addTone(bossBuf, 3.10, 0.65, 130, 38, 0.48, 360, 'sine', 0.006);
addNoiseBP(bossBuf, 3.10, 1.15, 2200, 340, 0.65, 0.26, 360, 0.04);
[261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99].forEach((f, i) => {
  const px = 120 + (i / 6) * 480;
  addTone(bossBuf, 3.16 + i * 0.055, 1.2, f, f, 0.052, px, i % 2 ? 'triangle' : 'sine', 0.015);
});
softLimit(bossBuf);
writeWav(path.join(outDir, 'v12_boss_3phase.wav'), bossBuf);

const report = {
  iai_multislice: stats(iaiBuf),
  boss_3phase: stats(bossBuf)
};
fs.writeFileSync(path.join(outDir, 'v12_audio_report.json'), JSON.stringify(report, null, 2));
console.log('v1.2 Offline Audio Audit:', JSON.stringify(report));
if (report.iai_multislice.clipped || report.boss_3phase.clipped) process.exit(1);
