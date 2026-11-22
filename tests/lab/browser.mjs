import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root,openLab,reset,swipe,waxLine,state } from './helpers.mjs';
const browser=await chromium.launch({channel:'chrome'}),report={};
try{
  const {page,errors,network}=await openLab(browser);let s=await state(page);assert(s.webgl2);assert.equal(await page.evaluate(()=>LAB.renderer.gl.getError()),0);
  await reset(page,'wax');await swipe(page,waxLine.a,waxLine.b);s=await state(page);assert.equal(s.bodies.length,2);assert.equal(s.cutCount,1);assert.equal(s.events.filter(e=>e.name==='cut').length,1);assert(s.freeze>0);assert(s.particles>0);
  const angleErrors=s.lastCut.faces.map(({a,b})=>{const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;return Math.abs(((angle-30+270)%180)-90);});assert(Math.max(...angleErrors)<3);report.wax={pieces:2,angleErrors,fractureFrame:s.lastCut.frame,particles:s.particles};
  // Existing fragments remain cuttable. Input is inverse-mapped through the camera.
  await page.clock.runFor(170);s=await state(page);const target=s.bodies[0];await swipe(page,{x:target.x,y:target.y-230},{x:target.x,y:target.y+230});assert((await state(page)).bodies.some(b=>b.depth===2));
  await reset(page,'wax');await page.mouse.move(110,590);await page.mouse.down();await page.mouse.move(360,690);await page.mouse.move(610,590);await page.mouse.up();await page.clock.runFor(16);s=await state(page);assert.equal(s.bodies.length,2);assert(s.lastCut.faces.some(f=>Math.hypot(f.a.x-360,f.a.y-690)<.01),'curved pointer corner is on cut boundary');
  await reset(page,'wax');await page.mouse.move(100,575);await page.mouse.down();await page.mouse.move(620,575);await page.mouse.move(620,715);await page.mouse.move(100,715);await page.mouse.up();await page.clock.runFor(16);assert.equal((await state(page)).bodies.length,3);report.curvedPointer='bent boundary preserved; return stroke makes three pieces';
  await reset(page,'wax');await page.mouse.click(310,595);const growth=[];for(let i=0;i<9;i++){await page.clock.runFor(16);growth.push((await state(page)).bodies[0].crack?.shown||0);}assert(growth[1]>growth[0]);assert(growth[4]>growth[2]);await page.clock.runFor(400);s=await state(page);assert(s.bodies[0].crack.peeled>0);assert(s.events.some(e=>e.name==='crack_grow'&&e.growthRate>0));assert(s.events.some(e=>e.name==='peel'));report.wax.crackLengthBy16ms=growth;report.wax.peeledCells=s.bodies[0].crack.peeled;
  await reset(page,'jelly');await swipe(page,waxLine.a,waxLine.b);s=await state(page);assert.equal(s.bodies.length,2);const bodyId=s.bodies[0].id,samples=[];
  for(let i=0;i<48;i++){await page.clock.runFor(33);const b=(await state(page)).bodies.find(b=>b.id===bodyId),face=b.soft.points.filter(p=>p.face);samples.push({ms:(i+1)*33,amplitude:b.soft.amplitude,displacement:face.map(p=>({x:p.x-p.rx,y:p.y-p.ry}))});}
  const early=samples.slice(0,15),late=samples.slice(-5),count=early[0].displacement.length;
  let variance=0,signChanges=0;
  for(let j=0;j<count;j++){const vals=early.map(s=>s.displacement[j].y),mean=vals.reduce((a,b)=>a+b,0)/vals.length;variance+=vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;for(let i=1;i<vals.length;i++)if(vals[i]*vals[i-1]<0)signChanges++;}variance/=count;
  const earlyPeak=Math.max(...early.map(s=>s.amplitude)),lateMax=Math.max(...late.map(s=>s.amplitude));report.jelly={variancePx2:variance,signChanges,earlyPeakPx:earlyPeak,lateMaxPx:lateMax,decayRatio:lateMax/earlyPeak,samples};assert(variance>1,'cut-face displacement variance >1 px²');assert(signChanges>=2,'actual oscillation, not monotonic drift');assert(lateMax<earlyPeak*.3,'1.5s damping');assert((await state(page)).events.some(e=>e.name==='wobble'));
  await page.clock.runFor(1700);s=await state(page);for(const b of s.bodies){assert(b.soft.amplitude<30,'soft-body remains bounded after 3s and floor contact');assert(b.soft.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
  await page.evaluate(()=>LAB.test.horde(40));await page.clock.runFor(33);const line=await page.evaluate(()=>LAB.test.hordeLine);await swipe(page,line.a,line.b);s=await state(page);const roots=new Set(s.events.filter(e=>e.name==='cut').map(e=>e.rootId));report.horde={initialBodies:40,cutRoots:roots.size,pieces:s.bodies.length,particles:s.particles,stroke:line};assert(roots.size>=20,'horde >=20 unique original bodies');
  await page.locator('#step').click();await page.clock.runFor(33);const t=(await state(page)).time;await page.clock.runFor(100);assert.equal((await state(page)).time,t);await page.locator('#step').click();await page.clock.runFor(33);assert(Math.abs((await state(page)).time-t-1/60)<1e-6);await page.locator('#slow').click();assert((await state(page)).slow);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);report.errors=errors;report.network=network;
  await page.close();
  const mobile=await openLab(browser,{mobile:true});await mobile.page.touchscreen.tap(180,320);await mobile.page.clock.runFor(100);assert((await state(mobile.page)).bodies[0].crack);assert.deepEqual(mobile.errors,[]);await mobile.page.close();report.mobile='360x640 touch tap; controls and pointer canvas loaded';
  await mkdir(path.join(root,'research/v03'),{recursive:true});await writeFile(path.join(root,'research/v03/browser_r0a.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Browser:',JSON.stringify({...report,jelly:{...report.jelly,samples:undefined}}));
}finally{await browser.close();}
