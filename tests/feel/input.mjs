// Real pointer input in Chrome (real time, phone viewport): does each gesture produce the intended attack AT the
// touched place, how fast does something break (pointerdown → first break/impact, wall-clock ms), and the
// upgrade overlay. Then a rendered performance probe under 4x CPU throttle with the skilled bot playing.
import assert from 'node:assert/strict';import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});
const ctx=await browser.newContext({viewport:{width:412,height:732},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'feel.html')).href);await page.waitForFunction(()=>window.FEEL&&!document.getElementById('select').hidden);
await page.evaluate(()=>{const C=LAB.combat,W=LAB.world;window.__log=[];const ob=W.onBreak;W.onBreak=(b,o)=>{__log.push(['break',performance.now()]);ob(b,o);};const ot=C.touch;C.touch=id=>{__log.push(['hit',performance.now()]);ot(id);};const obg=C.begin;C.begin=(...x)=>{__log.push(['fire',performance.now()]);return obg(...x);};
  document.getElementById('scene').addEventListener('pointerdown',()=>__log.push(['down',performance.now()]),true);});
const box=await page.locator('#scene').boundingBox(),P=p=>[box.x+p.x*box.width/720,box.y+p.y*box.height/1280];
const S=()=>page.evaluate(()=>{const G=FEEL.state,h=G.hero,a=G.actions.get(h.action);return {action:h.action,kind:h.lastKind,kills:G.stats.kills,at:a&&a.info&&a.info.at,combo:h.combo,ups:[...h.ups],paused:G.paused};});
const densest=()=>page.evaluate(()=>{const en=LAB.combat.targets().filter(e=>!e.flying&&e.y>330&&e.y<1000);const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);en.sort((a,b)=>en.filter(o=>d(o,b)<130).length-en.filter(o=>d(o,a)<130).length);return en[0]?{x:en[0].x,y:en[0].y}:{x:360,y:560};});
// pointerdown → first fire / first break-or-impact (wall clock). A slash fires mid-swipe, so for SLASHER the
// down→fire part is the finger's own travel (≥52 px); fire→break is the game's response.
const latency=()=>page.evaluate(()=>{const L=__log;let i0=-1;for(let i=L.length-1;i>=0;i--)if(L[i][0]==='down'){i0=i;break;}const t0=L[i0][1],f=L.slice(i0).find(x=>x[0]==='fire'),b=L.slice(i0).find(x=>x[0]==='break'||x[0]==='hit');
  return {downToFire:f?Math.round(f[1]-t0):null,fireToBreak:f&&b?Math.round(b[1]-f[1]):null,downToBreak:b?Math.round(b[1]-t0):null};});
