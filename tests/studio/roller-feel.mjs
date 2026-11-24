import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const shots=process.argv[2];
if(shots)await mkdir(shots,{recursive:true});
const root=new URL(process.env.STUDIO_PREVIEW_URL||new URL('../../studio.html',import.meta.url).href);
const study=new URL(root);
study.searchParams.set('roller','feel');
const browser=await chromium.launch({channel:'chrome'});
try{
  const context=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const shot=async name=>{if(shots)await page.screenshot({path:path.join(shots,name+'.png')});};
  const tap=id=>page.locator('#'+id).tap();
  await page.goto(root.href);
  await page.locator('#title').waitFor();
  assert(await page.locator('#roller-practice').isHidden());
  assert.equal(await page.evaluate(()=>Boolean(LAB.combat.rollerFeel)),false);
  await page.goto(study.href);
  await page.locator('#title').waitFor();
  await shot('roller-feel-title');
  await tap('roller-practice');
  assert.equal(await page.locator('#material-cards button:enabled').count(),3);
  await tap('book-confirm');
  await page.waitForFunction(()=>LAB.audio.stats().ready);
  const cdp=await context.newCDPSession(page), box=await page.locator('#scene').boundingBox();
  async function touch(type,x,y){
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{x:box.x+x*box.width/720,y:box.y+y*box.height/1280,id:1}]});
  }
  const specimen=await page.evaluate(()=>{const b=LAB.combat.targets()[0];return {x:b.x,y:b.y};});
  await touch('touchStart',specimen.x,specimen.y);
  const initial=await page.evaluate(()=>{
    const b=LAB.combat.targets()[0];
    return {squash:b.squash,stage:b.rollFeel?.stage,
      contact:LAB.events.history.find(event=>event.name==='impact'&&event.material==='wax')};
  });
  assert(initial.squash>.46 && initial.stage===0 && initial.contact,JSON.stringify(initial));
  await page.waitForFunction(()=>LAB.audio.stats().events.some(e=>e.name==='synth_wax_snap'));
  await page.waitForFunction(()=>LAB.combat.targets()[0]?.rollFeel?.stage>=2);
  await shot('roller-feel-press');
  await page.waitForFunction(()=>LAB.combat.rollerFeel.remnants.length===1);
  await touch('touchEnd');
  assert.equal(await page.locator('#kills').textContent(),'1');
  await shot('roller-feel-residue');
  await touch('touchStart',specimen.x,specimen.y);
  await page.waitForFunction(()=>LAB.combat.state.stats.rollFeel.rework===1);
  await page.waitForFunction(()=>LAB.combat.rollerFeel.remnants.length===0);
  await touch('touchCancel');
  assert.equal(await page.locator('#kills').textContent(),'1');
  assert(await page.locator('#roll-feel-mode').isHidden());
  await tap('pause');
  await tap('leave');
  await page.locator('#book-heading').waitFor();
  assert.equal(await page.locator('#book-heading').textContent(),'ROLLERの練習');
  const group=page.locator('label').filter({has:page.locator('input[value="group"]')});
  await group.tap();
  await page.locator('#material-cards [data-stage="3"]').tap();
  await tap('book-confirm');
  await touch('touchStart',225,860);
  for(let i=0;i<24;i++){
    await touch('touchMove',225,860-i*13);
    await page.waitForTimeout(53);
  }
  await shot('roller-feel-soap-run');
  await touch('touchEnd');
  const materialResult=await page.evaluate(()=>LAB.combat.state.stats.rollFeel);
  assert(materialResult.slow>0&&materialResult.gather>0&&materialResult.chips>0,JSON.stringify(materialResult));
  assert.deepEqual(errors,[]);
  console.log('Chrome touch:', {initialSquash:initial.squash, firstContactFrame:initial.contact.frame, ...materialResult});

  study.searchParams.set('test','1');
  await page.goto(study.href);
  await page.locator('#title').waitFor();
  const details=await page.evaluate(()=>{
    const {G,start,step,input,targets}=StudioTest, C=LAB.combat;
    const advance=seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++)step(1/60);};
    const make=(m,layout)=>start('roller',StudioContent.stages[m],layout);
    const move=(a,b,time)=>{
      const steps=Math.ceil(time*60);
      for(let i=1;i<=steps;i++){
        input.move({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps});
        step(1/60);
      }
    };
    const sampleMotion=mode=>{
      make(0,'single');
      const body=targets()[0], center={x:body.x,y:body.y};
      if(mode==='hold'){input.down(center);advance(.5);}
      else {
        const from={x:center.x-122,y:center.y}, to={x:center.x+122,y:center.y};
        input.down(from);move(from,to,mode==='slow'?1.65:.34);
      }
      input.up();
      return {depth:body.rollFeel?.depth||0,stages:body.rollFeel?.stage||0,
        modes:G.stats.rollFeel,kill:G.stats.kills};
    };
    const modes=Object.fromEntries(['hold','slow','quick'].map(m=>[m,sampleMotion(m)]));
    make(0,'single');
    const b=targets()[0],at={x:b.x,y:b.y};
    input.down(at);advance(1.28);
    const before=C.rollerFeel.remnants.length;
    move(at,{x:at.x+115,y:at.y},.65);
    move({x:at.x+115,y:at.y},at,.65);
    advance(.3);input.up();
    const turn={before,after:C.rollerFeel.remnants.length,score:G.stats.kills,reworked:G.stats.rollFeel.rework};
    const width=[];
    for(let i=0;i<=3;i++){
      make(1,'group');
      const upgrades=['wide','gather','heavy']; upgrades.slice(0,i).forEach(u=>G.hero.ups.add(u));
      width.push(C.rollerFeel.profile(G.hero).width*2);
    }
    const speed=[.43,.8];
    const finished=speed.map(time=>{
      make(1,'group');
      ['wide','gather','heavy'].forEach(id=>G.hero.ups.add(id));
      const from={x:360,y:850},to={x:360,y:400};
      input.down(from);move(from,to,time);move(to,from,time);input.up();
      return {hits:G.stats.hurts,kills:G.stats.kills,remaining:targets().length};
    });
    make(2,'single');
    return {modes,turn,width,finished, reset:C.rollerFeel.remnants.length};
  });
  assert(details.modes.hold.modes.hold>0 && details.modes.hold.stages>=2,JSON.stringify(details));
  assert(details.modes.slow.modes.slow>0 && details.modes.slow.depth>details.modes.quick.depth,JSON.stringify(details));
  assert(details.modes.quick.modes.quick>0,JSON.stringify(details));
  assert.deepEqual(details.turn,{before:1,after:0,score:1,reworked:1});
  assert(details.width.every((v,i,a)=>i===0||v>a[i-1]));
  assert(details.finished.some(batch=>batch.kills>=4),JSON.stringify(details));
  assert.equal(details.reset,0);
  assert.deepEqual(errors,[]);
  console.log('Comparative input paths, same-gesture turnback, growth:',JSON.stringify(details));

  const compact=await browser.newPage({viewport:{width:320,height:568}});
  await compact.goto(study.href);
  await compact.locator('#roller-practice').waitFor();
  assert.equal(await compact.evaluate(()=>document.documentElement.scrollWidth),320);
  await compact.locator('#roller-practice').click();
  await compact.locator('#book-confirm').click();
  assert(await compact.locator('#free-refill').isVisible());
}finally{await browser.close();}
