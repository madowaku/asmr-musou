/* synth_lab_click: temporary, quiet WebAudio transient, not recorded ASMR.
 * Event subscribers may replace this file. At most one click per rendered frame. */
(function(L){
  'use strict';
  if(L.audio){let enabled=true;L.audio.unlock=()=>L.audio.init?.();L.audio.toggle=()=>{enabled=!enabled;L.audio.setEnabled?.(enabled);return enabled;};return;}
  let ac,master,lastFrame=-1,enabled=true;
  L.audio={unlock(){try{if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.09;master.connect(ac.destination);}if(ac.state==='suspended')ac.resume().catch(()=>{});}catch(_){/* Audio is optional; geometry still runs. */}},toggle(){enabled=!enabled;return enabled;},get ready(){return !!ac;}};
  function synth_lab_click(e){if(!ac||!enabled||lastFrame===e.frame)return;lastFrame=e.frame;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(e.material==='jelly'?700:1400,t);o.frequency.exponentialRampToValueAtTime(300,t+.028);g.gain.setValueAtTime(.6,t);g.gain.exponentialRampToValueAtTime(.001,t+.035);o.connect(g).connect(master);o.start(t);o.stop(t+.04);o.onended=()=>{o.disconnect();g.disconnect();};}
  L.events.on('cut',synth_lab_click);L.events.on('crack_grow',synth_lab_click);
})(window.LAB);
