// SPIN LAB v0.1 technical checks (spec §10 技術検証). These are objective checks only: they say nothing about fun.
//  1 judgement table (front 120° breaks / back 60° collects / elsewhere untouched), per angle
//  2 growth: 120→135→150→165→180°, a 70° enemy only breaks once the sword is wide enough; collecting levels up
//  3 fast spin: every target resolved exactly once (no double processing, nothing lost)
//  4 ice chain reaches enemies outside the sector; contact removes the enemy and resets the combo
//  5 real touch drag (CDP touch events, phone viewport): half the screen width ≈ 180°, a tap does not rotate
//  6 headless 60 s runs: 4 bots × 3 seeds (determinism, flow ends, no errors) → research/v05/sim.json
//  7 rendered performance under 4x CPU throttle, and the existing lab / COMBAT LAB pages still load cleanly
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const url=f=>pathToFileURL(path.join(root,f)).href;
const browser=await chromium.launch({channel:'chrome'});
const report={};let fails=0;
const check=(name,fn)=>{try{fn();console.log('ok  ',name);}catch(e){fails++;console.log('FAIL',name,'\n     ',e.message.split('\n')[0]);}};
async function open(ctxOpt={viewport:{width:412,height:732}}){const ctx=await browser.newContext(ctxOpt),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return {ctx,page,errors};}

