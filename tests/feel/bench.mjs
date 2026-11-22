// Growth bench: same crowd, one action, before/after upgrades (destruction scale = kills, fractures, duration).
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
await page.goto(pathToFileURL(path.join(root,'feel.html')).href);await page.waitForFunction(()=>window.FEEL,null,{timeout:20000});
const sets={slasher:[[],['wide'],['wave'],['double'],['wide','double'],['wave','double'],['wide','wave']],crusher:[[],['rush'],['blast'],['quake'],['blast','quake'],['rush','blast'],['rush','quake']],caster:[[],['wide'],['chain'],['double'],['wide','chain'],['double','wide'],['chain','double']]};
const out=[];
for(const skill of (process.argv[2]||'intent,skilled').split(','))for(const cls of Object.keys(sets))for(const ups of sets[cls]){const r=await page.evaluate(([c,u,k])=>FEEL.test.bench(c,u,k,24),[cls,ups,skill]);delete r.rows;out.push({skill,cls,ups:ups.join('+')||'none',...r});
  console.log(skill.padEnd(8),cls.padEnd(8),(ups.join('+')||'none').padEnd(12),'kills',r.kills.toFixed(1).padStart(5),'share',(r.share*100).toFixed(0).padStart(3)+'%','dur',r.dur.toFixed(2));}
await writeFile(path.join(root,'research/v05/bench.json'),JSON.stringify(out,null,1));
await browser.close();if(errors.length){console.error(errors.slice(0,3));process.exit(1);}
