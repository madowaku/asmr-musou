// Real touch: the finger stays on the SAME spot and taps 4 times (0.35 s apart) on one opening enemy, as a person
// mashing would. Does every tap land on that enemy (v0.7 vs TEMPO)? How far does the enemy move per hit?
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});const out={};
for(const file of ['crunch.html','tempo.html']){const ctx=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root,file)).href);await page.waitForFunction(()=>window.CRUNCH&&!document.getElementById('select').hidden);
  const box=await page.locator('#scene').boundingBox(),scr=p=>({x:box.x+p.x/720*box.width,y:box.y+p.y/1280*box.height});
  for(const cls of ['slasher','crusher','caster']){
    const s=await page.evaluate(cls=>{const C=LAB.combat,W=LAB.world,S=CRUNCH.state;CRUNCH.test.play(cls,5,null);W.bodies.length=0;S.sched.weak=99;
      const e=C.crunch.spawn('weak',360,620,{m:'wax'});e.speed=0;e.uid=e.id;window.__log=[];const h=C.crunch.hurt;C.crunch.hurt=(a,d,f,o)=>{const c=h(a,d,f,o);c.uid=a.uid??a.id;c.speed=0;c.base=0;__log.push({t:S.t,x:c.x,y:c.y,kind:'hurt'});return c;};
      const ob=W.onBreak;W.onBreak=(b,o)=>{if(!b.depth)__log.push({t:S.t,x:b.x,y:b.y,kind:'kill'});return ob(b,o);};window.__restore=()=>{C.crunch.hurt=h;W.onBreak=ob;};return {x:e.x,y:e.y};},cls);
    const q=scr(s);
    for(let i=0;i<4;i++){if(cls==='slasher'){await page.touchscreen.tap(q.x,q.y).catch(()=>{});const a=scr({x:s.x-120,y:s.y}),b=scr({x:s.x+120,y:s.y});await page.mouse.move(a.x,a.y);}
      if(cls==='slasher'){const c=await ctx.newCDPSession(page);const pts=[-120,-60,0,60,120].map(dx=>scr({x:s.x+dx,y:s.y}));await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pts[0].x,y:pts[0].y,id:1}]});for(const p of pts.slice(1)){await page.waitForTimeout(16);await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y,id:1}]});}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else await page.touchscreen.tap(q.x,q.y);
      await page.waitForTimeout(350);}
    await page.waitForTimeout(600);const log=await page.evaluate(()=>{__restore();return __log;});
    const moves=[];let px=s.x,py=s.y;for(const l of log){moves.push(Math.round(Math.hypot(l.x-px,l.y-py)));px=l.x;py=l.y;}
    out[file+' '+cls]={landed:log.length,killed:log.some(l=>l.kind==='kill'),movePerHit:moves};console.log(file.padEnd(12),cls.padEnd(8),JSON.stringify(out[file+' '+cls]));}
  if(errors.length)console.error(errors);await ctx.close();}
await writeFile(path.join(root,'research/v07t/mash.json'),JSON.stringify(out,null,1));await browser.close();