const d=(a,b)=>Math.round(Math.hypot(a.x-b.x,a.y-b.y));
const report={};
for(const cls of ['slasher','crusher','caster']){
  await page.evaluate(c=>FEEL.start(c,1),cls);await page.waitForTimeout(500);const r={};
  // 1) the basic move on the densest clump
  let t=await densest(),s0=await S();
  if(cls==='slasher'){const A={x:t.x-130,y:t.y+20},B={x:t.x+130,y:t.y-20};await page.mouse.move(...P(A));await page.mouse.down();let mid=null;
    for(let i=1;i<=6;i++){await page.mouse.move(...P({x:A.x+(B.x-A.x)*i/6,y:A.y+(B.y-A.y)*i/6}));if(i===3)mid=await S();}await page.mouse.up();
    r.firesMidSwipe=mid.action>s0.action;}
  else await page.touchscreen.tap(...P(t));
  await page.waitForTimeout(450);let s1=await S();r.basic={kind:s1.kind,kills:s1.kills-s0.kills,distToTarget:s1.at?d(s1.at,t):null,latencyMs:await latency()};
  // 2) mash / second gesture
  if(cls==='crusher'){s0=await S();for(let i=0;i<5;i++){t=await densest();await page.touchscreen.tap(...P(t));await page.waitForTimeout(110);}await page.waitForTimeout(400);s1=await S();r.mash={actions:s1.action-s0.action,combo:s1.combo,kills:s1.kills-s0.kills};}
  if(cls==='caster'){s0=await S();await page.mouse.move(...P({x:120,y:600}));await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(...P({x:120+i*60,y:600-i*10}));await page.waitForTimeout(25);}await page.mouse.up();await page.waitForTimeout(300);s1=await S();r.drag={spells:s1.action-s0.action,kills:s1.kills-s0.kills};}
  if(cls==='slasher'){s0=await S();await page.waitForTimeout(200);t=await densest();await page.touchscreen.tap(...P(t));await page.waitForTimeout(350);s1=await S();r.tap={kind:s1.kind,kills:s1.kills-s0.kills,distToTarget:s1.at?d(s1.at,t):null};}
  // 3) hold → release = big move
  await page.waitForTimeout(300);t=await densest();s0=await S();await page.mouse.move(...P(t));await page.mouse.down();await page.waitForTimeout(950);const charging=await page.evaluate(()=>!!FEEL.state.hero.charge);await page.mouse.up();await page.waitForTimeout(600);s1=await S();
  r.hold={charging,kind:s1.kind,kills:s1.kills-s0.kills,distToTarget:s1.at?d(s1.at,t):null};
  report[cls]=r;
  const big={slasher:'bigspin',crusher:'heavy',caster:'big'}[cls],basic={slasher:'slash',crusher:'jab',caster:'burst'}[cls];
  assert.equal(r.basic.kind,basic,cls+' basic gesture');assert(r.basic.kills>0,cls+' basic should break something');assert(r.basic.distToTarget<=130,cls+' attack should land where touched: '+r.basic.distToTarget);
  assert(r.hold.charging&&r.hold.kind===big,cls+' hold→release: '+JSON.stringify(r.hold));
  if(cls==='slasher')assert(r.firesMidSwipe,'slash should fire before the finger lifts');
  if(cls==='crusher')assert(r.mash.actions>=5&&r.mash.combo>=4,'mashing should chain punches: '+JSON.stringify(r.mash));
  if(cls==='caster')assert(r.drag.spells>=2,'dragging should chain spells: '+JSON.stringify(r.drag));
}
// 4) upgrade overlay: time stops, the pick applies
await page.evaluate(()=>{FEEL.start('caster',1);FEEL.state.t=11.9;LAB.time=11.9;});await page.waitForSelector('#upgrade:not([hidden])',{timeout:3000});
const tFrozen=await page.evaluate(()=>FEEL.state.t);await page.waitForTimeout(600);const tStill=await page.evaluate(()=>FEEL.state.t);
await page.locator('#up-cards button').first().tap();await page.waitForTimeout(200);const after=await S();
report.upgrade={timeStopped:tFrozen===tStill,applied:after.ups.length===1&&!after.paused,ups:after.ups};assert(report.upgrade.timeStopped&&report.upgrade.applied,'upgrade overlay: '+JSON.stringify(report.upgrade));
// 5) rendered perf under 4x CPU throttle: skilled bot (auto-picks upgrades)
const cdp=await ctx.newCDPSession(page);report.perf={};
for(const cls of ['caster','crusher','slasher']){await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(c=>{window.__ms=[];window.__parts=[];const C=LAB.combat;clearInterval(window.__iv);window.__iv=setInterval(()=>{if(C.frameMs&&FEEL.state.state==='play'&&!FEEL.state.paused){__ms.push(C.frameMs);__parts.push([C.updMs,C.drawMs]);}},16);FEEL.state.pickPolicy=ch=>ch[0];FEEL.test.play(c,2,'skilled');},cls);
  await page.waitForTimeout(14000);const ms=await page.evaluate(()=>__ms.slice());await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  ms.sort((a,b)=>a-b);const parts=await page.evaluate(()=>__parts);const pp=i=>{const a=parts.map(x=>x[i]).sort((a,b)=>a-b);return {avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2),p95:+a[Math.floor(a.length*.95)].toFixed(2)};};
  report.perf[cls]={update:pp(0),draw:pp(1),samples:ms.length,avg:+(ms.reduce((a,b)=>a+b,0)/ms.length).toFixed(2),p95:+ms[Math.floor(ms.length*.95)].toFixed(2),max:+ms[ms.length-1].toFixed(2),kills:await page.evaluate(()=>FEEL.state.stats.kills),t:await page.evaluate(()=>+FEEL.state.t.toFixed(1))};
  await page.evaluate(()=>{FEEL.state.bot=null;FEEL.state.pickPolicy=null;});}
await writeFile(path.join(root,'research/v05/input_perf.json'),JSON.stringify(report,null,1));console.log(JSON.stringify(report,null,1));
await browser.close();assert.deepEqual(errors,[],'console errors: '+errors.join('|'));
console.log('PASS: touch-where-you-mean for 3 classes (basic / combo / hold), upgrade overlay, no console errors');
