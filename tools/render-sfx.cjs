'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DSP = require('../audio.js');
const sampleRate = 48000;
const output = path.resolve(__dirname, '../assets_audio_preview');

// Magnitude-weighted spectral centroid of Hann-windowed 2048-sample FFTs.
function centroid(data) {
  const n = 2048, re = new Float64Array(n), im = new Float64Array(n);
  let weighted = 0, magnitude = 0;
  for (let offset = 0; offset < data.length; offset += n / 2) {
    im.fill(0);
    for (let i = 0; i < n; i++) re[i] = (data[offset + i] || 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
    }
    for (let size = 2; size <= n; size *= 2) {
      const angle = -2 * Math.PI / size;
      for (let base = 0; base < n; base += size) {
        for (let k = 0; k < size / 2; k++) {
          const a = base + k, b = a + size / 2, c = Math.cos(k * angle), s = Math.sin(k * angle);
          const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
    for (let k = 1; k <= n / 2; k++) {
      const mag = Math.hypot(re[k], im[k]);
      weighted += mag * k * sampleRate / n; magnitude += mag;
    }
  }
  return magnitude ? weighted / magnitude : 0;
}
function wav(data) {
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  return bytes;
}
fs.mkdirSync(output, { recursive: true });
const rows = [];
for (const name of Object.keys(DSP.SPECS)) {
  for (let v = 0; v < DSP.variations; v++) {
    const data = DSP.render(name, v, sampleRate);
    let peak = 0, power = 0;
    for (const value of data) { if (!Number.isFinite(value)) throw new Error(name + ': non-finite sample'); peak = Math.max(peak, Math.abs(value)); power += value * value; }
    const peakDB = 20 * Math.log10(peak), rmsDB = 10 * Math.log10(power / data.length);
    if (peakDB > -1 || !peak || rmsDB < -100) throw new Error(name + ': clipped or silent');
    const file = 'synth_' + name + '_' + (v + 1);
    fs.writeFileSync(path.join(output, file + '.wav'), wav(data));
    rows.push({ name: file, duration: (data.length / sampleRate).toFixed(3), peak: peakDB.toFixed(2), rms: rmsDB.toFixed(2), centroid: Math.round(centroid(data)) });
  }
}
const report = '| name | seconds | peak dBFS | RMS dBFS | centroid Hz |\n|---|---:|---:|---:|---:|\n' + rows.map(r => `| ${r.name} | ${r.duration} | ${r.peak} | ${r.rms} | ${r.centroid} |`).join('\n');
fs.writeFileSync(path.join(output, 'analysis.md'), '# Synthetic SFX analysis\n\n48 kHz mono PCM16; measurements before quantization and mix bus. Spectral centroid: magnitude-weighted Hann FFT (2048, 50% overlap). These are synthetic, not recordings; human ear-check required.\n\n' + report + '\n');
console.log(report);
console.log(`PASS: ${rows.length} deterministic synthetic WAVs; all non-silent, finite and below -1 dBFS.`);
