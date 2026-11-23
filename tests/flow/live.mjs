// Live preview check (phone, fresh visitor, real touch): SPINNER — draw circles with a real touch stream on the
// nearest enemies; then the caster with taps; the rest of the run by steps to the result. Errors must be none.
import {chromium} from 'playwright';
const url=process.argv[2]||'https://research-v0-8-flow.asmr-musou.pages.dev/flow.html';
const b=await chromium.launch({channel:'chrome'});const ctx=await b.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto(url);await p.waitForFunction(()=>window.CRUNCH&&!document.getElementById('select').hidden,null,{timeout:30000});
const out={};
await p.tap('#pick-spinner');await p.waitForTimeout(400);
const box=await p.locator('#scene').boundingBox(),scr=q=>({x:box.x+q.x/720*box.width,y:box.y+q.y/1280*box.height});const cdp=await ctx.newCDPSession(p);
for(let k=0;k<4;k++){const e=await p.evaluate(()=>{const t=LAB.combat.targets().filter(e=>e.y>200).sort((a,b)=>b.y-a.y);return t.length?{x:t[0].x,y:t[0].y}:{x:360,y:600};});
  const R=70,N=40;const pt=i=>{const a=i/N*1.5*6.283,q=scr({x:e.x+Math.cos(a)*R,y:e.y+Math.sin(a)*R});return [{x:q.x,y:q.y,id:1}];};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pt(0)});for(let i=1;i<=N;i++){await p.waitForTimeout(22);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pt(i)});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);}
out.spinner=await p.evaluate(()=>({spinStarts:CRUNCH.state.stats.spinStarts||0,ticks:CRUNCH.state.stats.spinTicks||0,kills:CRUNCH.state.stats.kills,hurts:CRUNCH.state.stats.hurts,energy:Math.round(CRUNCH.state.energy),lv:CRUNCH.state.hero.ups.size}));
await p.screenshot({path:'research/v08/screens/live_spinner.png'});
await p.evaluate(()=>{const S=CRUNCH.state;S.pickPolicy=ch=>ch[0];let n=0;while(S.state==='play'&&n<60*70){CRUNCH.test.step(1/60);n++;}});await p.waitForTimeout(400);
out.result=await p.evaluate(()=>({title:document.getElementById('r-title').textContent,growth:document.getElementById('r-growth').textContent.slice(0,80)}));
out.errors=errors;console.log(JSON.stringify(out));await b.close();
