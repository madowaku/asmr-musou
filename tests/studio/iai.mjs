import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const shots=process.argv[2];
if(shots)await mkdir(shots,{recursive:true});
const url=new URL(process.env.STUDIO_PREVIEW_URL||new URL('../../studio.html',import.meta.url).href);
url.searchParams.set('slasher','iai');
url.searchParams.set('test','1');
const browser=await chromium.launch({channel:'chrome'});
try{
  const context=await browser.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const shot=async name=>{if(shots)await page.screenshot({path:path.join(shots,'iai-'+name+'.png')});};
  await page.goto(url.href);
  await page.locator('#roller-practice').getByText('居合の練習', {exact:false}).waitFor();
  await page.locator('#roller-practice').tap();
  await page.locator('label').filter({has:page.locator('input[value="group"]')}).tap();
  await page.locator('#book-confirm').tap();
  await page.waitForFunction(()=>LAB.audio.stats().ready);
  const advance=async count=>page.evaluate(count=>{
    for(let i=0;i<count;i++)StudioTest.step(1/60);
  },count);
  const cdp=await context.newCDPSession(page), box=await page.locator('#scene').boundingBox();
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{
    x:box.x+x*box.width/720,y:box.y+y*box.height/1280,id:1
  }]});
  assert(await page.evaluate(()=>StudioTest.targets().every(body=>body.hpc===1)));
  await touch('touchStart',120,620);
  await touch('touchMove',181,620);
  await touch('touchMove',360,620);
  await touch('touchMove',540,620);
  await touch('touchEnd');
  const state=()=>page.evaluate(()=>({actions:[...StudioTest.G.actions.values()].map(a=>a.kind), kills:StudioTest.G.stats.kills,
    cuts:LAB.events.history.filter(e=>e.name==='cut'), pieces:StudioTest.world.bodies.filter(b=>b.active&&b.cap).length}));
  assert.deepEqual((await state()).actions,['iai']);
  await advance(6);
  assert.equal((await state()).kills,0);
  assert.equal((await state()).pieces,0);
  await shot('still');
  await advance(12);
  assert.equal((await state()).kills,1);
  await shot('open');
  await advance(12);
  const open=await state();
  assert.equal(open.kills,2);
  assert(open.pieces>=4);
  assert(open.cuts[0].x<open.cuts[1].x && open.cuts[0].time<open.cuts[1].time);
  assert(open.cuts.every(cut=>cut.faces.length>=2));
  await page.waitForFunction(()=>LAB.audio.stats().events.some(event=>event.name==='synth_wax_cut'));
  console.log('touch -> quiet -> real section faces',open.cuts.map(c=>({x:Math.round(c.x),t:c.time.toFixed(3),faces:c.faces.length})));
  await shot('separated');

  const run=await page.evaluate(()=>{
    const {G,input,step,start,targets}=StudioTest;
    start('slasher',StudioContent.stages[0]);
    let next=0;
    for(let i=0;i<4800&&G.state==='play';i++){
      if(G.choice)document.querySelector('.upcard').click();
      if(!G.bossDown&&G.t>=next){
        const enemy=targets().find(e=>e.y>270&&e.y<1080);
        if(enemy){
          input.down({x:enemy.x-108,y:enemy.y});input.move({x:enemy.x-46,y:enemy.y});input.up();
          next=G.t+.39;
        }
      }
      step(1/60);
    }
    return {clear:G.stats.bossDefeated,time:G.t,level:G.hero.ups.size+1,cutErrors:G.stats.cutErrors||0};
  });
  assert(run.clear,JSON.stringify(run));
  assert.deepEqual(errors,[]);
  console.log('Iai-only defence:',run);
} finally { await browser.close(); }
