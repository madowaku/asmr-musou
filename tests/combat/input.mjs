// Real pointer input → intended action, for every class (mouse for strokes/holds, touchscreen for taps),
// plus a rendered performance probe under 4x CPU throttle with a skilled bot playing.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});
const ctx=await browser.newContext({viewport:{width:412,height:732},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'combat.html')).href);await page.waitForFunction(()=>window.COMBAT&&!document.getElementById('select').hidden);
const box=await page.locator('#scene').boundingBox(),P=(x,y)=>[box.x+x*box.width/720,box.y+y*box.height/1280];
const hero=()=>page.evaluate(()=>{const h=COMBAT.state.hero;return {kind:h.lastKind,x:h.x,y:h.y,dash:h.dash&&{kind:h.dash.kind,charged:h.dash.charged},action:h.action,mana:h.mana,wells:window.LAB.combat.wells.length};});
const report={};
for(const cls of ['slasher','crusher','caster']){
  await page.locator('#pick-'+cls).tap().catch(async()=>{await page.evaluate(c=>COMBAT.start(c,1),cls);});
  await page.waitForTimeout(150);if(cls!=='slasher'&&(await page.evaluate(()=>COMBAT.state.cls))!==cls)await page.evaluate(c=>COMBAT.start(c,1),cls);
  // flick from the thumb zone (relative to the hero), upward-right
  let h0=await hero();await page.mouse.move(...P(360,1150));await page.mouse.down();for(let i=1;i<=6;i++)await page.mouse.move(...P(360+i*20,1150-i*45));await page.mouse.up();
  await page.waitForTimeout(30);let h1=await hero();await page.waitForTimeout(400);let h2=await hero();
  const flick={moved:Math.round(Math.hypot(h2.x-h0.x,h2.y-h0.y)),dir:Math.round(Math.atan2(h2.y-h0.y,h2.x-h0.x)*57.3),action:h2.action>h0.action};
  // hold → pull down → release = aimed special upward
  h0=await hero();await page.mouse.move(...P(360,1100));await page.mouse.down();await page.waitForTimeout(260);for(let i=1;i<=5;i++){await page.mouse.move(...P(360,1100+i*24));await page.waitForTimeout(16);}
  const aiming=await page.evaluate(()=>!!COMBAT.state.hero.aim);await page.mouse.up();await page.waitForTimeout(20);h1=await hero();await page.waitForTimeout(500);
  const special={aiming,charged:h1.kind==='charged',well:h1.wells>0,action:h1.action>h0.action};
  // touch tap = small move
  h0=await hero();await page.waitForTimeout(cls==='caster'?1200:0);h0=await hero();await page.touchscreen.tap(...P(360,1150));await page.waitForTimeout(60);h1=await hero();
  const tap={action:h1.action>h0.action,manaSpent:cls==='caster'?h0.mana-h1.mana:null};
  report[cls]={flick,special,tap};
  assert(flick.action&&flick.moved>150,cls+' flick should move the hero: '+JSON.stringify(flick));
  assert(flick.dir<-45&&flick.dir>-90,cls+' flick should follow the stroke direction (up-right): '+flick.dir);
  assert(special.aiming&&special.action&&(cls==='caster'?special.well:special.charged),cls+' hold-pull-release should fire the aimed special: '+JSON.stringify(special));
  assert(tap.action,cls+' tap should act: '+JSON.stringify(tap));
}
// rendered perf: skilled bot, 4x CPU throttle, 12 s of a real run
const cdp=await ctx.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.evaluate(()=>{window.__ms=[];const C=window.LAB.combat;window.__parts=[];setInterval(()=>{if(C.frameMs){window.__ms.push(C.frameMs);window.__parts.push([C.updMs,C.drawMs]);}},16);COMBAT.test.play('crusher',2,'skilled');});
await page.waitForTimeout(12000);const ms=await page.evaluate(()=>window.__ms.slice());await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
ms.sort((a,b)=>a-b);const parts=await page.evaluate(()=>window.__parts);const pp=i=>{const a=parts.map(x=>x[i]).sort((a,b)=>a-b);return {avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2),p95:a[Math.floor(a.length*.95)]};};report.perf={update:pp(0),draw:pp(1),samples:ms.length,avg:+(ms.reduce((a,b)=>a+b,0)/ms.length).toFixed(2),p95:ms[Math.floor(ms.length*.95)],max:ms[ms.length-1],kills:await page.evaluate(()=>COMBAT.state.stats.kills)};
await mkdir(path.join(root,'research/v04'),{recursive:true});await writeFile(path.join(root,'research/v04/input_perf.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
await browser.close();
assert.deepEqual(errors,[],'console errors: '+errors.join('|'));
console.log('PASS: real pointer flick / hold-pull-release / touch tap for 3 classes; no console errors');
