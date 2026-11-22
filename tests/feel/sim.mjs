// AI objective verification for v0.5: deterministic headless 60 s runs, 3 classes × 3 bot skills × seeds,
// plus a "no upgrades" control (same bot, upgrades disabled) to separate growth from skill.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1,2,3,4,5,6').split(',').map(Number);
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
await page.goto(pathToFileURL(path.join(root,'feel.html')).href);await page.waitForFunction(()=>window.FEEL,null,{timeout:20000});
const rows=[];
for(const seed of seeds)for(const cls of ['slasher','crusher','caster'])for(const [skill,opt] of [['random',{}],['intent',{}],['skilled',{}],['intent',{noUpgrades:true}]]){
  const r=await page.evaluate(([c,s,k,o])=>FEEL.test.simulate(c,s,k,o),[cls,seed,skill,opt]);r.variant=opt.noUpgrades?'intent-noup':skill;rows.push(r);}
const m=(rs,f)=>rs.reduce((s,r)=>s+(f(r)??0),0)/rs.length;const out=[];
for(const cls of ['slasher','crusher','caster'])for(const v of ['random','intent','skilled','intent-noup']){const rs=rows.filter(r=>r.cls===cls&&r.variant===v);
  const o={cls,variant:v,runs:rs.length,kills:m(rs,r=>r.kills),actions:m(rs,r=>r.actions),perAction:m(rs,r=>r.kills/r.actions),best:m(rs,r=>r.best),chainKills:m(rs,r=>r.chainKills),
    lv0:m(rs,r=>r.byLevel[0].per),lv2:m(rs,r=>r.byLevel[2].per??r.byLevel[1].per),best0:m(rs,r=>r.byLevel[0].best),best2:m(rs,r=>Math.max(r.byLevel[1].best,r.byLevel[2].best)),
    bossDown:rs.filter(r=>r.bossDefeated).length,bossSecs:m(rs.filter(r=>r.bossSecs!=null),r=>r.bossSecs),firstKill:m(rs,r=>r.firstKillT),latency:m(rs,r=>r.latency.median),seconds:m(rs,r=>r.seconds),
    slashShift:m(rs,r=>r.match.slashShiftMean),jabDist:m(rs,r=>r.match.jabDistMean),castSnap:m(rs,r=>r.match.castSnapMean)};out.push(o);
  console.log(cls.padEnd(8),v.padEnd(12),'kills',o.kills.toFixed(0).padStart(4),'k/a',o.perAction.toFixed(1).padStart(5),'best',o.best.toFixed(0).padStart(3),'lv0→2',o.lv0.toFixed(1)+'→'+o.lv2.toFixed(1),'best0→2',o.best0.toFixed(0)+'→'+o.best2.toFixed(0),'boss',o.bossDown+'/'+o.runs,o.bossSecs.toFixed(1)+'s','firstKill',o.firstKill.toFixed(2),'lat',(o.latency*1000).toFixed(0)+'ms','end',o.seconds.toFixed(1));}
await writeFile(path.join(root,'research/v05/sim.json'),JSON.stringify({rows,summary:out},null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,3));process.exit(1);}
