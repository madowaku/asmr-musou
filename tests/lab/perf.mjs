import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root,openLab,swipe } from './helpers.mjs';
const browser=await chromium.launch({channel:'chrome'});
try{
  const {page,errors,network}=await openLab(browser,{clock:false,mobile:true}),cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await page.evaluate(()=>{LAB.test.horde(40);LAB.test.replenish(true);});await page.waitForTimeout(400);
  const line=await page.evaluate(()=>LAB.test.hordeLine);let swipes=0;const start=performance.now();await page.evaluate(()=>LAB.test.profile(true));
  while(performance.now()-start<10000){await swipe(page,swipes%2?line.b:line.a,swipes%2?line.a:line.b,{steps:12,clock:false});swipes++;}
  const data=await page.evaluate(()=>{LAB.test.replenish(false);return LAB.test.profile(false);}),samples=data.samples,sorted=samples.slice().sort((a,b)=>a-b);
  const report={scenario:'40 mixed wax/jelly roots replenished every 0.45 simulation seconds; continuous real pointer swipes; all slicing, respawn, shape matching, debris and draw submissions inside measured rAF; retain 120 bodies on refill, subsequent cuts can increase this up to runtime cap 240',chrome:await browser.version(),throttle:4,durationMs:Math.round(performance.now()-start),swipes,frames:samples.length,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),...data.load,inputWorkMaxMs:Math.max(...data.inputSamples),scope:'JS frame work including queued cut processing; excludes browser pointer dispatch, GPU completion, compositor and actual device latency',targetP95Ms:8};
  report.stages=Object.fromEntries(['update','draw'].map(key=>{const values=data.stages.map(s=>s[key]).sort((a,b)=>a-b);return [key,{avg:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)}];}));report.slowestFrames=data.stages.slice().sort((a,b)=>b.total-a.total).slice(0,5);
  await mkdir(path.join(root,'research/v03'),{recursive:true});await writeFile(path.join(root,'research/v03/perf_r0a.json'),JSON.stringify(report,null,2)+'\n');console.log('PERF:',JSON.stringify(report));
  assert(samples.length>100);assert(swipes>=10);assert(data.load.minBodies>=40);assert(data.load.cuts>=20);assert(data.load.maxParticles>0);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert(report.p95Ms<8,`4x JS p95 ${report.p95Ms} ms >=8 ms`);
}finally{await browser.close();}
