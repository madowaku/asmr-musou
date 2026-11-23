// Close-up of one opening enemy after each hit (0,1,2 hits) for each class: chips, cracks, inside showing.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:360,height:640},deviceScaleFactor:2});
await p.goto(pathToFileURL(path.join(root,'crunch.html')).href);await p.waitForFunction(()=>window.CRUNCH);
for(const cls of ['slasher'])for(const m of ['wax','jelly']){
  for(let k=0;k<3;k++){
    const box=await p.evaluate(([cls,m,k])=>{const C=LAB.combat,W=LAB.world,S=CRUNCH.state;CRUNCH.test.play(cls,3,null);S.paused=false;W.bodies.length=0;const e=C.crunch.spawn('weak',360,560,{m});e.speed=0;
      let cur=e;for(let i=0;i<k;i++){const from={x:360+(i%2?-80:80),y:1000};cur=C.crunch.hurt(cur,1,from);cur.speed=0;for(let j=0;j<20;j++)CRUNCH.test.step(1/60);}
      for(let j=0;j<30;j++)CRUNCH.test.step(1/60);S.state='play';CRUNCH.test.draw();return {hp:cur.hpc};},[cls,m,k]);
    await p.waitForTimeout(80);await p.screenshot({path:path.join(root,`research/v07/screens/close_${m}_${k}.png`),clip:{x:60,y:170,width:240,height:180}});}
  }
await b.close();console.log('ok');
