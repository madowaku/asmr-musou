// Quick headless run: 3 classes × skills, prints metrics and errors.
import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1').split(',').map(Number),skills=(process.argv[3]||'random,intent,skilled').split(',');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'feel.html')).href);await page.waitForFunction(()=>window.FEEL,null,{timeout:20000});
for(const seed of seeds)for(const cls of ['slasher','crusher','caster'])for(const skill of skills){const t0=Date.now();const r=await page.evaluate(([c,s,k])=>FEEL.test.simulate(c,s,k),[cls,seed,skill]);
  console.log(`${cls.padEnd(8)} ${skill.padEnd(8)} s${seed} kills ${String(r.kills).padStart(3)} act ${String(r.actions).padStart(3)} k/a ${(r.kills/Math.max(1,r.actions)).toFixed(2)} best ${String(r.best).padStart(2)} chain ${String(r.chainKills).padStart(3)} lv ${r.byLevel.map(l=>l.per?.toFixed(1)).join('/')} ups ${r.ups.join('+')} boss ${r.bossDefeated?r.bossSecs.toFixed(1)+'s':'-'} lat ${r.latency.median?.toFixed(3)} firstKill ${r.firstKillT?.toFixed(2)} t=${r.seconds.toFixed(1)} (${Date.now()-t0}ms)`);}
await browser.close();if(errors.length){console.error('ERRORS',errors.slice(0,5));process.exit(1);}
