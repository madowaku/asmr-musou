// Live preview check (phone, fresh visitor, real taps): opening enemies get chipped by taps, a full run reaches the result.
import {chromium} from 'playwright';
const url=process.argv[2]||'https://research-v0-7-tempo.asmr-musou.pages.dev/tempo.html';
const b=await chromium.launch({channel:'chrome'});const ctx=await b.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto(url);await p.waitForFunction(()=>window.CRUNCH&&!document.getElementById('select').hidden,null,{timeout:30000});
await p.tap('#pick-caster');await p.waitForTimeout(500);
const box=await p.locator('#scene').boundingBox();
for(let i=0;i<10;i++){const e=await p.evaluate(()=>{const t=LAB.combat.targets().filter(e=>e.y>40).sort((a,b)=>b.y-a.y);return t.length?{x:t[0].x,y:t[0].y}:null;});if(e)await p.touchscreen.tap(box.x+e.x/720*box.width,box.y+e.y/1280*box.height);await p.waitForTimeout(500);}
const early=await p.evaluate(()=>({kills:CRUNCH.state.stats.kills,hurts:CRUNCH.state.stats.hurts,t:+CRUNCH.state.t.toFixed(1)}));
await p.screenshot({path:'research/v07t/screens/live_phone.png'});
await p.evaluate(()=>{const S=CRUNCH.state;S.pickPolicy=ch=>ch[0];let n=0;while(S.state==='play'&&n<60*70){CRUNCH.test.step(1/60);n++;}});await p.waitForTimeout(400);
const res=await p.evaluate(()=>({title:document.getElementById('r-title').textContent,defense:document.getElementById('r-defense').textContent,growth:document.getElementById('r-growth').textContent}));
console.log(JSON.stringify({early,res,errors}));await b.close();
