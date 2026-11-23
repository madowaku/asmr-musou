// Rendered performance under 4x CPU throttle WITH live audio (the material engine runs on the main thread in a
// ScriptProcessor, so its cost competes with the frame): v0.5 FEEL vs v0.6 stages 1 and 3, skilled bot,
// rush (first 14 s) and boss (10 s). Output: research/v06/perf.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await browser.newContext({viewport:{width:412,height:732},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errors=[],report=[];
const cases=[['feel.html','FEEL',0],['stages.html','STAGES',1],['stages.html','STAGES',3]];
for(const [file,api,stage] of cases){const page=await ctx.newPage();page.on('pageerror',e=>errors.push(file+': '+String(e.stack||e)));
  await page.goto(pathToFileURL(path.join(root,file)).href+(stage?'?all=1':''));await page.waitForFunction(a=>window[a]&&!document.getElementById('select').hidden,api);
  const audio=await page.evaluate(async()=>{await LAB.audio.init();return LAB.audio.stats().ready;});
  const cdp=await ctx.newCDPSession(page);
  for(const cls of ['slasher','crusher','caster']){
    for(const phase of ['rush','boss']){
      await page.evaluate(([a,c,n,phase])=>{const X=window[a],C=LAB.combat;window.__ms=[];window.__parts=[];clearInterval(window.__iv);
        if(phase==='rush'){X.state.pickPolicy=ch=>ch[0];n?X.test.play(c,2,'skilled',n):X.test.play(c,2,'skilled');}
        else{X.state.t=35.8;}
        window.__iv=setInterval(()=>{if(C.frameMs&&X.state.state==='play'&&!X.state.paused){__ms.push(C.frameMs);__parts.push([C.updMs,C.drawMs]);}},16);},[api,cls,stage,phase]);
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});const a0=await page.evaluate(()=>{const s=LAB.audio.stats();return s.counters?{...s.counters}:null;});
      await page.waitForTimeout(phase==='rush'?14000:10000);await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      const ms=(await page.evaluate(()=>__ms.slice())).sort((a,b)=>a-b),parts=await page.evaluate(()=>__parts),st=await page.evaluate(()=>LAB.audio.stats());
      const pp=i=>{const a=parts.map(x=>x[i]).sort((x,y)=>x-y);return +a[Math.floor(a.length*.95)].toFixed(2);};
      const row={page:file,stage,cls,phase,samples:ms.length,avg:+(ms.reduce((x,y)=>x+y,0)/ms.length).toFixed(2),p95:+ms[Math.floor(ms.length*.95)].toFixed(2),max:+ms[ms.length-1].toFixed(2),updP95:pp(0),drawP95:pp(1),
        audioReady:audio,audioCpuP95:+(st.cpuP95Ms||0).toFixed(2),audioCpuMax:+(st.cpuMaxMs||0).toFixed(2),voicesMax:st.maxActive,kills:await page.evaluate(a=>window[a].state.stats.kills,api)};
      report.push(row);console.log(`${(stage?'v0.6 S'+stage:'v0.5   ').padEnd(8)} ${cls.padEnd(8)} ${phase.padEnd(5)} frame p95 ${row.p95}ms avg ${row.avg} max ${row.max} (update ${row.updP95} draw ${row.drawP95}) audio cb p95 ${row.audioCpuP95}ms max ${row.audioCpuMax} voices ${row.voicesMax}`);}
    await page.evaluate(a=>{window[a].state.bot=null;window[a].state.pickPolicy=null;},api);}
  await page.close();}
await writeFile(path.join(root,'research/v06/perf.json'),JSON.stringify(report,null,1));await browser.close();
if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
