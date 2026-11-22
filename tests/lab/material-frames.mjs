// 33/100 ms frame strips for every material: single boss-size body cut by a real mouse swipe (+ sponge squeeze).
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {root,openLab,swipe,waxLine,state} from './helpers.mjs';
const OUT=root+'/research/v03/frames/materials';await mkdir(OUT,{recursive:true});
const plan={wax:33,jelly:33,soap:50,sand:150,sponge:50,chalk:80,beadslime:50,kohaku:33};
const browser=await chromium.launch({channel:'chrome'}),errors=[];const report={};
try{
  const {page,errors:e}=await openLab(browser);
  for(const [m,step] of Object.entries(plan)){
    await page.evaluate(m=>{LAB.seed(11);LAB.test.clear();LAB.test.spawn(m);},m);await page.clock.runFor(33);
    const box=await page.locator('#scene').boundingBox(),shots=[];
    if(m==='sponge'){const P=v=>[box.x+v.x*box.width/720,box.y+v.y*box.height/1280];await page.mouse.move(...P({x:360,y:640}));await page.mouse.down();}
    else await swipe(page,waxLine.a,waxLine.b);
    for(let i=0;i<18;i++){await page.clock.runFor(step);shots.push(await page.screenshot({clip:{x:box.x,y:box.y+box.height*.22,width:box.width,height:box.height*.66},scale:'css'}));}
    if(m==='sponge')await page.mouse.up();
    const s=await state(page);report[m]={cuts:s.cutCount,bodies:s.bodies.length,particles:s.particles,events:[...new Set(s.events.map(e=>e.name))]};
    await page.evaluate(async({shots,step,m})=>{const imgs=await Promise.all(shots.map(b=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+b;})));const w=imgs[0].width/3,h=imgs[0].height/3,c=document.createElement('canvas');c.width=w*6;c.height=(h+16)*3;const g=c.getContext('2d');g.fillStyle='#0b1418';g.fillRect(0,0,c.width,c.height);g.font='12px sans-serif';g.fillStyle='#cfe';imgs.forEach((im,i)=>{const x=(i%6)*w,y=Math.floor(i/6)*(h+16);g.fillText(`${m} · ${(i+1)*step} ms`,x+4,y+12);g.drawImage(im,x,y+16,w,h);});window.__sheet=c.toDataURL('image/png');},{shots:shots.map(b=>b.toString('base64')),step,m});
    const data=await page.evaluate(()=>window.__sheet);await (await import('node:fs/promises')).writeFile(`${OUT}/${m}.png`,Buffer.from(data.split(',')[1],'base64'));
  }
  errors.push(...e);
}finally{await browser.close();}
console.log(JSON.stringify(report,null,1));if(errors.length){console.error(errors);process.exit(1);}
console.log('Material strips written; no console errors');
