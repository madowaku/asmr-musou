// v0.6 SOUND STAGES (stages.html, stage 1 and 3) vs v0.7 CRUNCH LINE (crunch.html): same bots, same seeds.
// Instruments both pages from outside (C.begin, W.onBreak, W.advance) so the numbers mean the same thing:
//   opening (0–12 s): enemies on screen, hits per kill, time an enemy stays damaged before it breaks
//   growth: hits per kill of the first enemy type by number of upgrades (v0.7)
//   horde: kills per action, best single action;  defence: breaches, time with an enemy near the line
//   boss: down, seconds.   Output: research/v07/compare.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),v06=path.resolve(root,'../asmr-musou-v06s');
const seeds=(process.argv[2]||'1,2,3,4').split(',').map(Number),skills=(process.argv[3]||'intent,casual,dense,random').split(',');
const browser=await chromium.launch({channel:'chrome'});const errors=[];
async function open(file,api){const p=await browser.newPage({viewport:{width:360,height:640}});p.on('pageerror',e=>errors.push(file+': '+String(e.stack||e)));await p.goto(pathToFileURL(file).href+(api==='STAGES'?'?all=1':''));await p.waitForFunction(a=>window[a],api);
  await p.evaluate(api=>{const L=window.LAB,C=L.combat,W=L.world,X=window[api],G=X.state;let acts,samples,hurtT,killLife,frame=0;
    const ob=C.begin;C.begin=(h,kind,info)=>{const r=ob(h,kind,info);acts.set(h.action,{t:G.t,kills:0,lv:h.ups.size});return r;};
    const ok=W.onBreak;W.onBreak=(b,opt)=>{const a=acts.get(opt.action);if(a)a.kills++;if(!b.bossPart&&!b.depth&&opt.cause!=='finale')killLife.push({t:G.t,hits:b.hits||1,dmgSecs:b.firstHurt!=null?G.t-b.firstHurt:0,kind:b.kind||'grunt',lv:G.hero.ups.size});return ok(b,opt);};
    if(C.crunch){const oh=C.crunch.hurt;C.crunch.hurt=(e,d,f,o)=>{const fh=e.firstHurt??G.t,core=oh(e,d,f,o);core.firstHurt=fh;return core;};}
    const oa=W.advance;W.advance=dt=>{oa(dt);if(++frame%15)return;const line=C.crunch?C.crunch.LINE:1100,dz=line-250;let n=0,d=0,low=-1e9;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&b.y>-20&&b.y<1280){n++;if(b.y>dz)d++;}samples.push([+G.t.toFixed(2),n,d]);};
    window.__run=(cls,seed,skill,stage)=>{acts=new Map();samples=[];killLife=[];frame=0;const r=stage?X.test.simulate(cls,seed,skill,{stage}):X.test.simulate(cls,seed,skill);
      return {r:{kills:r.kills,actions:r.actions,best:r.best,bossTime:r.bossTime,bossSecs:r.bossSecs,bossDefeated:r.bossDefeated,breaches:(r.breaches||[]).length,firstKillT:r.firstKillT,hitsToKill:r.hitsToKill||null,seconds:r.seconds},acts:[...acts.values()],samples,killLife};};},api);
  return p;}
