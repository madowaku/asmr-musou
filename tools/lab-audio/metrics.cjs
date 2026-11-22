'use strict';
const SR = 48000;
const db = power => 10 * Math.log10(Math.max(power, 1e-20));
function bands(data, sr = SR) {
  const n = 2 ** Math.ceil(Math.log2(data.length));
  const re = new Float64Array(n), im = new Float64Array(n); re.set(data);
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) [re[i], re[j]] = [re[j], re[i]]; }
  for (let size = 2; size <= n; size *= 2) {
    const angle = -2 * Math.PI / size;
    for (let k = 0; k < size / 2; k++) {
      const c = Math.cos(k * angle), s = Math.sin(k * angle);
      for (let base = 0; base < n; base += size) { const a = base + k, b = a + size / 2, tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; }
    }
  }
  let total = 0, phone = 0, high = 0;
  for (let i = 0; i <= n / 2; i++) { const p = (re[i] ** 2 + im[i] ** 2) * (i === 0 || i === n / 2 ? 1 : 2), hz = i * sr / n; total += p; if (hz >= 500 && hz <= 8000) phone += p; if (hz > 9000) high += p; }
  return { total, phone, high };
}
function filter(input, b, a) {
  const out = new Float64Array(input.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) { const x = input[i], y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; out[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y; }
  return out;
}
function kWeight(input) {
  // BS.1770 K weighting at exactly 48 kHz. No loudness gate on a 400 ms window.
  const shelf = filter(input, [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, .73248077421585]);
  return filter(shelf, [1, -2, 1], [-1.99004745483398, .99007225036621]);
}
function maxPower(channels, samples) {
  let sum = 0, max = 0;
  for (let i = 0; i < channels[0].length + samples; i++) {
    for (const x of channels) { if (i < x.length) sum += x[i] ** 2; if (i >= samples && i - samples < x.length) sum -= x[i - samples] ** 2; }
    max = Math.max(max, sum / samples);
  }
  return max;
}
function metrics(channels) {
  let peak = 0, first = 0, total = 0, phone = 0, high = 0, running = 0, max = -1, peakMs = 0;
  const n150 = SR * .15, win = SR * .001;
  for (let i = 0; i < channels[0].length; i++) {
    for (const x of channels) {
      if (!Number.isFinite(x[i])) throw new Error('Non-finite sample');
      peak = Math.max(peak, Math.abs(x[i])); if (i < n150) first += x[i] ** 2;
      running += x[i] ** 2; if (i >= win) running -= x[i - win] ** 2;
    }
    if (i >= win - 1 && running > max) { max = running; peakMs = (i - win + 1) / SR * 1000; }
  }
  for (const x of channels) { const b = bands(x); total += b.total; phone += b.phone; high += b.high; }
  return { duration: channels[0].length / SR, peakDb: db(peak * peak), rms150Db: db(first / n150 / channels.length), phonePct: phone / total * 100, high9kPct: high / total * 100, peakMs, rms400Db: db(maxPower(channels, SR * .4) / channels.length), momentary400LUFS: -.691 + db(maxPower(channels.map(kWeight), SR * .4)) };
}
function maxGap(channels, start, end, thresholdDb = -65) {
  const hop = Math.round(SR * .005), threshold = 10 ** (thresholdDb / 10); let gap = 0, max = 0;
  for (let i = Math.round(start * SR); i < end * SR; i += hop) {
    let p = 0; for (const x of channels) for (let j = i; j < Math.min(i + hop, x.length); j++) p += x[j] ** 2;
    if (p / hop / channels.length < threshold) gap += 5; else gap = 0;
    max = Math.max(max, gap);
  }
  return max;
}
function wav(channels) {
  const n = channels[0].length, count = channels.length, out = Buffer.alloc(44 + n * count * 2);
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(count, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * count * 2, 28); out.writeUInt16LE(count * 2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * count * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < count; c++) { if (Math.abs(channels[c][i]) > 1) throw new Error('Clipping before PCM export'); out.writeInt16LE(Math.round(channels[c][i] * 32767), 44 + (i * count + c) * 2); }
  return out;
}
module.exports = { SR, metrics, maxGap, wav, maxPower };
