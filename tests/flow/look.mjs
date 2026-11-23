// Visual check at phone size: select (4 classes), the opening queue, the first LEVEL UP, mid, late horde, boss, result.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=p=>path.join(root,'research/v08/screens',p);
const cls=process.argv[2]||'spinner';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:693},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'flow.html')).href);await page.waitForFunction(()=>window.CRUNCH);await page.screenshot({path:out('01_select.png')});
await page.evaluate(c=>{CRUNCH.state.pickPolicy=null;CRUNCH.test.play(c,1,'intent');},cls);
await page.waitForTimeout(1400);await page.screenshot({path:out(`02_${cls}_opening.png`)});
const until=async(fn,name,limit=40)=>{await page.evaluate(([src,limit])=>{const S=CRUNCH.state,f=new Function('S','return '+src);let n=0;while(S.state==='play'&&!S.paused&&!f(S)&&n<limit*60){CRUNCH.test.step(1/60);n++;}},[fn,limit]);await page.waitForTimeout(450);await page.screenshot({path:out(name)});};
await until('false',`03_${cls}_levelup.png`);   // runs until the first level-up pauses the game
await page.click('#up-cards button');await until('S.t>S.stats.levelUps[0].t+3',`04_${cls}_after_lv2.png`);
await page.evaluate(()=>{const S=CRUNCH.state;let n=0;while(S.state==='play'&&S.t<30&&n<60*40){CRUNCH.test.step(1/60);if(S.paused)document.querySelector('#up-cards button')?.click();n++;}});
await page.waitForTimeout(500);await page.screenshot({path:out(`05_${cls}_t30.png`)});
await page.evaluate(()=>{const S=CRUNCH.state;let n=0;while(S.state==='play'&&S.t<45&&n<60*40){CRUNCH.test.step(1/60);if(S.paused)document.querySelector('#up-cards button')?.click();n++;}});
await page.waitForTimeout(500);await page.screenshot({path:out(`06_${cls}_boss.png`)});
await page.evaluate(()=>{const S=CRUNCH.state;let n=0;while(S.state==='play'&&n<60*40){CRUNCH.test.step(1/60);if(S.paused)document.querySelector('#up-cards button')?.click();n++;}});await page.waitForTimeout(500);await page.screenshot({path:out(`07_${cls}_result.png`)});
await browser.close();console.log(errors.length?errors.slice(0,5):'no errors');
