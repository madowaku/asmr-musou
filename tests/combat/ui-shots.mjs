// Screens for review / docs: select, play (each class), boss, result. Fake clock, skilled bot.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.argv[2]||path.join(root,'research/v04/screens');await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:412,height:732},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.clock.install();await p.goto(pathToFileURL(path.join(root,'combat.html')).href);await p.clock.runFor(800);await p.waitForFunction(()=>window.COMBAT&&!document.getElementById('select').hidden);
await p.screenshot({path:out+'/select.png'});
for(const [c,t] of [['slasher',3.2],['crusher',4.4],['caster',6.1]]){await p.evaluate(c=>COMBAT.test.play(c,1,'skilled'),c);await p.clock.runFor(t*1000);await p.screenshot({path:`${out}/play_${c}.png`});}
await p.evaluate(()=>COMBAT.test.play('crusher',1,'skilled'));await p.clock.runFor(33500);await p.screenshot({path:out+'/boss.png'});await p.clock.runFor(14000);await p.screenshot({path:out+'/result.png'});
console.log(errs.slice(0,3),'shots ->',out);await b.close();
