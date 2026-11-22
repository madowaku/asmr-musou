// Before/after: the same "intent" player on v0.4 (combat.html) and v0.5 (feel.html).
// The intent player looks at a clump and touches it: SLASHER swipes through it, CRUSHER/CASTER tap it.
// Measures: did the enemy I aimed at get hit — broken, damaged, squashed or launched (≤0.6 s)? how long until something broke? inputs ignored? kills per input.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1,2,3,4').split(',').map(Number);
const browser=await chromium.launch({channel:'chrome'});const errors=[];
async function open(file,global){const page=await browser.newPage();page.on('pageerror',e=>errors.push(file+': '+String(e.stack||e)));await page.goto(pathToFileURL(path.join(root,file)).href);await page.waitForFunction(g=>window[g],global,{timeout:20000});return page;}
const harness=([ver,cls,seed])=>{
  const W=LAB.world,isV5=ver==='v05',API=isV5?FEEL:COMBAT,G=API.state,C=API.test.C,step=API.test.step;
  G.headless=true;API.start(cls,seed);const broken=new Map(),ob=W.onBreak;W.onBreak=(b,o)=>{if(!broken.has(b.id))broken.set(b.id,G.t);ob(b,o);};
  let s=seed*7919>>>0;const rng=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);const d2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const intents=[],script=[];let cd=.3,n=0,dropped=0;const breaksAt=[];
  const ob2=W.onBreak;W.onBreak=(b,o)=>{breaksAt.push(G.t);ob2(b,o);};
  while(G.state==='play'&&n<62*60){
    while(script.length&&script[0].at<=G.t+1e-9)script.shift().f();
    step(1/60);n++;cd-=1/60;for(const r of intents)if(!r.touched&&G.t-r.t<=.6&&(r.e.flying||r.e.pressing||r.e.hp<r.hp||broken.has(r.e.id)))r.touched=true;if(isV5&&G.paused)continue;
    if(cd>0||script.length)continue;cd=.4;
    const en=W.enemies().filter(e=>!C.locked(e)&&!e.flying);if(!en.length)continue;
    const boss=G.boss&&!G.bossDown?en.filter(e=>e.bossPart):[];
    let t;if(boss.length)t=boss[Math.floor(rng()*boss.length)];else{const sc=en.map(e=>({e,n:en.filter(o=>d2(o,e)<130).length})).sort((a,b)=>b.n-a.n);t=sc[Math.floor(rng()*Math.min(3,sc.length))].e;}
    const rec={e:t,hp:t.hp,t:G.t,acts:G.stats.actions};intents.push(rec);const h=API.test.hero();
    if(cls==='slasher'){const a=rng()*6.283,u={x:Math.cos(a),y:Math.sin(a)},A={x:t.x-u.x*110,y:t.y-u.y*110},B={x:t.x+u.x*110,y:t.y+u.y*110};
      if(isV5){const P=API.test.input;P.down(A);for(let i=1;i<=5;i++){const q={x:A.x+(B.x-A.x)*i/5,y:A.y+(B.y-A.y)*i/5};script.push({at:G.t+.02*i,f:()=>P.move(q)});}script.push({at:G.t+.11,f:()=>P.up(B)});}
      else{const ok=C.flick(h,[{x:0,y:0},{x:B.x-A.x,y:B.y-A.y}]);if(!ok)dropped++;}}
    else{if(isV5){const P=API.test.input;P.down({x:t.x,y:t.y});script.push({at:G.t+.05,f:()=>P.up({x:t.x,y:t.y})});}
      else{const ok=C.tap(h);if(!ok)dropped++;}}
  }
  // evaluate each intent
  let hit=0,lat=[],fired=0;for(let i=0;i<intents.length;i++){const r=intents[i],bt=broken.get(r.e.id);const damaged=(bt!=null&&bt<=r.t+.6)||r.touched;if(damaged)hit++;
    const nb=breaksAt.find(x=>x>=r.t);if(nb!=null&&nb-r.t<=.6)lat.push(nb-r.t);}
  lat.sort((a,b)=>a-b);const st=G.stats;W.onBreak=ob;
  const res={ver,cls,seed,inputs:intents.length,targetHit:hit/intents.length,latencyMedian:lat.length?lat[Math.floor(lat.length/2)]:null,noBreakWithin06:1-lat.length/intents.length,dropped:dropped/intents.length,kills:st.kills,actions:st.actions,killsPerInput:st.kills/intents.length,bossDown:!!st.bossDefeated,seconds:G.t};
  G.headless=false;G.state='select';W.clear();return res;};
const v04=await open('combat.html','COMBAT'),v05=await open('feel.html','FEEL');const rows=[];
for(const seed of seeds)for(const cls of ['slasher','crusher','caster'])for(const [ver,page] of [['v04',v04],['v05',v05]]){const r=await page.evaluate(harness,[ver,cls,seed]);rows.push(r);
  console.log(ver,cls.padEnd(8),'s'+seed,'target hit',(r.targetHit*100).toFixed(0).padStart(3)+'%','lat',r.latencyMedian?.toFixed(3),'no-break',(r.noBreakWithin06*100).toFixed(0)+'%','ignored',(r.dropped*100).toFixed(0)+'%','kills/input',r.killsPerInput.toFixed(2),'kills',r.kills,'boss',r.bossDown);}
// aggregate
const agg={};for(const r of rows){const k=r.ver+' '+r.cls;(agg[k]=agg[k]||[]).push(r);}
console.log('\n== mean over seeds ==');const summary=[];
for(const [k,rs] of Object.entries(agg)){const m=f=>rs.reduce((s,r)=>s+f(r),0)/rs.length;const o={key:k,targetHit:m(r=>r.targetHit),latency:m(r=>r.latencyMedian||0),noBreak:m(r=>r.noBreakWithin06),ignored:m(r=>r.dropped),killsPerInput:m(r=>r.killsPerInput),bossDown:rs.filter(r=>r.bossDown).length+'/'+rs.length};summary.push(o);
  console.log(k.padEnd(12),'target hit',(o.targetHit*100).toFixed(0)+'%','latency',(o.latency*1000).toFixed(0)+'ms','no-break',(o.noBreak*100).toFixed(0)+'%','ignored',(o.ignored*100).toFixed(0)+'%','kills/input',o.killsPerInput.toFixed(2),'boss',o.bossDown);}
await writeFile(path.join(root,'research/v05/compare.json'),JSON.stringify({rows,summary},null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,3));process.exit(1);}
