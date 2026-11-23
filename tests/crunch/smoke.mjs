// Quick headless run of CRUNCH LINE: 3 classes × skills; kills, hits-to-kill by type and level, breaches, errors.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const skills=(process.argv[2]||'intent').split(','),seeds=(process.argv[3]||'1').split(',').map(Number);
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'crunch.html')).href);await page.waitForFunction(()=>window.CRUNCH,null,{timeout:20000});
const f=a=>a?a.map(v=>v==null?'-':v.toFixed(1)).join('/'):'—';
for(const skill of skills)for(const seed of seeds)for(const cls of ['slasher','crusher','caster']){const t0=Date.now();const r=await page.evaluate(([c,s,k])=>CRUNCH.test.simulate(c,s,k),[cls,seed,skill]);
  const scr=r.onScreen.filter(([t])=>t<12).map(x=>x[1]),avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'-';
  console.log(`${cls.padEnd(8)} ${skill.padEnd(7)} s${seed} kills ${String(r.kills).padStart(4)} act ${String(r.actions).padStart(3)} hurts ${String(r.hurts).padStart(3)} k/a ${(r.kills/Math.max(1,r.actions)).toFixed(1)} best ${r.best} | hits weak ${f(r.hitsToKill.weak)} mid ${f(r.hitsToKill.mid)} swarm ${f(r.hitsToKill.swarm)} hard ${f(r.hitsToKill.hard)} | onScreen<12s ${avg(scr)} breaches ${r.breaches.length} firstKill ${r.firstKillT?.toFixed(1)} boss ${r.bossDefeated?r.bossSecs.toFixed(1)+'s':'-'} t=${r.seconds.toFixed(1)} (${Date.now()-t0}ms)`);}
await browser.close();if(errors.length){console.error('ERRORS',errors.slice(0,5));process.exit(1);}
