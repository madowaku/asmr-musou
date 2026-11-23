// ASMR図鑑: opens, one big specimen respawns, material/class switches work, every class breaks it (real pointer input).
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),shot=n=>path.join(root,'research/v06/screens',n);
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:390,height:693},deviceScaleFactor:2});
const errors=[];p.on('pageerror',e=>errors.push(String(e.stack||e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto(pathToFileURL(path.join(root,'stages.html')).href);await p.waitForFunction(()=>window.STAGES);
const fresh=await p.evaluate(()=>({disabled:document.getElementById('zukan').disabled,label:document.getElementById('zukan').textContent}));
await p.goto(pathToFileURL(path.join(root,'stages.html')).href+'?all=1');await p.waitForFunction(()=>window.STAGES);
await p.click('#zukan');await p.waitForTimeout(500);
const box=await p.locator('#scene').boundingBox(),at=(x,y)=>({x:box.x+x/720*box.width,y:box.y+y/1280*box.height});
const res={fresh,runs:[]};
for(const m of ['wax','jelly','soap'])for(const c of ['slasher','crusher','caster']){
  await p.click(`#help button[data-m="${m}"]`);await p.click(`#help button[data-c="${c}"]`);await p.waitForTimeout(300);
  const s0=await p.evaluate(()=>({mat:STAGES.state.zukan,cls:STAGES.state.cls,n:LAB.world.enemies().length,mix:LAB.combat.mix}));
  // hit the specimen 3 times (slasher swipes through it, others tap it)
  for(let i=0;i<3;i++){const q=at(360,560);if(c==='slasher'){const a=at(220,520+i*30),z=at(500,600-i*30);await p.mouse.move(a.x,a.y);await p.mouse.down();for(let k=1;k<=6;k++)await p.mouse.move(a.x+(z.x-a.x)*k/6,a.y+(z.y-a.y)*k/6);await p.mouse.up();}else{await p.mouse.move(q.x,q.y);await p.mouse.down();await p.waitForTimeout(40);await p.mouse.up();}await p.waitForTimeout(900);}
  const s1=await p.evaluate(()=>({kills:STAGES.state.stats.kills,byMaterial:STAGES.state.stats.byMaterial,n:LAB.world.enemies().length,state:STAGES.state.state,t:STAGES.state.t}));
  res.runs.push({m,c,start:s0,after:s1});console.log(m.padEnd(6),c.padEnd(8),'specimens',s0.n,'mix',s0.mix?.mat,s0.mix?.sfx,'→ kills',s1.kills,JSON.stringify(s1.byMaterial),'alive',s1.n,s1.state);
  if(m==='jelly'&&c==='crusher')await p.screenshot({path:shot('09_zukan.png')});}
await p.click('#help button[data-x]');await p.waitForTimeout(300);const back=await p.evaluate(()=>({state:STAGES.state.state,select:!document.getElementById('select').hidden}));
console.log('fresh visitor zukan button:',JSON.stringify(fresh),'back to select:',JSON.stringify(back));
await b.close();console.log(errors.length?errors.slice(0,5):'no errors');
