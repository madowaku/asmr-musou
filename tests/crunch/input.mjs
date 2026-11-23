// Real touch input in Chrome (phone viewport, isMobile, real time): does each gesture damage the enemy that was
// touched, with a visible change (chip: area drops, cracks appear)? Does a tap on the enemy near the line hit THAT
// enemy (not the one higher up)? Upgrade overlay. Output: research/v07/input.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});const ctx=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'crunch.html')).href);await page.waitForFunction(()=>window.CRUNCH&&!document.getElementById('select').hidden);
const box=await page.locator('#scene').boundingBox(),scr=p=>({x:box.x+p.x/720*box.width,y:box.y+p.y/1280*box.height});
const cdp=await ctx.newCDPSession(page);
async function touch(points){const tp=p=>{const q=scr(p);return [{x:q.x,y:q.y,id:1}];};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:tp(points[0])});
  for(const p of points.slice(1)){await page.waitForTimeout(16);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:tp(p)});}await page.waitForTimeout(40);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
// a fixed scene: one enemy high, one close to the line, both frozen in place
const setup=async cls=>page.evaluate(cls=>{const C=LAB.combat,W=LAB.world,S=CRUNCH.state;CRUNCH.test.play(cls,5,null);W.bodies.length=0;
  const hi=C.crunch.spawn('weak',250,330,{m:'wax'}),lo=C.crunch.spawn('weak',470,930,{m:'jelly'});for(const e of [hi,lo]){e.speed=0;}S.sched.weak=99;return {hi:{id:hi.id,x:hi.x,y:hi.y},lo:{id:lo.id,x:lo.x,y:lo.y}};},cls);
const state=()=>page.evaluate(()=>{const W=LAB.world;return W.enemies().map(e=>({id:e.id,x:Math.round(e.x),y:Math.round(e.y),area:Math.round(e.area),hits:e.hits,hpc:e.hpc,cracks:(e.cracks||[]).length}));});
const report={};
for(const cls of ['slasher','crusher','caster']){const s=await setup(cls);await page.waitForTimeout(300);const before=await state();
  if(cls==='slasher')await touch([{x:s.lo.x-160,y:s.lo.y+10},{x:s.lo.x-80,y:s.lo.y+5},{x:s.lo.x,y:s.lo.y},{x:s.lo.x+80,y:s.lo.y-5},{x:s.lo.x+160,y:s.lo.y-10}]);
  else await touch([{x:s.lo.x,y:s.lo.y}]);
  await page.waitForTimeout(700);const after=await state();
  // after the hit the enemy near the line is a new body (the chipped core); find it by proximity
  const near=(list,p)=>list.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  const lo0=before.find(e=>e.id===s.lo.id),hi0=before.find(e=>e.id===s.hi.id),lo1=near(after,s.lo),hi1=near(after,s.hi);
  report[cls]={lowHit:!!lo1&&(lo1.hits>0||!after.length||Math.hypot(lo1.x-s.lo.x,lo1.y-s.lo.y)>150),lowAreaBefore:lo0.area,lowAreaAfter:lo1?lo1.area:0,lowCracks:lo1?lo1.cracks:0,lowMovedUp:lo1?s.lo.y-lo1.y:null,highUntouched:!!hi1&&hi1.hits===0&&Math.abs(hi1.area-hi0.area)<2};
  console.log(cls,JSON.stringify(report[cls]));}
// upgrade overlay: time stops, the power line is shown, a pick applies
await page.evaluate(()=>{CRUNCH.test.play('caster',2,null);const S=CRUNCH.state;S.t=11.95;});await page.waitForTimeout(400);
const up=await page.evaluate(()=>({shown:!document.getElementById('upgrade').hidden,paused:CRUNCH.state.paused,power:document.getElementById('up-power').textContent,t:CRUNCH.state.t}));
await page.waitForTimeout(400);const t2=await page.evaluate(()=>CRUNCH.state.t);await page.tap('#up-cards button');await page.waitForTimeout(200);
report.upgrade={...up,timeStopped:Math.abs(t2-up.t)<1e-6,applied:await page.evaluate(()=>CRUNCH.state.hero.ups.size===1)};console.log('upgrade',JSON.stringify(report.upgrade));
report.errors=errors;await writeFile(path.join(root,'research/v07/input.json'),JSON.stringify(report,null,1));await browser.close();
if(errors.length){console.error(errors);process.exit(1);}
