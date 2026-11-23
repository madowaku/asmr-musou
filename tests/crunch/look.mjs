// Visual check at phone size: select, the opening (one enemy chipped step by step), upgrade, one-hit phase, horde,
// hard type, boss, result. Real-time play by the intent bot, with jumps (headless steps) between the moments.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=p=>path.join(root,'research/v07/screens',p);
const cls=process.argv[2]||'slasher';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:693},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'crunch.html')).href);await page.waitForFunction(()=>window.CRUNCH);await page.screenshot({path:out('01_select.png')});
await page.evaluate(c=>{CRUNCH.state.pickPolicy=null;CRUNCH.test.play(c,1,'intent');},cls);
await page.waitForTimeout(900);await page.screenshot({path:out(`02_${cls}_first_hit.png`)});
await page.waitForTimeout(700);await page.screenshot({path:out(`03_${cls}_chipped.png`)});
const jump=async(t,name)=>{await page.evaluate(t=>{const S=CRUNCH.state;while(S.t<t&&S.state==='play'&&!S.paused)CRUNCH.test.step(1/60);},t);await page.waitForTimeout(450);await page.screenshot({path:out(name)});};
await jump(12.2,`04_${cls}_upgrade.png`);await page.click('#up-cards button');
await jump(17,`05_${cls}_onehit.png`);
await page.evaluate(()=>{const S=CRUNCH.state;while(S.t<24.2&&S.state==='play'&&!S.paused)CRUNCH.test.step(1/60);});await page.click('#up-cards button');
await jump(26.5,`06_${cls}_horde.png`);await jump(33,`07_${cls}_hard.png`);await jump(45,`08_${cls}_boss.png`);
await page.evaluate(()=>{const S=CRUNCH.state;let n=0;while(S.state==='play'&&n<60*40){CRUNCH.test.step(1/60);n++;}});await page.waitForTimeout(500);await page.screenshot({path:out(`09_${cls}_result.png`)});
await browser.close();console.log(errors.length?errors.slice(0,5):'no errors');
