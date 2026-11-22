// AI objective verification: deterministic headless 60 s runs, 3 classes × 3 bot skills × seeds.
import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const seeds=(process.argv[2]||'1,2').split(',').map(Number),skills=(process.argv[3]||'random,naive,skilled').split(',');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'combat.html')).href);await page.waitForFunction(()=>window.COMBAT,null,{timeout:20000});
const rows=[];
for(const seed of seeds)for(const cls of ['slasher','crusher','caster'])for(const skill of skills){const t0=Date.now();const r=await page.evaluate(([c,s,k])=>COMBAT.test.simulate(c,s,k),[cls,seed,skill]);r.wallMs=Date.now()-t0;rows.push(r);
  console.log(`${cls.padEnd(8)} ${skill.padEnd(8)} seed${seed} kills ${String(r.kills).padStart(3)} actions ${String(r.actions).padStart(3)} k/a ${(r.kills/Math.max(1,r.actions)).toFixed(2)} best ${String(r.best).padStart(2)} chainK ${String(r.chainKills).padStart(3)} chainMax ${r.bestChain} perfect ${r.perfect}/${r.formsSeen} boss ${r.bossDefeated?'DOWN':'-'} t=${r.seconds.toFixed(1)} forms ${r.forms.map(f=>f.id[0]+f.actions+(f.cleared?'✓':'')).join(' ')} (${r.wallMs}ms)`);}
await mkdir(path.join(root,'research/v04'),{recursive:true});await writeFile(path.join(root,'research/v04/sim.json'),JSON.stringify(rows,null,1));
await browser.close();if(errors.length){console.error('ERRORS',errors.slice(0,5));process.exit(1);}
