// Screens for review/docs: title, main run (skilled bot) at fixed times, research stages, result. Fake clock.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.argv[2]||path.join(root,'research/v05/screens');await mkdir(out,{recursive:true});
const bot=process.argv[3]||'skilled',times=(process.argv[4]||'3,11,17,26,38,47,55').split(',').map(Number);
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:412,height:732},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.clock.install();await p.goto(pathToFileURL(path.join(root,'spin.html')).href);await p.clock.runFor(800);await p.waitForFunction(()=>window.SPIN&&!document.getElementById('title').hidden);
await p.screenshot({path:out+'/title.png'});
await p.evaluate(b=>SPIN.test.play('main',1,b),bot);let t=0;
for(const tt of times){await p.clock.runFor((tt-t)*1000);t=tt;await p.screenshot({path:`${out}/main_${String(tt).padStart(2,'0')}.png`});}
await p.clock.runFor((61-t)*1000);await p.screenshot({path:out+'/result.png'});
for(const [s,tt] of [['A',5.5],['B',3.2],['C',6.8]]){await p.evaluate(s=>SPIN.test.play(s,1,'skilled'),s);await p.clock.runFor(tt*1000);await p.screenshot({path:`${out}/stage_${s}.png`});}
console.log(errs.slice(0,3),'shots ->',out);await b.close();
