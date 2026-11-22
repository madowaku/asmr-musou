// Records a 9:16 WebM (canvas + synthetic audio) of every material study + a mixed 無双 mob, via the lab's
// own MediaRecorder (real clock). Output: research/v03/video/lab_demo.webm (+ mp4 if ffmpeg exists).
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'research/v03/video');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1,acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(root,'lab.html')).href);await page.waitForFunction(()=>window.LAB?.ready);
const box=await page.locator('#scene').boundingBox(),P=(x,y)=>[box.x+x*box.width/720,box.y+y*box.height/1280];
await page.evaluate(()=>LAB.test.clear());await page.mouse.click(...P(40,160));await page.waitForTimeout(300); // unlock audio on an empty spot
const audio=await page.evaluate(()=>LAB.audio.stats());console.log('audio',audio.contextState,audio.ready);
async function rake(pts,steps=6){await page.mouse.move(...P(...pts[0]));await page.mouse.down();for(const q of pts.slice(1))await page.mouse.move(...P(...q),{steps});await page.mouse.up();}
await page.keyboard.press('r');await page.waitForTimeout(400);
const wait={wax:1300,jelly:1500,soap:1500,sand:2800,chalk:1700,beadslime:1800,kohaku:1400};
for(const m of ['wax','jelly','kohaku','soap','chalk','beadslime','sand']){
  await page.evaluate(m=>{LAB.test.clear();LAB.test.spawn(m,360,600,190);},m);await page.waitForTimeout(450);
  await rake([[70,470],[650,760]]);await page.waitForTimeout(wait[m]);
}
await page.evaluate(()=>{LAB.test.clear();LAB.test.spawn('sponge',360,600,190);});await page.waitForTimeout(400);
await page.mouse.move(...P(360,620));await page.mouse.down();await page.waitForTimeout(1100);await page.mouse.up();await page.waitForTimeout(1300);
// finale: mixed mob, one zig-zag rake
await page.evaluate(()=>LAB.test.horde(72,true,['wax','jelly','kohaku','soap','chalk','beadslime','sand','sponge']));await page.waitForTimeout(700);
await rake([[10,560],[710,600],[10,700],[710,760],[10,850]],5);await page.waitForTimeout(3200);
const dl=page.waitForEvent('download');await page.keyboard.press('r');const file=await dl;const webm=path.join(out,'lab_demo.webm');await file.saveAs(webm);
const stats=await page.evaluate(()=>({cuts:LAB.test.getState().cutCount,audio:LAB.audio.stats()}));
await browser.close();
console.log(JSON.stringify({webm,cuts:stats.cuts,audioReady:stats.audio.ready,maxActive:stats.audio.maxActive,errors},null,1));
try{execFileSync('ffmpeg',['-y','-loglevel','error','-i',webm,'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','160k','-movflags','+faststart',path.join(out,'lab_demo.mp4')]);console.log('mp4 written');}catch(e){console.log('ffmpeg skipped:',e.message);}
if(errors.length)process.exit(1);
