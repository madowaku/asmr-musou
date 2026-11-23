// v0.7 TEMPO (tempo.html) vs v0.8 FLOW (flow.html, + SPINNER): the same outside bot plays both through the real input path.
// FLOW levels up by CRUNCH ENERGY (no fixed times): the bot takes the first choice. Phases are by time for both pages,
// plus per-level numbers for FLOW (kills per action by level, when each level came and after how many kills).
// The bot is a "focus" player: it keeps attacking the enemy it chose until that enemy breaks (as a person mashing
// on one enemy would), takes the enemy nearest the line first, otherwise the clump the eye goes to. It does NOT
// try to equalise input counts: when nothing is in reach it simply waits (that wait is what we measure).
// Per phase (opening 0–12 s, growth 12–24, horde 24–boss, boss):
//   actions/s · waiting (share of time with nothing attackable) · follow-up hits (an attack on the same enemy as the
//   previous one that actually lands on it within 0.6 s) · longest run of hits on one enemy · kills per action ·
//   hits per kill (opening) · breaches. Output: research/v08/compare.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1,2,3,4').split(',').map(Number),tempos=(process.argv[3]||'mash,casual').split(',');
const TEMPO={mash:{gap:.42,jit:.08,err:25},casual:{gap:.8,jit:.25,err:35}};
const browser=await chromium.launch({channel:'chrome'});const errors=[];
async function open(file){const p=await browser.newPage({viewport:{width:360,height:640}});p.on('pageerror',e=>errors.push(file+': '+String(e.stack||e)));await p.goto(pathToFileURL(path.join(root,file)).href);await p.waitForFunction(()=>window.CRUNCH);
  await p.evaluate(()=>{const L=window.LAB,C=L.combat,W=L.world,K=C.crunch,X=window.CRUNCH,G=X.state,P=X.test.input;
    // v0.7 has no guard against a cut that throws (found here; tempo/game.js has one) — add the same guard for the measurement
    if(window.CRUNCH.version!=='v0.7-tempo'){const cut=W.cut;W.cut=(body,p,sp,opt={})=>{try{return cut(body,p,sp,opt);}catch(e){if(!W.bodies.includes(body)||body.removed)return null;const d0=body.depth;body.removed=true;if(!d0&&W.onBreak)W.onBreak(body,opt);return [];}};}
    {const h=K.hurt;K.hurt=(e,d,f,o)=>{const uid=e.uid??e.id,core=h(e,d,f,o);core.uid=uid;window.__ev&&__ev.push(['hurt',G.t,uid]);return core;};}
    {const ob=W.onBreak;W.onBreak=(b,o)=>{window.__ev&&!b.depth&&__ev.push(['kill',G.t,b.uid??b.id,o.action]);return ob(b,o);};}
    {const bg=C.begin;C.begin=(h,kind,info)=>{const r=bg(h,kind,info);window.__ev&&__ev.push(['act',G.t,h.action,window.__aim??null]);return r;};}
    const reach=b=>!b.removed&&!b.active&&b.team==='enemy'&&!b.flying&&b.y>130&&b.y<K.LINE&&!C.locked(b);
    window.__run=(cls,seed,tempo)=>{const T={mash:{gap:.42,jit:.08,err:25},casual:{gap:.8,jit:.25,err:35}}[tempo];let s=seed*7919>>>0;const rng=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
      window.__ev=[];window.__trail=new Map();const samples=[];G.headless=true;G.pickPolicy=ch=>ch[0];X.test.play(cls,seed,null);let cd=.3,aim=null,script=[],n=0,st=0;
      while(G.state==='play'&&n<75*60){
        while(script.length&&script[0].at<=G.rt+1e-9)script.shift().f();
        if(!script.length){cd-=1/60;if(cd<=0){const en=W.bodies.filter(reach);let t=aim!=null?en.find(b=>(b.uid??b.id)===aim):null;
            if(!t&&en.length){const low=en.filter(b=>!b.bossPart&&b.y>K.DANGER).sort((a,b)=>b.y-a.y);if(low.length)t=low[0];else{const boss=en.filter(b=>b.bossPart);if(boss.length)t=boss[Math.floor(rng()*boss.length)];else t=en.map(e=>({e,k:en.filter(o=>Math.hypot(o.x-e.x,o.y-e.y)<130).length})).sort((a,b)=>b.k-a.k)[0].e;}}
            if(t){aim=t.uid??t.id;window.__aim=aim;const seen=(window.__trail.get(aim)||[]).find(q=>q.t>=G.t-.25)||{x:t.x,y:t.y};/* a person reacts to where it was ~0.25 s ago */const px=seen.x+(rng()-.5)*T.err,py=seen.y+(rng()-.5)*T.err,at=G.rt;
              if(cls==='spinner'){const nb=en.filter(o=>Math.hypot(o.x-t.x,o.y-t.y)<220),cx=nb.length>=3?nb.reduce((a,o)=>a+o.x,0)/nb.length:px,cy=nb.length>=3?nb.reduce((a,o)=>a+o.y,0)/nb.length:py,Rr=nb.length>=3?130:65,a0=rng()*6.283,N=18;script.push({at,f:()=>P.down({x:cx+Math.cos(a0)*Rr,y:cy+Math.sin(a0)*Rr})});for(let i=1;i<=N;i++){const a=a0+i/N*1.25*6.283;script.push({at:at+.7*i/N,f:()=>P.move({x:cx+Math.cos(a)*Rr,y:cy+Math.sin(a)*Rr})});}script.push({at:at+.71,f:()=>P.up(null)});}
              else if(cls==='slasher'){const a=(rng()-.5)*.6,ux=Math.cos(a),uy=Math.sin(a);script.push({at,f:()=>P.down({x:px-ux*110,y:py-uy*110})});for(let i=1;i<=5;i++){const k=i/5;script.push({at:at+.1*k,f:()=>P.move({x:px-ux*110+ux*220*k,y:py-uy*110+uy*220*k})});}script.push({at:at+.11,f:()=>P.up({x:px+ux*110,y:py+uy*110})});}
              else script.push({at,f:()=>P.down({x:px,y:py})},{at:at+.05,f:()=>P.up({x:px,y:py})});
              cd=T.gap+(rng()-.5)*2*T.jit;}else{aim=null;cd=.05;}}}
        X.test.step(1/60);n++;if(n%3===0){for(const b of W.bodies){if(!reach(b))continue;const u=b.uid??b.id,l=window.__trail.get(u)||[];l.push({t:G.t,x:b.x,y:b.y});if(l.length>12)l.shift();window.__trail.set(u,l);}}
        if(!G.paused&&(st+=1/60)>=.25){st=0;samples.push([G.t,W.bodies.filter(reach).length]);}}
      const r=JSON.parse(JSON.stringify(G.stats));G.headless=false;G.state='select';W.clear();return {ev:window.__ev,samples,levelUps:r.levelUps||[],ups:r.ups,bossTime:r.bossTime,bossSecs:r.bossSecs,bossDefeated:r.bossDefeated,breaches:r.breaches.length,kills:r.kills,seconds:n/60};};});
  return p;}
