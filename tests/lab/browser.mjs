import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {root,openLab,reset,swipe,waxLine,state} from './helpers.mjs';
const browser=await chromium.launch({channel:'chrome'}),report={};
try{
 const {page,errors,network}=await openLab(browser);
 await reset(page,'wax');await swipe(page,waxLine.a,waxLine.b);let s=await state(page);assert.equal(s.bodies.length,2);assert(s.freeze>=.045);const fractureTime=s.lastCut.time;
 await page.clock.runFor(33);report.waxCaps=await page.evaluate(()=>LAB.test.capPixels());for(const cap of report.waxCaps)assert(cap.ratio>=.15,JSON.stringify(cap));
 s=await state(page);assert(s.events.some(e=>e.name==='kill'));assert(s.events.some(e=>e.name==='crack_grow'));
 await page.clock.runFor(500);s=await state(page);assert(s.bodies.some(b=>Math.abs(b.angle)>.3&&b.y>660));assert(s.events.some(e=>e.name==='peel'));report.waxFall=s.bodies.map(b=>({y:b.y,angle:b.angle,vy:b.vy}));
 // Recuts and actual curved pointer input remain geometric.
 const target=s.bodies[0];await swipe(page,{x:target.x-250,y:target.y},{x:target.x+250,y:target.y});assert((await state(page)).bodies.some(b=>b.depth>=2));
 await reset(page,'wax');await page.mouse.move(110,590);await page.mouse.down();await page.mouse.move(360,690);await page.mouse.move(610,590);await page.mouse.up();await page.clock.runFor(16);s=await state(page);assert.equal(s.bodies.length,2);assert(s.lastCut.faces.some(f=>Math.hypot(f.a.x-360,f.a.y-690)<.01));
 // A press supplies tension throughout the profile, then releases on the same frame as the cut.
 await reset(page,'wax');await page.mouse.click(360,645);await page.clock.runFor(32);const pressTime=(await state(page)).events.find(e=>e.name==='press').time;await page.clock.runFor(300);s=await state(page);assert.equal(s.cutCount,0);assert(s.events.some(e=>e.name==='strain'&&e.amount>.3));await page.clock.runFor(300);s=await state(page);assert.equal(s.cutCount,1);report.waxPreMs=(s.lastCut.time-pressTime)*1000;assert(report.waxPreMs>=300&&report.waxPreMs<=800);
 await reset(page,'jelly');await swipe(page,waxLine.a,waxLine.b);s=await state(page);assert.equal(s.cutCount,0);await page.clock.runFor(33);s=await state(page);assert.equal(s.cutCount,1);assert(s.events.some(e=>e.name==='strain'&&e.amount>0));
 const id=s.bodies[0].id,samples=[];
 for(let i=0;i<48;i++){await page.clock.runFor(33);const b=(await state(page)).bodies.find(b=>b.id===id);samples.push({ms:(i+1)*33,amplitude:b.soft.amplitude,face:b.soft.points.filter(p=>p.face).map(p=>p.y-p.ry),cap:b.cap.vertices});}
 const early=samples.slice(0,24),peak=Math.max(...early.flatMap(s=>s.face.map(Math.abs)));let reversals=0;const vals=early.map(s=>s.face[Math.floor(s.face.length/2)]);for(let i=1;i<vals.length;i++)if(vals[i]*vals[i-1]<0)reversals++;
 assert(peak>=4);assert(reversals>=4);assert(samples.at(-1).amplitude<samples[2].amplitude*.3);report.jelly={peakPx:peak,reversals,earlyRms:samples[2].amplitude,lateRms:samples.at(-1).amplitude,samples};
 // 30 overlapping targets is an explicit timing fixture, separate from the natural crowd UI.
 await page.evaluate(()=>{LAB.test.clear();for(let i=0;i<30;i++)LAB.test.spawn(i%3?'jelly':'wax',50+i*21,645+(i%3-1)*4,29,{variant:'grunt',lod:'strip'});LAB.test.path([{x:0,y:645},{x:720,y:645}],2500);});await page.clock.runFor(16);s=await state(page);const wave=s.events.find(e=>e.name==='wave');assert(wave);assert.equal(wave.kills.length,30);assert(s.cutCount>=1&&s.cutCount<=2,'first 16ms frame must only break the head of the wave: '+s.cutCount);await page.clock.runFor(500);s=await state(page);const cuts=s.events.filter(e=>e.name==='cut');assert.equal(cuts.length,30);for(let i=1;i<cuts.length;i++){assert(cuts[i].x>=cuts[i-1].x);assert(cuts[i].time>=cuts[i-1].time);}const span=(cuts.at(-1).time-cuts[0].time)*1000;assert(span>=300&&span<=450);report.wave={count:cuts.length,scheduledSpanMs:wave.kills.at(-1).dt,visualSpanMs:span,frames:cuts.map(c=>({x:c.x,time:c.time,frame:c.frame,dt:c.scheduledDt}))};
 // Replays restore exact geometry, leave live state/events frozen, then return to play.
 await page.clock.runFor(1000);const before=await state(page);assert(await page.evaluate(()=>LAB.capture.startReplay()));await page.clock.runFor(500);const during=await state(page);assert.equal(during.time,before.time);assert.deepEqual(during.events,before.events);assert(during.capture.replaying);await page.clock.runFor(6500);assert(!(await state(page)).capture.replaying);report.replay=before.capture;
 await page.evaluate(()=>{LAB.seed(317);LAB.test.horde(40);});s=await state(page);assert.equal(s.bodies.length,40);assert(s.bodies.every(b=>b.y>300&&b.y<1100));report.crowd={count:s.bodies.length,xRange:[Math.min(...s.bodies.map(b=>b.x)),Math.max(...s.bodies.map(b=>b.x))],yRange:[Math.min(...s.bodies.map(b=>b.y)),Math.max(...s.bodies.map(b=>b.y))]};
 for(const material of ['soap','sand','sponge','chalk','beadslime','kohaku']){await reset(page,material);await swipe(page,waxLine.a,waxLine.b);assert((await state(page)).cutCount>0);}
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);report.errors=errors;report.network=network;
 // Actual MediaRecorder and download, not a mocked API (real clock is required).
 const live=await openLab(browser,{clock:false,mobile:true});await live.page.keyboard.press('r');await swipe(live.page,waxLine.a,waxLine.b,{clock:false});await live.page.waitForTimeout(650);const download=live.page.waitForEvent('download');await live.page.keyboard.press('r');const file=await download;await file.saveAs(root+'/research/v03/recording_r0c.webm');assert((await file.suggestedFilename()).endsWith('.webm'));report.recording={file:'research/v03/recording_r0c.webm',label:await live.page.locator('#capture-status').textContent(),canvas:await live.page.locator('canvas').evaluate(c=>({width:c.width,height:c.height}))};assert.deepEqual(live.errors,[]);await live.page.close();
 await mkdir(root+'/research/v03',{recursive:true});await writeFile(root+'/research/v03/browser_r0c.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,jelly:{...report.jelly,samples:undefined}},null,2));
}finally{await browser.close();}
