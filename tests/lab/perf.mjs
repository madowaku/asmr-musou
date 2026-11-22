import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root,openLab,swipe } from './helpers.mjs';
const browser=await chromium.launch({channel:'chrome'});
try{
  const {page,errors,network}=await openLab(browser,{clock:false,mobile:true}),cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await page.waitForTimeout(300);
  let swipes=0;const start=performance.now();await page.evaluate(()=>LAB.test.profile(true));
  while(performance.now()-start<10000){
    await page.evaluate(()=>{LAB.test.hordeQueued(40);const points=[];for(let i=0;i<11;i++){const y=345+i*68;points.push({x:i%2?720:0,y},{x:i%2?0:720,y});}LAB.test.path(points,3000);});swipes++;await page.waitForTimeout(850);
  }
  const data=await page.evaluate(()=>{LAB.test.replenish(false);return LAB.test.profile(false);}),samples=data.samples,sorted=samples.slice().sort((a,b)=>a-b);
  const report={scenario:'40 scattered mixed wax/jelly grunts; a scripted serpentine swipe every 850ms; scheduled visual waves, book/strip caps, sprite debris and replay capture included in rAF; horde setup included in rAF',chrome:await browser.version(),throttle:4,durationMs:Math.round(performance.now()-start),swipes,frames:samples.length,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),...data.load,inputWorkMaxMs:Math.max(...data.inputSamples),scope:'JS frame work including queued cut processing; excludes browser pointer dispatch, GPU completion, compositor and actual device latency',targetP95Ms:8};
  report.stages=Object.fromEntries(['update','draw'].map(key=>{const values=data.stages.map(s=>s[key]).sort((a,b)=>a-b);return [key,{avg:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)}];}));report.slowestFrames=data.stages.slice().sort((a,b)=>b.total-a.total).slice(0,5);
  await mkdir(path.join(root,'research/v03'),{recursive:true});await writeFile(path.join(root,'research/v03/perf_r0c.json'),JSON.stringify(report,null,2)+'\n');console.log('PERF:',JSON.stringify(report));
  assert(samples.length>100);assert(swipes>=10);assert(data.load.maxBodies>=40);assert(data.load.cuts>=20);assert(data.load.maxParticles>0);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert(report.p95Ms<8,`4x JS p95 ${report.p95Ms} ms >=8 ms`);
}finally{await browser.close();}