const pages={'tempo':await open('tempo.html'),'flow':await open('flow.html')};
const PH=['open','grow','horde','boss'],rows=[];
const mean=a=>{const b=a.filter(x=>x!=null&&Number.isFinite(x));return b.length?b.reduce((x,y)=>x+y,0)/b.length:null;};
for(const tempo of tempos)for(const cls of ['slasher','crusher','caster','spinner'])for(const ver of Object.keys(pages))for(const seed of seeds){if(cls==='spinner'&&ver==='tempo')continue;
  const o=await pages[ver].evaluate(([c,s,t])=>__run(c,s,t),[cls,seed,tempo]);const bossT=o.bossTime??99,ph=t=>t<12?'open':t<24?'grow':t<bossT?'horde':'boss';
  const acts=o.ev.filter(e=>e[0]==='act'),hits=o.ev.filter(e=>e[0]==='hurt'||e[0]==='kill');
  const landed=a=>hits.some(h=>h[2]===a[3]&&h[1]>=a[1]-1e-6&&h[1]<=a[1]+.6);
  const out={ver,tempo,cls,seed,breaches:o.breaches,boss:o.bossDefeated,bossSecs:o.bossSecs,levelUps:o.levelUps};
  {const lvAt=t=>{if(ver==='tempo')return t<12?0:t<24?1:2;let l=0;for(const u of o.levelUps)if(t>=u.t)l=u.lv;return l;};const by=[0,1,2,3].map(()=>({a:0,k:0}));for(const a of acts){if(a[1]>=bossT)continue;by[lvAt(a[1])].a++;}for(const e of o.ev)if(e[0]==='kill'&&e[1]<bossT&&e[3]>0)by[lvAt(e[1])].k++;out.kpaLv=by.map(x=>x.a?x.k/x.a:null);}
  for(const p of PH){const A=acts.filter(a=>ph(a[1])===p),S=o.samples.filter(s=>ph(s[0])===p),dur=S.length*.25||1;
    const kills=o.ev.filter(e=>e[0]==='kill'&&ph(e[1])===p&&e[3]>0).length;
    let fol=0,folHit=0,run=0,best=0,prev=null;for(const a of A){const ok=landed(a);if(prev&&a[3]!=null&&a[3]===prev[3]){fol++;if(ok)folHit++;}
      if(ok&&prev&&a[3]===prev[3]&&prev.ok)run++;else run=ok?1:0;best=Math.max(best,run);a.ok=ok;prev=a;}
    out[p]={aps:A.length/dur,wait:S.length?S.filter(s=>s[1]===0).length/S.length:null,inReach:mean(S.map(s=>s[1])),follow:A.length?fol/A.length:null,followHit:fol?folHit/fol:null,streak:best,kpa:A.length?kills/A.length:null,actions:A.length};}
  // hits per kill in the opening: per enemy (uid) killed before 12 s, how many of its hits landed (hurts + the kill)
  const killed=o.ev.filter(e=>e[0]==='kill'&&e[1]<12);out.open.hitsPerKill=mean(killed.map(k=>o.ev.filter(e=>e[0]==='hurt'&&e[2]===k[2]).length+1));
  rows.push(out);}
