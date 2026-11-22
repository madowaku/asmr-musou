'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DSP = require('../audio.js');
const sampleRate = 48000;
const output = path.resolve(__dirname, '../assets_audio_preview');
// Acceptance targets are independent of the synthesis implementation.
const hitNames = ['wax_crack', 'bubble_pop', 'ice_crack', 'jelly_wobble', 'boss_core', 'boss_thud'];
const specialTargets = { boss_final: -17, squish_creak: -26, slash_finisher: -24 };
const target = name => specialTargets[name] ?? (hitNames.includes(name) ? -21 : -19);
// Full-buffer zero-padded FFT power. No Hann window: preserve the initial snap's energy.
function bands(data) {
  const n = 2 ** Math.ceil(Math.log2(data.length));
  const re = new Float64Array(n), im = new Float64Array(n); re.set(data);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = -2 * Math.PI / size;
    for (let k = 0; k < size / 2; k++) {
      const c = Math.cos(k * angle), s = Math.sin(k * angle);
      for (let base = 0; base < n; base += size) {
        const a = base + k, b = a + size / 2;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  let total = 0, phone = 0, snap = 0;
  for (let k = 0; k <= n / 2; k++) {
    const power = (re[k] ** 2 + im[k] ** 2) * (k === 0 || k === n / 2 ? 1 : 2), hz = k * sampleRate / n;
    total += power;
    if (hz >= 500 && hz <= 8000) phone += power;
    if (hz >= 2000 && hz <= 8000) snap += power;
  }
  return { phone: phone / total * 100, snap: snap / total * 100 };
}
function metrics(data) {
  let peak = 0, first = 0, running = 0, maxWindow = -1, peakTime = 0;
  const win = Math.round(sampleRate * .001), count150 = Math.round(sampleRate * .15);
  for (let i = 0; i < data.length; i++) {
    const value = data[i]; if (!Number.isFinite(value)) throw new Error('non-finite sample');
    peak = Math.max(peak, Math.abs(value)); if (i < count150) first += value ** 2;
    running += value ** 2; if (i >= win) running -= data[i - win] ** 2;
    if (i >= win - 1 && running > maxWindow) { maxWindow = running; peakTime = (i - win + 1) / sampleRate * 1000; }
  }
  return { duration: data.length / sampleRate, peak: 20 * Math.log10(peak), rms: 10 * Math.log10(first / count150), peakTime, ...bands(data) };
}
function wav(data) {
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) bytes.writeInt16LE(Math.round(data[i] * 32767), 44 + i * 2);
  return bytes;
}
const rows = [], failures = [];
fs.mkdirSync(output, { recursive: true });
for (const name of Object.keys(DSP.SPECS)) {
  if (DSP.variations < 3) failures.push(name + ': fewer than 3 variations');
  for (let v = 0; v < DSP.variations; v++) {
    const data = DSP.render(name, v, sampleRate), m = metrics(data), file = 'synth_' + name + '_' + (v + 1);
    const tolerance = ['squish_creak', 'slash_finisher'].includes(name) ? 3 : 2;
    if (!Number.isFinite(m.rms) || m.peak > -3) failures.push(file + ': peak/silence');
    if (m.phone < 50) failures.push(file + ': phone band <50%');
    if (Math.abs(m.rms - target(name)) > tolerance) failures.push(file + ': RMS150 target');
    if (!['squish_creak', 'slash_finisher'].includes(name) && m.peakTime > 8) failures.push(file + ': transient >8ms');
    if (name === 'bubble_pop' && (m.snap < 35 || m.peakTime >= 3)) failures.push(file + ': bubble snap band/onset');
    fs.writeFileSync(path.join(output, file + '.wav'), wav(data)); rows.push({ name: file, ...m });
  }
}
const report = '| name | dur s | peak dBFS | RMS150 dBFS | phone % | 2–8k % | peak ms |\n|---|---:|---:|---:|---:|---:|---:|\n' +
  rows.map(r => `| ${r.name} | ${r.duration.toFixed(3)} | ${r.peak.toFixed(2)} | ${r.rms.toFixed(2)} | ${r.phone.toFixed(1)} | ${r.snap.toFixed(1)} | ${r.peakTime.toFixed(2)} |`).join('\n');
fs.writeFileSync(path.join(output, 'analysis.md'), '# Synthetic SFX analysis\n\n48 kHz mono PCM16 exports; measurements before quantization and mix bus. RMS150 uses a fixed 150 ms window (short sounds zero-padded). Full-buffer FFT power; phone=500–8000 Hz. Peak time=start of loudest sliding 1 ms power window. These are synthetic, not recordings; human ear-check required.\n\n' + report + '\n');
fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(report);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${rows.length} synthetic WAVs satisfy phone band, transient, RMS150 and peak gates.`);
