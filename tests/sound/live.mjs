// Live preview check (phone viewport, fresh visitor): Stage 1 with the intent bot to the result, unlock of Stage 2, intro shown once.
import {chromium} from 'playwright';
const url=process.argv[2]||'https://research-v0-6-sound.asmr-musou.pages.dev/stages.html';
const b=await chromium.launch({channel:'chrome'});const ctx=await b.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto(url);await p.waitForFunction(()=>window.STAGES&&!document.getElementById('select').hidden,null,{timeout:30000});
const before=await p.evaluate(()=>[...document.querySelectorAll('.stage')].slice(0,3).map(b=>b.disabled));
await p.tap('#pick-crusher');await p.waitForTimeout(800);const intro=await p.evaluate(()=>!document.getElementById('intro').hidden&&document.getElementById('intro').textContent);
await p.evaluate(()=>{STAGES.state.pickPolicy=ch=>ch[0];STAGES.state.bot=null;});
// play by real taps for 4 s, then let the bot finish quickly
const box=await p.locator('#scene').boundingBox();for(let i=0;i<8;i++){const e=await p.evaluate(()=>{const t=LAB.combat.targets();return t.length?{x:t[0].x,y:t[0].y}:null;});if(e)await p.touchscreen.tap(box.x+e.x/720*box.width,box.y+e.y/1280*box.height);await p.waitForTimeout(450);}
const kills=await p.evaluate(()=>STAGES.state.stats.kills);
await p.evaluate(()=>{const S=STAGES.state;let n=0;while(S.state==='play'&&n<60*70){STAGES.test.step(1/60);if(S.paused)document.querySelector('#up-cards button')?.click();n++;}});await p.waitForTimeout(500);
const res=await p.evaluate(()=>({eyebrow:document.getElementById('r-eyebrow').textContent,next:document.getElementById('next-stage').textContent,mats:document.getElementById('r-mats').textContent}));
await p.tap('#to-stages');await p.waitForTimeout(300);const after=await p.evaluate(()=>[...document.querySelectorAll('.stage')].slice(0,3).map(b=>b.disabled));
await p.tap('#next-stage').catch(()=>{});await p.evaluate(()=>{});
console.log(JSON.stringify({lockedBefore:before,introFirstTime:intro,realTapKills:kills,result:res,lockedAfter:after,errors}));await b.close();
