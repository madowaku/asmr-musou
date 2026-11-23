// Mean on-screen colour per material (for the HUD chips): render stage 3's blend phase, print body centres.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:360,height:640}});
await p.goto(pathToFileURL(path.join(root,'stages.html')).href+'?all=1');await p.waitForFunction(()=>window.STAGES);
const pos=await p.evaluate(()=>{STAGES.test.play('slasher',1,null,3);const S=STAGES.state;S.t=25;S.stats.ups=['-','-'];for(let i=0;i<30;i++)STAGES.test.step(1/60);STAGES.test.draw();return LAB.world.enemies().map(e=>({m:e.material,x:e.x/720,y:e.y/1280}));});
await p.screenshot({path:path.join(root,'research/v06/screens/colors.png')});console.log(JSON.stringify(pos));await b.close();