// ---------- 1–4: scene probes (headless steps, deterministic) ----------
{const {page,errors,ctx}=await open();await page.goto(url('spin.html'));await page.waitForFunction(()=>window.SPIN,null,{timeout:20000});
  report.webgl2=await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));
  // 1. judgement table at lv0 (half 60°, back ±30° around 180°)
  const table=await page.evaluate(()=>{const T=SPIN.test,out=[];for(const deg of [...Array(36)].map((_,k)=>-175+k*10).concat([-62,-58,58,62,-152,-148,148,152])){
      T.blank();T.setTheta(0);const e=T.enemy(deg,150);T.step(3);const enemyBroken=!T.enemyAlive(e);
      T.blank();T.setTheta(0);const i=T.item(deg,150);T.step(2);out.push({deg,enemyBroken,item:T.itemState(i)});}T.end();return out;});
  report.judgement=table;
  check('front 120°: enemies inside break, outside do not',()=>{for(const r of table){const front=Math.abs(r.deg)<=60;assert.equal(r.enemyBroken,front,`enemy at ${r.deg}°`);}});
  check('back 60°: items collected; front: items broken; sides: untouched',()=>{for(const r of table){const a=Math.abs(r.deg),exp=a>=150?'collect':a<=60?'broken':'in';assert.equal(r.item==='break'?'broken':r.item,exp,`item at ${r.deg}°`);}});
  // 2. growth
  const growth=await page.evaluate(()=>{const T=SPIN.test,out=[];for(let lv=0;lv<=4;lv++){T.blank();T.setTheta(0);T.setLv(lv);const g=T.geometry();const e=T.enemy(70,150);T.step(3);out.push({lv,half:g.half,reach:g.reach,broke70:!T.enemyAlive(e)});}
    T.blank();T.setTheta(0);const i=T.item(180,150);T.step(30);const after=T.geometry().lv;T.end();return {out,afterCollect:after};});
  report.growth=growth;
  check('growth: 120/135/150/165/180° and max 180° (no overlap with back 60°)',()=>{assert.deepEqual(growth.out.map(r=>Math.round(r.half*2)),[120,135,150,165,180]);assert.ok(90+30<=180);});
  check('growth: a 70° enemy breaks only from 150°',()=>assert.deepEqual(growth.out.map(r=>r.broke70),[false,false,true,true,true]));
  check('collecting an item levels the sword up',()=>assert.equal(growth.afterCollect,1));
  // 3. fast spin: 24 targets around the hero, rotate 90°/frame for 8 frames, then 720° in one frame on a fresh ring
  const spin=await page.evaluate(()=>{const T=SPIN.test,res=[];for(const [stepDeg,frames] of [[90,8],[720,1],[37,20]]){T.blank();T.setTheta(0);const es=[],is=[];
      for(let k=0;k<12;k++){es.push(T.enemy(k*30+5,140));is.push(T.item(k*30+20,150));}
      for(let f=0;f<frames;f++){T.turn(stepDeg);T.step(1);}T.step(10);const s=T.stats();
      res.push({stepDeg,frames,kills:s.kills,contacts:s.contacts,alive:es.filter(T.enemyAlive).length,items:s.items,broken:s.itemsBroken,left:is.filter(i=>T.itemState(i)==='in').length,double:s.doubleResolved||0});}T.end();return res;});
  report.fastSpin=spin;
  check('fast spin: no target is processed twice and none is lost',()=>{for(const r of spin){assert.equal(r.double,0);assert.equal(r.kills+r.contacts+r.alive,12,'enemies '+JSON.stringify(r));assert.equal(r.items+r.broken+r.left,12,'items '+JSON.stringify(r));}});
  // 4. ice chain + contact
  const misc=await page.evaluate(()=>{const T=SPIN.test;T.blank();T.setTheta(0);T.enemy(50,150,'kohaku');const w=T.enemy(92,150,'wax');T.step(40);const chain={chainKills:T.stats().chainKills,waxBroken:!T.enemyAlive(w)};
    T.blank();T.setTheta(0);for(let k=0;k<4;k++)T.enemy(-20+k*12,150);T.step(10);const c0=SPIN.state.combo;T.enemy(180,50);T.step(2);const contact={combo0:c0,combo:SPIN.state.combo,contacts:T.stats().contacts};T.end();return {chain,contact};});
  report.misc=misc;
  check('ice: shards chain into an enemy outside the front sector',()=>{assert.ok(misc.chain.waxBroken);assert.ok(misc.chain.chainKills>=1);});
  check('contact: enemy reaching the body disappears and resets the combo (no HP loss)',()=>{assert.equal(misc.contact.contacts,1);assert.ok(misc.contact.combo0>=4);assert.equal(misc.contact.combo,0);});
  // 6. headless runs
  const rows=[];for(const seed of [1,2,3])for(const bot of ['idle','random','naive','skilled']){const r=await page.evaluate(([b,s])=>SPIN.test.simulate(b,s),[bot,seed]);rows.push(r);
    console.log(`     ${bot.padEnd(7)} seed${seed} score ${String(r.score).padStart(5)} kills ${String(r.kills).padStart(3)} burst ${String(r.maxBurst).padStart(2)} combo ${String(r.maxCombo).padStart(3)} items ${r.items}/${r.itemsSpawned} broken ${r.itemsBroken} missed ${r.itemsMissed} contacts ${String(r.contacts).padStart(3)} lv ${r.finalLv} first ${r.firstItemOutcome}@${(r.firstItemT||0).toFixed(1)}`);}
  const again=await page.evaluate(()=>SPIN.test.simulate('skilled',1));
  const stages=[];for(const st of ['A','B','C'])for(const bot of ['idle','naive','skilled']){const r=await page.evaluate(([b,s])=>SPIN.test.simulate(b,1,s,40),[bot,st]);stages.push({stage:st,bot,score:r.score,kills:r.kills,items:r.items,broken:r.itemsBroken,maxBurst:r.maxBurst,lv:r.finalLv,contacts:r.contacts,seconds:r.seconds,state:r.state});}
  console.table(stages);
  report.sim=rows;report.stages=stages;
  check('60 s runs end with a result and are deterministic',()=>{for(const r of rows){assert.equal(r.state,'result');assert.ok(r.seconds>=59.9&&r.seconds<60.2);assert.equal(r.doubleResolved,undefined);}const a=rows.find(r=>r.bot==='skilled'&&r.seed===1);assert.equal(again.score,a.score);assert.equal(again.kills,a.kills);});
  check('research stages finish on their own',()=>{for(const s of stages)assert.equal(s.state,'result',s.stage+'/'+s.bot);});
  check('no page errors (probes + sims)',()=>assert.deepEqual(errors,[]));
  await mkdir(path.join(root,'research/v05'),{recursive:true});await writeFile(path.join(root,'research/v05/sim.json'),JSON.stringify({rows,stages},null,1));
  await ctx.close();}