const pages={v06:await open(path.join(v06,'stages.html'),'STAGES'),v07:await open(path.join(root,'crunch.html'),'CRUNCH')};
const rows=[];
const mean=a=>{const b=a.filter(x=>x!=null&&Number.isFinite(x));return b.length?b.reduce((x,y)=>x+y,0)/b.length:null;};
for(const skill of skills)for(const cls of ['slasher','crusher','caster'])for(const [ver,stage] of [['v06',1],['v06',3],['v07',0]]){if(ver==='v06'&&(skill==='dense'||skill==='casual'))continue;
  for(const seed of seeds){const o=await pages[ver].evaluate(([c,s,k,n])=>__run(c,s,k,n),[cls,seed,skill,stage]);const R=o.r,bossT=R.bossTime??99;
    const ph=t=>t<12?'one':t<24?'grow':t<bossT?'horde':'boss';
    const byPh={};for(const a of o.acts){const p=ph(a.t);(byPh[p]=byPh[p]||[]).push(a.kills);}
    const open=o.samples.filter(s=>s[0]<12),openKills=o.killLife.filter(k=>k.t<12);
    const horde=byPh.horde||[];
    rows.push({ver,stage,cls,skill,seed,
      openOnScreen:mean(open.map(s=>s[1])),openHitsPerKill:mean(openKills.map(k=>k.hits)),openDamagedSecs:mean(openKills.map(k=>k.dmgSecs)),openKills:openKills.length,firstKill:R.firstKillT,
      weakHits:R.hitsToKill&&R.hitsToKill.weak?R.hitsToKill.weak:null,hardHits:R.hitsToKill&&R.hitsToKill.hard?R.hitsToKill.hard:null,
      hordeKPA:mean(horde),hordeBest:horde.length?Math.max(...horde):null,best:R.best,kills:R.kills,
      breaches:R.breaches,dangerShare:o.samples.length?o.samples.filter(s=>s[2]>0).length/o.samples.length:null,dangerMax:Math.max(0,...o.samples.map(s=>s[2])),
      boss:R.bossDefeated,bossSecs:R.bossSecs,seconds:R.seconds});}}
const sum=[];
for(const skill of skills)for(const cls of ['slasher','crusher','caster'])for(const [ver,stage] of [['v06',1],['v06',3],['v07',0]]){const g=rows.filter(r=>r.skill===skill&&r.cls===cls&&r.ver===ver&&r.stage===stage);if(!g.length)continue;
  const m=k=>mean(g.map(r=>r[k])),lvl=(k,i)=>mean(g.map(r=>r[k]?r[k][i]:null));
  const o={skill,cls,ver,stage,runs:g.length,openOnScreen:m('openOnScreen'),openHitsPerKill:m('openHitsPerKill'),openDamagedSecs:m('openDamagedSecs'),openKills:m('openKills'),firstKill:m('firstKill'),
    weak0:lvl('weakHits',0),weak1:lvl('weakHits',1),weak2:lvl('weakHits',2),hard2:lvl('hardHits',2),hordeKPA:m('hordeKPA'),hordeBest:m('hordeBest'),best:m('best'),kills:m('kills'),
    breaches:m('breaches'),breachRuns:g.filter(r=>r.breaches>0).length,perfect:g.filter(r=>!r.breaches).length,dangerShare:m('dangerShare'),dangerMax:m('dangerMax'),bossDown:g.filter(r=>r.boss).length,bossSecs:m('bossSecs')};
  sum.push(o);const f=x=>x==null?'  —':x.toFixed(1).padStart(5);
  console.log(`${skill.padEnd(7)} ${cls.padEnd(8)} ${(ver==='v06'?'v0.6 S'+stage:'v0.7   ').padEnd(8)} 開幕:画面${f(o.openOnScreen)} 撃破数${f(o.openKills)} 一体の打数${f(o.openHitsPerKill)} 損傷秒${f(o.openDamagedSecs)} | 最初の敵の打数 ${f(o.weak0)}→${f(o.weak1)}→${f(o.weak2)} 硬い${f(o.hard2)} | 大群 一手${f(o.hordeKPA)} 最大${f(o.hordeBest)} | 侵入${f(o.breaches)} 零${o.perfect}/${o.runs} 危険時間${f((o.dangerShare??0)*100)}% 最大${f(o.dangerMax)} | ボス ${o.bossDown}/${o.runs} ${f(o.bossSecs)}s`);}
await mkdir(path.join(root,'research/v07'),{recursive:true});await writeFile(path.join(root,'research/v07/compare.json'),JSON.stringify({seeds,skills,summary:sum,rows},null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
