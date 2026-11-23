// v0.5 FEEL (feel.html) vs v0.6 SOUND STAGES (stages.html, stages 1–3): same bots, same seeds.
// Guard: the stages must not cost the v0.5 controls / destruction (kills per action, growth, boss).
// Stage structure: which materials break in each phase (solo → mix → blend → boss), how long the new material plays alone.
// Output: research/v06/sim.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1,2,3,4').split(',').map(Number),skills=(process.argv[3]||'intent,random').split(',');
const browser=await chromium.launch({channel:'chrome'});const errors=[];
async function open(file,flag){const p=await browser.newPage({viewport:{width:360,height:640}});p.on('pageerror',e=>errors.push(file+': '+String(e.stack||e)));await p.goto(pathToFileURL(path.join(root,file)).href);await p.waitForFunction(f=>window[f],flag);return p;}
const v5=await open('feel.html','FEEL'),v6=await open('stages.html','STAGES');
// per-phase material counts: hook W.onBreak through the events of the run (G.t phases)
await v6.evaluate(()=>{const G=STAGES.state,W=LAB.world,orig=W.onBreak;window.__ph=null;W.onBreak=(b,opt)=>{if(window.__ph){const ph=G.boss?'boss':G.t<12?'solo':G.t<24?'mix':'blend';const o=window.__ph[ph]=window.__ph[ph]||{};o[b.material]=(o[b.material]||0)+1;
  if(window.__ph.firstT[b.material]==null)window.__ph.firstT[b.material]=+G.t.toFixed(2);}return orig(b,opt);};});
const rows=[];
for(const skill of skills)for(const cls of ['slasher','crusher','caster'])for(const seed of seeds){
  const a=await v5.evaluate(([c,s,k])=>FEEL.test.simulate(c,s,k),[cls,seed,skill]);rows.push({ver:'v05',stage:0,cls,seed,skill,...pick(a)});
  for(const st of [1,2,3]){const r=await v6.evaluate(([c,s,k,n])=>{window.__ph={firstT:{}};const r=STAGES.test.simulate(c,s,k,{stage:n});r.phases=window.__ph;window.__ph=null;return r;},[cls,seed,skill,st]);rows.push({ver:'v06',stage:st,cls,seed,skill,...pick(r),phases:r.phases});}}
function pick(r){return {kills:r.kills,actions:r.actions,perAction:r.kills/Math.max(1,r.actions),lv0:r.byLevel[0].per,lv2:r.byLevel[2].per??r.byLevel[1].per,best0:r.byLevel[0].best,best2:Math.max(r.byLevel[1].best,r.byLevel[2].best),boss:r.bossDefeated,bossSecs:r.bossSecs,firstKill:r.firstKillT,seconds:r.seconds,byMaterial:r.byMaterial};}
const mean=a=>{const b=a.filter(x=>x!=null&&!Number.isNaN(x));return b.length?b.reduce((x,y)=>x+y,0)/b.length:null;},f1=x=>x==null?'  —':x.toFixed(1).padStart(5);
const summary=[];
for(const skill of skills)for(const cls of ['slasher','crusher','caster'])for(const key of ['v05:0','v06:1','v06:2','v06:3']){const [ver,st]=key.split(':');const g=rows.filter(r=>r.skill===skill&&r.cls===cls&&r.ver===ver&&r.stage===+st);
  const o={skill,cls,ver,stage:+st,runs:g.length,perAction:mean(g.map(r=>r.perAction)),lv0:mean(g.map(r=>r.lv0)),lv2:mean(g.map(r=>r.lv2)),best0:mean(g.map(r=>r.best0)),best2:mean(g.map(r=>r.best2)),bossDown:g.filter(r=>r.boss).length,bossSecs:mean(g.map(r=>r.bossSecs)),firstKill:mean(g.map(r=>r.firstKill)),seconds:mean(g.map(r=>r.seconds))};
  if(ver==='v06'){const ph={};for(const r of g)for(const [k,v] of Object.entries(r.phases||{})){if(k==='firstT')continue;ph[k]=ph[k]||{};for(const [m,n] of Object.entries(v))ph[k][m]=(ph[k][m]||0)+n;}
    for(const k of Object.keys(ph)){const t=Object.values(ph[k]).reduce((x,y)=>x+y,0);for(const m of Object.keys(ph[k]))ph[k][m]=+(ph[k][m]/t).toFixed(3);}o.phaseShare=ph;
    const ft={};for(const r of g)for(const [m,t] of Object.entries(r.phases?.firstT||{}))(ft[m]=ft[m]||[]).push(t);o.firstHeard=Object.fromEntries(Object.entries(ft).map(([m,a])=>[m,+mean(a).toFixed(1)]));}
  summary.push(o);
  console.log(`${skill.padEnd(7)} ${cls.padEnd(8)} ${ver==='v05'?'v0.5     ':'v0.6 S'+st+'  '} 一手${f1(o.perAction)} 強化前→後${f1(o.lv0)}→${f1(o.lv2)} 最大${f1(o.best0)}→${f1(o.best2)} ボス ${o.bossDown}/${o.runs} ${f1(o.bossSecs)}s 初撃破${f1(o.firstKill)}s 終了${f1(o.seconds)}s ${o.phaseShare?JSON.stringify(o.phaseShare):''}`);}
await writeFile(path.join(root,'research/v06/sim.json'),JSON.stringify({seeds,skills,summary,rows},null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
