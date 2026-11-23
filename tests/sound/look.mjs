// Visual check at phone size: select, intro card, mixed field, themed boss, result. Real-time play by the intent bot.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=p=>path.join(root,'research/v06/screens',p);
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:693},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const url=pathToFileURL(path.join(root,'stages.html')).href;
await page.goto(url);await page.waitForFunction(()=>window.STAGES);await page.screenshot({path:out('01_select_new.png')});
await page.goto(url+'?all=1');await page.waitForFunction(()=>window.STAGES);await page.click('.stage[data-n="2"]');await page.screenshot({path:out('02_select_stage2.png')});
await page.click('#pick-caster');await page.waitForTimeout(700);await page.screenshot({path:out('03_stage2_intro.png')});
await page.evaluate(()=>{STAGES.state.bot=null;});await page.evaluate(()=>STAGES.test.play('slasher',1,'intent',3));await page.waitForTimeout(600);await page.screenshot({path:out('04_stage3_intro.png')});
// jump to the mixed phase and the boss quickly: run headless steps, then draw
const jump=async(t,name)=>{await page.evaluate(t=>{const S=STAGES.state;while(S.t<t&&S.state==='play'){STAGES.test.step(1/60);if(S.paused){document.querySelector('#up-cards button')?.click();}}},t);await page.waitForTimeout(400);await page.screenshot({path:out(name)});};
await jump(27,'05_stage3_blend.png');await jump(37.5,'06_stage3_boss.png');
await page.evaluate(()=>STAGES.test.play('crusher',1,'skilled',2));await jump(38,'07_stage2_boss.png');
await page.evaluate(()=>{const S=STAGES.state;let n=0;while(S.state==='play'&&n<60*40){STAGES.test.step(1/60);if(S.paused)document.querySelector('#up-cards button')?.click();n++;}});await page.waitForTimeout(500);await page.screenshot({path:out('08_result.png')});
await browser.close();console.log(errors.length?errors.slice(0,5):'no errors');
