import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const url=pathToFileURL(path.join(root,'lab.html')).href;
export async function openLab(browser,{clock=true,mobile=false}={}){
  const page=await browser.newPage({viewport:mobile?{width:360,height:640}:{width:720,height:1280},deviceScaleFactor:1,offline:true,hasTouch:mobile,isMobile:mobile});
  const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  if(clock){await page.clock.install({time:new Date('2026-11-22T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-22T00:00:01Z'));}
  await page.goto(url);await page.waitForFunction(()=>window.LAB?.ready);if(clock)await page.clock.runFor(33);
  return {page,errors,network};
}
export async function reset(page,material){await page.evaluate(m=>{LAB.test.clear();LAB.test.spawn(m);},material);await page.clock.runFor(33);}
export async function swipe(page,a,b,{steps=1,clock=true}={}){
  const box=await page.locator('#scene').boundingBox(),p=v=>({x:box.x+v.x*box.width/720,y:box.y+v.y*box.height/1280}),start=p(a),end=p(b);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  for(let i=1;i<=steps;i++){await page.mouse.move(start.x+(end.x-start.x)*i/steps,start.y+(end.y-start.y)*i/steps);if(clock&&steps>1)await page.clock.runFor(16);}
  await page.mouse.up();if(clock)await page.clock.runFor(16);
}
export const waxLine={a:{x:110,y:500.6624},b:{x:610,y:789.3376}};
export const state=page=>page.evaluate(()=>LAB.test.getState());
