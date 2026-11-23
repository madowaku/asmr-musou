// Is the stage's new material audible, or buried under the hero sounds and the other materials?
// One deterministic run per stage × class (intent bot). Every audio event and hero sound is recorded on the real-time
// clock (G.rt), then rendered OFFLINE twice from the same gameplay: the v0.5 mix (no focus, hero sounds at full level)
// and the v0.6 stage mix. Stems: each material through the real v0.3 engine (other voices kept in the voice cap at
// inaudible gain, so drops/aggregation match the full mix), hero sounds through feel/sfx.js in an OfflineAudioContext.
// Per 50 ms window: F = lead material, O = other materials, H = hero sounds.
//   clarity = 10·log10(F / (O + H)) over windows where the lead material sounds;  buried = share of those windows with F < O + H.
// An energy ratio, not a perceptual masking model: a proxy for "is it in front". Output: research/v06/mix.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const stages=(process.argv[2]||'1,2,3').split(',').map(Number),classes=(process.argv[3]||'slasher,crusher,caster').split(','),seed=+(process.argv[4]||1),outName=process.argv[5]||'mix.json';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:360,height:640}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
await page.goto(pathToFileURL(path.join(root,'stages.html')).href);await page.waitForFunction(()=>window.STAGES);
await page.evaluate(()=>{
  const L=window.LAB,C=L.combat,G=STAGES.state,SR=48000,WIN=.05;window.__bank=window.__bank||L.AudioDSP.makeBank(SR);
  const FWD=new Set(['strain','release','settle','wave','cut','crack_grow','peel','wobble','flow','impact','crumble','kill','horde']);
  const clamp01=v=>Math.max(0,Math.min(1,v));
  function adapt(name,p){if((name==='cut'||name==='kill')&&p.waveManaged)return null;if(name==='crack_grow'&&p.rate===undefined)return {...p,rate:Math.min(400,(p.growthRate||0)/18)};
    if(name==='impact'&&p.energy===undefined)return {...p,energy:clamp01((p.speed||0)/900),size:p.size??Math.sqrt(p.area||400)/30};if(name==='peel'&&p.size===undefined)return {...p,size:Math.sqrt(p.area||100)/20};return p;}
  window.__record=(cls,seed,stage)=>{const ev=[],sfx=[],tl=[],origSfx=C.sfx;
    const off=L.events.on('*',e=>{if(!FWD.has(e.name))return;const a=adapt(e.name,e);if(!a)return;let p;try{p=JSON.parse(JSON.stringify(a));}catch(_){return;}ev.push({t:G.rt,name:e.name,p,mix:C.mix?{...C.mix}:null});});
    C.sfx=(kind,at={},strong=false)=>{sfx.push({t:G.rt,kind,at:{x:at.x,combo:at.combo,n:at.n,strong:at.strong,wide:at.wide,sub:at.sub,big:at.big},strong,g:C.sfxGain??1});return origSfx(kind,at,strong);};
    const origStep=STAGES.test.step;
    // timeline of phases on the real-time clock (simulate() calls step internally; sample through the bot hook)
    const r=(()=>{const s0=G.bot;return STAGES.test.simulate(cls,seed,'intent',{stage});})();
    off();C.sfx=origSfx;window.__rec={ev,sfx,dur:r.seconds+1,stage,cls,result:{kills:r.kills,actions:r.actions,byMaterial:r.byMaterial,bossTime:r.bossTime,ups:r.ups}};
    return {events:ev.length,sfx:sfx.length,dur:r.seconds};};
  // material stems (energy per window); mode 'v05' = no focus mix, 'v06' = recorded C.mix
  window.__renderMat=(stem,mode)=>{const R=window.__rec,E=new L.AudioEngine.Engine(SR,window.__bank,720);E.setMaster(.65);
    const n=Math.ceil(R.dur/WIN),acc=new Float64Array(n),Lb=new Float32Array(512),Rb=new Float32Array(512);let i=0,sample=0;
    const run=until=>{while(E.sample/SR<until){E.process(Lb,Rb);for(let k=0;k<512;k++){const w=Math.floor((sample+k)/SR/WIN);if(w<n)acc[w]+=Lb[k]*Lb[k]+Rb[k]*Rb[k];}sample+=512;}};
    for(const e of R.ev){run(e.t);const cont=e.name==='strain'||e.name==='wobble'||e.name==='flow';if(stem&&cont&&e.p.material!==stem)continue;if(mode==='v05'&&e.p.bossKnock)continue; // v0.5 had no material knock on boss hits
      C.mix=mode==='v06'?e.mix:null;C.stem=stem;try{E.emit(e.name,e.p);}finally{C.stem=null;C.mix=null;}}
    run(R.dur);return Array.from(acc);};
  window.__renderHero=async mode=>{const R=window.__rec,oc=new OfflineAudioContext(2,Math.ceil(R.dur*SR),SR);let now=0;
    const proxy={state:'running',sampleRate:SR,get currentTime(){return now;},destination:oc.destination};
    for(const k of ['createGain','createDynamicsCompressor','createBuffer','createStereoPanner','createBufferSource','createBiquadFilter','createOscillator'])proxy[k]=(...a)=>oc[k](...a);
    const saved=C.sfxGain;C.sfxContext=proxy;for(const s of R.sfx){now=s.t;C.sfxGain=mode==='v06'?s.g:1;C.sfx(s.kind,s.at,s.strong);}C.sfxContext=null;C.sfxGain=saved;
    const buf=await oc.startRendering(),a=buf.getChannelData(0),b=buf.getChannelData(1),n=Math.ceil(R.dur/WIN),acc=new Float64Array(n);
    for(let k=0;k<a.length;k++){const w=Math.floor(k/SR/WIN);if(w<n)acc[w]+=a[k]*a[k]+b[k]*b[k];}return Array.from(acc);};
  window.__phaseOf=()=>{};
});
const PH=[['solo',0,12],['mix',12,24],['blend',24,36]];
const rows=[];
for(const st of stages)for(const cls of classes){
  const info=await page.evaluate(([c,s,n])=>__record(c,s,n),[cls,seed,st]);
  const meta=await page.evaluate(()=>({stage:__rec.stage,mats:STAGES.test.C.stages.get(__rec.stage),bossRt:null,ev:__rec.ev.map(e=>[e.t,e.mix?e.mix.phase:null])}));
  const lead=meta.mats.mat,mats=[lead,...meta.mats.known];
  const res={};
  for(const mode of ['v05','v06']){const st2={};for(const m of mats){const t0=Date.now();st2[m]=await page.evaluate(([m,mode])=>__renderMat(m,mode),[m,mode]);if(process.env.MIXDBG)console.error(cls,mode,m,Date.now()-t0,'ms');}const t1=Date.now();st2.hero=await page.evaluate(mode=>__renderHero(mode),mode);if(process.env.MIXDBG)console.error(cls,mode,'hero',Date.now()-t1,'ms');res[mode]=st2;}
  // phase per window from the recorded v0.6 mix phases (real-time clock)
  const n=res.v05.hero.length,phase=new Array(n).fill(null);{let j=0;const ev=meta.ev;for(let w=0;w<n;w++){const t=(w+.5)*.05;while(j+1<ev.length&&ev[j+1][0]<=t)j++;phase[w]=ev.length?ev[j][1]:null;}}
  const out={stage:st,cls,lead,events:info.events,sfx:info.sfx,dur:info.dur};
  for(const mode of ['v05','v06']){const S=res[mode],F=S[lead],peak=Math.max(...F);const by={};
    for(const ph of ['solo','mix','blend','boss','all']){const ratios=[];let buried=0,act=0,eF=0,eO=0,eH=0;
      for(let w=0;w<n;w++){if(ph!=='all'&&phase[w]!==ph)continue;const O=mats.slice(1).reduce((s,m)=>s+S[m][w],0),H=S.hero[w];eF+=F[w];eO+=O;eH+=H;
        if(F[w]<peak*1e-3)continue;act++;const r=10*Math.log10(F[w]/(O+H+1e-12));ratios.push(r);if(F[w]<O+H)buried++;}
      ratios.sort((a,b)=>a-b);by[ph]={windows:act,clarityMedian:ratios.length?+ratios[Math.floor(ratios.length/2)].toFixed(1):null,buried:act?+(buried/act).toFixed(3):null,
        leadShare:+(eF/(eF+eO+eH+1e-12)).toFixed(3),heroShare:+(eH/(eF+eO+eH+1e-12)).toFixed(3),otherShare:+(eO/(eF+eO+eH+1e-12)).toFixed(3)};}
    out[mode]=by;}
  rows.push(out);await mkdir(path.join(root,'research/v06'),{recursive:true});await writeFile(path.join(root,'research/v06',outName),JSON.stringify(rows,null,1)); // written after every case
  const f=(m,ph)=>{const b=out[m][ph];return b&&b.windows?`${String(b.clarityMedian).padStart(5)}dB 埋${(b.buried*100).toFixed(0).padStart(3)}% 主${(b.leadShare*100).toFixed(0).padStart(3)}% 他${(b.otherShare*100).toFixed(0).padStart(3)}% 技${(b.heroShare*100).toFixed(0).padStart(3)}%`:'   —';};
  for(const ph of ['solo','mix','blend','boss'])console.log(`S${st} ${cls.padEnd(8)} ${ph.padEnd(5)} v05 ${f('v05',ph)} | v06 ${f('v06',ph)}`);
}
await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
