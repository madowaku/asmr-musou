// Quick headless run of SOUND STAGES: stages × classes × skills; metrics, material mix, errors.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const stages=(process.argv[2]||'1,2,3').split(',').map(Number),skills=(process.argv[3]||'intent').split(','),seeds=(process.argv[4]||'1').split(',').map(Number);
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'stages.html')).href);await page.waitForFunction(()=>window.STAGES,null,{timeout:20000});
for(const st of stages)for(const seed of seeds)for(const cls of ['slasher','crusher','caster'])for(const skill of skills){const t0=Date.now();const r=await page.evaluate(([c,s,k,n])=>STAGES.test.simulate(c,s,k,{stage:n}),[cls,seed,skill,st]);
  console.log(`S${st} ${cls.padEnd(8)} ${skill.padEnd(8)} s${seed} kills ${String(r.kills).padStart(3)} act ${String(r.actions).padStart(3)} k/a ${(r.kills/Math.max(1,r.actions)).toFixed(2)} best ${String(r.best).padStart(2)} lv ${r.byLevel.map(l=>l.per?.toFixed(1)).join('/')} boss ${r.bossDefeated?r.bossSecs.toFixed(1)+'s':'-'} t=${r.seconds.toFixed(1)} mats ${JSON.stringify(r.byMaterial)} (${Date.now()-t0}ms)`);}
await browser.close();if(errors.length){console.error('ERRORS',errors.slice(0,5));process.exit(1);}
