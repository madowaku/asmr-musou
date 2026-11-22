// Screens for review / docs (fake clock → deterministic): select, each class before vs after 2 upgrades
// (same field, same gesture, same moment), charge, upgrade overlay, boss, result.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.argv[2]||path.join(root,'research/v05/screens');await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:412,height:732},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e.stack||e)));
await p.clock.install();await p.goto(pathToFileURL(path.join(root,'feel.html')).href);await p.clock.runFor(800);await p.waitForFunction(()=>window.FEEL&&!document.getElementById('select').hidden);
await p.screenshot({path:out+'/select.png'});
const UPS={slasher:['wide','double'],crusher:['blast','quake'],caster:['wide','double']},AFTER={slasher:150,crusher:260,caster:170};
for(const cls of ['slasher','crusher','caster'])for(const lv of [0,2]){
  await p.evaluate(([c,ups])=>{FEEL.start(c,1);for(const u of ups){FEEL.state.hero.ups.add(u);FEEL.state.stats.ups.push(u);}},[cls,lv?UPS[cls]:[]]);await p.clock.runFor(1200);
  await p.evaluate(c=>{const en=LAB.combat.targets().filter(e=>e.y>330&&e.y<1000),d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);en.sort((a,b)=>en.filter(o=>d(o,b)<130).length-en.filter(o=>d(o,a)<130).length);const t=en[0],P=FEEL.test.input;
    if(c==='slasher'){const A={x:t.x-150,y:t.y+40};P.down(A);for(let i=1;i<=6;i++)P.move({x:A.x+50*i,y:A.y-13*i});P.up({x:A.x+300,y:A.y-80});}else{P.down({x:t.x,y:t.y});P.up({x:t.x,y:t.y});}},cls);
  await p.clock.runFor(AFTER[cls]);await p.screenshot({path:`${out}/${cls}_lv${lv}.png`});}
// charge (caster): the circle follows the finger and sucks the crowd in
await p.evaluate(()=>{FEEL.start('caster',2);});await p.clock.runFor(1200);await p.evaluate(()=>FEEL.test.input.down({x:360,y:560}));await p.clock.runFor(800);await p.screenshot({path:out+'/charge.png'});
await p.evaluate(()=>FEEL.test.input.up({x:360,y:560}));await p.clock.runFor(140);await p.screenshot({path:out+'/release.png'});
// upgrade overlay
await p.evaluate(()=>{FEEL.start('crusher',1);});await p.clock.runFor(400);await p.evaluate(()=>{FEEL.state.t=11.95;});await p.clock.runFor(200);await p.screenshot({path:out+'/upgrade.png'});
// boss and result: skilled bot, auto-picks
await p.evaluate(()=>{FEEL.state.pickPolicy=ch=>ch[0];FEEL.test.play('slasher',1,'skilled');});await p.clock.runFor(37500);await p.screenshot({path:out+'/boss.png'});
for(let i=0;i<40&&!(await p.evaluate(()=>FEEL.state.state==='result'));i++)await p.clock.runFor(1000);await p.clock.runFor(500);await p.screenshot({path:out+'/result.png'});
console.log(errs.slice(0,3),'shots ->',out);await b.close();if(errs.length)process.exit(1);