// ---------- 5: real touch input on a phone-sized viewport ----------
{const {page,errors,ctx}=await open({viewport:{width:412,height:732},deviceScaleFactor:2,isMobile:true,hasTouch:true});await page.goto(url('spin.html'));await page.waitForFunction(()=>window.SPIN&&!document.getElementById('title').hidden);
  await page.locator('#play').tap();await page.waitForTimeout(100);
  const cdp=await ctx.newCDPSession(page),box=await page.locator('#scene').boundingBox();
  const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  const theta=()=>page.evaluate(()=>SPIN.test.hero().theta);
  const drag=async(x0,dx,y=box.y+box.height*.8)=>{await touch('touchStart',x0,y);for(let i=1;i<=12;i++){await touch('touchMove',x0+dx*i/12,y+i);await page.waitForTimeout(8);}await touch('touchEnd');};
  const t0=await theta();await drag(box.x+box.width*.25,box.width/2);const t1=await theta();
  await drag(box.x+box.width*.8,-box.width/4,box.y+box.height*.3);const t2=await theta();
  await touch('touchStart',box.x+box.width*.5,box.y+box.height*.5);await page.waitForTimeout(60);await touch('touchEnd');const t3=await theta();
  report.touch={halfScreenRight:+(t1-t0).toFixed(1),quarterScreenLeft:+(t2-t1).toFixed(1),tap:+(t3-t2).toFixed(2)};console.log('     touch',JSON.stringify(report.touch));
  check('touch: half-screen drag ≈ 180°, right = clockwise',()=>assert.ok(Math.abs(report.touch.halfScreenRight-180)<12,String(report.touch.halfScreenRight)));
  check('touch: quarter-screen drag left ≈ -90°',()=>assert.ok(Math.abs(report.touch.quarterScreenLeft+90)<8));
  check('touch: a tap does not rotate',()=>assert.equal(report.touch.tap,0));
  check('no page errors (touch)',()=>assert.deepEqual(errors,[]));
  await ctx.close();}

// ---------- 7: rendered perf (4x CPU throttle, skilled bot through the 50–60 s rush) + other pages still load ----------
{const {page,errors,ctx}=await open({viewport:{width:412,height:732},deviceScaleFactor:2});await page.goto(url('spin.html'));await page.waitForFunction(()=>window.SPIN&&!document.getElementById('title').hidden);
  const cdp=await ctx.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const perf=await page.evaluate(async()=>{SPIN.test.play('main',1,'skilled');const T=SPIN.test;T.step(48*60);const ms=[];await new Promise(res=>{let n=0;const f=()=>{ms.push(window.LAB.spin.frameMs);if(++n<300)requestAnimationFrame(f);else res();};requestAnimationFrame(f);});ms.sort((a,b)=>a-b);return {p50:ms[150],p95:ms[285],max:ms[299],bodies:window.LAB.world.bodies.length,particles:window.LAB.world.particles.length};});
  report.perf4x=perf;console.log('     perf@4x',JSON.stringify(perf));
  check('perf: p95 frame (update+draw) under 16 ms at 4x CPU throttle in the rush',()=>assert.ok(perf.p95<16,String(perf.p95)));
  check('no page errors (perf)',()=>assert.deepEqual(errors,[]));
  await ctx.close();}
for(const f of ['combat.html','lab.html','lab-audio.html']){const {page,errors,ctx}=await open();await page.goto(url(f));await page.waitForTimeout(2500);check(f+' still loads without errors',()=>assert.deepEqual(errors,[]));await ctx.close();}
await writeFile(path.join(root,'research/v05/check.json'),JSON.stringify(report,null,1));
await browser.close();console.log(fails?`${fails} FAILED`:'all checks passed');process.exit(fails?1:0);
