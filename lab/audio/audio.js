/* Integration entrypoint. Load profiles.js, dsp.js, temporal.js, engine.js,
 * then this classic script. See the R2b integration contract in R2_audio.md. */
(function (root) {
  'use strict';
  const LAB = root.LAB = root.LAB || {};
  if (LAB.materialAudioInstalled) return;
  LAB.materialAudioInstalled = true;
  if (!LAB.events) {
    const handlers = new Map();
    LAB.events = {
      on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => handlers.get(name).delete(fn); },
      emit(name, params) { for (const fn of handlers.get(name) || []) fn(params || {}); }
    };
  }
  let context, processor, engine, enabled = true, master = .65, error = '', cpu = 0, cpuMax = 0, initMs = 0;
  const times = [];
  async function init() {
    try {
      if (!context) {
        const start = performance.now();
        context = new (root.AudioContext || root.webkitAudioContext)({ latencyHint: 'interactive', sampleRate: 48000 });
        engine = new LAB.AudioEngine.Engine(context.sampleRate, undefined, LAB.audioWorldWidth); engine.setMaster(master); engine.setEnabled(enabled);
        // A classic-script/file:// baseline: no worklet modules, fetch or network.
        // Keep DSP identical to offline renders; 512 frames = 10.67 ms at 48 kHz.
        processor = context.createScriptProcessor(512, 0, 2);
        processor.onaudioprocess = event => {
          const at = performance.now();
          engine.process(event.outputBuffer.getChannelData(0), event.outputBuffer.getChannelData(1));
          const elapsed = performance.now() - at; cpu += (elapsed - cpu) * .08; cpuMax = Math.max(cpuMax, elapsed);
          times.push(elapsed); if (times.length > 300) times.shift();
        };
        processor.connect(context.destination); initMs = performance.now() - start;
      }
      await context.resume(); error = ''; return context.state === 'running';
    } catch (e) {
      error = String(e && e.message || e);
      if (processor) { processor.disconnect(); processor.onaudioprocess = null; }
      if (context) context.close().catch(() => {});
      processor = context = engine = null; return false;
    }
  }
  // x uses the lab's 720-wide world coordinates. Set LAB.audioWorldWidth before
  // init() for another world width (1 also permits normalized coordinates).
  for (const name of ['strain', 'release', 'settle', 'wave', 'cut', 'crack_grow', 'peel', 'wobble', 'flow', 'impact', 'press', 'crumble', 'kill', 'horde', 'synth_preview']) {
    LAB.events.on(name, params => { if (engine && enabled && context.state === 'running') engine.emit(name, params); });
  }
  LAB.audio = {
    init,
    planWave: LAB.AudioTemporal.planWave,
    setEnabled(value) { enabled = !!value; if (engine) engine.setEnabled(enabled); },
    setMaster(value) { if (!Number.isFinite(value)) return; master = Math.max(0, Math.min(1, value)); if (engine) engine.setMaster(master); },
    stats() {
      const sorted = times.slice().sort((a, b) => a - b);
      return { ready: !!engine && context.state === 'running', enabled, master, active: 0, cap: 24, maxActive: 0, aggregatedKills: 0, continuous: 0, ...engine && engine.stats(), contextState: context ? context.state : 'uninitialized', sampleRate: context ? context.sampleRate : 48000, backend: 'classic-script PCM / ScriptProcessor 512', cpuMs: cpu, cpuP95Ms: sorted[Math.floor(sorted.length * .95)] || 0, cpuMaxMs: cpuMax, initMs, callbackBudgetMs: context ? 512 / context.sampleRate * 1000 : 0, baseLatencyMs: context ? (context.baseLatency || 0) * 1000 : 0, error };
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && engine) engine.resetSound(); });
})(window);
