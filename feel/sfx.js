/* Hero-side synthetic sounds (synth_*) over the v0.3 material audio engine. The material break is the reward;
 * the hero sound is the cause: short, mid-band (phone speakers), a little quieter than the breaks.
 * v0.5: the slash has weight (low thump + air + a faint blade ring), punches alternate fists, spells bloom. */
(function(L){
  'use strict';
  const C=L.combat;let noise=null,out=null,fist=0,bound=null;
  // v0.6 hooks (inert in v0.5): C.sfxContext renders into another context (offline analysis); C.sfxGain scales every hero sound (stage mix).
  function ctx(){const c=C.sfxContext||(L.audio&&L.audio.context);if(!c||c.state!=='running'||C.muted)return null;if(c!==bound){bound=c;out=null;noise=null;}if(!out){out=c.createGain();out.gain.value=.55;const comp=c.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=4;out.connect(comp).connect(c.destination);}
    if(!noise){noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}return c;}
  const pan=x=>Math.max(-.5,Math.min(.5,((x??360)-360)/720));
  function chain(c,node,x){const g=c.createGain(),p=c.createStereoPanner?c.createStereoPanner():null;g.gain.value=0;if(p){p.pan.value=pan(x);node.connect(g).connect(p).connect(out);}else node.connect(g).connect(out);return g;}
  function nz(c,t,dur,f0,f1,q,gain,x,attack=.004){gain*=C.sfxGain??1;const s=c.createBufferSource();s.buffer=noise;const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);const g=chain(c,f,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.start(t,Math.random()*.5);s.stop(t+dur+.02);}
  function tone(c,t,dur,f0,f1,gain,x,type='sine',attack=.006){gain*=C.sfxGain??1;const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);const g=chain(c,o,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.start(t);o.stop(t+dur+.02);}
  C.sfx=(kind,at={},strong=false)=>{const c=ctx();if(!c)return;const t=c.currentTime,x=at.x;
    switch(kind){
      // ---- SLASHER ----
      case 'slash':{const k=1+Math.min(8,at.combo||1)*.035,big=at.wide?1:0,g=at.sub?.6:1;
        nz(c,t,.2+big*.06,700*k,4200*k,.8,.3*g,x,.012);           // ザシュッ (air)
        tone(c,t,.13,150,55,.26*g,x);                                // 刃の重さ (low thump)
        if(at.n)tone(c,t+.02,.22,2550*k,2380*k,.035*g,x,'triangle'); // faint ring only when it bit into something
        break;}
      case 'shock':nz(c,t,.32,1500,320,.7,.24,x,.008);tone(c,t,.22,95,40,.22,x);break;
      case 'spin':nz(c,t,.3,1200,4200,1.4,.26,x,.03);nz(c,t+.08,.22,2200,5400,1.6,.16,x,.02);if(at.big)tone(c,t,.25,120,50,.25,x);break;
      case 'clink':tone(c,t,.12,2400,2100,.1,x,'triangle');tone(c,t,.09,3700,3300,.05,x);break;
      // ---- CRUSHER ----
      case 'punch':{fist^=1;const f=(fist?185:160)*(1+Math.min(10,at.combo||1)*.02);tone(c,t,.15,f,60,.5,x);nz(c,t,.05,950,500,.8,.33,x,.001);if(at.strong)nz(c,t+.01,.14,620,280,.7,.28,x);break;} // ドン／ドッ（左右の拳）
      case 'pound':tone(c,t,.3,120,48,.5,x);nz(c,t,.22,700,240,.7,.3,x,.002);break;
      case 'heavy':tone(c,t,.42,110,36,.6,x);nz(c,t,.34,900,180,.6,.36,x,.002);nz(c,t+.05,.25,2400,700,.9,.12,x,.004);break;
      case 'quake':nz(c,t,.12,600,260,.8,.16,x,.002);break;
      case 'bank':tone(c,t,.06,900,700,.12,x,'triangle');break;
      // ---- CASTER ----
      case 'burst':{const n=Math.min(12,at.n||0),hi=at.sub?1.5:1;nz(c,t,.2,2800*hi,900,1.1,.2+n*.006,x,.003);tone(c,t,.3,880*hi,440*hi,.06,x,'sine',.004);tone(c,t+.015,.2,1320*hi,990*hi,.03,x,'sine',.004);break;} // パッ（花のように開く）
      case 'zap':nz(c,t,.16,3200,1800,3,.16,x,.001);nz(c,t+.03,.1,2600,1500,4,.1,x,.001);break;
      case 'big':tone(c,t,.5,170,50,.5,x);nz(c,t,.4,1900,500,.8,.36,x,.002);for(const [k,f] of [[0,523],[.05,784],[.1,1047]])tone(c,t+k,.6,f,f*.98,.04,x,'sine',.01);break;
      case 'charge':tone(c,t,.75,200,620,.05,x,'triangle',.08);nz(c,t,.75,500,1800,1.4,.08,x,.5);break; // 予兆
      // ---- v0.7 TEMPO: a crack that rises with each hit on the same enemy (ピキッ → ピキキッ → パキン) ----
      case 'crack':{const k=Math.min(4,at.stage||1);tone(c,t,.07+k*.015,1700*(1+k*.22),1500*(1+k*.22),.06+k*.012,x,'triangle',.002);nz(c,t,.06+k*.02,3800+k*600,2400,2.5,.09+k*.02,x,.001);break;}
      // ---- v0.8 SPINNER: the two blades, シャッ, alternating left/right, a little higher as the spin keeps going ----
      case 'twin':{fist^=1;const k=1+Math.min(20,at.combo||1)*.025;nz(c,t,.08,(fist?4200:3600)*k,(fist?6400:5600)*k,1.6,.12,x,.002);tone(c,t+.005,.06,2600*k,2400*k,.025,x,'triangle',.002);break;}
      // ---- shared ----
      case 'ko':{const n=at.n||3,base=440*Math.pow(2,Math.min(12,Math.floor(Math.log2(n)*3))/12);for(const [k,r] of [[0,1],[.06,1.25],[.12,1.5]])tone(c,t+k,.5,base*r,base*r,.05+Math.min(.06,n*.004),360,'sine');break;}
      case 'levelup':for(const [k,f] of [[0,523],[.07,659],[.14,784],[.21,1047],[.3,1319]])tone(c,t+k,.7,f,f,.07,360,'triangle');nz(c,t,.6,3000,6000,1.5,.06,360,.2);break;
      case 'pause':tone(c,t,.25,660,620,.05,360,'sine');break;
      case 'finale':nz(c,t,1.4,2000,300,.6,.3,360,.05);for(const f of [261.6,329.6,392,493.9,523.2])tone(c,t+.1,1.8,f,f,.06,360,'sine');break;
    }};
})(window.LAB);
