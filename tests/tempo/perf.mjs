// Rendered performance under 4x CPU throttle WITH live audio: v0.7 vs v0.7 TEMPO, skilled-ish bot (intent),
// opening (0–10 s), horde (from 26 s, 10 s), boss (10 s). Output: research/v07t/perf.json
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await browser.newContext({viewport:{width:412,height:732},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errors=[],report=[];
for(const [file,api,stage] of [[path.join(root,'crunch.html'),'CRUNCH',0],[path.join(root,'tempo.html'),'CRUNCH',0]]){const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(pathToFileURL(file).href+(stage?'?all=1':''));await page.waitForFunction(a=>window[a]&&!document.getElementById('select').hidden,api);
  await page.evaluate(async()=>{await LAB.audio.init();});const cdp=await ctx.newCDPSession(page);
  for(const cls of ['slasher','crusher','caster'])for(const [phase,from,secs] of [['opening',0,10],['horde',26,10],['boss',stage?36.5:40.5,10]]){
    await page.evaluate(([a,c,n,from])=>{const X=window[a],C=LAB.combat;X.state.pickPolicy=ch=>ch[0];n?X.test.play(c,2,'intent',n):X.test.play(c,2,'intent');const S=X.state;while(S.t<from&&S.state==='play'){X.test.step(1/60);}
      window.__ms=[];window.__parts=[];clearInterval(window.__iv);window.__iv=setInterval(()=>{if(C.frameMs&&S.state==='play'&&!S.paused){__ms.push(C.frameMs);__parts.push([C.updMs,C.drawMs]);}},16);},[api,cls,stage,from]);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await page.waitForTimeout(secs*1000);await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    const ms=(await page.evaluate(()=>__ms.slice())).sort((a,b)=>a-b),parts=await page.evaluate(()=>__parts),st=await page.evaluate(()=>LAB.audio.stats());
    const pp=i=>{const a=parts.map(x=>x[i]).sort((x,y)=>x-y);return +a[Math.floor(a.length*.95)].toFixed(2);};
    const row={ver:file.endsWith('tempo.html')?'tempo':'v0.7',cls,phase,samples:ms.length,avg:+(ms.reduce((x,y)=>x+y,0)/ms.length).toFixed(2),p95:+ms[Math.floor(ms.length*.95)].toFixed(2),max:+ms[ms.length-1].toFixed(2),updP95:pp(0),drawP95:pp(1),audioCpuP95:+(st.cpuP95Ms||0).toFixed(2),bodies:await page.evaluate(()=>LAB.world.bodies.length)};
    report.push(row);console.log(`${row.ver.padEnd(8)} ${cls.padEnd(8)} ${phase.padEnd(8)} frame p95 ${row.p95}ms avg ${row.avg} max ${row.max} (update ${row.updP95} draw ${row.drawP95}) audio p95 ${row.audioCpuP95}ms bodies ${row.bodies}`);
    await page.evaluate(a=>{clearInterval(window.__iv);window[a].state.bot=null;},api);}
  await page.close();}
await writeFile(path.join(root,'research/v07t/perf.json'),JSON.stringify(report,null,1));await browser.close();if(errors.length){console.error(errors.slice(0,4));process.exit(1);}