const sum=[];
for(const tempo of tempos)for(const cls of ['slasher','crusher','caster','spinner'])for(const ver of Object.keys(pages)){if(cls==='spinner'&&ver==='tempo')continue;const g=rows.filter(r=>r.tempo===tempo&&r.cls===cls&&r.ver===ver);
  const o={tempo,cls,ver,runs:g.length,kpaLv:[0,1,2,3].map(i=>mean(g.map(r=>r.kpaLv[i]))),lvT:[1,2,3].map(i=>mean(g.map(r=>(r.levelUps.find(u=>u.lv===i)||{}).t))),lvKills:[1,2,3].map(i=>mean(g.map(r=>(r.levelUps.find(u=>u.lv===i)||{}).kills))),breaches:mean(g.map(r=>r.breaches)),bossDown:g.filter(r=>r.boss).length,bossSecs:mean(g.map(r=>r.bossSecs)),hitsPerKill:mean(g.map(r=>r.open.hitsPerKill))};
  for(const p of PH)o[p]=Object.fromEntries(['aps','wait','inReach','follow','followHit','streak','kpa'].map(k=>[k,mean(g.map(r=>r[p][k]))]));sum.push(o);
  const f=(x,d=1)=>x==null?'  —':x.toFixed(d).padStart(5),pc=x=>x==null?'  —':(x*100).toFixed(0).padStart(3)+'%';
  console.log(`${tempo.padEnd(6)} ${cls.padEnd(8)} ${ver.padEnd(5)} | 開幕 操作/秒${f(o.open.aps,2)} 待ち${pc(o.open.wait)} 届く敵${f(o.open.inReach)} 追撃命中${pc(o.open.followHit)} 連続${f(o.open.streak)} 打数/体${f(o.hitsPerKill)} 撃破/手${f(o.open.kpa,2)} | 成長 操作/秒${f(o.grow.aps,2)} 待ち${pc(o.grow.wait)} 撃破/手${f(o.grow.kpa,2)} | 大群 操作/秒${f(o.horde.aps,2)} 待ち${pc(o.horde.wait)} 撃破/手${f(o.horde.kpa,2)} | ボス ${o.bossDown}/${o.runs} ${f(o.bossSecs)}s 侵入${f(o.breaches)} | Lv到達 ${o.lvT.map(x=>f(x)).join('/')}秒 撃破${o.lvKills.map(x=>f(x,0)).join('/')} 撃破/手(Lv別) ${o.kpaLv.map(x=>f(x,2)).join('/')}`);}
await mkdir(path.join(root,'research/v08'),{recursive:true});await writeFile(path.join(root,'research/v08/compare.json'),JSON.stringify({seeds,tempos,summary:sum,rows},null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
