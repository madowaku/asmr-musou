// Boss alone per stage × class × skill (with the two upgrades a typical run has).
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const UPS={slasher:['wide','wave'],crusher:['rush','blast'],caster:['wide','chain']};
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
await page.goto(pathToFileURL(path.join(root,'stages.html')).href);await page.waitForFunction(()=>window.STAGES,null,{timeout:20000});
const out=[];
for(const st of (process.argv[2]||'0,1,2,3').split(',').map(Number))for(const cls of ['slasher','crusher','caster'])for(const skill of (process.argv[3]||'intent,skilled').split(',')){
  const r=await page.evaluate(([c,k,u,n])=>n?STAGES.test.bossOnly(c,k,u,40,n):null,[cls,skill,UPS[cls],st]);if(!r)continue;out.push({st,cls,skill,...r});
  console.log(`S${st} ${cls.padEnd(8)} ${skill.padEnd(8)} ${r.down?'DOWN':'----'} ${r.secs.toFixed(1)}s actions ${r.actions} layers ${r.layers.join('/')}`);}
await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
