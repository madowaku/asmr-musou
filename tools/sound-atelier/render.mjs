/* Render only project-owned game cues. Usage: node tools/sound-atelier/render.mjs <Lumina checkout> <fresh WAV folder> */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [checkoutArg, exportsArg, reuse] = process.argv.slice(2);
if (!checkoutArg || !exportsArg) throw Error('Pass the pinned Lumina checkout and a fresh WAV folder');
const checkout = resolve(checkoutArg), exportsDir = resolve(exportsArg);
const root = new URL('../../', import.meta.url);
const { upstream, cues } = JSON.parse(readFileSync(new URL('cues.json', import.meta.url)));
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (actual !== upstream) throw Error('Expected Lumina ' + upstream + ', got ' + actual);
const sounds = new Map(JSON.parse(readFileSync(join(checkout, 'catalog.json'))).sounds.map(sound => [sound.id, sound]));
const assets = {}, beds = {}, manifest = [];
mkdirSync(exportsDir, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

for (const cue of cues) {
  const entry = sounds.get(cue.id);
  if (!entry) throw Error('Unknown recipe ' + cue.id);
  const recordings = [entry.recording, ...(entry.additionalRecordings || [])].filter(Boolean);
  if (recordings.some(record => record.license !== 'CC0-1.0')) throw Error('Review recording license for ' + cue.id);
  const args = ['scripts/remix.mjs', cue.id, '--id', cue.name, '--punch', String(cue.punch),
    '--pitchShift=' + cue.pitch, '--space', 'dry', '--wetness', '0', '--format', 'wav', '--dest', exportsDir];
  const file = join(exportsDir, cue.name + '.wav');
  if (reuse !== '--reuse-wav') {
    const result = JSON.parse(execFileSync(process.execPath, args, { cwd: checkout, encoding: 'utf8' }));
    if (!result.pass) throw Error(JSON.stringify(result));
  }
  const loop = /^(bed|pressure)-/.test(cue.name), sr = loop ? 12000 : 24000;
  const bytes = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1',
    '-af', `highpass=f=${cue.highpass},lowpass=f=${cue.lowpass}`, '-ar', String(sr), '-f', 's16le', 'pipe:1']);
  const pcm = Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(i * 2) / 32768);
  const peak = pcm.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const onset = loop ? 0 : Math.max(0, pcm.findIndex(sample => Math.abs(sample) > peak * .045) - Math.round(sr * .002));
  let samples = pcm.slice(onset + Math.round(cue.skip * sr), onset + Math.round((cue.skip + cue.seconds) * sr));
  if (samples.length < sr * .04 || peak < .0001) throw Error('Silent or short render: ' + cue.name);
  if (loop) {
    const seam = Math.min(Math.floor(samples.length / 5), Math.round(sr * .16));
    const end = samples.length - seam;
    for (let i = 0; i < seam; i++) {
      const t = i / (seam - 1);
      samples[end + i] = samples[end + i] * (1 - t) + samples[i] * t;
    }
    samples = samples.slice(seam);
  } else {
    const attack = Math.round(sr * .002), release = Math.round(sr * .016);
    samples = samples.map((sample, i) => sample * Math.min(1, i / attack, (samples.length - i - 1) / release));
  }
  const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
  const clippedPeak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const wanted = cue.name.startsWith('bed-') ? .035 : loop ? .068 : .125;
  const gain = Math.min(wanted / rms, .68 / clippedPeak);
  const output = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, i) => output.writeInt16LE(Math.round(sample * gain * 32767), i * 2));
  (cue.name.startsWith('bed-') ? beds : assets)[cue.name] = [sr, output.toString('base64')];
  manifest.push({ ...cue, recipe: entry.file, recordings, sampleRate: sr, frames: samples.length,
    sourceWavSha256: sha(readFileSync(file)), pcmSha256: sha(output) });
  console.log(cue.name, entry.id, (samples.length / sr).toFixed(3) + 's');
}

const target = new URL('studio/sound/', root);
mkdirSync(target, { recursive: true });
writeFileSync(new URL('assets.js', target), '/* Generated game PCM from tools/sound-atelier/render.mjs. */\nwindow.StudioSoundAssets = ' + JSON.stringify(assets, null, 2) + ';\n');
for (const [name, data] of Object.entries(beds)) {
  writeFileSync(new URL(name + '.js', target), '/* Generated stage ambience PCM. */\nwindow.StudioSoundAssets[' +
    JSON.stringify(name) + '] = ' + JSON.stringify(data) + ';\n');
}
writeFileSync(new URL('docs/v1.4/SOUND_SOURCES.json', root), JSON.stringify({ upstream, assets: manifest }, null, 2) + '\n');
