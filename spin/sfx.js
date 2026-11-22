/* SPIN LAB synthetic sounds. Breaks use the v0.3 material audio engine (via world events); these are the
 * contrasts: soft collection (ぽふっ / こぽんっ), growth chime, a lost item, a muffled bump. Mid-band, quiet,
 * rate-limited so a rush never stacks into a harsh wall. */
(function(L){
  'use strict';
  const S=L.spin=L.spin||{};let noise=null,out=null;const last={};
  function ctx(){const c=L.audio&&L.audio.context;if(!c||c.state!=='running'||S.muted)return null;if(!out){out=c.createGain();out.gain.value=.5;const comp=c.createDynamicsCompressor();comp.threshold.value=-22;comp.ratio.value=4;out.connect(comp).connect(c.destination);}
    if(!noise){noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}return c;}
  const pan=x=>Math.max(-.6,Math.min(.6,((x??360)-360)/600));
  function chain(c,node,x){const g=c.createGain(),p=c.createStereoPanner?c.createStereoPanner():null;g.gain.value=0;if(p){p.pan.value=pan(x);node.connect(g).connect(p).connect(out);}else node.connect(g).connect(out);return g;}
  function nz(c,t,dur,f0,f1,q,gain,x,type='bandpass',attack=.004){const s=c.createBufferSource();s.buffer=noise;const f=c.createBiquadFilter();f.type=type;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);const g=chain(c,f,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.start(t,Math.random()*.5);s.stop(t+dur+.02);}
  function tone(c,t,dur,f0,f1,gain,x,type='sine',attack=.006){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);const g=chain(c,o,x);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.start(t);o.stop(t+dur+.02);}
  const GAP={bump:.08,shard:.03,whoosh:.12};
  S.sfx=(kind,at={},lv=0)=>{const c=ctx();if(!c)return;const now=c.currentTime;if(GAP[kind]&&now-(last[kind]||0)<GAP[kind])return;last[kind]=now;const t=now,x=at.x;
    switch(kind){
      case 'collect': // ぽふっ (soft cloth catch) + こぽんっ (bubble)
        nz(c,t,.16,520,180,.7,.34,x,'lowpass',.01);tone(c,t,.14,300,170,.22,x,'sine',.01);
        tone(c,t+.07,.12,520,1150,.16,x,'sine',.004);tone(c,t+.11,.1,780,1500,.07,x,'sine',.004);break;
      case 'levelup':{const base=[392,494,587,784];base.forEach((f,i)=>tone(c,t+.18+i*.07,.7,f*(1+lv*.06),f*(1+lv*.06),.06,360,'triangle',.01));nz(c,t+.15,.6,2500,6000,2,.05,360,'bandpass',.2);break;}
      case 'itemBreak': // a small glassy loss, clearly not a reward
        tone(c,t,.18,1900,1500,.07,x,'triangle');tone(c,t+.03,.22,1420,980,.06,x,'triangle');nz(c,t,.12,5200,3000,3,.06,x);tone(c,t+.08,.35,330,262,.05,x,'sine',.02);break;
      case 'miss':tone(c,t,.25,620,440,.04,x,'sine',.02);break;
      case 'bump':tone(c,t,.12,150,90,.22,x,'sine',.003);nz(c,t,.08,500,240,.8,.12,x,'lowpass');break;
      case 'shard':nz(c,t,.06,6200,4200,4,.06,x,'bandpass',.002);break;
      case 'whoosh':nz(c,t,.2,900,3400,1.1,.05+.02*lv,x,'bandpass',.05);break;
      case 'end':for(const f of [261.6,329.6,392,523.2])tone(c,t+.05,1.6,f,f,.05,360,'sine',.05);break;
    }};
})(window.LAB);
