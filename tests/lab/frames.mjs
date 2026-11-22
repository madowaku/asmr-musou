import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root,openLab,reset,swipe,waxLine,state } from './helpers.mjs';
const browser=await chromium.launch({channel:'chrome'}),dir=path.join(root,'research/v03/frames'),receipt={method:'file:// Chrome; clock.install + pauseAt; real pointer; first rAF at 16 ms then runFor(33); 6 x 3 grids',scenes:{}};
await mkdir(dir,{recursive:true});
try{
  const {page,errors}=await openLab(browser);
  for(const name of ['wax_cut','wax_crack','jelly_cut','horde_swipe']){
    if(name==='horde_swipe'){await page.evaluate(()=>LAB.test.horde(60));await page.clock.runFor(33);/* one fast zig-zag rake through the mob, as a player would */const box=await page.locator('#scene').boundingBox(),P=v=>[box.x+v[0]*box.width/720,box.y+v[1]*box.height/1280];const pts=[[20,650],[700,700],[20,760]];await page.mouse.move(...P(pts[0]));await page.mouse.down();for(const q of pts.slice(1))await page.mouse.move(...P(q),{steps:4});await page.mouse.up();await page.clock.runFor(16);}
    else{await reset(page,name==='jelly_cut'?'jelly':'wax');if(name==='wax_crack'){await page.mouse.click(310,595);await page.clock.runFor(16);}else await swipe(page,waxLine.a,waxLine.b);}
    const captures=[],states=[];
    for(let i=0;i<18;i++){
      captures.push({ms:16+i*33,data:(await page.locator('#scene').screenshot()).toString('base64')});const s=await state(page);states.push({ms:16+i*33,frame:s.frame,cutCount:s.cutCount,bodies:s.bodies.map(b=>({id:b.id,x:b.x,y:b.y,amplitude:b.soft?.amplitude,crack:b.crack})),particles:s.particles});if(i<17)await page.clock.runFor(33);
    }
    const sheet=await browser.newPage({offline:true});
    const png=await sheet.evaluate(async({captures,name})=>{
      const crop=name==='horde_swipe'?{x:0,y:335,w:720,h:815}:{x:135,y:385,w:450,h:535},w=name==='horde_swipe'?260:250,h=Math.round(w*crop.h/crop.w),ch=h+30,c=document.createElement('canvas');c.width=w*6;c.height=ch*3;const g=c.getContext('2d');g.fillStyle='#101c23';g.fillRect(0,0,c.width,c.height);
      for(let i=0;i<captures.length;i++){const im=new Image();im.src='data:image/png;base64,'+captures[i].data;await im.decode();const x=i%6*w,y=Math.floor(i/6)*ch;g.drawImage(im,crop.x,crop.y,crop.w,crop.h,x+2,y+28,w-4,h-2);g.fillStyle='#d3e7dc';g.font='14px system-ui';g.fillText(name+' · '+captures[i].ms+' ms',x+9,y+20);}return c.toDataURL('image/png').split(',')[1];
    },{captures,name});await writeFile(path.join(dir,name+'.png'),Buffer.from(png,'base64'));await sheet.close();receipt.scenes[name]=states;
  }
  assert.deepEqual(errors,[]);await writeFile(path.join(dir,'states.json'),JSON.stringify(receipt,null,2)+'\n');console.log('Frame strips:',Object.keys(receipt.scenes).join(', '));
}finally{await browser.close();}
