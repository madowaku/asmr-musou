/* Hero-side synthetic sounds (synth_*), layered over the v0.3 material audio engine. Kept short, mid-band
 * (phone speakers) and quieter than the material breaks: the material is the reward, the hero is the cause. */
(function(L){
  'use strict';
  const C=L.combat;let noise=null,out=null;
  function ctx(){const c=L.audio&&L.audio.context;if(!c||c.state!=='running'||C.muted)return null;if(!out){out=c.createGain();out.gain.value=.55;const comp=c.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=4;out.connect(comp).connect(c.destination);}
    if(!noise){noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}return c;}
  const pan=x=>Math.max(-.5,Math.min(.5,((x??360)-360)/720));
  function chain(c,node,gain,x){const g=c.createGain(),p=c.createStereoPanner?c.createStereoPanner():null;g.gain.value=0;if(p){p.pan.value=pan(x);node.connect(g).connect(p).connect(out);}else node.connect(g).connect(out);return g;}
  function nz(c,t,dur,f0,f1,q,gain,x,attack=.004){const s=c.createBufferSource();s.buffer=noise;const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);const g=chain(c,f,gain,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.start(t,Math.random()*.5);s.stop(t+dur+.02);}
  function tone(c,t,dur,f0,f1,gain,x,type='sine'){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);const g=chain(c,o,gain,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.006);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.start(t);o.stop(t+dur+.02);}
  C.sfx=(kind,at={},strong=false)=>{const c=ctx();if(!c)return;const t=c.currentTime,x=at.x;
    switch(kind){
      case 'dash':nz(c,t,.16,1400,5200,1.2,.22,x,.02);break;                                   // シュッ
      case 'charge-release':nz(c,t,.26,900,6000,.9,.32,x,.01);tone(c,t,.18,520,1300,.08,x,'triangle');break;
      case 'spin':nz(c,t,.3,1200,4200,1.4,.26,x,.03);nz(c,t+.08,.22,2200,5400,1.6,.16,x,.02);break;
      case 'clink':tone(c,t,.12,2400,2100,.12,x,'triangle');tone(c,t,.09,3700,3300,.06,x);break; // 弾かれる
      case 'punch':tone(c,t,.16,strong?150:180,60,.5,x);nz(c,t,.05,900,500,.8,.35,x,.001);if(strong)nz(c,t+.01,.12,600,300,.7,.25,x);break; // ドン
      case 'pound':tone(c,t,.3,120,48,.5,x);nz(c,t,.22,700,240,.7,.3,x,.002);break;
      case 'bank':tone(c,t,.06,900,700,.12,x,'triangle');break;
      case 'zap':nz(c,t,.18,3200,1800,3,.22,x,.001);nz(c,t+.03,.12,2600,1500,4,.14,x,.001);break;  // バチッ
      case 'well':tone(c,t,.85,300,90,.16,x,'triangle');nz(c,t,.85,500,1600,1.4,.12,x,.5);break;   // 吸い込み（予兆）
      case 'implode':tone(c,t,.35,160,55,.45,x);nz(c,t,.3,1800,600,.8,.35,x,.002);break;
      case 'ko':{const n=at.n||3,base=440*Math.pow(2,Math.min(12,Math.floor(Math.log2(n)*3))/12);for(const [k,r] of [[0,1],[.06,1.25],[.12,1.5]])tone(c,t+k,.5,base*r,base*r,.06+Math.min(.06,n*.004),360,'sine');break;}
      case 'perfect':for(const [k,f] of [[0,659],[.08,784],[.16,988],[.24,1319]])tone(c,t+k,.6,f,f,.08,360,'triangle');break;
      case 'finale':nz(c,t,1.4,2000,300,.6,.3,360,.05);for(const f of [261.6,329.6,392,493.9,523.2])tone(c,t+.1,1.8,f,f,.06,360,'sine');break;
      case 'deny':tone(c,t,.08,300,260,.08,x,'square');break;
    }};
})(window.LAB);
