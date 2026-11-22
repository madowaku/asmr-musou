import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
await page.goto(pathToFileURL(path.join(root,'feel.html')).href);await page.waitForFunction(()=>window.FEEL,null,{timeout:20000});
const sets={slasher:[[],['wide','double'],['wave','double']],crusher:[[],['rush','blast'],['quake','blast']],caster:[[],['wide','chain'],['double','wide']]};
for(const cls of Object.keys(sets))for(const ups of sets[cls])for(const skill of (process.argv[2]||'random,intent,skilled').split(',')){const r=await page.evaluate(([c,k,u])=>FEEL.test.bossOnly(c,k,u),[cls,skill,ups]);console.log(cls.padEnd(8),skill.padEnd(8),(ups.join('+')||'none').padEnd(12),r.down?'DOWN '+r.secs.toFixed(1)+'s':'alive '+JSON.stringify(r.layers),'actions',r.actions);}
await browser.close();if(errors.length){console.error(errors.slice(0,3));process.exit(1);}
